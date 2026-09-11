using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Godot;

namespace SoudacheGodot.UI;

/// <summary>
/// 卡牌图鉴数据层（只读 data/cards.json，UI 自解析，不依赖 Core）。
/// 语义对照网页版 搜打撤/game/src/cards.js + game.cardslib.js libFiltered()：
/// 筛选 = 类型页签 + 有效稀有度 + 名称/描述子串；排序 = 费用升 → 稀有度降 → 名称 zh。
/// RarityOf：能力卡及其衍生牌（Hero / TokenOf→Hero 链）推导为「棱彩」（cards.js rarityOf，2026-09-04 定版）；
/// 衍生牌继承 TokenOf 源卡稀有度（环引用深度护栏 8）。SellPrice 对齐 cards.js sellPrice（币值优先 / 稀有度半价）。
/// </summary>
public sealed class CodexCatalog
{
    public sealed record CodexCard(
        string Id, string Name, int Cost, string Rarity, string Type, string Desc,
        int Dmg, string DmgType, int Value, int Draw, int Infuse, int Heal, int Armor,
        string Cls, bool Hero, string TokenOf, bool Unrandom, bool Sellable, string Art);

    // cards.js:93-95 常量（顺序即排序权重、稀有度下拉顺序与 tp/rv 样式索引）
    public static readonly string[] Rarities = { "初始", "古朴", "稀有", "史诗", "传说", "衍生", "职业", "棱彩" };
    public static readonly string[] Types = { "武术", "法术", "生物", "道具", "装备", "事件", "能力卡", "资源" };
    public static readonly string[] DmgTypes = { "武术", "法术" };

    // 合成配方卡 id（与 src/Core/Run/TokenCraft.cs 同源，game.bag.js craftColorToken 家族；UI 展示用）
    public const string TokenGoldId = "tt-token-gold";   // 员工通行证B
    public const string TokenColorId = "tt-token-color"; // 员工通行证A
    public const string ColorTokenId = "cmtmvq6ss84l";   // 彩色令牌

    private static CodexCatalog? _instance;
    public static CodexCatalog Default => _instance ??= new CodexCatalog();

    public IReadOnlyList<CodexCard> Cards { get; }
    private readonly Dictionary<string, CodexCard> _byId = new(StringComparer.Ordinal);
    private readonly Dictionary<string, CodexCard> _firstByName = new(StringComparer.Ordinal);
    private readonly Dictionary<string, int> _price = new(StringComparer.Ordinal);

    private CodexCatalog()
    {
        var list = new List<CodexCard>();
        var json = Json.ParseString(ReadResourceText("res://data/cards.json")).AsGodotDictionary();
        foreach (var element in json["cards"].AsGodotArray())
        {
            var c = element.AsGodotDictionary();
            var card = new CodexCard(
                Text(c, "id"),
                Text(c, "name"),
                Int(c, "cost"),
                Text(c, "rarity"),
                Text(c, "type"),
                Text(c, "desc"),
                Int(c, "dmg"),
                Text(c, "dmgType"),
                Int(c, "value"),
                Int(c, "draw"),
                Int(c, "infuse"),
                Int(c, "heal"),
                Int(c, "armor"),
                Text(c, "cls"),
                c.TryGetValue("hero", out var hero) && hero.AsBool(),
                Text(c, "tokenOf"),
                c.TryGetValue("unrandom", out var unrandom) && unrandom.AsBool(),
                c.TryGetValue("sellable", out var sellable) && sellable.AsBool(),
                Text(c, "art"));
            list.Add(card);
            _byId[card.Id] = card;
            if (!_firstByName.ContainsKey(card.Name)) _firstByName[card.Name] = card;
        }
        if (json.TryGetValue("price", out var priceNode))
            foreach (var (key, value) in priceNode.AsGodotDictionary())
                _price[key.AsString()] = value.AsInt32();
        Cards = list;
    }

    private static string Text(Godot.Collections.Dictionary c, string key)
        => c.TryGetValue(key, out var value) ? value.AsString() ?? "" : "";

