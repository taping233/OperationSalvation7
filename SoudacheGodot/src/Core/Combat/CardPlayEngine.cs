using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

public readonly record struct CardPlayResult(bool Accepted, string Reason, int QueuedEffects)
{
    public static CardPlayResult Reject(string reason) => new(false, reason, 0);
}

/// <summary>Atomic, data-driven card play boundary for the pure combat model.</summary>
public sealed class CardPlayEngine
{
    private readonly CardCatalog _catalog;
    private readonly CardEffectInterpreter _interpreter;
    public CombatState Combat { get; }
    public CardDeck Deck { get; }

    public CardPlayEngine(CombatState combat, CardDeck deck, CardCatalog catalog, CardEffectInterpreter? interpreter = null)
    {
        Combat = combat ?? throw new ArgumentNullException(nameof(combat));
        Deck = deck ?? throw new ArgumentNullException(nameof(deck));
        _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        _interpreter = interpreter ?? new CardEffectInterpreter();
    }

    public CardPlayResult TryPlay(StableId instanceId, IEnumerable<StableId>? selectedTargets = null, IEnumerable<StableId>? infusionFuel = null, int choiceIndex = 1, IEnumerable<StableId>? selectedCards = null)
    {
        if (Combat.Phase != CombatPhase.PlayerTurn) return CardPlayResult.Reject("Cards can only be played during the player turn.");
        if (!Deck.TryFind(instanceId, out var card) || card is null || !Deck.IsInHand(instanceId))
            return CardPlayResult.Reject("The card is not in hand.");
        if (!_catalog.TryGet(card.DefinitionId, out var definition) || definition is null)
            return CardPlayResult.Reject("The card definition is missing.");
        if (definition.Layer != CardLayer.Combat) return CardPlayResult.Reject("This card is resolved by the Run layer.");
        var cost = card.EffectiveCost(definition);
        if (definition.SpecialId == "previous.attack-zero" && string.Equals(Combat.LastPlayedCardType, CardType.Attack.ToString(), StringComparison.Ordinal))
            cost = 0;
        if (cost > Combat.Energy) return CardPlayResult.Reject("Not enough energy.");

        var targets = (selectedTargets ?? Array.Empty<StableId>()).Distinct().ToArray();
        var fuel = (infusionFuel ?? Array.Empty<StableId>()).Distinct().ToArray();
        if (choiceIndex < 1) return CardPlayResult.Reject("Choice index must be positive.");
        var chosenCards = (selectedCards ?? Array.Empty<StableId>()).Distinct().ToArray();
        if (definition.InfuseCount != fuel.Length)
            return CardPlayResult.Reject(definition.InfuseCount > 0 ? $"Infusion requires {definition.InfuseCount} hand cards." : "This card does not accept infusion fuel.");
        foreach (var fuelId in fuel)
            if (fuelId == instanceId || !Deck.IsInHand(fuelId) || !Deck.TryFind(fuelId, out var fuelCard) || fuelCard is null || !fuelCard.CanBeInfused)
                return CardPlayResult.Reject("Every infusion fuel card must be a different infusable card in hand.");
        var effects = EffectiveEffects(definition);
        foreach (var effect in effects)
        {
            if (effect.Target != EffectTarget.SelectedEnemy && effect.Target != EffectTarget.SelectedAny) continue;
            if (targets.Length == 0) return CardPlayResult.Reject("A target is required.");
            if (!Combat.TryGetCombatant(targets[0], out var target) || target!.IsDefeated || (effect.Target == EffectTarget.SelectedEnemy && !target.IsEnemy))
                return CardPlayResult.Reject("The selected target is invalid.");
        }
        // All checks above are read-only. Only now commit energy, zone, and queued actions.
        if (!Combat.TrySpendEnergy(cost)) return CardPlayResult.Reject("Not enough energy.");
        var destination = definition.ExhaustOnPlay ? CardZone.Exhaust : CardZone.Discard;
        if (!Deck.Move(instanceId, destination))
        {
            // This should be unreachable after validation; refunding keeps the boundary atomic on races.
            Combat.AddEnergy(cost);
            return CardPlayResult.Reject("The card left the hand before play committed.");
        }
        if (definition.Type == CardType.Equipment)
            Combat.Equip(definition.Id);
        foreach (var fuelId in fuel)
            if (!Deck.Move(fuelId, CardZone.Exhaust))
                throw new InvalidOperationException("Infusion fuel left the hand during an atomic play.");
        if (fuel.Length > 0) Combat.RecordInfusion();
        if (definition.Type == CardType.Skill) Combat.RecordSpellCast();
        var context = new EffectContext(Combat, Deck, Combat.PlayerId, targets, _catalog, infused: fuel.Length > 0, infusionFuel: fuel,
            cardInstanceId: instanceId, card: definition, wasLastHandCard: Deck.Hand.Count == 0, lastPlayedType: Combat.LastPlayedCardType,
            choiceIndex: choiceIndex, selectedCards: chosenCards);
        foreach (var fuelId in fuel)
            if (Deck.TryFind(fuelId, out var fuelCard) && fuelCard is not null && _catalog.TryGet(fuelCard.DefinitionId, out var fuelDefinition) && fuelDefinition is not null)
                foreach (var fuelEffect in fuelDefinition.OnInfusedEffects)
                    Combat.Actions.Enqueue(new CardEffectAction(fuelEffect, context, _interpreter));
        var spellRepeat = definition.Type == CardType.Skill ? Combat.ConsumeNextSpellRepeat() : 1;
        for (var repeat = 0; repeat < spellRepeat; repeat++)
            foreach (var effect in effects)
                Combat.Actions.Enqueue(new CardEffectAction(effect, context, _interpreter));
        if (definition.SpecialId is not null && definition.SpecialId != "draw.attack-all-and-cover-weapons")
            Combat.Actions.Enqueue(new CardEffectAction(CardEffect.Special(definition.SpecialId), context, _interpreter));
        Combat.SetLastPlayedCardType(definition.Type.ToString());
        return new(true, "", effects.Count * spellRepeat + (definition.SpecialId is null ? 0 : 1));
    }

    public int ResolveQueuedEffects() => Combat.ResolveActions();

    private static IReadOnlyList<CardEffect> EffectiveEffects(CardDefinition definition)
    {
        if (definition.Effects.Count > 0) return definition.Effects;
        var effects = new List<CardEffect>();
        if (definition.Damage != 0 || definition.DmgType == DamageType.Attack)
            effects.Add(CardEffect.Damage(definition.Damage, definition.DmgType));
        if (definition.Block > 0) effects.Add(CardEffect.Block(definition.Block));
        if (definition.Armor > 0) effects.Add(CardEffect.Armor(definition.Armor));
        if (definition.Heal > 0) effects.Add(CardEffect.Heal(definition.Heal));
        if (definition.Draw > 0) effects.Add(CardEffect.Draw(definition.Draw));
        return effects;
    }
}
