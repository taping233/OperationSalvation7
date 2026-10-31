using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        List<StashStack> _extractLeft;
        public ExtractResult DoExtract()
        {
            var existing=ActiveSettlement();
            if(existing?.reason=="extract"){
                _extractLeft=existing.left??new List<StashStack>();return BuildExtractResult(existing.status=="complete");
            }
            if(!State.runActive||ActiveSlot==null)return null;
            ExtractResult result=null;
            if(!TryPersistMutation(()=>{
                SyncPlayTime();ClearBattleCheckpoint();var g=State;
                Base.Deposit(g.inventory.Select(x=>new InventorySlot{name=x.name,value=x.value,tier=x.tier,count=x.count}));
                var recovered=new List<StashStack>();
                foreach(var entry in g.usedPocket){int count=0;for(int i=0;i<entry.count;i++)if(Rng.Random("loot")<1.0/3&&!BaseData.IsSha(entry.card)&&entry.card.rarity!="职业"&&entry.card.hero!=true)count++;if(count>0)recovered.Add(new StashStack{card=entry.card,count=count});}
                Base.DepositCards(recovered,true);
                Meta.Track("extract",new MetaProgress.TrackData{coins=g.coins,actions=g.explored.Count,cls=g.myClass});
                _extractLeft=g.ownedCards.Where(o=>!BaseData.IsSha(o.card)).GroupBy(o=>o.card.name).Select(group=>new StashStack{card=group.First().card,count=group.Count()}).ToList();
                g.Phase="settlement";g.runActive=false;Saves.RemoveRun(ActiveSlot.Value);
                result=BuildExtractResult(false);
                Saves.PutSettlement(ActiveSlot.Value,new SettlementRecord{identity=RunIdentity,reason="extract",status="sorting",run=CaptureRunSave(),left=_extractLeft,extraction=result});
                Bus.Emit(new ExtractStashChanged{Result=result});
            },out _))return null;
            Audio.PlaySfx("victory");Audio.PlayBgm("title");return result;
        }

        ExtractResult BuildExtractResult(bool done)
        {
            var g=State;int seconds=(int)Math.Floor(g.elapsed);
            return new ExtractResult{
                WoodN=g.inventory.Where(i=>i.name=="木材").Sum(i=>i.count),RatN=g.inventory.Where(i=>i.name=="口粮").Sum(i=>i.count),ShaN=g.ownedCards.Count(o=>BaseData.IsSha(o.card)),
                OtherN=g.inventory.Where(i=>i.name!="木材"&&i.name!="口粮").Sum(i=>i.count),TotalValue=g.inventory.Sum(i=>(long)i.value*Math.Max(1,i.count)),
                TimeStr=(seconds/60).ToString("D2")+":"+(seconds%60).ToString("D2"),Actions=g.turn-1,Hp=g.hp,MaxHp=g.maxHp,Coins=g.coins,
                StashUsed=Base.StashUsed,StashCap=Base.StashCap,StashRoom=Base.StashRoom,CollectionCount=Base.collection.Count,
                Left=_extractLeft?.Select(x=>new StashStack{card=x.card,count=x.count}).ToList()??new List<StashStack>(),Done=done
            };
        }
        void SaveExtractionProgress(bool done)
        {
            var receipt=ActiveSettlement()??throw new InvalidOperationException("撤离回执缺失");
            receipt.status=done?"complete":"sorting";receipt.left=_extractLeft??new List<StashStack>();receipt.extraction=BuildExtractResult(done);
            Saves.PutSettlement(ActiveSlot.Value,receipt);
        }
        public ExtractResult ExtractStashOne(int index)
        {
            var receipt=ActiveSettlement();if(!IsPendingExtraction(receipt))return receipt?.extraction;
            _extractLeft=receipt.left;if(index<0||index>=_extractLeft.Count)return BuildExtractResult(false);
            if(!TryPersistMutation(()=>{
                var entry=_extractLeft[index];int take=Math.Min(entry.count,Base.StashRoom);if(take<=0)return;
                Base.DepositCards(new[]{new StashStack{card=entry.card,count=take}});Meta.Track("stash",new MetaProgress.TrackData{count=take});entry.count-=take;if(entry.count<=0)_extractLeft.RemoveAt(index);
                SaveExtractionProgress(false);Bus.Emit(new ExtractStashChanged{Result=BuildExtractResult(false)});
            },out _))return null;return BuildExtractResult(false);
        }
        public ExtractResult ExtractStashAll()
        {
            var receipt=ActiveSettlement();if(!IsPendingExtraction(receipt))return receipt?.extraction;
            _extractLeft=receipt.left;
            if(!TryPersistMutation(()=>{
                int total=0;foreach(var entry in _extractLeft.ToArray()){int take=Math.Min(entry.count,Base.StashRoom);if(take<=0)break;Base.DepositCards(new[]{new StashStack{card=entry.card,count=take}});entry.count-=take;total+=take;if(entry.count<=0)_extractLeft.Remove(entry);}
                if(total>0)Meta.Track("stash",new MetaProgress.TrackData{count=total});SaveExtractionProgress(false);Bus.Emit(new ExtractStashChanged{Result=BuildExtractResult(false)});
            },out _))return null;return BuildExtractResult(false);
        }
        public ExtractResult FinishExtract()
        {
            var receipt=ActiveSettlement();if(!IsPendingExtraction(receipt))return receipt?.extraction;
            if(!TryPersistMutation(()=>{
                _extractLeft=new List<StashStack>();State.Phase="done";SaveExtractionProgress(true);Bus.Emit(new ExtractStashChanged{Result=BuildExtractResult(true)});Bus.Emit(new RunEnded{Reason="win"});
            },out _))return null;return BuildExtractResult(true);
        }
        public DeathResult DoDeath()
        {
            var prior=ActiveSettlement();if(prior!=null)return prior.reason=="dead"?prior.death:null;
            if(!State.runActive||ActiveSlot==null)return null;DeathResult result=null;
            if(!TryPersistMutation(()=>{
                SyncPlayTime();ClearBattleCheckpoint();var g=State;var kept=CardContainerCommands.RescueCards(this);int count=kept.Sum(s=>s.count);
                Base.DepositCards(kept);if(count>0)Meta.Track("stash",new MetaProgress.TrackData{count=count});Meta.Track("death",new MetaProgress.TrackData{cls=g.myClass});
                result=new DeathResult{LostValue=g.inventory.Sum(i=>(long)i.value*i.count),SavedStacks=kept,SavedN=count};g.Phase="done";g.runActive=false;Saves.RemoveRun(ActiveSlot.Value);
                Saves.PutSettlement(ActiveSlot.Value,new SettlementRecord{identity=RunIdentity,reason="dead",status="complete",run=CaptureRunSave(),death=result});Bus.Emit(new RunEnded{Reason="dead"});
            },out _))return null;Audio.PlaySfx("defeat");Audio.PlayBgm("title");return result;
        }
        public AbandonResult AbandonRun()
        {
            var prior=ActiveSettlement();if(prior!=null)return prior.reason=="abandon"?prior.abandon:null;
            if(!State.runActive||ActiveSlot==null)return null;AbandonResult result=null;
            if(!TryPersistMutation(()=>{
                SyncPlayTime();ClearBattleCheckpoint();var g=State;var kept=CardContainerCommands.RescueCards(this,false);int count=kept.Sum(s=>s.count);
                Base.DepositCards(kept);if(count>0)Meta.Track("stash",new MetaProgress.TrackData{count=count});
                result=new AbandonResult{BroughtN=g.ownedCards.Count(o=>o.brought==1),KeptN=count,Coins=g.coins,KeptStacks=kept};g.Phase="done";g.runActive=false;Saves.RemoveRun(ActiveSlot.Value);
                Saves.PutSettlement(ActiveSlot.Value,new SettlementRecord{identity=RunIdentity,reason="abandon",status="complete",run=CaptureRunSave(),abandon=result});Bus.Emit(new RunEnded{Reason="abandon"});
            },out _))return null;Audio.PlaySfx("defeat");Audio.PlayBgm("title");return result;
        }
    }
}
