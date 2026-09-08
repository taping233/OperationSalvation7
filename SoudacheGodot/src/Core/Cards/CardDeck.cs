using System;
using System.Collections.Generic;

namespace Soudache;

public enum CardZone
{
    DrawPile,
    Hand,
    Discard,
    Exhaust
}

/// <summary>
/// Runtime card zones. Every instance is indexed exactly once, so a move cannot duplicate or lose a card.
/// </summary>
public sealed class CardDeck
{
    private readonly List<CardInstance> _drawPile = new();
    private readonly List<CardInstance> _hand = new();
    private readonly List<CardInstance> _discard = new();
    private readonly List<CardInstance> _exhaust = new();
    private readonly Dictionary<StableId, CardZone> _zones = new();

    public IReadOnlyList<CardInstance> DrawPile => _drawPile;
    public IReadOnlyList<CardInstance> Hand => _hand;
    public IReadOnlyList<CardInstance> Discard => _discard;
    public IReadOnlyList<CardInstance> Exhaust => _exhaust;
    public int Count => _zones.Count;

    public void AddToDrawPile(CardInstance card) => AddNew(card, CardZone.DrawPile);
    public void AddToHand(CardInstance card) => AddNew(card, CardZone.Hand);
    public void AddToDiscard(CardInstance card) => AddNew(card, CardZone.Discard);
    public void AddToExhaust(CardInstance card) => AddNew(card, CardZone.Exhaust);

    public void AddToDrawPile(IEnumerable<CardInstance> cards)
    {
        ArgumentNullException.ThrowIfNull(cards);
        foreach (var card in cards) AddToDrawPile(card);
    }

    public bool TryGetZone(StableId instanceId, out CardZone zone) => _zones.TryGetValue(instanceId, out zone);

    public bool TryFind(StableId instanceId, out CardInstance? card)
    {
        card = null;
        if (!_zones.ContainsKey(instanceId)) return false;
        card = FindIn(_drawPile, instanceId) ?? FindIn(_hand, instanceId) ?? FindIn(_discard, instanceId) ?? FindIn(_exhaust, instanceId);
        return card is not null;
    }

    public int Draw(int count, DeterministicRng rng)
    {
        if (count < 0) throw new ArgumentOutOfRangeException(nameof(count));
        ArgumentNullException.ThrowIfNull(rng);
        var drawn = 0;
        while (drawn < count)
        {
            if (_drawPile.Count == 0)
            {
                if (_discard.Count == 0) break;
                _drawPile.AddRange(_discard);
                _discard.Clear();
                foreach (var reshuffledCard in _drawPile) _zones[reshuffledCard.InstanceId] = CardZone.DrawPile;
                rng.Shuffle(_drawPile);
            }
            var card = _drawPile[^1];
            _drawPile.RemoveAt(_drawPile.Count - 1);
            _hand.Add(card);
            _zones[card.InstanceId] = CardZone.Hand;
            drawn++;
        }
        return drawn;
    }

    public bool Move(StableId instanceId, CardZone destination)
    {
        if (!_zones.TryGetValue(instanceId, out var source) || source == destination) return false;
        var sourceList = ListFor(source);
        var card = FindIn(sourceList, instanceId);
        if (card is null) return false;
        sourceList.Remove(card);
        ListFor(destination).Add(card);
        _zones[instanceId] = destination;
        return true;
    }

    public int DiscardHand()
    {
        var moved = _hand.Count;
        if (moved == 0) return 0;
        _discard.AddRange(_hand);
        _hand.Clear();
        foreach (var card in _discard) _zones[card.InstanceId] = CardZone.Discard;
        return moved;
    }

    public CardInstance? FindInHand(StableId instanceId) => FindIn(_hand, instanceId);
    public bool Contains(StableId instanceId) => _zones.ContainsKey(instanceId);

    /// <summary>Moves a hand card to discard or exhaust after the caller has resolved its effects.</summary>
    public bool TryPlay(StableId instanceId, CardDefinition definition)
    {
        ArgumentNullException.ThrowIfNull(definition);
        var card = FindInHand(instanceId);
        if (card is null || card.DefinitionId != definition.Id) return false;
        return Move(instanceId, definition.ExhaustOnPlay ? CardZone.Exhaust : CardZone.Discard);
    }

    public bool TryExhaust(StableId instanceId) => MoveIfInHand(instanceId, CardZone.Exhaust);

    private void AddNew(CardInstance card, CardZone zone)
    {
        ArgumentNullException.ThrowIfNull(card);
        if (_zones.ContainsKey(card.InstanceId))
            throw new InvalidOperationException($"Card instance '{card.InstanceId}' is already in a zone.");
        ListFor(zone).Add(card);
        _zones.Add(card.InstanceId, zone);
    }

    private bool MoveIfInHand(StableId instanceId, CardZone destination)
        => FindInHand(instanceId) is not null && Move(instanceId, destination);

    private List<CardInstance> ListFor(CardZone zone) => zone switch
    {
        CardZone.DrawPile => _drawPile,
        CardZone.Hand => _hand,
        CardZone.Discard => _discard,
        CardZone.Exhaust => _exhaust,
        _ => throw new ArgumentOutOfRangeException(nameof(zone))
    };

    private static CardInstance? FindIn(List<CardInstance> cards, StableId id)
    {
        foreach (var card in cards)
            if (card.InstanceId == id) return card;
        return null;
    }
}
