using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using Sdt.UI.Screens.Bag;
using Sdt.UI.Screens.Hub;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static partial class CurrentMigrationFlowValidation
    {
        static readonly HashSet<int> Layers = new HashSet<int>();
        static readonly HashSet<string> Captured = new HashSet<string>();
        static readonly HashSet<string> CompletedBattles = new HashSet<string>();
        static readonly Dictionary<string, bool?> JourneyBattleOutcomes = new Dictionary<string, bool?>();
        // Verified direct attacks in current builtin-card execution: ordinary, transformed, and martial-discount attack.
        static readonly HashSet<string> JourneyAttackIds = new HashSet<string> { "starter-attack", "cmtn233trmeg", "cc-chase-slash" };
        static int _battleSteps, _battles;
        static int _bossGateEntries, _layerGateEntries;
        static int _returnedBaseClearFrame=-1;
        static double _returnedBaseSince;
        static bool _returnedBaseFilmRecorded;
        static string _identity;
        static void Fixture(bool powerful)
        {
            var g = GameRuntime.I; Clear(); g.ResetSlot(5); g.NewRun(5, CharacterTable.All[0].id);
            for (int i = 0; i < g.GetEntrySupplyCards().Count; i++) Require(g.ClaimEntrySupply(i, out _), "fixture supply failed");
            Clear(); g.State.Phase = "idle";
            if (powerful) { g.State.maxHp = g.State.hp = 10000; g.State.atk = 2000; }
            g.SaveCurrent(); Require(g.Saves.LastWriteSucceeded, "fixture save failed");
            Record("controlled-fixture", new { powerful, hp = g.State.hp, atk = g.State.atk, source = "current NewRun and entry supply commands; balance not assessed" });
        }
        static void Journey()
        {
            var g = GameRuntime.I;
            switch (_step)
            {
                case 0: Fixture(true); Next(); break;
                case 1: Traverse(); break;
                case 2:
                    Require(Layers.Count == 4 && _battles > 0 && g.State.altarActivated && g.State.bossDefeated, "actual four layer/altar/boss prerequisites not traversed");
                    Require(_bossGateEntries == 1 && _layerGateEntries == 3, "journey bypassed the current boss/layer confirmation UI");
                    Require(!g.State.runActive && g.State.Phase == "settlement", "final extraction did not enter sorting");
                    Expect<ExtractStashScreen>(); _identity = g.CurrentExtractionIdentity; if (!ShotReady("extraction")) return; Click("exRarity"); Next(); break;
                case 3:
                    Require(new SaveSystem().GetSettlement(5)?.identity == _identity, "extraction identity not persisted");
                    Click("exFinish"); Next(); break;
                case 4:
                    if (UiStack.Top is ExtractStashScreen) { Click("exConfirmFinish"); break; }
                    Expect<ExtractDoneScreen>();
                    if (!ShotReady("settlement")) return;
                    Require(new SaveSystem().GetSettlement(5)?.status == "complete", "finish not persisted");
                    var stats = SaveJson.Stringify(g.Base.stats); var stash = SaveJson.Stringify(g.Base.stash);
                    Require(g.FinishExtract(true) != null && g.DoExtract() != null, "completed extraction receipt inaccessible");
                    Require(SaveJson.Stringify(g.Base.stats) == stats && SaveJson.Stringify(g.Base.stash) == stash, "duplicate extraction granted stats/cards");
                    Click("goBase");
                    _returnedBaseSince=UnityEditor.EditorApplication.timeSinceStartup;_returnedBaseClearFrame=-1;_returnedBaseFilmRecorded=false;Next();break;
                case 5:
                    Expect<HubScreen>();
                    Require(UnityEditor.EditorApplication.timeSinceStartup-_returnedBaseSince<15,"returned base did not finish its camp film and native layout");
                    // camp is deliberately nonblocking. Active alone does not mean its visible cover has finished.
                    if(CurrentRunFilm.Active||CurrentRunFilm.Visible)
                    {
                        _returnedBaseClearFrame=-1;
                        if(!_returnedBaseFilmRecorded)
                        {Record("wait-returned-base-film",new{kind=CurrentRunFilm.Current?.Kind,active=CurrentRunFilm.Active,visible=CurrentRunFilm.Visible,frame=UnityEngine.Time.frameCount});_returnedBaseFilmRecorded=true;}
                        return;
                    }
                    if(_returnedBaseClearFrame<0)
                    {_returnedBaseClearFrame=UnityEngine.Time.frameCount;Record("returned-base-cover-finished",new{frame=_returnedBaseClearFrame});return;}
                    if(UnityEngine.Time.frameCount<_returnedBaseClearFrame+2)return;
                    Next();break;
                case 6:
                    Expect<HubScreen>();
                    Require(!CurrentRunFilm.Active&&!CurrentRunFilm.Visible,"returned base capture still has a film cover");
                    Require(UnityEngine.Time.frameCount>=_returnedBaseClearFrame+2,"returned base capture precedes native layout frames");
                    Require(g.ActiveSlot==5,"returned base changed the active slot");
                    Require(!g.State.runActive && !new SaveSystem().HasRun(5), "completed run resurrected at base");
                    var finalReceipt=new SaveSystem().GetSettlement(5);
                    Require(finalReceipt?.status=="complete"&&finalReceipt.identity==_identity,"returned base lost the completed terminal receipt");
                    Record("returned-base-ready",new{g.ActiveSlot,g.State.runActive,frame=UnityEngine.Time.frameCount,clearFrame=_returnedBaseClearFrame,finalReceipt.identity,finalReceipt.status});
                    Shot("returned-base"); Finish();break;
            }
        }
        static void Traverse()
        {
            var g = GameRuntime.I; Layers.Add(g.State.layerIdx);
            if (UiStack.Top != null)
            {
                string page = UiStack.Top.GetType().Name + "-" + g.State.layerIdx;
                if (!Captured.Contains(page)) { if (!ShotReady("page-" + page)) return; Captured.Add(page); }
            }
            if (!g.State.runActive || UiStack.Top is DeathScreen)
            {
                Record("journey-unexpected-terminal", new { g.State.runActive, g.State.hp, g.State.Phase, node = g.CurrentNodeId, stack = UiStack.Names(), reason = g.Saves.GetSettlement(5)?.reason });
                Require(false, "journey ended before extraction; phase=" + g.State.Phase + " hp=" + g.State.hp);
            }
            if (g.State.battleActive) { Fight(); return; }
            _battleSteps = 0;
            var receipt = g.CurrentNodeReceipt;
            if (UiStack.Top is CurrentBossGateScreen)
            {
                Require(!g.State.bossDefeated && !receipt.battleWon, "completed boss gate reopened");
                Record("current-boss-gate-pointer-entry", new { node = g.CurrentNodeId, drawBeforeConfirmation = receipt.bossId });
                Click("bossGateFight"); _bossGateEntries++; return;
            }
            if (UiStack.Top is DoorModal)
            {
                int from = g.State.layerIdx;
                Record("current-layer-gate-pointer-entry", new { node = g.CurrentNodeId, from });
                Click("goDoor");
                Require(g.State.layerIdx == from + 1, "current layer gate did not move exactly one layer");
                _layerGateEntries++; return;
            }
            if (receipt.chestQueue != null && receipt.chestQueue.Any(c => !c.completed))
            {
                MakeRoom();
                if (Buttons().Any(b => b.name == "继续探索")) Click("继续探索"); else ClickReward(); return;
            }
            if (g.State.bossCleanupPending || UiStack.Top is BossPackCleanup)
            { Click(Buttons().First(b => b.GetComponentsInChildren<Text>().Any(t => t.text.Contains("带走 "))).gameObject); return; }
            var current = g.Map.Snapshot.layers[g.State.layerIdx].nodes[g.State.trackPos];
            if (current.type == "event" && !receipt.completed && !string.IsNullOrEmpty(receipt.eventCardId) && (g.State.Phase != "idle" || UiStack.Top is EventDialogScreen))
            { ResolveEvent(); return; }
            if (current.type == "resource" && receipt.rewardTaken == null)
            { MakeRoom(); Require(g.ClaimResourceReward(0, out var why), "resource: " + why); }
            if (current.type == "altar" && receipt.altarRewardPending)
            { Require(g.TrySelectAltarReward("loot", out var why), "altar reward choice: " + why); return; }
            if (current.type == "altar" && receipt.altarRewardKind == "loot" && !receipt.completed)
            {
                MakeRoom(); int index = Enumerable.Range(0, g.GetAltarRewardCards().Count).First(i => !receipt.altarTaken.Contains(i));
                Require(g.TryClaimAltarReward(index, out var why), "altar reward claim: " + why); return;
            }
            Clear(); g.FinishNode();
            Require(current.type != "door", "layer door UI was not presented by the production node route");
            if (current.type == "altar" && !g.State.altarActivated)
            {
                Require(g.State.ownedCards.Count >= 3, "altar sacrifice fixture insufficient");
                Require(g.TryActivateAltar(g.State.ownedCards.Where(c => c.safe != true && !c.stored && string.IsNullOrEmpty(c.pouchOf)).Take(3).Select(c => c.uid), out var why), "altar: " + why); return;
            }
            if (current.type == "extraction") { Require(g.TryFinalExtract(out var why), "final extraction: " + why); Next(); return; }
            string wanted = g.State.layerIdx < 3 ? "door" : !g.State.altarActivated ? "altar" : !g.State.bossDefeated ? "boss" : "extraction";
            var path = FindPath(wanted); Require(path != null && path.Count > 0, "no current route to " + wanted);
            // Replenished attacks are explicitly test fixtures; all move/door/altar/boss guards remain production guards.
            while (g.State.ownedCards.Count(c => c.card.id == "starter-attack") < 8) if (!g.GrantCard(CardLibrary.FindById("starter-attack"))) break;
            Record("real-move-command", new { from = g.CurrentNodeId, to = path[0], wanted });
            Require(g.TryMoveToNode(path[0], out var reason), "move: " + reason);
        }
        static List<string> FindPath(string kind)
        {
            var g = GameRuntime.I; int layer = g.State.layerIdx; var nodes = g.Map.Snapshot.layers[layer].nodes;
            var previous = new Dictionary<int, int> { [g.State.trackPos] = -1 }; var queue = new Queue<int>(); queue.Enqueue(g.State.trackPos);
            while (queue.Count > 0)
            {
                int index = queue.Dequeue();
                if (index != g.State.trackPos && nodes[index].type == kind)
                {
                    var result = new List<string>(); for (int at = index; previous[at] != -1; at = previous[at]) result.Add(layer + "," + at); result.Reverse(); return result;
                }
                foreach (var next in nodes[index].next) if (next.li == layer && !previous.ContainsKey(next.idx)) { previous[next.idx] = index; queue.Enqueue(next.idx); }
            }
            return null;
        }
        static void Fight()
        {
            var session = Sdt.Boot.BattleViewApi.Session; Require(session != null, "battle session missing"); var s = session.Snapshot;
            var commands = Sdt.UI.Screens.Battle.BattleView.Commands; Require(commands != null, "production battle commands missing");
            if (s.over)
            {
                CountCompletedBattle(s);
                Require(!Sdt.UI.Screens.Battle.BattleEvents.SettlementPending, "controlled journey battle save failed");
                RecordPresentationWait(s, "journey-result-bridge"); return;
            }
            if (PresentationStillRunning(s)) return;
            Require(++_battleSteps < 120, "controlled battle stuck, turn=" + s.turn);
            if (s.DeckSelection != null)
            {
                foreach (var card in s.DeckSelection.cards) if (!s.DeckSelection.selected.Contains(card.uid) && s.DeckSelection.selected.Count < s.DeckSelection.need) session.SelectDeckCard(card.uid);
                Sdt.UI.Screens.Battle.BattleView.Commands.ConfirmDeck(); Require(session.Snapshot.DeckSelection == null, "boss deck confirmation failed"); return;
            }
            if (s.RuleChoice != null) { Require(session.ChooseRuleOption(0).Ok, "battle rule choice failed"); return; }
            if (s.RuleHandSelection != null)
            {
                var selection = s.RuleHandSelection;
                if (selection.act == "payment")
                {
                    var materials = selection.candidateUids.Take(selection.n).ToArray();
                    Record("current-payment-command", new { selection.selectionId, selection.n, materials });
                    Require(materials.Length == selection.n && session.ConfirmRuleHandPayment(selection.selectionId, materials).Ok, "mandatory hand payment confirmation failed");
                }
                else Require(session.SelectRuleHand(selection.candidateUids.FirstOrDefault()).Ok, "battle rule hand choice failed");
                return;
            }
            if (s.Discovering != null) { session.PickDiscover(0); return; }
            if (s.Infusing != null) { session.SkipInfusion(); return; }
            foreach (string uid in s.Hand)
            {
                var card = session.FindCard(uid)?.card;
                if (card == null || !JourneyAttackIds.Contains(card.id)) continue;
                string side = session.TargetSide(card), reason = null;
                int cost = session.GetEffectiveCost(card);
                if (!session.TryGetUnplayableReason(uid, out reason))
                    reason = cost > s.energy ? "insufficient current energy" : side != "enemy" ? "verified attack no longer targets enemy" : null;
                if (reason != null)
                { Record("current-attack-not-playable", new { s.BattleToken, s.turn, uid, card.id, card.name, cost, s.energy, side, reason }); continue; }
                int target = s.Foes.ToList().FindIndex(f => !f.dead && f.hp > 0);
                Require(target >= 0, "attack has no live production target before battle outcome");
                var result = commands.PlayCard(uid, target, false);
                Record("current-attack-command", new { s.BattleToken, s.turn, uid, card.id, card.name, cost, energyBefore = s.energy, side, target, result.Ok, result.Reason, energyAfter = session.Snapshot.energy,
                    foesAfter = session.Snapshot.Foes.Select(foe => new { foe.id, foe.hp, foe.dead }).ToArray() });
                if (result.Ok) { CountCompletedBattle(session.Snapshot); return; }
                if (session.Snapshot.Infusing != null || session.Snapshot.RuleHandSelection != null || session.Snapshot.PendingTarget != null) return;
            }
            commands.EndTurn();
            var after = session.Snapshot;
            Record("current-end-turn-command", new { s.BattleToken, turnBefore = s.turn, turnAfter = after.turn, after.over, energyBefore = s.energy, energyAfter = after.energy,
                handBefore = s.Hand.Select(uid => new { uid, id = session.FindCard(uid)?.card?.id }).ToArray() });
            Require(after.over || after.turn > s.turn, "production EndTurn did not progress; phase=" + after.Phase);
            CountCompletedBattle(after);
        }
        static void ObserveJourneyBattleEnd(BattleResult result)
        {
            string token = Sdt.Boot.BattleViewApi.Session?.Snapshot.BattleToken;
            if (token == null) return;
            JourneyBattleOutcomes[token] = result.Win;
            Record("current-battle-result", new { BattleToken = token, result.Win, result.IsBoss, result.Name, result.FoeNames });
        }
        static void CountCompletedBattle(BattleSnapshot snapshot)
        {
            if (!snapshot.over || CompletedBattles.Contains(snapshot.BattleToken)) return;
            Require(JourneyBattleOutcomes.TryGetValue(snapshot.BattleToken, out bool? win), "over snapshot lacks actual BattleEnded outcome");
            Record("current-battle-terminal", new { snapshot.BattleToken, snapshot.turn, snapshot.mode, win, playerHp = snapshot.Player.hp,
                foes = snapshot.Foes.Select(foe => new { foe.id, foe.hp, foe.dead }).ToArray() });
            Require(win == true, "controlled journey battle ended without victory; win=" + win + " playerHp=" + snapshot.Player.hp);
            CompletedBattles.Add(snapshot.BattleToken);
            _battles++; Record("current-battle-completed", new { snapshot.BattleToken, snapshot.turn, snapshot.mode, win, battles = _battles });
        }
        static void ResolveEvent()
        {
            var g = GameRuntime.I; g.GetEventChoices(g.CurrentNodeReceipt.eventCardId); var o = g.GetCurrentEventOutcome(); Require(o != null, "current event missing");
            Record("current-event-command", new { o.Stage, o.Settled, o.CanLeave });
            if (o.Battle != null) { Clear(); Require(g.StartEventBattle(o.Battle), "event battle entry failed"); return; }
            if (o.Chests?.Count > 0) { MakeRoom(); ClickReward(); return; }
            if (o.Settled) { Clear(); g.FinishNode(); return; }
            if (o.CanLeave) { Clear(); g.ApplyCurrentEventChoice("__leave"); return; }
            if (o.Stage == "dice") { g.RollCurrentEventDice(); return; }
            if (o.CardKeys?.Count >= o.Need) { g.SubmitEventSelection(o.CardKeys.Take(o.Need).ToList()); return; }
            var choice = o.Choices?.FirstOrDefault(c => !c.Disabled); Require(choice != null, "event cannot continue: " + o.Stage); g.ApplyCurrentEventChoice(choice.EffectKey);
        }
        static void MakeRoom()
        {
            var g = GameRuntime.I; var cards = g.State.ownedCards.Where(c => c.card.id != "starter-attack" && c.safe != true && !c.stored && string.IsNullOrEmpty(c.pouchOf)).ToList();
            foreach (var card in cards.Take(Math.Min(4, Math.Max(0, cards.Count - 3)))) CardContainerCommands.TryDiscard(g, card.uid, out _);
        }
    }
}
