using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Soudache;

public static class SaveSchema
{
    // v1 was the initial Godot slice; v2 added the web run/base fields; v3
    // retained named Web RNG streams and an explicit RunActive marker.
    public const int CurrentVersion = 3;
    public const int MaxSlots = 5;
}

public static class SaveMigrations
{
    private static readonly IReadOnlyDictionary<int, Action<SaveGameDto>> Chain = new Dictionary<int, Action<SaveGameDto>>
    {
        [0] = _ => { },
        [1] = dto => dto.Base ??= new BaseStateDto(),
        [2] = dto => dto.RngStreams ??= new Dictionary<string, ulong>(StringComparer.Ordinal),
    };

    public static SaveGameDto Migrate(SaveGameDto dto)
    {
        ArgumentNullException.ThrowIfNull(dto);
        var version = dto.Version < 0 ? 0 : dto.Version;
        if (version > SaveSchema.CurrentVersion) throw new SaveVersionException(version);
        while (version < SaveSchema.CurrentVersion)
        {
            if (!Chain.TryGetValue(version, out var migration)) throw new SaveFormatException($"No save migration registered for {version} -> {version + 1}.");
            migration(dto);
            dto.Version = ++version;
        }
        return dto;
    }
}

public sealed class SaveGameDto
{
    public int Version { get; set; } = SaveSchema.CurrentVersion;
    public int Slot { get; set; }
    public string SavedAtUtc { get; set; } = string.Empty;
    public bool RunActive { get; set; } = true;
    public ulong Seed { get; set; }
    public ulong RngState { get; set; }
    public Dictionary<string, ulong> RngStreams { get; set; } = new(StringComparer.Ordinal);
    public int LayerIdx { get; set; }
    public int TrackPos { get; set; }
    public int Hp { get; set; } = 30;
    public int MaxHp { get; set; } = 30;
    public int Coins { get; set; }
    public int Keys { get; set; }
    public int Wood { get; set; }
    public int Rations { get; set; }
    public int Turn { get; set; } = 1;
    public int Atk { get; set; } = 4;
    public string Mode { get; set; } = "standard";
    public string? MyClass { get; set; }
    public string? CharacterId { get; set; }
    public List<JsonElement> Inventory { get; set; } = new();
    public List<JsonElement> OwnedCards { get; set; } = new();
    public List<string> CardOrder { get; set; } = new();
    public List<JsonElement> UsedPocket { get; set; } = new();
    public List<string> EventLog { get; set; } = new();
    public List<string> Discovered { get; set; } = new();
    public List<JsonElement> DiceHistory { get; set; } = new();
    public double Elapsed { get; set; }
    public int Stamina { get; set; } = 60;
    /// <summary>彩色令牌碎片计数（网页版 game.fragments；旧档缺字段 → 0）。</summary>
    public int Fragments { get; set; }
    // —— 批次 3 四层跑图（可选字段，旧 v3 档缺省即默认值，无需迁移）——
    /// <summary>第四层污染祭坛是否已激活（首脑格准入条件；网页版 altarActivated）。</summary>
    public bool AltarActivated { get; set; }
    /// <summary>本局是否已击败首脑（终局撤离放行；网页版 bossKilled）。</summary>
    public bool BossKilled { get; set; }
    /// <summary>已结算过的一次性格键（"li,idx"；网页版 visited）。</summary>
    public List<string> VisitedNodes { get; set; } = new();
    public CardDeckDto Deck { get; set; } = new();
    public CombatStateDto? Combat { get; set; }
    public Dictionary<string, string> Flags { get; set; } = new(StringComparer.Ordinal);
    public BaseStateDto Base { get; set; } = new();

