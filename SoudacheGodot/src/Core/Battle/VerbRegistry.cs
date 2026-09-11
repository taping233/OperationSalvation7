using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Soudache.Battle;

// ported from 搜打撤/game/src/effect-verbs.js —— 牌效动词注册表 + 未识别子句哨兵。
// 三张表：VERBS（已实装动词）/ ELSEWHERE（执行器之外的层实装，句式与门控逐条冻结）/
// DESIGNER_BLANKS（已知设计者留白）。执行器跑完一句若「什么都没发生」且三表都不认识，
// 哨兵记入 UnknownEffects；StrictMode 下直接抛 UnknownClauseException（显式失败，带卡 id+子句文本）。

public sealed class VerbEntry
{
    public string Id;
    public string Label;
    public string Impl;
    public string? Gate;
    public Regex Pattern;
    /// <summary>正则源文本（与网页版 pattern.source 冻结对齐用）。</summary>
    public string Source;

    public VerbEntry(string id, string label, string impl, string pattern, string? gate = null)
    {
        Id = id; Label = label; Impl = impl; Gate = gate; Source = pattern;
        Pattern = new Regex(pattern, RegexOptions.Compiled);
    }
}

public sealed class UnknownClauseException : Exception
{
    public string CardId { get; }
    public string ClauseText { get; }

    public UnknownClauseException(string cardId, string cardName, string clauseText)
        : base($"未识别子句（卡 {cardId}「{cardName}」）：{clauseText}")
    {
        CardId = cardId; ClauseText = clauseText;
    }
}

public sealed record UnknownEffectEntry(string Text, string Card, int Count);

public static class EffectVerbs
{
    // 句式里出现这些词才被当成「有效果要结算」，纯风味句（如「向深渊献上敬意」）不报警。
    private static readonly Regex ActionRe =
        new(@"造成|伤害|抽|发现|获得|获取|随机|洗入|置入|放入|消耗|攻击|冰冻|冻结|中毒|流血|沉默|破甲|禁疗|净化|回复|治疗|护甲|护盾|能量|法术伤害|法伤|召唤|释放|施放|打出|化为|消灭|复活|弃|免疫|无敌|偷取|降低|翻倍|复制|替换|逃跑|潜行|变为|变成|延长|升|夺|诱发|诅咒|门|枪|箭|杀|张|枚|种|层|回合|费|攻击力", RegexOptions.Compiled);

    public static bool LooksLikeEffect(string? text) => !string.IsNullOrEmpty(text) && ActionRe.IsMatch(text);

