using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Soudache.Battle;

// ported from 搜打撤/game/src/battle.effects.js（splitEffectClauses/consumeTriggerTexts）
// 与 effect-steps.js（parsePoolNoun/POOL_NUM_MAP）—— 只解析文本，不读写战斗状态。

public sealed record TurnStartClause(string Text, bool Each);

/// <summary>splitEffectClauses 的稳定结算时点分桶。</summary>
public sealed class ClauseBuckets
{
    public List<string> Immediate { get; } = new();
    public List<TurnStartClause> TurnStart { get; } = new();
    public List<string> Battle { get; } = new();
    public List<string> OnInfused { get; } = new();
    public List<string> OnDraw { get; } = new();
    public List<string> Skill { get; } = new();
}

public static class TextClauses
{
    public static readonly Dictionary<string, int> PoolNumMap = new()
    {
        ["一"] = 1, ["两"] = 2, ["二"] = 2, ["三"] = 3, ["四"] = 4, ["五"] = 5,
    };

    public static readonly Dictionary<string, int> CnNum = new()
    {
        ["一"] = 1, ["两"] = 2, ["二"] = 2, ["三"] = 3, ["四"] = 4, ["五"] = 5,
    };

    public static int Num(string s) => CnNum.TryGetValue(s, out var n) ? n : int.Parse(s);

    private static readonly Regex OnInfusedLead = new(@"^被注能时[：:，,]?\s*(.+)$", RegexOptions.Compiled);
    private static readonly Regex OnDrawLead = new(@"^抽到(?:该牌|到该牌)?时(?:施放)?[:：]?\s*(.+)$", RegexOptions.Compiled);
    private static readonly Regex TurnStartLead =
        new(@"^(每回合开始时|每回合开始|下回合开始时|下回合开始|下个回合开始时|下个回合开始|回合开始时|回合开始)[：:，,]?\s*(.+)$", RegexOptions.Compiled);
    private static readonly Regex TurnStartEach = new(@"^每回合开始", RegexOptions.Compiled);
    private static readonly Regex SkillLead = new(@"^限定技能[：:]\s*(.+)$", RegexOptions.Compiled);
    private static readonly Regex BattleLead = new(@"^(本局对战内|本场对战|本场战斗)", RegexOptions.Compiled);
    private static readonly Regex BattleInnerLead = new(@"^(本局对战内|本场对战|本场战斗)[中内]?[：:，,]?\s*", RegexOptions.Compiled);
    private static readonly Regex ConsumeTriggerLead = new(@"^消耗该牌时[：:，,]?\s*(.+)$", RegexOptions.Compiled);

    /// <summary>将卡牌自然语言拆成稳定的结算时点（只解析文本，不读写战斗状态）。</summary>
    public static ClauseBuckets SplitEffectClauses(string? description)
    {
        var outBuckets = new ClauseBuckets();
        foreach (var source in Regex.Split(description ?? "", "[。；;\n]"))
        {
            var text = source.Trim();
            if (text.Length == 0) continue;
            var m = OnInfusedLead.Match(text);
            if (m.Success) { outBuckets.OnInfused.Add(m.Groups[1].Value); continue; }
            m = OnDrawLead.Match(text);
            if (m.Success) { outBuckets.OnDraw.Add(m.Groups[1].Value); continue; }
            m = TurnStartLead.Match(text);
            if (m.Success)
            {
                outBuckets.TurnStart.Add(new TurnStartClause(m.Groups[2].Value, TurnStartEach.IsMatch(text)));
                continue;
            }
            m = SkillLead.Match(text);
            if (m.Success) { outBuckets.Skill.Add(m.Groups[1].Value); continue; }
            if (BattleLead.IsMatch(text)) { outBuckets.Battle.Add(text); continue; }
            outBuckets.Immediate.Add(text);
        }
        return outBuckets;
    }

    /// <summary>「本局对战内」前缀剥离（effect-verbs.test 覆盖度与执行器一致的内层文本）。</summary>
    public static string BattleClauseInner(string text) => BattleInnerLead.Replace(text, "");

    /// <summary>「消耗该牌时」触发句提取（注能牺牲 / 手选消耗两类消耗时点调用）。</summary>
    public static List<string> ConsumeTriggerTexts(string? description)
    {
        var result = new List<string>();
        foreach (var clause in Regex.Split(description ?? "", "[。；;\n]"))
        {
            var m = ConsumeTriggerLead.Match(clause.Trim());
            if (m.Success) result.Add(m.Groups[1].Value);
        }
        return result;
    }

