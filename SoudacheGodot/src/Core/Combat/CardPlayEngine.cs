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

    public CardPlayResult TryPlay(StableId instanceId, IEnumerable<StableId>? selectedTargets = null)
    {
        if (Combat.Phase != CombatPhase.PlayerTurn) return CardPlayResult.Reject("Cards can only be played during the player turn.");
        if (!Deck.TryFind(instanceId, out var card) || card is null || !Deck.IsInHand(instanceId))
            return CardPlayResult.Reject("The card is not in hand.");
        if (!_catalog.TryGet(card.DefinitionId, out var definition) || definition is null)
            return CardPlayResult.Reject("The card definition is missing.");
        var cost = card.EffectiveCost(definition);
        if (cost > Combat.Energy) return CardPlayResult.Reject("Not enough energy.");

        var targets = (selectedTargets ?? Array.Empty<StableId>()).Distinct().ToArray();
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
        var context = new EffectContext(Combat, Deck, Combat.PlayerId, targets);
        foreach (var effect in effects)
            Combat.Actions.Enqueue(new CardEffectAction(effect, context, _interpreter));
        return new(true, "", effects.Count);
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