    // ---------- 1. 已实装的效果动词（检测句式，与 EffectSteps 结算步骤一一对应） ----------
    public static readonly VerbEntry[] Verbs =
    {
        new("attackMod", "攻击力增减（攻+N / 攻（-N）/ 获得 N 点攻击力）", "EffectSteps", @"攻\s*[（(]?\s*[+＋\-−]?\s*\d|获得\s*\d+\s*点攻击力|攻击力?\s*\+\s*\d|本回合攻击\s*\+\s*\d|攻击\s*\+\s*\d"),
        new("damage", "造成伤害（N 点攻击/法术/固定/真实伤害）", "EffectSteps", @"造成[\s\d一两二三四五六七八九十]*点?(?:攻击|法术|固定|真实)?伤害|\d+\s*点?(?:法术|固定|真实)伤害|造成等同于|伤害\s*\+\s*\d"),
        new("aoeDamage", "对全体/多目标伤害", "EffectSteps", @"对所有敌|对全体敌|攻击全体敌|敌方全体|目标为敌方全体|目标为全体敌人|对随机敌"),
        new("aoeFixedByPrice", "按价格折算的全体固定伤害", "EffectSteps", @"造成等同于其价格的固定伤害"),
        new("damageRepeat", "伤害/效果触发 N 次", "EffectSteps", @"触发\s*\d+\s*次|攻击\s*\d+\s*次|[‘'’”]?\d+[′'’”]"),
        new("selfDamage", "自伤", "EffectSteps", @"受到\s*\d+\s*点?伤害|损失\s*\d+\s*点?(?:生命|血)|回合开始\s*-\s*\d+\s*血|每次?消耗[^。]*?-\s*\d+\s*血"),
        new("heal", "回复生命", "EffectSteps", @"回复[\s\d一两二三四五六七八九十]*点?(?:生命|血)|回血|\+\s*\d+\s*血|回复等量生命|回复\s*至\s*\d+\s*血|治疗所有队友|治疗全体"),
        new("armor", "获得护甲", "EffectSteps", @"\+?\s*\d+\s*(?:点)?甲|获得\s*\d+\s*点护甲|护甲\s*\+\s*\d+"),
        new("draw", "抽牌", "EffectSteps", @"抽\s*[\d一两二三四五六七八九十]+(?:\s*-\s*\d+)?\s*张|抽牌|抽出\s*\d+\s*张"),
        new("drawUntil", "抽到指定手牌数 / 从牌库定向抽取", "EffectSteps", @"抽牌[^。；]*?直到|直到有\s*\d+\s*张手牌|从牌库(?:中|底)?(?:抽取|发现|取)\s*\d*\s*张?"),
        new("noDraw", "下回合无法抽牌", "EffectSteps", @"下(?:个)?回合无法抽牌"),
        new("curseAdd", "附加诅咒（流血/中毒/冰冻/沉默/破甲/禁疗/灼烧）", "EffectSteps", @"附加[^。；]*(流血|中毒|冰冻|冻结|沉默|破甲|禁疗|灼烧)|施加[^。；]*(流血|中毒|灼烧)|冰冻\s*(?:所有|\d|[一两二三四五])|冻结|沉默\s*\d|破甲|禁疗|中毒层数翻倍|延长[^。]*冰冻"),
        new("curseRandom", "随机诅咒", "EffectSteps", @"随机诅咒|种随机诅咒|每有\s*1\s*种诅咒|诅咒状态"),
        new("curseCopyAll", "复制手牌招式上的全部诅咒", "EffectSteps", @"附加手牌中的招式所具有的全部诅咒"),
        new("purify", "净化自身", "EffectSteps", @"净化"),
        new("poisonBurst", "立即触发毒伤", "EffectSteps", @"立即触发[^。]*次毒伤|触发\s*1\s*次毒伤"),
        new("discover", "发现 N 张牌（可限定卡池）", "EffectSteps", @"发现\s*(?:一|1|\d+|两)\s*[张种瓶枚]|每当你发现卡牌时|发现卡牌时"),
        new("discoverAndCast", "发现并直接施放 / 获取剩余", "EffectSteps", @"并直接释放|并直接施放|并(?:直接)?(?:施放|释放)|选择其中\s*(?:1|一)\s*张直接施放|获取剩下"),
        new("discoverCopy", "发现并额外获得复制", "EffectSteps", @"额外获得\s*1\s*张复制|并额外获得|获得一张随机手牌的复制"),
        new("discoverInfuseFree", "发现注能卡并免注能", "EffectSteps", @"发现\s*(?:一|1)\s*张注能卡|使其无需注能"),
        new("potionDiscover", "发现药水并直接释放", "EffectSteps", @"发现\s*1?\s*瓶药水"),
        new("getRandomCard", "随机获取卡牌（可限定数量/卡池）", "EffectSteps", @"随机获取|获取\s*\d*\s*张|获得\s*\d+\s*张(?:随机|重斩|临时|传说|能力)"),
        new("getSpecificCard", "获取指定牌（置入手牌）", "EffectSteps", @"获取(?:一张|1\s*张)?[^。；]*卡|获得\s*1\s*个?员工通行证|获取本职业的能力卡|获取一张能力卡|获取\s*1\s*张传说卡"),
        new("deckInsert", "洗入/置入牌库", "EffectSteps", @"洗入牌库|置入[^。；]*牌库|从牌库中抽取|将[^。；]*(?:洗入|置入)"),
        new("handInsert", "置入手牌 / 置入至满手牌", "EffectSteps", @"置入手牌|置入随机卡牌直至|置入\s*\d+\s*张|将\s*\d+\s*张"),
        new("costMod", "费用变化（变为 0 费 / 费用 -N）", "EffectSteps", @"变为\s*0\s*费|本牌变为\s*0\s*费|费用\s*-\s*\d|费用-1|费用均-1|费用为\s*0|费用变为\s*0|招式均为\s*1\s*费"),
        new("energyGain", "获得能量", "EffectSteps", @"(?:获得|回复)\s*\d+\s*点?能量"),
        new("energyCapUp", "能量上限 +N", "EffectSteps", @"能量上限\s*\+\s*\d"),
        new("maxHpUp", "血量上限 / 牌库上限 +N", "EffectSteps", @"血量上限\s*\+\s*\d|牌库上限\s*\+\s*\d"),
        new("spellPowerUp", "法伤 +N", "EffectSteps", @"法伤\s*\+\s*\d"),
        new("summonAlly", "召唤随从", "EffectSteps", @"召唤\s*[^\s（(，。；;、]+"),
        new("extraTurn", "获得额外回合", "EffectSteps", @"获得\s*1\s*个额外回合"),
        new("noDrawOrSkip", "跳过敌方阶段/无法行动", "EffectSteps", @"无法行动|跳过[^。；]*阶段"),
        new("stealth", "潜行", "EffectSteps", @"潜行|遁入虚空"),
        new("tauntOthers", "迫使敌人相互攻击", "EffectSteps", @"迫使其?相互攻击|相互攻击"),
        new("stealAtk", "偷取/夺取/降低敌方攻击力", "EffectSteps", @"偷取[^。]*?攻击|夺取[^。]*?攻击力|降低\s*\d*\s*名?敌人\s*\d*\s*攻"),
        new("execute", "消灭低攻/受伤敌人", "EffectSteps", @"消灭\s*(?:\d+|一|两)\s*名|消灭\s*1\s*名|死亡之?门"),
        new("revive", "复原/复活消耗卡", "EffectSteps", @"复原|复活\s*(?:最多)?\s*\d+\s*张"),
        new("handSelect", "手牌选择（复制/变 0 费/消耗）", "EffectSteps", @"选择\s*(?:1|一)\s*张(?:卡牌|手牌)|选择并复制|选择手牌中|选择两个目标"),
        new("discardOrConsumeHand", "消耗/弃置手牌", "EffectSteps", @"消耗(?:所有|全部|掉)?(?:的)?手牌|消耗[^。；]{0,4}?(?:\d+|[一两二三四五])\s*张|弃(?:掉)?\s*\d*\s*张?牌?"),
        new("autoPlayHandType", "直接释放手牌中的某类牌", "EffectSteps", @"直接释放|立即释放|自动施放|释放手牌中|释放一次|释放其中"),
        new("nextSpellTwice", "下一张牌施放 N 次", "EffectSteps", @"下一张[^。；]*施放\s*\d+\s*次|额外施放\s*\d+\s*次"),
        new("doubleDamageNext", "破隐/破甲类伤害翻倍", "EffectSteps", @"破(?:隐|除隐身)[^。]*伤害翻倍|伤害翻倍|受法伤加成翻倍|流血伤害翻倍"),
        new("damageReduce", "本回合所受伤害降为 N / 避开伤害 / 免疫致命", "EffectSteps", @"所受伤害降为|避开第\s*\d+\s*段伤害|免疫\s*1\s*次致命伤害|免疫伤害|无敌"),
        new("escape", "逃跑", "EffectSteps", @"逃跑"),
        new("blessingChoice", "随机获取一项祝福", "EffectSteps", @"随机获取一项祝福|祝福"),
        new("pocketUse", "仅背包内可用（复原最多 N 张）", "game.bag", @"在背包中才能使用|复原最多\s*(?:两|2|3)\s*张"),
        new("duration", "持续 N 回合（时长覆盖）", "EffectSteps", @"持续\s*\d+\s*回合"),
        new("castTimes", "施放 N 次某牌", "EffectSteps", @"施放\s*\d+\s*次"),
        new("formSwitch", "形态（剑仙/自然/宇宙/形态池）", "EffectSteps", @"剑仙形态|自然形态|宇宙形态|形态"),
        new("mysteryEffect", "随机神秘效果", "EffectSteps", @"随机神秘效果"),
        new("choiceBranch", "抉择（1°/2°/3° 分支）", "EffectSteps", @"抉择[:：]|\d\s*[°′]|其中每置入|集齐两枚碎片"),
        new("costSwapDiscover", "发现两张随机招式并交换费用", "EffectSteps", @"发现两张随机招式"),
        new("multiShot", "连开 N 枪 / 连击", "EffectSteps", @"连开\s*[一二三四五六七八九十\d]+\s*枪"),
        new("killReward", "击杀奖励（护甲/币/抽牌）", "EffectSteps", @"击杀敌人时|每消灭\s*1\s*个敌人|若击杀敌人"),
        new("container", "容器（背包扩容/内置空间）", "game.session", @"空间|容纳所有|扩容"),
        new("sealUnlock", "累计注能解锁", "EffectSteps", @"累计注能[^。]*解锁|解锁[:：]"),
        new("shaTransform", "把「初始攻击」转化为其它牌", "EffectSteps", @"化为\s*\d?\s*张|所有[‘'""”]?初始攻击[’'""”]?化|将[‘'""”]?初始攻击[’'""”]?化"),
        new("imitate", "在手牌中变形为上一张牌", "EffectSteps", @"在手牌中时|上一张[^。]*牌是武术|上一张武术牌的\s*1\s*费复制"),
        new("combatStartPassive", "对战开始时被动", "EffectSteps", @"对战开始时"),
    };