    public void Validate()
    {
        if (Version != SaveSchema.CurrentVersion) throw new SaveFormatException($"Save must be migrated to version {SaveSchema.CurrentVersion}.");
        if (Slot < 0 || Slot >= SaveSchema.MaxSlots) throw new SaveFormatException("Save slot must be between 0 and 4.");
        if (!string.IsNullOrWhiteSpace(SavedAtUtc) && !DateTimeOffset.TryParse(SavedAtUtc, out _)) throw new SaveFormatException("SavedAtUtc is not an ISO-8601 timestamp.");
        if (LayerIdx < 0 || TrackPos < 0 || Hp < 0 || MaxHp <= 0 || Hp > MaxHp || Coins < 0 || Keys < 0 || Wood < 0 || Rations < 0 || Turn < 0 || Atk < 0 || Stamina < 0 || Elapsed < 0) throw new SaveFormatException("Run values are outside their valid ranges.");
        if (Mode is not ("standard" or "elite" or "casual")) throw new SaveFormatException($"Unknown run mode '{Mode}'.");
        ValidateList(Inventory, "inventory"); ValidateList(OwnedCards, "ownedCards"); ValidateList(UsedPocket, "usedPocket");
        if (CardOrder is null || EventLog is null || Discovered is null || DiceHistory is null || Flags is null || RngStreams is null) throw new SaveFormatException("Save contains a missing collection.");
        if (CardOrder.Count > 10000 || EventLog.Count > 10000 || Discovered.Count > 10000 || DiceHistory.Count > 10000) throw new SaveFormatException("Save collection is unreasonably large.");
        if (VisitedNodes is null || VisitedNodes.Count > 10000) throw new SaveFormatException("Save visited-node list is missing or unreasonably large.");
        Deck?.Validate(); Combat?.Validate(); Base?.Validate();
    }

    private static void ValidateList(List<JsonElement>? list, string name)
    {
        if (list is null) throw new SaveFormatException($"Save collection '{name}' is missing.");
        if (list.Count > 10000) throw new SaveFormatException($"Save collection '{name}' is unreasonably large.");
        foreach (var value in list) if (value.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null) throw new SaveFormatException($"Save collection '{name}' contains a null item.");
    }
}

