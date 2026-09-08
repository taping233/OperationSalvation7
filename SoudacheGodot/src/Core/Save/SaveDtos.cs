using System;
using System.Collections.Generic;

namespace Soudache;

public static class SaveSchema
{
    public const int CurrentVersion = 1;
}

public sealed class SaveGameDto
{
    public int Version { get; set; } = SaveSchema.CurrentVersion;
    public int Slot { get; set; }
    public string SavedAtUtc { get; set; } = string.Empty;
    public ulong RngState { get; set; }
    public CardDeckDto Deck { get; set; } = new();
    public CombatStateDto? Combat { get; set; }
    public Dictionary<string, string> Flags { get; set; } = new(StringComparer.Ordinal);

    public void Validate()
    {
        if (Version <= 0) throw new SaveFormatException("Save version must be positive.");
        if (Slot < 0) throw new SaveFormatException("Save slot cannot be negative.");
        if (Deck is null) throw new SaveFormatException("Save is missing its card deck.");
        Deck.Validate();
        Combat?.Validate();
    }
}

public sealed class CardDeckDto
{
    public List<CardInstanceDto> Cards { get; set; } = new();

    public static CardDeckDto FromRuntime(CardDeck deck)
    {
        ArgumentNullException.ThrowIfNull(deck);
        var result = new CardDeckDto();
        Add(result, deck.DrawPile, CardZone.DrawPile);
        Add(result, deck.Hand, CardZone.Hand);
        Add(result, deck.Discard, CardZone.Discard);
        Add(result, deck.Exhaust, CardZone.Exhaust);
        return result;
    }

    public CardDeck ToRuntime()
    {
        Validate();
        var deck = new CardDeck();
        foreach (var card in Cards)
        {
            var runtime = new CardInstance(new StableId(card.InstanceId), new StableId(card.DefinitionId), card.UpgradeLevel, card.CostOverride);
            switch (card.Zone)
            {
                case CardZone.DrawPile: deck.AddToDrawPile(runtime); break;
                case CardZone.Hand: deck.AddToHand(runtime); break;
                case CardZone.Discard: deck.AddToDiscard(runtime); break;
                case CardZone.Exhaust: deck.AddToExhaust(runtime); break;
                default: throw new SaveFormatException($"Unknown card zone '{card.Zone}'.");
            }
        }
        return deck;
    }

    public void Validate()
    {
        if (Cards is null) throw new SaveFormatException("Card list is missing.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var card in Cards)
        {
            if (card is null || string.IsNullOrWhiteSpace(card.InstanceId) || string.IsNullOrWhiteSpace(card.DefinitionId))
                throw new SaveFormatException("Every saved card needs instance and definition ids.");
            if (!ids.Add(card.InstanceId)) throw new SaveFormatException($"Duplicate card instance '{card.InstanceId}'.");
            if (card.UpgradeLevel < 0 || card.CostOverride is < 0)
                throw new SaveFormatException($"Invalid upgrades/cost for card '{card.InstanceId}'.");
        }
    }

    private static void Add(CardDeckDto dto, IReadOnlyList<CardInstance> cards, CardZone zone)
    {
        foreach (var card in cards)
            dto.Cards.Add(new CardInstanceDto
            {
                InstanceId = card.InstanceId.Value,
                DefinitionId = card.DefinitionId.Value,
                UpgradeLevel = card.UpgradeLevel,
                CostOverride = card.CostOverride,
                Zone = zone
            });
    }
}

public sealed class CardInstanceDto
{
    public string InstanceId { get; set; } = string.Empty;
    public string DefinitionId { get; set; } = string.Empty;
    public int UpgradeLevel { get; set; }
    public int? CostOverride { get; set; }
    public CardZone Zone { get; set; }
}

public sealed class CombatStateDto
{
    public string PlayerId { get; set; } = string.Empty;
    public CombatPhase Phase { get; set; }
    public int Turn { get; set; }
    public List<CombatantDto> Combatants { get; set; } = new();

    public static CombatStateDto FromRuntime(CombatState state)
    {
        ArgumentNullException.ThrowIfNull(state);
        var dto = new CombatStateDto { PlayerId = state.PlayerId.Value, Phase = state.Phase, Turn = state.Turn };
        foreach (var unit in state.Combatants)
            dto.Combatants.Add(new CombatantDto
            {
                Id = unit.Id.Value, Name = unit.Name, IsEnemy = unit.IsEnemy,
                MaxHealth = unit.MaxHealth, Health = unit.Health, Block = unit.Block
            });
        return dto;
    }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(PlayerId) || Combatants is null)
            throw new SaveFormatException("Combat save is missing player or combatants.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var unit in Combatants)
        {
            if (unit is null || string.IsNullOrWhiteSpace(unit.Id) || unit.MaxHealth <= 0 || unit.Health < 0 || unit.Health > unit.MaxHealth || unit.Block < 0)
                throw new SaveFormatException("Invalid combatant in save.");
            if (!ids.Add(unit.Id)) throw new SaveFormatException($"Duplicate combatant '{unit.Id}'.");
        }
        if (!ids.Contains(PlayerId)) throw new SaveFormatException("Saved combat player is absent from combatants.");
        if (Turn < 0) throw new SaveFormatException("Combat turn cannot be negative.");
    }

    public CombatState ToRuntime()
    {
        Validate();
        var state = new CombatState(new StableId(PlayerId));
        foreach (var unit in Combatants)
        {
            var runtime = new CombatantState(new StableId(unit.Id), unit.Name, unit.MaxHealth, unit.IsEnemy);
            if (unit.Health < unit.MaxHealth) runtime.ApplyDamage(unit.MaxHealth - unit.Health);
            runtime.AddBlock(unit.Block);
            state.AddCombatant(runtime);
        }
        state.RestoreTurnState(Turn, Phase);
        return state;
    }
}

public sealed class CombatantDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsEnemy { get; set; }
    public int MaxHealth { get; set; }
    public int Health { get; set; }
    public int Block { get; set; }
}

public class SaveFormatException : Exception
{
    public SaveFormatException(string message) : base(message) { }
    public SaveFormatException(string message, Exception inner) : base(message, inner) { }
}

public sealed class SaveVersionException : SaveFormatException
{
    public int FoundVersion { get; }
    public SaveVersionException(int foundVersion)
        : base($"Save version {foundVersion} is newer than supported version {SaveSchema.CurrentVersion}.")
        => FoundVersion = foundVersion;
}
