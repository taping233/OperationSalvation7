using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace Soudache;

// ported from src/rules.js + src/mapData.js + src/characters.js + src/cards.js (PRICE)
// Strongly typed view over the exported data/*.json contract. All tables that used to
// live as C# literals (monster pools, elites, altar bosses, chest tables, shop prices,
// numeric rules) are read from here so the JSON files remain the single source of truth.

public sealed record RunMonsterData(string Id, string Name, int Hp, int Attack, bool Elite);

public sealed record RunEncounterEntryData(string MonsterId, int Min, int Max);

/// <summary>One layer's encounter row: per-entry spawn sizes plus the optional elite roll.</summary>
public sealed record RunEncounterTableData(RunRisk Risk, IReadOnlyList<RunEncounterEntryData> Entries,
    double EliteChance, IReadOnlyList<string> ElitePool, int EliteMin, int EliteMax);

public sealed record RunBossData(string Id, string Name, int Hp, int Attack, string Affix);

/// <summary>Chest contents spec: coin range, candidate count (pickFrom or cards; PickFrom marks the
/// 3-choose-1 medium spec), boss coin-card names (金币/银币/铜币) and the boss token (员工通行证B)
/// chance. Ported from chests.js KINDS().</summary>
public sealed record RunChestKindData(string Kind, int CoinMin, int CoinMax, int Candidates, int PickFrom,
    IReadOnlyList<string> CoinCards, double TokenChance);

public sealed record RunChestKindWeightData(string Kind, int Weight);

public sealed record RunChestCountData(int Count, int Weight);

/// <summary>One layer's battle-drop row: weighted chest count/kinds or a fixed list.</summary>
public sealed record RunChestLayerData(IReadOnlyList<RunChestCountData> Counts,
    IReadOnlyList<RunChestKindWeightData> Types, IReadOnlyList<RunChestKindWeightData> FixedCounts);

public sealed record RunRandomEventData(string Text, int Weight, int CoinMin, int CoinMax, bool HasCoins, bool CreatesChest);

public sealed record CharacterData(string Id, string Name, string Class, int Index);

public sealed record GameRulesData(int DiceSides, int PlayerMaxHp, int StaminaMax, int StaminaWarn,
    int FireHeal, double FireClassCardChance, int EmergencyExitCost,
    int BagStart, int BagMax, int BagUpgradeWood,
    int SafeStart, int SafeMax, int SafeUpgradeRations,
    int StashStart, int StashMax, int StashUpgradeSlots, int StashUpgradeWood,
    int BossDeckSize, int PlayerAtk, int KeyNeeded);

/// <summary>Aggregated runtime tables loaded from data/cards.json, characters.json, map.json, rules.json.</summary>
public sealed class GameData
{
    public IReadOnlyDictionary<string, RunMonsterData> Monsters { get; }
    public IReadOnlyList<RunEncounterTableData> Encounters { get; }
    public IReadOnlyList<RunBossData> Bosses { get; }
    public IReadOnlyDictionary<string, RunChestKindData> ChestKinds { get; }
    public IReadOnlyList<string> ChestTable { get; }
    public IReadOnlyList<RunChestLayerData> LayerChests { get; }
    public IReadOnlyList<RunRandomEventData> RandomEvents { get; }
    public IReadOnlyList<CharacterData> Characters { get; }
    public GameRulesData Rules { get; }
    public IReadOnlyDictionary<string, int> CardPrices { get; }
    // —— cards.json 顶层掉落/商店表（cards.js SHOP_WEIGHTS / DROP_* / RARITIES 的导出契约）——
    public IReadOnlyDictionary<string, int> CardShopWeights { get; }
    public IReadOnlyDictionary<string, int> CardDropWeights { get; }
    public IReadOnlyList<string> CardDropTypes { get; }
    public IReadOnlyList<string> CardDropDiscountTypes { get; }
    public IReadOnlyList<string> CardRarities { get; }

