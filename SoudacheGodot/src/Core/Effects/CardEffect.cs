using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

/// <summary>The four damage channels used by the original combat rules.</summary>
public enum DamageType
{
    Attack,
    Spell,
    Fixed,
    True
}

/// <summary>Where a data effect resolves. A target is validated before a card is committed.</summary>
public enum EffectTarget
{
    Self,
    SelectedEnemy,
    AllEnemies,
    SelectedAny,
    Hand,
    None
}

public enum CardEffectKind
{
    Damage,
    Armor,
    Block,
    Heal,
    Draw,
    GainEnergy,
    Discard,
    Exhaust,
    ApplyStatus
}

public enum CombatStatus
{
    Bleed,
    Poison,
    Freeze,
    Silence,
    ArmorBreak,
    HealingBan,
    Stealth,
    Immune,
    DamageReduction,
    AttackUp,
    SpellUp
}

/// <summary>Immutable, serializable vocabulary for a card effect.</summary>
public sealed class CardEffect
{
    public CardEffectKind Kind { get; }
    public int Amount { get; }
    public DamageType DamageType { get; }
    public EffectTarget Target { get; }
    public CombatStatus? Status { get; }
    public int Duration { get; }
    public bool All { get; }

    public CardEffect(
        CardEffectKind kind,
        int amount = 0,
        DamageType damageType = DamageType.Fixed,
        EffectTarget target = EffectTarget.None,
        CombatStatus? status = null,
        int duration = 0,
        bool all = false)
    {
        if (amount < 0 && kind is not CardEffectKind.Damage)
            throw new ArgumentOutOfRangeException(nameof(amount));
        if (duration < 0) throw new ArgumentOutOfRangeException(nameof(duration));
        if (kind == CardEffectKind.ApplyStatus && status is null)
            throw new ArgumentException("Status effects need a status key.", nameof(status));
        Kind = kind;
        Amount = amount;
        DamageType = damageType;
        Target = all ? EffectTarget.AllEnemies : target;
        Status = status;
        Duration = duration;
        All = all || target == EffectTarget.AllEnemies;
    }

    public static CardEffect Damage(int amount, DamageType type, EffectTarget target = EffectTarget.SelectedEnemy)
        => new(CardEffectKind.Damage, amount, type, target);
    public static CardEffect Armor(int amount, EffectTarget target = EffectTarget.Self)
        => new(CardEffectKind.Armor, amount, target: target);
    public static CardEffect Block(int amount, EffectTarget target = EffectTarget.Self)
        => new(CardEffectKind.Block, amount, target: target);
    public static CardEffect Heal(int amount, EffectTarget target = EffectTarget.Self)
        => new(CardEffectKind.Heal, amount, target: target);
    public static CardEffect Draw(int count)
        => new(CardEffectKind.Draw, count, target: EffectTarget.Self);
    public static CardEffect Energy(int amount)
        => new(CardEffectKind.GainEnergy, amount, target: EffectTarget.Self);
    public static CardEffect ApplyStatus(CombatStatus status, int amount = 1, int duration = 0, EffectTarget target = EffectTarget.SelectedEnemy)
        => new(CardEffectKind.ApplyStatus, amount, target: target, status: status, duration: duration);
}

/// <summary>Mutable resources needed while interpreting one effect action.</summary>
public sealed class EffectContext
{
    public CombatState Combat { get; }
    public CardDeck? Deck { get; }
    public StableId SourceId { get; }
    public IReadOnlyList<StableId> Targets { get; }

    public EffectContext(CombatState combat, CardDeck? deck, StableId sourceId, IEnumerable<StableId>? targets = null)
    {
        Combat = combat ?? throw new ArgumentNullException(nameof(combat));
        Deck = deck;
        SourceId = sourceId;
        Targets = targets is null ? Array.Empty<StableId>() : new List<StableId>(targets).AsReadOnly();
    }
}

public readonly record struct EffectResolution(CardEffectKind Kind, int Amount, int Affected, bool Applied);

