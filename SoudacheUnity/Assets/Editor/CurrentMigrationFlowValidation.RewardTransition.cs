using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static partial class CurrentMigrationFlowValidation
    {
        const string RewardReplayNode="3,9";
        static RunSaveData _rewardReplayOriginal;
        static HashSet<string> _rewardReplayBeforeUids;
        static string _rewardReplaySourceSha;
        static int _rewardReplayCoins;
        static bool _rewardReplayRenderNeeded;
        static string RewardReplaySource=>Path.GetFullPath(Path.Combine(Application.dataPath,"..","..","搜打撤","docs","evidence","2026-10-29-unity-desktop","current-journey-1","profile-journey-20261029235058182","profile.json"));
        static string RewardFileSha(string file)
        {using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(file))).Replace("-","").ToLowerInvariant();}
        static RunSaveData ReadRewardReplaySource()
        {
            var profile=JObject.Parse(File.ReadAllText(RewardReplaySource));
            Require((string)profile["format"]=="sdt-unity-profile","reward replay source is not this native test profile");
            var run=SaveJson.Read<RunSaveData>(profile["runs"]?["5"]?.ToString());
            Require(run!=null&&run.seed==169015024&&run.layerIdx==3&&run.trackPos==9&&run.battleRestartCheckpoint==null,"reward replay source identity changed");
            var receipt=run.nodeRewards[RewardReplayNode];
            Require(receipt.battleWon&&!receipt.completed&&receipt.chestQueue.Count==2&&receipt.chestQueue[0].kind=="large"&&receipt.chestQueue[1].kind=="medium","reward replay source transition changed");
            Require(receipt.chestQueue[0].claimMode=="all"&&receipt.chestQueue[1].claimMode=="one"&&receipt.chestQueue.All(box=>box.cardIds.Count==3),"reward replay source card/choice shape changed");
            return run;
        }
        static void PrepareRewardTransitionProfile()
        {
            ReadRewardReplaySource();
            string outputRoot=Path.GetFullPath(Output).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
            Require(Path.GetFullPath(SaveSystem.Dir).StartsWith(outputRoot,StringComparison.OrdinalIgnoreCase),"reward replay copy escaped isolated output");
            Directory.CreateDirectory(SaveSystem.Dir);Require(!File.Exists(SaveSystem.ProfilePath),"reward replay destination already exists");
            string sourceSha=RewardFileSha(RewardReplaySource);File.Copy(RewardReplaySource,SaveSystem.ProfilePath,false);
            Require(RewardFileSha(SaveSystem.ProfilePath)==sourceSha,"reward replay source copy mismatch");
            File.WriteAllText(Path.Combine(Output,"reward-transition-source.json"),JsonConvert.SerializeObject(new {source=RewardReplaySource,sourceSha256=sourceSha,copiedTo=SaveSystem.ProfilePath,originalEvidenceReadOnly=true},Formatting.Indented));
        }
        static void ResetRewardReplayReceipt()
        {
            var g=GameRuntime.I;var source=_rewardReplayOriginal.nodeRewards[RewardReplayNode];
            var removed=new List<string>();
            foreach(int i in source.chestQueue[0].taken)
            {
                string id=source.chestQueue[0].cardIds[i];var matches=g.State.ownedCards.Where(card=>card.card.id==id&&!card.stored&&card.safe!=true&&card.brought!=1&&string.IsNullOrEmpty(card.pouchOf)).ToArray();
                Require(matches.Length==1,"cannot uniquely remove the prior native test grant: "+id);removed.Add(matches[0].uid);
            }
            int reversedCoins=source.chestQueue.Where(box=>box.coinsTaken).Sum(box=>box.coins);
            Require(g.State.coins>=reversedCoins,"reward replay source coins cannot be reset");
            Require(g.TryPersistMutation(()=>
            {
                g.State.ownedCards.RemoveAll(card=>removed.Contains(card.uid));g.State.cardOrder.RemoveAll(uid=>removed.Contains(uid));
                g.State.coins-=reversedCoins;var receipt=g.State.nodeRewards[RewardReplayNode];
                receipt.chestIndex=0;receipt.completed=false;
                foreach(var box in receipt.chestQueue){box.taken.Clear();box.lost.Clear();box.completed=false;box.coinsTaken=false;}
                g.State.Phase="idle";
            },out var error),"controlled reward receipt reset failed: "+error);
            _rewardReplayBeforeUids=g.State.ownedCards.Select(card=>card.uid).ToHashSet();_rewardReplayCoins=_rewardReplayOriginal.coins;
            Require(g.BagCap-g.UsedSlots()>=4,"replayed two boxes would exceed original native bag capacity");
            Record("controlled-exact-reward-receipt-reset",new {seed=g.State.seed,node=g.CurrentNodeId,removedOwnedUids=removed.ToArray(),reversedCoins,ownedAfterReset=g.State.ownedCards.Count,
                usedSlots=g.UsedSlots(),capacity=g.BagCap,boxCardIds=receiptCards(source),baseAcquisitionHistoryPreserved=true,balanceAssessed=false,
                note="Only the isolated copy is reset; the old large-box grants are removed by exact UID so replay does not duplicate inventory or coins."});
        }
        static object[] receiptCards(NodeVisitReceipt receipt)=>receipt.chestQueue.Select(box=>(object)new {box.kind,box.claimMode,box.choiceCount,box.cardIds,box.coins}).ToArray();
        static bool VerifyRewardReplayChoices(Button[] choices,string phase)
        {
            RewardInputProbe(phase,choices);
            var rows=choices.Select(button=>new {card=button.GetComponentInParent<CurrentRewardTile>().CardId,index=button.GetComponentInParent<CurrentRewardTile>().Index,
                center=RewardPointTrace(RewardPoint((RectTransform)button.transform)),inMasks=RewardCenterInMasks(button),receiverIsExactTarget=RewardHit(button)==button.gameObject}).ToArray();
            Record("exact-old-choice-object-raycasts",new {phase,rows});return rows.All(row=>row.inMasks&&row.receiverIsExactTarget);
        }
        static void RewardTransition()
        {
            var g=GameRuntime.I;
            switch(_step)
            {
                case 0:
                    _rewardReplayOriginal=ReadRewardReplaySource();_rewardReplaySourceSha=RewardFileSha(RewardReplaySource);
                    Clear();Require(g.LoadRun(5),"exact native test slot did not load");
                    Require(g.State.seed==_rewardReplayOriginal.seed&&g.CurrentNodeId==RewardReplayNode&&!g.State.battleActive,"loaded reward replay changed run identity");
                    Record("loaded-original-native-test-profile",new {seed=g.State.seed,node=g.CurrentNodeId,sourceSha256=_rewardReplaySourceSha,originalCardIds=receiptCards(_rewardReplayOriginal.nodeRewards[RewardReplayNode])});
                    Next();break;
                case 1:
                    Clear();ResetRewardReplayReceipt();Require(g.ResolveCell()!=null,"current production reward route did not resume");Next();break;
                case 2:
                    Expect<ChestOpenScreen>();Require(g.CurrentNodeReceipt.chestIndex==0,"large replay box missing");
                    Require(g.CurrentChestReceipt.cardIds.SequenceEqual(_rewardReplayOriginal.nodeRewards[RewardReplayNode].chestQueue[0].cardIds),"large replay card order changed");
                    // Do not capture/render between creating the large box and its real claim: retain the original transition timing.
                    ClickReward();Next();break;
                case 3:
                    Expect<ChestOpenScreen>();Require(g.CurrentNodeReceipt.chestIndex==1&&g.CurrentChestReceipt.claimMode=="one","large claim did not switch to original medium choice");
                    var choices=Buttons().Where(button=>button.name=="收下"&&button.GetComponentInParent<CurrentRewardTile>()!=null).OrderBy(button=>button.GetComponentInParent<CurrentRewardTile>().Index).ToArray();
                    Require(choices.Length==3&&choices.Select(button=>button.GetComponentInParent<CurrentRewardTile>().CardId).SequenceEqual(_rewardReplayOriginal.nodeRewards[RewardReplayNode].chestQueue[1].cardIds),"medium replay choice identities/order changed");
                    Canvas.ForceUpdateCanvases();Canvas.ForceUpdateCanvases();
                    var firstPoint=RewardPoint((RectTransform)choices[0].transform);
                    Require(Math.Abs(firstPoint.x-616)<1&&Math.Abs(firstPoint.y-292)<1,"original first choice screen position changed");
                    bool allReachable=VerifyRewardReplayChoices(choices,"exact-old-medium-before-native-render");
                    if(!allReachable)
                    {
                        _rewardReplayRenderNeeded=true;_camera.Render();Canvas.ForceUpdateCanvases();Canvas.ForceUpdateCanvases();
                        allReachable=VerifyRewardReplayChoices(choices,"exact-old-medium-after-native-render");
                    }
                    if(!allReachable)Shot("exact-old-medium-blocked");
                    Require(allReachable,"one of the original medium choices remains blocked inside the native viewport");
                    Record("exact-old-first-choice-command",new {card=choices[0].GetComponentInParent<CurrentRewardTile>().CardId,x=firstPoint.x,y=firstPoint.y,normalRenderRecoveryNeeded=_rewardReplayRenderNeeded});
                    Click(choices[0].gameObject);Next();break;
                case 4:
                    Expect<ChestOpenScreen>();var box=g.State.nodeRewards[RewardReplayNode].chestQueue[1];
                    Require(box.completed&&box.taken.SetEquals(new[]{0})&&box.lost.SetEquals(new[]{1,2}),"original choice did not keep one and forfeit two");
                    var saved=new SaveSystem().ReadSlot(5).nodeRewards[RewardReplayNode].chestQueue[1];
                    Require(saved.completed&&saved.taken.SetEquals(new[]{0})&&saved.lost.SetEquals(new[]{1,2}),"original medium choice receipt not persisted");
                    Shot("exact-old-medium-selected");Click("继续探索");Next();break;
                case 5:
                    var receipt=g.State.nodeRewards[RewardReplayNode];
                    Require(receipt.completed&&g.State.Phase=="idle"&&!(UiStack.Top is ChestOpenScreen),"original reward continuation did not finish through BattleBridge");
                    var expected=_rewardReplayOriginal.nodeRewards[RewardReplayNode].chestQueue[0].cardIds.Concat(new[]{_rewardReplayOriginal.nodeRewards[RewardReplayNode].chestQueue[1].cardIds[0]}).OrderBy(id=>id).ToArray();
                    var granted=g.State.ownedCards.Where(card=>!_rewardReplayBeforeUids.Contains(card.uid)).Select(card=>card.card.id).OrderBy(id=>id).ToArray();
                    Require(granted.SequenceEqual(expected)&&g.State.coins==_rewardReplayCoins,"reward replay duplicated inventory or coins");
                    var fresh=new SaveSystem().ReadSlot(5);
                    Require(fresh.seed==169015024&&fresh.nodeRewards[RewardReplayNode].completed&&fresh.coins==_rewardReplayCoins&&fresh.ownedCards.Count==_rewardReplayBeforeUids.Count+4,"original native reward completion was not persisted");
                    Require(RewardFileSha(RewardReplaySource)==_rewardReplaySourceSha,"original test evidence changed during replay");
                    Record("exact-old-reward-transition-complete",new {seed=fresh.seed,node=RewardReplayNode,originalEvidenceUnchanged=true,normalRenderRecoveryNeeded=_rewardReplayRenderNeeded,
                        allThreeChoicesHadExactTargetReceivers=true,granted,coins=g.State.coins,owned=fresh.ownedCards.Count});Shot("exact-old-reward-complete");Finish();break;
            }
        }
    }
}