    public GameData(IReadOnlyDictionary<string, RunMonsterData> monsters,
        IReadOnlyList<RunEncounterTableData> encounters, IReadOnlyList<RunBossData> bosses,
        IReadOnlyDictionary<string, RunChestKindData> chestKinds, IReadOnlyList<string> chestTable,
        IReadOnlyList<RunChestLayerData> layerChests, IReadOnlyList<RunRandomEventData> randomEvents,
        IReadOnlyList<CharacterData> characters, GameRulesData rules, IReadOnlyDictionary<string, int> cardPrices,
        IReadOnlyDictionary<string, int> cardShopWeights, IReadOnlyDictionary<string, int> cardDropWeights,
        IReadOnlyList<string> cardDropTypes, IReadOnlyList<string> cardDropDiscountTypes,
        IReadOnlyList<string> cardRarities)
    {
        Monsters = monsters ?? throw new ArgumentNullException(nameof(monsters));
        Encounters = encounters ?? throw new ArgumentNullException(nameof(encounters));
        Bosses = bosses ?? throw new ArgumentNullException(nameof(bosses));
        ChestKinds = chestKinds ?? throw new ArgumentNullException(nameof(chestKinds));
        ChestTable = chestTable ?? throw new ArgumentNullException(nameof(chestTable));
        LayerChests = layerChests ?? throw new ArgumentNullException(nameof(layerChests));
        RandomEvents = randomEvents ?? throw new ArgumentNullException(nameof(randomEvents));
        Characters = characters ?? throw new ArgumentNullException(nameof(characters));
        Rules = rules ?? throw new ArgumentNullException(nameof(rules));
        CardPrices = cardPrices ?? throw new ArgumentNullException(nameof(cardPrices));
        CardShopWeights = cardShopWeights ?? throw new ArgumentNullException(nameof(cardShopWeights));
        CardDropWeights = cardDropWeights ?? throw new ArgumentNullException(nameof(cardDropWeights));
        CardDropTypes = cardDropTypes ?? throw new ArgumentNullException(nameof(cardDropTypes));
        CardDropDiscountTypes = cardDropDiscountTypes ?? throw new ArgumentNullException(nameof(cardDropDiscountTypes));
        CardRarities = cardRarities ?? throw new ArgumentNullException(nameof(cardRarities));
    }

    public RunMonsterData RequireMonster(string id) => Monsters.TryGetValue(id, out var monster)
        ? monster
        : throw new KeyNotFoundException($"map.json monsters 表缺少怪物 '{id}'。");
    public RunChestKindData RequireChestKind(string kind) => ChestKinds.TryGetValue(kind, out var chest)
        ? chest
        : throw new KeyNotFoundException($"map.json chestKinds 表缺少箱型 '{kind}'。");

    /// <summary>Shop price by rarity, matching the web fallback `PRICE[rarity] || 2`.</summary>
    public int CardPrice(string rarity) => CardPrices.TryGetValue(rarity, out var price) ? price : 2;

    public string? BossAffix(string bossId) => Bosses.FirstOrDefault(boss => boss.Id == bossId)?.Affix;

    public CharacterData? Character(string id) => Characters.FirstOrDefault(character => character.Id == id);

    public static GameData Load(string cardsJson, string charactersJson, string mapJson, string rulesJson)
    {
        using var cards = JsonDocument.Parse(cardsJson);
        using var characters = JsonDocument.Parse(charactersJson);
        using var map = JsonDocument.Parse(mapJson);
        using var rules = JsonDocument.Parse(rulesJson);
        // map.json 外层是 { map: {...}, schemaVersion }，静态表都在 map 对象里。
        var mapRoot = Require(map.RootElement, "map");
        return new GameData(
            ParseMonsters(mapRoot),
            ParseEncounters(mapRoot),
            ParseBosses(mapRoot),
            ParseChestKinds(mapRoot),
            ParseChestTable(mapRoot),
            ParseLayerChests(mapRoot),
            ParseRandomEvents(mapRoot),
            ParseCharacters(characters.RootElement),
            ParseRules(rules.RootElement),
            ParseCardPrices(cards.RootElement),
            ParseStringIntTable(cards.RootElement, "shopWeights"),
            ParseStringIntTable(cards.RootElement, "dropWeights"),
            ParseStringList(cards.RootElement, "dropTypes"),
            ParseStringList(cards.RootElement, "dropDiscountTypes"),
            ParseStringList(cards.RootElement, "rarities"));
    }

