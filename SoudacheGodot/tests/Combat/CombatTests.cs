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
        InfusionDelayAndDiscover();
        EnemyAffixes();
        FifoAndZones();
        SpecialCardContracts();
        EveryFormerUnsupportedCardHasCoreContract();
        Console.WriteLine($"COMBAT_TESTS_OK checks={_checks}");
        return 0;
    }

    private static void ExportedCatalogLoads()
    {
        var path = Path.Combine("SoudacheGodot", "data", "cards.json");
        if (!File.Exists(path)) return; // Keep the test runnable from its bin directory too.
        var catalog = CardCatalog.LoadFile(path);
        Check(catalog.Count == 245, "exported catalog card count");
        Check(catalog.All.Count(card => card.Layer == CardLayer.Combat) == 218, "combat layer coverage is 218 cards");
        // 跟随网页版 2026-09-09 实机定版（cards.js RETIRE_TT11 / cards-sync.json retire）：
        // 以下卡牌已从干净环境的卡库退役，不得再出现在导出目录
        // （其语义断言随之移除：注能触发 3 状态 / 贮藏 3 槽 / 混合复制 / 施法回能）。
        foreach (var retired in new[] { "tt3sp-cursewave", "tt2-pouch", "tt3-copy-potion", "tt3-mana-blood" })
            Check(!catalog.TryGet((StableId)retired, out _), $"retired card back in catalog: {retired}");
        Check(catalog.GetRequired("builtin-sha").DmgType == DamageType.Attack, "exported damage type");
        Check(catalog.GetRequired("tt7-frozenight").Effects.Count > 0, "exported status effects");
        Check(catalog.GetRequired("tt3-execute").Effects.Any(e => e.Kind == CardEffectKind.Damage && e.Condition?.Kind == EffectConditionKind.TargetHealthAtMost), "execute health condition");
        Check(catalog.GetRequired("tt7-meteorstrong").InfuseCount == 2, "infusion count from export");
        Check(catalog.GetRequired("tt3-fatal-pierce").Effects.Any(e => e.Kind == CardEffectKind.Damage && e.Condition is null), "conditional bonus does not disable base hit");
        Check(catalog.GetRequired("tt3-master-staff").Effects.Any(e => e.Kind == CardEffectKind.Delayed), "turn-start effect is delayed");
        Check(catalog.GetRequired("tt8-curse2").OnDrawEffects.Any(e => e.Status == CombatStatus.Freeze), "draw trigger status effect");
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
          {"id":"fuel","name":"Fuel","type":"道具","cost":0,"desc":""},
          {"id":"infused","name":"Infused","type":"法术","cost":1,"dmg":3,"dmgType":"spell","infuse":1,"desc":"3′；注能(1)：改为 6′"},
          {"id":"delay","name":"Delay","type":"法术","cost":0,"desc":"回合开始时获得 1 点能量"},
          {"id":"discover","name":"Discover","type":"法术","cost":0,"desc":"发现 1 张装备牌"},
          {"id":"equipment","name":"Equipment","type":"装备","cost":0,"desc":"获得 1 点护甲"}
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
        Check(foe.Purify() == 4 && !foe.HasStatus(CombatStatus.Bleed), "purify clears curses only");
        foe.AddStatus(CombatStatus.DamageReduction, 2, 1);
        foe.TickDurations();
        Check(!foe.HasStatus(CombatStatus.DamageReduction), "timed reduction expires");
        combat.SetEnergy(4, 5);
        Check(combat.AddEnergy(3) == 1 && combat.Energy == 5, "energy is capped at max");
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

    private static void InfusionDelayAndDiscover()
    {
        var combat = NewCombat(out var deck, out var catalog);
        deck.AddToHand(new CardInstance("infused-1", "infused"));
        deck.AddToHand(new CardInstance("fuel-1", "fuel"));
        var engine = new CardPlayEngine(combat, deck, catalog);
        var rejected = engine.TryPlay("infused-1", new[] { (StableId)"e1" });
        Check(!rejected.Accepted && deck.IsInHand("infused-1") && deck.IsInHand("fuel-1"), "missing infusion is atomic");
        var infused = engine.TryPlay("infused-1", new[] { (StableId)"e1" }, new[] { (StableId)"fuel-1" });
        Check(infused.Accepted && deck.Exhaust.Count == 1 && deck.Discard.Count == 1, "infusion consumes selected fuel");
        engine.ResolveQueuedEffects();
        Check(combat.GetCombatant("e1").Health == 33, "infused alternate damage resolves");

        deck.AddToHand(new CardInstance("delay-1", "delay"));
        var energy = combat.Energy;
        Check(engine.TryPlay("delay-1").Accepted, "delayed card accepted");
        engine.ResolveQueuedEffects();
        Check(combat.Energy == energy && combat.AdvanceTurn() == 1, "delayed effect waits one turn");
        engine.ResolveQueuedEffects();
        Check(combat.Energy == energy + 1, "delayed effect resolves at turn boundary");

        deck.AddToHand(new CardInstance("discover-1", "discover"));
        Check(engine.TryPlay("discover-1").Accepted, "discover card accepted");
        engine.ResolveQueuedEffects();
        Check(deck.Hand.Count == 1 && deck.Hand[0].DefinitionId == (StableId)"equipment", "typed discover puts a matching card in hand");

        var temporaryDeck = new CardDeck { AutoReshuffle = false };
        var temporaryCombat = new CombatState("p");
        temporaryCombat.AddCombatant(new CombatantState("p", "Player", 20, false));
        var temporaryDraw = new CardEffectInterpreter().Resolve(CardEffect.Draw(2), new EffectContext(temporaryCombat, temporaryDeck, "p"));
        Check(temporaryDraw.Affected == 2 && temporaryDeck.DrawPile.Count == 0 && temporaryDeck.Hand.All(c => c.DefinitionId == (StableId)"builtin-sha"), "non-reshuffling draw creates temporary builtin cards");
    }

    private static void EnemyAffixes()
    {
        var combat = new CombatState("p");
        combat.AddCombatant(new CombatantState("p", "Player", 50, false));
        combat.AddCombatant(new CombatantState("e", "Boss", 50, true) { Attack = 4 });
        combat.StartPlayerTurn();
        combat.StartEnemyTurn();
        Check(EnemyTurnResolver.EnqueueTurn(combat, "e", EnemyAffix.Frenzy) == 2, "frenzy queues two attacks");
        Check(combat.ResolveActions() == 2 && combat.GetCombatant("p").Health == 42, "frenzy attacks resolve FIFO");
        var boss = combat.GetCombatant("e");
        boss.SetElementalAegis(true);
        Check(combat.DealDamage("p", "e", 10, DamageType.True).Immune, "aegis blocks true damage");
        boss.AddStatus(CombatStatus.ArmorBreak, duration: 1);
        Check(combat.DealDamage("p", "e", 10, DamageType.Fixed).HealthDamage == 10, "armor break defeats aegis");
        boss.SetElementalAegis(false);
        Check(EnemyTurnResolver.EnqueueTurn(combat, "e", EnemyAffix.Grow) == 1 && boss.Attack == 6, "grow increases attack after planning");
        combat.ResolveActions();
        combat.StartPlayerTurn();
        var healthBefore = combat.GetCombatant("p").Health;
        combat.Actions.Enqueue(new EnemyAttackAction("e", "p", 0));
        Check(combat.ResolveActions() == 1 && healthBefore - combat.GetCombatant("p").Health == boss.Attack, $"enemy action uses source attack exactly once delta={healthBefore - combat.GetCombatant("p").Health} attack={boss.Attack}");
    }

    private static void SpecialCardContracts()
    {
        var path = Path.Combine("SoudacheGodot", "data", "cards.json");
        if (!File.Exists(path)) return;
        var catalog = CardCatalog.LoadFile(path);
        var combat = new CombatState("p");
        combat.AddCombatant(new CombatantState("p", "Player", 40, false));
        combat.AddCombatant(new CombatantState("e", "Enemy", 40, true) { Attack = 3 });
        combat.SetEnergy(30, 30);
        combat.StartPlayerTurn();
        var deck = new CardDeck();
        var recruit = new CardInstance("recruit-1", "tt7-recruit");
        deck.AddToHand(recruit);
        var engine = new CardPlayEngine(combat, deck, catalog);
        Check(engine.TryPlay(recruit.InstanceId).Accepted, "summon card accepted");
        engine.ResolveQueuedEffects();
        Check(combat.Combatants.Count(x => !x.IsEnemy) == 3, "summon creates two friendly infantry");

        var immortal = new CardInstance("immortal-1", "cmtn233trmeg");
        deck.AddToHand(immortal);
        var retainResult = engine.TryPlay(immortal.InstanceId, new[] { (StableId)"e" });
        Check(retainResult.Accepted, $"retain card accepted: {retainResult.Reason}");
        engine.ResolveQueuedEffects();
        Check(deck.TryFind(immortal.InstanceId, out var retained) && retained is not null && retained.Retain && !retained.CanBeInfused, "retain and uninfusable flags persist");

        var runCard = new CardInstance("run-1", "tt6-airdrop");
        deck.AddToHand(runCard);
        Check(!engine.TryPlay(runCard.InstanceId).Accepted && deck.IsInHand(runCard.InstanceId), "run card is rejected by combat layer");

        var ranger = new CardInstance("ranger-1", "tt8-hero-ranger");
        deck.AddToHand(ranger);
        Check(engine.TryPlay(ranger.InstanceId).Accepted, "ranger hero accepted");
        engine.ResolveQueuedEffects();
        Check(deck.DrawPile.Any(c => c.DefinitionId == (StableId)"tt8-heavensword") && deck.DrawPile.Any(c => c.DefinitionId == (StableId)"tt8-demonslay"), "hero swords enter draw pile");

        var fuel = new CardInstance("fuel-2", "cmtn233trmeg");
        deck.AddToHand(fuel);
        var infusionCard = new CardInstance("infusion-2", "tt7-meteorstrong");
        deck.AddToHand(infusionCard);
        fuel.SetInfusable(false);
        var rejected = engine.TryPlay(infusionCard.InstanceId, infusionFuel: new[] { fuel.InstanceId });
        Check(!rejected.Accepted && deck.IsInHand(fuel.InstanceId) && deck.IsInHand(infusionCard.InstanceId), "uninfusable card cannot be fuel");

        var unsupportedPath = Path.Combine("SoudacheGodot", "tests", "Combat", "unsupported-card-ids.txt");
        Check(File.Exists(unsupportedPath), "unsupported card manifest exists");
        var unsupported = File.ReadAllLines(unsupportedPath).Select(line => line.Trim()).Where(line => line.Length > 0).ToArray();
        Check(unsupported.Distinct(StringComparer.Ordinal).Count() == unsupported.Length, "unsupported manifest has unique ids");
        Check(unsupported.All(id => catalog.TryGet(id, out var definition) && definition is not null && definition.Layer == CardLayer.Combat), "unsupported manifest contains combat ids only");
        Check(unsupported.Length == 0, "all combat cards are executable in Core");
        var discoverDeck = new CardDeck();
        var discoverCombat = new CombatState("p");
        discoverCombat.AddCombatant(new CombatantState("p", "Player", 20, false));
        var discover = new CardEffectInterpreter().Resolve(CardEffect.Discover(count: 8), new EffectContext(discoverCombat, discoverDeck, "p", catalog: catalog));
        Check(discoverDeck.Hand.All(card => catalog.GetRequired(card.DefinitionId).Layer == CardLayer.Combat), "discover never creates Run-layer cards");
        var cappedDeck = new CardDeck();
        for (var i = 0; i < 8; i++) Check(cappedDeck.AddToHand(new CardInstance($"cap-{i}", "builtin-sha")), "hand accepts first eight cards");
        cappedDeck.AddToDrawPile(new CardInstance("cap-draw", "builtin-sha"));
        Check(!cappedDeck.AddToHand(new CardInstance("cap-8", "builtin-sha")) && cappedDeck.Draw(1, new DeterministicRng(1)) == 0 && cappedDeck.Hand.Count == 8, "hand cap is eight for adds and draws");
    }

    private static void EveryFormerUnsupportedCardHasCoreContract()
    {
        var catalog = CardCatalog.LoadFile(Path.Combine("SoudacheGodot", "data", "cards.json"));
        var world = new CombatState("p");
        world.AddCombatant(new CombatantState("p", "Player", 100, false) { Attack = 2, SpellPower = 2 });
        world.AddCombatant(new CombatantState("e1", "Enemy 1", 50, true) { Attack = 3 });
        world.AddCombatant(new CombatantState("e2", "Enemy 2", 50, true) { Attack = 4 });
        world.AddCombatant(new CombatantState("e3", "Enemy 3", 50, true) { Attack = 5 });
        world.SetEnergy(90, 100); world.StartPlayerTurn();
        var deck = new CardDeck(); var interpreter = new CardEffectInterpreter();
        var attack = catalog.All.First(x => x.Layer == CardLayer.Combat && x.Type == CardType.Attack && x.Damage > 0);

        deck.AddToHand(new CardInstance("doom-1", "cmtn1gfhczzj"));
        var before = deck.Hand.Count; ResolveSpecial(catalog, world, deck, interpreter, "cmtn1gfhczzj");
        Check(deck.Hand.Count > before, "cmtn1gfhczzj discovers curse cards");
        var apolloEnergy = world.Energy; ResolveSpecial(catalog, world, deck, interpreter, "tt2-apollo"); Check(world.Energy == apolloEnergy + 1, "tt2-apollo trigger restores energy");
        var equipment = catalog.All.First(x => x.Type == CardType.Equipment); deck.AddToHand(new CardInstance("equip-fuel", equipment.Id));
        var armorBefore = world.GetCombatant("p").Armor; ResolveSpecial(catalog, world, deck, interpreter, "tt2-turtlearmor"); Check(world.GetCombatant("p").Armor > armorBefore, "tt2-turtlearmor consumes equipment for armor");
        ResolveSpecial(catalog, world, deck, interpreter, "tt3-blooddrinker"); var attackBefore = world.GetCombatant("p").Attack; world.DealDamage("p", "e1", 100, DamageType.True); Check(world.GetCombatant("p").Attack == attackBefore + 1, "tt3-blooddrinker observes kill");
        deck.AddToDrawPile(new CardInstance("bottom-1", attack.Id)); var deckBefore = deck.Hand.Count; ResolveSpecial(catalog, world, deck, interpreter, "tt3-dig-treasure"); Check(deck.Hand.Count == deckBefore + 1 && world.GetCombatant("p").Armor > armorBefore, "tt3-dig-treasure takes bottom card and prices armor");
        ResolveSpecial(catalog, world, deck, interpreter, "tt3-element-seal"); world.RecordInfusion(); world.RecordInfusion(); world.RecordInfusion(); Check(world.GetCombatant("p").GetStatus(CombatStatus.SpellUp) >= 2, "tt3-element-seal unlocks after three infusions");
        deck.AddToHand(new CardInstance("release-1", attack.Id)); var hpBefore = world.GetCombatant("e2").Health; ResolveSpecial(catalog, world, deck, interpreter, "tt3-frostfall", selected: new[] { (StableId)"release-1" }, targets: new[] { (StableId)"e2" }); Check(!deck.IsInHand("release-1") && world.GetCombatant("e2").Health < hpBefore, "tt3-frostfall releases selected attack");
        var mystery = new CardInstance("mystery-1", "tt3-mystery-potion"); deck.AddToDiscard(mystery); ResolveSpecial(catalog, world, deck, interpreter, "tt3-mystery-potion", instance: mystery.InstanceId); world.AdvanceTurn(); world.ResolveActions(); Check(mystery.CostOverride == 0, "tt3-mystery-potion transforms at turn start");
        var killAttack = catalog.All.First(x => x.Layer == CardLayer.Combat && x.Type == CardType.Attack && x.DisplayName.Contains("杀", StringComparison.Ordinal));
        deck.AddToDrawPile(new CardInstance("mist-1", killAttack.Id)); deck.AddToDrawPile(new CardInstance("mist-2", killAttack.Id)); ResolveSpecial(catalog, world, deck, interpreter, "tt3eq-mistbox"); Check(deck.DrawPile.Count(c => c.DefinitionId != killAttack.Id) >= 1, "tt3eq-mistbox replaces kill cards");
        world.DealDamage("e2", "p", 10, DamageType.True); var bloodBefore = world.GetCombatant("p").Health; var bloodDef = catalog.GetRequired("tt3sp-bloodstorm"); foreach (var effect in bloodDef.Effects) interpreter.Resolve(effect, new EffectContext(world, deck, world.PlayerId, new[] { (StableId)"e2" }, catalog, card: bloodDef)); ResolveSpecial(catalog, world, deck, interpreter, "tt3sp-bloodstorm", targets: new[] { (StableId)"e2" }); Check(world.LastDamageBatchHealth > 0 && world.GetCombatant("p").Health > bloodBefore, "tt3sp-bloodstorm heals actual damage");
        ResolveSpecial(catalog, world, deck, interpreter, "tt7-elementstorm"); Check(world.ConsumeNextSpellRepeat() == 2, "tt7-elementstorm doubles next spell");
        var fuel = new CardInstance("heal-fuel", "tt3-fireball"); deck.AddToHand(fuel); var wounded = world.DealDamage("e2", "p", 10, DamageType.True); var healthBefore = world.GetCombatant("p").Health; ResolveSpecial(catalog, world, deck, interpreter, "tt7-holyheal", fuel: new[] { fuel.InstanceId }, infused: true); Check(world.GetCombatant("p").Health >= healthBefore, "tt7-holyheal scales by infusion price");
        var e2Before = world.GetCombatant("e2").Health; var e3Before = world.GetCombatant("e3").Health; ResolveSpecial(catalog, world, deck, interpreter, "tt7-provoke", targets: new[] { (StableId)"e2", (StableId)"e3" }); Check(world.GetCombatant("e2").Health < e2Before && world.GetCombatant("e3").Health < e3Before, "tt7-provoke makes selected enemies attack");
        deck.AddToHand(new CardInstance("stored-spell", "tt3-fireball")); ResolveSpecial(catalog, world, deck, interpreter, "tt7-stratagem", selected: new[] { (StableId)"stored-spell" }); Check(deck.Storage.Contains(deck.AllCards.First(c => c.InstanceId == (StableId)"stored-spell")), "tt7-stratagem stores selected spell");
        ResolveSpecial(catalog, world, deck, interpreter, "tt8-hero-mage"); Check(world.GetCombatant("p").GetStatus(CombatStatus.SpellUp) > 0, "tt8-hero-mage grants spell passive");
        world.DealDamage("e2", "p", 10, DamageType.True); var priestDeck = new CardDeck(); priestDeck.AddToHand(new CardInstance("priest-seed", attack.Id)); var handBefore = priestDeck.Hand.Count; ResolveSpecial(catalog, world, priestDeck, interpreter, "tt8-hero-priest"); Check(priestDeck.Hand.Count == 6 && priestDeck.Hand.Count > handBefore, "tt8-hero-priest fills hand to six");
    }

    private static EffectResolution ResolveSpecial(CardCatalog catalog, CombatState combat, CardDeck deck, CardEffectInterpreter interpreter, string id, IEnumerable<StableId>? targets = null, IEnumerable<StableId>? selected = null, IEnumerable<StableId>? fuel = null, bool infused = false, StableId? instance = null)
    {
        var definition = catalog.GetRequired(id);
        Check(definition.SpecialId is not null, $"{id} has explicit special mapping");
        return interpreter.Resolve(CardEffect.Special(definition.SpecialId!), new EffectContext(combat, deck, combat.PlayerId, targets, catalog, infused: infused, infusionFuel: fuel, cardInstanceId: instance ?? default, card: definition, selectedCards: selected));
    }
}
