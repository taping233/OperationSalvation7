// ported from core/card-capacity.js, bag-render-derivation.js, hub/bag-inventory-commands.js, run-rescue-cards.js
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    // One synchronous render's replacement projection; never authorizes a command.
    public sealed class BagRestorationPreview
    {
        sealed class Group { public int Count,Cap,NextCap;public bool Resource,NextResource;public OwnedCard First; }
        readonly struct Source
        {
            public readonly string Key;public readonly int Bonus;public readonly bool First;
            public Source(string key,int bonus,bool first){Key=key;Bonus=bonus;First=first;}
        }
        readonly Dictionary<string,Group> _groups=new Dictionary<string,Group>();
        readonly Dictionary<string,int> _normalCounts=new Dictionary<string,int>();
        readonly Dictionary<string,Source> _sources=new Dictionary<string,Source>();
        readonly HashSet<string> _duplicates=new HashSet<string>();
        readonly int _used,_ordinary,_baseCap,_totalCap;
        internal BagRestorationPreview(GameRuntime game,BagCapacityQuery query)
        {
            _used=query.used;_ordinary=query.ordinarySlots;_baseCap=query.baseCap;_totalCap=query.totalCap;
            foreach(var entry in game.State.ownedCards)
            {
                if(entry.card==null||entry.stored||entry.safe==true)continue;
                string key=CardContainerCommands.Stable(entry.card);
                if(!_groups.TryGetValue(key,out var group))
                    _groups.Add(key,group=new Group{First=entry,Cap=CardContainerCommands.StackCap(entry.card),Resource=entry.card.type=="资源"});
                if(group.Count==1){group.NextCap=CardContainerCommands.StackCap(entry.card);group.NextResource=entry.card.type=="资源";}group.Count++;
                if(!string.IsNullOrEmpty(entry.pouchOf))continue;
                _normalCounts.TryGetValue(key,out int count);_normalCounts[key]=count+1;
                if(string.IsNullOrEmpty(entry.uid))continue;
                if(_sources.ContainsKey(entry.uid))_duplicates.Add(entry.uid);
                else _sources.Add(entry.uid,new Source(key,CardContainerCommands.ResourceSlots(entry.card),ReferenceEquals(group.First,entry)));
            }
        }
        public bool CanReplace(string sourceUid,CardDef card)
        {
            if(card==null||sourceUid==null||_duplicates.Contains(sourceUid)||!_sources.TryGetValue(sourceUid,out var source))return false;
            string key=CardContainerCommands.Stable(card);_normalCounts.TryGetValue(key,out int count);
            if(source.Key==key)count--;
            // Preserve the formal CanReceive short circuit, including an already overfull bag.
            if(count>0&&count%CardContainerCommands.StackCap(card)!=0)return true;
            var group=_groups[source.Key];int oldSlots=(group.Count+group.Cap-1)/group.Cap,remaining=group.Count-1;
            int cap=source.First?group.NextCap:group.Cap;bool resource=source.First?group.NextResource:group.Resource;
            int newSlots=remaining==0?0:(remaining+cap-1)/cap;
            int used=_used-oldSlots+newSlots,ordinary=_ordinary-(group.Resource?0:oldSlots)+(resource?0:newSlots);
            return used+1<=_totalCap-source.Bonus+CardContainerCommands.ResourceSlots(card)&&ordinary+(card.type=="资源"?0:1)<=_baseCap;
        }
    }
    public sealed class BagCapacityQuery
    {
        public int used,ordinarySlots,resourceSlots,baseCap,resourceBonus,totalCap,safeUsed;
        public bool capacityOk=>ordinarySlots<=baseCap&&used<=totalCap;
        public int ordinaryFree=>Math.Max(0,Math.Min(baseCap-ordinarySlots,totalCap-used));
        public int resourceFree=>ordinarySlots>baseCap?0:Math.Max(0,totalCap-used);
        public int SafeUsed=>safeUsed;
        internal int safeCap;
        internal Dictionary<(bool safe,string key),(int count,int cap,bool resource)> groups;

        public bool CanTakeFromContainer(CardDef card,int count)
        {
            if(card==null||count<=0||groups==null)return false;
            groups.TryGetValue((false,CardContainerCommands.Stable(card)),out var bag);
            int cap=bag.cap>0?bag.cap:CardContainerCommands.StackCap(card);
            int added=(bag.count+count+cap-1)/cap-(bag.count+cap-1)/cap;
            bool resource=bag.cap>0?bag.resource:card.type=="资源";
            return used+added<=totalCap&&ordinarySlots+(resource?0:added)<=baseCap;
        }

        // A render-local projection: reads the same groups as Query, without cloning cards.
        public bool CanStore(CardDef card,int count,out int requiredSlots)
        {
            requiredSlots=0;
            if(card==null||BaseData.IsSha(card)||count<=0||groups==null)return false;
            string key=CardContainerCommands.Stable(card);
            if(!groups.TryGetValue((false,key),out var bag)||count>bag.count)return false;
            groups.TryGetValue((true,key),out var safe);
            int cap=safe.cap>0?safe.cap:CardContainerCommands.StackCap(card);
            requiredSlots=(safe.count+count+cap-1)/cap-(safe.count+cap-1)/cap;
            int removed=(bag.count+bag.cap-1)/bag.cap-(bag.count-count+bag.cap-1)/bag.cap;
            return safeUsed+requiredSlots<=safeCap&&used-removed<=totalCap
                &&ordinarySlots-(bag.resource?0:removed)<=baseCap;
        }
    }
    public static class CardContainerCommands
    {
        public const string PouchId="tt7-stratagem",PearlId="tt2-pearlbox";
        internal static string Stable(CardDef card)=>!string.IsNullOrEmpty(card?.id)?"card:"+card.id+(string.IsNullOrEmpty(card.variantKey)?"":":"+card.variantKey):card?.name??"";
        public static int StackCap(CardDef card)=>card?.type=="装备"?1:3;
        static (int slots,string accepts)? Rule(CardDef card)
        {
            var equip=card?.rules?.Get("equip");var declared=equip?.Get("container");int slots=declared?.Number("slots")??0;
            if(slots>0)return(slots,declared.Text("accepts"));if(equip!=null)return null;
            return card?.id==PearlId?(9,"资源"):card?.id==PouchId?(3,"法术"):((int,string)?)null;
        }
        public static int ResourceBonus(IEnumerable<OwnedCard> owned)=>owned.Sum(o=>Rule(o.card) is var rule&&rule?.accepts=="资源"?rule.Value.slots:0);
        internal static int ResourceSlots(CardDef card)=>Rule(card) is var rule&&rule?.accepts=="资源"?rule.Value.slots:0;
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
            var groups=new Dictionary<(bool safe,string key),(int count,int cap,bool resource)>();
            int slots=0,resources=0,safe=0,bonus=0,supplies=0;
            foreach(var entry in projection??game.State.ownedCards){
                var rule=Rule(entry.card);if(rule?.accepts=="资源")bonus+=rule.Value.slots;
                if(entry.card==null||entry.stored)continue;
                var key=(entry.safe==true,Stable(entry.card));
                if(!groups.TryGetValue(key,out var group))group=(0,StackCap(entry.card),entry.card.type=="资源");
                if(group.count%group.cap==0){if(key.Item1)safe++;else{slots++;if(group.resource)resources++;}}
                group.count++;groups[key]=group;
            }
            foreach(var item in inventory??game.State.inventory)supplies+=(Math.Max(1,item.count)+2)/3;
            int cap=game.Base.BagCap;return new BagCapacityQuery{used=slots+supplies,ordinarySlots=slots+supplies-resources,resourceSlots=resources,baseCap=cap,resourceBonus=bonus,totalCap=cap+bonus,safeUsed=safe,safeCap=game.SafeCap,groups=groups};
        }
        public static BagCapacityQuery CreateSafeStoragePreview(GameRuntime game)=>Query(game);
        public static BagRestorationPreview CreateRestorationPreview(GameRuntime game,BagCapacityQuery query=null)
            =>new BagRestorationPreview(game,query??Query(game));
        public static bool CanReceive(GameRuntime game,CardDef card,IEnumerable<OwnedCard> projection=null)
        {
            if(card==null)return false;var owned=projection??game.State.ownedCards;if(!(owned is ICollection<OwnedCard>))owned=owned.ToList();string key=Stable(card);int count=0;foreach(var entry in owned)if(Normal(entry)&&Stable(entry.card)==key)count++;
            if(count>0&&count%StackCap(card)!=0)return true;
            var query=Query(game,owned);var rule=Rule(card);int bonus=rule?.accepts=="资源"?rule.Value.slots:0;
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
                    var selected=new HashSet<string>(observed);
                    if(observed.Count==0||selected.Count!=observed.Count)throw new InvalidOperationException("卡牌选择已变化");
                    entries=entries.Where(o=>selected.Contains(o.uid)).ToList();
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
                    var selected=new HashSet<OwnedCard>(entries);
                    var projected=game.State.ownedCards.Select(o=>selected.Contains(o)?new OwnedCard{uid=o.uid,card=o.card,safe=false,stored=false,pouchOf=null}:o);
                    if(!Query(game,projected).capacityOk)throw new InvalidOperationException("背包放不下整叠；资源扩展格只能存放资源卡");
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
