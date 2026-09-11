using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Soudache.Battle;

// ported from 搜打撤/game/src/cards.js —— 战斗侧卡牌记录与卡库（只读数据 + 启动期词条回填）。
// data/cards.json 由批次 0 的导出管线产出（245 张）；本文件补充网页版 boot 时的
// ensureDmgTypes / ensureEffectFields 两条「只补缺失值」回填，保证引擎读到的字段与网页一致。

/// <summary>Mutable card record mirroring the exported JSON card shape.</summary>
public sealed class CardRecord
{
    public string Id = "";
    public string Name = "";
    public string Type = "";
    public int Cost;
    public int Dmg;
    public string? DmgType;
    public int Block;
    public int Armor;
    public int Heal;
    public int Draw;
    public int Infuse;
    public string Desc = "";
    public string? Cls;
    public string? Rarity;
    public int Value;
    public bool Unrandom;
    public bool? Sellable;
    public bool Hero;
    public string? TokenOf;

    /// <summary>法师锦囊容器（battle.core queuePouchCast）：置入的法术，运行时字段不入 JSON。</summary>
    public List<CardRecord>? Pouch;
    /// <summary>「无法注能」衍生标记（灵能召唤 _noInfuse）。</summary>
    public bool NoInfuse;
    /// <summary>降费角标基准价（summon.randomKeyedZero 的 _baseCost）。</summary>
    public int? BaseCost;

    public CardRecord Clone()
    {
        var copy = (CardRecord)MemberwiseClone();
        if (Pouch is not null) copy.Pouch = Pouch.Select(c => c.Clone()).ToList();
        return copy;
    }
}

public sealed class CardLib
{
    public const string ShaId = "builtin-sha";
    public static readonly string[] DmgTypes = { "武术", "法术" };
    public static readonly string[] AllTypes = { "武术", "法术", "生物", "道具", "装备", "事件", "能力卡", "资源" };
    public static readonly string[] NoCostTypes = { "道具", "生物", "资源", "装备", "事件" };
    public static readonly IReadOnlyDictionary<string, string> DmgTypeName = new Dictionary<string, string>
    {
        ["attack"] = "攻击", ["spell"] = "法术", ["fixed"] = "固定", ["true"] = "真实",
    };
    private static readonly IReadOnlyDictionary<string, int> Price = new Dictionary<string, int>
    {
        ["初始"] = 1, ["古朴"] = 2, ["稀有"] = 3, ["史诗"] = 4, ["传说"] = 5, ["棱彩"] = 8,
    };

    private readonly List<CardRecord> _cards;
    private readonly Dictionary<string, CardRecord> _byId;

    private CardLib(List<CardRecord> cards)
    {
        _cards = cards;
        _byId = cards.GroupBy(c => c.Id).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
    }

    public IReadOnlyList<CardRecord> All => _cards;
    public int Count => _cards.Count;
    public CardRecord? ById(string id) => _byId.GetValueOrDefault(id);
    public CardRecord? ByName(string name) => _cards.FirstOrDefault(c => string.Equals(c.Name, name, StringComparison.Ordinal));
    public CardRecord Sha => ById(ShaId) ?? throw new InvalidOperationException("卡库缺少「初始攻击」（builtin-sha）。");