    // ---------- 限制卡池解析（老板 2026-09-08 定版池子清单） ----------
    private static readonly Regex CurseDescRe = new(@"诅咒|中毒|流血|冰冻|沉默|破甲|禁疗|灼烧", RegexOptions.Compiled);
    private static readonly Regex CostPrefix = new(@"^([0-5一二三四五])费", RegexOptions.Compiled);
    private static readonly Regex CurseCapablePrefix = new(@"^能施加诅咒", RegexOptions.Compiled);
    private static readonly Regex CurseCapableStrip = new(@"^能施加诅咒的?", RegexOptions.Compiled);
    private static readonly Regex OtherClassPrefix = new(@"^(其它|其他)职业", RegexOptions.Compiled);
    private static readonly Regex MyClassPrefix = new(@"^本职业", RegexOptions.Compiled);
    private static readonly Regex MovePrefix = new(@"^招式", RegexOptions.Compiled);
    private static readonly Regex LegendaryOrPower = new(@"^(传说|史诗|稀有|古朴)或能力", RegexOptions.Compiled);
    private static readonly Regex SeriesSuffix = new(@"系列$", RegexOptions.Compiled);
    private static readonly Regex SeriesBase = new(@"系列$", RegexOptions.Compiled);
    private static readonly Regex InfusePrefix = new(@"^注能", RegexOptions.Compiled);
    private static readonly string[] TypeKeys = { "武术", "法术", "装备", "能力卡", "道具" };
    private static readonly string[] RarityKeys = { "传说", "史诗", "稀有", "古朴" };
    private static readonly string[] NamedSeries = { "火球", "箭", "箭矢", "药水", "杀", "禁咒", "形态" };

    private static bool IsCurseCapable(CardRecord c)
        => new[] { "武术", "法术", "装备", "能力卡" }.Contains(c.Type) && CurseDescRe.IsMatch(c.Desc ?? "");

    /// <summary>
    /// 「发现 / 随机获取 / 获得 N 张 ____卡/牌」句式中的名词短语 → 卡池谓词。
    /// 返回 null = 未识别出限定（走通用随机池，IsRandomObtainable 过滤）。
    /// </summary>
    public static Func<CardRecord, bool>? ParsePoolNoun(string? raw, string? myClass)
    {
        var s = raw ?? "";
        if (!s.EndsWith("能力卡", StringComparison.Ordinal)) s = Regex.Replace(s, "(卡牌|的牌|牌|卡)$", "");
        s = Regex.Replace(s, "的$", "");
        if (s.Length == 0 || s is "随机" or "另" or "任意" or "等量随机") return null;
        var preds = new List<Func<CardRecord, bool>>();
        var cm = CostPrefix.Match(s);
        if (cm.Success)
        {
            var n = PoolNumMap.TryGetValue(cm.Groups[1].Value, out var cn) ? cn : int.Parse(cm.Groups[1].Value);
            s = s[cm.Length..];
            preds.Add(c => c.Cost == n);
        }
        if (CurseCapablePrefix.IsMatch(s))
        {
            s = CurseCapableStrip.Replace(s, "");
            preds.Add(IsCurseCapable);
        }
        if (OtherClassPrefix.IsMatch(s)) { s = ""; preds.Add(c => !string.IsNullOrEmpty(c.Cls) && !string.IsNullOrEmpty(myClass) && c.Cls != myClass); }
        else if (MyClassPrefix.IsMatch(s)) { s = ""; preds.Add(c => !string.IsNullOrEmpty(c.Cls) && c.Cls == myClass); }
        if (MovePrefix.IsMatch(s)) { s = MovePrefix.Replace(s, ""); preds.Add(c => c.Type == "武术"); }
        var om = LegendaryOrPower.Match(s);
        if (om.Success) { s = ""; preds.Add(c => c.Rarity == om.Groups[1].Value || c.Type == "能力卡"); }
        var typeKey = TypeKeys.FirstOrDefault(t => s == t);
        if (typeKey is not null) { s = ""; preds.Add(c => c.Type == typeKey); }
        var rarKey = RarityKeys.FirstOrDefault(r => s == r);
        if (rarKey is not null) { s = ""; preds.Add(c => c.Rarity == rarKey); }
        var series = SeriesSuffix.IsMatch(s);
        var baseNoun = SeriesBase.Replace(s, "");
        if (NamedSeries.Contains(baseNoun))
        {
            s = "";
            var key = baseNoun == "箭矢" ? "箭" : baseNoun;
            if (key == "杀") preds.Add(c => c.Id == "builtin-sha" || c.Name == "杀" || c.Name == "初始攻击");
            else if (key == "火球") preds.Add(series ? (c => (c.Name ?? "").Contains("火球")) : (Func<CardRecord, bool>)(c => c.Name == "火球"));
            else if (key == "箭") preds.Add(c => (c.Name ?? "").Contains("箭"));
            else if (key == "药水") preds.Add(c => c.Type == "道具" && (c.Name ?? "").Contains("药水"));
            else if (key == "禁咒") preds.Add(c => (c.Name ?? "").StartsWith("禁咒", StringComparison.Ordinal));
            else if (key == "形态") preds.Add(c => Regex.IsMatch(c.Name ?? "", "形态"));
        }
        if (InfusePrefix.IsMatch(s))
        {
            s = "";
            preds.Add(c => c.Infuse > 0 || Regex.IsMatch(c.Desc ?? "", "注能"));
        }
        if (preds.Count == 0 || s.Length > 0) return null;   // 有未识别的残留名词 → 交回通用池
        return c => preds.All(p => p(c));
    }
}
