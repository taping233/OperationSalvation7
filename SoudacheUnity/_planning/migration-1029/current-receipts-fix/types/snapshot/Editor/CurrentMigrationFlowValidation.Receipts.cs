using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Reflection;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Menu;
using Sdt.UI.Screens.Run;
using Sdt.UI.Screens.Hub;
using Sdt.UI.Screens.Battle;
using UnityEngine;
using UnityEngine.EventSystems;
using OwnedCard = Sdt.Core.OwnedCard;

namespace Sdt.Editor
{
    public static partial class CurrentMigrationFlowValidation
    {
        static string _terminalStats, _terminalStash;
        static Action _terminalRetry;
        static int _roomHp, _roomOwned;
        static string _roomNode;
        static int? _roomSeed;
        static int _roomCoins;
        static HashSet<string> _roomOwnedUids;
        static string _presentationWaitToken, _presentationWaitReason;
        static double _presentationWaitStarted;
        static void ResetPresentationWait()
        { _presentationWaitToken = _presentationWaitReason = null; _presentationWaitStarted = 0; }
        static void RecordPresentationWait(BattleSnapshot snapshot, string reason)
        {
            Require(snapshot != null, "battle snapshot missing while waiting for " + reason);
            if (_presentationWaitToken != snapshot.BattleToken || _presentationWaitReason != reason)
            {
                _presentationWaitToken = snapshot.BattleToken; _presentationWaitReason = reason;
                _presentationWaitStarted = UnityEditor.EditorApplication.timeSinceStartup;
            }
            double elapsed = UnityEditor.EditorApplication.timeSinceStartup - _presentationWaitStarted;
            var screen = App.Canvas.GetComponentsInChildren<BattleScreen>(true).SingleOrDefault();
            var queue = screen == null ? null : screen.GetComponent<BattlePresentationQueue>();
            var actor = screen == null ? null : screen.GetComponentsInChildren<BattleUnitFrames>(true).SingleOrDefault();
            Record("wait-current-presentation", new { reason, snapshot.BattleToken, snapshot.over, elapsed,
                queueBusy = queue != null && queue.Busy, pendingBeats = queue?.PendingBeats,
                action = actor?.CurrentAction, frame = actor?.CurrentFrame, actorRunning = actor != null && actor.Running,
                battleActive = GameRuntime.I.State.battleActive, stack = UiStack.Names() });
            Require(elapsed < 25, "current battle presentation/settlement did not complete: " + reason);
        }
        static bool PresentationStillRunning(BattleSnapshot snapshot)
        {
            var screen = App.Canvas.GetComponentsInChildren<BattleScreen>(true).SingleOrDefault();
            var queue = screen == null ? null : screen.GetComponent<BattlePresentationQueue>();
            var actor = screen == null ? null : screen.GetComponentsInChildren<BattleUnitFrames>(true).SingleOrDefault();
            if (queue != null && queue.Busy || actor != null && actor.Running)
            { RecordPresentationWait(snapshot, "before-next-command"); return true; }
            ResetPresentationWait(); return false;
        }
        static bool AwaitDeathReceipt(string reason)
        {
            if (UiStack.Top is DeathScreen) { ResetPresentationWait(); return true; }
            var snapshot = Sdt.Boot.BattleViewApi.Session?.Snapshot;
            Require(UiStack.Top is BattleScreen && snapshot?.over == true, "expected terminal battle while waiting for " + reason + ": " + UiStack.Names());
            Require(!BattleEvents.SettlementPending, "unexpected save failure while waiting for " + reason);
            RecordPresentationWait(snapshot, reason); return false;
        }
        static void CaptureTerminalBaseline()
        { _terminalStats = SaveJson.Stringify(GameRuntime.I.Base.stats); _terminalStash = SaveJson.Stringify(GameRuntime.I.Base.stash); }
        static void RequireNoDuplicate(string reason)
        {
            var g = GameRuntime.I;
            Require(SaveJson.Stringify(g.Base.stats) == _terminalStats && SaveJson.Stringify(g.Base.stash) == _terminalStash, reason + " duplicated stats/stash");
            Require(new SaveSystem().GetSettlement(5)?.status == "complete" && !new SaveSystem().HasRun(5), reason + " did not persist terminal receipt/remove run");
        }
        static void TerminalFixture()
        {
            Fixture(false); var g = GameRuntime.I; Clear();
            g.Base.stash.Clear(); g.State.ownedCards.Clear(); g.State.usedPocket.Clear(); g.State.inventory.Clear();
            g.State.ownedCards.Add(new OwnedCard { uid = "native-safe", card = CardLibrary.FindById("tt-jinchuangyao").Clone(), safe = true });
            g.State.ownedCards.Add(new OwnedCard { uid = "native-brought-safe", card = CardLibrary.FindById("tt3-fireball").Clone(), safe = true, brought = 1 });
            g.State.ownedCards.Add(new OwnedCard { uid = "native-loose", card = CardLibrary.FindById("tt3-fireball").Clone() });
            g.State.Phase = "idle"; g.SaveCurrent(); Require(g.Saves.LastWriteSucceeded, "terminal fixture not saved");
            Record("terminal-fixture", new { safeAcquired = "native-safe", safeBrought = "native-brought-safe", loose = "native-loose" });
        }
        static void BeginBattle(bool lethal)
        {
            TerminalFixture(); var g = GameRuntime.I; if (lethal) g.State.hp = 1; g.SaveCurrent();
            g.Bus.Emit(new BattleRequested { Request = new BattleRequest { Name = "Current native terminal receipt", Foes = new List<EnemyStats> { new EnemyStats { id = "native-terminal", name = "受控敌人", hp = lethal ? 99999 : 500, atk = lethal ? 99999 : 1 } } } });
            Require(g.State.battleActive && Sdt.Boot.BattleViewApi.Session != null, "current battle entry failed");
        }
        static void Receipts()
        {
            var g = GameRuntime.I;
            switch (_step)
            {
                case 0:
                    TerminalFixture(); Lock(); Require(g.DoExtract() == null, "locked extraction unexpectedly succeeded");
                    Require(g.State.runActive && File.ReadAllText(SaveSystem.ProfilePath) == _before && new SaveSystem().GetSettlement(5) == null, "failed extraction consumed run/profile");
                    Unlock(); Require(g.DoExtract() != null, "extraction retry failed"); Next(); break;
                case 1:
                    Expect<ExtractStashScreen>(); _identity = g.CurrentExtractionIdentity; Shot("sort-before");
                    _terminalStash = SaveJson.Stringify(g.Base.stash); Lock(); Click("exRarity");
                    Require(SaveJson.Stringify(g.Base.stash) == _terminalStash && File.ReadAllText(SaveSystem.ProfilePath) == _before, "failed store mutated stash/profile");
                    Unlock(); Next(); break;
                case 2: Click("exRarity"); Next(); break;
                case 3:
                    Require(g.CurrentExtraction.Left.Count == 0, "fixture cards not fully stored");
                    Require(new SaveSystem().GetSettlement(5).identity == _identity, "sorting lost receipt identity");
                    CaptureTerminalBaseline(); g.ExtractStashAll(); Require(SaveJson.Stringify(g.Base.stash) == _terminalStash, "repeated store duplicated cards");
                    Lock(); Click("exFinish");
                    Require(UiStack.Top is ExtractStashScreen && new SaveSystem().GetSettlement(5).status == "sorting" && File.ReadAllText(SaveSystem.ProfilePath) == _before, "failed finish lost sorting page/profile");
                    Shot("sort-finish-save-failed"); Unlock(); Next(); break;
                case 4: Click("exFinish"); Next(); break;
                case 5:
                    Expect<ExtractDoneScreen>(); CaptureTerminalBaseline(); g.FinishExtract(true); g.DoExtract(); RequireNoDuplicate("extraction"); Shot("extract-complete"); Click("goBase"); Next(); break;
                case 6: Expect<HubScreen>(); BeginBattle(true); Next(); break;
                case 7:
                    HoldCancellation(); Record("real-battle-command", new { action = "EndTurn", lethal = true });
                    Sdt.Boot.BattleViewApi.Session.EndTurn(); Next(); break;
                case 8:
                    if (!AwaitDeathReceipt("lethal-combat-death-receipt")) return;
                    Expect<DeathScreen>(); Require(new SaveSystem().GetSettlement(5)?.reason == "dead", "lethal combat did not persist death");
                    Require(new SaveSystem().GetSettlement(5).death.SavedN == 2, "death did not rescue both safe cards");
                    CaptureTerminalBaseline(); g.DoDeath(); g.DoDeath(); RequireNoDuplicate("death"); Shot("death"); Click("goBase"); Next(); break;
                case 9: Expect<HubScreen>(); BeginBattle(false); Next(); break;
                case 10:
                    if (PresentationStillRunning(Sdt.Boot.BattleViewApi.Session?.Snapshot)) return;
                    Click(App.Canvas.GetComponentsInChildren<UnityEngine.UI.Button>().Single(button => button.name == "btnBattleOptions" && button.isActiveAndEnabled).gameObject);
                    _step = 100; break;
                case 100:
                    Expect<BattleSettingsScreen>(); Click(SurrenderTarget());
                    Require(g.State.runActive && g.State.battleActive && new SaveSystem().GetSettlement(5) == null, "first surrender click settled early"); _step = 11; break;
                case 11:
                    Lock(); Click(SurrenderTarget());
                    Require(BattleEvents.SettlementPending && g.State.runActive && File.ReadAllText(SaveSystem.ProfilePath) == _before, "failed active surrender lost battle/retry");
                    Shot("surrender-save-failed"); Unlock(); Next(); break;
                case 12:
                    _terminalRetry = BattleEvents.RetrySettlement;
                    Require(_terminalRetry != null, "active surrender retry command missing");
                    _terminalRetry(); Next(); break;
                case 13:
                    if (!AwaitDeathReceipt("active-surrender-retry-receipt")) return;
                    Expect<DeathScreen>(); Require(new SaveSystem().GetSettlement(5)?.reason == "dead", "active surrender not classified as failure");
                    CaptureTerminalBaseline(); _terminalRetry(); g.DoDeath(); RequireNoDuplicate("active surrender"); Shot("surrender-complete"); Click("goBase"); Next(); break;
                case 14: Expect<HubScreen>(); TerminalFixture(); LeaveMenuScreen.Open(); Next(); break;
                case 15: Click("leaveAbandon"); Next(); break;
                case 16:
                    Lock(); Click("leaveAbandonConfirm");
                    Require(g.State.runActive && new SaveSystem().GetSettlement(5) == null && File.ReadAllText(SaveSystem.ProfilePath) == _before, "failed abandon consumed run/profile");
                    Shot("abandon-save-failed"); Unlock(); Next(); break;
                case 17: Click("leaveAbandonConfirm"); Next(); break;
                case 18:
                    Require(UiStack.Top.GetType().Name == "AbandonResultScreen", "abandon result page missing");
                    var receipt = new SaveSystem().GetSettlement(5); Require(receipt?.reason == "abandon" && receipt.abandon.KeptN == 1, "abandon did not rescue only acquired safe card");
                    Require(receipt.abandon.KeptStacks.Single().card.id == "tt-jinchuangyao", "abandon rescued wrong identity");
                    CaptureTerminalBaseline(); g.AbandonRun(); g.AbandonRun(); RequireNoDuplicate("abandon"); Shot("abandon-complete"); Click("goBase"); Next(); break;
                case 19:
                    Expect<HubScreen>(); Shot("terminal-return-base"); TerminalFixture();
                    g.State.hp = g.State.maxHp - 5; _roomHp = g.State.hp;
                    g.State.usedPocket.Add(new PocketStack { card = CardLibrary.FindById("starter-attack").Clone(), count = 1 });
                    RoomFixture("fire"); FireRestScreen.Open(); Next(); break;
                case 20:
                    Expect<FireRestScreen>(); Shot("fire"); Lock(); ClickLabel("回复生命");
                    Require(g.State.hp == _roomHp && !g.CurrentNodeReceipt.healUsed && File.ReadAllText(SaveSystem.ProfilePath) == _before, "failed fire heal changed state/profile");
                    Unlock(); Next(); break;
                case 21: ClickLabel("回复生命"); Next(); break;
                case 22:
                    if (!Buttons().Any(b => b.GetComponentsInChildren<UnityEngine.UI.Text>().Any(t => t.text == "复原卡牌"))) return;
                    Require(g.State.hp > _roomHp && g.CurrentNodeReceipt.healUsed, "fire heal retry did not apply"); ClickLabel("复原卡牌"); Next(); break;
                case 23:
                    if (!Buttons().Any(b => b.name == "继续探索")) return;
                    Require(g.CurrentNodeReceipt.restoreUsed && g.CurrentNodeReceipt.restoredIds.Count == 1, "fire restore did not consume exact fixture pocket");
                    Require(new SaveSystem().ReadSlot(5).nodeRewards[g.CurrentNodeId].restoredIds.Count == 1, "fire reward not persisted");
                    Shot("fire-complete"); Click("继续探索"); Next(); break;
                case 24:
                    RoomFixture("resource"); g.CurrentNodeReceipt.chestQueue = new List<ChestVisitReceipt> { new ChestVisitReceipt { kind = "small", coins = 3, cardIds = new List<string> { "tt3-fireball", "tt-jinchuangyao" }, claimMode = "all" } }; g.SaveCurrent();
                    _roomNode = g.CurrentNodeId; _roomSeed = g.State.seed;
                    ChestOpenScreen.OpenPending(null); Next(); break;
                case 25:
                    Expect<ChestOpenScreen>(); Shot("chest-reward"); _roomOwned = g.State.ownedCards.Count;
                    _roomCoins = g.State.coins; _roomOwnedUids = new HashSet<string>(g.State.ownedCards.Select(card => card.uid));
                    Lock(); Click("全部收下"); Require(g.State.ownedCards.Count == _roomOwned && File.ReadAllText(SaveSystem.ProfilePath) == _before, "failed chest claim consumed candidate/profile");
                    var failedChest = g.State.nodeRewards[_roomNode].chestQueue[0];
                    Require(failedChest.taken.Count == 0 && failedChest.lost.Count == 0 && !failedChest.completed && g.State.coins == _roomCoins, "failed chest claim changed receipt/coins");
                    Unlock(); Next(); break;
                case 26: Click("全部收下"); Next(); break;
                case 27:
                    var node = g.State.nodeRewards[_roomNode]; var chest = node.chestQueue[0];
                    var fresh = new SaveSystem().ReadSlot(5); var savedChest = fresh.nodeRewards[_roomNode].chestQueue[0];
                    string[] expected = { "tt-jinchuangyao", "tt3-fireball" };
                    Require(g.State.ownedCards.Count == _roomOwned + 2 && chest.completed && chest.taken.SetEquals(new[] { 0, 1 }) && chest.lost.Count == 0, "chest retry did not grant exactly two candidates");
                    Require(g.State.ownedCards.Where(card => !_roomOwnedUids.Contains(card.uid)).Select(card => card.card.id).OrderBy(id => id).SequenceEqual(expected.OrderBy(id => id)), "chest retry granted wrong identities");
                    Require(savedChest.completed && savedChest.taken.SetEquals(new[] { 0, 1 }) && savedChest.lost.Count == 0 && fresh.ownedCards.Count == _roomOwned + 2 && fresh.coins == _roomCoins && g.State.coins == _roomCoins, "chest claim/coins not persisted exactly once");
                    Expect<ChestOpenScreen>(); Require(g.CurrentNodeId == _roomNode && node.chestIndex == 0 && g.State.Phase == "modal", "multi-card source reward did not retain completed page for continue");
                    Require(!g.TryClaimCurrentChest(_roomNode, _roomSeed, 0, out _), "already taken candidate accepted twice");
                    bool repeatedAll = g.TryClaimCurrentChest(_roomNode, _roomSeed, -1, out _);
                    Require(g.State.ownedCards.Count == _roomOwned + 2 && new SaveSystem().ReadSlot(5).ownedCards.Count == _roomOwned + 2 && g.State.coins == _roomCoins, "repeated chest claim duplicated cards/coins");
                    Record("current-chest-retry-and-idempotency", new { node = _roomNode, completed = chest.completed, taken = chest.taken.ToArray(), lost = chest.lost.ToArray(), repeatedAll, coins = _roomCoins });
                    Shot("reward-complete"); Click("继续探索"); _step = 270; break;
                case 270:
                    Require(g.State.nodeRewards[_roomNode].completed && g.State.nodeRewards[_roomNode].chestIndex == 1 && g.State.Phase == "idle" && !(UiStack.Top is ChestOpenScreen), "source continue did not complete reward queue");
                    Require(new SaveSystem().ReadSlot(5).nodeRewards[_roomNode].completed, "reward continuation not persisted");
                    _step = 28; break;
                case 28:
                    RoomFixture("event"); g.CurrentNodeReceipt.eventCardId = "tt6-goldmine"; g.SaveCurrent();
                    EventDialogScreen.Open(CardLibrary.FindById("tt6-goldmine"), null); Next(); break;
                case 29:
                    Expect<EventDialogScreen>(); Shot("event");
                    var choice = g.GetCurrentEventOutcome()?.Choices?.FirstOrDefault(c => !c.Disabled); Require(choice != null, "goldmine current choice missing");
                    _before = SaveJson.Stringify(g.CurrentNodeReceipt.eventProgress); ClickLabel(choice.Label); Next(); break;
                case 30:
                    var inline = UiStack.Top == null ? null : Buttons().FirstOrDefault(b => b.name == "event-inline-confirm"); if (inline != null) { Click(inline.gameObject); Next(); break; }
                    Next(); break;
                case 31:
                    Require(SaveJson.Stringify(g.CurrentNodeReceipt.eventProgress) != _before, "event choice did not advance current receipt");
                    Require(SaveJson.Stringify(new SaveSystem().ReadSlot(5).nodeRewards[g.CurrentNodeId].eventProgress) == SaveJson.Stringify(g.CurrentNodeReceipt.eventProgress), "event stage not persisted");
                    Shot("event-after-choice"); Finish(); break;
            }
        }
        static void RoomFixture(string type)
        {
            var g = GameRuntime.I; Clear();
            var found = g.Map.Snapshot.layers.SelectMany((layer, li) => layer.nodes.Select(node => new { li, node })).First(x => x.node.type == type);
            g.State.layerIdx = found.li; g.State.trackPos = found.node.idx; g.State.closed.Remove(g.CurrentNodeId); g.State.settled.Remove(g.CurrentNodeId);
            g.State.nodeRewards[g.CurrentNodeId] = new NodeVisitReceipt { type = type }; g.State.Phase = "modal"; g.SaveCurrent();
            Record("controlled-room-fixture", new { type, node = g.CurrentNodeId, relocation = true, naturalRouteTraversal = false });
        }
        static GameObject SurrenderTarget()
        {
            Expect<BattleSettingsScreen>(); return UiStack.Top.GetComponentsInChildren<BattleSurrenderButton>().Single().gameObject;
        }
        static void HoldCancellation()
        {
            var hold = UiStack.Top.GetComponentsInChildren<CurrentEndTurnHold>().Single();
            var holding = typeof(CurrentEndTurnHold).GetField("_holding", BindingFlags.NonPublic | BindingFlags.Instance);
            Require(holding != null, "hold cancellation fixture field missing");
            var pointer = new PointerEventData(EventSystem.current) { button = PointerEventData.InputButton.Left };
            // Synthetic in-progress component state isolates cancellation from hidden-window focus/hardware gating.
            // This explicitly does not prove the physical 650ms held-input success path.
            Action<Action> check = action => { holding.SetValue(hold, true); Require(hold.IsHolding, "hold fixture did not arm"); action(); Require(!hold.IsHolding && hold.Progress == 0, "hold lifecycle did not cancel"); };
            check(() => ExecuteEvents.Execute(hold.gameObject, pointer, ExecuteEvents.pointerUpHandler));
            check(() => ExecuteEvents.Execute(hold.gameObject, pointer, ExecuteEvents.pointerExitHandler));
            check(() => ExecuteEvents.Execute(hold.gameObject, new BaseEventData(EventSystem.current), ExecuteEvents.deselectHandler));
            check(() => ExecuteEvents.Execute(hold.gameObject, new BaseEventData(EventSystem.current), ExecuteEvents.cancelHandler));
            Record("constructed-hold-cancel-lifecycle", new { release = true, exit = true, deselect = true, cancel = true, syntheticHoldingState = true, physicalHoldSuccess = false });
        }
    }
}
