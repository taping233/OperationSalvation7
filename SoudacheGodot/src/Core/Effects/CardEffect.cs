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
    ApplyStatus,
    Discover,
    Delayed,
    Repeat,
    Guard,
    Purify,
    TriggerPoison
    ,Special
}

public enum EffectConditionKind
{
    None,
    TargetHasStatus,
    TargetHealthAtMostPercent,
    TargetHealthAtMost,
    TargetHasAnyCurse
}

public sealed class EffectCondition
{
    public EffectConditionKind Kind { get; }
    public CombatStatus? Status { get; }
    public int Threshold { get; }
    public EffectCondition(EffectConditionKind kind, CombatStatus? status = null, int threshold = 100)
    {
        if (threshold is < 0 or > 100) throw new ArgumentOutOfRangeException(nameof(threshold));
        Kind = kind; Status = status; Threshold = threshold;
    }
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
    public int DelayTurns { get; }
    public CardEffect? NestedEffect { get; }
    public int ChoiceCount { get; }
    public string? FilterType { get; }
    public string? FilterClass { get; }
    public bool CastImmediately { get; }
    public EffectCondition? Condition { get; }
    public int? AlternateAmount { get; }
    public int RepeatCount { get; }
    public int InfusedRepeatCount { get; }
    public bool RepeatOnSchedule { get; }
    public string? SpecialId { get; }

    public CardEffect(
        CardEffectKind kind,
        int amount = 0,
        DamageType damageType = DamageType.Fixed,
        EffectTarget target = EffectTarget.None,
        CombatStatus? status = null,
        int duration = 0,
        bool all = false,
        int delayTurns = 0,
        CardEffect? nestedEffect = null,
        int choiceCount = 1,
        string? filterType = null,
        string? filterClass = null,
        bool castImmediately = false,
        EffectCondition? condition = null,
        int? alternateAmount = null,
        int repeatCount = 1,
        int infusedRepeatCount = 1,
        bool repeatOnSchedule = false,
        string? specialId = null)
    {
        if (amount < 0 && kind is not CardEffectKind.Damage)
            throw new ArgumentOutOfRangeException(nameof(amount));
        if (duration < 0) throw new ArgumentOutOfRangeException(nameof(duration));
        if (delayTurns < 0) throw new ArgumentOutOfRangeException(nameof(delayTurns));
        if (choiceCount < 1) throw new ArgumentOutOfRangeException(nameof(choiceCount));
        if (repeatCount < 1 || infusedRepeatCount < 1) throw new ArgumentOutOfRangeException(nameof(repeatCount));
        if (kind == CardEffectKind.ApplyStatus && status is null)
            throw new ArgumentException("Status effects need a status key.", nameof(status));
        Kind = kind;
        Amount = amount;
        DamageType = damageType;
        Target = all ? EffectTarget.AllEnemies : target;
        Status = status;
        Duration = duration;
        All = all || target == EffectTarget.AllEnemies;
        DelayTurns = delayTurns;
        NestedEffect = nestedEffect;
        ChoiceCount = choiceCount;
        FilterType = filterType;
        FilterClass = filterClass;
        CastImmediately = castImmediately;
        Condition = condition;
        AlternateAmount = alternateAmount;
        RepeatCount = repeatCount;
        InfusedRepeatCount = infusedRepeatCount;
        RepeatOnSchedule = repeatOnSchedule;
        SpecialId = specialId;
    }