    // ---------- 2. 由执行器之外的层实装的句式（执行器只标记已识别） ----------
    public static readonly VerbEntry[] Elsewhere =
    {
        new("graveScale", "墓地/消耗数量加成", "battle.core", @"墓地中每有\s*1\s*张(武术|法术|装备|道具|资源)牌"),
        new("fuelPriceScale", "按注能牺牲品价格折算", "battle.effects", @"倍于被注能卡牌价格"),
        new("keepInHand", "永远保留在手牌 / 无法注能", "battle.rules", @"永远被保留在手牌中|无法用于注能"),
        new("nextCastTimes", "下一张牌施放 N 次（规则层）", "battle.core", @"下一张(?:法术|招式)?施放\s*\d+\s*次"),
        new("selfCostZero", "满足条件时本牌变为 0 费", "battle.core", @"本牌变为\s*0\s*费"),
        new("prevCardBonus", "上一张打出的牌决定加成", "battle.core", @"上一张(?:打出的)?牌是武术"),
        new("bleedDouble", "流血相关伤害翻倍", "battle.core", @"流血伤害翻倍"),
        new("bleedTargetBonus", "对流血目标的结算加成", "battle.core", @"若对方[^。]*流血"),
        new("consumeTrigger", "消耗该牌时触发", "battle.core", @"消耗该牌时"),
        new("onAcquire", "获取该牌时被动", "battle.core", @"发现或随机获取该牌时"),
        new("vsFreezeBonus", "对冰冻目标伤害加成", "battle.core", @"对冰冻[^。]*?伤害\s*\+\s*\d+"),
        new("onKill", "击杀钩子", "battle.core", @"每消灭\s*1\s*个敌人"),
        new("pouchCast", "容器选择其中 1 张直接施放", "battle.core", @"选择其中\s*(?:1|一)\s*张直接施放"),
        new("delayedGate", "两回合后的延迟门", "battle.core", @"两回合后[^。]*未选择"),
        new("designerBlank", "设计者原文留白句", "battle.core", @"在你抽到[^。]*后……"),
        new("imitateInHand", "在手牌中变形", "battle.core", @"在手牌中时[^。]*?变为"),
        new("pocketRestore", "背包消耗口袋复原", "game.bag", @"复原最多(两|2)张"),
        new("structuredDamage", "结构化伤害字段已覆盖", "battle.core", @"造成\s*\d+\s*点(?:\s*(?:固定|法术|真实|攻击))?\s*伤害|(\d+)\s*点?法术伤害", "structuredHit"),
        new("infuseBonusStructured", "注能伤害加成（结构化字段覆盖）", "battle.core", @"注能\s*[（(][^）)]*[）)][：:]?\s*伤害\s*\+\s*\d+", "structuredHit"),
        new("infuseLeadBonus", "注能前缀后的「伤害 +N」", "battle.core", @"^\s*伤害\s*\+\s*\d+\s*$", "structuredHit+infusedLead"),
        new("hpThreshold", "对低血目标加成", "battle.core", @"对\s*\d+\s*血以下", "structuredHit"),
        new("hpHalfThreshold", "血量一半及以下伤害增加", "battle.core", @"血量一半及以下的敌人伤害增加", "structuredHit"),
        new("healEqualToDamage", "回复等量生命（结算层）", "battle.core", @"回复等量生命", "structuredHit"),
        new("repeatTimes", "触发 N 次（结构化）", "battle.core", @"触发\s*\d+\s*次", "structuredHit"),
        new("extraCastTimes", "额外施放 N 次（结构化）", "battle.core", @"额外施放\s*\d+\s*次", "structuredHit"),
        new("spellBonusDouble", "受法伤加成翻倍（结构化）", "battle.core", @"受法伤加成翻倍", "structuredHit"),
        new("atkEqualToDamage", "造成等同于攻击力的伤害（结构化）", "battle.core", @"造成等同于攻击力的伤害", "structuredHit"),
    };