    public static CardLib FromJson(string json)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(json);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (!root.TryGetProperty("cards", out var cards) || cards.ValueKind != JsonValueKind.Array)
            throw new InvalidDataException("Card catalog must contain a cards array.");
        var list = cards.EnumerateArray().Select(ParseCard).ToList();
        EnsureSha(list);
        EnsureDmgTypes(list);
        EnsureEffectFields(list);
        return new CardLib(list);
    }

    /// <summary>测试用：以现成记录建库（走同一条 ensure 回填链）。</summary>
    public static CardLib FromCards(IEnumerable<CardRecord> cards)
    {
        var list = cards.Select(c => c.Clone()).ToList();
        EnsureSha(list);
        EnsureDmgTypes(list);
        EnsureEffectFields(list);
        return new CardLib(list);
    }

    /// <summary>三 cwd 兼容加载（仓库根 / SoudacheGodot 根 / 测试 bin 上溯），与 NarrativeTests.LoadStoryJson 同口径。</summary>
    public static CardLib LoadDefault()
    {
        foreach (var path in CandidatePaths("cards.json"))
            if (File.Exists(path)) return FromJson(File.ReadAllText(path));
        throw new FileNotFoundException(
            "data/cards.json not found (candidates: " + string.Join(", ", CandidatePaths("cards.json")) + ")");
    }

    public static IEnumerable<string> CandidatePaths(string fileName)
    {
        yield return Path.Combine("SoudacheGodot", "data", fileName);
        yield return Path.Combine("data", fileName);
        yield return Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "data", fileName);
    }

    private static CardRecord ParseCard(JsonElement card)
    {
        var record = new CardRecord
        {
            Id = ReadString(card, "id") ?? "",
            Name = ReadString(card, "name") ?? "",
            Type = ReadString(card, "type") ?? "",
            Cost = ReadInt(card, "cost"),
            Dmg = ReadInt(card, "dmg"),
            DmgType = ReadString(card, "dmgType"),
            Block = ReadInt(card, "block"),
            Armor = ReadInt(card, "armor"),
            Heal = ReadInt(card, "heal"),
            Draw = ReadInt(card, "draw"),
            Infuse = ReadInt(card, "infuse"),
            Desc = ReadString(card, "desc") ?? "",
            Cls = ReadString(card, "cls"),
            Rarity = ReadString(card, "rarity"),
            Value = ReadInt(card, "value"),
            Hero = ReadBool(card, "hero"),
            TokenOf = ReadString(card, "tokenOf"),
        };
        if (ReadBool(card, "unrandom")) record.Unrandom = true;
        if (card.TryGetProperty("sellable", out var sellable) && sellable.ValueKind == JsonValueKind.True) record.Sellable = true;
        if (card.TryGetProperty("sellable", out var sellable2) && sellable2.ValueKind == JsonValueKind.False) record.Sellable = false;
        return record;
    }

    // —— 启动期补播（cards.js ensureSha）：缺「初始攻击」时播入 ——
    private static void EnsureSha(List<CardRecord> cards)
    {
        if (cards.Any(c => c.Id == ShaId)) return;
        cards.Insert(0, new CardRecord
        {
            Id = ShaId, Name = "初始攻击", Type = "武术", Cost = 1, Rarity = "初始", Dmg = 0,
            DmgType = "attack", Value = 1, Desc = "攻（+0）：造成等同于攻击力的伤害。",
        });
    }

    // —— cards.js deriveDmgType / ensureDmgTypes：只补缺失值 ——
    public static string? DeriveDmgType(CardRecord card)
    {
        if (!string.IsNullOrEmpty(card.DmgType)) return card.DmgType;
        var desc = card.Desc ?? "";
        if (RegexCache.AttackPoints.IsMatch(desc) || RegexCache.AttackPlus.IsMatch(desc)) return "attack";
        if (RegexCache.NotationMark.IsMatch(desc)) return "spell";
        if (RegexCache.TrueDamageHint.IsMatch(desc)) return "true";
        if (RegexCache.DealPointsDamage.IsMatch(desc)) return card.Type == "法术" ? "spell" : "fixed";
        if (card.Dmg > 0) return card.Type == "法术" ? "spell" : "fixed";
        return null;
    }

    public static void EnsureDmgTypes(List<CardRecord> cards)
    {
        foreach (var c in cards)
        {
            if (!string.IsNullOrEmpty(c.DmgType)) continue;
            var derived = DeriveDmgType(c);
            if (derived is not null) c.DmgType = derived;
        }
    }

    // —— cards.js deriveDraw/deriveInfuse/deriveHeal/deriveArmor + ensureEffectFields ——
    public static int DeriveDraw(CardRecord card)
    {
        if (card.Draw > 0) return card.Draw;
        var desc = RegexCache.FromDeckDraw.Replace(card.Desc ?? "", " ");
        desc = RegexCache.ExtraDraw.Replace(desc, " ");
        var m = RegexCache.DrawRange.Match(desc);
        if (!m.Success) m = RegexCache.DrawSimple.Match(desc);
        return m.Success ? int.Parse(m.Groups[1].Value) : 0;
    }

    public static int DeriveInfuse(CardRecord card)
    {
        if (card.Infuse > 0) return card.Infuse;
        var m = RegexCache.InfuseParen.Match(card.Desc ?? "");
        return m.Success ? (m.Groups[1].Value == "小" ? 1 : int.Parse(m.Groups[1].Value)) : 0;
    }

    public static int DeriveHeal(CardRecord card)
    {
        if (card.Heal > 0) return card.Heal;
        var m = RegexCache.HealPoints.Match(card.Desc ?? "");
        if (!m.Success) m = RegexCache.HealPlus.Match(card.Desc ?? "");
        return m.Success ? int.Parse(m.Groups[1].Value) : 0;
    }

    public static int DeriveArmor(CardRecord card)
    {
        if (card.Armor > 0) return card.Armor;
        var m = RegexCache.ArmorPoints.Match(card.Desc ?? "");
        if (!m.Success) m = RegexCache.ArmorPlus.Match(card.Desc ?? "");
        return m.Success ? int.Parse(m.Groups[1].Value) : 0;
    }

    public static void EnsureEffectFields(List<CardRecord> cards)
    {
        foreach (var c in cards)
        {
            var draw = DeriveDraw(c); if (draw > 0 && c.Draw != draw) c.Draw = draw;
            var infuse = DeriveInfuse(c); if (infuse > 0 && c.Infuse != infuse) c.Infuse = infuse;
            var heal = DeriveHeal(c); if (heal > 0 && c.Heal != heal) c.Heal = heal;
            var armor = DeriveArmor(c); if (armor > 0 && c.Armor != armor) c.Armor = armor;
        }
    }

    // —— cards.js isRandomObtainable：初始/职业/衍生/棱彩、能力卡/生物、unrandom 一律排除 ——
    public static bool IsRandomObtainable(CardRecord card)
    {
        if (card.Rarity is "初始" or "职业" or "衍生" or "棱彩") return false;
        if (card.Type is "能力卡" or "生物") return false;
        return !card.Unrandom;
    }

    // —— cards.js rarityOf / sellPrice ——
    public static string RarityOf(CardLib lib, CardRecord card)
    {
        if (IsHeroLine(lib, card)) return "棱彩";
        if (card.Rarity == "衍生" && card.TokenOf is not null)
        {
            var src = lib.ById(card.TokenOf);
            if (src is not null) return RarityOf(lib, src);
        }
        return card.Rarity ?? "";
    }

    public static bool IsHeroLine(CardLib lib, CardRecord card)
    {
        if (card.Hero) return true;
        if (card.TokenOf is not null && lib.ById(card.TokenOf) is { } src && src.Hero) return true;
        return false;
    }

    public static int SellPrice(CardLib lib, CardRecord card)
    {
        if (card.Value > 0) return card.Value;
        var rarity = RarityOf(lib, card);
        return Math.Max(1, (Price.GetValueOrDefault(rarity, 2)) / 2);
    }

    private static string? ReadString(JsonElement obj, string key)
        => obj.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static int ReadInt(JsonElement obj, string key)
        => obj.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number) ? number : 0;

    private static bool ReadBool(JsonElement obj, string key)
        => obj.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.True;
}