public sealed class BaseStateDto
{
    public int Wood { get; set; }
    public int Rations { get; set; }
    public int Keys { get; set; }
    public int BagUp { get; set; }
    public int SafeUp { get; set; }
    public int StashUp { get; set; }
    public int Coins { get; set; }
    public List<CardStackDto> Stash { get; set; } = new();
    public List<CardStackDto> Pocket { get; set; } = new();
    public Dictionary<string, CollectionEntryDto> Collection { get; set; } = new(StringComparer.Ordinal);
    public string SelMode { get; set; } = "standard";
    public Dictionary<string, CharacterProgressDto> Classes { get; set; } = new(StringComparer.Ordinal);
    public BaseStatsDto Stats { get; set; } = new();
    public Dictionary<string, bool> AchClaimed { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, bool> Backs { get; set; } = new(StringComparer.Ordinal) { ["classic"] = true };
    public string BackSel { get; set; } = "classic";

    public void Validate()
    {
        if (Wood < 0 || Rations < 0 || Keys < 0 || BagUp < 0 || SafeUp < 0 || StashUp < 0 || Coins < 0) throw new SaveFormatException("Base resources and upgrades cannot be negative.");
        if (SelMode is not ("standard" or "elite" or "casual")) throw new SaveFormatException($"Unknown base mode '{SelMode}'.");
        if (Stash is null || Pocket is null || Collection is null || Classes is null || Stats is null || AchClaimed is null || Backs is null) throw new SaveFormatException("Base save contains a missing collection.");
        if (!Backs.ContainsKey("classic") || !Backs["classic"]) throw new SaveFormatException("The classic card back must remain unlocked.");
        foreach (var stack in Stash) { if (stack is null) throw new SaveFormatException("Base stash contains a null stack."); stack.Validate(); }
        foreach (var stack in Pocket) { if (stack is null) throw new SaveFormatException("Base pocket contains a null stack."); stack.Validate(); }
        foreach (var progress in Classes.Values) { if (progress is null) throw new SaveFormatException("Base classes contains a null entry."); progress.Validate(); }
        Stats.Validate();
    }
}

public sealed class CardStackDto
{
    public JsonElement Card { get; set; }
    public int Count { get; set; } = 1;
    public void Validate()
    {
        if (Card.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null or JsonValueKind.False) throw new SaveFormatException("A base card stack is missing its card object.");
        if (Count <= 0 || Count > 10000) throw new SaveFormatException("Base card stack count is outside 1..10000.");
    }
}

public sealed class CollectionEntryDto { public string Name { get; set; } = string.Empty; public string Rarity { get; set; } = string.Empty; public long Ts { get; set; } }
public sealed class CharacterProgressDto { public int Lv { get; set; } public int Xp { get; set; } public void Validate() { if (Lv < 0 || Xp < 0) throw new SaveFormatException("Character progress cannot be negative."); } }
public sealed class BaseStatsDto
{
    public int Extracts { get; set; } public int Deaths { get; set; } public int Kills { get; set; } public int Actions { get; set; }
    public double PlaySeconds { get; set; } public List<string> BossKills { get; set; } = new(); public int BestRunCoins { get; set; } public int StashTotal { get; set; }
    public void Validate() { if (Extracts < 0 || Deaths < 0 || Kills < 0 || Actions < 0 || PlaySeconds < 0 || BestRunCoins < 0 || StashTotal < 0 || BossKills is null) throw new SaveFormatException("Base statistics are invalid."); }
}

public sealed class CardDeckDto
{
    public List<CardInstanceDto> Cards { get; set; } = new();
    public static CardDeckDto FromRuntime(CardDeck deck)
    {
        ArgumentNullException.ThrowIfNull(deck); var result = new CardDeckDto(); Add(result, deck.DrawPile, CardZone.DrawPile); Add(result, deck.Hand, CardZone.Hand); Add(result, deck.Discard, CardZone.Discard); Add(result, deck.Exhaust, CardZone.Exhaust); return result;
    }
    public CardDeck ToRuntime()
    {
        Validate(); var deck = new CardDeck();
        foreach (var card in Cards)
        {
            var runtime = new CardInstance(new StableId(card.InstanceId), new StableId(card.DefinitionId), card.UpgradeLevel, card.CostOverride);
            switch (card.Zone) { case CardZone.DrawPile: deck.AddToDrawPile(runtime); break; case CardZone.Hand: deck.AddToHand(runtime); break; case CardZone.Discard: deck.AddToDiscard(runtime); break; case CardZone.Exhaust: deck.AddToExhaust(runtime); break; default: throw new SaveFormatException($"Unknown card zone '{card.Zone}'."); }
        }
        return deck;
    }
    public void Validate()
    {
        if (Cards is null) throw new SaveFormatException("Card list is missing."); var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var card in Cards) { if (card is null || string.IsNullOrWhiteSpace(card.InstanceId) || string.IsNullOrWhiteSpace(card.DefinitionId)) throw new SaveFormatException("Every saved card needs instance and definition ids."); if (!ids.Add(card.InstanceId)) throw new SaveFormatException($"Duplicate card instance '{card.InstanceId}'."); if (card.UpgradeLevel < 0 || card.CostOverride is < 0) throw new SaveFormatException($"Invalid upgrades/cost for card '{card.InstanceId}'."); }
    }
    private static void Add(CardDeckDto dto, IReadOnlyList<CardInstance> cards, CardZone zone) { foreach (var card in cards) dto.Cards.Add(new CardInstanceDto { InstanceId = card.InstanceId.Value, DefinitionId = card.DefinitionId.Value, UpgradeLevel = card.UpgradeLevel, CostOverride = card.CostOverride, Zone = zone }); }
}