    // ---------- 2b. 已知未实装的设计者留白 ----------
    public static readonly VerbEntry[] DesignerBlanks =
    {
        new("weaponCover", "以天启诛魔剑覆盖你的所有武器（设计者留白，无结算）", "none", @"覆盖你的所有武器"),
    };

    /// <summary>命中哪些已实装动词（返回 id 数组，按表内顺序）。</summary>
    public static List<string> MatchVerbs(string? text)
    {
        var s = text ?? "";
        return Verbs.Where(v => v.Pattern.IsMatch(s)).Select(v => v.Id).ToList();
    }

    /// <summary>是否由执行器之外的层实装（context：structuredHit / infusedLead）。</summary>
    public static List<string> MatchElsewhere(string? text, bool structuredHit = false, bool infusedLead = false)
    {
        var s = text ?? "";
        return Elsewhere.Where(v =>
        {
            if (v.Gate is not null && v.Gate.Contains("structuredHit") && !structuredHit) return false;
            if (v.Gate is not null && v.Gate.Contains("infusedLead") && !infusedLead) return false;
            return v.Pattern.IsMatch(s);
        }).Select(v => v.Id).ToList();
    }

    /// <summary>命中哪些「设计者留白」句（已知未实装，非新问题）。</summary>
    public static List<string> MatchBlank(string? text)
    {
        var s = text ?? "";
        return DesignerBlanks.Where(v => v.Pattern.IsMatch(s)).Select(v => v.Id).ToList();
    }

