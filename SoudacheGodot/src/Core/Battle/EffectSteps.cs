using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Soudache.Battle;

// ported from 搜打撤/game/src/effect-steps.js —— 牌效动词执行器（有序步骤表）。
// 每一步 = { id, gate, when(ctx) -> match|null, run(ctx, m) }：
//   gate Fresh  —— ctx.Did 已置位时整步跳过（＝旧链里的 `xxx && !did`）
//   gate Always —— 无论 Did 与否都评估
//   run 返回 Halt(result) 时整个执行器立即返回 result（提前 return 类）
// 铁律：顺序即语义（伤害先于诅咒、抉择拦截在其它动词之前……都是修过的回归），不得重排。

public sealed class EffectFlags
{
    public bool StructuredHit;
    public bool Infused;
    public int? FuelCost;
    public string? Uid;
}

public sealed record ClauseResult(bool Did, bool Drawn, bool Healed, bool Armored);

public sealed class FloatEvent
{
    public string Unit = "self";   // 'self' | 'ally:<i>' | 敌人下标数字字符串
    public string Text = "";
    public string Cls = "";
    public bool Warm;
}

public sealed class DiscoverJob
{
    public int N = 1;
    public Func<CardRecord, bool>? Pred;
    public string? Act;                       // null | 'play' | 'playKeep' | 'dup' | 'potion' | 'pouch' | 'swapCost'
    public bool PriceArmor;
    public bool ConsumeTempAtTurn;
    public List<CardRecord>? Options;         // act='pouch'：锦囊内置牌
    public string? PouchUid;
    public List<string>? SwapPair;            // act='swapCost'：共享 pair（uid 累计载体）
}

public sealed class HandSelectJob
{
    public int N = 1;
    public string? Type;                      // null=任意 | 武术/法术/装备/牌/杀/初始攻击
    public string Act = "play";               // 'play' | 'copy' | 'consume' | 'zero'
    public string? ThenText;
    public BattleUnit? Target;
    public CardRecord? SrcCard;
}

public sealed class ChoiceJob
{
    public string CardName = "";
    public List<string> Options = new();
    public bool SecondDoor;
}

public sealed record DeckDrawJob(int N, string Type);

/// <summary>文本执行器的战斗侧显式端口（battle.core 装配；与 effect-steps.js 的 deps 同一套）。</summary>
public sealed class EffectPorts
{
    public Func<IReadOnlyList<BattleUnit>> GetAlive = () => Array.Empty<BattleUnit>();
    public Func<BattleUnit> GetPlayerStatus = () => new BattleUnit("p", "player", 1, false);
    public Func<BattleDefense> GetPlayerDefense = () => new();
    public Func<string> GetMode = () => "normal";
    public Action<string, string> Log = (_, _) => { };
    public Func<string, string> EscapeHtml = s => s;
    public Action<int> Heal = _ => { };
    public Action<FloatEvent> PushFloat = _ => { };
    public Func<int, int> DrawCards = _ => 0;
    public Action<int> GrantStarterAttack = _ => { };
    public Action MarkNoDrawNext = () => { };
    public Action<DiscoverJob> QueueDiscover = _ => { };
    public Func<Func<CardRecord, bool>?, CardRecord?> RandomDiscoverCard = _ => null;
    public Func<CardRecord, string> AddTempCard = _ => "";
    public Action<CardRecord> AddDeckCard = _ => { };
    public Func<IReadOnlyList<CardRecord>> AllCards = () => Array.Empty<CardRecord>();
    public Func<int> ShuffleDeck = () => 0;
    public Func<int, int> AddEnergy = _ => 0;
    public Func<int, int> AddEnergyCap = _ => 0;
    public Action<HandSelectJob> QueueHandSelect = _ => { };
    public Func<int, int> RestoreConsumed = _ => 0;
    public Func<double> Random01 = () => 0.5;
    public Func<int> GetPlayerHp = () => 0;
    public Func<int> GetHandSize = () => 0;
    public Func<IReadOnlyList<OwnedCard>> GetHandCards = () => Array.Empty<OwnedCard>();
    public Func<BattleUnit, BattleDamageResult?> BurstPoison = _ => null;
    public Action<DeckDrawJob> DeckDraw = _ => { };
    public Action FleeBattle = () => { };
    public Func<string?> GetPlayerClass = () => null;
    public Func<CasterRef> GetPlayerCaster = () => new CasterRef();
    public Func<BattleUnit, int> FoeIndexOf = _ => 0;
    public Func<string, int, int, int> ReleaseHandMatches = (_, _, _) => 0;
    public Func<string, int> AutoPlayHandType = _ => 0;
    public Action<string?> SetShaTransform = _ => { };
    public Action<int> SetConsumeFireball = _ => { };
    public Action<int> DamagePlayer = _ => { };
    public Action<int> AddPlayerMaxHp = _ => { };
    public Func<int> DumpHand = () => 0;
    public Action<ChoiceJob> QueueChoice = _ => { };
    public Action<bool> SetStealthStrike = _ => { };
    public Action<int> SetNextSpellTwice = _ => { };
    public Action<string, string> RegisterTurnStartText = (_, _) => { };
    public Func<int> GetInfuseFuels = () => 0;
    public Func<int> GetPriceOfLastDrawn = () => 0;
    public Action<int> DealAoeFixed = _ => { };
    public Func<int, int> ReplaceShaInDeck = _ => 0;
    public Action<string, int, int, int> SummonAlly = (_, _, _, _) => { };
    public Action<bool> SetExtraTurn = _ => { };
    public Action<int> SetDeathSave = _ => { };
    public Action<string> QueuePouchCast = _ => { };
    public Action<CardRecord> RegisterGrowthCard = _ => { };
    public Action<string> UnlockSeal = _ => { };
    public Action<CardRecord> RandomAcquired = _ => { };
    public Func<IReadOnlyList<(string Key, int N)>> HandCurseSpecs = () => Array.Empty<(string, int)>();
    public Action QueueSwapCostDiscover = () => { };
}

public sealed class OwnedCard
{
    public string Uid = "";
    public CardRecord Card = new();
    public bool Safe;
    /// <summary>开战被动装备标记（不占 2 件装配上限）。</summary>
    public bool Passive;
    /// <summary>限定技能是否已用。</summary>
    public bool Used;
    /// <summary>条件装备（诅咒状态下）当前生效的攻/法伤加成（收回用）。</summary>
    public int CondAtk;
    public int CondSp;
}

public sealed class EffectCtx
{
    public CardRecord Card = new();
    public BattleUnit? Target;
    public EffectFlags Flags = new();
    public string Desc = "";
    public string SourceText = "";
    public bool Did;
    public bool Drawn;
    public bool Healed;
    public bool Armored;
    public Match? InfLead;
    public bool BleedGateFail;
    public BattleUnit Pstat = new("p", "player", 1, false);
    public BattleDefense Pdef = new();
    public string? MyClass;
    public string? DurOv;
    public BattleUnit? CurseTarget;
}

public sealed class StepOutcome
{
    public bool IsHalt;
    public ClauseResult? Result;

    public static StepOutcome Halt(ClauseResult result) => new() { IsHalt = true, Result = result };
}

public sealed class EffectStep
{
    public string Id = "";
    public string Label = "";
    public bool Always;
    public Func<EffectCtx, object?> When = _ => null;
    public Func<EffectCtx, object?, StepOutcome?> Run = (_, _) => null;
}

internal static class StepUtil
{
    public static bool Truthy(object? value) => value switch
    {
        null => false,
        bool b => b,
        Match m => m.Success,
        _ => true,
    };

    public static Match M(object? value) => value as Match ?? Match.Empty;

    public static ClauseResult FreshResult(bool did) => new(did, false, false, false);

    public static string CardName(CardRecord card) => card.Name ?? card.Id;

    /// <summary>Fisher-Yates 洗牌（对齐 sort(random-0.5) 的意图；RNG 确定性按 Godot 口径）。</summary>
    public static void Shuffle<T>(IList<T> list, Func<double> random01)
    {
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = (int)(random01() * (i + 1));
            if (j > i) j = i;
            (list[i], list[j]) = (list[j], list[i]);
        }
    }
}

public static class EffectStepsFactory
{
    private static readonly Dictionary<string, int> PoolNum = TextClauses.PoolNumMap;
    private static readonly Dictionary<string, int> CnNum = TextClauses.CnNum;

    private static int NumOf(string s) => CnNum.TryGetValue(s, out var n) ? n : int.Parse(s);

    internal static string CardName(CardRecord card) => StepUtil.CardName(card);