    public static CardEffect Damage(int amount, DamageType type, EffectTarget target = EffectTarget.SelectedEnemy, int? alternateAmount = null, int repeatCount = 1, int infusedRepeatCount = 1, EffectCondition? condition = null)
        => new(CardEffectKind.Damage, amount, type, target, condition: condition, alternateAmount: alternateAmount, repeatCount: repeatCount, infusedRepeatCount: infusedRepeatCount);
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
    public static CardEffect ApplyStatus(CombatStatus status, int amount = 1, int duration = 0, EffectTarget target = EffectTarget.SelectedEnemy, EffectCondition? condition = null)
        => new(CardEffectKind.ApplyStatus, amount, target: target, status: status, duration: duration, condition: condition);
    public static CardEffect Discover(string? filterType = null, string? filterClass = null, int count = 1, bool castImmediately = false)
        => new(CardEffectKind.Discover, target: EffectTarget.Self, choiceCount: count, filterType: filterType, filterClass: filterClass, castImmediately: castImmediately);
    public static CardEffect Delayed(int turns, CardEffect nested, bool repeat = false)
        => new(CardEffectKind.Delayed, delayTurns: turns, nestedEffect: nested, target: EffectTarget.None, repeatOnSchedule: repeat);
    public static CardEffect Repeat(int count, CardEffect nested)
        => new(CardEffectKind.Repeat, amount: count, nestedEffect: nested, target: EffectTarget.None);
    public static CardEffect Guard(EffectTarget target = EffectTarget.Self)
        => new(CardEffectKind.Guard, amount: 1, target: target);
    public static CardEffect Purify(EffectTarget target = EffectTarget.Self)
        => new(CardEffectKind.Purify, amount: 1, target: target);
    public static CardEffect TriggerPoison(EffectTarget target = EffectTarget.SelectedEnemy)
        => new(CardEffectKind.TriggerPoison, amount: 1, target: target);
    public static CardEffect Special(string id)
        => new(CardEffectKind.Special, target: EffectTarget.None, specialId: id);
}

/// <summary>Mutable resources needed while interpreting one effect action.</summary>
public sealed class EffectContext
{
    public CombatState Combat { get; }
    public CardDeck? Deck { get; }
    public StableId SourceId { get; }
    public IReadOnlyList<StableId> Targets { get; }
    public CardCatalog? Catalog { get; }
    public string? SourceClass { get; }
    public StableId CardInstanceId { get; }
    public CardDefinition? Card { get; }
    public bool WasLastHandCard { get; }
    public string? LastPlayedType { get; }
    public bool Infused { get; }
    public IReadOnlyList<StableId> InfusionFuel { get; }
    public int ChoiceIndex { get; }
    public IReadOnlyList<StableId> SelectedCards { get; }

