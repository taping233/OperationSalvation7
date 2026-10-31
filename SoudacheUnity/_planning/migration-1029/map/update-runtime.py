from pathlib import Path
p=Path('Assets/Scripts/Sdt.Run/GameRuntime.cs')
s=p.read_text(encoding='utf-8-sig')
s=s.replace('public sealed class GameRuntime\n','public sealed partial class GameRuntime\n',1)
s=s.replace('public int oldIdx;                  // 首个网格环索引','public string id; public int x,row; public List<MapLink> next = new List<MapLink>();\n            public int oldIdx;                  // 节点索引',1)
s=s.replace('public string id, name, nameEn, color, risk;','public string id, name, nameEn, color, risk;\n            public int entry, exit;',1)
a=s.index('        public void BuildDerived()')
b=s.index('        /// <summary>外圈出口门格补',a)
s=s[:a]+'''        public void BuildDerived()
        {
            Map = State.mapSnapshot == null ? MapModel.Build(State.seed ?? 0) : MapModel.FromSnapshot(State.mapSnapshot);
            State.mapSnapshot = Map.Snapshot;
            Layers = Map.LayerData.Select((layer,li) => new RuntimeLayer
            {
                id=layer.id,name=layer.name,nameEn=layer.nameEn,color=layer.color,risk=new[]{"低","中","高","极高"}[li],
                entry=Map.Snapshot.layers[li].entry,exit=Map.Snapshot.layers[li].exit,
                entrances=layer.entrances,entranceNames=layer.entranceNames.ToList(),
                doors=layer.doors.Select(d=>new RuntimeDoor{pair=d.pair,at=d.at,toLayer=d.toLayer,arriveAt=d.arriveAt,exit=false,reverse=false}).ToList(),
                logical=Map.Snapshot.layers[li].nodes.Select(n=>new LogicalCell{id=n.id,oldIdx=n.idx,x=n.x,row=n.row,next=n.next,type=n.type,name=n.name,fire=n.type=="fire"}).ToList(),
                nodePos=Map.NodePos[li].Select(p=>(p.x,p.y)).ToList()
            }).ToList();
            var altar=Map.Nodes.First(n=>n.type=="altar");CenterPos=new List<(float,float)>{(altar.x,altar.y)};
        }

'''+s[b:]
s=s.replace('                seed = g.seed ?? 0,','''                seed = g.seed ?? 0,
                mapSnapshot=g.mapSnapshot,explored=g.explored.ToList(),revealed=g.revealed.ToList(),settled=g.settled.ToList(),closed=g.closed.ToList(),
                altarActivated=g.altarActivated,bossDefeated=g.bossDefeated,nodeRewards=g.nodeRewards,''',1)
s=s.replace('            Saves.WriteSlot(ActiveSlot.Value, new RunSaveData','            bool saved = Saves.WriteSlot(ActiveSlot.Value, new RunSaveData',1)
s=s.replace('            Bus.Emit(new SaveCompleted { Slot = ActiveSlot.Value });','''            if(saved)Bus.Emit(new SaveCompleted { Slot = ActiveSlot.Value });
            else Bus.Emit(new ToastRequested{Text="保存失败，请重试；本局进度仍保留在内存中",Tone="warn"});''',1)
s=s.replace('            g.chainMove = 0; g.pendingEventLoot = null; g.altarFrom = null;\n            EnterLayer','''            g.chainMove = 0; g.pendingEventLoot = null; g.altarFrom = null;
            g.mapSnapshot=s.mapSnapshot;g.explored=new HashSet<string>(s.explored??new List<string>());g.revealed=new HashSet<string>(s.revealed??new List<string>());
            g.settled=new HashSet<string>(s.settled??new List<string>());g.closed=new HashSet<string>(s.closed??new List<string>());g.nodeRewards=s.nodeRewards??new Dictionary<string,NodeVisitReceipt>();
            g.altarActivated=s.altarActivated;g.bossDefeated=s.bossDefeated;_lastNode=null;_lastNodeKey=null;BuildDerived();
            EnterLayer''',1)
