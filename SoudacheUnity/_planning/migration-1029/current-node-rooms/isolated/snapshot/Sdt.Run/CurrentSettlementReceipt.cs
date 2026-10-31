using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
namespace Sdt.Run
{
    [Serializable] public sealed class RunGrowthReceipt
    {
        public int version=1,awardedXp,actualXp,overflowXp,levelsGained,xpToNext;public int? nextLevelXp;
        public string source="extraction",characterId,characterName;public bool maxed;public ClassProgress before,after;
    }
    [Serializable] public sealed class RunMementoTrail {public int layer,count;public string name;}
    [Serializable] public sealed class RunMementoRepresentative {public string name;public int count;}
    [Serializable] public sealed class RunMementoReceipt {public int version=1;public List<RunMementoTrail> trail=new List<RunMementoTrail>();public List<string> moments=new List<string>();public RunMementoRepresentative representative;}
    [Serializable] public sealed class SettlementNetTake {public int cardsStashed,pocketKept,wood,rations;}
    [Serializable] public sealed class SettlementLosses {public int lostCount,pocketLost,pocketRuleLost;public List<SettlementNotableLoss> lostNotable=new List<SettlementNotableLoss>();}
    [Serializable] public sealed class SettlementNotableLoss {public string name,rarity;public int count;}
    [Serializable] public sealed class SettlementFirstExplore {public int moves,xp;}
    [Serializable] public sealed class SettlementBattleFoe {public string name;public int hp,maxHp;}
    [Serializable] public sealed class SettlementBattleHit {public string source;public int damage;}
    [Serializable] public sealed class SettlementBattleReview
    {public int round;public bool isBoss;public List<SettlementBattleFoe> foes=new List<SettlementBattleFoe>();public List<SettlementBattleHit> hits=new List<SettlementBattleHit>();public string coverage;}
    [Serializable] public sealed class SettlementReceipt
    {
        public int version=1,layersReached,actions,runCoins,durationSec;public string outcome;public bool bossKilled;
        public SettlementFirstExplore firstExplore;public SettlementNetTake netTake=new SettlementNetTake();public SettlementLosses losses=new SettlementLosses();
        public List<StashStack> savedCards=new List<StashStack>();public RunGrowthReceipt growth;public RunMementoReceipt memento;public SettlementBattleReview battleReview;public string endReason;
    }
    public sealed class ExtractionSelection {public string name,sourceKey;public int count;}
    public static class CurrentSettlementLogic
    {
        public static string Variant(StashStack stack)=>!string.IsNullOrEmpty(stack.variantKey)?stack.variantKey:stack.card.variantKey??"";
        public static string SourceKey(StashStack stack)=>JsonConvert.SerializeObject(new object[]{string.IsNullOrEmpty(stack.card.id)?null:stack.card.id,Variant(stack),string.IsNullOrEmpty(stack.card.id)?stack.card.name:null});
        public static StashStack Copy(StashStack stack,int? count=null)=>new StashStack{card=stack.card.Clone(),count=count??stack.count,variantKey=Variant(stack)};
        public static List<StashStack> Stack(IEnumerable<StashStack> input)
        {
            var output=new List<StashStack>();foreach(var stack in input.Where(s=>s?.card!=null&&s.count>0))
            {var found=output.FirstOrDefault(s=>SourceKey(s)==SourceKey(stack));if(found!=null)found.count+=stack.count;else output.Add(Copy(stack));}return output;
        }
        public static int RarityRank(CardDef card)=>Array.IndexOf(new[]{"古朴","稀有","史诗","传说","棱彩"},card?.rarity??"古朴");
        public static int ExtractionXp(int firstExplore,double multiplier)=>(int)Math.Floor((20+firstExplore*2)*(multiplier>0?multiplier:1)+.5);
        public static List<ExtractionSelection> SelectOrdered(IEnumerable<StashStack> source,int room,string order)
        {
            var entries=source.Select((stack,index)=>new{stack,index});
            var ordered=order=="rarity"?entries.OrderByDescending(x=>RarityRank(x.stack.card)).ThenBy(x=>x.index):order=="value"?entries.OrderByDescending(x=>CardLibrary.SellPrice(x.stack.card)).ThenBy(x=>x.index):entries.OrderBy(x=>x.index);
            var result=new List<ExtractionSelection>();foreach(var entry in ordered){int take=Math.Min(entry.stack.count,Math.Max(0,room));if(take<=0)break;result.Add(new ExtractionSelection{name=entry.stack.card.name,sourceKey=SourceKey(entry.stack),count=take});room-=take;}return result;
        }
        public static List<StashStack> SavedCards(RunState game,IEnumerable<StashStack> left,bool preserveIdentity)
        {
            var owned=game.ownedCards.Where(o=>o.card!=null&&!BaseData.IsSha(o.card));
            var candidates=preserveIdentity?Stack(owned.Select(o=>new StashStack{card=o.card,count=1})):owned.GroupBy(o=>o.card.name).Select(g=>new StashStack{card=g.First().card,count=g.Count()}).ToList();
            var remaining=left.ToList();foreach(var stack in candidates){int count=remaining.Where(s=>preserveIdentity?SourceKey(s)==SourceKey(stack):s.card.name==stack.card.name).Sum(s=>s.count);stack.count=Math.Max(0,stack.count-count);}return candidates.Where(s=>s.count>0).ToList();
        }
        public static RunMementoReceipt Memento(RunState game,MapModel map,List<StashStack> saved)
        {
            if(map==null&&game.eventLog.Count==0&&game.nodeRewards.Count==0)return null;var m=new RunMementoReceipt();
            foreach(var group in game.explored.Where(key=>map?.CellDefs.ContainsKey(key)==true).GroupBy(key=>map.CellDefs[key].layerIdx).OrderBy(g=>g.Key))m.trail.Add(new RunMementoTrail{layer=group.Key+1,name=map.Layers[group.Key],count=group.Count()});
            var commission=game.nodeRewards.Values.Select(r=>r.eventProgress).Where(p=>p!=null).ToList();
            if(commission.Any(p=>p.commissionUsed))m.moments.Add("你交付了接应凭据，运输员替你付清了两格商品的价款。");
            else if(commission.Any(p=>p.commissionPending))m.moments.Add("你接下了运输员的接应凭据，这次还未兑付。");
            if(game.altarActivated)m.moments.Add("你唤醒了污染祭坛。");if(game.bossDefeated)m.moments.Add("你突破了首脑的封锁。");
            foreach(var entry in game.eventLog.AsEnumerable().Reverse()){if(m.moments.Count>=3)break;if(string.IsNullOrWhiteSpace(entry.name))continue;string text="途中遇见「"+entry.name.Substring(0,Math.Min(80,entry.name.Length))+"」。";if(!m.moments.Contains(text))m.moments.Add(text);}
            if(m.moments.Count==0&&m.trail.Count>0)m.moments.Add("你在"+m.trail.Last().name+"留下了探索足迹。");m.moments=m.moments.Take(3).ToList();
            var notable=saved.Where(s=>s.card!=null&&s.count>0).Select((stack,index)=>new{stack,index}).OrderByDescending(x=>Array.IndexOf(new[]{"古朴","稀有","史诗","传说","棱彩","职业"},x.stack.card.rarity)).ThenBy(x=>x.index).FirstOrDefault()?.stack;
            if(notable!=null)m.representative=new RunMementoRepresentative{name=notable.card.name,count=notable.count};return m;
        }
    }
}