    public static GameData LoadFromDirectory(string directory)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(directory);
        return Load(
            File.ReadAllText(Path.Combine(directory, "cards.json")),
            File.ReadAllText(Path.Combine(directory, "characters.json")),
            File.ReadAllText(Path.Combine(directory, "map.json")),
            File.ReadAllText(Path.Combine(directory, "rules.json")));
    }

    /// <summary>Locates the exported data/ directory by walking up from the binary and cwd.</summary>
    public static GameData LoadDefault() => LoadFromDirectory(FindDataDirectory());

    public static string FindDataDirectory()
    {
        var candidates = new List<string>();
        foreach (var root in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            if (string.IsNullOrWhiteSpace(root)) continue;
            var current = Path.GetFullPath(root);
            for (var i = 0; i < 8 && current is not null; i++)
            {
                candidates.Add(Path.Combine(current, "data"));
                var parent = Path.GetDirectoryName(current);
                if (parent == current || parent is null) break;
                current = parent;
            }
        }
        var found = candidates.FirstOrDefault(path => File.Exists(Path.Combine(path, "map.json")));
        return found ?? throw new FileNotFoundException(
            $"未找到 data/map.json；已探测：{string.Join(", ", candidates.Distinct())}");
    }

    // ---------- parsers (fields mirror the exported JSON contract) ----------

    private static IReadOnlyDictionary<string, RunMonsterData> ParseMonsters(JsonElement mapRoot)
    {
        var result = new Dictionary<string, RunMonsterData>(StringComparer.Ordinal);
        foreach ( var property in Require(mapRoot, "monsters").EnumerateObject())
        {
            var monster = property.Value;
            result[property.Name] = new RunMonsterData(
                ReadString(monster, "id") ?? property.Name,
                ReadString(monster, "name") ?? property.Name,
                ReadInt(monster, "hp"),
                ReadInt(monster, "atk"),
                ReadBool(monster, "elite"));
        }
        return result;
    }

    private static IReadOnlyList<RunEncounterTableData> ParseEncounters(JsonElement mapRoot)
    {
        var result = new List<RunEncounterTableData>();
        foreach (var encounter in Require(mapRoot, "encounters").EnumerateArray())
        {
            var entries = new List<RunEncounterEntryData>();
            foreach (var entry in Require(encounter, "entries").EnumerateArray())
            {
                var size = Require(entry, "size");
                var bounds = size.EnumerateArray().Select(node => node.GetInt32()).ToArray();
                entries.Add(new RunEncounterEntryData(ReadString(entry, "id") ?? "", bounds[0], bounds[^1]));
            }
            var eliteChance = 0.0;
            var elitePool = Array.Empty<string>();
            var eliteMin = 1;
            var eliteMax = 1;
            if (encounter.TryGetProperty("elite", out var elite) && elite.ValueKind == JsonValueKind.Object)
            {
                eliteChance = ReadDouble(elite, "chance");
                elitePool = Require(elite, "pool").EnumerateArray().Select(node => node.GetString() ?? "").ToArray();
                var eliteSize = Require(elite, "size").EnumerateArray().Select(node => node.GetInt32()).ToArray();
                eliteMin = eliteSize[0];
                eliteMax = eliteSize[^1];
            }
            result.Add(new RunEncounterTableData(ParseRisk(ReadString(encounter, "risk")), entries,
                eliteChance, elitePool, eliteMin, eliteMax));
        }
        return result;
    }

    private static RunRisk ParseRisk(string? risk) => risk switch
    {
        "低" => RunRisk.Low,
        "中" => RunRisk.Medium,
        "高" or "极高" => RunRisk.High,
        _ => RunRisk.Medium
    };

    private static IReadOnlyList<RunBossData> ParseBosses(JsonElement mapRoot)
    {
        var result = new List<RunBossData>();
        foreach (var boss in Require(Require(mapRoot, "altar"), "bosses").EnumerateArray())
            result.Add(new RunBossData(ReadString(boss, "id") ?? "", ReadString(boss, "name") ?? "",
                ReadInt(boss, "hp"), ReadInt(boss, "atk"), ReadString(boss, "affix") ?? ""));
        return result;
    }

    private static IReadOnlyDictionary<string, RunChestKindData> ParseChestKinds(JsonElement mapRoot)
    {
        var result = new Dictionary<string, RunChestKindData>(StringComparer.Ordinal);
        foreach (var property in Require(mapRoot, "chestKinds").EnumerateObject())
        {
            var kind = property.Value;
            var coins = kind.TryGetProperty("coins", out var coinsNode) && coinsNode.ValueKind == JsonValueKind.Array
                ? coinsNode.EnumerateArray().Select(node => node.GetInt32()).ToArray()
                : Array.Empty<int>();
            var candidates = ReadInt(kind, "pickFrom") != 0 ? ReadInt(kind, "pickFrom") : ReadInt(kind, "cards");
            var pickFrom = ReadInt(kind, "pickFrom");
            // boss 箱专属：coinCards（金币/银币/铜币按名取卡并入）与 tokenChance（员工通行证B 概率）
            var coinCards = kind.TryGetProperty("coinCards", out var coinCardsNode) && coinCardsNode.ValueKind == JsonValueKind.Array
                ? coinCardsNode.EnumerateArray().Select(node => node.GetString() ?? "").Where(name => name.Length > 0).ToArray()
                : Array.Empty<string>();
            var tokenChance = kind.TryGetProperty("tokenChance", out var tokenNode) && tokenNode.ValueKind == JsonValueKind.Number
                ? tokenNode.GetDouble() : 0.0;
            result[property.Name] = new RunChestKindData(property.Name,
                coins.Length > 0 ? coins[0] : 0, coins.Length > 0 ? coins[^1] : 0, candidates, pickFrom,
                coinCards, tokenChance);
        }
        return result;
    }

    private static IReadOnlyList<string> ParseChestTable(JsonElement mapRoot)
        => Require(mapRoot, "chestTable").EnumerateArray()
            .Select(item => ReadString(item, "name") ?? "").ToArray();

    private static IReadOnlyList<RunChestLayerData> ParseLayerChests(JsonElement mapRoot)
    {
        var result = new List<RunChestLayerData>();
        foreach ( var layer in Require(mapRoot, "layerChests").EnumerateArray())
        {
            IReadOnlyList<RunChestCountData> counts =
                layer.TryGetProperty("count", out var countNode) && countNode.ValueKind == JsonValueKind.Array
                    ? countNode.EnumerateArray().Select(item => new RunChestCountData(
                        ReadInt(item, "n"), ReadInt(item, "w"))).ToArray()
                    : Array.Empty<RunChestCountData>();
            IReadOnlyList<RunChestKindWeightData> ReadKinds(string field, string weightKey) =>
                layer.TryGetProperty(field, out var node) && node.ValueKind == JsonValueKind.Array
                    ? node.EnumerateArray().Select(item => new RunChestKindWeightData(
                        ReadString(item, "k") ?? "", ReadInt(item, weightKey))).ToArray()
                    : Array.Empty<RunChestKindWeightData>();
            // types 的权重在 w；fixed 的 n 是固定数量（借用 Weight 字段承载）。
            result.Add(new RunChestLayerData(counts, ReadKinds("types", "w"), ReadKinds("fixed", "n")));
        }
        return result;
    }

    private static IReadOnlyList<RunRandomEventData> ParseRandomEvents(JsonElement mapRoot)
    {
        var result = new List<RunRandomEventData>();
        foreach ( var ev in Require(mapRoot, "randomEvents").EnumerateArray())
        {
            var coins = ev.TryGetProperty("coins", out var coinsNode) && coinsNode.ValueKind == JsonValueKind.Array
                ? coinsNode.EnumerateArray().Select(node => node.GetInt32()).ToArray()
                : Array.Empty<int>();
            result.Add(new RunRandomEventData(ReadString(ev, "text") ?? "", ReadInt(ev, "w"),
                coins.Length > 0 ? coins[0] : 0, coins.Length > 0 ? coins[^1] : 0, coins.Length > 0,
                ReadString(ev, "item") == "chest"));
        }
        return result;
    }

    private static IReadOnlyList<CharacterData> ParseCharacters(JsonElement charactersRoot)
    {
        var result = new List<CharacterData>();
        var index = 0;
        foreach (var character in Require(charactersRoot, "characters").EnumerateArray())
        {
            result.Add(new CharacterData(ReadString(character, "id") ?? "", ReadString(character, "name") ?? "",
                ReadString(character, "rulesetId") ?? "", index++));
        }
        return result;
    }

    private static GameRulesData ParseRules(JsonElement rulesRoot)
    {
        var rules = Require(rulesRoot, "rules");
        return new GameRulesData(
            ReadInt(rules, "diceSides"), ReadInt(rules, "playerMaxHp"), ReadInt(rules, "staminaMax"),
            ReadInt(rules, "staminaWarn"), ReadInt(rules, "fireHeal"), ReadDouble(rules, "fireClassCardChance"),
            ReadInt(rules, "emergencyExitCost"),
            ReadInt(rules, "bagSize"), ReadInt(rules, "bagMax"), ReadInt(rules, "bagUpgradeWood"),
            ReadInt(rules, "safeStart"), ReadInt(rules, "safeMax"), ReadInt(rules, "safeUpgradeRations"),
            ReadInt(rules, "stashStart"), ReadInt(rules, "stashMax"), ReadInt(rules, "stashUpgradeSlots"),
            ReadInt(rules, "stashUpgradeWood"), ReadInt(rules, "bossDeckSize"),
            // playerAtk=对局攻击力（网页 game.atk）；keyNeeded=宝藏大门钥匙需求（网页 base.js KEY_NEEDED）
            ReadInt(rules, "playerAtk"), ReadInt(rules, "keyNeeded"));
    }

    private static IReadOnlyDictionary<string, int> ParseCardPrices(JsonElement cardsRoot)
        => ParseStringIntTable(cardsRoot, "price");

    private static IReadOnlyDictionary<string, int> ParseStringIntTable(JsonElement root, string field)
    {
        var result = new Dictionary<string, int>(StringComparer.Ordinal);
        if (root.TryGetProperty(field, out var table) && table.ValueKind == JsonValueKind.Object)
            foreach (var property in table.EnumerateObject())
                result[property.Name] = property.Value.GetInt32();
        return result;
    }

    private static IReadOnlyList<string> ParseStringList(JsonElement root, string field)
    {
        if (!root.TryGetProperty(field, out var list) || list.ValueKind != JsonValueKind.Array) return Array.Empty<string>();
        return list.EnumerateArray().Select(node => node.GetString() ?? "").Where(name => name.Length > 0).ToArray();
    }

    private static JsonElement Require(JsonElement element, string key) => element.TryGetProperty(key, out var value)
        ? value
        : throw new InvalidDataException($"数据 JSON 缺少字段 '{key}'。");
    private static string? ReadString(JsonElement obj, string key)
        => obj.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    private static int ReadInt(JsonElement obj, string key)
        => obj.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number) ? number : 0;
    private static double ReadDouble(JsonElement obj, string key)
        => obj.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number ? value.GetDouble() : 0;
    private static bool ReadBool(JsonElement obj, string key)
        => obj.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.True;
}

/// <summary>Process-wide data holder. The App composition root loads it from res://data;
/// tests and tools fall back to GameData.LoadDefault().</summary>
public static class GameRuntime
{
    private static GameData? _data;

    public static GameData Data => _data ??= GameData.LoadDefault();

    public static void Load(GameData data)
    {
        ArgumentNullException.ThrowIfNull(data);
        _data = data;
        RunRules.Apply(data.Rules);
    }
}
