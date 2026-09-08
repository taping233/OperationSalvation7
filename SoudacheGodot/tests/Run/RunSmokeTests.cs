using System;
using System.Linq;
using Soudache;

internal static class RunSmokeTests
{
    private static int _checks;
    private static void Check(bool value, string message) { if (!value) throw new InvalidOperationException(message); _checks++; }

    public static int Main()
    {
        MapUsesTheOriginalThreeRingsAndIsReachable();
        DiceMovementIsDeterministicAndConsumesStamina();
        RoomSettlementAndDoorProgressionWork();
        BattleDropsAreSettledAndFailureIsTerminal();
        ShopEventFireAndEmergencyExtractionWork();
        SnapshotsRestoreOnlyValidatedReadyRuns();
        BossPathCanFinishACompleteRun();
        Console.WriteLine($"RUN_SMOKE_OK checks={_checks}");
        return 0;
    }

    private static void MapUsesTheOriginalThreeRingsAndIsReachable()
    {
        var map = RunMap.CreateDefault();
        Check(map.Layers.Count == 3, "map must have three layers");
        Check(map.Layers.Select(x => x.RingSize).SequenceEqual(new[] { 28, 20, 12 }), "ring sizes changed");
        Check(map.Layers[0].Doors.Count == 4 && map.Layers[1].Doors.Count == 2, "door count changed");
        Check(map.Layers[2].RoomAt(10).Type == RunRoomType.EmergencyExit, "emergency exit missing");
        Check(map.IsConnected(out var unreachable) && unreachable.Count == 0, "map is disconnected");
    }

    private static void DiceMovementIsDeterministicAndConsumesStamina()
    {
        var a = new RunState(1234UL); var b = new RunState(1234UL);
        for (var i = 0; i < 8; i++)
        {
            var ra = a.Roll(); var rb = b.Roll();
            Check(ra.Dice == rb.Dice && ra.ToPosition == rb.ToPosition && ra.Path.SequenceEqual(rb.Path), "run replay diverged");
            SettleToReady(a); SettleToReady(b);
        }
        Check(a.Stamina == RunRules.StaminaMax - 8 && a.Turns == 8, "roll did not consume stamina/turn");
    }

    private static void RoomSettlementAndDoorProgressionWork()
    {
        var run = new RunState(1);
        run.DebugSetPosition(0, 2);
        run.ResolveCurrentRoom();
        Check(run.Resources.Coins == 1 && run.Phase == RunPhase.Ready, "coin room settlement incorrect");
        run.DebugSetPosition(0, 1); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.AwaitingDoor, "outer door should await choice");
        run.EnterDoor();
        Check(run.LayerIndex == 1 && run.TrackPosition == 0 && run.Phase == RunPhase.Ready, "door did not progress to layer two");
    }

    private static void BattleDropsAreSettledAndFailureIsTerminal()
    {
        var run = new RunState(4); run.DebugSetPosition(0, 5); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Battle && run.Encounter.Count is >= 2 and <= 4, "battle encounter invalid");
        run.CompleteBattle(true); Check(run.Phase == RunPhase.Chest, "battle should open a chest settlement");
        run.OpenNextChest(); while (run.Phase == RunPhase.Chest) run.OpenNextChest();
        Check(run.Phase == RunPhase.Ready, "chest queue did not settle");
        run.DebugSetPosition(0, 5); run.ResolveCurrentRoom(); run.CompleteBattle(false);
        Check(run.Phase == RunPhase.Defeat && run.IsFinished, "battle failure must be terminal");
    }

    private static void ShopEventFireAndEmergencyExtractionWork()
    {
        var run = new RunState(9); run.DebugSetPosition(1, 13); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Shop && run.Shop.Count == 3, "shop room missing offers");
        run.Resources.Coins = 10; run.BuyShopOffer("rations"); Check(run.Resources.Rations == 1, "shop resource purchase failed"); run.LeaveShop(); run.StayAtDoor();
        run.DebugSetPosition(1, 4); run.ResolveCurrentRoom(); Check(run.Phase == RunPhase.Event, "event room missing"); run.ResolveEvent();
        run.DebugSetPosition(2, 10); run.ResolveCurrentRoom(); Check(run.Phase == RunPhase.AwaitingDoor, "emergency exit should await payment");
        run.Resources.Coins = RunRules.EmergencyExitCost; run.ExtractAtDoor(); Check(run.Phase == RunPhase.Victory, "emergency exit should complete the run");
    }

    private static void BossPathCanFinishACompleteRun()
    {
        var run = new RunState(17); run.DebugSetPosition(2, 1); run.ResolveCurrentRoom(); Check(run.Phase == RunPhase.AwaitingDoor, "altar entrance should await choice");
        run.EnterDoor(); Check(run.Phase == RunPhase.Altar, "altar entrance did not open altar");
        for (var i = 0; i < 3; i++)
        {
            run.ChallengeBoss(i); Check(run.Phase == RunPhase.Battle, "boss challenge did not enter battle");
            run.CompleteBattle(true); while (run.Phase == RunPhase.Chest) run.OpenNextChest();
            Check(run.Phase == (i == 2 ? RunPhase.Altar : RunPhase.Altar), "boss chest return state incorrect");
        }
        run.Extract(); Check(run.Phase == RunPhase.Victory, "complete run did not reach victory");
    }

    private static void SnapshotsRestoreOnlyValidatedReadyRuns()
    {
        var source = new RunState(42); source.DebugSetPosition(1, 7); source.Resources.Coins = 6; source.Resources.Keys = 1;
        var snapshot = source.CaptureSnapshot(); var restored = RunState.FromSnapshot(snapshot);
        Check(restored.Seed == 42 && restored.LayerIndex == 1 && restored.TrackPosition == 7 && restored.Resources.Coins == 6 && restored.Resources.Keys == 1, "snapshot fields did not restore");
        Check(restored.Rng.State == snapshot.RngState && restored.Phase == RunPhase.Ready, "snapshot RNG/phase did not restore");
        var invalid = snapshot with { Phase = RunPhase.Battle };
        try { RunState.FromSnapshot(invalid); throw new InvalidOperationException("non-ready snapshot was accepted"); }
        catch (ArgumentException) { _checks++; }
    }

    private static void SettleToReady(RunState run)
    {
        for (var guard = 0; guard < 8 && run.Phase != RunPhase.Ready; guard++)
        {
            switch (run.Phase)
            {
                case RunPhase.Event: run.ResolveEvent(); break;
                case RunPhase.Chest: run.OpenNextChest(); break;
                case RunPhase.Campfire: run.CompleteCampfire(); break;
                case RunPhase.Shop: run.LeaveShop(); break;
                case RunPhase.AwaitingDoor: run.StayAtDoor(); break;
                case RunPhase.Battle: run.CompleteBattle(true); break;
                case RunPhase.Altar: run.LeaveAltar(); break;
                default: throw new InvalidOperationException($"unexpected phase {run.Phase}");
            }
        }
        Check(run.Phase == RunPhase.Ready, "room did not settle to ready");
    }
}