    public EffectContext(CombatState combat, CardDeck? deck, StableId sourceId, IEnumerable<StableId>? targets = null, CardCatalog? catalog = null, bool infused = false, IEnumerable<StableId>? infusionFuel = null, string? sourceClass = null, StableId? cardInstanceId = null, CardDefinition? card = null, bool wasLastHandCard = false, string? lastPlayedType = null, int choiceIndex = 1, IEnumerable<StableId>? selectedCards = null)
    {
        Combat = combat ?? throw new ArgumentNullException(nameof(combat));
        Deck = deck;
        SourceId = sourceId;
        Targets = targets is null ? Array.Empty<StableId>() : new List<StableId>(targets).AsReadOnly();
        Catalog = catalog;
        SourceClass = sourceClass;
        CardInstanceId = cardInstanceId ?? default;
        Card = card;
        WasLastHandCard = wasLastHandCard;
        LastPlayedType = lastPlayedType;
        Infused = infused;
        InfusionFuel = infusionFuel is null ? Array.Empty<StableId>() : new List<StableId>(infusionFuel).AsReadOnly();
        ChoiceIndex = choiceIndex;
        SelectedCards = selectedCards is null ? Array.Empty<StableId>() : new List<StableId>(selectedCards).AsReadOnly();
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
            CardEffectKind.Discover => ResolveDiscover(effect, context),
            CardEffectKind.Delayed => ResolveDelayed(effect, context),
            CardEffectKind.Repeat => ResolveRepeat(effect, context),
            CardEffectKind.Guard => ResolveGuard(effect, context),
            CardEffectKind.Purify => ResolvePurify(effect, context),
            CardEffectKind.TriggerPoison => ResolvePoison(effect, context),
            CardEffectKind.Special => SpecialCardHandler.Resolve(effect.SpecialId!, context, this),
            _ => throw new ArgumentOutOfRangeException(nameof(effect), effect.Kind, "Unknown card effect kind.")
        };
    }

    private static EffectResolution ResolveDamage(CardEffect effect, EffectContext context)
    {
        context.Combat.BeginDamageBatch();
        var ids = TargetsFor(effect, context);
        var affected = 0;
        var amount = context.Infused && effect.AlternateAmount is not null ? effect.AlternateAmount.Value : effect.Amount;
        var repeat = context.Infused ? effect.InfusedRepeatCount : effect.RepeatCount;
        for (var pass = 0; pass < repeat; pass++)
        foreach (var id in ids)
        {
            if (!context.Combat.TryGetCombatant(id, out var target) || target!.IsDefeated) continue;
            if (!ConditionMatches(effect.Condition, context, id)) continue;
            context.Combat.DealDamage(context.SourceId, id, amount, effect.DamageType);
            affected++;
        }
        return new(CardEffectKind.Damage, amount, affected, affected > 0);
    }

    private EffectResolution ResolveRepeat(CardEffect effect, EffectContext context)
    {
        if (effect.NestedEffect is null || effect.Amount <= 0) return new(effect.Kind, effect.Amount, 0, false);
        var applied = 0;
        for (var i = 0; i < effect.Amount; i++)
            if (Resolve(effect.NestedEffect, context).Applied) applied++;
        return new(effect.Kind, effect.Amount, applied, applied > 0);
    }

    private static EffectResolution ResolveDelayed(CardEffect effect, EffectContext context)
    {
        if (effect.NestedEffect is null) return new(effect.Kind, 0, 0, false);
        context.Combat.ScheduleEffect(Math.Max(1, effect.DelayTurns), new CardEffectAction(effect.NestedEffect, context), effect.RepeatOnSchedule);
        return new(effect.Kind, effect.DelayTurns, 1, true);
    }

    private EffectResolution ResolveDiscover(CardEffect effect, EffectContext context)
    {
        if (context.Catalog is null || context.Deck is null) return new(effect.Kind, 0, 0, false);
        var candidates = context.Catalog.All.Where(card =>
            card.Layer == CardLayer.Combat && TypeMatches(card, effect.FilterType) &&
            (effect.FilterClass is null ? true : effect.FilterClass == "OTHER" ? card.ClassName is not null && !string.Equals(card.ClassName, context.SourceClass, StringComparison.Ordinal) : string.Equals(card.ClassName, effect.FilterClass, StringComparison.Ordinal))).ToArray();
        var chosen = candidates.Take(effect.ChoiceCount).ToArray();
        var applied = 0;
        foreach (var definition in chosen)
        {
            var instance = new CardInstance($"discover.{definition.Id.Value}.{context.Combat.NextGeneratedId()}", definition.Id);
            if (!context.Deck.AddToHand(instance)) continue;
            applied++;
            if (definition.SpecialId == "discover.trigger-apollo")
                SpecialCardHandler.Resolve(definition.SpecialId, new EffectContext(context.Combat, context.Deck, context.SourceId, context.Targets, context.Catalog, cardInstanceId: instance.InstanceId, card: definition), this);
            if (effect.CastImmediately)
                foreach (var nested in definition.Effects)
                    Resolve(nested, new EffectContext(context.Combat, context.Deck, context.SourceId, context.Targets, context.Catalog, context.Infused, context.InfusionFuel, context.SourceClass));
        }
        return new(effect.Kind, chosen.Length, applied, applied > 0);
    }

    private static EffectResolution ResolveStatus(CardEffect effect, EffectContext context)
    {
        var ids = TargetsFor(effect, context);
        var affected = 0;
        foreach (var id in ids)
        {
            if (!context.Combat.TryGetCombatant(id, out var target) || target!.IsDefeated) continue;
            if (!ConditionMatches(effect.Condition, context, id)) continue;
            context.Combat.AddStatus(id, effect.Status!.Value, effect.Amount, effect.Duration);
            affected++;
        }
        return new(CardEffectKind.ApplyStatus, effect.Amount, affected, affected > 0);
    }

    private static EffectResolution ResolveGuard(CardEffect effect, EffectContext context)
    {
        var target = context.Combat.GetCombatant(context.SourceId);
        target.SetGuard(true);
        return new(effect.Kind, 1, 1, true);
    }

    private static EffectResolution ResolvePurify(CardEffect effect, EffectContext context)
    {
        var target = context.Combat.GetCombatant(context.SourceId);
        var cleared = target.Purify();
        return new(effect.Kind, cleared, cleared, true);
    }

    private static EffectResolution ResolvePoison(CardEffect effect, EffectContext context)
    {
        var ids = TargetsFor(effect, context);
        var affected = 0;
        foreach (var id in ids)
            if (context.Combat.TryGetCombatant(id, out var target) && target is not null && target.GetStatus(CombatStatus.Poison) > 0)
            { context.Combat.TickPoison(id); affected++; }
        return new(effect.Kind, affected, affected, affected > 0);
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
        var before = context.Deck.Hand.Count;
        var drawn = context.Deck.AutoReshuffle
            ? context.Deck.Draw(effect.Amount, context.Combat.Rng)
            : AddTemporaryCards(context.Deck, effect.Amount, context.Combat);
        if (drawn > 0 && context.Catalog is not null)
        {
            var drawnIds = context.Deck.Hand.Skip(before).Select(card => card.InstanceId).ToArray();
            CardDrawTriggerResolver.Queue(context.Combat, context.Deck, context.Catalog, drawnIds, context.Targets);
        }
        return new(effect.Kind, drawn, drawn, drawn > 0);
    }

    private static int AddTemporaryCards(CardDeck deck, int count, CombatState combat)
    {
        var added = 0;
        for (var i = 0; i < count; i++)
            if (deck.AddToHand(new CardInstance($"temporary.builtin-sha.{combat.NextGeneratedId()}", "builtin-sha"))) added++;
        return added;
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
        if (effect.Target == EffectTarget.Self)
            return new[] { context.SourceId };
        if (effect.Target == EffectTarget.AllEnemies)
            return context.Combat.Combatants.Where(c => c.IsEnemy && !c.IsDefeated).Select(c => c.Id).ToArray();
        return context.Targets;
    }

    private static bool ConditionMatches(EffectCondition? condition, EffectContext context, StableId? explicitTarget = null)
    {
        if (condition is null || condition.Kind == EffectConditionKind.None) return true;
        var id = explicitTarget ?? context.Targets.FirstOrDefault();
        if (!id.IsValid) id = context.SourceId;
        if (!context.Combat.TryGetCombatant(id, out var target) || target is null) return false;
        return condition.Kind switch
        {
            EffectConditionKind.TargetHasStatus => condition.Status is not null && target.HasStatus(condition.Status.Value),
            EffectConditionKind.TargetHasAnyCurse => target.HasStatus(CombatStatus.Bleed) || target.HasStatus(CombatStatus.Poison) || target.HasStatus(CombatStatus.Freeze) || target.HasStatus(CombatStatus.Silence) || target.HasStatus(CombatStatus.ArmorBreak) || target.HasStatus(CombatStatus.HealingBan),
            EffectConditionKind.TargetHealthAtMostPercent => target.Health * 100 <= target.MaxHealth * condition.Threshold,
            EffectConditionKind.TargetHealthAtMost => target.Health <= condition.Threshold,
            _ => true
        };
    }

    private static bool TypeMatches(CardDefinition card, string? filter) => filter switch
    {
        null => true,
        "武术" or "招式" => card.Type == CardType.Attack,
        "法术" or "药水" => card.Type == CardType.Skill,
        "装备" => card.Type == CardType.Equipment,
        _ => true
    };
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