    private static readonly Regex ReInfuseLead = new(@"^注能\s*[（(][^）)]*[）)][：:]?\s*(.+)$", RegexOptions.Compiled);
    private static readonly Regex ReFuelPrice = new(@"(\d+)\s*倍于被注能卡牌价格", RegexOptions.Compiled);
    private static readonly Regex ReFuelPriceReplace = new(@"[^，。]*?\d+\s*倍于被注能卡牌价格的血量", RegexOptions.Compiled);
    private static readonly Regex ReSealUnlock = new(@"累计注能\s*(\d+)\s*张[^。；]*?解锁[：:]?\s*([\s\S]*)", RegexOptions.Compiled);
    private static readonly Regex ReCurseCond = new(@"诅咒状态[下时]", RegexOptions.Compiled);
    private static readonly Regex ReCurseCondOpp = new(@"对手|对方", RegexOptions.Compiled);
    private static readonly Regex ReTurnNeg = new(@"回合开始[时：:，,]?\s*[-－]\s*(\d+)\s*点?血", RegexOptions.Compiled);
    private static readonly Regex ReTurnNegStrip = new(@"[,，]?\s*回合开始[时：:，,]?\s*[-－]\s*\d+\s*点?血", RegexOptions.Compiled);
    private static readonly Regex ReChoice = new(@"抉择[:：]", RegexOptions.Compiled);
    private static readonly Regex ReChoiceDegree = new(@"\d\s*[°º]", RegexOptions.Compiled);
    private static readonly Regex ReChoiceDegreeSplit = new(@"[，,]?\s*\d\s*[°º]\s*", RegexOptions.Compiled);
    private static readonly Regex ReSecondDoor = new(@"两回合后[^。]*未选择", RegexOptions.Compiled);
    private static readonly Regex ReRandomOptions = new(@"从这些中随机", RegexOptions.Compiled);
    private static readonly Regex ReBlessingRandom = new(@"随机获取一项祝福", RegexOptions.Compiled);
    private static readonly Regex ReBurn = new(@"(?:附加|施加|攻击并)\s*(?:\d+\s*层?\s*)?灼烧", RegexOptions.Compiled);
    private static readonly Regex ReBurnTurns = new(@"灼烧(?:状态)?\s*(\d+)\s*回合", RegexOptions.Compiled);
    private static readonly Regex ReIfBleed = new(@"若对方[^。]*流血", RegexOptions.Compiled);
    private static readonly Regex ReBleedApply = new(@"(?:附加|施加)\s*(?:(\d+)\s*层?)?\s*流血", RegexOptions.Compiled);
    private static readonly Regex ReBleedPlain = new(@"附加流血|施加流血", RegexOptions.Compiled);
    private static readonly Regex RePoisonApply = new(@"(?:附加|施加)\s*(?:(\d+)\s*层)?\s*中毒", RegexOptions.Compiled);
    private static readonly Regex ReAoeTargets = new(@"所有敌人|敌方全体|全体敌人|目标为全体", RegexOptions.Compiled);
    private static readonly Regex ReSwapCostDiscover = new(@"发现两张随机招式", RegexOptions.Compiled);
    private static readonly Regex ReHandCurseAll = new(@"附加手牌中的招式所具有的全部诅咒", RegexOptions.Compiled);
    private static readonly Regex ReFreezeGate = new(@"免疫冰冻|对冰冻", RegexOptions.Compiled);
    private static readonly Regex ReFreeze = new(@"附加冰冻|冰冻\s*所有|冰冻\s*(?:\d+|[一两二三四五])\s*名|冻结", RegexOptions.Compiled);
    private static readonly Regex ReFreezeTurns = new(@"(?:冻结|冰冻)状态\s*(\d+)\s*回合", RegexOptions.Compiled);
    private static readonly Regex ReFreezeMulti = new(@"(?:冰冻|冻结)\s*(\d+|[一两二三四五])\s*名", RegexOptions.Compiled);
    private static readonly Regex ReSilence = new(@"沉默", RegexOptions.Compiled);
    private static readonly Regex ReAbreak = new(@"破甲", RegexOptions.Compiled);
    private static readonly Regex ReHealban = new(@"禁疗", RegexOptions.Compiled);
    private static readonly Regex ReStealth = new(@"潜行", RegexOptions.Compiled);
    private static readonly Regex ReStealthTurns = new(@"潜行(?:状态)?\s*(\d+)\s*回合", RegexOptions.Compiled);
    private static readonly Regex ReAtkPlus = new(@"攻击\s*\+\s*(\d+)", RegexOptions.Compiled);
    private static readonly Regex ReAtkPlusShort = new(@"攻\s*\+\s*(\d+)", RegexOptions.Compiled);
    private static readonly Regex RePlusAtk = new(@"\+\s*(\d+)\s*攻", RegexOptions.Compiled);
    private static readonly Regex ReGainAtk = new(@"获得\s*(\d+)\s*点?攻击力?", RegexOptions.Compiled);
    private static readonly Regex ReSpellUp = new(@"法伤\s*\+\s*(\d+)", RegexOptions.Compiled);
    private static readonly Regex ReSpellUpAlt = new(@"法术伤害\s*\+\s*(\d+)", RegexOptions.Compiled);
    private static readonly Regex ReDeathSave = new(@"免疫\s*(\d+)\s*次致命伤害", RegexOptions.Compiled);
    private static readonly Regex ReImmuneWord = new(@"免疫伤害", RegexOptions.Compiled);
    private static readonly Regex ReInvincible = new(@"无敌", RegexOptions.Compiled);
    private static readonly Regex ReInvincibleTurns1 = new(@"(\d+)\s*回合内[^。]*无敌", RegexOptions.Compiled);
    private static readonly Regex ReInvincibleTurns2 = new(@"无敌[^。]*?(\d+)\s*回合", RegexOptions.Compiled);
    private static readonly Regex ReReduce = new(@"减伤\s*(\d+)?", RegexOptions.Compiled);
    private static readonly Regex ReSwordForm = new(@"剑仙形态", RegexOptions.Compiled);
    private static readonly Regex ReSwordFormAlt = new(@"每回合额外抽\s*\d+\s*张", RegexOptions.Compiled);
    private static readonly Regex ReSwordFormAlt2 = new(@"回合开始时[^。]*?额外抽\s*\d+\s*张", RegexOptions.Compiled);
    private static readonly Regex ReNatureForm = new(@"自然形态", RegexOptions.Compiled);
    private static readonly Regex ReNatureFormAlt = new(@"回合开始时[^。]*获得\s*\d+\s*点?能量", RegexOptions.Compiled);
    private static readonly Regex ReCosmosForm = new(@"宇宙形态", RegexOptions.Compiled);
    private static readonly Regex ReSpellDmg = new(@"造成\s*(\d+)\s*点法(?:术)?伤", RegexOptions.Compiled);
    private static readonly Regex ReDealDamage = new(@"造成\s*(\d+)\s*点(?:\s*(固定|法术|真实|攻击))?\s*伤害", RegexOptions.Compiled);
    private static readonly Regex ReAoeDirect = new(@"所有敌人|敌方全体|全体敌人|目标为全体|对全体", RegexOptions.Compiled);
    private static readonly Regex ReFourShots = new(@"连开\s*四\s*枪", RegexOptions.Compiled);
    private static readonly Regex ReAttackNTimes = new(@"^攻击\s*(\d+)\s*次[。.！!]?$", RegexOptions.Compiled);
    private static readonly Regex ReAtkDown = new(@"降低\s*(?:(\d+)\s*名?)?\s*敌人\s*(\d+)\s*攻", RegexOptions.Compiled);
    private static readonly Regex ReStealAtk = new(@"偷取[^。]*?攻击", RegexOptions.Compiled);
    private static readonly Regex ReExtendFreeze = new(@"延长[^。]*?冰冻[^。]*?(\d+)\s*回合", RegexOptions.Compiled);
    private static readonly Regex ReRandomCurses = new(@"附加\s*(\d+)\s*种随机诅咒", RegexOptions.Compiled);
    private static readonly Regex ReDoomGate = new(@"对所有敌方(?:角色)?各施加(?:一|1)层随机诅咒", RegexOptions.Compiled);
    private static readonly Regex ReMorphRandom = new(@"变成\s*(\d+|一)\s*张随机\s*(招式|武术|法术)?\s*卡牌", RegexOptions.Compiled);
    private static readonly Regex ReRandomKeyed = new(@"获得\s*(?:(\d+)|一)?\s*张?随机的?[‘“「]?(箭矢?|火球|药水|招式|初始攻击|杀)[’”」]?", RegexOptions.Compiled);
    private static readonly Regex ReCurseEnumeration = new(@"^(?:(\d+)\s*′\s*)?((?:冰冻|流血|中毒|沉默|破甲|禁疗|灼烧)(?:[、，]\s*(?:冰冻|流血|中毒|沉默|破甲|禁疗|灼烧))*)$", RegexOptions.Compiled);
    private static readonly Regex ReFireballN = new(@"施放\s*(\d+)\s*次?火球(?:术)?", RegexOptions.Compiled);
    private static readonly Regex ReStormFireball = new(@"(?:每个?敌人|全体敌人|敌方全体)每人?释放\s*(?:(\d+)\s*次)?火球", RegexOptions.Compiled);
    private static readonly Regex ReSelfDamage = new(@"受到\s*(\d+)\s*点?伤害", RegexOptions.Compiled);
    private static readonly Regex ReMaxHpUp = new(@"血量上限\s*\+\s*(\d+)", RegexOptions.Compiled);
    private static readonly Regex ReDumpAllHand = new(@"消耗(?:所有|全部)(?:的)?手牌", RegexOptions.Compiled);
    private static readonly Regex ReDodge = new(@"避开第\s*(\d+)\s*段伤害", RegexOptions.Compiled);
    private static readonly Regex ReHealN = new(@"回复\s*(\d+)\s*(?:点\s*生命|点?血)", RegexOptions.Compiled);
    private static readonly Regex ReHealPlus = new(@"\+\s*(\d+)\s*血", RegexOptions.Compiled);
    private static readonly Regex ReRestoreConsumed = new(@"(?:复原|复活)\s*(?:最多)?\s*(\d+)?\s*张", RegexOptions.Compiled);
    private static readonly Regex ReSelPlay = new(@"选择(?:\s*手牌中)?\s*(\d+|[一两二三四五])\s*张(?:手牌中的?)?\s*(武术|法术|装备|牌)?\s*卡?[^，。；;]*?(?:施放|释放|打出)", RegexOptions.Compiled);
    private static readonly Regex ReSelCopy = new(@"选择并复制你的\s*(?:1\s*|一\s*)?张?手牌", RegexOptions.Compiled);
    private static readonly Regex ReConsumeHand = new(@"消耗\s*(一张|两|二|三|\d+)\s*张?\s*(?:手牌中的)?(初始攻击|武术|法术|装备|牌|杀)牌?[,，]\s*(.+)$", RegexOptions.Compiled);
    private static readonly Regex ReMystery = new(@"随机神秘效果", RegexOptions.Compiled);
    private static readonly Regex ReArmorGain = new(@"获得\s*(\d+)\s*点?\s*护甲", RegexOptions.Compiled);
    private static readonly Regex ReArmorPlus = new(@"\+\s*(\d+)\s*甲", RegexOptions.Compiled);
    private static readonly Regex ReShieldGain = new(@"获得\s*(\d+)\s*点?\s*护盾", RegexOptions.Compiled);
    private static readonly Regex ReGuard = new(@"本回合所受伤害降为", RegexOptions.Compiled);
    private static readonly Regex RePurify = new(@"净化", RegexOptions.Compiled);
    private static readonly Regex ReTurnExtraDraw = new(@"回合开始时[^。]*?额外抽", RegexOptions.Compiled);
    private static readonly Regex RePerReleaseDraw = new(@"每(释放|打出)\s*1\s*张", RegexOptions.Compiled);
    private static readonly Regex RePerCurseDraw = new(@"每有\s*1\s*种诅咒[^。]*?抽\s*(\d+)\s*张牌", RegexOptions.Compiled);
    private static readonly Regex ReDrawRange = new(@"抽\s*(\d+)\s*[-—~～至]\s*(\d+)\s*张牌", RegexOptions.Compiled);
    private static readonly Regex ReDrawN = new(@"抽\s*(\d+)\s*张牌", RegexOptions.Compiled);
    private static readonly Regex ReDrawThenInsert = new(@"洗入牌库[^。]*然后抽", RegexOptions.Compiled);
    private static readonly Regex ReAutoReleaseType = new(@"直接释放其中(武术|法术|招式)", RegexOptions.Compiled);
    private static readonly Regex ReNoDrawNext = new(@"下回合无法抽牌|下个回合无法抽牌", RegexOptions.Compiled);
    private static readonly Regex ReKillMinions = new(@"消灭\s*(\d+)\s*名(?:\s*攻击力\s*(\d+)\s*点?及以下)?", RegexOptions.Compiled);
    private static readonly Regex ReNextSpellTimes = new(@"下一张(?:法术|招式)?施放\s*(\d+)\s*次", RegexOptions.Compiled);
    private static readonly Regex ReTaunt = new(@"迫使其?相互攻击", RegexOptions.Compiled);
    private static readonly Regex ReAttackAll = new(@"攻击全体敌人", RegexOptions.Compiled);
    private static readonly Regex ReLoseLife = new(@"损失\s*(\d+)\s*点?(?:生命|血)", RegexOptions.Compiled);
    private static readonly Regex ReNegHp = new(@"[-－]\s*(\d+)\s*点?血", RegexOptions.Compiled);
    private static readonly Regex ReArmorLoss = new(@"[-－]\s*(\d+)\s*点?\s*$", RegexOptions.Compiled);
    private static readonly Regex ReHealUpTo = new(@"回复\s*至\s*(\d+)\s*血", RegexOptions.Compiled);
    private static readonly Regex ReImmobilizeWindow = new(@"下回合|下个回合|本回合", RegexOptions.Compiled);
    private static readonly Regex RePoisonDouble = new(@"中毒层数翻倍", RegexOptions.Compiled);
    private static readonly Regex ReFillRandom = new(@"置入随机卡牌直至手牌达到\s*(\d+)\s*张", RegexOptions.Compiled);
    private static readonly Regex ReFillHealPer = new(@"每置入\s*1\s*张法术[^。]*?回复\s*(\d+)\s*血", RegexOptions.Compiled);
    private static readonly Regex ReCopyRandomHand = new(@"获得一张随机手牌的复制", RegexOptions.Compiled);
    private static readonly Regex ReTokenPass = new(@"获得\s*1\s*张员工通行证B或员工通行证A", RegexOptions.Compiled);
    private static readonly Regex ReFlee = new(@"逃跑一次|非 BOSS 战逃跑", RegexOptions.Compiled);
    private static readonly Regex ReStealthWord = new(@"潜行", RegexOptions.Compiled);
    private static readonly Regex ReAtkWord = new(@"攻击力", RegexOptions.Compiled);
    private static readonly Regex ReSpellWord = new(@"法伤", RegexOptions.Compiled);
    private static readonly Regex ReArmorWord = new(@"护甲", RegexOptions.Compiled);
    private static readonly Regex RePurifyWord = new(@"净化", RegexOptions.Compiled);
    private static readonly Regex ReDrawFromDeck = new(@"从牌库中抽取\s*(\d+)\s*张?(初始攻击|装备|法术|武术|杀)牌?", RegexOptions.Compiled);
    private static readonly Regex ReHealAllies = new(@"治疗所有队友|治疗全体", RegexOptions.Compiled);
    private static readonly Regex ReCurseCards = new(@"随机获取\s*(\d+)\s*张能施加诅咒的(卡牌|招式)", RegexOptions.Compiled);
    private static readonly Regex RePotionDiscover = new(@"发现\s*1?\s*瓶药水", RegexOptions.Compiled);
    private static readonly Regex ReDiscoverInfuse = new(@"发现\s*(?:一|1)\s*张注能卡", RegexOptions.Compiled);
    private static readonly Regex ReDiscoverPool = new(@"(?:发现|随机获取|获取|获得)(?:并直接施放)?\s*(?:(\d+|[一两二三四五])\s*[张种])?\s*([^，。；,\s]{0,8}?)(卡牌|的卡|的牌|能力卡|牌|卡)", RegexOptions.Compiled);
    private static readonly Regex ReEqualRandom = new(@"等量随机卡牌", RegexOptions.Compiled);
    private static readonly Regex ReDirectCast = new(@"并将其释放|并(?:直接)?(?:施放|释放)", RegexOptions.Compiled);
    private static readonly Regex ReDirectCastLead = new(@"并直接施放", RegexOptions.Compiled);
    private static readonly Regex RePlayKeep = new(@"获取剩下(两|2)张", RegexOptions.Compiled);
    private static readonly Regex ReDup = new(@"并额外获得\s*1\s*张复制", RegexOptions.Compiled);
    private static readonly Regex RePriceArmor = new(@"获得等同于(?:其|该卡|该牌)价格的护甲", RegexOptions.Compiled);
    private static readonly Regex ReConsumeAtTurn = new(@"回合开始时将其消耗", RegexOptions.Compiled);
    private static readonly Regex ReInsertRandom = new(@"洗入\s*(\d+)\s*张随机卡牌", RegexOptions.Compiled);
    private static readonly Regex ReInsertRandomAlt = new(@"将\s*(\d+)\s*张随机卡牌洗入牌库", RegexOptions.Compiled);
    private static readonly Regex ReInsertNamed = new(@"将\s*(?:(\d+|[一二两三四五])\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?(?:洗入|放入|置入)牌库", RegexOptions.Compiled);
    private static readonly Regex ReCheapen = new(@"费用均?\s*[-－]\s*1", RegexOptions.Compiled);
    private static readonly Regex ReAfterInsertDraw = new(@"洗入牌库[^。]*然后抽\s*(\d+|[一二两三四五])\s*张牌", RegexOptions.Compiled);
    private static readonly Regex ReInsertHand = new(@"将\s*(?:(\d+|[一二两三四五])\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?置入手牌", RegexOptions.Compiled);
    private static readonly Regex ReGainNamed = new(@"获得\s*(?:(\d+|[一两二三四五])\s*张)\s*[‘“「]?([^\s，。；,、‘’“”「」]{1,6})[’”」]?(?=[。，；;]|$)", RegexOptions.Compiled);
    private static readonly Regex ReShaTransform = new(@"[‘’“”「」]?(?:杀|初始攻击)[‘’“”「」]?\s*化为\s*[‘’“”「」]?(?:(\d+)\s*张)?([^\s，。；;、‘’“”「」]{1,8})", RegexOptions.Compiled);
    private static readonly Regex ReConsumeFireball = new(@"每\s*消耗\s*1\s*张卡牌[^。]*?施放\s*(?:(\d+)\s*次)?[‘’“”「」]?火球", RegexOptions.Compiled);
    private static readonly Regex ReTurnStartDiscover = new(@"回合开始时[^。]*?(发现[^。]*?（?\s*(?:\d+|[一两二三四五])?\s*张[^。]*?)$", RegexOptions.Compiled);
    private static readonly Regex ReStealthStrike = new(@"破隐[^。]*?伤害翻倍", RegexOptions.Compiled);
    private static readonly Regex ReReleasePerCurse = new(@"每有一层诅咒[^。]*?释放(?:一次)?[‘'“]?(?:杀|初始攻击)", RegexOptions.Compiled);
    private static readonly Regex ReLastCardTrigger = new(@"最后一张手牌[^。；]*?触发\s*(?:\d+\s*)?次", RegexOptions.Compiled);
    private static readonly Regex ReReleaseHandAll = new(@"直接释放手牌中的所有[‘’“”「」]?(初始攻击|箭|杀|火球)[’’”」]?", RegexOptions.Compiled);
    private static readonly Regex ReDrawEachPerRelease = new(@"每(?:释放|打出)\s*1\s*张[^。]*?抽\s*(\d+)\s*张牌", RegexOptions.Compiled);
    private static readonly Regex ReDrawUntil = new(@"抽牌[^。；]*?直到[有满]\s*(\d+)\s*张手牌", RegexOptions.Compiled);
    private static readonly Regex ReSeizeAtk = new(@"夺取\s*(?:一名|1\s*名)?\s*敌人的?\s*(\d+)\s*点?攻击力", RegexOptions.Compiled);
    private static readonly Regex RePriceAoe = new(@"造成等同于(?:其|该卡|该牌)价格的固定伤害", RegexOptions.Compiled);
    private static readonly Regex ReGrowth = new(@"回合开始时[，,]?\s*本牌伤害\s*\+\s*\d+", RegexOptions.Compiled);
    private static readonly Regex ReReplaceSha = new(@"将\s*(\d+)\s*张(?:杀|初始攻击)替换为随机卡牌", RegexOptions.Compiled);
    private static readonly Regex ReDeckCapUp = new(@"牌库上限\s*\+\s*(\d+)", RegexOptions.Compiled);
    private static readonly Regex ReSummonAlly = new(@"召唤\s*([^\s（(，。；;、]+?)\s*[（(]\s*(\d+)\s*[-－]\s*(\d+)\s*[）)]\s*(?:[×xX]\s*(\d+))?", RegexOptions.Compiled);
    private static readonly Regex ReExtraTurn = new(@"获得\s*1\s*个额外回合", RegexOptions.Compiled);
    private static readonly Regex RePouchCast = new(@"自带\s*1\s*[*×]\s*3\s*空间|可以置入\s*3\s*张法术牌", RegexOptions.Compiled);
    private static readonly Regex RePouchPassive = new(@"内置\s*3\s*[*×]\s*3\s*空间|容纳所有.{0,6}资源卡牌", RegexOptions.Compiled);
    private static readonly Regex ReZeroCostSelect = new(@"选择\s*(?:1|一)\s*张卡牌[^。]*?下回合将其变为\s*0\s*费", RegexOptions.Compiled);
    private static readonly Regex ReDiscoverForm = new(@"发现\s*(?:一|1)\s*种(形态)并(?:直接)?释放", RegexOptions.Compiled);
    private static readonly Regex ReReleaseOneSha = new(@"立即释放(?:一次|1\s*次)?[‘'“]?杀", RegexOptions.Compiled);
    private static readonly Regex ReEnergy = new(@"(?:获得|回复)\s*(\d+)\s*点?能量", RegexOptions.Compiled);
    private static readonly Regex ReEnergyCap = new(@"能量上限\s*\+\s*(\d+)", RegexOptions.Compiled);
    private static readonly Regex ReDuration = new(@"持续\s*(\d+)\s*回合", RegexOptions.Compiled);
    private static readonly Regex ReThisCardTime = new(@"该牌时", RegexOptions.Compiled);
    private static readonly string[] CurseKeys = { "bleed", "poison", "freeze", "silence", "abreak", "healban", "burn" };