public sealed class CardInstanceDto { public string InstanceId { get; set; } = string.Empty; public string DefinitionId { get; set; } = string.Empty; public int UpgradeLevel { get; set; } public int? CostOverride { get; set; } public CardZone Zone { get; set; } }

public sealed class CombatStateDto
{
    public string PlayerId { get; set; } = string.Empty; public CombatPhase Phase { get; set; } public int Turn { get; set; } public int Energy { get; set; } public int MaxEnergy { get; set; } public List<CombatantDto> Combatants { get; set; } = new();
    public static CombatStateDto FromRuntime(CombatState state)
    {
        ArgumentNullException.ThrowIfNull(state); var dto = new CombatStateDto { PlayerId = state.PlayerId.Value, Phase = state.Phase, Turn = state.Turn, Energy = state.Energy, MaxEnergy = state.MaxEnergy }; foreach (var unit in state.Combatants) dto.Combatants.Add(new CombatantDto { Id = unit.Id.Value, Name = unit.Name, IsEnemy = unit.IsEnemy, MaxHealth = unit.MaxHealth, Health = unit.Health, Block = unit.Block, Armor = unit.Armor, Attack = unit.Attack, SpellPower = unit.SpellPower, Guard = unit.Guard, Statuses = new Dictionary<CombatStatus, int>(unit.Statuses) }); return dto;
    }
    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(PlayerId) || Combatants is null) throw new SaveFormatException("Combat save is missing player or combatants."); var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var unit in Combatants) { if (unit is null || string.IsNullOrWhiteSpace(unit.Id) || unit.MaxHealth <= 0 || unit.Health < 0 || unit.Health > unit.MaxHealth || unit.Block < 0 || unit.Armor < 0 || unit.Attack < 0 || unit.SpellPower < 0 || unit.Statuses is null || unit.Statuses.Values.Any(value => value < 0)) throw new SaveFormatException("Invalid combatant in save."); if (!ids.Add(unit.Id)) throw new SaveFormatException($"Duplicate combatant '{unit.Id}'."); }
        if (!ids.Contains(PlayerId)) throw new SaveFormatException("Saved combat player is absent from combatants."); if (Turn < 0 || Energy < 0 || MaxEnergy < 0 || Energy > MaxEnergy) throw new SaveFormatException("Combat turn or energy is invalid.");
    }
    public CombatState ToRuntime()
    {
        Validate(); var state = new CombatState(new StableId(PlayerId)); foreach (var unit in Combatants) { var runtime = new CombatantState(new StableId(unit.Id), unit.Name, unit.MaxHealth, unit.IsEnemy) { Attack = unit.Attack, SpellPower = unit.SpellPower }; if (unit.Health < unit.MaxHealth) runtime.ApplyDamage(unit.MaxHealth - unit.Health); runtime.AddBlock(unit.Block); runtime.AddArmor(unit.Armor); runtime.SetGuard(unit.Guard); foreach (var status in unit.Statuses) runtime.AddStatus(status.Key, status.Value); state.AddCombatant(runtime); } state.SetEnergy(Energy, MaxEnergy); state.RestoreTurnState(Turn, Phase); return state;
    }
}
public sealed class CombatantDto { public string Id { get; set; } = string.Empty; public string Name { get; set; } = string.Empty; public bool IsEnemy { get; set; } public int MaxHealth { get; set; } public int Health { get; set; } public int Block { get; set; } public int Armor { get; set; } public int Attack { get; set; } public int SpellPower { get; set; } public bool Guard { get; set; } public Dictionary<CombatStatus, int> Statuses { get; set; } = new(); }
public class SaveFormatException : Exception { public SaveFormatException(string message) : base(message) { } public SaveFormatException(string message, Exception inner) : base(message, inner) { } }
public sealed class SaveVersionException : SaveFormatException { public int FoundVersion { get; } public SaveVersionException(int foundVersion) : base($"Save version {foundVersion} is newer than supported version {SaveSchema.CurrentVersion}.") => FoundVersion = foundVersion; }
