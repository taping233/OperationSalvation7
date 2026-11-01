// Supplements RunReceipts/RunJourney: real disk reads plus same-process title/LoadRun recovery.
// Controlled sources prove persistence and continuation, not a new process or physical input.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;

public static class CurrentRunRound4Checks
{
    public static int Assertions { get; private set; }
    public static string Step { get; private set; }
    const int Slot=5;
    static void Require(bool value,string message){Assertions++;if(!value)throw new InvalidOperationException("Run round4: "+message);}
    static void Clear(){CurrentRunFilm.CancelActive();Sdt.UI.Screens.Menu.SuggestionBox.CloseIfOpen();while(UiStack.Count>0)UiStack.Pop();}
    static GameRuntime Fixture()
    {
        Clear();var game=GameRuntime.I;game.ResetSlot(Slot);game.NewRun(Slot,"wu");
        Require(game.Saves.LastWriteSucceeded,"formal new run persisted");
        Require(game.EntrySupplyComplete||game.ClaimAllEntrySupply(out _),"formal entry supply completed");Clear();
        game.State.inventory.Clear();game.State.usedPocket.Clear();game.State.ownedCards.Clear();game.Base.stash.Clear();game.State.Phase="idle";
        game.SaveCurrent();return game;
    }
    static string LeftKey(IEnumerable<StashStack> stacks)=>SaveJson.Stringify(stacks.Select(stack=>new{key=CurrentSettlementLogic.SourceKey(stack),stack.count,stack.card.name,stack.card.cost}).OrderBy(stack=>stack.key).ToArray());
    public static IEnumerator Run()
    {
        Assertions=0;Require(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
        try
        {
            Step="frozen resource candidates persisted before interruption";var game=Fixture();
            var resource=game.Map.Snapshot.layers.SelectMany(layer=>layer.nodes).First(node=>node.type=="resource");
            game.State.layerIdx=resource.li;game.State.trackPos=resource.idx;game.State.explored.Add(game.CurrentNodeId);
            var opened=game.ResolveCell();yield return new WaitForSecondsRealtime(.9f);
            Require(opened?.Kind==NodeKind.Resource&&game.GetResourceRewardCards().Count>0,"formal resource resolver prepared live candidates");
            string node=game.CurrentNodeId,rng=game.Rng.SaveState();int? seed=game.State.seed;
            var ids=game.CurrentNodeReceipt.rewardCardIds.ToArray();var beforeOwned=game.State.ownedCards.Select(card=>card.uid).ToArray();
            game.SaveCurrent();var disk=new SaveSystem().ReadSlot(Slot);
            Require(game.Saves.LastWriteSucceeded&&disk!=null&&disk.nodeRewards[node].rewardTaken==null&&disk.nodeRewards[node].rewardCardIds.SequenceEqual(ids),"independent file read contains frozen pending candidates");
            Require(disk.rngState?.Type==JTokenType.String&&disk.rngState.Value<string>()==rng,"independent file read contains matching RNG state");
            Clear();game.ShowTitle();game.State.nodeRewards.Clear();game.State.ownedCards.Clear();game.State.seed++;game.Rng.Random("loot","reward");
            Require(game.LoadRun(Slot),"formal LoadRun resumes pending source after title");yield return new WaitForSecondsRealtime(.9f);
            Require(game.State.seed==seed&&game.CurrentNodeId==node&&game.CurrentNodeReceipt.rewardTaken==null&&game.GetResourceRewardCards().Select(card=>card.id).SequenceEqual(ids),"load restores source and frozen candidates rather than altered live memory");
            Require(game.Rng.SaveState()==rng&&game.State.ownedCards.Select(card=>card.uid).SequenceEqual(beforeOwned),"load restores RNG and exact owned UIDs without granting");
            Require(game.ClaimResourceReward(0,out _),"resumed pending candidate can be claimed");
            var granted=game.State.ownedCards.Single(card=>!beforeOwned.Contains(card.uid));string uid=granted.uid;
            Require(granted.card.id==ids[0]&&game.CurrentNodeReceipt.rewardTaken==0&&game.State.ownedCards.Count==beforeOwned.Length+1,"resumed claim grants precisely selected card once");
            string claimedRng=game.Rng.SaveState(),claimedOwned=SaveJson.Stringify(game.State.ownedCards);
            Require(!game.ClaimResourceReward(0,out _),"repeated completed resource claim is rejected");
            Require(game.Rng.SaveState()==claimedRng&&SaveJson.Stringify(game.State.ownedCards)==claimedOwned&&game.CurrentNodeReceipt.rewardTaken==0&&game.CurrentNodeReceipt.rewardCardIds.SequenceEqual(ids),"rejected callback preserves full RNG, exact owned cards and frozen receipt");
            disk=new SaveSystem().ReadSlot(Slot);
            Require(disk!=null&&disk.nodeRewards[node].rewardTaken==0&&disk.ownedCards.Count(card=>card.uid==uid)==1&&SaveJson.Stringify(disk.ownedCards)==claimedOwned&&disk.rngState?.Type==JTokenType.String&&disk.rngState.Value<string>()==claimedRng,"independent file read records one completed claim and its post-grant RNG");

            Step="partial extraction stored with distinct same-name sources";game=Fixture();
            var first=CardLibrary.FindById("tt3-fireball").Clone();first.variantKey="round4-left-a";first.name="同名撤离恢复牌";
            var second=first.Clone();second.variantKey="round4-left-b";second.cost=first.cost+1;
            game.State.ownedCards=new List<OwnedCard>{new OwnedCard{uid="round4-owned-a",card=first},new OwnedCard{uid="round4-owned-b",card=second}};
            game.SaveCurrent();Require(game.Saves.LastWriteSucceeded,"controlled distinct-source run persisted");
            var extraction=game.DoExtract();yield return null;
            Require(extraction!=null&&extraction.Left.Sum(stack=>stack.count)==2&&extraction.Left.Count==2&&UiStack.Top is ExtractStashScreen,"formal extraction presents two distinct same-name remaining stacks");
            string identity=game.CurrentExtractionIdentity;var selected=extraction.Left.Single(stack=>stack.card.variantKey==first.variantKey);
            extraction=game.ExtractStore(new[]{new ExtractionSelection{name=selected.card.name,sourceKey=CurrentSettlementLogic.SourceKey(selected),count=1}},identity,Slot);
            Require(extraction!=null&&extraction.Left.Count==1&&extraction.Left[0].card.variantKey==second.variantKey&&game.Base.stash.Sum(stack=>stack.count)==1,"partial store consumes only selected variant source");
            string left=LeftKey(extraction.Left),stash=SaveJson.Stringify(game.Base.stash),growth=SaveJson.Stringify(game.Base.characters);rng=game.Rng.SaveState();var saved=new SaveSystem();var sorting=saved.GetSettlement(Slot);
            Require(sorting?.status=="sorting"&&sorting.identity==identity&&LeftKey(sorting.left)==left&&saved.HasRun(Slot)&&saved.ReadSlot(Slot)!=null,"independent file read exposes resumable sorting receipt and remainder");
            Clear();game.ShowTitle();game.Base.stash.Clear();game.State.ownedCards.Clear();game.Rng.Random("pocket");
            Require(game.LoadRun(Slot),"formal LoadRun resumes extraction sorting from title");yield return new WaitForSecondsRealtime(.9f);
            Require(!game.State.runActive&&game.State.Phase=="settlement"&&game.CurrentExtractionIdentity==identity&&UiStack.Top is ExtractStashScreen,"resumed sorting reopens actual current extraction page");
            Require(LeftKey(game.CurrentExtraction.Left)==left&&SaveJson.Stringify(game.Base.stash)==stash&&SaveJson.Stringify(game.Base.characters)==growth&&game.Rng.SaveState()==rng,"sorting recovery retains remainder, deposited variant and RNG without repeating growth/loot");
            var stale=game.ExtractStore(new[]{new ExtractionSelection{name=second.name,sourceKey=CurrentSettlementLogic.SourceKey(game.CurrentExtraction.Left[0]),count=1}},identity+"-old",Slot);
            Require(stale==null&&LeftKey(game.CurrentExtraction.Left)==left&&SaveJson.Stringify(game.Base.stash)==stash&&game.Rng.SaveState()==rng,"old extraction identity cannot move recovered remainder or consume RNG");
            extraction=game.ExtractStashAll();Require(extraction!=null&&extraction.Left.Count==0&&game.Base.stash.Sum(stack=>stack.count)==2,"recovered remainder stores once");
            Require(game.Base.stash.Count(stack=>stack.card.variantKey==first.variantKey)==1&&game.Base.stash.Count(stack=>stack.card.variantKey==second.variantKey)==1,"both same-name variant sources survive partial store and recovery");
            Require(game.FinishExtract()?.Done==true&&new SaveSystem().GetSettlement(Slot)?.status=="complete"&&game.Rng.SaveState()==rng,"recovered sorting completes persistently without additional random rolls");
            stash=SaveJson.Stringify(game.Base.stash);string stats=SaveJson.Stringify(game.Base.stats),finishedGrowth=SaveJson.Stringify(game.Base.characters),finishedRng=game.Rng.SaveState();
            var storedAgain=game.ExtractStashAll();var finishedAgain=game.FinishExtract(true);var extractedAgain=game.DoExtract();saved=new SaveSystem();
            Require(storedAgain?.Done==true&&finishedAgain?.Done==true&&extractedAgain?.Done==true&&SaveJson.Stringify(game.Base.stash)==stash&&SaveJson.Stringify(game.Base.stats)==stats&&SaveJson.Stringify(game.Base.characters)==finishedGrowth&&game.Rng.SaveState()==finishedRng,"completed receipt replay returns done without adding cards, growth or randomness");
            Require(saved.GetSettlement(Slot)?.identity==identity&&!saved.HasRun(Slot)&&saved.ReadSlot(Slot)==null,"completed extraction retains identity without resurrecting a run");
            Step="complete";
        }
        finally{Clear();}
    }
}