/// <summary>Compiled regexes shared by the battle text pipeline (ported from cards.js/effect files).</summary>
internal static class RegexCache
{
    public static readonly Regex AttackPoints = new(@"攻\s*[0-9]+\s*点", RegexOptions.Compiled);
    public static readonly Regex AttackPlus = new(@"攻\s*（?\s*[+＋⁺]\s*[0-9]+", RegexOptions.Compiled);
    public static readonly Regex NotationMark = new(@"[0-9]\s*[′']", RegexOptions.Compiled);
    public static readonly Regex TrueDamageHint = new(@"无视护甲|真实伤害", RegexOptions.Compiled);
    public static readonly Regex DealPointsDamage = new(@"造成[^。；]*[0-9]+\s*点伤害", RegexOptions.Compiled);
    public static readonly Regex FromDeckDraw = new(@"从\s*牌库[^。；;]*?抽[取]?\s*\d+\s*张[^。，；;]*", RegexOptions.Compiled);
    public static readonly Regex ExtraDraw = new(@"额外\s*抽\s*\d+\s*张[^。，；;]*", RegexOptions.Compiled);
    public static readonly Regex DrawRange = new(@"抽\s*(\d+)\s*[-—~～至]\s*(\d+)\s*张", RegexOptions.Compiled);
    public static readonly Regex DrawSimple = new(@"抽(?:取)?\s*(\d+)\s*张", RegexOptions.Compiled);
    public static readonly Regex InfuseParen = new(@"注能\s*[（(]\s*(\d+|小)\s*[)）]", RegexOptions.Compiled);
    public static readonly Regex HealPoints = new(@"回复\s*(\d+)\s*(?:点\s*生命|点?血)", RegexOptions.Compiled);
    public static readonly Regex HealPlus = new(@"\+\s*(\d+)\s*血", RegexOptions.Compiled);
    public static readonly Regex ArmorPoints = new(@"获得\s*(\d+)\s*点?\s*护甲", RegexOptions.Compiled);
    public static readonly Regex ArmorPlus = new(@"\+\s*(\d+)\s*甲", RegexOptions.Compiled);
}