    private static int Int(Godot.Collections.Dictionary c, string key)
        => c.TryGetValue(key, out var value) ? value.AsInt32() : 0;

    private static string ReadResourceText(string path)
    {
        var file = FileAccess.Open(path, FileAccess.ModeFlags.Read);
        if (file == null) throw new InvalidOperationException($"missing data file: {path}");
        using (file) return file.GetAsText();
    }

    public CodexCard? ById(string id) => _byId.GetValueOrDefault(id);

    /// <summary>按名取首张（hub 仓库行 InventoryLabels「名 ×N」反查 meta 用；同名多 id 时取卡库首个）。</summary>
    public CodexCard? ByName(string name) => _firstByName.GetValueOrDefault(name);

    /// <summary>cards.js rarityOf：棱彩推导（衍生牌递归源卡；深度护栏防环）。</summary>
    public string RarityOf(CodexCard card, int depth = 0)
    {
        if (IsHeroLine(card, depth)) return "棱彩";
        if (card.Rarity == "衍生" && card.TokenOf.Length > 0 && depth < 8)
        {
            var source = ById(card.TokenOf);
            if (source != null) return RarityOf(source, depth + 1);
        }
        return card.Rarity;
    }

    private bool IsHeroLine(CodexCard card, int depth)
    {
        if (card.Hero) return true;
        return depth < 8 && card.TokenOf.Length > 0 && ById(card.TokenOf) is { Hero: true };
    }

    public int RarityRank(string rarity) => Array.IndexOf(Rarities, rarity);

    /// <summary>cards.js sellPrice：币值优先；无币值按价格表半价（至少 1）。</summary>
    public int SellPrice(CodexCard card)
    {
        if (card.Value > 0) return card.Value;
        var rarity = RarityOf(card);
        return Math.Max(1, _price.GetValueOrDefault(rarity, 2) / 2);
    }

    /// <summary>
    /// game.cardslib.js libFiltered()：类型/有效稀有度/名称描述子串筛选 +
    /// cost 升 → 有效稀有度降（RARITIES 序靠后者在前）→ 名称 zh 排序。
    /// </summary>
    public List<CodexCard> Filtered(string tab, string rarity, string query)
    {
        var q = query.Trim().ToLowerInvariant();
        var culture = System.Globalization.CultureInfo.GetCultureInfo("zh-Hans-CN");
        return Cards
            .Where(c => (tab == "全部" || c.Type == tab)
                        && (rarity == "全部" || RarityOf(c) == rarity)
                        && (q.Length == 0 || c.Name.ToLowerInvariant().Contains(q) || c.Desc.ToLowerInvariant().Contains(q)))
            .OrderBy(c => c.Cost)
            .ThenByDescending(c => RarityRank(RarityOf(c)))
            .ThenBy(c => c.Name, StringComparer.Create(culture, true))
            .ToList();
    }

    /// <summary>类型页签计数（「全部」= 全量；对应 renderCardLibrary counts 表）。</summary>
    public int CountByType(string type)
        => type == "全部" ? Cards.Count : Cards.Count(c => c.Type == type);

    /// <summary>
    /// art.js cardFamily() 家族近似映射到本工程 assets/cards/ 位图（完整专属卡图未随批次导入，
    /// 对照表见 REFERENCE_SOURCES.md 6b' 节）。
    /// </summary>
    public string FamilyArt(CodexCard card)
    {
        switch (card.Type)
        {
            case "能力卡":
                return "res://assets/cards/hero.webp";
            case "武术":
                // 网页分 martial-melee/martial-ranged 家族（/箭|射|弓/），本工程仅武器家族位图，统一取 equipment-weapon
                return "res://assets/cards/equipment-weapon.webp";
            case "法术":
                // 网页分 spell/healing（/治|愈|疗|回复/），本工程统一 spell 家族位图
                return "res://assets/cards/spell.webp";
            case "资源":
                return "res://assets/cards/resource-material.webp";
            // 生物/道具/装备/事件：本工程无对应家族位图（网页走 items/creature/event 专属图），回退 unknown
            default:
                return "res://assets/cards/unknown.webp";
        }
    }
}