    private static string Esc(EffectPorts deps, string s) => deps.EscapeHtml(s);

    /// <summary>对单个目标结算伤害并冒伤害数字（步骤表内部固定搭配）。</summary>
    private static int HitFoe(EffectPorts deps, EffectCtx ctx, BattleUnit t, int n, BattleDamageKind type, CasterRef? caster)
    {
        var r = CombatModel.DealDamage(caster, t, n, type);
        if (r.Dealt > 0)
            deps.PushFloat(new FloatEvent { Unit = deps.FoeIndexOf(t).ToString(), Text = "-" + r.Dealt, Cls = "dmg" });
        return r.Dealt;
    }

    /// <summary>创建有序步骤表。顺序 = 网页版 effect-steps.js 的物理顺序，不得重排。</summary>
    public static List<EffectStep> CreateSteps(EffectPorts deps)
    {
        var steps = new List<EffectStep>();
        void Add(string id, string label, bool always, Func<EffectCtx, object?> when, Func<EffectCtx, object?, StepOutcome?> run)
            => steps.Add(new EffectStep { Id = id, Label = label, Always = always, When = when, Run = run });

        // ============ 前置改写与门控 ============
        Add("pre.infuseLead", "「注能(N)：效果」前缀剥离", true, ctx => ReInfuseLead.Match(ctx.Desc),
            (ctx, m) => { var match = (Match)m!; ctx.InfLead = match; ctx.Desc = match.Groups[1].Value; return null; });
        Add("pre.fuelPrice", "「N倍于被注能卡牌价格」按牺牲品费用折算", true,
            ctx => ctx.Flags.FuelCost is not null ? ReFuelPrice.Match(ctx.Desc) : null,
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                var fuel = Math.Max(0, ctx.Flags.FuelCost ?? 0);
                ctx.Desc = ReFuelPriceReplace.Replace(ctx.Desc, $"回复 {n * fuel} 点生命");
                deps.Log($"[[icon:flask]] 牺牲品费用 {fuel} → 折算回复 {n * fuel} 点生命", "sys");
                return null;
            });
        Add("gate.sealUnlock", "「累计注能 N 张后解锁」门", true, ctx => ReSealUnlock.Match(ctx.Desc),
            (ctx, m) =>
            {
                var match = (Match)m!;
                var need = int.Parse(match.Groups[1].Value);
                var fuels = deps.GetInfuseFuels();
                if (fuels >= need)
                {
                    deps.UnlockSeal(EffectStepsFactory.CardName(ctx.Card));
                    return StepOutcome.Halt(StepUtil.FreshResult(true));
                }
                deps.Log($"[[icon:crystal]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b> 未解锁：累计注能 {fuels}/{need} 张", "dim");
                return StepOutcome.Halt(StepUtil.FreshResult(true));
            });
        Add("gate.curseCond", "「诅咒状态下」条件门（装备改穿戴期核算）", true,
            ctx => ReCurseCond.IsMatch(ctx.Desc) && !ReCurseCondOpp.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var met = CombatModel.HasCurse(ctx.Pstat);
                if (ctx.Card.Type == "装备")
                {
                    deps.Log(met
                        ? $"[[icon:crystal]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：当前身负诅咒，条件加成已生效"
                        : $"[[icon:cross]] {Esc(deps, EffectStepsFactory.CardName(ctx.Card))}：自身未处于诅咒状态，穿戴期间身负诅咒时自动生效", met ? "ok" : "dim");
                    return StepOutcome.Halt(StepUtil.FreshResult(true));
                }
                if (!met)
                {
                    deps.Log($"[[icon:cross]] {Esc(deps, EffectStepsFactory.CardName(ctx.Card))}：自身未处于诅咒状态，条件加成不生效", "dim");
                    return StepOutcome.Halt(StepUtil.FreshResult(true));
                }
                return null;
            });
        Add("pre.turnNegExtract", "「回合开始 -N 血」从句剥出为延迟段", true, ctx => ReTurnNeg.Match(ctx.Desc),
            (ctx, m) =>
            {
                var n = ((Match)m!).Groups[1].Value;
                deps.RegisterTurnStartText($"-{n} 血", EffectStepsFactory.CardName(ctx.Card));
                ctx.Desc = ReTurnNegStrip.Replace(ctx.Desc, "");
                deps.Log($"[[icon:hourglass]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：每个回合开始失去 {n} 点生命", "sys");
                ctx.Did = true;
                return null;
            });
        Add("gate.choice", "抉择面板拦截（必须在其它动词之前）", false,
            ctx => ReChoice.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var body = Regex.Replace(ctx.Desc, @"^.*?抉择[:：]\s*", "");
                List<string> options;
                if (ReChoiceDegree.IsMatch(body))
                    options = ReChoiceDegreeSplit.Split(body).Select(s => s.Trim()).Where(s => s.Length > 0).ToList();
                else
                    options = body.Split("或者").Select(s => s.Trim()).Where(s => s.Length > 0).ToList();
                if (options.Count > 1)
                {
                    deps.QueueChoice(new ChoiceJob
                    {
                        CardName = EffectStepsFactory.CardName(ctx.Card),
                        Options = options,
                        SecondDoor = ReSecondDoor.IsMatch(ctx.Card.Desc ?? ""),
                    });
                    deps.Log($"[[icon:question]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：抉择（{options.Count} 选 1）——请从面板中选择", "sys");
                    return StepOutcome.Halt(StepUtil.FreshResult(true));
                }
                return null;
            });
        Add("gate.randomOptionsSkip", "「从这些中随机」可选项说明不逐项生效", true,
            ctx => ReRandomOptions.IsMatch(ctx.Desc) && !ReBlessingRandom.IsMatch(ctx.Desc) ? true : null,
            (_, _) => StepOutcome.Halt(StepUtil.FreshResult(false)));

        // ============ 诅咒与祝福段 ============
        Add("curse.burn", "灼烧（不叠加、按回合固定掉血）", true, ctx => ReBurn.Match(ctx.Desc),
            (ctx, m) =>
            {
                var fm = ReBurnTurns.Match(ctx.Desc);
                var n = fm.Success ? int.Parse(fm.Groups[1].Value) : (ctx.DurOv is not null ? int.Parse(ctx.DurOv) : 2);
                if (ctx.CurseTarget is not null)
                {
                    CombatModel.AddCurse(ctx.CurseTarget, "burn", n);
                    deps.Log($"[[icon:fire]] <b>{Esc(deps, ctx.CurseTarget.Name)}</b> 被灼烧（{n} 回合内每回合结束受 1 点固定伤害，不叠加）", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("curse.bleedGate", "「若对方流血」条件门（未流血时后续条件子句空过）", true,
            ctx => ReIfBleed.IsMatch(ctx.Desc) && !((ctx.CurseTarget?.Status?.GetValueOrDefault("bleed") ?? 0) > 0) ? true : null,
            (ctx, _) =>
            {
                ctx.BleedGateFail = true;
                deps.Log($"[[icon:cross]] {Esc(deps, EffectStepsFactory.CardName(ctx.Card))}：对方未处于流血状态，条件效果不生效", "dim");
                return null;
            });
        Add("curse.bleed", "附加流血", true, ctx => MatchOrBool(ReBleedApply.Match(ctx.Desc), ReBleedPlain.IsMatch(ctx.Desc)),
            (ctx, m) =>
            {
                var n = 1;
                if (m is Match { Success: true } mm && mm.Groups[1].Success) n = int.Parse(mm.Groups[1].Value);
                if (ctx.CurseTarget is not null)
                {
                    CombatModel.AddCurse(ctx.CurseTarget, "bleed", n);
                    deps.Log($"[[icon:blood]] <b>{Esc(deps, ctx.CurseTarget.Name)}</b> 附加 {n} 层流血", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("curse.poison", "附加中毒（「所有敌人」走全体）", true, ctx => RePoisonApply.Match(ctx.Desc),
            (ctx, m) =>
            {
                var g = ((Match)m!).Groups[1];
                var n = g.Success ? int.Parse(g.Value) : 1;
                var aoeP = ReAoeTargets.IsMatch(ctx.Desc);
                var targets = (aoeP ? deps.GetAlive() : ctx.CurseTarget is not null ? new[] { ctx.CurseTarget } : Array.Empty<BattleUnit>())
                    .Where(t => t is { Dead: false }).ToList();
                if (targets.Count > 0)
                {
                    foreach (var t in targets) CombatModel.AddCurse(t, "poison", n);
                    deps.Log(targets.Count > 1
                        ? $"[[icon:skull]] 全体敌人附加 {n} 层中毒（每层回合末 1 点固定伤害）"
                        : $"[[icon:skull]] <b>{Esc(deps, targets[0].Name)}</b> 附加 {n} 层中毒（每层回合末 1 点固定伤害）", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("curse.swapCostDiscover", "迷之匣：发现两张随机招式并交换费用", true,
            ctx => ReSwapCostDiscover.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) => { deps.QueueSwapCostDiscover(); ctx.Did = true; return null; });
        Add("curse.handCurseAll", "诅咒之刃：附加手牌招式的全部诅咒", true,
            ctx => ReHandCurseAll.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var specs = deps.HandCurseSpecs();
                var ct = ctx.Target is { Dead: false } ? ctx.Target : deps.GetAlive().FirstOrDefault();
                if (specs.Count > 0 && ct is not null)
                {
                    var names = specs.Select(s =>
                    {
                        var meta = CombatModel.CurseMeta.GetValueOrDefault(s.Key);
                        CombatModel.AddCurse(ct, s.Key, s.N);
                        return $"{meta?.Name ?? s.Key}{(meta is { Stack: true } ? "×" + s.N : "")}";
                    }).ToList();
                    deps.Log($"[[icon:skull]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：附加手牌招式的诅咒 → <b>{Esc(deps, ct.Name)}</b>：{string.Join("、", names)}", "sys");
                }
                else
                {
                    deps.Log($"[[icon:cross]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：手牌中没有带诅咒的招式", "dim");
                }
                ctx.Did = true;
                return null;
            });
        Add("curse.freeze", "冰冻/冻结（免疫冰冻句除外）", true,
            ctx => !ReFreezeGate.IsMatch(ctx.Desc) && ReFreeze.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var fm = ReFreezeTurns.Match(ctx.Desc);
                var n = fm.Success ? int.Parse(fm.Groups[1].Value) : (ctx.DurOv is not null ? int.Parse(ctx.DurOv) : 1);
                var multiM = ReFreezeMulti.Match(ctx.Desc);
                var multiN = multiM.Success ? NumOf(multiM.Groups[1].Value) : 0;
                if (multiN > 1)
                {
                    var targets = deps.GetAlive().Take(multiN).ToList();
                    foreach (var t in targets) CombatModel.AddCurse(t, "freeze", n);
                    if (targets.Count > 0)
                    {
                        deps.Log($"[[icon:crystal]] {string.Join("、", targets.Select(t => Esc(deps, t.Name)))} 被冰冻 {n} 回合（无法行动）", "sys");
                        ctx.Did = true;
                    }
                }
                else if (ctx.CurseTarget is not null)
                {
                    CombatModel.AddCurse(ctx.CurseTarget, "freeze", n);
                    deps.Log($"[[icon:crystal]] <b>{Esc(deps, ctx.CurseTarget.Name)}</b> 被冰冻 {n} 回合（无法行动）", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("curse.silence", "沉默", true, ctx => ReSilence.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var n = ctx.DurOv is not null ? int.Parse(ctx.DurOv) : 1;
                if (ctx.CurseTarget is not null)
                {
                    CombatModel.AddCurse(ctx.CurseTarget, "silence", n);
                    deps.Log($"[[icon:cross]] <b>{Esc(deps, ctx.CurseTarget.Name)}</b> 被沉默 {n} 回合（技能无效，攻击除外）", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("curse.abreak", "破甲（流血条件门未过时空过）", true,
            ctx => ReAbreak.IsMatch(ctx.Desc) && !ctx.BleedGateFail ? true : null,
            (ctx, _) =>
            {
                var n = ctx.DurOv is not null ? int.Parse(ctx.DurOv) : 2;
                if (ctx.CurseTarget is not null)
                {
                    CombatModel.AddCurse(ctx.CurseTarget, "abreak", n);
                    deps.Log($"[[icon:tools]] <b>{Esc(deps, ctx.CurseTarget.Name)}</b> 破甲 {n} 回合（无法减免伤害——元素庇幕失效）", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("curse.healban", "禁疗", true, ctx => ReHealban.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var n = ctx.DurOv is not null ? int.Parse(ctx.DurOv) : 2;
                if (ctx.CurseTarget is not null)
                {
                    CombatModel.AddCurse(ctx.CurseTarget, "healban", n);
                    deps.Log($"[[icon:heart]] <b>{Esc(deps, ctx.CurseTarget.Name)}</b> 禁疗 {n} 回合（无法回复生命）", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("buff.stealth", "潜行", true, ctx => ReStealth.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var stm = ReStealthTurns.Match(ctx.Desc);
                var n = stm.Success ? int.Parse(stm.Groups[1].Value) : (ctx.DurOv is not null ? int.Parse(ctx.DurOv) : 1);
                CombatModel.AddBlessing(ctx.Pstat, "stealth", n);
                deps.Log($"[[icon:runner]] <b>祝福·潜行</b>：{n} 回合内无法成为被攻击对象（造成伤害会破除）", "ok");
                ctx.Did = true;
                return null;
            });
        Add("buff.atkUp", "攻+N / 获得 N 点攻击力（结构化伤害已结算时不再叠加）", true,
            ctx => OrMatch(
                ctx.Flags.StructuredHit
                    ? Match.Empty
                    : OrMatch(OrMatch(ReAtkPlus.Match(ctx.Desc), ReAtkPlusShort.Match(ctx.Desc)), RePlusAtk.Match(ctx.Desc)),
                ReGainAtk.Match(ctx.Desc)) is { Success: true } m ? m : null,
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                CombatModel.AddBlessing(ctx.Pstat, "atkUp", n, ctx.DurOv is not null ? int.Parse(ctx.DurOv) : 0);
                deps.Log($"[[icon:swords]] <b>祝福·攻击力增加</b>：攻击力 +{n}（{ctx.DurOv ?? "本场战斗"}，当前加成 {ctx.Pstat.Status!.GetValueOrDefault("atkUp")}）", "ok");
                ctx.Did = true;
                return null;
            });
        Add("buff.spellUp", "法伤 +N", true, ctx => OrMatch(ReSpellUp.Match(ctx.Desc), ReSpellUpAlt.Match(ctx.Desc)),
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                CombatModel.AddBlessing(ctx.Pstat, "spellUp", n, ctx.DurOv is not null ? int.Parse(ctx.DurOv) : 0);
                deps.Log($"[[icon:crystal]] <b>祝福·法伤增加</b>：法术伤害 +{n}（{ctx.DurOv ?? "本场战斗"}，当前加成 {ctx.Pstat.Status!.GetValueOrDefault("spellUp")}）", "ok");
                ctx.Did = true;
                return null;
            });
        Add("buff.deathSave", "免疫 N 次致命伤害（死亡保险）", true, ctx => ReDeathSave.Match(ctx.Desc),
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                deps.SetDeathSave(n);
                deps.Log($"[[icon:sparkles]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：本场战斗免疫 {n} 次致命伤害（触发后该回合无敌）", "ok");
                ctx.Did = true;
                return null;
            });
        Add("buff.immune", "免疫伤害 / 无敌", true,
            ctx => ((ReImmuneWord.IsMatch(ctx.Desc) || ReInvincible.IsMatch(ctx.Desc)) && !ReDeathSave.IsMatch(ctx.Desc) ? true : null),
            (ctx, _) =>
            {
                var im = OrMatch(ReInvincibleTurns1.Match(ctx.Desc), ReInvincibleTurns2.Match(ctx.Desc));
                var n = im.Success ? int.Parse(im.Groups[1].Value) : (ctx.DurOv is not null ? int.Parse(ctx.DurOv) : 1);
                CombatModel.AddBlessing(ctx.Pstat, "immune", n);
                deps.Log($"[[icon:sparkles]] <b>祝福·免疫伤害</b>：{n} 回合内不受到任何伤害", "ok");
                ctx.Did = true;
                return null;
            });
        Add("buff.reduce", "减伤 N", true, ctx => ReReduce.IsMatch(ctx.Desc) ? ReReduce.Match(ctx.Desc) : null,
            (ctx, m) =>
            {
                var g = ((Match)m!).Groups[1];
                var n = g.Success ? int.Parse(g.Value) : 1;
                CombatModel.AddBlessing(ctx.Pstat, "reduce", n);
                deps.Log($"[[icon:plate]] <b>祝福·减伤</b>：每次受到的伤害 -{n}（本场战斗）", "ok");
                ctx.Did = true;
                return null;
            });
        Add("buff.swordForm", "剑仙形态（回合开始额外抽 1）", true,
            ctx => ReSwordForm.IsMatch(ctx.Desc) || ReSwordFormAlt.IsMatch(ctx.Desc) || ReSwordFormAlt2.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                CombatModel.AddBlessing(ctx.Pstat, "swordForm");
                deps.Log("[[icon:sword]] <b>祝福·剑仙形态</b>：回合开始时额外抽 1 张牌（本局对战）", "ok");
                ctx.Did = true;
                return null;
            });
        Add("buff.natureForm", "自然形态（回合开始额外 1 能量）", true,
            ctx => ReNatureForm.IsMatch(ctx.Desc) || ReNatureFormAlt.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                CombatModel.AddBlessing(ctx.Pstat, "natureForm");
                deps.Log("[[icon:wood]] <b>祝福·自然形态</b>：回合开始时额外获得 1 点能量（本局对战）", "ok");
                ctx.Did = true;
                return null;
            });
        Add("buff.cosmosForm", "宇宙形态（全场 1 费）", true, ctx => ReCosmosForm.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                CombatModel.AddBlessing(ctx.Pstat, "cosmosForm");
                deps.Log("[[icon:sparkles]] <b>祝福·宇宙形态</b>：本局对战内，所有卡牌变为 1 费", "ok");
                ctx.Did = true;
                return null;
            });

        // ============ 伤害段 ============
        Add("dmg.direct", "造成 N 点固定/法术/真实/攻击伤害（结构化已结算时跳过）", false,
            ctx => (!ctx.Flags.StructuredHit && !ReThisCardTime.IsMatch(ctx.Desc))
                ? (OrMatch(ReSpellDmg.Match(ctx.Desc), ReDealDamage.Match(ctx.Desc)) is { Success: true } m ? m : null)
                : null,
            (ctx, tdm) =>
            {
                var match = (Match)tdm!;
                // 「造成 N 点法伤」变体（无「害」字）走法术伤害；其余按组 2 词映射
                BattleDamageKind type;
                if (match.Groups.Count > 2 && match.Groups[2].Success)
                    type = match.Groups[2].Value == "法术" ? BattleDamageKind.Spell
                        : match.Groups[2].Value == "真实" ? BattleDamageKind.True
                        : match.Groups[2].Value == "攻击" ? BattleDamageKind.Attack : BattleDamageKind.Fixed;
                else if (Regex.IsMatch(match.Value, @"点法(?:术)?伤"))
                    type = BattleDamageKind.Spell;
                else type = BattleDamageKind.Fixed;
                var aoe = ReAoeDirect.IsMatch(ctx.Desc);
                var targets = (aoe ? deps.GetAlive().ToList() : ctx.CurseTarget is not null ? new List<BattleUnit> { ctx.CurseTarget } : new List<BattleUnit>())
                    .Where(t => t is { Dead: false }).ToList();
                var caster = deps.GetPlayerCaster();
                var total = 0;
                foreach (var t in targets) total += HitFoe(deps, ctx, t, int.Parse(match.Groups[1].Value), type, caster);
                if (targets.Count > 0)
                {
                    deps.Log($"[[icon:play]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b> → {string.Join("、", targets.Select(t => Esc(deps, t.Name)))}：造成 <b>{total}</b> 点{BattleDamage.TypeName[type]}", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("dmg.fourShots", "连开四枪（4×2 固定）", false, ctx => ReFourShots.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var t = ctx.CurseTarget;
                var total = 0;
                for (var i = 0; i < 4 && t is { Dead: false }; i++) total += HitFoe(deps, ctx, t, 2, BattleDamageKind.Fixed, null);
                deps.Log($"[[icon:swords]] <b>连开四枪</b>：对 {(t is not null ? Esc(deps, t.Name) : "目标")} 造成 {total} 点固定伤害（每枪 2 点）", "sys");
                ctx.Did = true;
                return null;
            });
        Add("dmg.multiAttack", "「攻击 N 次」整句（手选消耗后的尾段）", false, ctx => ReAttackNTimes.Match(ctx.Desc),
            (ctx, m) =>
            {
                var times = Math.Max(1, int.Parse(((Match)m!).Groups[1].Value));
                var t = ctx.CurseTarget;
                var caster = deps.GetPlayerCaster();
                var total = 0;
                for (var i = 0; i < times && t is { Dead: false }; i++) total += HitFoe(deps, ctx, t, 0, BattleDamageKind.Attack, caster);
                if (t is not null)
                    deps.Log($"[[icon:swords]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b> → {Esc(deps, t.Name)}：攻击 <b>{times}</b> 次，共造成 <b>{total}</b> 点攻击伤害", "sys");
                ctx.Did = true;
                return null;
            });
        Add("dmg.atkDown", "降低敌人攻击（割蚀）", false, ctx => ReAtkDown.Match(ctx.Desc),
            (ctx, m) =>
            {
                var t = ctx.CurseTarget;
                if (t is { Dead: false })
                {
                    var n = int.Parse(((Match)m!).Groups[2].Value);
                    t.Atk = Math.Max(0, t.Atk - n);
                    deps.Log($"[[icon:arrow]] <b>{Esc(deps, t.Name)}</b> 攻击力降低 {n} 点（当前 {t.Atk}）", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("dmg.stealAtk", "偷取攻击至 1 点（影噬）", false, ctx => ReStealAtk.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var t = ctx.CurseTarget;
                if (t is { Dead: false } && t.Atk > 1)
                {
                    var stolen = t.Atk - 1;
                    t.Atk = 1;
                    t.StealRestore += stolen;
                    CombatModel.AddBlessing(ctx.Pstat, "atkUp", stolen, 1);
                    deps.Log($"[[icon:arrow]] <b>偷取攻击</b>：<b>{Esc(deps, t.Name)}</b> 的攻击力被压到 1，你获得攻击力 +{stolen}（各自 1 回合后还原）", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("curse.extendFreeze", "延长冰冻（坚冰结界）", false, ctx => ReExtendFreeze.Match(ctx.Desc),
            (ctx, m) =>
            {
                var t = ctx.CurseTarget;
                var n = int.Parse(((Match)m!).Groups[1].Value);
                if (t is not null && (t.Status?.GetValueOrDefault("freeze") ?? 0) > 0)
                {
                    t.Status!["freeze"] += n;
                    deps.Log($"[[icon:crystal]] <b>{Esc(deps, t.Name)}</b> 的冰冻延长 {n} 回合（剩 {t.Status["freeze"]} 回合）", "sys");
                }
                else
                {
                    deps.Log("[[icon:crystal]] 目标未被冰冻，延长无效", "dim");
                }
                ctx.Did = true;
                return null;
            });
        Add("curse.randomKinds", "附加 N 种随机诅咒（致命射线）", false, ctx => ReRandomCurses.Match(ctx.Desc),
            (ctx, m) =>
            {
                var keys = new List<string>(CurseKeys);
                StepUtil.Shuffle(keys, deps.Random01);
                var picked = keys.Take(int.Parse(((Match)m!).Groups[1].Value)).ToList();
                var t = ctx.CurseTarget;
                if (t is not null)
                {
                    foreach (var k in picked) CombatModel.AddCurse(t, k, 1);
                    deps.Log($"[[icon:skull]] <b>{Esc(deps, t.Name)}</b> 附加了 {picked.Count} 种随机诅咒", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("curse.doomGate", "末日浩劫之门：全体各 1 层随机诅咒（优先不重复）", false, ctx => ReDoomGate.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var hit = 0;
                foreach (var t in deps.GetAlive().ToList())
                {
                    var fresh = CurseKeys.Where(k => !((t.Status?.GetValueOrDefault(k) ?? 0) > 0)).ToList();
                    var pool = fresh.Count > 0 ? fresh : CurseKeys.ToList();
                    var k = pool[(int)(deps.Random01() * pool.Count)];
                    CombatModel.AddCurse(t, k, 1);
                    hit++;
                }
                if (hit > 0)
                {
                    deps.Log($"[[icon:skull]] <b>末日浩劫之门</b>：对 {hit} 名敌人各施加 1 层随机诅咒（优先不重复）", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("summon.morphRandom", "变成随机招式卡牌、费用为 0（神秘药水回合开始）", false, ctx => ReMorphRandom.Match(ctx.Desc),
            (ctx, m) =>
            {
                var match = (Match)m!;
                var want = match.Groups[2].Value == "法术" ? "法术" : "武术";
                var pool = deps.AllCards().Where(c => c.Type == want && c.Rarity != "衍生" && c.Type is not ("生物" or "事件")).ToList();
                var c = pool.Count > 0 ? pool[(int)(deps.Random01() * pool.Count)] : null;
                if (c is not null)
                {
                    var copy = c.Clone();
                    copy.Cost = 0;
                    copy.BaseCost = c.Cost;
                    deps.AddTempCard(copy);
                    deps.Log($"[[icon:flask]] 神秘变化：变成【<b>{Esc(deps, c.Name)}</b>】（招式，费用已降为 0）", "loot");
                }
                else deps.Log("[[icon:flask]] 卡牌库是空的，什么也没有变成", "dim");
                ctx.Did = true;
                return null;
            });
        Add("summon.randomKeyedZero", "获得随机「箭矢/火球/药水…」并降为 0 费（天狼长弓）", false, ctx => ReRandomKeyed.Match(ctx.Desc),
            (ctx, m) =>
            {
                var match = (Match)m!;
                var raw = match.Groups[2].Value;
                var key = raw == "箭矢" ? "箭" : raw;
                var pool = deps.AllCards().Where(c => c.Rarity != "衍生" && c.Type is not ("生物" or "事件") &&
                    (key == "杀" ? (c.Id == "builtin-sha" || c.Name == "杀" || c.Name == "初始攻击")
                        : key == "招式" ? c.Type == "武术"
                        : (c.Name ?? "").Contains(key))).ToList();
                var c = pool.Count > 0 ? pool[(int)(deps.Random01() * pool.Count)] : null;
                if (c is not null)
                {
                    var copy = c.Clone();
                    copy.Cost = 0;
                    copy.BaseCost = c.Cost;
                    deps.AddTempCard(copy);
                    deps.Log($"[[icon:cards]] 获得【<b>{Esc(deps, c.Name)}</b>】，其费用已变为 0", "loot");
                }
                else deps.Log($"[[icon:question]] 找不到随机的「{Esc(deps, key)}」（占位）", "warn");
                ctx.Did = true;
                return null;
            });
        Add("curse.enumeration", "诅咒枚举句「(N′)冰冻、流血、中毒」", false, ctx => ReCurseEnumeration.Match(ctx.Desc),
            (ctx, m) =>
            {
                var match = (Match)m!;
                var t = ctx.CurseTarget;
                if (t is not null)
                {
                    var keyMap = new Dictionary<string, string> { ["冰冻"] = "freeze", ["流血"] = "bleed", ["中毒"] = "poison", ["沉默"] = "silence", ["破甲"] = "abreak", ["禁疗"] = "healban", ["灼烧"] = "burn" };
                    if (match.Groups[1].Success)
                        HitFoe(deps, ctx, t, int.Parse(match.Groups[1].Value), BattleDamageKind.Spell, deps.GetPlayerCaster());
                    foreach (var w in Regex.Split(match.Groups[2].Value, "[、，]\\s*"))
                        CombatModel.AddCurse(t, keyMap[w], 1);
                    deps.Log($"[[icon:skull]] <b>{Esc(deps, t.Name)}</b> 附加：{Esc(deps, match.Groups[2].Value)}{(match.Groups[1].Success ? $"（并受到 {match.Groups[1].Value} 点法术伤害）" : "")}", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("dmg.fireballN", "施放 N 次火球（星陨之力）", false,
            ctx => ctx.CurseTarget is not null ? ReFireballN.Match(ctx.Desc) : null,
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                var caster = deps.GetPlayerCaster();
                var total = 0;
                for (var k = 0; k < n && ctx.CurseTarget is { Dead: false }; k++)
                    total += HitFoe(deps, ctx, ctx.CurseTarget, 4, BattleDamageKind.Spell, caster);
                deps.Log($"[[icon:fire]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：施放 {n} 次火球 → {Esc(deps, ctx.CurseTarget?.Name ?? "?")}，共 {total} 点法术伤害", "sys");
                ctx.Did = true;
                return null;
            });
        Add("dmg.stormFireball", "全体敌人每人 1 次火球（风暴火球）", false, ctx => ReStormFireball.Match(ctx.Desc),
            (ctx, m) =>
            {
                var g = ((Match)m!).Groups[1];
                var per = g.Success ? int.Parse(g.Value) : 1;
                var caster = deps.GetPlayerCaster();
                var total = 0;
                foreach (var t in deps.GetAlive().ToList())
                    for (var k = 0; k < per && !t.Dead; k++)
                        total += HitFoe(deps, ctx, t, 4, BattleDamageKind.Spell, caster);
                deps.Log($"[[icon:fire]] 火球风暴：对全体敌人各施放 {per} 次火球，共 {total} 点法术伤害", "sys");
                ctx.Did = true;
                return null;
            });
        Add("dmg.selfReceived", "受到 N 点伤害（自伤）", false, ctx => ReSelfDamage.Match(ctx.Desc),
            (ctx, m) => { deps.DamagePlayer(int.Parse(((Match)m!).Groups[1].Value)); ctx.Did = true; return null; });
        Add("buff.maxHpUp", "血量上限 +N（混沌之眼）", true, ctx => ReMaxHpUp.Match(ctx.Desc),
            (ctx, m) => { deps.AddPlayerMaxHp(int.Parse(((Match)m!).Groups[1].Value)); ctx.Did = true; return null; });
        Add("hand.dumpAll", "消耗所有手牌（金蝉脱壳）", false, ctx => ReDumpAllHand.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var nDump = deps.DumpHand();
                deps.Log($"[[icon:flask]] 消耗了所有手牌（{nDump} 张）", "sys");
                ctx.Did = true;
                return null;
            });
        Add("buff.dodge", "闪避：本回合避开第 N 段伤害", false, ctx => ReDodge.Match(ctx.Desc),
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                if (n == 0) n = 1;
                CombatModel.AddBlessing(ctx.Pstat, "reduce", n, 1);
                deps.Log($"[[icon:shield]] <b>闪避</b>：本回合受到的伤害 -{n}", "ok");
                ctx.Did = true;
                return null;
            });

        // ============ 回复 / 护甲 / 抽牌 / 手选段 ============
        Add("heal.n", "回复 N 点生命 / +N 血", true, ctx => OrMatch(ReHealN.Match(ctx.Desc), ReHealPlus.Match(ctx.Desc)),
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                ctx.Healed = true;
                if (ctx.Pstat.Status.GetValueOrDefault("healban") > 0)
                    deps.Log($"[[icon:heart]] 禁疗中：回复 {n} 点生命无效（还剩 {ctx.Pstat.Status.GetValueOrDefault("healban")} 回合）", "warn");
                else
                {
                    deps.Heal(n);
                    deps.PushFloat(new FloatEvent { Unit = "self", Text = "💚", Cls = "stk", Warm = true });
                }
                ctx.Did = true;
                return null;
            });
        Add("heal.restoreConsumed", "战斗内复原/复活消耗卡", true, ctx => ReRestoreConsumed.Match(ctx.Desc),
            (ctx, m) =>
            {
                var g = ((Match)m!).Groups[1];
                var c = deps.RestoreConsumed(g.Success ? int.Parse(g.Value) : 1);
                if (c > 0) ctx.Did = true;
                return null;
            });
        Add("hand.selectFamily", "手选家族：选牌施放 / 复制 / 消耗+尾段", false,
            ctx =>
            {
                var selPlay = ReSelPlay.Match(ctx.Desc);
                if (selPlay.Success) return new SelMatch("play", selPlay);
                if (ReSelCopy.IsMatch(ctx.Desc)) return new SelMatch("copy", null);
                var consM = ReConsumeHand.Match(ctx.Desc);
                if (consM.Success) return new SelMatch("consume", consM);
                return null;
            },
            (ctx, m) =>
            {
                var sel = (SelMatch)m!;
                if (sel.Kind == "play")
                {
                    var n23 = new Dictionary<string, int> { ["一"] = 1, ["两"] = 2, ["二"] = 2, ["三"] = 3 };
                    var numStr = sel.Match!.Groups[1].Value;
                    var n = n23.GetValueOrDefault(numStr, int.TryParse(numStr, out var p) ? p : 1);
                    var typeRaw = sel.Match!.Groups[2].Success ? sel.Match.Groups[2].Value : null;
                    deps.QueueHandSelect(new HandSelectJob { N = n, Type = typeRaw == "牌" ? null : typeRaw, Act = "play" });
                    deps.Log($"[[icon:cards]] 从手牌选择 <b>{n}</b> 张{(typeRaw is not null && typeRaw != "牌" ? typeRaw : "")}牌打出", "sys");
                    ctx.Did = true;
                    return null;
                }
                if (sel.Kind == "copy")
                {
                    deps.QueueHandSelect(new HandSelectJob { N = 1, Type = null, Act = "copy" });
                    deps.Log("[[icon:cards]] 从手牌选择 <b>1</b> 张复制（原牌保留）", "sys");
                    ctx.Did = true;
                    return null;
                }
                var consM = sel.Match!;
                var count = consM.Groups[1].Value == "一张" ? 1 : (TextClauses.CnNum.TryGetValue(consM.Groups[1].Value, out var cn) ? cn : int.Parse(consM.Groups[1].Value));
                var type = consM.Groups[2].Value == "牌" ? null : consM.Groups[2].Value;
                deps.QueueHandSelect(new HandSelectJob
                {
                    N = count, Type = type, Act = "consume", ThenText = consM.Groups[3].Value,
                    Target = ctx.CurseTarget, SrcCard = ctx.Card,
                });
                var tail = consM.Groups[3].Value;
                ctx.Did = true;
                ctx.Drawn = Regex.IsMatch(tail, @"抽\s*(?:\d+|[一二两三四])\s*张");
                ctx.Healed = Regex.IsMatch(tail, @"回复|\+\s*\d+\s*血");
                ctx.Armored = Regex.IsMatch(tail, @"护甲|\+\s*\d+\s*甲");
                return StepOutcome.Halt(new ClauseResult(true, ctx.Drawn, ctx.Healed, ctx.Armored));
            });
        Add("misc.mystery", "随机神秘效果（神秘药水三选一）", false, ctx => ReMystery.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var r = deps.Random01();
                if (r < 1.0 / 3)
                {
                    deps.Heal(8);
                    deps.Log("[[icon:flask]] 神秘药水：回复 <b>8</b> 点生命", "ok");
                }
                else if (r < 2.0 / 3)
                {
                    deps.DrawCards(2);
                    deps.Log("[[icon:flask]] 神秘药水：抽 <b>2</b> 张牌", "ok");
                }
                else
                {
                    var c = deps.RandomDiscoverCard(null);
                    if (c is not null)
                    {
                        deps.AddTempCard(c);
                        deps.RandomAcquired(c);
                        deps.Log($"[[icon:flask]] 神秘药水：随机获得【<b>{Esc(deps, c.Name)}</b>】置入手牌", "loot");
                    }
                    else deps.Log("[[icon:flask]] 神秘药水：卡牌库是空的，什么也没有发生", "dim");
                }
                ctx.Did = true;
                return null;
            });
        Add("def.armor", "获得 N 点护甲 / +N 甲", true, ctx => OrMatch(ReArmorGain.Match(ctx.Desc), ReArmorPlus.Match(ctx.Desc)),
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                ctx.Armored = true;
                ctx.Pdef.Armor += n;
                deps.Log($"[[icon:plate]] 获得 {n} 点护甲", "sys");
                ctx.Did = true;
                return null;
            });
        Add("def.shield", "获得 N 点护盾", true, ctx => ReShieldGain.Match(ctx.Desc),
            (ctx, m) =>
            {
                ctx.Pdef.Shield += int.Parse(((Match)m!).Groups[1].Value);
                deps.Log($"[[icon:shield]] 获得 {((Match)m!).Groups[1].Value} 点护盾", "sys");
                ctx.Did = true;
                return null;
            });
        Add("def.guard", "格挡：本回合所受伤害降为 1", true, ctx => ReGuard.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                ctx.Pdef.Guard = true;
                deps.Log("[[icon:shield]] 格挡：本回合所受伤害降为 1", "sys");
                ctx.Did = true;
                return null;
            });
        Add("buff.purify", "净化", true, ctx => RePurify.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var cleared = CombatModel.Purify(ctx.Pstat);
                deps.Log(cleared.Count > 0
                    ? $"[[icon:sparkles]] 净化：清除了身上的 {string.Join("、", cleared.Select(k => CombatModel.CurseMeta[k].Name))}"
                    : "[[icon:sparkles]] 净化：身上没有诅咒，干干净净", "ok");
                ctx.Did = true;
                return null;
            });
        Add("draw.n", "抽 N 张牌（BOSS 抽牌 / 普通战获得初始攻击）", true,
            ctx =>
            {
                var turnExtraDraw = ReTurnExtraDraw.IsMatch(ctx.Desc);
                var perReleaseDraw = RePerReleaseDraw.IsMatch(ctx.Desc);
                var perCurseDraw = RePerCurseDraw.Match(ctx.Desc);
                var dm = OrMatch(ReDrawRange.Match(ctx.Desc), ReDrawN.Match(ctx.Desc));
                if ((dm.Success || perCurseDraw.Success) && !turnExtraDraw && !perReleaseDraw
                    && !ReThisCardTime.IsMatch(ctx.Desc) && !ReDrawThenInsert.IsMatch(ctx.Desc))
                    return new DrawMatch(dm, perCurseDraw);
                return null;
            },
            (ctx, m) =>
            {
                var dm = ((DrawMatch)m!).Dm;
                var perCurseDraw = ((DrawMatch)m!).PerCurseDraw;
                var n = perCurseDraw.Success ? int.Parse(perCurseDraw.Groups[1].Value) : int.Parse(dm.Groups[1].Value);
                if (perCurseDraw.Success && ctx.CurseTarget is not null)
                {
                    var kinds = CombatModel.Curses.Count(k => (ctx.CurseTarget.Status?.GetValueOrDefault(k) ?? 0) > 0);
                    n *= Math.Max(1, kinds);
                    deps.Log($"[[icon:skull]] 目标身上有 {kinds} 种诅咒，抽牌量放大", "sys");
                }
                if (deps.GetMode() == "boss")
                {
                    var got = deps.DrawCards(n);
                    deps.Log($"[[icon:cards]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：抽了 {got} 张牌", "sys");
                }
                else
                {
                    deps.GrantStarterAttack(n);
                    deps.Log($"[[icon:cards]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：获得 {n} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）", "sys");
                }
                ctx.Did = true;
                ctx.Drawn = true;
                var autoM = ReAutoReleaseType.Match(ctx.Desc);
                if (autoM.Success)
                {
                    var played = deps.AutoPlayHandType(autoM.Groups[1].Value == "招式" ? "武术" : autoM.Groups[1].Value);
                    if (played > 0) deps.Log($"[[icon:swords]] <b>万剑归宗</b>：直接释放了其中 {played} 张{autoM.Groups[1].Value}", "ok");
                }
                return null;
            });
        Add("draw.noDrawNext", "下回合无法抽牌", true, ctx => ReNoDrawNext.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                deps.MarkNoDrawNext();
                deps.Log("[[icon:cross]] 已标记：<b>下回合开始无法抽牌</b>", "sys");
                ctx.Did = true;
                return null;
            });

        // ============ 击杀 / 行动 / 资源段 ============
        Add("kill.minions", "消灭 N 名敌人（可带攻击力门槛，无门槛优先残血）", false, ctx => ReKillMinions.Match(ctx.Desc),
            (ctx, m) =>
            {
                var match = (Match)m!;
                var n = int.Parse(match.Groups[1].Value);
                var cap = match.Groups[2].Success ? int.Parse(match.Groups[2].Value) : (int?)null;
                List<BattleUnit> targets;
                if (cap is not null)
                    targets = deps.GetAlive().Where(f => !f.Dead && f.Affix is null && f.Atk <= cap).Take(n).ToList();
                else
                    targets = deps.GetAlive().Where(f => !f.Dead && f.Hp > 0 && f.Hp < f.MaxHp).Take(n).ToList();
                foreach (var f in targets)
                {
                    f.Hp = 0;
                    f.Dead = true;
                    deps.Log($"[[icon:skull]] <b>{Esc(deps, f.Name)}</b> 被消灭！", "ok");
                }
                if (targets.Count > 0)
                {
                    deps.PushFloat(new FloatEvent { Unit = "self", Text = "💥", Cls = "stk" });
                    ctx.Did = true;
                }
                return null;
            });
        Add("cast.nextSpellTimes", "注能打出时「下一张法术施放 N 次」（元素风暴）", false,
            ctx => ctx.Flags.Infused ? ReNextSpellTimes.Match(ctx.Desc) : null,
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                deps.SetNextSpellTwice(n);
                deps.Log($"[[icon:sparkles]] <b>元素风暴</b>：下一张法术将施放 {n} 次", "ok");
                ctx.Did = true;
                return null;
            });
        Add("dmg.taunt", "扰敌：迫使前两名敌人相互攻击", false, ctx => ReTaunt.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var ts = deps.GetAlive().Take(2).ToList();
                if (ts.Count == 2)
                {
                    var r = HitFoe(deps, ctx, ts[1], 0, BattleDamageKind.Attack, new CasterRef { Atk = ts[0].Atk });
                    deps.Log($"[[icon:swords]] <b>扰敌</b>：{Esc(deps, ts[0].Name)} 被迫攻击 {Esc(deps, ts[1].Name)}，造成 {r} 点伤害", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("dmg.attackAll", "攻击全体敌人（按攻击力结算）", false, ctx => ReAttackAll.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var caster = deps.GetPlayerCaster();
                var total = 0;
                foreach (var t in deps.GetAlive().ToList()) total += HitFoe(deps, ctx, t, 0, BattleDamageKind.Attack, caster);
                deps.Log($"[[icon:swords]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：攻击全体敌人，共造成 {total} 点攻击伤害", "sys");
                ctx.Did = true;
                return null;
            });
        Add("dmg.loseLife", "损失 N 点生命（恶魔之力）", false, ctx => ReLoseLife.Match(ctx.Desc),
            (ctx, m) => { deps.DamagePlayer(int.Parse(((Match)m!).Groups[1].Value)); ctx.Did = true; return null; });
        Add("dmg.negHp", "自伤「-N 血」", false, ctx => ReNegHp.Match(ctx.Desc),
            (ctx, m) => { deps.DamagePlayer(int.Parse(((Match)m!).Groups[1].Value)); ctx.Did = true; return null; });
        Add("def.armorLoss", "回合结束护甲衰减「-N 点」（坚盾）", false, ctx => ReArmorLoss.Match(ctx.Desc),
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                ctx.Pdef.Armor = Math.Max(0, ctx.Pdef.Armor - n);
                deps.Log($"[[icon:plate]] 护甲衰减：-{n} 点（当前 {ctx.Pdef.Armor}）", "warn");
                ctx.Did = true;
                return null;
            });
        Add("heal.upTo", "回复至 N 血（沐愈光辉）", false, ctx => ReHealUpTo.Match(ctx.Desc),
            (ctx, m) =>
            {
                var want = int.Parse(((Match)m!).Groups[1].Value);
                var cur = deps.GetPlayerHp();
                if (ctx.Pstat.Status.GetValueOrDefault("healban") > 0)
                    deps.Log($"[[icon:heart]] 禁疗中：回复至 {want} 血无效（还剩 {ctx.Pstat.Status.GetValueOrDefault("healban")} 回合）", "warn");
                else if (want > cur)
                {
                    deps.Heal(want - cur);
                    deps.PushFloat(new FloatEvent { Unit = "self", Text = "💚", Cls = "stk", Warm = true });
                    deps.Log($"[[icon:heart]] 回复至 <b>{want}</b> 血（当前 {cur}，回复 {want - cur}）", "ok");
                }
                else deps.Log($"[[icon:heart]] 回复至 {want} 血：当前 {cur} 不低于目标值，无变化", "ok");
                ctx.Did = true;
                return null;
            });
        Add("curse.immobilize", "无法行动（制敌 → 冰冻 1 回合）", false,
            ctx => ReImmobilizeWord(ctx) ? true : null,
            (ctx, _) =>
            {
                if (ctx.CurseTarget is not null)
                {
                    CombatModel.AddCurse(ctx.CurseTarget, "freeze", 1);
                    deps.Log($"[[icon:crystal]] <b>{Esc(deps, ctx.CurseTarget.Name)}</b> 无法行动（冰冻 1 回合）", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("curse.poisonDouble", "中毒层数翻倍并立即触发毒伤（花鸩）", false, ctx => RePoisonDouble.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                if (ctx.CurseTarget is not null)
                {
                    var t = ctx.CurseTarget;
                    CombatModel.AddCurse(t, "poison", t.Status?.GetValueOrDefault("poison") ?? 0);
                    var burst = deps.BurstPoison(t) ?? new BattleDamageResult { Dealt = 0 };
                    deps.Log($"[[icon:skull]] <b>{Esc(deps, t.Name)}</b> 中毒翻倍至 {t.Status?.GetValueOrDefault("poison") ?? 0} 层并立即触发 {burst.Dealt} 点毒伤", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("hand.fillRandom", "置入随机卡牌直至手牌达到 N 张（露娜拉）", false, ctx => ReFillRandom.Match(ctx.Desc),
            (ctx, m) =>
            {
                var want = int.Parse(((Match)m!).Groups[1].Value);
                var put = 0;
                var spells = 0;
                while (deps.GetHandSize() < want)
                {
                    var c = deps.RandomDiscoverCard(null);
                    if (c is null) break;
                    deps.AddTempCard(c);
                    put++;
                    deps.RandomAcquired(c);
                    if (c.Type == "法术") spells++;
                }
                var perM = ReFillHealPer.Match(ctx.Desc);
                var healedN = perM.Success ? int.Parse(perM.Groups[1].Value) : 0;
                if (healedN > 0 && spells > 0)
                {
                    deps.Heal(healedN * spells);
                    deps.PushFloat(new FloatEvent { Unit = "self", Text = "💚", Cls = "stk", Warm = true });
                    deps.Log($"[[icon:cards]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：置入 {put} 张随机卡牌（手牌达到 {deps.GetHandSize()} 张），其中 {spells} 张法术 → 回复 {healedN * spells} 血", "loot");
                }
                else deps.Log($"[[icon:cards]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：置入 {put} 张随机卡牌（手牌达到 {deps.GetHandSize()} 张）", "loot");
                if (put > 0) ctx.Did = true;
                return null;
            });
        Add("hand.copyRandom", "获得一张随机手牌的复制（刀剑形态）", false, ctx => ReCopyRandomHand.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var cards = deps.GetHandCards();
                if (cards.Count > 0)
                {
                    var tpl = cards[(int)(deps.Random01() * cards.Count)];
                    if (tpl is not null)
                    {
                        deps.AddTempCard(tpl.Card);
                        deps.Log($"[[icon:cards]] 复制了手牌中的【<b>{Esc(deps, tpl.Card.Name)}</b>】（置入手牌）", "loot");
                        ctx.Did = true;
                    }
                }
                return null;
            });
        Add("hand.tokenPass", "获得员工通行证A/B（战后消散）", false, ctx => ReTokenPass.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var pool = deps.AllCards().Where(c => c.Id is "tt-token-gold" or "tt-token-color").ToList();
                if (pool.Count > 0)
                {
                    var got = pool[(int)(deps.Random01() * pool.Count)];
                    deps.AddTempCard(got);
                    deps.Log($"[[icon:sparkles]] 获得【<b>{Esc(deps, got.Name)}</b>】（令牌，战后消散）", "loot");
                    ctx.Did = true;
                }
                return null;
            });
        Add("misc.flee", "非 BOSS 战逃跑一次（烟雾弹）", false, ctx => ReFlee.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) => { deps.FleeBattle(); ctx.Did = true; return null; });
        Add("buff.randomBlessing", "随机获取一项祝福（天国之门）", false, ctx => ReBlessingRandom.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var cand = new List<(string Key, string Name, Action Run)>();
                if (ReStealthWord.IsMatch(ctx.Desc)) cand.Add(("stealth", "潜行", () => CombatModel.AddBlessing(ctx.Pstat, "stealth", 1)));
                if (ReAtkWord.IsMatch(ctx.Desc)) cand.Add(("atkUp", "攻击力 +1", () => CombatModel.AddBlessing(ctx.Pstat, "atkUp", 1)));
                if (ReSpellWord.IsMatch(ctx.Desc)) cand.Add(("spellUp", "法伤 +1", () => CombatModel.AddBlessing(ctx.Pstat, "spellUp", 1)));
                if (Regex.IsMatch(ctx.Desc, "减伤")) cand.Add(("reduce", "减伤 1", () => CombatModel.AddBlessing(ctx.Pstat, "reduce", 1)));
                if (ReArmorWord.IsMatch(ctx.Desc)) cand.Add(("_armor", "护甲 5", () => ctx.Pdef.Armor += 5));
                if (RePurifyWord.IsMatch(ctx.Desc)) cand.Add(("_purify", "净化", () => CombatModel.Purify(ctx.Pstat)));
                if (cand.Count > 0)
                {
                    var fresh = cand.Where(c => c.Key.StartsWith('_') || !((ctx.Pstat.Status?.GetValueOrDefault(c.Key) ?? 0) > 0)).ToList();
                    var pool = fresh.Count > 0 ? fresh : cand;
                    var pick = pool[(int)(deps.Random01() * pool.Count)];
                    pick.Run();
                    deps.Log($"[[icon:sparkles]] <b>祝福·{Esc(deps, pick.Name)}</b>（随机祝福，优先不重复）", "ok");
                    ctx.Did = true;
                }
                return null;
            });
        Add("draw.fromDeck", "从牌库中抽取 N 张指定类型（武装）", false, ctx => ReDrawFromDeck.Match(ctx.Desc),
            (ctx, m) =>
            {
                var match = (Match)m!;
                var kind = match.Groups[2].Value is "杀" or "初始攻击" ? "杀" : match.Groups[2].Value;
                deps.DeckDraw(new DeckDrawJob(int.Parse(match.Groups[1].Value), kind));
                ctx.Did = true;
                return null;
            });
        Add("heal.allies", "治疗所有队友（银河幻境）", false, ctx => ReHealAllies.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                deps.Heal(3);
                deps.PushFloat(new FloatEvent { Unit = "self", Text = "💚", Cls = "stk", Warm = true });
                deps.Log("[[icon:heart]] 治疗所有队友：回复 <b>3</b> 点生命", "ok");
                ctx.Did = true;
                return null;
            });
        Add("hand.curseCards", "随机获取 N 张能施加诅咒的卡牌/招式（厄运）", false, ctx => ReCurseCards.Match(ctx.Desc),
            (ctx, m) =>
            {
                var match = (Match)m!;
                var wantType = match.Groups[2].Value == "招式" ? "武术" : null;
                var pool = deps.AllCards().Where(c =>
                    c.Rarity != "衍生" && new[] { "武术", "法术", "装备", "能力卡" }.Contains(c.Type) &&
                    (wantType is null || c.Type == wantType) &&
                    Regex.IsMatch(c.Desc ?? "", "诅咒|中毒|流血|冰冻|沉默|破甲|禁疗")).ToList();
                var got = 0;
                for (var i = 0; i < int.Parse(match.Groups[1].Value) && pool.Count > 0; i++)
                {
                    var c = pool[(int)(deps.Random01() * pool.Count)];
                    deps.AddTempCard(c);
                    got++;
                }
                deps.Log($"[[icon:skull]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：随机获得 {got} 张【能施加诅咒{(wantType is not null ? "的招式" : "")}】的卡牌（置入手牌，战后消散）", "loot");
                if (got > 0) ctx.Did = true;
                return null;
            });
        Add("discover.potion", "发现 1 瓶药水并直接释放（药水魔法）", false, ctx => RePotionDiscover.Match(ctx.Desc),
            (ctx, _) =>
            {
                deps.QueueDiscover(new DiscoverJob { N = 1, Act = "potion", Pred = TextClauses.ParsePoolNoun("药水", ctx.MyClass) });
                deps.Log($"[[icon:flask]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：发现 1 瓶药水并直接释放", "sys");
                ctx.Did = true;
                return null;
            });
        Add("discover.infuseFree", "发现一张注能卡，使其无需注能（灵能召唤）", false, ctx => ReDiscoverInfuse.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var pred = TextClauses.ParsePoolNoun("注能", ctx.MyClass);
                var c = pred is not null ? deps.RandomDiscoverCard(pred) : null;
                if (c is not null)
                {
                    var copy = c.Clone();
                    copy.NoInfuse = true;
                    deps.AddTempCard(copy);
                    deps.Log($"[[icon:crystal]] <b>灵能召唤</b>：发现【<b>{Esc(deps, c.Name)}</b>】，其无需注能即可打出", "loot");
                }
                else deps.Log("[[icon:question]] 没有可发现的注能卡", "dim");
                ctx.Did = true;
                return null;
            });
        Add("discover.pool", "发现/随机获取/获得 N 张 ______（统一入口 + 限制卡池）", false,
            ctx => !ReThisCardTime.IsMatch(ctx.Desc) ? ReDiscoverPool.Match(ctx.Desc) : null,
            (ctx, m) =>
            {
                var dPool = (Match)m!;
                var n0 = dPool.Groups[1].Success
                    ? (PoolNum.TryGetValue(dPool.Groups[1].Value, out var cn) ? cn : int.Parse(dPool.Groups[1].Value))
                    : 1;
                var noun = dPool.Groups[2].Value;
                var pred = TextClauses.ParsePoolNoun(noun, ctx.MyClass);
                var n = ReEqualRandom.IsMatch(ctx.Desc) ? 2 : n0;
                string? act = null;
                if (ReDirectCastLead.IsMatch(dPool.Value) || ReDirectCast.IsMatch(ctx.Desc)) act = "play";
                if (RePlayKeep.IsMatch(ctx.Desc)) act = "playKeep";
                if (ReDup.IsMatch(ctx.Desc)) act = "dup";
                deps.QueueDiscover(new DiscoverJob
                {
                    N = n, Pred = pred, Act = act,
                    PriceArmor = RePriceArmor.IsMatch(ctx.Desc),
                    ConsumeTempAtTurn = ReConsumeAtTurn.IsMatch(ctx.Desc),
                });
                var label = pred is not null ? Regex.Replace(noun, "的$", "") : "";
                deps.Log($"[[icon:question]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：{act switch { "play" => "发现并直接施放", "playKeep" => "发现（施放 1 张，其余入手）", _ => "发现" }} {n} 张{(label.Length > 0 ? $"【{Esc(deps, label)}】" : "")}卡牌{(pred is not null ? "（限制卡池）" : "")}", "sys");
                ctx.Did = true;
                return null;
            });

        // ============ 牌库操作段 ============
        Add("deck.insert", "洗入牌库（随机 N 张 / 指名卡，含「然后抽 N 张」）", true,
            ctx =>
            {
                var shR = OrMatch(ReInsertRandom.Match(ctx.Desc), ReInsertRandomAlt.Match(ctx.Desc));
                var shN = !shR.Success ? ReInsertNamed.Match(ctx.Desc) : Match.Empty;
                return shR.Success || shN.Success ? new InsertMatch(shR, shN) : null;
            },
            (ctx, m) =>
            {
                var ins = (InsertMatch)m!;
                var added = new List<string>();
                var cheap = ReCheapen.IsMatch(ctx.Desc);
                if (ins.ShR.Success)
                {
                    for (var i = 0; i < int.Parse(ins.ShR.Groups[1].Value); i++)
                    {
                        var discovered = deps.RandomDiscoverCard(null);
                        if (discovered is not null)
                        {
                            var copy = discovered;
                            if (cheap)
                            {
                                copy = discovered.Clone();
                                copy.Cost = Math.Max(0, (discovered.Cost) - 1);
                            }
                            deps.AddDeckCard(copy);
                            deps.RandomAcquired(discovered);
                            added.Add(discovered.Name);
                        }
                    }
                    if (cheap && added.Count > 0) deps.Log($"[[icon:bolt]] 洗入的 {added.Count} 张随机卡牌费用均已 -1", "sys");
                }
                if (ins.ShN.Success)
                {
                    var rawName = Regex.Replace(ins.ShN.Groups[2].Value, "[‘’“”「」]", "");
                    var count = ins.ShN.Groups[1].Success
                        ? (PoolNum.TryGetValue(ins.ShN.Groups[1].Value, out var cn) ? cn : int.Parse(ins.ShN.Groups[1].Value))
                        : 1;
                    foreach (var nm in Regex.Split(rawName, "[与和、]"))
                    {
                        var exact = deps.AllCards().FirstOrDefault(c => c.Name == nm);
                        var series = exact is not null ? new[] { exact } : deps.AllCards().Where(c => (c.Name ?? "").StartsWith(nm, StringComparison.Ordinal)).ToArray();
                        if (series.Length > 0)
                        {
                            for (var i = 0; i < count; i++)
                            {
                                var tpl = series[i % series.Length];
                                deps.AddDeckCard(tpl);
                                added.Add(tpl.Name);
                            }
                        }
                        else deps.Log($"[[icon:question]] 【{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}】找不到可洗入牌库的卡牌「{Esc(deps, nm)}」（占位）", "warn");
                    }
                }
                if (added.Count > 0)
                {
                    var deckSize = deps.ShuffleDeck();
                    var counts = new Dictionary<string, int>();
                    foreach (var name in added) counts[name] = counts.GetValueOrDefault(name) + 1;
                    deps.Log($"[[icon:recycle]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：将 {string.Join("、", counts.Select(kv => $"【{Esc(deps, kv.Key)}】×{kv.Value}"))} 洗入牌库" +
                        $"（牌库 {deckSize} 张，已洗混）", "sys");
                    var afterDraw = ReAfterInsertDraw.Match(ctx.Desc);
                    if (afterDraw.Success)
                    {
                        var n2 = PoolNum.TryGetValue(afterDraw.Groups[1].Value, out var cn) ? cn : int.Parse(afterDraw.Groups[1].Value);
                        if (deps.GetMode() == "boss")
                        {
                            var got = deps.DrawCards(n2);
                            deps.Log($"[[icon:cards]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：洗入后抽了 {got} 张牌", "sys");
                        }
                        else
                        {
                            deps.GrantStarterAttack(n2);
                            deps.Log($"[[icon:cards]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：洗入后获得 {n2} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）", "sys");
                        }
                    }
                    ctx.Did = true;
                }
                return null;
            });
        Add("deck.insertHand", "将 N 张【指名卡】置入手牌", true, ctx => ReInsertHand.Match(ctx.Desc),
            (ctx, m) =>
            {
                var match = (Match)m!;
                var nm = Regex.Replace(match.Groups[2].Value, "[‘’“”「」]", "");
                var tpl = deps.AllCards().FirstOrDefault(c => c.Name == nm);
                var count = match.Groups[1].Success
                    ? (PoolNum.TryGetValue(match.Groups[1].Value, out var cn) ? cn : int.Parse(match.Groups[1].Value))
                    : 1;
                if (tpl is not null)
                {
                    for (var i = 0; i < count; i++) deps.AddTempCard(tpl);
                    deps.Log($"[[icon:cards]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：将 {count} 张【{Esc(deps, tpl.Name)}】置入手牌（战斗内临时卡，战后消散）", "loot");
                }
                else deps.Log($"[[icon:question]] 【{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}】找不到可置入手牌的卡牌「{Esc(deps, nm)}」（占位）", "warn");
                ctx.Did = true;
                return null;
            });
        Add("deck.gainNamed", "获得 N 张指名道姓的卡（置句末才识别）", false,
            ctx => (ReGainNamed.Match(ctx.Desc) is { Success: true } gn && gn.Groups[2].Value is not ("随机" or "等量")) ? gn : null,
            (ctx, gn) =>
            {
                var match = (Match)gn!;
                var nm = Regex.Replace(match.Groups[2].Value, "[‘’“”「」]", "");
                var tpl = deps.AllCards().FirstOrDefault(c => c.Name == nm);
                var count = PoolNum.TryGetValue(match.Groups[1].Value, out var cn) ? cn : int.Parse(match.Groups[1].Value);
                if (tpl is not null)
                {
                    for (var i = 0; i < count; i++) deps.AddTempCard(tpl);
                    deps.Log($"[[icon:cards]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：获得 {count} 张【{Esc(deps, tpl.Name)}】（置入手牌）", "loot");
                }
                else deps.Log($"[[icon:question]] 【{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}】找不到卡牌「{Esc(deps, nm)}」（占位）", "warn");
                ctx.Did = true;
                return null;
            });

        // ============ 战斗规则登记段 ============
        Add("rule.shaTransform", "「杀」化为另一张卡（不朽神剑/龙吟沧海）", true, ctx => ReShaTransform.Match(ctx.Desc),
            (ctx, m) =>
            {
                var name = ((Match)m!).Groups[2].Value;
                deps.SetShaTransform(name);
                deps.Log($"[[icon:recycle]] <b>战斗规则</b>：你的「初始攻击」在本场战斗中化为【<b>{Esc(deps, name)}</b>】", "ok");
                ctx.Did = true;
                return null;
            });
        Add("rule.consumeFireball", "每消耗 1 张卡牌施放火球（深渊降焰）", true, ctx => ReConsumeFireball.Match(ctx.Desc),
            (ctx, m) =>
            {
                var g = ((Match)m!).Groups[1];
                deps.SetConsumeFireball(g.Success ? int.Parse(g.Value) : 1);
                deps.Log("[[icon:fire]] <b>战斗规则</b>：每消耗 1 张卡牌，自动施放火球", "ok");
                ctx.Did = true;
                return null;
            });
        Add("rule.turnStartDiscover", "句内嵌「回合开始时发现 N 张」拆出为延迟段（万法乾坤）", true, ctx => ReTurnStartDiscover.Match(ctx.Desc),
            (ctx, m) =>
            {
                var text = ((Match)m!).Groups[1].Value;
                deps.RegisterTurnStartText(text, EffectStepsFactory.CardName(ctx.Card));
                deps.Log($"[[icon:hourglass]] <b>回合开始时</b>：【{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}】{Esc(deps, text)}（下个回合开始起每回合生效）", "sys");
                ctx.Did = true;
                return null;
            });
        Add("rule.stealthStrike", "破隐一击伤害翻倍（白梅落影·妄）", true, ctx => ReStealthStrike.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                deps.SetStealthStrike(true);
                deps.Log("[[icon:runner]] <b>战斗规则</b>：破隐一击——从潜行中发动的攻击伤害翻倍", "ok");
                ctx.Did = true;
                return null;
            });
        Add("release.curseLayers", "每有 1 层诅咒释放一次「杀」（流光照影）", false,
            ctx => ReReleasePerCurse.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var layers = 0;
                if (ctx.CurseTarget?.Status is not null)
                    layers = CombatModel.Curses.Where(k => CombatModel.CurseMeta[k].Stack)
                        .Sum(k => ctx.CurseTarget.Status.GetValueOrDefault(k));
                var released = 0;
                for (var i = 0; i < layers && i < 10; i++) released += deps.ReleaseHandMatches("杀", 0, 0);
                deps.Log($"[[icon:recycle]] <b>流光照影</b>：目标身负 {layers} 层诅咒，释放了 {released} 次「初始攻击」", "sys");
                ctx.Did = true;
                return null;
            });
        Add("release.lastCardTrigger", "「若本牌为最后一张手牌触发 N 次」识别（出牌结算判定）", false,
            ctx => ReLastCardTrigger.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                deps.Log("[[icon:cards]] 最后一张手牌条件：手牌已空时整卡效果触发 2 次（出牌结算判定）", "sys");
                ctx.Did = true;
                return null;
            });
        Add("release.handMatches", "直接释放手牌中的所有「箭/杀/火球」（连弩）", false, ctx => ReReleaseHandAll.Match(ctx.Desc),
            (ctx, m) =>
            {
                var match = (Match)m!;
                var drawEachM = ReDrawEachPerRelease.Match(ctx.Desc);
                var relKey = match.Groups[1].Value == "初始攻击" ? "杀" : match.Groups[1].Value;
                var released = deps.ReleaseHandMatches(relKey, drawEachM.Success ? int.Parse(drawEachM.Groups[1].Value) : 0, 0);
                if (released > 0)
                {
                    deps.Log($"[[icon:swords]] <b>连弩</b>：释放了手牌中 {released} 张「{match.Groups[1].Value}」", "ok");
                    ctx.Did = true;
                }
                return null;
            });

        // ============ 2026-09-09 机制审计补实装 ============
        Add("draw.untilN", "抽牌直到有 N 张手牌（法力补给）", false, ctx => ReDrawUntil.Match(ctx.Desc),
            (ctx, m) =>
            {
                var want = int.Parse(((Match)m!).Groups[1].Value);
                var gotN = 0;
                if (deps.GetMode() == "boss")
                {
                    var guard = 0;
                    while (deps.GetHandSize() < want && guard++ < 30)
                    {
                        var g = deps.DrawCards(1);
                        if (g == 0) break;
                        gotN += g;
                    }
                    deps.Log($"[[icon:cards]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：抽了 {gotN} 张牌（手牌 {deps.GetHandSize()} 张）", "sys");
                }
                else
                {
                    var lack = Math.Max(0, want - deps.GetHandSize());
                    deps.GrantStarterAttack(lack);
                    deps.Log($"[[icon:cards]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：获得 {lack} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）", "sys");
                }
                ctx.Did = true;
                return null;
            });
        Add("dmg.seizeAtk", "夺取敌人攻击力（禁咒I）", false, ctx => ReSeizeAtk.Match(ctx.Desc),
            (ctx, m) =>
            {
                var t = ctx.CurseTarget;
                if (t is { Dead: false })
                {
                    var n = int.Parse(((Match)m!).Groups[1].Value);
                    t.Atk = Math.Max(0, t.Atk - n);
                    CombatModel.AddBlessing(ctx.Pstat, "atkUp", n);
                    deps.Log($"[[icon:arrow]] <b>夺取攻击</b>：{Esc(deps, t.Name)} 攻击力 -{n}，你的攻击力 +{n}", "sys");
                    ctx.Did = true;
                }
                return null;
            });
        Add("dmg.priceAoe", "对全体造成等同于抽到卡牌价格的固定伤害（气功波）", true, ctx => RePriceAoe.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                var price = deps.GetPriceOfLastDrawn();
                if (price > 0)
                {
                    deps.DealAoeFixed(price);
                    deps.Log($"[[icon:play]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：对全体敌人造成 <b>{price}</b> 点固定伤害（按抽到卡牌的价格）", "sys");
                }
                else deps.Log("[[icon:question]] 没有抽到可折算价格的卡牌（占位）", "dim");
                ctx.Did = true;
                return null;
            });
        Add("dmg.growth", "回合开始时本牌伤害 +N（充能火球）", false, ctx => ReGrowth.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                deps.RegisterGrowthCard(ctx.Card);
                deps.Log($"[[icon:fire]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：每经过 1 回合，本牌伤害 +1", "sys");
                ctx.Did = true;
                return null;
            });
        Add("deck.replaceSha", "对战开始时将 N 张杀替换为随机卡牌（迷之匣）", true, ctx => ReReplaceSha.Match(ctx.Desc),
            (ctx, m) =>
            {
                var n = deps.ReplaceShaInDeck(int.Parse(((Match)m!).Groups[1].Value));
                deps.Log($"[[icon:recycle]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：已将牌库中 {n} 张「杀」替换为随机卡牌", "sys");
                ctx.Did = true;
                return null;
            });
        Add("deck.capUp", "牌库上限 +N（BOSS 编组时生效，仅识别）", true, ctx => ReDeckCapUp.Match(ctx.Desc),
            (ctx, m) =>
            {
                deps.Log($"[[icon:cards]] 牌库上限 +{((Match)m!).Groups[1].Value}（BOSS 编组时生效）", "sys");
                ctx.Did = true;
                return null;
            });
        Add("summon.ally", "召唤随从「名（X-Y）×N」（征召）", true, ctx => ReSummonAlly.Match(ctx.Desc),
            (ctx, m) =>
            {
                var match = (Match)m!;
                var n = match.Groups[4].Success ? int.Parse(match.Groups[4].Value) : 1;
                deps.SummonAlly(match.Groups[1].Value, int.Parse(match.Groups[2].Value), int.Parse(match.Groups[3].Value), n);
                deps.Log($"[[icon:runner]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：召唤 {Esc(deps, match.Groups[1].Value)}（{match.Groups[2].Value}-{match.Groups[3].Value}）×{n} ——优先替你承受伤害并自动战斗", "loot");
                ctx.Did = true;
                return null;
            });
        Add("turn.extra", "获得 1 个额外回合（命运钟表）", true, ctx => ReExtraTurn.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                deps.SetExtraTurn(true);
                deps.Log($"[[icon:hourglass]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：获得 1 个额外回合（敌人不会行动）", "ok");
                ctx.Did = true;
                return null;
            });
        Add("hand.pouchCast", "法师锦囊容器：选 1 张直接施放（Q5）", false,
            ctx => RePouchCast.IsMatch(ctx.Desc) && ctx.Flags.Uid is not null ? true : null,
            (ctx, _) => { deps.QueuePouchCast(ctx.Flags.Uid!); ctx.Did = true; return null; });
        Add("hand.pouchPassive", "珍珠盒：持有即扩容背包（仅识别）", false, ctx => RePouchPassive.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                deps.Log("[[icon:plate]] <b>珍珠盒</b>：持有即扩容背包 9 格（扩格仅收资源卡），无需打出", "sys");
                ctx.Did = true;
                return null;
            });
        Add("hand.zeroCostSelect", "自然法杖：选 1 张卡下回合变 0 费（Q5）", false, ctx => ReZeroCostSelect.IsMatch(ctx.Desc) ? true : null,
            (ctx, _) =>
            {
                deps.QueueHandSelect(new HandSelectJob { N = 1, Type = null, Act = "zero" });
                deps.Log($"[[icon:bolt]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：选择 1 张卡牌，下回合它将变为 0 费", "sys");
                ctx.Did = true;
                return null;
            });
        Add("discover.form", "发现一种形态并释放（千变万化）", false, ctx => ReDiscoverForm.Match(ctx.Desc),
            (ctx, m) =>
            {
                deps.QueueDiscover(new DiscoverJob { N = 1, Pred = TextClauses.ParsePoolNoun(((Match)m!).Groups[1].Value, ctx.MyClass), Act = "play" });
                deps.Log($"[[icon:question]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：发现一种【形态】并直接施放", "sys");
                ctx.Did = true;
                return null;
            });
        Add("release.oneSha", "立即释放一次「杀」（百炼青虹剑，消耗该牌时触发）", false,
            ctx => !ReThisCardTime.IsMatch(ctx.Desc) ? ReReleaseOneSha.Match(ctx.Desc) : null,
            (ctx, _) =>
            {
                var released = deps.ReleaseHandMatches("杀", 0, 1);
                deps.Log(released > 0
                    ? $"[[icon:swords]] <b>{Esc(deps, EffectStepsFactory.CardName(ctx.Card))}</b>：立即释放了 1 次「初始攻击」"
                    : "[[icon:cross]] 手牌中没有「杀」可释放", released > 0 ? "ok" : "dim");
                ctx.Did = true;
                return null;
            });

        // ============ 外部层实装识别 + 能量 ============
        Add("elsewhere.recognized", "识别补丁：出牌结算段/规则层/背包实装的句式", false,
            ctx => EffectVerbs.MatchElsewhere(ctx.Desc, ctx.Flags.StructuredHit, ctx.InfLead is not null).Count > 0 ? true : null,
            (ctx, _) => { ctx.Did = true; return null; });
        Add("res.energy", "获得/回复 N 点能量", true,
            ctx => !ReThisCardTime.IsMatch(ctx.Desc) ? ReEnergy.Match(ctx.Desc) : null,
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                var current = deps.AddEnergy(n);
                deps.Log($"[[icon:bolt]] 获得 {n} 点能量（当前 {current}）", "sys");
                ctx.Did = true;
                return null;
            });
        Add("res.energyCap", "能量上限 +N", true, ctx => ReEnergyCap.Match(ctx.Desc),
            (ctx, m) =>
            {
                var n = int.Parse(((Match)m!).Groups[1].Value);
                var currentMax = deps.AddEnergyCap(n);
                deps.Log($"[[icon:bolt]] 本场战斗能量上限 +{n}（每回合 {currentMax} 费）", "sys");
                ctx.Did = true;
                return null;
            });

        return steps;
    }

    private static Match OrMatch(Match first, Match fallback) => first.Success ? first : fallback;

    /// <summary>curse.bleed 的回退语义：主匹配失败但「附加流血|施加流血」在场时 when 返回 true。</summary>
    private static object? MatchOrBool(Match primary, bool fallbackTrue)
    {
        if (primary.Success) return primary;
        return fallbackTrue ? true : null;
    }

    private static bool ReImmobilizeWord(EffectCtx ctx)
        => Regex.IsMatch(ctx.Desc, "无法行动") && Regex.IsMatch(ctx.Desc, "下回合|下个回合|本回合");

    private sealed record SelMatch(string Kind, Match? Match);

    private sealed record DrawMatch(Match Dm, Match PerCurseDraw);

    private sealed record InsertMatch(Match ShR, Match ShN);

    /// <summary>创建文本效果执行器（与网页版 createEffectPipeline 同签名）。哨兵在自然走完时评估。</summary>
    public static Func<CardRecord, string, BattleUnit?, EffectFlags?, ClauseResult> CreatePipeline(EffectPorts deps, IReadOnlyList<EffectStep>? steps = null)
    {
        var stepList = steps ?? CreateSteps(deps);
        return (card, text, target, flags) =>
        {
            var source = text ?? "";
            var ctx = new EffectCtx
            {
                Card = card,
                Target = target,
                Flags = flags ?? new EffectFlags(),
                Desc = source,
                SourceText = source,
                Pstat = deps.GetPlayerStatus(),
                Pdef = deps.GetPlayerDefense(),
                MyClass = deps.GetPlayerClass(),
                DurOv = ReDuration.Match(source) is { Success: true } dm ? dm.Groups[1].Value : null,
                CurseTarget = target is { Dead: false } ? target : deps.GetAlive().FirstOrDefault(),
            };
            foreach (var step in stepList)
            {
                if (!step.Always && ctx.Did) continue;
                var m = step.When(ctx);
                if (!StepUtil.Truthy(m)) continue;
                var outcome = step.Run(ctx, m);
                if (outcome is { IsHalt: true }) return outcome.Result!;
            }
            var result = new ClauseResult(ctx.Did, ctx.Drawn, ctx.Healed, ctx.Armored);
            // —— 未识别子句哨兵：牌面像有效果、却既没结算也没被任何层认领 ——
            if (!ctx.Did && !ctx.Drawn && !ctx.Healed && !ctx.Armored)
            {
                var recognized = EffectVerbs.IsRecognized(ctx.Desc, ctx.Flags.StructuredHit, ctx.InfLead is not null);
                if (!recognized || !EffectVerbs.StrictMode)
                    EffectVerbs.NoteUnknownEffect(card.Id, card.Name, ctx.Desc);
            }
            return result;
        };
    }
}