s=s.replace('            g.inventory = new List<InvSlot>();','''            g.mapSnapshot=null;g.explored.Clear();g.revealed.Clear();g.settled.Clear();g.closed.Clear();g.nodeRewards.Clear();g.altarActivated=false;g.bossDefeated=false;g.spellPower=0;_lastNode=null;_lastNodeKey=null;
            BuildDerived();
            g.inventory = new List<InvSlot>();''',1)
s=s.replace('掷骰环走，落脚触发事件；外环闸门可撤离，深处有污染核心与变异首脑','沿道路选择相邻地点，探索四层地图；第三层可献祭撤离，击败首脑后终局撤离',1)
s=s.replace('            State.Phase = "idle";\n            var f = CurLayer;','            State.Phase = "idle";\n            RevealCurrent();\n            var f = CurLayer;',1)
a=s.index('        public RollResult Roll()')
b=s.index('        NodeResult _lastNode;',a)
s=s[:a]+'''        public RollResult Roll()
        {
            Bus.Emit(new ToastRequested("请选择地图上的相邻地点，再次点击确认前往"));
            return null;
        }

'''+s[b:]
a=s.index('        public NodeResult ResolveCell()')
b=s.index('        void Present(NodeResult node)',a)
s=s[:a]+'''        public NodeResult ResolveCell()
        {
            var g=State;var lc=CurLayer.logical[g.trackPos];string key=CurrentNodeId;
            if(g.closed.Contains(key)||(g.settled.Contains(key)&&lc.type!="shop")){g.Phase="idle";SaveCurrent();return null;}
            if(_lastNodeKey==key&&_lastNode!=null){g.Phase="modal";Present(_lastNode);return _lastNode;}
            var receipt=CurrentNodeReceipt;NodeResult node=null;
            switch(lc.type)
            {
                case "entrance":g.settled.Add(key);g.Phase="idle";SaveCurrent();return null;
                case "battle":node=BattleNode(BuildEncounter(g.layerIdx));break;
                case "boss":
                    if(!g.altarActivated){g.Phase="idle";Bus.Emit(new ToastRequested("需先激活祭坛"));return null;}
                    int boss=string.IsNullOrEmpty(receipt.eventCardId)?(int)(Rng.NextDouble()*MapData.AltarBosses.Length):Array.FindIndex(MapData.AltarBosses,b=>b.id==receipt.eventCardId);
                    if(boss<0)throw new InvalidOperationException("首脑记录无法恢复");receipt.eventCardId=MapData.AltarBosses[boss].id;SaveCurrent();
                    var req=FightBoss(boss);node=new NodeResult{Kind=NodeKind.Boss,KindRaw="boss",Battle=req,Transition=Transitions["battle"]};break;
                case "altar":node=AltarEntranceNode((key,g.trackPos),lc);break;
                case "extraction":g.Phase="modal";node=new NodeResult{Kind=NodeKind.Extraction,KindRaw="extraction",Transition=Transitions["emergencyExit"]};break;
                case "door":var d=CurLayer.doors.FirstOrDefault(x=>x.at==g.trackPos);node=d==null?null:DoorNode(d,lc);break;
                case "emergencyExit":node=EmergencyNode();break;
                case "shop":node=ShopNode();break;
                case "event":
                    if(!string.IsNullOrEmpty(receipt.eventCardId)){var card=CardLibrary.FindById(receipt.eventCardId);node=new NodeResult{Kind=NodeKind.Event,KindRaw="event",Instant=new InstantInfo{EventCard=card}};g.Phase="modal";}
                    else {node=RunInstant(lc);receipt.eventCardId=node?.Instant?.EventCard?.id;}
                    break;
                case "chest":
                    receipt.chests=receipt.chests??new[]{Rng.NextDouble()<.7?"small":"medium"};g.Phase="modal";
                    node=new NodeResult{Kind=NodeKind.Chest,KindRaw="chest",Instant=new InstantInfo{Chests=receipt.chests.ToList()}};break;
                case "resource":
                    if(!receipt.completed){var resource=Pick(CardDatabase.All.Where(c=>c.type=="资源"&&!c.unrandom).ToList());GrantCard(resource);receipt.eventCardId=resource.id;receipt.completed=true;}
                    node=new NodeResult{Kind=NodeKind.Resource,KindRaw="resource",Instant=new InstantInfo{GainText=CardLibrary.FindById(receipt.eventCardId)?.name}};g.Phase="modal";break;
                default:node=RunInstant(lc);break;
            }
            _lastNodeKey=key;SaveCurrent();Present(node);return node;
        }

'''+s[b:]
s=s.replace('            _lastNode = node;','            _lastNode = node;\n            _lastNodeKey = CurrentNodeId;',1)
a=s.index('        public NodeResult ChainMove(int n)')
b=s.index('        /// <summary>finishInstant',a)
s=s[:a]+'''        public NodeResult ChainMove(int n)
        {
            State.chainMove=0;State.Phase="idle";
            for(int step=0;step<Math.Abs(n);step++){
                var next=GetReachableNodeIds().FirstOrDefault();if(next==null||!TryMoveToNode(next,out _))break;
                if(State.Phase!="idle")break;
            }return _lastNode;
        }

'''+s[b:]
s=s.replace('            State.Phase = "idle";\n            SaveCurrent();\n        }\n\n        static string KindRawOf', '''            if(State.runActive && CurLayer.logical[State.trackPos].type!="shop"){
                State.settled.Add(CurrentNodeId);CurrentNodeReceipt.completed=true;
            }
            State.Phase = "idle";
            SaveCurrent();
        }

        static string KindRawOf''',1)
