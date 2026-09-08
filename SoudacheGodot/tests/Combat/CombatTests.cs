using System;
using System.Collections.Generic;
using System.IO;
using Soudache;

internal static class CombatTests
{
    private static int _checks;
    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
        _checks++;
    }

    public static int Main()
    {
        DamageTypesAndDefense();
        StatusRules();
        ExportedCatalogLoads();
        DataCatalogAndAtomicPlay();
        FifoAndZones();
        Console.WriteLine($"COMBAT_TESTS_OK checks={_checks}");
        return 0;
    }

    private static void ExportedCatalogLoads()
    {
        var path = Path.Combine("SoudacheGodot", "data", "cards.json");
        if (!File.Exists(path)) return; // Keep the test runnable from its bin directory too.
        var catalog = CardCatalog.LoadFile(path);
        Check(catalog.Count == 243, "exported catalog card count");
        Check(catalog.GetRequired("builtin-sha").DmgType == DamageType.Attack, "exported damage type");
        Check(catalog.GetRequired("tt7-frozenight").Effects.Count > 0, "exported status effects");
    }

    private static CombatState NewCombat(out CardDeck deck, out CardCatalog catalog)
    {
        var combat = new CombatState("p");
        combat.AddCombatant(new CombatantState("p", "Player", 30, false) { Attack = 2, SpellPower = 1 });
        combat.AddCombatant(new CombatantState("e1", "Enemy 1", 40, true));
        combat.AddCombatant(new CombatantState("e2", "Enemy 2", 40, true));
        combat.SetEnergy(5, 5);
        combat.StartPlayerTurn();
        deck = new CardDeck();
        catalog = CardCatalog.Load("""
        {"cards":[
          {"id":"strike","name":"Strike","type":"武术","cost":1,"dmg":3,"dmgType":"attack","desc":"攻3"},
          {"id":"storm","name":"Storm","type":"法术","cost":2,"dmg":2,"dmgType":"spell","desc":"对全体敌人造成 2 点伤害"},
          {"id":"ward","name":"Ward","type":"武术","cost":1,"armor":4,"desc":"获得 4 点护甲"},
          {"id":"curse","name":"Curse","type":"法术","cost":1,"desc":"附加 2 层流血，冰冻持续 2 回合"},
          {"id":"heal","name":"Heal","type":"道具","cost":1,"heal":5,"desc":"回复 5 血"},
          {"id":"fuel","name":"Fuel","type":"道具","cost":0,"desc":""}
        ]}
        """);
        return combat;
    }

    private static void DamageTypesAndDefense()
    {
        var combat = new CombatState("p");
        var player = new CombatantState("p", "Player", 30, false) { Attack = 4, SpellPower = 2 };
        var foe = new CombatantState("e", "Foe", 30, true);
        combat.AddCombatant(player); combat.AddCombatant(foe);
        foe.AddBlock(3); foe.AddArmor(4);
        var attack = combat.DealDamage("p", "e", 2, DamageType.Attack);
        Check(attack.Type == DamageType.Attack && attack.HealthDamage == 0 && attack.Blocked == 6, "attack/block formula");
        var spell = combat.DealDamage("p", "e", 3, DamageType.Spell);
        Check(spell.HealthDamage == 4 && spell.Blocked == 1, "spell/armor formula");
        var negativeBase = combat.DealDamage("p", "e", -1, DamageType.Attack);
        Check(negativeBase.HealthDamage == 3, "negative attack base preserves attack bonus");
        foe.AddBlock(8); foe.AddArmor(8); foe.AddStatus(CombatStatus.ArmorBreak, duration: 2);
        var trueDamage = combat.DealDamage("p", "e", 3, DamageType.True);
        Check(trueDamage.HealthDamage == 3 && foe.Block == 8 && foe.Armor == 8, "true damage ignores defense");
        foe.ClearStatus(CombatStatus.ArmorBreak);
        Check(combat.RestoreHealth("e", 2) == 2, "heal restores health");
    }

    private static void StatusRules()
    {
        var combat = new CombatState("p");
        var player = new CombatantState("p", "Player", 30, false);
        var foe = new CombatantState("e", "Foe", 30, true);
        combat.AddCombatant(player); combat.AddCombatant(foe);
        foe.AddStatus(CombatStatus.Bleed, 2);
        foe.AddStatus(CombatStatus.Poison, 3);
        Check(combat.DealDamage("p", "e", 1, DamageType.Attack).HealthDamage == 3, "bleed boosts attack only");
        Check(combat.TickPoison("e") == 3 && foe.Health == 24, "poison ticks fixed damage");
        foe.AddStatus(CombatStatus.Freeze, duration: 2);
        foe.AddStatus(CombatStatus.Silence, duration: 1);
        foe.AddStatus(CombatStatus.HealingBan, duration: 2);
        Check(!combat.CanAct("e") && combat.RestoreHealth("e", 4) == 0, "freeze/healing ban");
        combat.TickDurations("e");
        Check(foe.GetStatus(CombatStatus.Freeze) == 1 && foe.GetStatus(CombatStatus.Silence) == 0, "duration tick");
        foe.AddStatus(CombatStatus.Stealth, duration: 1);
        Check(combat.DealDamage("p", "e", 4, DamageType.Fixed).Stealthed, "stealth blocks targeting");
        Check(combat.BreakStealth("e"), "stealth breaks explicitly");
        foe.AddStatus(CombatStatus.Immune, duration: 1);
        Check(combat.DealDamage("p", "e", 4, DamageType.True).Immune, "immune blocks true damage");
        Check(foe.Purify() >= 5 && !foe.HasStatus(CombatStatus.Bleed), "purify clears all statuses");
        foe.AddStatus(CombatStatus.DamageReduction, 2, 1);
        foe.TickDurations();
        Check(!foe.HasStatus(CombatStatus.DamageReduction), "timed reduction expires");
    }

    private static void DataCatalogAndAtomicPlay()
    {
        var combat = NewCombat(out var deck, out var catalog);
        var strike = new CardInstance("strike-1", "strike");
        var storm = new CardInstance("storm-1", "storm");
        var curse = new CardInstance("curse-1", "curse");
        deck.AddToHand(strike); deck.AddToHand(storm); deck.AddToHand(curse);
        var engine = new CardPlayEngine(combat, deck, catalog);
        var beforeEnergy = combat.Energy;
        var invalid = engine.TryPlay("strike-1", new[] { (StableId)"e2" });
        Check(invalid.Accepted && !deck.IsInHand("strike-1") && deck.Discard.Count == 1, "enemy target accepted atomically");
        // The action is queued, so effects have not happened until the FIFO drain.
        Check(combat.GetCombatant("e2").Health == 40, "queued effect not eager");
        engine.ResolveQueuedEffects();
        Check(combat.GetCombatant("e2").Health == 35 && combat.Energy == beforeEnergy - 1, "attack card resolves from data");
        var invalidTarget = engine.TryPlay("curse-1", new[] { (StableId)"p" });
        Check(!invalidTarget.Accepted && deck.IsInHand("curse-1") && combat.Energy == beforeEnergy - 1, "invalid target leaves state unchanged");
        var acceptedStorm = engine.TryPlay("storm-1");
        Check(acceptedStorm.Accepted && acceptedStorm.QueuedEffects == 1, "area card needs no target");
        engine.ResolveQueuedEffects();
        Check(combat.GetCombatant("e1").Health == 37 && combat.GetCombatant("e2").Health == 32, "area hits each living enemy once");
    }

    private static void FifoAndZones()
    {
        var combat = NewCombat(out var deck, out var catalog);
        var ward = new CardInstance("ward-1", "ward");
        var curse = new CardInstance("curse-1", "curse");
        deck.AddToHand(ward); deck.AddToHand(curse);
        var engine = new CardPlayEngine(combat, deck, catalog);
        Check(engine.TryPlay("ward-1").Accepted, "ward accepted");
        Check(engine.TryPlay("curse-1", new[] { (StableId)"e1" }).Accepted, "curse accepted");
        var resolved = combat.ResolveActions();
        Check(resolved == 3 && combat.GetCombatant("p").Armor == 4, $"card actions FIFO resolved={resolved} armor={combat.GetCombatant("p").Armor} queue={combat.Actions.Count}");
        Check(deck.Discard.Count == 2 && deck.Count == 2, "played cards have one discard zone each");
        deck.ValidateInvariant();
        Check(!engine.TryPlay("ward-1").Accepted, "discarded card cannot be played twice");
    }
}
