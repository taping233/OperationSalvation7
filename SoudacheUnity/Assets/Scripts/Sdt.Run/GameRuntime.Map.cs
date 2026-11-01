// ported from run/game.session.map.js, map-travel-path.js, map-node-arrival.js
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        public MapModel Map { get; private set; }
        string _lastNodeKey;
        public string CurrentNodeId => State.layerIdx+","+State.trackPos;
        public NodeVisitReceipt CurrentNodeReceipt
        {
            get
            {
                if(!State.nodeRewards.TryGetValue(CurrentNodeId,out var receipt))State.nodeRewards[CurrentNodeId]=receipt=new NodeVisitReceipt{type=CurLayer.logical[State.trackPos].type};
                return receipt;
            }
        }
        void RevealCurrent()
        {
            string key=CurrentNodeId;State.revealed.Add(key);
            foreach(var next in Map.Snapshot.layers[State.layerIdx].nodes[State.trackPos].next)State.revealed.Add(next.li+","+next.idx);
        }
        MapNode FindNode(string id)
        {
            if(Map==null||id==null)return null;
            if(Map.CellDefs.TryGetValue(id,out var node))return node;
            return Map.Nodes.FirstOrDefault(n=>Map.Snapshot.layers[n.layerIdx].nodes[n.idx].id==id);
        }
        bool KnownTravelNode(string key)=>State.revealed.Count==0||State.revealed.Contains(key)||State.settled.Contains(key)||State.closed.Contains(key);
        bool PassableTravelNode(string key)
        {
            if(!KnownTravelNode(key)||!Map.CellDefs.TryGetValue(key,out var node))return false;
            if(node.type=="door"||node.type=="altar"||node.type=="boss"||CurLayer.doors.Any(d=>d.at==node.idx))return false;
            if(node.type=="blank"||node.type=="entrance")return true;
            if(State.closed.Contains(key))return true;
            if(State.nodeRewards.TryGetValue(key,out var receipt)){
                if(receipt.type=="fire"&&(!receipt.healUsed||!receipt.restoreUsed)||receipt.altarRestoreLeft>0)return false;
                if(receipt.chestQueue!=null&&!receipt.completed||receipt.eventProgress!=null&&!receipt.eventProgress.settled)return false;
            }
            switch(node.type){
                case "battle":case "shop":case "coin":case "wood":case "chest":case "rations":case "key":case "fire":case "event":case "resource":return State.settled.Contains(key);
                default:return false;
            }
        }
        List<string> TravelPath(string id)
        {
            var target=FindNode(id);if(target==null)return null;
            if(target.id==CurrentNodeId)return new List<string>();
            if(!EntrySupplyComplete)return null;
            // Direct roads include the return edge from a deeper entry to the previous gate.
            if(Map.CellDefs[CurrentNodeId].next.Any(e=>e.li==target.layerIdx&&e.idx==target.idx))return new List<string>{target.id};
            if(target.layerIdx!=State.layerIdx||!KnownTravelNode(target.id))return null;
            string wanted=target.id;var previous=new Dictionary<string,string>{{CurrentNodeId,null}};var q=new Queue<string>();q.Enqueue(CurrentNodeId);
            while(q.Count>0){string key=q.Dequeue();if(key==wanted){var path=new List<string>();for(string at=wanted;previous[at]!=null;at=previous[at])path.Add(at);path.Reverse();return path;}
                var current=Map.CellDefs[key];foreach(var edge in current.next){if(edge.li!=State.layerIdx)continue;string next=edge.li+","+edge.idx;if(previous.ContainsKey(next)||!Map.CellDefs.ContainsKey(next)||next!=wanted&&!PassableTravelNode(next))continue;previous[next]=key;q.Enqueue(next);}}
            return null;
        }
        public List<string> GetReachableNodeIds()
        {
            if(!State.runActive||State.battleActive||State.Phase!="idle"||!EntrySupplyComplete||Map==null)return new List<string>();
            // A known endpoint can be reached without being safe to cross. Expand
            // only transit cells once, rather than running a separate BFS per target.
            string start=CurrentNodeId;var reachable=new HashSet<string>();var seen=new HashSet<string>{start};var queue=new Queue<string>();queue.Enqueue(start);
            while(queue.Count>0){string key=queue.Dequeue();foreach(var edge in Map.CellDefs[key].next){
                string next=edge.li+","+edge.idx;
                if(!Map.CellDefs.ContainsKey(next)||next==start)continue;
                if(key==start)reachable.Add(next);
                if(edge.li!=State.layerIdx)continue;
                if(KnownTravelNode(next))reachable.Add(next);
                if(seen.Add(next)&&PassableTravelNode(next))queue.Enqueue(next);
            }}
            return Map.Nodes.Where(n=>reachable.Contains(n.id)).Select(n=>n.id).ToList();
        }
        public bool CanMoveToNode(string id,out string reason)
        {
            reason=null;if(!State.runActive||State.battleActive||State.Phase!="idle"){reason="请先完成当前操作";return false;}
            if(!EntrySupplyComplete){reason="领完入城补给后才能前往其他地点";return false;}
            var node=FindNode(id);if(node==null){reason="地点不存在";return false;}
            if(node.type=="boss"&&!State.altarActivated){reason="需先激活祭坛";return false;}
            if(node.type=="extraction"&&!State.bossDefeated){reason="需先击败首脑";return false;}
            if(TravelPath(node.id)==null){reason="只能沿已揭示的道路前往相邻地点";return false;}return true;
        }
        public bool TryMoveToNode(string id,out string reason)
        {
            if(!CanMoveToNode(id,out reason))return false;
            return TryPersistMutation(()=>{
                if(!CanMoveToNode(id,out var changed))throw new InvalidOperationException(changed);
                var target=FindNode(id);var path=TravelPath(target.id);
                if(target.id==CurrentNodeId){ResolveCell();return;}
                State.Phase="moving";
                foreach(string step in path){
                    CloseCurrentNode();var at=FindNode(step);State.layerIdx=at.layerIdx;State.trackPos=at.idx;State.pos=CellCenter(at.layerIdx,at.idx);
                    State.turn++;Meta.Track("action");State.explored.Add(CurrentNodeId);RevealCurrent();
                }
                State.moveTarget=null;_lastNode=null;_lastNodeKey=null;
                Bus.Emit(new NodeMovementCompleted{LayerIdx=State.layerIdx,NodeId=target.id,Path=path});ResolveCell();
            },out reason);
        }
        void CloseCurrentNode()
        {
            State.closed.Add(CurrentNodeId);State.settled.Add(CurrentNodeId);
            if(State.nodeRewards.TryGetValue(CurrentNodeId,out var receipt)){receipt.completed=true;receipt.altarRewardPending=false;receipt.altarRestoreLeft=0;}
        }
        public void CompleteBattleNode(bool won)
        {
            if(won){State.settled.Add(CurrentNodeId);CurrentNodeReceipt.completed=true;if(CurrentNodeReceipt.eventProgress!=null)SettleEvent(CurrentNodeReceipt.eventProgress);}
            _lastNode=null;_lastNodeKey=null;
            State.Phase="idle";SaveCurrent();
        }
        public void NotifyBossDefeated(){State.bossDefeated=true;State.settled.Add(CurrentNodeId);CurrentNodeReceipt.completed=true;SaveCurrent();}
        bool Sacrifice(IEnumerable<string> uids,out string reason)
        {
            var ids=uids?.Distinct().ToList();reason=null;if(ids==null||ids.Count!=3){reason="请选择 3 张随身卡牌献祭";return false;}
            var cards=ids.Select(id=>State.ownedCards.FirstOrDefault(o=>o.uid==id&&o.safe!=true&&!o.stored&&string.IsNullOrEmpty(o.pouchOf))).ToList();if(cards.Any(o=>o==null)){reason="献祭卡牌已变化，请重新选择";return false;}
            foreach(var card in cards)State.ownedCards.Remove(card);return true;
        }
        public bool TryActivateAltar(IEnumerable<string> sacrificeUids,out string reason)
        {
            reason=null;if(State.battleActive||CurLayer.logical[State.trackPos].type!="altar"){reason="只能在祭坛激活";return false;}if(State.altarActivated){reason="祭坛已经激活";return false;}
            return TryPersistMutation(()=>{if(!Sacrifice(sacrificeUids,out var error))throw new InvalidOperationException(error);State.altarActivated=true;CurrentNodeReceipt.altarRewardPending=true;State.Phase="idle";Log("祭坛已激活，首脑通路开启，请选择一项回赠","ok");},out reason);
        }
        public bool TryEmergencyExtract(IEnumerable<string> sacrificeUids,out string reason)
        {
            reason=null;if(State.battleActive||State.layerIdx!=2||CurLayer.logical[State.trackPos].type!="emergencyExit"){reason="只能在第三层紧急撤离点献祭撤离";return false;}
            return TryPersistMutation(()=>{if(!Sacrifice(sacrificeUids,out var error))throw new InvalidOperationException(error);if(DoExtract()==null)throw new InvalidOperationException("撤离尚未完成，请重试");},out reason);
        }
        public bool TryFinalExtract(out string reason)
        {
            reason=null;if(State.battleActive||State.layerIdx!=3||CurLayer.logical[State.trackPos].type!="extraction"||!State.bossDefeated){reason="需在击败首脑后前往终局撤离点";return false;}
            if(DoExtract()!=null)return true;reason=Saves.LastError??"撤离未完成，请重试";return false;
        }
        public bool EntrySupplyComplete=>State.entrySupply==null||State.entrySupply.taken.Count==State.entrySupply.cardIds.Count;
        public List<CardDef> GetEntrySupplyCards()=>State.entrySupply?.cardIds.Select(CardLibrary.FindById).ToList()??new List<CardDef>();
        public bool ClaimEntrySupply(int index,out string reason)
        {
            reason=null;var supply=State.entrySupply;
            if(!State.runActive||State.battleActive||supply==null||index<0||index>=supply.cardIds.Count||supply.taken.Contains(index)){reason="该补给已领取或不可用";return false;}
            var card=CardLibrary.FindById(supply.cardIds[index]);if(card==null){reason="补给卡牌不存在";return false;}
            return TryPersistMutation(()=>{if(!GrantCard(card,true))throw new InvalidOperationException("背包需腾位");RecordEntrySupplyClaim(supply,index);},out reason);
        }
        void RecordEntrySupplyClaim(EntrySupplyReceipt supply,int index)
        {
            supply.taken.Add(index);
            if(State.classCard==null)State.classCard=State.ownedCards[State.ownedCards.Count-1].card;
        }
        public bool ClaimAllEntrySupply(out string reason)
        {
            reason=null;var supply=State.entrySupply;
            if(!State.runActive||State.battleActive||supply==null||EntrySupplyComplete){reason="该补给已领取或不可用";return false;}
            return TryPersistMutation(()=>
            {
                int received=0;
                for(int i=0;i<supply.cardIds.Count;i++)
                {
                    if(supply.taken.Contains(i))continue;
                    var card=CardLibrary.FindById(supply.cardIds[i]);
                    if(card==null||!CanReceiveCard(card))continue;
                    if(!GrantCard(card,true))throw new InvalidOperationException("当前补给无法领取，请重试");
                    RecordEntrySupplyClaim(supply,i);received++;
                }
                if(received==0)throw new InvalidOperationException("当前放不下，请整理背包后重试；补给已保留。");
            },out reason);
        }
        void ReserveResourceReward(NodeVisitReceipt receipt)
        {
            if(receipt.rewardCardIds!=null)return;receipt.rewardCardIds=new List<string>();var names=new HashSet<string>();
            var pool=CardLibrary.All().Where(c=>c.type=="资源"&&CardLibrary.IsRandomObtainable(c)).ToList();
            for(int i=0;i<2;i++){
                var tiers=CardLibrary.DropWeights.Select(kv=>(cards:pool.Where(c=>c.rarity==kv.Key&&!names.Contains(c.name)).ToList(),weight:kv.Value*(State.mode=="elite"&&kv.Key!="古朴"?1.2:1))).Where(t=>t.cards.Count>0&&t.weight>0).ToList();
                if(tiers.Count==0)break;double roll=Rng.Random("loot","reward")*tiers.Sum(t=>t.weight);var selected=tiers[tiers.Count-1];foreach(var tier in tiers){roll-=tier.weight;if(roll<=0){selected=tier;break;}}
                var card=selected.cards[(int)(Rng.Random("loot","reward")*selected.cards.Count)];receipt.rewardCardIds.Add(card.id);names.Add(card.name);
            }
        }
        public List<CardDef> GetResourceRewardCards()=>CurrentNodeReceipt.rewardCardIds?.Select(CardLibrary.FindById).ToList()??new List<CardDef>();
        public bool ClaimResourceReward(int index,out string reason)
        {
            reason=null;var receipt=CurrentNodeReceipt;
            if(receipt.type!="resource"||State.closed.Contains(CurrentNodeId)||receipt.rewardTaken!=null||receipt.rewardCardIds==null||index<0||index>=receipt.rewardCardIds.Count){reason="该物资已领取或不可用";return false;}
            return TryPersistMutation(()=>{if(!GrantCard(CardLibrary.FindById(receipt.rewardCardIds[index])))throw new InvalidOperationException("背包需腾位");
                receipt.rewardTaken=index;receipt.completed=true;State.settled.Add(CurrentNodeId);},out reason);
        }
    }
}