    /// <summary>本表是否认识这句话（已实装动词 / 外部层实装 / 已知留白）。</summary>
    public static bool IsRecognized(string? text, bool structuredHit = false, bool infusedLead = false)
        => MatchVerbs(text).Count > 0 || MatchElsewhere(text, structuredHit, infusedLead).Count > 0 || MatchBlank(text).Count > 0;

    // ---------- 4. 未识别子句哨兵 ----------
    private static readonly Dictionary<string, (string Card, int Count)> UnknownEffects = new(StringComparer.Ordinal);

    /// <summary>识别不了的子句是否显式抛错（Core 引擎默认 true；网网页语义的静默记录用 false）。</summary>
    public static bool StrictMode { get; set; } = true;

    /// <summary>记录一句「牌面写了效果但打出去什么都没发生」的文本（同句累计次数）。</summary>
    public static UnknownEffectEntry? NoteUnknownEffect(string? cardId, string? cardName, string? text)
    {
        var s = (text ?? "").Trim();
        if (s.Length == 0 || !LooksLikeEffect(s)) return null;
        if (StrictMode) throw new UnknownClauseException(cardId ?? "?", cardName ?? "?", s);
        if (UnknownEffects.TryGetValue(s, out var hit))
        {
            UnknownEffects[s] = (hit.Card, hit.Count + 1);
            return new UnknownEffectEntry(s, hit.Card, hit.Count + 1);
        }
        UnknownEffects[s] = (cardName ?? "?", 1);
        return new UnknownEffectEntry(s, cardName ?? "?", 1);
    }

    /// <summary>未识别子句快照（试玩排查与自动化断言用）。</summary>
    public static List<UnknownEffectEntry> GetUnknownEffects()
        => UnknownEffects.Select(kv => new UnknownEffectEntry(kv.Key, kv.Value.Card, kv.Value.Count)).ToList();

    public static void ResetUnknownEffects() => UnknownEffects.Clear();
}
