from pathlib import Path
p=Path('Assets/Scripts/Sdt.Core/MapModel.cs');s=p.read_text(encoding='utf-8-sig')
a=s.index('        public static readonly IReadOnlyDictionary<string, MonsterDef> Monsters =')
b=s.index('        // 兼容旧引用',a)
s=s[:a]+'''        public static readonly IReadOnlyDictionary<string, MonsterDef> Monsters = CurrentMapData.Monsters;
        public static readonly EncounterDef[] Encounters = CurrentMapData.Encounters;
'''+s[b:]
a=s.index('        public static readonly AltarBossDef[] AltarBosses =')
b=s.index('        // 中央 2×2',a)
s=s[:a]+'''        public static readonly AltarBossDef[] AltarBosses = CurrentMapData.Bosses;
'''+s[b:];p.write_text(s,encoding='utf-8')
p=Path('Assets/Scripts/Sdt.Run/GameRuntime.cs');s=p.read_text(encoding='utf-8-sig')
a=s.index('        public List<EnemyStats> BuildEncounter(int layerIdx)')
b=s.index('        string _lastRisk, _lastStrategy;',a)
s=s[:a]+'''        public List<EnemyStats> BuildEncounter(int layerIdx)
        {
            var enc=MapData.Encounters[Math.Max(0,Math.Min(layerIdx,MapData.Encounters.Length-1))];
            int entryCount=enc.entries.Length,groupCount=enc.groups?.Length??0;int chosen=(int)(Rng.NextDouble()*(entryCount+groupCount));
            var group=chosen>=entryCount?enc.groups[chosen-entryCount]:null;var entry=group==null?enc.entries[chosen]:null;
            int n=group==null?entry.size[0]+(int)(Rng.NextDouble()*(entry.size[1]-entry.size[0]+1)):2;
            var alternatives=layerIdx==2&&group==null?enc.entries.Where(e=>e.size[0]<=n&&e.size[1]>=n&&!MapData.Monsters[e.id].elite).ToList():new List<EncounterEntry>();
            int ordinal=Layers[layerIdx].logical.Where(c=>c.type=="battle").ToList().FindIndex(c=>c.oldIdx==State.trackPos);uint hash=2166136261;
            unchecked{foreach(char c in (State.mapSnapshot.seed+":third-layer-encounters:v1")){hash^=c;hash*=16777619;}}
            EnemyStats Enemy(string id){var t=MapData.Monsters[id];return ScaledEnemy(new EnemyStats{id=t.id,name=t.name,hp=t.hp,atk=t.atk,behavior=t.behavior,elite=t.elite,eliteSkill=t.eliteSkill,desc=t.desc,damageCap=t.damageCap,evenAttack=t.evenAttack});}
            var list=new List<EnemyStats>();for(int i=0;i<n;i++){
                string id=group==null?entry.id:group.enemyIds[i];
                if(group==null)Rng.NextDouble();
                if(alternatives.Count>1&&ordinal>=0)id=alternatives[(int)(((ulong)hash+(uint)ordinal+(uint)i)%(ulong)alternatives.Count)].id;
                list.Add(Enemy(id));
            }
            if(enc.guaranteedElite?.Length>0)list[0]=Enemy(enc.guaranteedElite[(int)(Rng.NextDouble()*enc.guaranteedElite.Length)]);
            _lastRisk=enc.risk;_lastStrategy=group?.strategy??enc.strategy;return list;
        }
'''+s[b:]
a=s.index('        public NodeResult FireRestNode()')
b=s.index('        // ---------- 事件卡',a)
s=s[:a]+'''        public NodeResult FireRestNode()
        {
            var receipt=CurrentNodeReceipt;State.Phase="modal";
            return new NodeResult{Kind=NodeKind.Fire,KindRaw="fire",Transition=FallbackTransition,Instant=new InstantInfo{Fire=new FireRestInfo{HealAmount=receipt.healAmount,RestorePicks=receipt.restoreUsed?0:2,GotClassCard=receipt.bonusReceived,ClassCardName=CardLibrary.FindById(receipt.classCardId)?.name}}};
        }
        static bool FireRestorable(CardDef c)=>c!=null&&c.type!="装备"&&c.type!="道具";
        bool FitsRestored(CardDef c)=>State.ownedCards.Any(o=>o.safe!=true&&o.card.name==c.name)||UsedSlots()<BagCap;
        void FireBonus(NodeVisitReceipt receipt)
        {
            if(receipt.bonusRolled)return;receipt.bonusRolled=true;
            if(Rng.NextDouble()<GameRules.FireClassCardChance){var c=CardLibrary.RandomClassCard(Rng,State.myClass);if(c!=null){receipt.classCardId=c.id;receipt.bonusReceived=GrantCard(c);}}
        }
        public bool TryFireHeal(out string reason)
        {
            reason=null;var r=CurrentNodeReceipt;if(State.battleActive||r.type!="fire"||State.closed.Contains(CurrentNodeId)||r.healUsed||State.hp>=State.maxHp){reason="当前无法回血";return false;}
            r.healAmount=Heal(FireHeal);r.healUsed=true;FireBonus(r);SaveCurrent();return true;
        }
        public bool TryFireRestore(out string reason)
        {
            reason=null;var r=CurrentNodeReceipt;if(State.battleActive||r.type!="fire"||State.closed.Contains(CurrentNodeId)||r.restoreUsed){reason="本次复原已使用";return false;}
            if(!State.usedPocket.Any(p=>p.count>0&&FireRestorable(p.card)&&FitsRestored(p.card))){reason="没有可复原卡牌或背包需腾位";return false;}
            FireBonus(r);int restored=0;for(int i=0;i<2;i++){var available=State.usedPocket.Where(p=>p.count>0&&FireRestorable(p.card)&&FitsRestored(p.card)).ToList();if(available.Count==0)break;var p=Pick(available);p.count--;if(p.count==0)State.usedPocket.Remove(p);State.ownedCards.Add(new OwnedCard{uid=NewUid(),card=p.card});r.restoredIds.Add(p.card.id);restored++;}
            r.restoreUsed=restored>0;SaveCurrent();return restored>0;
        }
        public bool FireRestoreOne(int pocketIndex)
        {
            if(pocketIndex<0||pocketIndex>=State.usedPocket.Count)return false;
            return TryFireRestore(out _);
        }
        public int FireRestoreLeft=>CurrentNodeReceipt.restoreUsed?0:2;
        public void FireRestoreDone(){State.Phase="idle";SaveCurrent();}

'''+s[b:]
p.write_text(s,encoding='utf-8')
