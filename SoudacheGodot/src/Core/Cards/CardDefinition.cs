using System;
using System.Collections.Generic;

namespace Soudache;

public enum CardType
{
    Attack,
    Skill,
    Power,
    Resource,
    Event,
    Equipment
}

/// <summary>Data-only card content. Numbers are supplied by Soudache content, not this core.</summary>
public sealed class CardDefinition : ContentDefinition
{
    public CardType Type { get; }
    public int Cost { get; }
    public int Damage { get; }
    public int Dmg => Damage;
    public int Block { get; }
    public int Armor { get; }
    public int Heal { get; }
    public int Draw { get; }
    public bool ExhaustOnPlay { get; }
    public DamageType DmgType { get; }
    public DamageType DamageType => DmgType;
    public string Description { get; }
    public IReadOnlyList<CardEffect> Effects { get; }

    public CardDefinition(
        StableId id,
        string displayName,
        CardType type,
        int cost = 0,
        int damage = 0,
        int block = 0,
        int heal = 0,
        int draw = 0,
        bool exhaustOnPlay = false,
        DamageType dmgType = DamageType.Fixed,
        IEnumerable<CardEffect>? effects = null,
        string? description = null,
        int armor = 0)
        : base(id, displayName)
    {
        // The original data uses negative attack card bases (for example 偷袭 = -1).
        if (cost < 0 || block < 0 || armor < 0 || heal < 0 || draw < 0)
            throw new ArgumentOutOfRangeException(nameof(cost), "Card values cannot be negative.");
        Type = type;
        Cost = cost;
        Damage = damage;
        Block = block;
        Armor = armor;
        Heal = heal;
        Draw = draw;
        ExhaustOnPlay = exhaustOnPlay;
        DmgType = dmgType;
        Description = description ?? string.Empty;
        Effects = effects is null ? Array.Empty<CardEffect>() : new List<CardEffect>(effects).AsReadOnly();
    }
}
