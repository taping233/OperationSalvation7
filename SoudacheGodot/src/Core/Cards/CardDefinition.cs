using System;

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
    public int Block { get; }
    public int Heal { get; }
    public int Draw { get; }
    public bool ExhaustOnPlay { get; }

    public CardDefinition(
        StableId id,
        string displayName,
        CardType type,
        int cost = 0,
        int damage = 0,
        int block = 0,
        int heal = 0,
        int draw = 0,
        bool exhaustOnPlay = false)
        : base(id, displayName)
    {
        if (cost < 0 || damage < 0 || block < 0 || heal < 0 || draw < 0)
            throw new ArgumentOutOfRangeException(nameof(cost), "Card values cannot be negative.");
        Type = type;
        Cost = cost;
        Damage = damage;
        Block = block;
        Heal = heal;
        Draw = draw;
        ExhaustOnPlay = exhaustOnPlay;
    }
}
