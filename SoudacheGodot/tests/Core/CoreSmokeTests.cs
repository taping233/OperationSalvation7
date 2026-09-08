using System;
using System.Collections.Generic;
using System.IO;
using Soudache;

internal static class CoreSmokeTests
{
    private static int _checks;

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
        _checks++;
    }

    public static int Main()
    {
        RngIsReplayable();
        DeckMovesWithoutDuplication();
        QueueIsFifo();
        CombatResolvesDamageBlockAndHeal();
        SaveRoundTripsAndFallsBackToBackup();
        Console.WriteLine($"CORE_SMOKE_OK checks={_checks}");
        return 0;
    }

    private static void RngIsReplayable()
    {
        var a = new DeterministicRng(1234UL);
        var b = new DeterministicRng(1234UL);
        for (var i = 0; i < 12; i++) Check(a.NextUInt64() == b.NextUInt64(), "RNG sequence diverged");
        var state = a.State;
        var next = a.NextUInt64();
        a.RestoreState(state);
        Check(a.NextUInt64() == next, "RNG state did not restore");
    }

    private static void DeckMovesWithoutDuplication()
    {
        var deck = new CardDeck();
        var def = new CardDefinition("strike", "Strike", CardType.Attack, cost: 1, damage: 5);
        var exhaust = new CardDefinition("burn", "Burn", CardType.Skill, exhaustOnPlay: true);
        deck.AddToDrawPile(new CardInstance("strike-1", def.Id));
        deck.AddToDrawPile(new CardInstance("burn-1", exhaust.Id));
        Check(deck.Draw(3, new DeterministicRng(9)) == 2, "draw count incorrect");
        Check(deck.Hand.Count == 2 && deck.DrawPile.Count == 0, "hand/draw zones incorrect");
        Check(deck.TryPlay("strike-1", def), "strike should move to discard");
        Check(deck.TryPlay("burn-1", exhaust), "burn should move to exhaust");
        Check(deck.Discard.Count == 1 && deck.Exhaust.Count == 1 && deck.Count == 2, "card zone duplication");
        Check(!deck.TryPlay("strike-1", def), "discarded card played twice");
    }

    private static void QueueIsFifo()
    {
        var combat = new CombatState("player");
        combat.AddCombatant(new CombatantState("player", "Player", 20, false));
        var order = new List<string>();
        combat.Actions.Enqueue(new MarkerAction("first", order));
        combat.Actions.Enqueue(new MarkerAction("second", order));
        Check(combat.ResolveActions() == 2, "queue count incorrect");
        Check(order[0] == "first" && order[1] == "second", "queue was not FIFO");
    }

    private static void CombatResolvesDamageBlockAndHeal()
    {
        var combat = new CombatState("player");
        combat.AddCombatant(new CombatantState("player", "Player", 20, false));
        combat.AddCombatant(new CombatantState("foe", "Foe", 15, true));
        combat.AddBlock("player", 3);
        var result = combat.DealDamage("player", 8);
        Check(result.Blocked == 3 && result.HealthDamage == 5, "damage/block result incorrect");
        Check(combat.RestoreHealth("player", 2) == 2, "heal result incorrect");
        combat.Actions.Enqueue(new DamageAction("foe", 15));
        Check(combat.ResolveActions() == 1 && combat.Phase == CombatPhase.Victory, "victory outcome incorrect");
    }

    private static void SaveRoundTripsAndFallsBackToBackup()
    {
        var root = Path.Combine(Path.GetTempPath(), "soudache-core-smoke-" + Guid.NewGuid().ToString("N"));
        try
        {
            var service = new AtomicJsonSaveService(root, maxSlots: 2);
            var snapshot = new SaveGameDto { RngState = 77UL };
            snapshot.Deck.Cards.Add(new CardInstanceDto { InstanceId = "c1", DefinitionId = "strike", Zone = CardZone.Hand });
            service.Save(0, snapshot);
            Check(service.Load(0).RngState == 77UL, "save round trip failed");
            service.Save(0, new SaveGameDto { RngState = 88UL });
            File.WriteAllText(service.GetSlotPath(0), "{not-json");
            Check(service.TryLoad(0, out var restored, out var usedBackup) && restored!.RngState == 77UL && usedBackup, "backup fallback failed");
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
        }
    }

    private sealed class MarkerAction : IGameAction
    {
        private readonly List<string> _order;
        public string ActionId { get; }
        public MarkerAction(string id, List<string> order) { ActionId = id; _order = order; }
        public void Execute(ActionContext context) => _order.Add(ActionId);
    }
}
