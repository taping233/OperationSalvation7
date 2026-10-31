// ported from core/card-capacity.js, bag-render-derivation.js, hub/bag-inventory-commands.js, run-rescue-cards.js
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed class BagCapacityQuery
    {
        public int used,ordinarySlots,resourceSlots,baseCap,resourceBonus,totalCap,safeUsed;
        public bool capacityOk=>ordinarySlots<=baseCap&&used<=totalCap;
    }
    public static class CardContainerCommands
    {
        public const string PouchId="tt7-stratagem",PearlId="tt2-pearlbox";
        static string Stable(CardDef card)=>GameRuntime.DepartureStackKey(new StashStack{card=card});
        public static int StackCap(CardDef card)=>card?.type=="装备"?1:3;
        static (int slots,string accepts)? Rule(CardDef card)
        {
            var equip=card?.rules?.Get("equip");var declared=equip?.Get("container");int slots=declared?.Number("slots")??0;
            if(slots>0)return(slots,declared.Text("accepts"));if(equip!=null)return null;
            return card?.id==PearlId?(9,"资源"):card?.id==PouchId?(3,"法术"):((int,string)?)null;
        }
        public static int ResourceBonus(IEnumerable<OwnedCard> owned)=>owned.Sum(o=>Rule(o.card) is var rule&&rule?.accepts=="资源"?rule.Value.slots:0);
        static bool Normal(OwnedCard entry)=>entry.safe!=true&&!entry.stored&&string.IsNullOrEmpty(entry.pouchOf);
        static bool Inside(OwnedCard entry,string kind)=>kind=="pouch"?entry.pouchOf==PouchId:entry.stored&&string.IsNullOrEmpty(entry.pouchOf);
        public static List<StashStack> ZoneStacks(IEnumerable<OwnedCard> owned,bool safe)
        {
            var stacks=new List<StashStack>();
            foreach(var group in owned.Where(o=>o.card!=null&&!o.stored&&(o.safe==true)==safe).GroupBy(o=>Stable(o.card))){
                var card=group.First().card;int count=group.Count(),cap=StackCap(card);for(int i=0;i<count;i+=cap)stacks.Add(new StashStack{card=card,count=Math.Min(cap,count-i)});
            }return stacks;
        }
        public static BagCapacityQuery Query(GameRuntime game,IEnumerable<OwnedCard> projection=null,IEnumerable<InvSlot> inventory=null)
        {
            var owned=(projection??game.State.ownedCards).ToList();var stacks=ZoneStacks(owned,false);int resources=stacks.Count(s=>s.card.type=="资源");int supplies=(inventory??game.State.inventory).Sum(i=>(Math.Max(1,i.count)+2)/3);
            int bonus=ResourceBonus(owned);return new BagCapacityQuery{used=stacks.Count+supplies,ordinarySlots=stacks.Count+supplies-resources,resourceSlots=resources,baseCap=game.Base.BagCap,resourceBonus=bonus,totalCap=game.Base.BagCap+bonus,safeUsed=ZoneStacks(owned,true).Count};
        }
        public static bool CanReceive(GameRuntime game,CardDef card,IEnumerable<OwnedCard> projection=null)
        {
            if(card==null)return false;var owned=(projection??game.State.ownedCards).ToList();int count=owned.Count(o=>Normal(o)&&Stable(o.card)==Stable(card));
            if(count>0&&count%StackCap(card)!=0)return true;
            var query=Query(game,owned);int bonus=Rule(card)?.accepts=="资源"?Rule(card).Value.slots:0;
            return query.used+1<=query.totalCap+bonus&&query.ordinarySlots+(card.type=="资源"?0:1)<=query.baseCap;
        }
        public static int Capacity(GameRuntime game,string kind)
        {
            string id=kind=="pouch"?PouchId:kind=="pearl"?PearlId:null;if(id==null)return 0;
            var containers=game.State.ownedCards.Where(o=>o.card.id==id);if(kind=="pouch")containers=containers.Take(1);
            return containers.Sum(o=>Rule(o.card)?.slots??0);
        }
        public static List<OwnedCard> StoredCards(GameRuntime game,string kind)=>game.State.ownedCards.Where(o=>Inside(o,kind)).ToList();
        public static bool TryTransferStack(GameRuntime game,string kind,bool take,string name,out string reason,IEnumerable<string> sourceUids=null)
        {
            var observed=sourceUids?.ToList();
            return game.TryPersistMutation(()=>{
                if(!game.State.runActive||game.State.battleActive)throw new InvalidOperationException("当前无法整理容器");
                if(kind!="pouch"&&kind!="pearl")throw new InvalidOperationException("容器类型无效");
                int capacity=Capacity(game,kind);if(capacity<=0)throw new InvalidOperationException("容器已不在背包中");
                var entries=take?StoredCards(game,kind).Where(o=>o.card.name==name).ToList():game.State.ownedCards.Where(o=>Normal(o)&&o.card.name==name).ToList();
                // Both directions consume the observed UID set, including same-name variants.
                if(observed!=null){
                    if(observed.Count==0||observed.Distinct().Count()!=observed.Count)throw new InvalidOperationException("卡牌选择已变化");
                    entries=entries.Where(o=>observed.Contains(o.uid)).ToList();
                    if(entries.Count!=observed.Count||entries.Select(o=>Stable(o.card)).Distinct().Count()!=1)throw new InvalidOperationException("卡牌已不在原位置");
                }else if(entries.Count>0){
                    string stable=Stable(entries[0].card);entries=entries.Where(o=>Stable(o.card)==stable).ToList();
                    if(!take)entries=entries.Take(StackCap(entries[0].card)).ToList();
                }
                if(entries.Count==0)throw new InvalidOperationException("这些卡牌已不在原位置");
                if(!take&&entries.Count>StackCap(entries[0].card))throw new InvalidOperationException("请选择一个实际堆叠");
                if(!take){
                    string id=kind=="pouch"?PouchId:PearlId;var containers=game.State.ownedCards.Where(o=>o.card.id==id);if(kind=="pouch")containers=containers.Take(1);
                    bool accepted=containers.Any(o=>Rule(o.card) is var rule&&rule!=null&&(string.IsNullOrEmpty(rule.Value.accepts)||rule.Value.accepts==entries[0].card.type));
                    if(!accepted||(kind=="pouch"&&entries[0].card.id==PouchId))throw new InvalidOperationException("容器无法收纳此类卡牌");
                    if(StoredCards(game,kind).Count+entries.Count>capacity)throw new InvalidOperationException("容器放不下整叠，请先取出一些卡牌");
                }
                else{
                    var projection=game.State.ownedCards.ToList();foreach(var entry in entries){
                        var projected=projection.Select(o=>o==entry?new OwnedCard{uid=o.uid,card=o.card,safe=false,stored=false,pouchOf=null}:o).ToList();
                        if(!Query(game,projected).capacityOk)throw new InvalidOperationException("背包放不下整叠；资源扩展格只能存放资源卡");projection=projected;
                    }
                }
                foreach(var entry in entries){entry.stored=!take;entry.pouchOf=take?null:kind=="pouch"?PouchId:null;}
            },out reason);
        }
        public static bool TryMoveSafe(GameRuntime game,IEnumerable<string> uids,bool toSafe,out string reason)
        {
            var selected=uids?.Distinct().ToList();return game.TryPersistMutation(()=>{
                if(!game.State.runActive||game.State.battleActive||selected==null||selected.Count==0)throw new InvalidOperationException("当前无法移动卡牌");
                var entries=game.State.ownedCards.Where(o=>selected.Contains(o.uid)&&!o.stored&&string.IsNullOrEmpty(o.pouchOf)&&(o.safe==true)!=toSafe).ToList();
                if(entries.Count!=selected.Count||entries.Any(o=>toSafe&&BaseData.IsSha(o.card)))throw new InvalidOperationException("卡牌已变化或无法移入安全格");
                var projected=game.State.ownedCards.Select(o=>entries.Contains(o)?new OwnedCard{uid=o.uid,card=o.card,safe=toSafe}:o).ToList();var query=Query(game,projected);
                if(query.safeUsed>game.SafeCap||!query.capacityOk)throw new InvalidOperationException("移动后容量不足，请先整理背包或安全格");
                foreach(var entry in entries)entry.safe=toSafe;
            },out reason);
        }
        public static bool TryDiscard(GameRuntime game,string uid,out string reason)=>game.TryPersistMutation(()=>{
            if(!game.State.runActive||game.State.battleActive)throw new InvalidOperationException("当前无法丢弃卡牌");
            var entry=game.State.ownedCards.FirstOrDefault(o=>o.uid==uid&&!o.stored&&string.IsNullOrEmpty(o.pouchOf));if(entry==null||BaseData.IsSha(entry.card))throw new InvalidOperationException("卡牌无法丢弃");
            string kind=entry.card.id==PouchId?"pouch":entry.card.id==PearlId?"pearl":null;
            if(kind!=null&&StoredCards(game,kind).Count>0&&!game.State.ownedCards.Any(o=>o!=entry&&o.card.id==entry.card.id&&!o.stored&&string.IsNullOrEmpty(o.pouchOf)&&Rule(o.card)!=null))throw new InvalidOperationException("请先取出容器中的卡牌");
            game.State.ownedCards.Remove(entry);
        },out reason);
        public static List<StashStack> RescueCards(GameRuntime game,bool includeBrought=true)
        {
            bool boxSafe=game.State.ownedCards.Any(o=>o.safe==true&&o.card.id==PearlId);
            return game.State.ownedCards.Where(o=>(includeBrought||o.brought!=1)&&(o.safe==true||(o.stored&&string.IsNullOrEmpty(o.pouchOf)&&boxSafe))).GroupBy(o=>Stable(o.card)).Select(g=>new StashStack{card=g.First().card,count=g.Count(),variantKey=g.First().card.variantKey}).ToList();
        }
    }
}
