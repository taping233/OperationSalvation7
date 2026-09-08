using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Soudache;

/// <summary>Loads the exported cards.json without embedding card names or numbers in code.</summary>
public sealed class CardCatalog
{
    private readonly ContentRegistry<CardDefinition> _registry = new();
    public IReadOnlyList<CardDefinition> All => _registry.All;
    public int Count => _registry.Count;
    public bool TryGet(StableId id, out CardDefinition? definition) => _registry.TryGet(id, out definition);
    public CardDefinition GetRequired(StableId id) => _registry.GetRequired(id);

    public static CardCatalog Load(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) throw new ArgumentException("Card catalog JSON is required.", nameof(json));
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (!root.TryGetProperty("cards", out var cards) || cards.ValueKind != JsonValueKind.Array)
            throw new InvalidDataException("Card catalog must contain a cards array.");
        var catalog = new CardCatalog();
        foreach (var card in cards.EnumerateArray()) catalog._registry.Register(ParseCard(card));
        return catalog;
    }

    public static CardCatalog LoadFile(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        return Load(File.ReadAllText(path));
    }

    public static CardDefinition ParseCard(JsonElement card)
    {
        var id = new StableId(ReadString(card, "id") ?? throw new InvalidDataException("Card id is required."));
        var name = ReadString(card, "name") ?? id.Value;
        var type = ParseType(ReadString(card, "type"));
        var cost = Math.Max(0, ReadInt(card, "cost"));
        var damage = ReadInt(card, "dmg");
        var block = Math.Max(0, ReadInt(card, "block"));
        var armor = Math.Max(0, ReadInt(card, "armor"));
        var heal = Math.Max(0, ReadInt(card, "heal"));
        var draw = Math.Max(0, ReadInt(card, "draw"));
        var description = ReadString(card, "desc") ?? string.Empty;
        var dmgType = ParseDamageType(ReadString(card, "dmgType"));
        var effects = BuildEffects(damage, dmgType, type, block, armor, heal, draw, description);
        return new CardDefinition(id, name, type, cost, damage, block, heal, draw,
            exhaustOnPlay: Regex.IsMatch(description, "(?:本牌|此牌|这张牌).*(?:消耗|耗尽)|(?:消耗|耗尽).*(?:本牌|此牌|这张牌)"),
            dmgType: dmgType, effects: effects, description: description, armor: armor);
    }

    private static IReadOnlyList<CardEffect> BuildEffects(int damage, DamageType damageType, CardType type,
        int block, int armor, int heal, int draw, string description)
    {
        var effects = new List<CardEffect>();
        var area = Regex.IsMatch(description, "所有敌人|敌方全体|全体敌人|对全体");
        if ((damageType == DamageType.Attack || damage != 0) && (damage != 0 || damageType == DamageType.Attack))
            effects.Add(CardEffect.Damage(damage, damageType, area ? EffectTarget.AllEnemies : EffectTarget.SelectedEnemy));
        if (block > 0) effects.Add(CardEffect.Block(block));
        if (armor > 0) effects.Add(CardEffect.Armor(armor));
        if (heal > 0) effects.Add(CardEffect.Heal(heal));
        if (draw > 0) effects.Add(CardEffect.Draw(draw));

        if (block == 0)
        {
            var bm = Regex.Match(description, "(?:获得|增加)\\s*(\\d+)\\s*点?格挡");
            if (bm.Success) effects.Add(CardEffect.Block(int.Parse(bm.Groups[1].Value)));
        }
        if (armor == 0)
        {
            var am = Regex.Match(description, "(?:获得|增加)\\s*(\\d+)\\s*点?护甲");
            if (am.Success) effects.Add(CardEffect.Armor(int.Parse(am.Groups[1].Value)));
        }
        if (draw == 0)
        {
            var dm = Regex.Match(description, "抽\\s*(\\d+)\\s*张");
            if (dm.Success) effects.Add(CardEffect.Draw(int.Parse(dm.Groups[1].Value)));
        }
        var em = Regex.Match(description, "获得\\s*(\\d+)\\s*点?能量");
        if (em.Success) effects.Add(CardEffect.Energy(int.Parse(em.Groups[1].Value)));
        if (Regex.IsMatch(description, "消耗所有手牌|消耗全部手牌"))
            effects.Add(new CardEffect(CardEffectKind.Exhaust, 0, target: EffectTarget.Hand));
        else if (Regex.IsMatch(description, "弃置所有手牌|弃弃所有手牌"))
            effects.Add(new CardEffect(CardEffectKind.Discard, 0, target: EffectTarget.Hand));

        AddStatus(effects, description, "流血", CombatStatus.Bleed, area);
        AddStatus(effects, description, "中毒", CombatStatus.Poison, area);
        AddStatus(effects, description, "冰冻|冻结", CombatStatus.Freeze, area);
        AddStatus(effects, description, "破甲", CombatStatus.ArmorBreak, area);
        AddStatus(effects, description, "沉默", CombatStatus.Silence, area);
        AddStatus(effects, description, "禁疗", CombatStatus.HealingBan, area);
        if (Regex.IsMatch(description, "潜行")) effects.Add(CardEffect.ApplyStatus(CombatStatus.Stealth, ReadDuration(description, 1), ReadDuration(description, 1), EffectTarget.Self));
        if (Regex.IsMatch(description, "免疫伤害|无敌")) effects.Add(CardEffect.ApplyStatus(CombatStatus.Immune, ReadDuration(description, 1), ReadDuration(description, 1), EffectTarget.Self));
        var reduce = Regex.Match(description, "减伤\\s*(\\d+)?");
        if (reduce.Success) effects.Add(CardEffect.ApplyStatus(CombatStatus.DamageReduction, reduce.Groups[1].Success ? int.Parse(reduce.Groups[1].Value) : 1, ReadDuration(description, 0), EffectTarget.Self));
        return effects.AsReadOnly();
    }

    private static void AddStatus(List<CardEffect> effects, string text, string pattern, CombatStatus status, bool area)
    {
        var applies = status == CombatStatus.Freeze
            ? Regex.IsMatch(text, "(?:附加|施加)?\\s*(?:冰冻|冻结)(?:所有|\\s*[一二两三四五\\d]*\\s*名?)?(?:敌人|角色|持续|与|[，。；、]|$)")
            : Regex.IsMatch(text, $"(?:附加|施加|获得)\\s*[^。；]*{pattern}");
        if (!applies || Regex.IsMatch(text, "延长|免疫|对冰冻|冰冻角色")) return;
        var n = Regex.Match(text, $"(?:{pattern})\\s*(\\d+)\\s*层?").Groups[1];
        var amount = n.Success ? int.Parse(n.Value) : 1;
        var duration = ReadDuration(text, status is CombatStatus.Freeze or CombatStatus.Silence or CombatStatus.ArmorBreak or CombatStatus.HealingBan ? 1 : 0);
        effects.Add(CardEffect.ApplyStatus(status, amount, duration, area ? EffectTarget.AllEnemies : EffectTarget.SelectedEnemy));
    }

    private static int ReadDuration(string text, int fallback)
    {
        var match = Regex.Match(text, "(?:持续|状态)?\\s*(\\d+)\\s*回合");
        return match.Success ? int.Parse(match.Groups[1].Value) : fallback;
    }

    private static CardType ParseType(string? type) => type switch
    {
        "武术" => CardType.Attack,
        "法术" => CardType.Skill,
        "装备" => CardType.Equipment,
        "资源" => CardType.Resource,
        "事件" => CardType.Event,
        "英雄卡" => CardType.Power,
        _ => CardType.Skill
    };

    private static DamageType ParseDamageType(string? type) => type switch
    {
        "attack" => DamageType.Attack,
        "spell" => DamageType.Spell,
        "true" => DamageType.True,
        _ => DamageType.Fixed
    };

    private static string? ReadString(JsonElement obj, string key)
        => obj.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static int ReadInt(JsonElement obj, string key)
        => obj.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number) ? number : 0;
}
