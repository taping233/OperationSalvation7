using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Soudache.Battle;

// ported from 搜打撤/game/src/battle.rules.js —— 目标规则 / 不可打出判定 / 手牌代价。
// 「判定」与「结算」必须同一口径：这里的正则与 effect-steps 的执行正则一一对应。

public static class BattleRules
{
    private static readonly Regex AoePattern = new(@"所有敌人|群体|全体", RegexOptions.Compiled);
    private static readonly Regex SelfTargetPattern =
        new(@"回复\s*\d+\s*(?:点\s*生命|点?血)|净化|获得\s*\d+\s*点?\s*护甲|\+\s*\d+\s*甲|获得\s*\d+\s*点?\s*护盾|所受伤害降为", RegexOptions.Compiled);
    private static readonly Regex DeckOnlyPattern = new(@"洗入|置入牌库|放入牌库|牌库底|牌库上限", RegexOptions.Compiled);
    private static readonly Regex EnemyEffectPattern = new(
        "造成\\s*\\d+\\s*点" +
        "|\\d+\\s*[′']" +
        "|攻\\s*[（(]?\\s*[+＋\\-−]?\\s*\\d" +
        "|攻击\\s*\\d" +
        "|所有敌人|全体敌人|敌方全体|目标为敌方全体" +
        "|附加\\s*(?:\\d+\\s*层?)?(?:流血|中毒|冰冻|沉默|破甲|禁疗|陷阱|灼烧)" +
        "|(?:施加|叠加)\\s*\\d*\\s*层?(?:流血|中毒|冰冻|沉默|破甲|禁疗|陷阱|诅咒)" +
        "|消灭|降低\\s*\\d+\\s*点?攻击力|偷取[^。]{0,12}攻击力|夺取[^。]{0,12}攻击力" +
        "|无法(?:行动|使用|打出)" +
        "|沉默|冰冻|火球|迫使|对方" +
        "|使[^。]{0,12}(?:中毒|流血|冰冻|沉默)层数" +
        "|触发\\s*\\d*\\s*次?毒伤",
        RegexOptions.Compiled);

    private static readonly Regex[] HandCostPatterns =
    {
        new(@"消耗\s*(一张|两|二|三|\d+)\s*张?\s*(?:手牌中的)?(初始攻击|武术|法术|装备|牌|杀)牌?[,，]\s*(.+)$", RegexOptions.Compiled),
        new(@"选择(?:\s*手牌中)?\s*(\d+|[一两二三四五])\s*张(?:手牌中的?)?\s*(武术|法术|装备|牌)?\s*卡?[^，。；;]*?(?:施放|释放|打出)", RegexOptions.Compiled),
    };

    public static bool IsAreaEffect(CardRecord card) => AoePattern.IsMatch(card.Desc ?? "");

    /// <summary>该卡是否对敌方施加效果（结构化伤害字段优先，其次描述词条）。</summary>
    public static bool HasEnemyEffect(CardRecord card)
    {
        if (card.Dmg != 0) return true;
        if (card.DmgType == "attack") return true;
        return EnemyEffectPattern.IsMatch(card.Desc ?? "");
    }

    // 目标规则（2026-09-09 老板定向：群体卡也拖到敌人身上打出）：
    // 'enemy' = 对敌方施加效果的卡 → 拖到任意敌人身上打出（群体自动覆盖全体）
    // 'self'  = 治疗/净化/护甲/护盾/格挡类 → 拖到自己
    // null    = 无指向效果 → 直接点击打出
    public static string? TargetSideFor(CardRecord card, IReadOnlyList<string> damageTypes)
    {
        var desc = card.Desc ?? "";
        if (card.Type == "装备") return "self";
        var isMove = System.Linq.Enumerable.Contains(damageTypes, card.Type);
        var enemy = isMove ? HasEnemyEffect(card) : card.DmgType == "attack" || IsAreaEffect(card);
        if (enemy) return "enemy";
        if (card.Heal > 0 || card.Armor > 0 || SelfTargetPattern.IsMatch(desc)) return "self";
        return null;
    }

    /// <summary>手牌代价句：{n, type}（type=null 表示任意牌）。</summary>
    public static (int N, string? Type)? HandCostOf(CardRecord card)
    {
        var desc = card.Desc ?? "";
        foreach (var re in HandCostPatterns)
        {
            var m = re.Match(desc);
            if (!m.Success) continue;
            var n = TextClauses.CnNum.TryGetValue(m.Groups[1].Value, out var cn) ? cn : int.TryParse(m.Groups[1].Value, out var p) ? p : 1;
            var type = m.Groups.Count > 2 && m.Groups[2].Success ? m.Groups[2].Value : null;
            return (n, string.IsNullOrEmpty(type) || type == "牌" ? null : type);
        }
        return null;
    }

    public static bool HandCardMatches(CardRecord card, string? type)
    {
        if (string.IsNullOrEmpty(type) || type == "牌") return true;
        if (type is "杀" or "初始攻击") return Regex.IsMatch(card.Name ?? "", "^(杀|初始攻击)$");
        return card.Type == type;
    }

    /// <summary>不可打出判定（null = 可打出）。mode: 'normal' | 'boss'。</summary>
    public static string? UnplayableReasonFor(CardRecord card, string mode, IReadOnlyList<CardRecord>? handCards = null, CardRecord? selfCard = null)
    {
        if (card.Type == "资源") return "资源卡无法在对战中打出（资源在背包中使用或出售）";
        if (card.Type == "事件") return "事件卡只能在棋盘的事件格中触发，无法打出";
        if (card.Type == "生物") return "生物卡是敌人图鉴，记录敌人信息，无法打出";
        if (mode == "boss" && card.Type == "道具") return "道具卡只能在普通战斗中使用（BOSS 战牌库不含道具）";
        if (mode == "normal" && DeckOnlyPattern.IsMatch(card.Desc ?? ""))
            return "「牌库」词条只有对战 BOSS 时生效——普通战斗没有牌库与墓地，无法打出";
        if (handCards is not null)
        {
            var cost = HandCostOf(card);
            if (cost is not null)
            {
                var avail = 0;
                foreach (var e in handCards)
                {
                    if (ReferenceEquals(e, selfCard)) continue;
                    if (HandCardMatches(e, cost.Value.Type)) avail++;
                }
                if (avail < cost.Value.N)
                    return $"手牌中的{(cost.Value.Type is null ? "" : $"「{cost.Value.Type}」")}卡牌不足——需要 {cost.Value.N} 张，现有 {avail} 张";
            }
        }
        return null;
    }

    /// <summary>战斗药水栏：需要拖/点到具体敌人身上的道具；其余 null = 点击直接生效。</summary>
    public static string? ItemTargetSideFor(CardRecord? card)
    {
        if (card is null || card.Type != "道具") return null;
        var desc = card.Desc ?? "";
        if (Regex.IsMatch(desc, "附加冰冻")) return "enemy";
        if (Regex.IsMatch(desc, @"造成\s*\d+\s*点固定伤害，附加流血")) return "enemy";
        return null;
    }
}