s=s.replace('"altar" => NodeKind.Altar, "boss" => NodeKind.Boss, _ => NodeKind.Event,','"altar" => NodeKind.Altar, "boss" => NodeKind.Boss, "resource" => NodeKind.Resource, "extraction" => NodeKind.Extraction, _ => NodeKind.Event,',1)
s=s.replace('TargetLayerName = MapData.Layers[door.toLayer].name,','TargetLayerName = Layers[door.toLayer].name,',1)
s=s.replace('            Log($"穿过隔离闸门 → <b>{door.TargetLayerName}</b>", "sys");','''            if(door==null||State.battleActive||!CurLayer.doors.Any(d=>d.at==State.trackPos&&d.toLayer==door.ToLayer&&d.arriveAt==door.ArriveAt))return;
            CloseCurrentNode();_lastNode=null;_lastNodeKey=null;
            Log($"穿过隔离闸门 → <b>{door.TargetLayerName}</b>", "sys");''',1)
s=s.replace('            EnterLayer(door.ToLayer, door.ArriveAt);','            EnterLayer(door.ToLayer, door.ArriveAt);\n            Bus.Emit(new NodeMovementCompleted{LayerIdx=State.layerIdx,NodeId=CurrentNodeId});',1)
s=s.replace('            State.pos = CenterPos[0];   // 中央祭坛结点','            State.pos = CellCenter(State.layerIdx,State.trackPos);',1)
s=s.replace('IsBoss = true, ReturnTo = "altar", Name = b.name,','IsBoss = true, ReturnTo = "map", Name = b.name, Layer=State.layerIdx,',1)
a=s.index('        public bool PayEmergencyExit()')
b=s.index('        // ============================================================',a)
s=s[:a]+'''        public bool PayEmergencyExit()
        {
            Bus.Emit(new ToastRequested("紧急撤离需要选择 3 张随身卡牌献祭"));return false;
        }

'''+s[b:]
p.write_text(s,encoding='utf-8')
