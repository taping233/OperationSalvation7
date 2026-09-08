using System;
using System.Linq;

namespace Soudache;

/// <summary>Explicit handlers for battle-only card mechanics that are not scalar effects.</summary>
public static class SpecialCardHandler
{
    public static EffectResolution Resolve(string specialId, EffectContext context, CardEffectInterpreter interpreter)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(specialId);
        ArgumentNullException.ThrowIfNull(context);
        return specialId switch
        {
            "copy.random-hand-at-turn-start" => CopyHand(context, random: true),
            "copy.selected-hand" => CopyHand(context, random: false),
            "discover.infusion-free" => DiscoverInfusionFree(context),
            "retain.uninfusable" => RetainCard(context),
            "discover.curse-cards" => DiscoverCurseCards(context),
            "previous.attack-zero" => Ok(1),
            "discover.trigger-apollo" => ApolloTrigger(context),
            "storage.three-slots" => StorePouch(context),
            "consume.equipment-armor" => ConsumeEquipmentArmor(context),
            "summon.infantry" => SummonInfantry(context, specialId),
            "trigger.kill-attack" => AddOnKillAttack(context),
            "combat.start-max-health" => StartMaxHealth(context),
            "potion.mix" => Discover(context, 2),
            "potion.copy-mixed" => CopyMixedPotion(context, interpreter),
            "discover.deck-bottom-price-armor" => DiscoverBottomWithPriceArmor(context),
            "turn.extra" => ExtraTurn(context),
            "transform.random-melee-zero" => TransformMelee(context),
            "release.hand-arrows" => ReleaseArrows(context, interpreter),
            "damage.grave-spell-count" => GraveSpellDamage(context),
            "discover.consume-up-to-two" => ConsumeThenDiscover(context),
            "kill.attack-at-most-four" => KillByAttack(context, 4, 1),
            "kill.two-attack-at-most-five" => KillByAttack(context, 5, 2),
            "steal.attack-to-one" => StealAttack(context),
            "lower.attack-two" => LowerAttack(context),
            "repeat.last-hand" => context.WasLastHandCard ? RepeatCard(context, interpreter) : new(CardEffectKind.Special, 0, 0, false),
            "grant.fireball-two" => GrantById(context, "tt3-fireball", 2),
            "grant.fireball-three" => context.Infused ? GrantById(context, "tt3-fireball", 3) : Fail(),
            "copy.light-shadow-to-deck" => CopyToDeck(context, "cmtn0pbkmnvc"),
            "delayed.four-shots" => DelayedShots(context),
            "grant.random-arrow" => GrantArrow(context),
            "infusion.unlock-element-seal" => UnlockElementSeal(context),
            "release.selected-attack" => ReleaseSelectedAttack(context, interpreter),
            "trigger.spell-energy" => RegisterSpellEnergy(context),
            "transform.mystery-delayed" => ScheduleMysteryTransform(context),
            "transform.mystery-now" => MysteryTransformNow(context),
            "lifesteal.last-damage" => Lifesteal(context),
            "spell.next-double" => NextSpellDouble(context),
            "heal.infusion-price" => HealByInfusionPrice(context),
            "enemies.mutual-attack" => MutualAttack(context),
            "draw.attack-all-and-cover-weapons" => DrawAttackAll(context),
            "combat.energy-cap-plus-one" => EnergyCap(context),
            "hero.mage-passive" => HeroMage(context),
            "hand.fill-spell-heal" => FillHand(context),
            "draw-five-cast-melee" => DrawAndCastMelee(context, interpreter),
            "grant.curses-and-draw" => GrantCursesAndDraw(context),
            "transform.kill-to-dragonblade" => TransformKillCards(context),
            "grant.swords-to-deck" => GrantSwordsToDeck(context),
            "door.random-curse" => RandomCurse(context),
            "door.random-blessing" => RandomBlessing(context),
            "transform.start-kill-to-random" => TransformStartKill(context),
            "choice.magic-lamp" => MagicLamp(context),
            "choice.delayed-door" => DelayedDoor(context),
            "storage.spell-slot" => StoreSpell(context, interpreter),
            _ => new(CardEffectKind.Special, 0, 0, false)
        };
    }

    private static EffectResolution CopyHand(EffectContext context, bool random)
    {
        if (context.Deck is null || context.Catalog is null) return Fail();
        var candidates = context.Deck.Hand.Where(c => c.InstanceId != context.CardInstanceId).ToArray();
        var source = candidates.Length == 0 ? null : candidates[random ? context.Combat.Rng.NextInt(candidates.Length) : 0];
        if (source is null || !context.Catalog.TryGet(source.DefinitionId, out var definition) || definition is null) return Fail();
        var copy = new CardInstance($"copy.{definition.Id.Value}.{context.Combat.NextGeneratedId()}", definition.Id, costOverride: source.CostOverride);
        context.Deck.AddToHand(copy);
        return Ok(1);
    }

    private static EffectResolution SummonInfantry(EffectContext context, string id)
    {
        var count = id == "summon.infantry" && context.Card?.Id.Value == "tt7-recruit" ? 2 : 1;
        for (var i = 0; i < count; i++)
        {
            var summon = new CombatantState($"summon.infantry.{context.Combat.NextGeneratedId()}", "步兵", 4, false) { Attack = 4 };
            context.Combat.AddCombatant(summon);
        }
        return Ok(count);
    }

    private static EffectResolution AddOnKillAttack(EffectContext context) { context.Combat.RegisterKillAttackBonus(context.SourceId); return Ok(1); }
    private static EffectResolution StartMaxHealth(EffectContext context) { context.Combat.GetCombatant(context.SourceId).IncreaseMaxHealth(10); return Ok(10); }
    private static EffectResolution ExtraTurn(EffectContext context) { context.Combat.GrantExtraTurn(); return Ok(1); }

    private static EffectResolution TransformMelee(EffectContext context)
        => context.Deck is null || context.Catalog is null ? Fail() : GrantByType(context, CardType.Attack, 1, cost: 0);

    private static EffectResolution ReleaseArrows(EffectContext context, CardEffectInterpreter interpreter)
    {
        if (context.Deck is null || context.Catalog is null) return Fail();
        var released = 0;
        foreach (var card in context.Deck.Hand.ToArray())
        {
            if (card.InstanceId == context.CardInstanceId || !context.Catalog.TryGet(card.DefinitionId, out var definition) || definition is null || !definition.Description.Contains("箭", StringComparison.Ordinal)) continue;
            context.Deck.Move(card.InstanceId, CardZone.Discard);
            foreach (var effect in definition.Effects)
                interpreter.Resolve(effect, new EffectContext(context.Combat, context.Deck, context.SourceId, context.Targets, context.Catalog, sourceClass: context.SourceClass, card: definition, cardInstanceId: card.InstanceId));
            context.Deck.Draw(1, context.Combat.Rng);
            released++;
        }
        return Ok(released);
    }

    private static EffectResolution GraveSpellDamage(EffectContext context)
    {
        if (context.Deck is null) return Fail();
        var count = context.Deck.Exhaust.Count(c => context.Catalog?.TryGet(c.DefinitionId, out var d) == true && d!.Type == CardType.Skill);
        var total = 0;
        foreach (var target in context.Targets) total += context.Combat.DealDamage(context.SourceId, target, count, DamageType.Spell).HealthDamage;
        return Ok(total);
    }

    private static EffectResolution Discover(EffectContext context, int count)
    {
        if (context.Catalog is null || context.Deck is null || count <= 0) return Fail();
        var found = 0;
        foreach (var definition in context.Catalog.All.Where(x => x.Layer == CardLayer.Combat).Take(count))
        { context.Deck.AddToHand(new CardInstance($"special.{definition.Id.Value}.{context.Combat.NextGeneratedId()}", definition.Id)); found++; }
        return Ok(found);
    }

    private static EffectResolution DiscoverInfusionFree(EffectContext context)
    {
        if (context.Catalog is null || context.Deck is null) return Fail();
        var definition = context.Catalog.All.FirstOrDefault(x => x.Layer == CardLayer.Combat && x.InfuseCount > 0);
        if (definition is null) return Fail();
        var card = new CardInstance($"discover.free.{definition.Id.Value}.{context.Combat.NextGeneratedId()}", definition.Id);
        card.SetInfusable(false);
        context.Deck.AddToHand(card);
        return Ok(1);
    }

    private static EffectResolution DiscoverBottomWithPriceArmor(EffectContext context)
    {
        if (context.Catalog is null || context.Deck is null) return Fail();
        var bottom = context.Deck.DrawPile.FirstOrDefault();
        if (bottom is null || !context.Catalog.TryGet(bottom.DefinitionId, out var definition) || definition is null) return Fail();
        context.Deck.Move(bottom.InstanceId, CardZone.Hand);
        context.Combat.AddArmor(context.SourceId, definition.Cost);
        return Ok(1);
    }

    private static EffectResolution ConsumeThenDiscover(EffectContext context)
    {
        if (context.Deck is null) return Fail();
        var count = Math.Min(2, context.Deck.Hand.Count);
        context.Deck.MoveFirstFromHand(CardZone.Exhaust, count);
        return Discover(context, count);
    }

    private static EffectResolution RetainCard(EffectContext context)
    {
        if (context.Deck is null || !context.Deck.TryFind(context.CardInstanceId, out var card) || card is null) return Fail();
        card.SetRetention();
        card.SetInfusable(false);
        return Ok(1);
    }

    private static EffectResolution DiscoverCurseCards(EffectContext context)
    {
        if (context.Catalog is null || context.Deck is null) return Fail();
        var candidates = context.Catalog.All.Where(x => x.Layer == CardLayer.Combat && x.Description.Contains("诅咒", StringComparison.Ordinal)).Take(2).ToArray();
        foreach (var definition in candidates)
            context.Deck.AddToHand(new CardInstance($"discover.curse.{definition.Id.Value}.{context.Combat.NextGeneratedId()}", definition.Id));
        return Ok(candidates.Length);
    }

    private static EffectResolution CopyMixedPotion(EffectContext context, CardEffectInterpreter interpreter)
    {
        if (context.Deck is null || context.Catalog is null) return Fail();
        var source = context.SelectedCards.Select(id => context.Deck.FindInHand(id)).FirstOrDefault(x => x is not null && x.InstanceId != context.CardInstanceId && context.Catalog.TryGet(x.DefinitionId, out var d) && d is not null && d.Description.Contains("混合", StringComparison.Ordinal))
            ?? context.Deck.Hand.FirstOrDefault(x => context.Catalog.TryGet(x.DefinitionId, out var d) && d is not null && d.Description.Contains("混合", StringComparison.Ordinal));
        if (source is null || !context.Catalog.TryGet(source.DefinitionId, out var definition) || definition is null) return Fail();
        foreach (var effect in definition.Effects) interpreter.Resolve(effect, new EffectContext(context.Combat, context.Deck, context.SourceId, context.Targets, context.Catalog, card: definition, cardInstanceId: source.InstanceId));
        return Ok(1);
    }

    private static EffectResolution ApolloTrigger(EffectContext context)
    {
        context.Combat.AddEnergy(1);
        return Discover(context, 1);
    }

    private static EffectResolution StorePouch(EffectContext context)
    {
        if (context.Deck is null) return Fail();
        context.Deck.SetStorageCapacity(Math.Max(3, context.Deck.StorageCapacity));
        return Ok(3);
    }

    private static EffectResolution ConsumeEquipmentArmor(EffectContext context)
    {
        if (context.Deck is null || context.Catalog is null) return Fail();
        var equipment = context.SelectedCards.Select(id => context.Deck.FindInHand(id)).FirstOrDefault(card => card is not null && context.Catalog.TryGet(card.DefinitionId, out var d) && d is not null && d.Type == CardType.Equipment)
            ?? context.Deck.Hand.FirstOrDefault(card => context.Catalog.TryGet(card.DefinitionId, out var d) && d is not null && d.Type == CardType.Equipment);
        if (equipment is null || !context.Deck.Move(equipment.InstanceId, CardZone.Exhaust)) return Fail();
        context.Combat.AddArmor(context.SourceId, context.Card?.Armor ?? 0);
        return Ok(1);
    }

    private static EffectResolution KillByAttack(EffectContext context, int maxAttack, int count)
    {
        var killed = 0;
        foreach (var targetId in context.Targets)
        {
            if (killed >= count || !context.Combat.TryGetCombatant(targetId, out var target) || target is null || !target.IsEnemy || target.IsDefeated || target.Attack > maxAttack) continue;
            target.Defeat(); killed++;
        }
        context.Combat.UpdateOutcome();
        return Ok(killed);
    }

    private static EffectResolution StealAttack(EffectContext context)
    {
        var target = context.Targets.Select(context.Combat.GetCombatant).FirstOrDefault(x => x.IsEnemy && !x.IsDefeated);
        if (target is null) return Fail();
        var stolen = Math.Max(0, target.Attack - 1); target.Attack = 1;
        context.Combat.GetCombatant(context.SourceId).Attack = checked(context.Combat.GetCombatant(context.SourceId).Attack + stolen);
        return Ok(stolen);
    }

    private static EffectResolution LowerAttack(EffectContext context)
    {
        var target = context.Targets.Select(id => context.Combat.GetCombatant(id)).FirstOrDefault(x => x.IsEnemy && !x.IsDefeated);
        if (target is null) return Fail(); target.Attack = Math.Max(0, target.Attack - 2); return Ok(2);
    }

    private static EffectResolution RepeatCard(EffectContext context, CardEffectInterpreter interpreter)
    {
        if (context.Card is null) return Fail();
        var applied = 0;
        foreach (var effect in context.Card.Effects) if (interpreter.Resolve(effect, context).Applied) applied++;
        return Ok(applied);
    }

    private static EffectResolution GrantById(EffectContext context, string id, int count)
    {
        if (context.Catalog is null || context.Deck is null || !context.Catalog.TryGet(id, out var definition) || definition is null) return Fail();
        for (var i = 0; i < count; i++) context.Deck.AddToHand(new CardInstance($"grant.{id}.{context.Combat.NextGeneratedId()}", id));
        return Ok(count);
    }

    private static EffectResolution CopyToDeck(EffectContext context, string id)
    {
        if (context.Catalog is null || context.Deck is null || !context.Catalog.TryGet(id, out var definition) || definition is null) return Fail();
        context.Deck.AddToDrawPile(new CardInstance($"copy.deck.{id}.{context.Combat.NextGeneratedId()}", id));
        return Ok(1);
    }

    private static EffectResolution DelayedShots(EffectContext context)
    {
        var shot = CardEffect.Damage(2, DamageType.Fixed, EffectTarget.SelectedEnemy);
        context.Combat.ScheduleEffect(1, new CardEffectAction(CardEffect.Repeat(4, shot), context));
        return Ok(4);
    }

    private static EffectResolution GrantArrow(EffectContext context)
    {
        if (context.Catalog is null || context.Deck is null) return Fail();
        var arrow = context.Catalog.All.FirstOrDefault(x => x.Layer == CardLayer.Combat && x.Description.Contains("箭", StringComparison.Ordinal));
        if (arrow is null) return Fail();
        context.Deck.AddToHand(new CardInstance($"arrow.{arrow.Id.Value}.{context.Combat.NextGeneratedId()}", arrow.Id, costOverride: 0));
        return Ok(1);
    }

    private static EffectResolution UnlockElementSeal(EffectContext context)
    {
        context.Combat.RegisterInfusionReward(context.SourceId);
        return Ok(1);
    }

    private static EffectResolution ReleaseSelectedAttack(EffectContext context, CardEffectInterpreter interpreter)
    {
        if (context.Deck is null || context.Catalog is null) return Fail();
        var card = context.SelectedCards.Select(id => context.Deck.FindInHand(id)).FirstOrDefault(x => x is not null && context.Catalog.TryGet(x.DefinitionId, out var d) && d is not null && d.Type == CardType.Attack)
            ?? context.Deck.Hand.FirstOrDefault(x => context.Catalog.TryGet(x.DefinitionId, out var d) && d is not null && d.Type == CardType.Attack);
        if (card is null || !context.Deck.Move(card.InstanceId, CardZone.Discard) || !context.Catalog.TryGet(card.DefinitionId, out var definition) || definition is null) return Fail();
        foreach (var effect in definition.Effects)
            interpreter.Resolve(effect, new EffectContext(context.Combat, context.Deck, context.SourceId, context.Targets, context.Catalog, card: definition, cardInstanceId: card.InstanceId));
        return Ok(1);
    }

    private static EffectResolution RegisterSpellEnergy(EffectContext context)
    {
        context.Combat.RegisterSpellCastEnergy(1);
        return Ok(1);
    }

    private static EffectResolution ScheduleMysteryTransform(EffectContext context)
    {
        context.Combat.ScheduleEffect(1, new CardEffectAction(CardEffect.Special("transform.mystery-now"), context));
        return Ok(1);
    }

    private static EffectResolution MysteryTransformNow(EffectContext context)
    {
        if (context.Deck is null || context.Catalog is null || !context.Deck.TryFind(context.CardInstanceId, out var card) || card is null) return Fail();
        var skill = context.Catalog.All.Where(x => x.Layer == CardLayer.Combat && x.Type == CardType.Skill).ToArray();
        if (skill.Length == 0) return Fail();
        card.Transform(skill[context.Combat.Rng.NextInt(skill.Length)].Id, 0);
        return Ok(1);
    }

    private static EffectResolution Lifesteal(EffectContext context)
    {
        var healed = context.Combat.RestoreHealth(context.SourceId, context.Combat.LastDamageBatchHealth);
        return new(CardEffectKind.Special, healed, healed, healed > 0);
    }

    private static EffectResolution NextSpellDouble(EffectContext context)
    {
        context.Combat.SetNextSpellRepeat(2);
        return Ok(2);
    }

    private static EffectResolution HealByInfusionPrice(EffectContext context)
    {
        if (context.Deck is null || context.Catalog is null || context.InfusionFuel.Count == 0) return Fail();
        var price = 0;
        foreach (var id in context.InfusionFuel)
            if (context.Deck.TryFind(id, out var card) && card is not null && context.Catalog.TryGet(card.DefinitionId, out var definition) && definition is not null)
                price += card.EffectiveCost(definition);
        var healed = context.Combat.RestoreHealth(context.SourceId, price * 2);
        return new(CardEffectKind.Special, healed, healed, healed > 0);
    }

    private static EffectResolution MutualAttack(EffectContext context)
    {
        if (context.Targets.Count < 2) return Fail();
        var first = context.Combat.GetCombatant(context.Targets[0]);
        var second = context.Combat.GetCombatant(context.Targets[1]);
        if (!first.IsEnemy || !second.IsEnemy || first.IsDefeated || second.IsDefeated) return Fail();
        context.Combat.DealDamage(first.Id, second.Id, first.Attack, DamageType.Attack);
        context.Combat.DealDamage(second.Id, first.Id, second.Attack, DamageType.Attack);
        return Ok(2);
    }

    private static EffectResolution HeroMage(EffectContext context)
    {
        context.Combat.GetCombatant(context.SourceId).AddStatus(CombatStatus.SpellUp, 1);
        context.Combat.ScheduleEffect(1, new CardEffectAction(CardEffect.Discover(count: 1), context));
        return Ok(1);
    }

    private static EffectResolution GrantByType(EffectContext context, CardType type, int count, int cost)
    {
        var definition = context.Catalog?.All.FirstOrDefault(x => x.Type == type && x.Layer == CardLayer.Combat);
        if (definition is null || context.Deck is null) return Fail();
        for (var i = 0; i < count; i++) context.Deck.AddToHand(new CardInstance($"grant.{definition.Id.Value}.{context.Combat.NextGeneratedId()}", definition.Id, costOverride: cost));
        return Ok(count);
    }

    private static EffectResolution DrawAttackAll(EffectContext context)
    {
        foreach (var target in context.Combat.Combatants.Where(x => x.IsEnemy && !x.IsDefeated)) context.Combat.DealDamage(context.SourceId, target.Id, 0, DamageType.Attack);
        if (context.Card is not null) context.Combat.CoverWeapons(context.Card.Id);
        return Ok(1);
    }

    private static EffectResolution EnergyCap(EffectContext context) { context.Combat.IncreaseEnergyCap(1); return Ok(1); }

    private static EffectResolution FillHand(EffectContext context)
    {
        if (context.Deck is null || context.Catalog is null) return Fail();
        var missing = Math.Max(0, 6 - context.Deck.Hand.Count);
        var candidates = context.Catalog.All.Where(x => x.Layer == CardLayer.Combat && x.Type is not CardType.Resource and not CardType.Event).ToArray();
        var spells = 0;
        for (var i = 0; i < missing && candidates.Length > 0; i++)
        {
            var definition = candidates[context.Combat.Rng.NextInt(candidates.Length)];
            context.Deck.AddToHand(new CardInstance($"rain.{definition.Id.Value}.{context.Combat.NextGeneratedId()}", definition.Id));
            if (definition.Type == CardType.Skill) spells++;
        }
        if (spells > 0) context.Combat.RestoreHealth(context.SourceId, spells * 3);
        return Ok(missing);
    }

    private static EffectResolution DrawAndCastMelee(EffectContext context, CardEffectInterpreter interpreter)
    {
        if (context.Deck is null || context.Catalog is null) return Fail();
        context.Deck.Draw(5, context.Combat.Rng);
        var cast = 0;
        foreach (var card in context.Deck.Hand.ToArray())
        {
            if (!context.Catalog.TryGet(card.DefinitionId, out var definition) || definition is null || definition.Type != CardType.Attack) continue;
            context.Deck.Move(card.InstanceId, CardZone.Discard);
            foreach (var effect in definition.Effects) { interpreter.Resolve(effect, new EffectContext(context.Combat, context.Deck, context.SourceId, context.Targets, context.Catalog, card: definition, cardInstanceId: card.InstanceId)); cast++; }
        }
        return Ok(cast);
    }

    private static EffectResolution GrantCursesAndDraw(EffectContext context)
    {
        if (context.Deck is null) return Fail();
        var added = 0;
        foreach (var id in new[] { "tt8-curse1", "tt8-curse2", "tt8-curse3", "tt8-curse4" })
        {
            if (context.Catalog?.TryGet(id, out var definition) != true || definition is null) continue;
            context.Deck.AddToDrawPile(new CardInstance($"grant.{id}.{context.Combat.NextGeneratedId()}", id));
            added++;
        }
        var before = context.Deck.Hand.Count;
        var drawn = context.Deck.Draw(2, context.Combat.Rng);
        if (drawn > 0 && context.Catalog is not null)
            CardDrawTriggerResolver.Queue(context.Combat, context.Deck, context.Catalog, context.Deck.Hand.Skip(before).Select(c => c.InstanceId), context.Targets);
        return Ok(added + drawn);
    }

    private static EffectResolution TransformKillCards(EffectContext context)
    {
        if (context.Deck is null || context.Catalog is null || !context.Catalog.TryGet("tt8-dragonblade", out _)) return Fail();
        var changed = 0;
        foreach (var card in context.Deck.AllCards.ToArray())
        {
            if (!context.Catalog.TryGet(card.DefinitionId, out var definition) || definition is null || definition.Type != CardType.Attack) continue;
            if (!definition.DisplayName.Contains("杀", StringComparison.Ordinal) && !definition.DisplayName.Contains("斩", StringComparison.Ordinal)) continue;
            card.Transform("tt8-dragonblade");
            changed++;
        }
        return Ok(changed);
    }

    private static EffectResolution GrantSwordsToDeck(EffectContext context)
    {
        if (context.Deck is null || context.Catalog is null) return Fail();
        var added = 0;
        foreach (var id in new[] { "tt8-heavensword", "tt8-demonslay" })
            if (context.Catalog.TryGet(id, out var definition) && definition is not null)
            { context.Deck.AddToDrawPile(new CardInstance($"grant.{id}.{context.Combat.NextGeneratedId()}", id)); added++; }
        return Ok(added);
    }

    private static EffectResolution TransformStartKill(EffectContext context)
    {
        if (context.Deck is null || context.Catalog is null) return Fail();
        var candidates = context.Catalog.All.Where(x => x.Layer == CardLayer.Combat && x.Type is CardType.Attack or CardType.Skill).ToArray();
        if (candidates.Length == 0) return Fail();
        var changed = 0;
        foreach (var card in context.Deck.AllCards.ToArray())
        {
            if (!context.Catalog.TryGet(card.DefinitionId, out var definition) || definition is null || definition.Type != CardType.Attack || !definition.DisplayName.Contains("杀", StringComparison.Ordinal)) continue;
            var replacement = candidates[context.Combat.Rng.NextInt(candidates.Length)];
            card.Transform(replacement.Id, 0);
            changed++;
            if (changed >= 2) break;
        }
        return Ok(changed);
    }

    private static EffectResolution MagicLamp(EffectContext context)
    {
        // Choice UI can supply a future branch; the pure core uses the stable first branch.
        return Discover(context, 1);
    }

    private static EffectResolution DelayedDoor(EffectContext context)
    {
        context.Combat.ScheduleEffect(2, new CardEffectAction(CardEffect.Special("door.random-curse"), context));
        return Ok(1);
    }

    private static EffectResolution StoreSpell(EffectContext context, CardEffectInterpreter interpreter)
    {
        if (context.Catalog is null || context.Deck is null) return Fail();
        if (context.Deck.StorageCapacity < 3) context.Deck.SetStorageCapacity(3);
        var selected = context.SelectedCards.Select(id => context.Deck.FindInHand(id)).FirstOrDefault(card => card is not null && context.Catalog.TryGet(card.DefinitionId, out var selectedDefinition) && selectedDefinition is not null && selectedDefinition.Type == CardType.Skill);
        if (selected is not null && context.Deck.Store(selected.InstanceId) && context.Catalog.TryGet(selected.DefinitionId, out var storedDefinition) && storedDefinition is not null)
        {
            foreach (var effect in storedDefinition.Effects)
                interpreter.Resolve(effect, new EffectContext(context.Combat, context.Deck, context.SourceId, context.Targets, context.Catalog, card: storedDefinition, cardInstanceId: selected.InstanceId));
            return Ok(1);
        }
        var spell = context.Catalog.All.FirstOrDefault(x => x.Layer == CardLayer.Combat && x.Type == CardType.Skill);
        if (spell is null) return Fail();
        context.Deck.AddToHand(new CardInstance($"stored.{spell.Id.Value}.{context.Combat.NextGeneratedId()}", spell.Id));
        return Ok(1);
    }

    private static EffectResolution RandomCurse(EffectContext context)
    {
        var curses = new[] { CombatStatus.Bleed, CombatStatus.Poison, CombatStatus.Freeze, CombatStatus.Silence, CombatStatus.ArmorBreak, CombatStatus.HealingBan };
        var targetIds = context.Combat.Combatants.Where(x => x.IsEnemy && !x.IsDefeated).Select(x => x.Id);
        var applied = 0; foreach (var id in targetIds) { context.Combat.AddStatus(id, curses[context.Combat.Rng.NextInt(curses.Length)]); applied++; }
        return Ok(applied);
    }

    private static EffectResolution RandomBlessing(EffectContext context)
    {
        var blessing = context.Combat.Rng.NextInt(6);
        var affected = 0;
        foreach (var ally in context.Combat.Combatants.Where(x => !x.IsEnemy && !x.IsDefeated))
        {
            switch (blessing)
            {
                case 0: ally.AddStatus(CombatStatus.Stealth, 1, 1); break;
                case 1: ally.AddStatus(CombatStatus.AttackUp, 1); break;
                case 2: ally.AddStatus(CombatStatus.SpellUp, 1); break;
                case 3: ally.AddStatus(CombatStatus.DamageReduction, 1); break;
                case 4: ally.AddArmor(5); break;
                default: ally.Purify(); break;
            }
            affected++;
        }
        return Ok(affected);
    }
    private static EffectResolution Ok(int amount) => new(CardEffectKind.Special, amount, amount, amount > 0);
    private static EffectResolution Fail() => new(CardEffectKind.Special, 0, 0, false);
}
