using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        List<StashStack> _extractLeft;
        public string SettlementError {get;private set;}
        public string CurrentExtractionIdentity=>ActiveSettlement()?.identity;
        public SettlementReceipt CurrentSettlementReceipt=>ActiveSettlement()?.receipt;
        public ExtractResult CurrentExtraction=>ActiveSettlement()?.reason=="extract"?BuildExtractResult(ActiveSettlement().status=="complete"):null;
        public DeathResult CurrentDeath=>ActiveSettlement()?.death;
        static List<StashStack> CopyStacks(IEnumerable<StashStack> entries)=>(entries??Enumerable.Empty<StashStack>()).Select(s=>CurrentSettlementLogic.Copy(s)).ToList();
        bool SettlementMutation(Action action)
        {bool ok=TryPersistMutation(action,out var error);SettlementError=ok?null:error;return ok;}
        RunGrowthReceipt GrowthBefore(string source,int award)
        {
            if(string.IsNullOrEmpty(State.myClass))return null;
            var ch=CharacterTable.CharacterFor(State.myClass);return new RunGrowthReceipt{source=source,characterId=ch?.id,characterName=ch?.name??State.myClass,awardedXp=award,before=new ClassProgress{lv=Meta.ClassLv(State.myClass),xp=Meta.ClassXP(State.myClass)}};
        }
        void GrowthAfter(RunGrowthReceipt growth)
        {
            if(growth==null)return;growth.after=new ClassProgress{lv=Meta.ClassLv(State.myClass),xp=Meta.ClassXP(State.myClass)};
            int actual=growth.after.xp-growth.before.xp,remaining=-growth.before.xp;
            for(int lv=growth.before.lv;lv<growth.after.lv;lv++)actual+=MetaProgress.XpForNext(lv);
            for(int lv=growth.before.lv;lv<MetaProgress.LevelMax;lv++)remaining+=MetaProgress.XpForNext(lv);
            growth.actualXp=Math.Min(growth.awardedXp,Math.Min(Math.Max(0,actual),Math.Max(0,remaining)));growth.overflowXp=Math.Max(0,growth.awardedXp-growth.actualXp);
            growth.levelsGained=Math.Max(0,growth.after.lv-growth.before.lv);growth.maxed=growth.after.lv>=MetaProgress.LevelMax;growth.nextLevelXp=growth.maxed?(int?)null:MetaProgress.XpForNext(growth.after.lv);growth.xpToNext=growth.maxed?0:Math.Max(0,growth.nextLevelXp.Value-growth.after.xp);
        }
        public ExtractResult DoExtract()
        {
            var prior=ActiveSettlement();if(prior?.reason=="extract"){_extractLeft=prior.left??new List<StashStack>();return BuildExtractResult(prior.status=="complete");}
            if(!State.runActive||ActiveSlot==null)return null;ExtractResult result=null;
            if(!SettlementMutation(()=>{
                SyncPlayTime();ClearBattleCheckpoint();var g=State;var record=new SettlementRecord{identity=RunIdentity,reason="extract",status="sorting",sourceIdentityVersion=1};
                foreach(var stack in g.usedPocket){int count=Math.Max(1,stack.count);record.totalPocketCount+=count;for(int i=0;i<count;i++){
                    if(Rng.Random("pocket")<1.0/3)record.keptPocket.Add(new StashStack{card=stack.card,count=1,variantKey=stack.card.variantKey});else record.lostPocketCount++;}}
                record.keptPocket=CurrentSettlementLogic.Stack(record.keptPocket);var kept=record.keptPocket.Where(s=>!BaseData.IsSha(s.card)&&s.card.rarity!="职业").ToList();Base.DepositCards(kept,true);
                Base.Deposit(g.inventory.Select(x=>new InventorySlot{name=x.name,value=x.value,tier=x.tier,count=x.count}));
                int first=g.explored?.Count??Math.Max(0,g.turn-1);record.growth=GrowthBefore("extraction",CurrentSettlementLogic.ExtractionXp(first,ModeCfg.xpMul));
                Meta.Track("extract",new MetaProgress.TrackData{coins=g.coins,actions=first,cls=g.myClass});GrowthAfter(record.growth);
                _extractLeft=CurrentSettlementLogic.Stack(g.ownedCards.Where(o=>o.card!=null&&!BaseData.IsSha(o.card)).Select(o=>new StashStack{card=o.card,count=1,variantKey=o.card.variantKey}));
                record.left=CopyStacks(_extractLeft);g.Phase="settlement";g.runActive=false;g.battleActive=false;Saves.RemoveRun(ActiveSlot.Value);record.run=CaptureRunSave();
                record.extraction=result=BuildExtractResult(record,false);Saves.PutSettlement(ActiveSlot.Value,record);Bus.Emit(new ExtractStashChanged{Result=result});
            }))return null;Audio.PlaySfx("victory");Audio.PlayBgm("title");return result;
        }
        ExtractResult BuildExtractResult(bool done)=>BuildExtractResult(ActiveSettlement(),done);
        ExtractResult BuildExtractResult(SettlementRecord record,bool done)
        {
            var g=State;int seconds=(int)Math.Floor(g.elapsed);var left=record?.left??_extractLeft??new List<StashStack>();var receipt=record?.receipt??BuildExtractionReceipt(record,left);
            var kept=(record?.keptPocket??new List<StashStack>()).Where(s=>!BaseData.IsSha(s.card)&&s.card.rarity!="职业").ToList();
            return new ExtractResult{WoodN=g.inventory.Where(i=>i.name=="木材").Sum(i=>i.count),RatN=g.inventory.Where(i=>i.name=="口粮").Sum(i=>i.count),ShaN=g.ownedCards.Count(o=>BaseData.IsSha(o.card)),OtherN=g.inventory.Where(i=>i.name!="木材"&&i.name!="口粮").Sum(i=>i.count),TotalValue=g.inventory.Sum(i=>(long)i.value*Math.Max(1,i.count)),TimeStr=(seconds/60).ToString("D2")+":"+(seconds%60).ToString("D2"),Actions=Math.Max(0,g.turn-1),Hp=g.hp,MaxHp=g.maxHp,Coins=g.coins,StashUsed=Base.StashUsed,StashCap=Base.StashCap,StashRoom=Base.StashRoom,CollectionCount=Base.collection.Count,Left=CopyStacks(left),Done=done,SavedCards=CopyStacks(receipt.savedCards),KeptPocket=CopyStacks(kept),PocketKept=receipt.netTake.pocketKept,PocketLost=receipt.losses.pocketLost,PocketRuleLost=receipt.losses.pocketRuleLost,Receipt=receipt,Growth=record?.growth};
        }
        SettlementReceipt BuildExtractionReceipt(SettlementRecord record,IEnumerable<StashStack> left)
        {
            var remaining=left.ToList();var saved=CurrentSettlementLogic.SavedCards(State,remaining,record?.sourceIdentityVersion==1);
            var receipt=CommonReceipt(State.bossDefeated?"clear":"extract",saved);int total=record?.totalPocketCount??0,randomLost=record?.lostPocketCount??0;
            int rolled=(record?.keptPocket??new List<StashStack>()).Sum(s=>s.count),kept=(record?.keptPocket??new List<StashStack>()).Where(s=>!BaseData.IsSha(s.card)&&s.card.rarity!="职业").Sum(s=>s.count);
            receipt.netTake.pocketKept=kept;receipt.netTake.wood=State.inventory.Where(i=>i.name=="木材").Sum(i=>i.count);receipt.netTake.rations=State.inventory.Where(i=>i.name=="口粮").Sum(i=>i.count);
            receipt.losses.lostCount=remaining.Sum(s=>s.count);receipt.losses.pocketRuleLost=rolled-kept;receipt.losses.pocketLost=randomLost+rolled-kept;
            receipt.losses.lostNotable=remaining.Where(s=>s.card.rarity=="传说"||s.card.rarity=="史诗").Take(6).Select(s=>new SettlementNotableLoss{name=s.card.name,rarity=s.card.rarity,count=s.count}).ToList();
            receipt.growth=record?.growth;receipt.firstExplore.xp=CurrentSettlementLogic.ExtractionXp(receipt.firstExplore.moves,ModeCfg.xpMul);return receipt;
        }
        SettlementReceipt CommonReceipt(string outcome,List<StashStack> saved)
        {
            return new SettlementReceipt{outcome=outcome,bossKilled=State.bossDefeated,layersReached=State.layerIdx+1,actions=Math.Max(0,State.turn-1),runCoins=State.coins,durationSec=Math.Max(0,(int)Math.Floor(State.elapsed)),firstExplore=new SettlementFirstExplore{moves=State.explored?.Count??Math.Max(0,State.turn-1),xp=0},netTake=new SettlementNetTake{cardsStashed=saved.Sum(s=>s.count)},savedCards=CopyStacks(saved),memento=CurrentSettlementLogic.Memento(State,Map,saved)};
        }
        void SaveExtractionProgress(SettlementRecord record,bool done)
        {
            record.status=done?"complete":"sorting";record.requestSeq++;record.left=CopyStacks(_extractLeft);
            if(done)record.receipt=BuildExtractionReceipt(record,_extractLeft);
            record.extraction=BuildExtractResult(record,done);Saves.PutSettlement(ActiveSlot.Value,record);
        }
        public ExtractResult ExtractStore(IEnumerable<ExtractionSelection> input,string expectedIdentity=null,int? expectedSlot=null)
        {
            var record=ActiveSettlement();if(!IsPendingExtraction(record))return record?.extraction;
            if(expectedIdentity!=null&&record.identity!=expectedIdentity||expectedSlot.HasValue&&ActiveSlot!=expectedSlot){SettlementError="当前整理页已过期，请重新载入撤离整理";return null;}
            var selections=input?.Select(s=>new ExtractionSelection{name=s.name,sourceKey=s.sourceKey,count=s.count}).ToList();
            if(selections==null||selections.Any(s=>string.IsNullOrWhiteSpace(s.name)||s.count<=0||s.sourceKey=="")){SettlementError="入库选择须包含卡牌名称和正整数数量";return null;}
            _extractLeft=CopyStacks(record.left);
            if(!SettlementMutation(()=>{
                int total=0;foreach(var selection in selections){var matches=_extractLeft.Where(s=>s.card.name==selection.name).ToList();
                    if(record.sourceIdentityVersion==1&&selection.sourceKey==null&&matches.Count>1)throw new InvalidOperationException("同名卡牌存在不同来源，请按当前卡牌重新选择");
                    var stack=selection.sourceKey==null?matches.FirstOrDefault():matches.FirstOrDefault(s=>CurrentSettlementLogic.SourceKey(s)==selection.sourceKey);
                    if(stack==null)continue;int take=Math.Min(stack.count,Math.Min(selection.count,Base.StashRoom));if(take<=0)continue;
                    Base.DepositCards(new[]{CurrentSettlementLogic.Copy(stack,take)});stack.count-=take;total+=take;if(stack.count<=0)_extractLeft.Remove(stack);
                }
                if(total>0)Meta.Track("stash",new MetaProgress.TrackData{count=total});SaveExtractionProgress(record,false);Bus.Emit(new ExtractStashChanged{Result=record.extraction});
            }))return null;return record.extraction;
        }
        public ExtractResult ExtractStashOne(int index)
        {var record=ActiveSettlement();if(!IsPendingExtraction(record)||index<0||index>=record.left.Count)return record?.extraction;var stack=record.left[index];return ExtractStore(new[]{new ExtractionSelection{name=stack.card.name,sourceKey=record.sourceIdentityVersion==1?CurrentSettlementLogic.SourceKey(stack):null,count=stack.count}});}
        public ExtractResult ExtractStashAll()=>ExtractStashOrdered("all");
        public ExtractResult ExtractStashOrdered(string order)
        {var record=ActiveSettlement();if(!IsPendingExtraction(record))return record?.extraction;return ExtractStore(CurrentSettlementLogic.SelectOrdered(record.left,Base.StashRoom,order));}
        public ExtractResult FinishExtract(bool confirmLoss=false)
        {
            var record=ActiveSettlement();if(!IsPendingExtraction(record))return record?.extraction;_extractLeft=CopyStacks(record.left);
            if(_extractLeft.Sum(s=>s.count)>0&&!confirmLoss){SettlementError="仍有未入库卡牌，请先确认放弃后再完成整理";return null;}
            if(!SettlementMutation(()=>{State.Phase="done";SaveExtractionProgress(record,true);Bus.Emit(new ExtractStashChanged{Result=record.extraction});Bus.Emit(new RunEnded{Reason="win"});}))return null;return record.extraction;
        }
        List<StashStack> RescueTerminal(IEnumerable<OwnedCard> source,bool includeBrought)
        {var cards=source.ToList();bool boxSafe=cards.Any(o=>o.safe==true&&o.card?.id==CardContainerCommands.PearlId);return cards.Where(o=>o.card!=null&&(includeBrought||o.brought!=1)&&(o.safe==true||o.stored&&string.IsNullOrEmpty(o.pouchOf)&&boxSafe)).Select(o=>new StashStack{card=o.card.Clone(),count=1,variantKey=o.card.variantKey}).ToList();}
        SettlementReceipt FailureReceipt(string outcome,List<StashStack> saved,IEnumerable<OwnedCard> owned)
        {
            var receipt=CommonReceipt(outcome,saved);var rescued=saved.GroupBy(CurrentSettlementLogic.SourceKey).ToDictionary(g=>g.Key,g=>g.Sum(s=>s.count));var lost=new List<OwnedCard>();
            foreach(var card in owned){string key=CurrentSettlementLogic.SourceKey(new StashStack{card=card.card,count=1});if(rescued.TryGetValue(key,out int kept)&&kept>0)rescued[key]--;else lost.Add(card);}
            receipt.losses.lostCount=lost.Count;receipt.losses.pocketLost=State.usedPocket.Sum(p=>Math.Max(1,p.count));receipt.losses.lostNotable=lost.Where(o=>o.card.rarity=="传说"||o.card.rarity=="史诗").Take(6).Select(o=>new SettlementNotableLoss{name=o.card.name,rarity=o.card.rarity,count=1}).ToList();return receipt;
        }
        public DeathResult DoDeath(SettlementBattleReview review=null,string reason=null)
        {
            var prior=ActiveSettlement();if(prior!=null)return prior.reason=="dead"?prior.death:null;if(!State.runActive||ActiveSlot==null)return null;DeathResult result=null;
            if(!SettlementMutation(()=>{
                SyncPlayTime();var g=State;var kept=RescueTerminal(g.ownedCards,true);int count=kept.Sum(s=>s.count);var receipt=FailureReceipt("death",kept,g.ownedCards);var growth=GrowthBefore("death",5);
                receipt.battleReview=review==null?null:SaveJson.Read<SettlementBattleReview>(SaveJson.Stringify(review));receipt.endReason=reason??(review!=null?"战斗中生命归零":"生命归零；未提供具体受伤来源");
                Base.DepositCards(kept);if(count>0)Meta.Track("stash",new MetaProgress.TrackData{count=count});Meta.Track("death",new MetaProgress.TrackData{cls=g.myClass});GrowthAfter(growth);
                result=new DeathResult{LostValue=g.inventory.Sum(i=>(long)i.value*i.count),SavedStacks=CopyStacks(kept),SavedN=count,Receipt=receipt,Growth=growth};
                ClearBattleCheckpoint();g.Phase="done";g.runActive=false;g.battleActive=false;Saves.RemoveRun(ActiveSlot.Value);Saves.PutSettlement(ActiveSlot.Value,new SettlementRecord{identity=RunIdentity,reason="dead",status="complete",run=CaptureRunSave(),death=result,receipt=receipt,growth=growth});Bus.Emit(new RunEnded{Reason="dead"});
            }))return null;Audio.PlaySfx("defeat");Audio.PlayBgm("title");return result;
        }
        public AbandonResult AbandonRun(IReadOnlyCollection<string> spentUids=null)
        {
            var prior=ActiveSettlement();if(prior!=null)return prior.reason=="abandon"?prior.abandon:null;if(!State.runActive||ActiveSlot==null)return null;
            if(State.battleActive&&spentUids==null){SettlementError="战斗卡牌清单暂不可用，本次尚未结算，请重试确认放弃。";return null;}AbandonResult result=null;
            if(!SettlementMutation(()=>{
                SyncPlayTime();var g=State;var remaining=g.ownedCards.Where(o=>spentUids==null||!spentUids.Contains(o.uid)).ToList();var kept=RescueTerminal(remaining,false);int count=kept.Sum(s=>s.count);var receipt=FailureReceipt("abandon",kept,remaining);
                Base.DepositCards(kept);if(count>0)Meta.Track("stash",new MetaProgress.TrackData{count=count});
                result=new AbandonResult{BroughtN=remaining.Count(o=>o.brought==1),KeptN=count,Coins=g.coins,KeptStacks=CurrentSettlementLogic.Stack(kept),Receipt=receipt};
                ClearBattleCheckpoint();g.Phase="done";g.runActive=false;g.battleActive=false;Saves.RemoveRun(ActiveSlot.Value);Saves.PutSettlement(ActiveSlot.Value,new SettlementRecord{identity=RunIdentity,reason="abandon",status="complete",run=CaptureRunSave(),abandon=result,receipt=receipt});Bus.Emit(new RunEnded{Reason="abandon"});
            }))return null;Audio.PlaySfx("defeat");Audio.PlayBgm("title");return result;
        }
    }
}