/// <summary>Queues the exported 抽到时施放 clauses after a draw operation.</summary>
public static class CardDrawTriggerResolver
{
    public static int Queue(CombatState combat, CardDeck deck, CardCatalog catalog, IEnumerable<StableId> drawn, IEnumerable<StableId>? targets = null)
    {
        ArgumentNullException.ThrowIfNull(combat);
        ArgumentNullException.ThrowIfNull(deck);
        ArgumentNullException.ThrowIfNull(catalog);
        ArgumentNullException.ThrowIfNull(drawn);
        var queued = 0;
        var context = new EffectContext(combat, deck, combat.PlayerId, targets, catalog);
        foreach (var id in drawn)
        {
            if (!deck.TryFind(id, out var card) || card is null || !catalog.TryGet(card.DefinitionId, out var definition) || definition is null) continue;
            if (definition.SpecialId == "draw.attack-all-and-cover-weapons")
            {
                combat.Actions.Enqueue(new CardEffectAction(CardEffect.Special(definition.SpecialId), new EffectContext(combat, deck, combat.PlayerId, targets, catalog, cardInstanceId: id, card: definition)));
                queued++;
            }
            foreach (var effect in definition.OnDrawEffects)
            {
                combat.Actions.Enqueue(new CardEffectAction(effect, context));
                queued++;
            }
        }
        return queued;
    }
}