/// <summary>Single interpreter for all data effects. It never contains card-specific branches.</summary>
public sealed class CardEffectInterpreter
{
    public EffectResolution Resolve(CardEffect effect, EffectContext context)
    {
        ArgumentNullException.ThrowIfNull(effect);
        ArgumentNullException.ThrowIfNull(context);
        return effect.Kind switch
        {
            CardEffectKind.Damage => ResolveDamage(effect, context),
            CardEffectKind.Armor => ResolveCombatants(effect, context, (c, id) => c.AddArmor(id, effect.Amount)),
            CardEffectKind.Block => ResolveCombatants(effect, context, (c, id) => c.AddBlock(id, effect.Amount)),
            CardEffectKind.Heal => ResolveCombatants(effect, context, (c, id) => c.RestoreHealth(id, effect.Amount)),
            CardEffectKind.ApplyStatus => ResolveStatus(effect, context),
            CardEffectKind.Draw => ResolveDraw(effect, context),
            CardEffectKind.GainEnergy => ResolveEnergy(effect, context),
            CardEffectKind.Discard => ResolveMove(effect, context, CardZone.Discard),
            CardEffectKind.Exhaust => ResolveMove(effect, context, CardZone.Exhaust),
            _ => throw new ArgumentOutOfRangeException(nameof(effect), effect.Kind, "Unknown card effect kind.")
        };
    }

    private static EffectResolution ResolveDamage(CardEffect effect, EffectContext context)
    {
        var ids = TargetsFor(effect, context);
        var affected = 0;
        foreach (var id in ids)
        {
            if (!context.Combat.TryGetCombatant(id, out var target) || target!.IsDefeated) continue;
            context.Combat.DealDamage(context.SourceId, id, effect.Amount, effect.DamageType);
            affected++;
        }
        return new(CardEffectKind.Damage, effect.Amount, affected, affected > 0);
    }

    private static EffectResolution ResolveStatus(CardEffect effect, EffectContext context)
    {
        var ids = TargetsFor(effect, context);
        var affected = 0;
        foreach (var id in ids)
        {
            if (!context.Combat.TryGetCombatant(id, out var target) || target!.IsDefeated) continue;
            context.Combat.AddStatus(id, effect.Status!.Value, effect.Amount, effect.Duration);
            affected++;
        }
        return new(CardEffectKind.ApplyStatus, effect.Amount, affected, affected > 0);
    }

    private static EffectResolution ResolveCombatants(CardEffect effect, EffectContext context, Func<CombatState, StableId, int> apply)
    {
        var ids = effect.Target == EffectTarget.Self ? new[] { context.SourceId } : TargetsFor(effect, context);
        var affected = 0;
        foreach (var id in ids)
        {
            if (!context.Combat.TryGetCombatant(id, out var target) || target!.IsDefeated) continue;
            apply(context.Combat, id);
            affected++;
        }
        return new(effect.Kind, effect.Amount, affected, affected > 0);
    }

    private static EffectResolution ResolveDraw(CardEffect effect, EffectContext context)
    {
        if (context.Deck is null) return new(effect.Kind, effect.Amount, 0, false);
        var drawn = context.Deck.Draw(effect.Amount, context.Combat.Rng);
        return new(effect.Kind, drawn, drawn, drawn > 0);
    }

    private static EffectResolution ResolveEnergy(CardEffect effect, EffectContext context)
    {
        var gained = context.Combat.AddEnergy(effect.Amount);
        return new(effect.Kind, gained, gained > 0 ? 1 : 0, gained > 0);
    }

    private static EffectResolution ResolveMove(CardEffect effect, EffectContext context, CardZone destination)
    {
        if (context.Deck is null) return new(effect.Kind, effect.Amount, 0, false);
        var moved = effect.Amount == 0 || effect.Amount == int.MaxValue
            ? context.Deck.MoveAllFromHand(destination)
            : context.Deck.MoveFirstFromHand(destination, effect.Amount);
        return new(effect.Kind, moved, moved > 0 ? 1 : 0, moved > 0);
    }

    private static IReadOnlyList<StableId> TargetsFor(CardEffect effect, EffectContext context)
    {
        if (effect.Target == EffectTarget.AllEnemies)
            return context.Combat.Combatants.Where(c => c.IsEnemy && !c.IsDefeated).Select(c => c.Id).ToArray();
        return context.Targets;
    }
}

/// <summary>Queue adapter; capturing the immutable context keeps action resolution FIFO.</summary>
public sealed class CardEffectAction : IGameAction
{
    private readonly CardEffectInterpreter _interpreter;
    private readonly CardEffect _effect;
    private readonly EffectContext _context;
    public string ActionId => $"effect:{_effect.Kind}";
    public EffectResolution? Result { get; private set; }

    public CardEffectAction(CardEffect effect, EffectContext context, CardEffectInterpreter? interpreter = null)
    {
        _effect = effect ?? throw new ArgumentNullException(nameof(effect));
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _interpreter = interpreter ?? new CardEffectInterpreter();
    }

    public void Execute(ActionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (context.Combat != _context.Combat) throw new InvalidOperationException("Effect action belongs to another combat.");
        Result = _interpreter.Resolve(_effect, _context);
    }
}
