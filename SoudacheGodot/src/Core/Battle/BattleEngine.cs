using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Soudache.Battle;

// ported from 搜打撤/game/src/battle.core.js —— 战斗逻辑会话（v0.53.3 语义，同步化移植）。
// 网页版的异步动作队列（setTimeout/animation pacing）在这里退化为同步执行：命令进入即
// 结算完毕，可观测终态与网页 drain() 之后的快照一致。RNG 用注入的 DeterministicRng
// （口径 §0.1：不逐位复刻网页，只需 Godot 内部确定性）。
// 状态机：Start→（BOSS 先编组）→PlayerTurn→(EndTurn)→EnemyTurn→PlayerTurn→…→Victory/Defeat。

public interface IBattleGame
{
    IList<OwnedCard> OwnedCards { get; }
    int Hp { get; set; }
    int MaxHp { get; set; }
    int Atk { get; set; }
    int SpellPower { get; set; }
    int Coins { get; set; }
    string? MyClass { get; }
    void Log(string message, string kind);
    void Heal(int amount);
    void AddItem(string itemKey, int amount);
    void OnBattleEnd(BattleEndInfo info);
}

public sealed class BattleOptions
{
    public bool IsBoss { get; init; }
    public int Layer { get; init; }
    public string? ReturnTo { get; init; }
    public string Name { get; init; } = "";
    public string? Risk { get; init; }
}

public sealed class FoeDef
{
    public string? Id { get; init; }
    public string Name { get; init; } = "";
    public int Hp { get; init; }
    public int Atk { get; init; } = 2;
    public string? Affix { get; init; }
    public string? AffixName { get; init; }
    public string? Behavior { get; init; }
}

/// <summary>战斗数值规则（rules.json battle 段；默认值=data/rules.json 的 2/8/15/5/5/1，测试可用审计口径覆盖）。</summary>
public sealed record BattleRulesTable
{
    public int BattleEnergy { get; init; } = 2;
    public int BattleHandMax { get; init; } = 8;
    public int BossDeckSize { get; init; } = 15;
    public int StarterSha { get; init; } = 5;
    public int BattleStartDraw { get; init; } = 5;
    public int BattleTurnDraw { get; init; } = 1;
}

public sealed class BattleEndInfo
{
    public bool IsBoss;
    public int Layer;
    public string Name = "";
    public string? ReturnTo;
    public string[] FoeNames = Array.Empty<string>();
    public string[] Played = Array.Empty<string>();
    /// <summary>true=胜利 / false=战败（含主动撤离）/ null=烟雾弹式逃跑（不计胜负）。</summary>
    public bool? Win;
    public string[] Consumed = Array.Empty<string>();
}

public enum BattlePhase { Start, Player, Targeting, Resolving, Enemy, Victory, Defeat }

public sealed class BattleEngine
{
    private const string KillCheerChars = "👍✨";
    private static readonly string[] KillCheer = { "👍", "✌️", "✨" };
    private static readonly string[] CurseKeys = CombatModel.Curses;

    private readonly IBattleGame _game;
    private readonly CardLib _cards;
    private readonly BattleRulesTable _rules;
    private readonly DeterministicRng _rng;
    private readonly Func<CardRecord, string, BattleUnit?, EffectFlags?, ClauseResult> _applyTextEffects;

    private List<BattleUnit> _foes = new();
    private BattleOptions _opts = new();
    private string _mode = "normal";
    private List<string> _drawPile = new(), _hand = new(), _discard = new(), _grantedUids = new(), _played = new(), _consumed = new(), _grave = new();
    private List<OwnedCard> _granted = new();
    private int _energy, _maxEnergy, _turn = 1;
    private BattleDefense _pdef = new();
    private BattleUnit _pstat = new("player", "你", 1, false);
    private bool _busy;
    private BattlePhase _phase = BattlePhase.Start;

    // 面板与队列
    private InfuseState? _infusing;
    private DiscoverState? _discovering;
    private readonly List<DiscoverJob> _discoverQueue = new();
    private HandSelectState? _handSelecting;
    private readonly List<HandSelectJob> _handSelectQueue = new();
    private ChoiceState? _choosing;
    private readonly List<ChoiceJob> _choiceQueue = new();
    private PendingTargetState? _pendingTarget;

    // 战斗规则变量
    private readonly List<DelayedItem> _delayed = new();
    private bool _noDrawNext;
    private bool _spellCost1, _meleeCost1;
    private string? _shaTransform;
    private int _consumeFireballN;
    private readonly List<string> _lastDrawnUids = new();
    private string? _lastPlayedType;
    private bool _stealthStrike;
    private int _nextSpellTwice;
    private int _playedMartialThisTurn, _playedMovesThisTurn;

    // BOSS 编组 + 开战装备
    private List<OwnedCard> _selPool = new(), _selEquipPool = new();
    private int _selShaN, _selDeckMax;
    private readonly HashSet<string> _sel = new(StringComparer.Ordinal);
    private readonly HashSet<string> _selEquips = new(StringComparer.Ordinal);
    private readonly List<string> _lastDeckSel = new(), _lastEquipSel = new();
    private bool _selectingDeck;

    // 2026-09-09 机制审计批次状态
    private readonly List<BattleUnit> _allies = new();
    private readonly HashSet<string> _growthNames = new(StringComparer.Ordinal);
    private readonly Dictionary<string, int> _growth = new(StringComparer.Ordinal);
    private int _infuseFuels;
    private bool _sealUnlocked;
    private bool _extraTurn;
    private int _deathSave;
    private int _killAtkUp;
    private bool _poisonOnSpell;
    private readonly Dictionary<string, int> _zeroFeeUntil = new(StringComparer.Ordinal);
    private readonly Dictionary<string, CardRecord> _cardOverrides = new(StringComparer.Ordinal);
    private PendingItemState? _pendingItem;
    private readonly List<OwnedCard> _equipped = new();
    private readonly HashSet<string> _freeCast = new(StringComparer.Ordinal);
    private bool _slamPending;
    private int _uidCounter;

    private readonly List<FloatEvent> _floats = new();
    private readonly List<string> _sfx = new();
    private bool _viewingGrave;

    public BattleEngine(IBattleGame game, IReadOnlyList<FoeDef> foeDefs, BattleOptions options, CardLib cards,
        BattleRulesTable? rules = null, DeterministicRng? rng = null)
    {
        _game = game;
        _cards = cards;
        _rules = rules ?? new BattleRulesTable();
        _rng = rng ?? new DeterministicRng(0xBA771E7EUL);
        _applyTextEffects = EffectStepsFactory.CreatePipeline(BuildPorts());
        Start(foeDefs, options);
    }

    // ---------- 入口 ----------
    private void Start(IReadOnlyList<FoeDef> foeDefs, BattleOptions options)
    {
        _opts = options;
        _mode = options.IsBoss ? "boss" : "normal";
        var defs = foeDefs.ToList();
        _foes = defs.Select(d =>
        {
            var f = new BattleUnit(d.Id, d.Name, d.Hp, true)
            {
                Atk = d.Atk,
                Affix = d.Affix,
                AffixName = d.AffixName,
                Behavior = d.Behavior,
            };
            f.Intent = IntentFor(f, 1);
            CombatModel.EnsureStatus(f);
            return f;
        }).ToList();
        Log($"[[icon:swords]] <b>{(_opts.IsBoss ? "BOSS战" : "遭遇战")}【{string.Join("、", _foes.Select(f => $"{f.Name}({f.Atk}-{f.Hp})"))}】</b>{(!_opts.IsBoss && _opts.Risk is not null ? $" · 风险<b>{_opts.Risk}</b>" : "")}", "warn");
        if (_mode == "boss") PrepareDeckSelection();
        else BeginNormal();
    }

    private BattleUnit? FirstAlive() => _foes.FirstOrDefault(f => !f.Dead);
    private List<BattleUnit> Alive() => _foes.Where(f => !f.Dead).ToList();
    private bool IsBattleStartEquip(CardRecord card) => card is { Type: "装备" } && Regex.IsMatch(card.Desc ?? "", "对战开始时");

    private void BeginNormal()
    {
        _drawPile = new List<string>(); _discard = new List<string>(); _granted = new List<OwnedCard>();
        _played = new List<string>(); _consumed = new List<string>(); _grave = new List<string>();
        _hand = _game.OwnedCards
            .Where(o => !new[] { "道具", "资源", "事件", "生物" }.Contains(o.Card.Type) && !IsBattleStartEquip(o.Card))
            .Select(o => o.Uid).ToList();
        _maxEnergy = _rules.BattleEnergy;
        _energy = _maxEnergy;
        _turn = 1;
        _busy = false;
        _pdef = new BattleDefense();
        _pstat = new BattleUnit("player", "你", _game.Hp, false);
        CombatModel.EnsureStatus(_pstat);
        _infusing = null; _discovering = null; _discoverQueue.Clear(); _handSelecting = null; _handSelectQueue.Clear(); _pendingTarget = null;
        _floats.Clear();
        _choosing = null; _choiceQueue.Clear(); _stealthStrike = false; _nextSpellTwice = 0;
        _delayed.Clear(); _noDrawNext = false; _spellCost1 = false; _meleeCost1 = false;
        _shaTransform = null; _consumeFireballN = 0; _lastDrawnUids.Clear(); _lastPlayedType = null;
        ResetBattleExtras();
        _phase = BattlePhase.Player;
        ApplyBattleStartPassives();
        if (Alive().Count > 1) Log("[[icon:question]] 以一敌多：伤害与群体卡都<b>拖到任意敌人身上</b>打出（群体自动命中全体）", "sys");
        Log($"[[icon:cards]] 普通战斗无需抽牌：随身 <b>{_hand.Count}</b> 张战斗卡直接可打出（道具/资源/事件卡不在手牌中） · 每回合固定 <b>{_maxEnergy}</b> 费", "sys");
    }

    private void ResetBattleExtras()
    {
        _allies.Clear(); _growthNames.Clear(); _growth.Clear();
        _infuseFuels = 0; _sealUnlocked = false; _extraTurn = false; _deathSave = 0;
        _killAtkUp = 0; _poisonOnSpell = false; _zeroFeeUntil.Clear(); _cardOverrides.Clear();
        _pendingItem = null;
        _freeCast.Clear();
        _slamPending = false;
        _equipped.Clear();
        _playedMartialThisTurn = 0;
        _playedMovesThisTurn = 0;
    }

    // ---------- 牌堆与抽牌 ----------
    private void Shuffle(List<string> pile)
    {
        for (var i = pile.Count - 1; i > 0; i--)
        {
            var j = _rng.NextInt(i + 1);
            (pile[i], pile[j]) = (pile[j], pile[i]);
        }
    }

    private OwnedCard? FindCard(string uid)
    {
        if (_cardOverrides.TryGetValue(uid, out var ov)) return new OwnedCard { Uid = uid, Card = ov };
        return _game.OwnedCards.FirstOrDefault(o => o.Uid == uid) ?? _granted.FirstOrDefault(o => o.Uid == uid);
    }

    private int _drawRecursionDepth;

    private int DrawCards(int n)
    {
        // 「抽到时额外抽 N 张牌」（天启剑）会经 onDraw 再入 DrawCards；
        // 网页版靠 JS 调用栈天然截断，这里用显式深度护栏保证不栈溢出（口径：不崩优先）。
        if (_drawRecursionDepth >= 16)
        {
            Log("[[icon:cards]] 抽到时触发链过深，本段抽牌截断", "warn");
            return 0;
        }
        _drawRecursionDepth++;
        try
        {
            return DrawCardsInner(n);
        }
        finally
        {
            _drawRecursionDepth--;
        }
    }

    private int DrawCardsInner(int n)
    {
        var got = 0;
        _lastDrawnUids.Clear();
        while (n-- > 0)
        {
            if (_drawPile.Count == 0 && _discard.Count > 0)
            {
                var recycled = _discard.Count;
                Shuffle(_discard);
                _drawPile.AddRange(_discard);
                _discard.Clear();
                Log($"[[icon:recycle]] 弃牌堆 {recycled} 张洗回牌库（墓地不参与洗回）", "dim");
            }
            if (_drawPile.Count == 0) break;
            if (_hand.Count >= _rules.BattleHandMax) break;
            var uid = _drawPile[^1];
            _drawPile.RemoveAt(_drawPile.Count - 1);
            var entry = FindCard(uid);
            var parts = entry is not null ? TextClauses.SplitEffectClauses(entry.Card.Desc) : null;
            // 「抽到时施放」衍生牌（禁咒/天启剑系）：抽到即结算，不占手牌
            if (parts is { OnDraw.Count: > 0 } && entry is not null)
            {
                _discard.Add(uid);
                foreach (var text in parts.OnDraw)
                {
                    Log($"[[icon:flask]] <b>抽到时施放</b>：【{entry.Card.Name}】{text}", "sys");
                    _applyTextEffects(entry.Card, text, FirstAlive(), null);
                }
                got++;
                SweepDead();
                if (Alive().Count == 0) break;
                continue;
            }
            _hand.Add(uid);
            _lastDrawnUids.Add(uid);
            got++;
        }
        return got;
    }

    private void SweepDead()
    {
        foreach (var f in _foes)
        {
            if (f.Dead || f.Hp > 0) continue;
            f.Dead = true;
            Log($"[[icon:skull]] <b>{f.Name}</b> 被击倒！（剩 {Alive().Count} 个敌人）", "ok");
            _floats.Add(new FloatEvent { Unit = _foes.IndexOf(f).ToString(), Text = "💥", Cls = "stk" });
            _floats.Add(new FloatEvent { Unit = "self", Text = KillCheer[_rng.NextInt(KillCheer.Length)], Cls = "stk stk-late" });
        }
    }

    private string NextTempUid(string prefix) => $"{prefix}{checked(++_uidCounter):D6}";

    private string AddTempCard(CardRecord tpl)
    {
        var uid = NextTempUid("bts");
        var copy = tpl.Clone();
        _granted.Add(new OwnedCard { Uid = uid, Card = copy });
        _hand.Add(uid);
        _lastDrawnUids.Add(uid);
        return uid;
    }

    private void AddDeckCard(CardRecord tpl)
    {
        var uid = NextTempUid("btd");
        _granted.Add(new OwnedCard { Uid = uid, Card = tpl.Clone() });
        _drawPile.Add(uid);
    }

    private void GrantSha(int n)
    {
        // 「杀化为X」战斗规则生效时，发放的初始攻击同样以目标卡形态出现
        var baseCard = (_shaTransform is not null ? _cards.ByName(_shaTransform) : null) ?? _cards.Sha;
        for (var i = 0; i < n; i++) AddTempCard(baseCard);
    }

    private void DeckDraw(DeckDrawJob job)
    {
        var moved = 0;
        if (_mode == "boss")
        {
            var rest = new List<string>();
            while (_drawPile.Count > 0 && moved < job.N)
            {
                var uid = _drawPile[^1];
                _drawPile.RemoveAt(_drawPile.Count - 1);
                var o = FindCard(uid);
                if (o is not null && o.Card.Type == job.Type && _hand.Count < _rules.BattleHandMax)
                {
                    _hand.Add(uid);
                    moved++;
                    _lastDrawnUids.Add(uid);
                }
                else rest.Add(uid);
            }
            _drawPile.AddRange(rest);
        }
        while (moved < job.N)
        {
            var pool = _cards.All.Where(c => c.Type == job.Type && c.Rarity != "衍生" && c.Type is not ("生物" or "事件")).ToList();
            if (pool.Count == 0) break;
            AddTempCard(pool[_rng.NextInt(pool.Count)]);
            moved++;
        }
        if (moved > 0)
            Log($"[[icon:cards]] {(_mode == "boss" ? "从牌库" : "（普通战斗无牌库，改为直接获得）")}抽取 {moved} 张【{job.Type}】牌", "sys");
    }

    private int ReleaseHandMatches(string key, int drawEach, int max)
    {
        var re = key == "杀" ? new Regex("^(杀|初始攻击)$", RegexOptions.Compiled) : new Regex(key, RegexOptions.Compiled);
        var released = 0;
        foreach (var uid in _hand.ToList())
        {
            if (Alive().Count == 0) break;
            if (max > 0 && released >= max) break;
            var o = FindCard(uid);
            if (o is null || o.Card.Type == "生物" || !re.IsMatch(o.Card.Name ?? "")) continue;
            QueueCardExecution(uid, o.Card, new List<string>(), FirstAlive(), isFree: true);
            released++;
            if (drawEach > 0) DrawCards(drawEach);
        }
        return released;
    }

    private int AutoPlayHandType(string type)
    {
        var played = 0;
        foreach (var uid in _lastDrawnUids.ToList())
        {
            if (Alive().Count == 0) break;
            if (!_hand.Contains(uid)) continue;
            var o = FindCard(uid);
            if (o is null || o.Card.Type != type) continue;
            QueueCardExecution(uid, o.Card, new List<string>(), FirstAlive(), isFree: true);
            played++;
        }
        return played;
    }

    // ---------- 生效时刻 / 持续时间 / 生效条件 ----------
    private void RegisterTurnStart(CardRecord card, IReadOnlyList<TurnStartClause> items)
    {
        var descDur = Regex.Match(card.Desc ?? "", @"持续\s*(\d+)\s*回合") is { Success: true } dm ? int.Parse(dm.Groups[1].Value) : 0;
        var formLike = card.Type == "能力卡" || Regex.IsMatch(card.Name ?? "", "形态");
        foreach (var it in items)
        {
            var dur = Regex.Match(it.Text, @"持续\s*(\d+)\s*回合") is { Success: true } tm ? int.Parse(tm.Groups[1].Value) : descDur;
            var repeat = card.Type == "装备" || it.Each || formLike;
            int? left = null;
            if (!repeat && dur > 0) { repeat = true; left = dur; }
            _delayed.Add(new DelayedItem { Text = it.Text, CardName = card.Name ?? "", Repeat = repeat, Left = left });
            Log($"[[icon:hourglass]] <b>回合开始时</b>：【{card.Name}】{it.Text}（下个回合开始{(repeat ? (left is not null ? $"起共 {left} 次" : "起每回合") : "")}生效）", "sys");
        }
    }

    private void ProcessDelayed()
    {
        if (_delayed.Count == 0) return;
        var silenced = (_pstat.Status?.GetValueOrDefault("silence") ?? 0) > 0;
        var keep = new List<DelayedItem>();
        foreach (var q in _delayed)
        {
            if (q.NotBeforeTurn is not null && _turn < q.NotBeforeTurn) { keep.Add(q); continue; }
            if (q.Special == "consumeTemps")
            {
                ConsumeHandUids(q.Uids ?? new List<string>(), q.CardName);
                continue;
            }
            if (silenced)
            {
                Log($"[[icon:cross]] 沉默中：【{q.CardName}】的回合开始效果无法生效", "warn");
            }
            else
            {
                Log($"[[icon:hourglass]] <b>回合开始时</b>：【{q.CardName}】{q.Text}", "sys");
                _applyTextEffects(new CardRecord { Name = q.CardName }, q.Text, FirstAlive(), null);
            }
            if (q.Repeat)
            {
                if (q.Left is not null) { q.Left -= 1; if (q.Left > 0) keep.Add(q); }
                else keep.Add(q);
            }
        }
        _delayed.Clear();
        _delayed.AddRange(keep);
    }

    private void AccrueGrowth()
    {
        if (_growthNames.Count == 0) return;
        foreach (var uid in _hand.Concat(_drawPile).Concat(_discard).Concat(_grave))
        {
            var o = FindCard(uid);
            if (o is not null && _growthNames.Contains(o.Card.Name))
                _growth[uid] = _growth.GetValueOrDefault(uid) + 1;
        }
    }

    private bool RegisterBattle(CardRecord card, string clause, BattleUnit? target)
    {
        Log($"[[icon:question]] <b>本局对战内</b>：{clause}（整场战斗有效，离开战斗失效）", "ok");
        var inner = Regex.Replace(clause, @"^(本局对战内|本场对战|本场战斗)[中内]?[：:，,]?\s*", "");
        if (Regex.IsMatch(inner, @"所有(?:法术|招式)[^。]*?1\s*费"))
        {
            if (Regex.IsMatch(inner, "所有招式"))
            {
                _meleeCost1 = true;
                Log("[[icon:sparkles]] 持续规则：你的所有招式（武术）均按 <b>1</b> 费打出", "ok");
            }
            else
            {
                _spellCost1 = true;
                Log("[[icon:sparkles]] 持续规则：你的所有法术均按 <b>1</b> 费打出", "ok");
            }
        }
        return _applyTextEffects(card, inner, target, null).Did;
    }

    /// <summary>「被注能时」条件效果：作为注能牺牲品被消耗时触发。</summary>
    private bool ResolveInfusedFuel(CardRecord card, BattleUnit? target)
    {
        var parts = TextClauses.SplitEffectClauses(card.Desc);
        if (parts.OnInfused.Count == 0) return false;
        if ((_pstat.Status?.GetValueOrDefault("silence") ?? 0) > 0)
        {
            Log($"[[icon:cross]] 沉默中：【{card.Name}】的被注能效果无法生效", "warn");
            return true;
        }
        foreach (var text in parts.OnInfused)
        {
            Log($"[[icon:flask]] <b>被注能时</b>：【{card.Name}】{text}", "sys");
            _applyTextEffects(card, text, target, null);
        }
        return true;
    }

    private void FireConsumeTriggers(CardRecord card, BattleUnit? target)
    {
        foreach (var text in TextClauses.ConsumeTriggerTexts(card.Desc))
        {
            Log($"[[icon:flask]] <b>消耗该牌时</b>：【{card.Name}】{text}", "sys");
            _applyTextEffects(card, text, target ?? FirstAlive(), new EffectFlags());
        }
    }

    private void TryUnlockSeal(string name)
    {
        if (_sealUnlocked) { Log($"[[icon:crystal]] 【{name}】已处于解锁状态（跳过重复结算）", "dim"); return; }
        _sealUnlocked = true;
        CombatModel.AddBlessing(_pstat, "spellUp", 2);
        if (_mode == "boss") DrawCards(2);
        else GrantSha(2);
        Log($"[[icon:crystal]] <b>元素符印解锁</b>：法伤 +2{(_mode == "boss" ? "，抽了 2 张牌" : "，获得 2 张【初始攻击】")}", "ok");
    }

    // ---------- 出牌结算 ----------
    private void ResolveCard(CardRecord card, BattleUnit? target, bool infused, int fuelCost, string? uid)
    {
        var desc = card.Desc ?? "";
        var parts = TextClauses.SplitEffectClauses(desc);
        var skillOnly = parts.Skill.Count > 0 && parts.Immediate.Count == 0 && parts.TurnStart.Count == 0 &&
                        parts.Battle.Count == 0 && parts.OnInfused.Count == 0 && parts.OnDraw.Count == 0;
        var did = false;
        var isDmgType = CardLib.DmgTypes.Contains(card.Type);
        var structuredHit = false;
        // —— 伤害（卡面伤害词条立即结算，不受沉默影响） ——
        if (isDmgType && (card.Dmg != 0 || card.DmgType == "attack"))
        {
            structuredHit = true;
            var type = card.DmgType switch
            {
                "attack" => BattleDamageKind.Attack,
                "spell" => BattleDamageKind.Spell,
                "true" => BattleDamageKind.True,
                _ => BattleDamageKind.Fixed,
            };
            var dmgVal = card.Dmg + (uid is not null ? _growth.GetValueOrDefault(uid) : 0);
            if (uid is not null && _growth.GetValueOrDefault(uid) > 0)
                Log($"[[icon:fire]] <b>{card.Name}</b>：回合成长 +{_growth[uid]}（基础 {card.Dmg}）", "sys");
            var tm = Regex.Match(desc, @"(?:攻击|命中)\s*(\d+)\s*次");
            if (!tm.Success) tm = Regex.Match(desc, @"(\d+)\s*段");
            var times = tm.Success ? Math.Max(1, int.Parse(tm.Groups[1].Value)) : 1;
            if (!tm.Success)
            {
                var tg = Regex.Match(desc, @"触发\s*(\d+)\s*次");
                if (tg.Success && !Regex.IsMatch(desc, @"注能\s*[（(][^）)]*[）)][^。]*?触发")) times = Math.Max(1, int.Parse(tg.Groups[1].Value));
            }
            if (Regex.IsMatch(desc, "本回合每打出一张其他招式"))
            {
                times = _playedMovesThisTurn;
                Log(times > 0
                    ? $"[[icon:swords]] <b>{card.Name}</b>：本回合已打出 {times} 张招式，固定伤害触发 {times} 次"
                    : $"[[icon:cross]] <b>{card.Name}</b>：本回合还没有打出其他招式，不造成伤害", times > 0 ? "sys" : "dim");
            }
            var graveM = Regex.Match(desc, @"墓地中每有\s*1\s*张(武术|法术|装备|道具|资源)牌[^。；]*?伤害\s*\+\s*(\d+)");
            if (graveM.Success && _mode == "boss")
            {
                var cnt = _grave.Count(u => FindCard(u)?.Card.Type == graveM.Groups[1].Value);
                if (cnt > 0)
                {
                    dmgVal += cnt * int.Parse(graveM.Groups[2].Value);
                    Log($"[[icon:recycle]] 墓地增伤：墓地中有 {cnt} 张【{graveM.Groups[1].Value}】牌，伤害 +{cnt * int.Parse(graveM.Groups[2].Value)}", "sys");
                }
            }
            var hpCap = Regex.Match(desc, @"对\s*(\d+)\s*血以下") is { Success: true } hm ? int.Parse(hm.Groups[1].Value) : 0;
            var halfB = Regex.Match(desc, @"血量一半及以下的敌人伤害增加\s*(\d+)\s*%");
            if (infused)
            {
                var icost = Regex.Match(desc, @"注能\s*[（(][^）)]*[）)][：:]?\s*改为\s*(\d+)\s*′");
                if (icost.Success) dmgVal = int.Parse(icost.Groups[1].Value);
                var ibonus = Regex.Match(desc, @"注能\s*[（(][^）)]*[）)][：:]?[^。]*?伤害\s*\+\s*(\d+)");
                if (ibonus.Success) dmgVal = card.Dmg + int.Parse(ibonus.Groups[1].Value);
                var itg = Regex.Match(desc, @"注能\s*[（(][^）)]*[）)][：:]?[^。]*?触发\s*(\d+)\s*次");
                if (itg.Success) times = Math.Max(1, int.Parse(itg.Groups[1].Value));
            }
            var targets = BattleRules.IsAreaEffect(card) ? Alive() : (target ?? FirstAlive()) is { } t ? new List<BattleUnit> { t } : new List<BattleUnit>();
            if (targets.Count == 0) return;
            var dealtTotal = 0;
            for (var i = 0; i < times; i++)
            {
                foreach (var foe in targets)
                {
                    if (foe.Dead) continue;
                    if (hpCap > 0 && foe.Hp > hpCap)
                    {
                        if (i == 0) Log($"[[icon:cross]] <b>{foe.Name}</b> 血量高于 {hpCap}：{card.Name} 无效", "warn");
                        continue;
                    }
                    var foeDmg = dmgVal;
                    if (halfB.Success && foe.MaxHp > 0 && foe.Hp <= foe.MaxHp / 2)
                    {
                        foeDmg = (int)Math.Floor(foeDmg * (1 + int.Parse(halfB.Groups[1].Value) / 100.0));
                        if (i == 0) Log($"[[icon:arrow]] <b>{foe.Name}</b> 血量过半，伤害增加 {halfB.Groups[1].Value}%（→ {foeDmg}）", "sys");
                    }
                    var pierceB = Regex.Match(desc, @"若对方[^。]*?流血[^。]*?伤害\s*\+\s*(\d+)");
                    if (pierceB.Success && (foe.Status?.GetValueOrDefault("bleed") ?? 0) > 0)
                    {
                        foeDmg += int.Parse(pierceB.Groups[1].Value);
                        if (i == 0) Log($"[[icon:blood]] <b>{foe.Name}</b> 处于流血状态，伤害 +{pierceB.Groups[1].Value}", "sys");
                    }
                    dealtTotal += HitFoe(foe, card, foeDmg, type, times > 1 ? $"（第 {i + 1} 段）" : "");
                }
            }
            // 吸血：回复等量生命
            if (Regex.IsMatch(desc, "回复等量生命") && dealtTotal > 0)
            {
                if (_pstat.Status.GetValueOrDefault("healban") > 0)
                    Log($"[[icon:heart]] 禁疗中：吸血回复无效（还剩 {_pstat.Status.GetValueOrDefault("healban")} 回合）", "warn");
                else
                {
                    _game.Heal(dealtTotal);
                    _floats.Add(new FloatEvent { Unit = "self", Text = "💚", Cls = "stk", Warm = true });
                    Log($"[[icon:heart]] 吸血：回复 {dealtTotal} 点生命", "ok");
                }
            }
            // 条件额外施放（暗影射击）
            var sm = Regex.Match(desc, @"若[^。]*?诅咒[^。]*?额外施放\s*(\d+)\s*次");
            if (sm.Success)
            {
                var t0 = targets.FirstOrDefault(t => !t.Dead);
                if (t0 is not null && CombatModel.HasCurse(t0))
                {
                    for (var k = 0; k < int.Parse(sm.Groups[1].Value); k++)
                        HitFoe(t0, card, dmgVal, type, "（额外施放）");
                    Log($"[[icon:play]] 对手身负诅咒：【{card.Name}】额外施放 {sm.Groups[1].Value} 次", "sys");
                }
            }
            did = true;
        }
        // 沉默：除攻击外的技能效果全部失效
        if (_pstat.Status.GetValueOrDefault("silence") > 0)
        {
            Log($"[[icon:cross]] <b>{card.Name}</b> 的技能效果被沉默封印（只剩攻击生效，持续 {_pstat.Status.GetValueOrDefault("silence")} 回合）", "warn");
            return;
        }
        // 法力奔涌（名称/ID 兜底）
        var surgeM = Regex.Match(desc, @"对随机敌人释放\s*(\d+|四)\s*个随机法术");
        if (surgeM.Success || card.Id == "cc-mana-surge" || Regex.IsMatch(card.Name ?? "", "法力奔涌"))
        {
            CastRandomSpells(surgeM.Success ? (surgeM.Groups[1].Value == "四" ? 4 : Math.Max(1, int.Parse(surgeM.Groups[1].Value))) : 4, card.Id);
            did = true;
        }
        // —— 立即生效句（逐句结算；神灯类编号续句并回抉择主句） ——
        var imm = new List<string>();
        foreach (var cl in parts.Immediate)
        {
            if (Regex.IsMatch(cl, @"^\s*\d\s*[°º]") && imm.Count > 0 && Regex.IsMatch(imm[^1], "抉择[:：]"))
                imm[^1] += "，" + cl;
            else imm.Add(cl);
        }
        var healed = false;
        var armored = false;
        var drawn = false;
        foreach (var cl in imm)
        {
            var res = _applyTextEffects(card, cl, target, new EffectFlags
            {
                StructuredHit = structuredHit,
                Infused = infused,
                FuelCost = fuelCost,
                Uid = uid,
            });
            did = did || res.Did;
            healed = healed || res.Healed;
            armored = armored || res.Armored;
            drawn = drawn || res.Drawn;
        }
        // 结构化词条兜底
        if (!healed && !skillOnly && card.Heal > 0)
        {
            if (_pstat.Status.GetValueOrDefault("healban") > 0)
                Log($"[[icon:heart]] 禁疗中：回复 {card.Heal} 点生命无效（还剩 {_pstat.Status.GetValueOrDefault("healban")} 回合）", "warn");
            else
            {
                _game.Heal(card.Heal);
                _floats.Add(new FloatEvent { Unit = "self", Text = "💚", Cls = "stk", Warm = true });
            }
            did = true;
        }
        if (!armored && !skillOnly && card.Armor > 0)
        {
            _pdef.Armor += card.Armor;
            Log($"[[icon:plate]]获得 {card.Armor} 点护甲", "sys");
            did = true;
        }
        if (!drawn && !skillOnly && DrawOf(card) > 0)
        {
            var n = DrawOf(card);
            if (_mode == "boss")
            {
                var got = DrawCards(n);
                Log($"[[icon:cards]] <b>{card.Name}</b>：抽了 {got} 张牌", "sys");
            }
            else
            {
                GrantSha(n);
                Log($"[[icon:cards]] <b>{card.Name}</b>：获得 {n} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）", "sys");
            }
            did = true;
        }
        if (parts.TurnStart.Count > 0) { RegisterTurnStart(card, parts.TurnStart); did = true; }
        foreach (var cl in parts.Battle) did = RegisterBattle(card, cl, target) || did;
        if (!did && !skillOnly) Log($"[[icon:play]] <b>{card.Name}</b>：该效果在 M1 后续实装（占位）", "dim");
    }

    private void CastRandomSpells(int n, string sourceId)
    {
        var pool = _cards.All.Where(c => c.Type == "法术" && c.Id != sourceId && CardLib.IsRandomObtainable(c)).ToList();
        if (pool.Count == 0)
        {
            Log("[[icon:cross]] <b>法力奔涌</b>：卡牌库中没有可释放的随机法术", "warn");
            return;
        }
        for (var i = 0; i < n; i++)
        {
            SweepDead();
            var targets = Alive();
            if (targets.Count == 0) break;
            var spell = pool[_rng.NextInt(pool.Count)];
            var t = targets[_rng.NextInt(targets.Count)];
            Log($"[[icon:sparkles]] <b>法力奔涌</b>（第 {i + 1}/{n} 发）：对 <b>{t.Name}</b> 释放随机法术【<b>{spell.Name}</b>】（默认已注能）", "loot");
            ResolveCard(spell, t, true, 0, null);
        }
        SweepDead();
    }

    // ---------- 费用 ----------
    private int DrawOf(CardRecord card) => card.Draw > 0 ? card.Draw : CardLib.DeriveDraw(card);

    private int InfuseOf(CardRecord card) => card.NoInfuse ? 0 : (card.Infuse > 0 ? card.Infuse : CardLib.DeriveInfuse(card));

    private int EffCostOf(CardRecord card, string? uid)
    {
        if (uid is not null && _zeroFeeUntil.GetValueOrDefault(uid) >= _turn) return 0;
        if ((_pstat.Status?.GetValueOrDefault("cosmosForm") ?? 0) > 0) return 1;
        if (_spellCost1 && card.Type == "法术") return 1;
        if (_meleeCost1 && card.Type == "武术") return 1;
        var d = card.Desc ?? "";
        if (Regex.IsMatch(d, "上一张牌是武术") && _lastPlayedType == "武术") return 0;
        if (Regex.IsMatch(d, "本回合每打出一张其他武术")) return Math.Max(0, card.Cost - _playedMartialThisTurn);
        if (Regex.IsMatch(d, @"护甲为\s*0[.。，,]?\s*本牌变为\s*0\s*费") && (_pdef.Armor) == 0) return 0;
        return card.Cost;
    }

    // ---------- 诅咒之刃：手牌诅咒收集 ----------
    private static readonly (string Key, Regex Re, int Def)[] CurseScan =
    {
        ("bleed", new Regex(@"(?:附加|施加)\s*(?:(\d+)\s*层?)?\s*流血", RegexOptions.Compiled), 1),
        ("poison", new Regex(@"(?:附加|施加)\s*(?:(\d+)\s*层)?\s*中毒", RegexOptions.Compiled), 1),
        ("burn", new Regex(@"(?:附加|施加|攻击并)\s*(?:\d+\s*层?\s*)?灼烧", RegexOptions.Compiled), 1),
        ("freeze", new Regex(@"附加冰冻|冰冻所有|冰冻\s*(?:\d+|[一两二三四五])?\s*名|冻结", RegexOptions.Compiled), 1),
        ("silence", new Regex("沉默", RegexOptions.Compiled), 1),
        ("abreak", new Regex("破甲", RegexOptions.Compiled), 2),
        ("healban", new Regex("禁疗", RegexOptions.Compiled), 2),
    };

    private static List<(string Key, int N)> CurseSpecsOfDesc(string? desc)
    {
        desc ??= "";
        var result = new List<(string, int)>();
        foreach (var (key, re, def) in CurseScan)
        {
            var m = re.Match(desc);
            if (m.Success)
            {
                var n = m.Groups[1].Success && int.TryParse(m.Groups[1].Value, out var p) ? p : def;
                result.Add((key, Math.Max(1, n)));
            }
        }
        return result;
    }

    private List<(string Key, int N)> HandCurseSpecs()
    {
        var merged = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var u in _hand)
        {
            var c = FindCard(u)?.Card;
            if (c is null || c.Type is not ("武术" or "法术")) continue;
            foreach (var s in CurseSpecsOfDesc(c.Desc))
            {
                var stack = CombatModel.CurseMeta[s.Key].Stack;
                merged[s.Key] = stack ? merged.GetValueOrDefault(s.Key) + s.N : Math.Max(merged.GetValueOrDefault(s.Key), s.N);
            }
        }
        return merged.Select(kv => (kv.Key, kv.Value)).ToList();
    }

    private void QueueSwapCostDiscover()
    {
        var pool = _cards.All.Where(c => c.Type is "武术" or "法术" && CardLib.IsRandomObtainable(c)).ToList();
        if (pool.Count < 2)
        {
            Log("[[icon:cross]] <b>迷之匣</b>：卡牌库中没有足够的随机招式可供发现", "warn");
            return;
        }
        var pair = new List<string>();
        _discoverQueue.Add(new DiscoverJob { N = 1, Pred = c => c.Type is "武术" or "法术", Act = "swapCost", SwapPair = pair });
        _discoverQueue.Add(new DiscoverJob { N = 1, Pred = c => c.Type is "武术" or "法术", Act = "swapCost", SwapPair = pair });
        Log("[[icon:question]] <b>迷之匣</b>：发现两张随机招式——它们打出前会交换费用", "sys");
    }

    private void SwapCardCosts(string uidA, string uidB)
    {
        var a = FindCard(uidA);
        var b = FindCard(uidB);
        if (a is null || b is null) return;
        var costA = Math.Max(0, b.Card.Cost);
        var costB = Math.Max(0, a.Card.Cost);
        var copyA = a.Card.Clone(); copyA.Cost = costA;
        var copyB = b.Card.Clone(); copyB.Cost = costB;
        _cardOverrides[uidA] = copyA;
        _cardOverrides[uidB] = copyB;
        Log($"[[icon:sparkles]] <b>交换费用</b>：【{a.Card.Name}】费用变为 <b>{costA}</b>，【{b.Card.Name}】费用变为 <b>{costB}</b>", "sys");
    }

    // ---------- 随从位 / 被动 ----------
    private void SummonAlly(string name, int atk, int hp, int n)
    {
        for (var i = 0; i < (n == 0 ? 1 : n); i++)
            _allies.Add(new BattleUnit(null, name, hp, false) { Atk = atk, Dead = false, Status = new Dictionary<string, int>(), Defense = new BattleDefense() });
    }

    private void PoisonRandomFoe()
    {
        var ts = Alive();
        if (ts.Count == 0) return;
        var t = ts[_rng.NextInt(ts.Count)];
        CombatModel.AddCurse(t, "poison", 1);
        Log($"[[icon:skull]] <b>毒杖</b>：{t.Name} 附加 1 层中毒", "sys");
    }

    private void FireCatGift(CardRecord card)
    {
        if (card.Id != "tt2-apollo") return;
        _energy += 1;
        Log($"[[icon:bolt]] <b>阿猫的礼物</b>：回复 1 点能量（当前 {_energy}/{_maxEnergy}）", "ok");
        var pool = _cards.All.Where(c => CardLib.IsRandomObtainable(c) && c.Id != "tt2-apollo").ToList();
        if (pool.Count == 0) return;
        var uid = AddTempCard(pool[_rng.NextInt(pool.Count)]);
        var o = FindCard(uid);
        Log($"[[icon:cards]] <b>阿猫的礼物</b>：获得【<b>{o?.Card.Name ?? "?"}</b>】置入手牌（战斗内临时卡，战后消散）", "loot");
    }

    private void ApplyKillRewards(CardRecord? card, int kills)
    {
        if (kills <= 0) return;
        if (_killAtkUp > 0)
        {
            CombatModel.AddBlessing(_pstat, "atkUp", _killAtkUp * kills);
            Log($"[[icon:swords]] <b>饮血剑</b>：消灭 {kills} 个敌人，攻击力 +{_killAtkUp * kills}（当前加成 {_pstat.Status?.GetValueOrDefault("atkUp") ?? 0}）", "ok");
        }
        if (card is null) return;
        var d = card.Desc ?? "";
        var armorM = Regex.Match(d, @"击杀(?:敌人)?(?:时|则)?[^。；]*?\+\s*(\d+)\s*甲");
        if (armorM.Success)
        {
            _pdef.Armor += int.Parse(armorM.Groups[1].Value) * kills;
            Log($"[[icon:plate]] <b>{card.Name}</b>：击杀敌人，+{int.Parse(armorM.Groups[1].Value) * kills} 甲（当前 {_pdef.Armor}）", "ok");
        }
        var coinM = Regex.Match(d, @"若击杀敌人[，,]?\s*\+\s*(\d+)\s*币");
        if (coinM.Success)
        {
            _game.Coins += int.Parse(coinM.Groups[1].Value) * kills;
            Log($"[[icon:coin]] <b>{card.Name}</b>：击杀敌人，+{int.Parse(coinM.Groups[1].Value) * kills} 币", "loot");
        }
    }

    private void ConsumeHandUids(List<string> uids, string? cardName)
    {
        var n = 0;
        foreach (var u in uids)
        {
            var idx = _hand.IndexOf(u);
            if (idx < 0) continue;
            _hand.RemoveAt(idx);
            _consumed.Add(u);
            if (_mode == "boss") _grave.Add(u);
            var o = FindCard(u);
            if (o is not null) ResolveInfusedFuel(o.Card, FirstAlive());
            if (_consumeFireballN > 0)
            {
                for (var k = 0; k < _consumeFireballN; k++)
                {
                    var t = FirstAlive();
                    if (t is null) break;
                    var r = CombatModel.DealDamage(new CasterRef
                    {
                        Atk = _game.Atk,
                        SpellPower = _game.SpellPower,
                        Status = _pstat.Status,
                    }, t, 4, BattleDamageKind.Spell);
                    if (r.Dealt > 0) _floats.Add(new FloatEvent { Unit = _foes.IndexOf(t).ToString(), Text = "-" + r.Dealt, Cls = "dmg" });
                    Log($"[[icon:fire]] 深渊降焰：施放 1 次火球 → {t.Name}：造成 <b>{r.Dealt}</b> 点法术伤害", "sys");
                    SweepDead();
                }
            }
            n++;
        }
        if (n > 0) Log($"[[icon:flask]] <b>{cardName ?? "临时卡"}</b>：回合开始，消耗了 {n} 张临时卡", "sys");
    }

    // 法师锦囊容器：空时自动置入 3 张随机法术，打出时选 1 张直接施放
    private void QueuePouchCast(string uid)
    {
        var entry = FindCard(uid);
        if (entry is null) return;
        entry.Card.Pouch ??= new List<CardRecord>();
        if (entry.Card.Pouch.Count == 0)
        {
            var pool = _cards.All.Where(c => c.Type == "法术" && CardLib.IsRandomObtainable(c)).ToList();
            for (var i = 0; i < 3 && pool.Count > 0; i++)
                entry.Card.Pouch.Add(pool[_rng.NextInt(pool.Count)].Clone());
            Log($"[[icon:cards]] <b>法师锦囊</b>：置入了 {entry.Card.Pouch.Count} 张法术（余牌留存，下次打出再选）", "sys");
        }
        if (entry.Card.Pouch.Count == 0) { Log("[[icon:question]] 锦囊是空的，没有可施放的法术", "dim"); return; }
        _discovering = new DiscoverState
        {
            Options = entry.Card.Pouch.ToList(),
            N = 1,
            Act = "pouch",
            PouchUid = uid,
        };
    }

    // 不变应万变：打出武术后，手中所有「不变应万变」变为该武术的 1 费复制
    private void ApplyImitate(CardRecord playedMartial)
    {
        foreach (var h in _hand)
        {
            var o = FindCard(h);
            if (o is not null && o.Card.Name == "不变应万变" && !_cardOverrides.ContainsKey(h))
            {
                var copy = playedMartial.Clone();
                copy.Cost = 1;
                _cardOverrides[h] = copy;
                Log($"[[icon:recycle]] <b>不变应万变</b>：变为【{playedMartial.Name}】的 1 费复制", "sys");
            }
        }
    }

    // ---------- 装备 ----------
    private static readonly Regex EquipSkillPattern = new(@"限定技能[：:]\s*([^。]*(?:。|$))", RegexOptions.Compiled);
    private static string EquipSkillText(CardRecord? card)
    {
        var m = EquipSkillPattern.Match(card?.Desc ?? "");
        return m.Success ? m.Groups[1].Value.Trim() : "";
    }

    private void RegisterEquip(string uid, CardRecord card)
    {
        if (card.Type != "装备") return;
        if (_equipped.Any(e => e.Uid == uid)) return;
        _equipped.Add(new OwnedCard { Uid = uid, Card = card });
        Log($"[[icon:tools]] 装配【<b>{card.Name}</b>】（{_equipped.Count(e => !e.Passive)}/{EquipCap()} 件）{(EquipSkillText(card).Length > 0 ? "——限定技能已就绪" : "")}", "ok");
        SyncCurseCondEquips();
    }

    private int EquipCap()
    {
        var bonus = 0;
        foreach (var o in _game.OwnedCards)
        {
            var m = Regex.Match(o.Card?.Desc ?? "", @"装备上限\s*\+\s*(\d+)");
            if (m.Success) bonus += int.Parse(m.Groups[1].Value);
        }
        return 2 + bonus;
    }

    private static readonly Regex CurseCondEquip = new(@"诅咒状态[下时]", RegexOptions.Compiled);

    private void SyncCurseCondEquips()
    {
        if (_equipped.Count == 0) return;
        var cursed = CombatModel.HasCurse(_pstat);
        foreach (var e in _equipped)
        {
            var desc = e.Card?.Desc ?? "";
            if (e.Card?.Type != "装备" || !CurseCondEquip.IsMatch(desc) || EquipSkillText(e.Card).Length > 0) continue;
            var atkM = Regex.Match(desc, @"攻\s*\+\s*(\d+)") is { Success: true } am ? am : Regex.Match(desc, @"攻击\s*\+\s*(\d+)");
            var spM = Regex.Match(desc, @"法伤\s*\+\s*(\d+)");
            var wantAtk = cursed && atkM.Success ? int.Parse(atkM.Groups[1].Value) : 0;
            var wantSp = cursed && spM.Success ? int.Parse(spM.Groups[1].Value) : 0;
            var hadAtk = e.CondAtk;
            var hadSp = e.CondSp;
            var dAtk = wantAtk - hadAtk;
            var dSp = wantSp - hadSp;
            if (dAtk == 0 && dSp == 0) continue;
            if (dAtk != 0) CombatModel.AddBlessing(_pstat, "atkUp", dAtk);
            if (dSp != 0) CombatModel.AddBlessing(_pstat, "spellUp", dSp);
            e.CondAtk = wantAtk;
            e.CondSp = wantSp;
            Log(wantAtk != 0 || wantSp != 0
                ? $"[[icon:crystal]] <b>{e.Card.Name}</b>：身负诅咒，条件加成生效（攻 +{wantAtk}{(wantSp != 0 ? $"，法伤 +{wantSp}" : "")}）"
                : $"[[icon:cross]] <b>{e.Card.Name}</b>：诅咒解除，条件加成收回", wantAtk != 0 || wantSp != 0 ? "ok" : "dim");
        }
    }

    public void UseEquipSkill(string uid)
    {
        if (_busy || _infusing is not null || _discovering is not null || _choosing is not null || _handSelecting is not null) return;
        var e = _equipped.FirstOrDefault(x => x.Uid == uid);
        if (e is null) return;
        var text = EquipSkillText(e.Card);
        if (text.Length == 0) return;
        if (e.Used) { Log($"[[icon:cross]] 【{e.Card.Name}】的限定技能本场已经用过了", "warn"); return; }
        e.Used = true;
        Log($"[[icon:sparkles]] <b>{e.Card.Name}</b> 限定技能：{text}", "ok");
        _applyTextEffects(e.Card, text, FirstAlive(), new EffectFlags());
        SweepDead();
        if (Alive().Count == 0) { Finish(true); return; }
        ProcessChoice();
        ProcessDiscoverQueue();
    }

    // ---------- 开战被动（勾选生效，仅 BOSS 战） ----------
    private void ApplyBattleStartPassives()
    {
        if (_mode != "boss") return;
        var chosen = _game.OwnedCards.Where(o => o.Card is not null && IsBattleStartEquip(o.Card) && _selEquips.Contains(o.Uid)).ToList();
        foreach (var o in chosen)
            if (_equipped.All(e => e.Uid != o.Uid))
                _equipped.Add(new OwnedCard { Uid = o.Uid, Card = o.Card, Passive = true });
        if (chosen.Count == 0) return;
        Log($"[[icon:bolt]] 开战被动：{string.Join("、", chosen.Select(o => o.Card.Name))} 自动生效", "ok");
        foreach (var o in chosen)
        {
            var parts = TextClauses.SplitEffectClauses(o.Card.Desc ?? "");
            var text = string.Join("，", parts.Immediate);
            if (text.Length > 0) _applyTextEffects(o.Card, text, FirstAlive(), new EffectFlags());
        }
    }

    private int DeckCapBonus(IReadOnlyCollection<string>? uids = null)
    {
        var bonus = 0;
        foreach (var o in _game.OwnedCards)
        {
            if (o.Card is null || !IsBattleStartEquip(o.Card)) continue;
            if (uids is null ? !_selEquips.Contains(o.Uid) : !uids.Contains(o.Uid)) continue;
            var m = Regex.Match(o.Card.Desc ?? "", @"牌库上限\s*\+\s*(\d+)");
            if (m.Success) bonus += int.Parse(m.Groups[1].Value);
        }
        return bonus;
    }

    private int ReplaceShaInDeck(int n)
    {
        if (_mode != "boss") return 0;
        var done = 0;
        var rest = new List<string>();
        foreach (var uid in _drawPile)
        {
            var o = FindCard(uid);
            var isSha = o is not null && (o.Card.Name == "初始攻击" || o.Card.Name == "杀");
            if (isSha && done < n) { done++; continue; }
            rest.Add(uid);
        }
        _drawPile.Clear();
        _drawPile.AddRange(rest);
        for (var i = 0; i < done; i++)
        {
            var pool = _cards.All.Where(CardLib.IsRandomObtainable).ToList();
            if (pool.Count > 0) AddDeckCard(pool[_rng.NextInt(pool.Count)]);
        }
        return done;
    }

    // ---------- BOSS 编组 ----------
    private void PrepareDeckSelection()
    {
        _selEquipPool = _game.OwnedCards.Where(o => o.Card is not null && IsBattleStartEquip(o.Card)).ToList();
        _selEquips.Clear();
        foreach (var uid in _lastEquipSel.Where(uid => _selEquipPool.Any(e => e.Uid == uid))) _selEquips.Add(uid);
        _selDeckMax = _rules.BossDeckSize + DeckCapBonus();
        _selPool = _game.OwnedCards.Where(o =>
            !new[] { "道具", "资源", "事件", "生物" }.Contains(o.Card.Type) &&
            o.Card.Name != "初始攻击" && !IsBattleStartEquip(o.Card)).ToList();
        var shas = _game.OwnedCards.Where(o => o.Card.Name == "初始攻击").ToList();
        _selShaN = Math.Min(shas.Count, _rules.StarterSha);
        _sel.Clear();
        foreach (var uid in _lastDeckSel.Where(uid => _selPool.Any(e => e.Uid == uid))) _sel.Add(uid);
        var cap = Math.Min(_selDeckMax, _selPool.Count);
        while (_sel.Count > cap) _sel.Remove(_sel.First());
        _selectingDeck = true;
    }

    public void SelectDeckCard(string uid)
    {
        if (!_selectingDeck || !_selPool.Any(e => e.Uid == uid)) return;
        if (!_sel.Contains(uid) && _sel.Count >= _selDeckMax) return;
        if (!_sel.Add(uid)) _sel.Remove(uid);
    }

    public void SelectDeckEquip(string uid)
    {
        if (!_selectingDeck || !_selEquipPool.Any(e => e.Uid == uid)) return;
        if (!_selEquips.Add(uid)) _selEquips.Remove(uid);
        _selDeckMax = _rules.BossDeckSize + DeckCapBonus();
        var cap = Math.Min(_selDeckMax, _selPool.Count);
        while (_sel.Count > cap) _sel.Remove(_sel.First());
    }

    public void CancelDeck()
    {
        if (!_selectingDeck) return;
        Log("[[icon:runner]] 你放下了挑战，首脑仍在污染核心深处盘踞", "sys");
        Finish(null);
    }

    /// <summary>编组确认（网页版 commands.confirmDeck）。</summary>
    public void ConfirmDeck() => BeginBoss();

    /// <summary>按 uid 查卡（网页版 viewApi.findCard）。</summary>
    public OwnedCard? Find(string uid) => FindCard(uid);

    /// <summary>注能张数（网页版 viewApi.infuseOf）。</summary>
    public int InfuseOfView(CardRecord card) => InfuseOf(card);

    /// <summary>手牌诅咒规格（网页版 viewApi.handCurseSpecs）。</summary>
    public IReadOnlyList<(string Key, int N)> HandCurseSpecsView() => HandCurseSpecs();

    /// <summary>战斗数值规则（网页版 viewApi.R）。</summary>
    public BattleRulesTable Rules => _rules;

    public void OpenGrave() => _viewingGrave = true;

    public void CloseGrave() => _viewingGrave = false;

    public void CancelPendingTarget()
    {
        if (_pendingTarget is not null && _freeCast.Contains(_pendingTarget.Uid)) _freeCast.Remove(_pendingTarget.Uid);
        _pendingTarget = null;
        _pendingItem = null;
        _slamPending = false;
        if (_phase == BattlePhase.Targeting) _phase = BattlePhase.Player;
    }

    private void BeginBoss()
    {
        if (_sel.Count < Math.Min(_rules.BossDeckSize, _selPool.Count)) return;
        var shas = _game.OwnedCards.Where(o => o.Card.Name == "初始攻击").Take(_rules.StarterSha).Select(o => o.Uid).ToList();
        _lastDeckSel.Clear();
        _lastDeckSel.AddRange(_sel);
        _lastEquipSel.Clear();
        _lastEquipSel.AddRange(_selEquips);
        _selectingDeck = false;
        _drawPile = _sel.ToList().Concat(shas).ToList();
        Shuffle(_drawPile);
        _hand = new List<string>(); _discard = new List<string>(); _granted = new List<OwnedCard>();
        _played = new List<string>(); _consumed = new List<string>(); _grave = new List<string>();
        _maxEnergy = _rules.BattleEnergy;
        _energy = _maxEnergy;
        _turn = 1;
        _busy = false;
        _pdef = new BattleDefense();
        _pstat = new BattleUnit("player", "你", _game.Hp, false);
        CombatModel.EnsureStatus(_pstat);
        _infusing = null; _discovering = null; _discoverQueue.Clear(); _pendingTarget = null; _floats.Clear();
        _handSelecting = null; _handSelectQueue.Clear();
        _choosing = null; _choiceQueue.Clear(); _stealthStrike = false; _nextSpellTwice = 0;
        _delayed.Clear(); _noDrawNext = false; _spellCost1 = false; _meleeCost1 = false;
        _shaTransform = null; _consumeFireballN = 0; _lastDrawnUids.Clear(); _lastPlayedType = null;
        ResetBattleExtras();
        _phase = BattlePhase.Player;
        Log($"[[icon:cards]] 牌库编成：自选 {_sel.Count} 张非道具卡 + 初始攻击 ×{shas.Count} = <b>{_drawPile.Count}</b> 张 · 开局抽 {_rules.BattleStartDraw} · 每回合开始抽 {_rules.BattleTurnDraw} · 每回合固定 <b>{_maxEnergy}</b> 费", "sys");
        DrawCards(_rules.BattleStartDraw);
        ApplyBattleStartPassives();
    }

    // ---------- 目标 / 不可打出 ----------
    public string? TargetSide(CardRecord card) => BattleRules.TargetSideFor(card, CardLib.DmgTypes);

    public string? UnplayableReason(CardRecord card)
    {
        var handCards = _hand.Select(u => FindCard(u)?.Card).Where(c => c is not null).Cast<CardRecord>().ToList();
        return BattleRules.UnplayableReasonFor(card, _mode, handCards, card);
    }

    public void Play(string uid, object? side = null)
    {
        _pendingItem = null;
        if (_busy || _infusing is not null || _discovering is not null || _choosing is not null || _viewingGrave) return;
        var entry = FindCard(uid);
        if (entry is null) return;
        var card = entry.Card;
        var why = UnplayableReason(card);
        if (why is not null) { Log($"[[icon:cross]] 【{card.Name}】无法打出：{why}", "warn"); return; }
        var effCost = EffCostOf(card, uid);
        if (effCost > _energy) { Log($"[[icon:bolt]] 能量不足：【{card.Name}】需要 {effCost} 点能量", "warn"); return; }
        if (card.Type == "装备")
        {
            var cap = EquipCap();
            var worn = _equipped.Count(e => !e.Passive);
            if (worn >= cap)
            {
                Log($"[[icon:tools]] 最多同时装配 <b>{cap}</b> 件装备（已装配 {worn} 件）——本场无法再穿戴", "warn");
                return;
            }
        }
        var need = TargetSide(card);
        BattleUnit? target = null;
        var isFree = _freeCast.Contains(uid);
        var sideStr = side as string;
        if (need == "enemy")
        {
            if (side is null || sideStr == "self")
            {
                _pendingTarget = new PendingTargetState { Uid = uid, Card = card };
                _phase = BattlePhase.Targeting;
                return;
            }
            var idx = side is int i ? i : int.TryParse(sideStr, out var p) ? p : -1;
            if (idx < 0 || idx >= _foes.Count || _foes[idx].Dead)
            {
                _pendingTarget = new PendingTargetState { Uid = uid, Card = card };
                _phase = BattlePhase.Targeting;
                return;
            }
            target = _foes[idx];
        }
        else if (need == "self")
        {
            if (sideStr != "self")
            {
                _pendingTarget = new PendingTargetState { Uid = uid, Card = card };
                _phase = BattlePhase.Targeting;
                return;
            }
        }
        else
        {
            target = FirstAlive();
        }
        _pendingTarget = null;
        _freeCast.Remove(uid);
        var playCard = card;
        if (_shaTransform is not null && (card.Name == "初始攻击" || card.Name == "杀"))
        {
            var tpl = _cards.ByName(_shaTransform);
            if (tpl is not null) playCard = tpl.Clone();
        }
        QueueCardExecution(uid, playCard, new List<string>(), target, isFree);
    }

    // ---------- 注能 ----------
    public void BeginInfuse(string uid)
    {
        if (_busy || _infusing is not null || _discovering is not null || _choosing is not null || _viewingGrave) return;
        if (!_hand.Contains(uid)) return;
        var entry = FindCard(uid);
        if (entry is null) return;
        var card = entry.Card;
        var infN = InfuseOf(card);
        if (infN <= 0) return;
        var effCost = EffCostOf(card, uid);
        if (effCost > _energy) { Log($"[[icon:bolt]] 能量不足：【{card.Name}】注能打出需要 {effCost} 点能量", "warn"); return; }
        var others = _hand.Where(h => h != uid).ToList();
        if (others.Count < infN)
        {
            Log($"[[icon:flask]] 手牌不足：【{card.Name}】注能({infN}) 需要消耗 {infN} 张手牌，当前只有 {others.Count} 张可选", "warn");
            return;
        }
        _infusing = new InfuseState { Uid = uid, Card = card, Need = infN };
    }

    // toggle 语义：同名一叠整体轮换（与网页版一致——审计 harness 依赖该语义）
    public void SelectInfusion(string uid)
    {
        if (_infusing is null || uid == _infusing.Uid) return;
        var entry = FindCard(uid);
        if (entry is null) return;
        if (Regex.IsMatch(entry.Card.Desc ?? "", "无法用于注能")) return;
        var groupUids = _hand.Where(h =>
        {
            if (h == _infusing.Uid) return false;
            var o = FindCard(h);
            return o is not null && o.Card.Name == entry.Card.Name;
        }).ToList();
        var picked = groupUids.Where(_infusing.Picked.Contains).ToList();
        if (picked.Count > 0) _infusing.Picked.Remove(picked[^1]);
        else
        {
            var free = groupUids.FirstOrDefault(u => !_infusing.Picked.Contains(u));
            if (free is not null && _infusing.Picked.Count < _infusing.Need) _infusing.Picked.Add(free);
        }
    }

    public void CancelInfuse() => _infusing = null;

    public void ConfirmInfuse()
    {
        if (_infusing is null || _infusing.Picked.Count != _infusing.Need) return;
        var uid = _infusing.Uid;
        var card = _infusing.Card;
        var fuel = _infusing.Picked.ToList();
        _infusing = null;
        QueueCardExecution(uid, card, fuel, FirstAlive(), isFree: false);
    }

    private void QueueCardExecution(string uid, CardRecord card, List<string> fuelUids, BattleUnit? target, bool isFree)
    {
        _phase = BattlePhase.Resolving;
        _busy = true;
        try
        {
            ExecPlay(uid, card, fuelUids, target, isFree);
        }
        finally
        {
            if (_phase == BattlePhase.Resolving) _phase = BattlePhase.Player;
            _busy = false;
        }
    }

    private void ExecPlay(string uid, CardRecord card, List<string> fuelUids, BattleUnit? target, bool isFree)
    {
        var effCost = EffCostOf(card, uid);
        if (effCost != card.Cost)
            Log($"[[icon:sparkles]] <b>费用变化</b>：【{card.Name}】按 <b>{effCost}</b> 费打出（原 {card.Cost} 费）", "sys");
        if (!isFree) _energy -= effCost;
        _played.Add(uid);
        Sfx("card");
        RemoveUid(_hand, uid);
        foreach (var f in fuelUids) RemoveUid(_hand, f);
        foreach (var f in fuelUids)
        {
            _consumed.Add(f);
            if (_mode == "boss") _grave.Add(f);
            var o = FindCard(f);
            Log($"[[icon:flask]] <b>{card.Name}</b> 注能：消耗了【<b>{o?.Card.Name ?? "?"}</b>】{(_mode == "boss" ? "（进墓地，不参与洗回）" : "（战后进消耗口袋，可在火堆复原）")}", "sys");
            // 被牺牲的牌没有被「使用」：只结算「被注能时」条件效果与「消耗该牌时」触发
            if (o is not null) ResolveInfusedFuel(o.Card, target);
            if (o is not null) FireConsumeTriggers(o.Card, target);
            _infuseFuels++;
            if (_consumeFireballN > 0)
            {
                for (var k = 0; k < _consumeFireballN; k++)
                {
                    var t = FirstAlive();
                    if (t is null) break;
                    var r = CombatModel.DealDamage(new CasterRef
                    {
                        Atk = _game.Atk,
                        SpellPower = _game.SpellPower,
                        Status = _pstat.Status,
                    }, t, 4, BattleDamageKind.Spell);
                    if (r.Dealt > 0) _floats.Add(new FloatEvent { Unit = _foes.IndexOf(t).ToString(), Text = "-" + r.Dealt, Cls = "dmg" });
                    Log($"[[icon:fire]] 深渊降焰：施放 1 次火球 → {t.Name}：造成 <b>{r.Dealt}</b> 点法术伤害", "sys");
                    SweepDead();
                }
            }
        }
        if (_mode == "boss") _discard.Add(uid);
        var fuelCostSum = fuelUids.Sum(f => Math.Max(0, FindCard(f)?.Card.Cost ?? 0));
        var aliveBefore = Alive().Count;
        ResolveCard(card, target, fuelUids.Count > 0, fuelCostSum, uid);
        if (card.Type == "装备") RegisterEquip(uid, card);
        // 「若本牌为最后一张手牌，效果触发 N 次」：整卡效果再跑一遍
        if (Regex.IsMatch(card.Desc ?? "", @"最后一张手牌[^。；]*?触发\s*(\d+)?\s*次?") && _hand.Count == 0)
        {
            Log($"[[icon:cards]] <b>{card.Name}</b>：本牌是最后一张手牌，效果触发 2 次", "sys");
            ResolveCard(card, target, fuelUids.Count > 0, fuelCostSum, uid);
        }
        // 「下一张法术施放 N 次」（元素风暴）：法术效果再跑一遍
        if (_nextSpellTwice > 0 && card.Type == "法术")
        {
            _nextSpellTwice = 0;
            Log("[[icon:sparkles]] <b>元素风暴</b>：这张法术额外施放 1 次", "sys");
            ResolveCard(card, target, fuelUids.Count > 0, fuelCostSum, uid);
        }
        // 打出侧登记（成长/被动/击杀结算/手牌变形）
        if (Regex.IsMatch(card.Desc ?? "", @"回合开始时[，,]?\s*本牌伤害\s*\+") && card.Name.Length > 0) _growthNames.Add(card.Name);
        if (Regex.IsMatch(card.Desc ?? "", @"每消灭\s*1\s*个敌人[^。]*?\+\s*1\s*点?攻击力")) _killAtkUp++;
        if (Regex.IsMatch(card.Desc ?? "", @"每当你使用一张法术牌[^。]*中毒")) _poisonOnSpell = true;
        ApplyKillRewards(card, aliveBefore - Alive().Count);
        if (_poisonOnSpell && card.Type == "法术") PoisonRandomFoe();
        if (card.Type == "武术") ApplyImitate(card);
        // 「永远被保留在手牌中」（不朽斩）
        if (Regex.IsMatch(card.Desc ?? "", "永远被保留在手牌中"))
        {
            RemoveUid(_discard, uid);
            RemoveUid(_played, uid);
            if (_hand.Count < _rules.BattleHandMax)
            {
                _hand.Add(uid);
                Log($"[[icon:anchor]] 【{card.Name}】保留在手牌中（无法用于注能）", "sys");
            }
        }
        SweepDead();
        _lastPlayedType = card.Type;
        if (card.Type is "武术" or "法术") _playedMovesThisTurn++;
        if (card.Type == "武术") _playedMartialThisTurn++;
        if (Alive().Count == 0) { Finish(true); return; }
        ProcessChoice();
        ProcessDiscoverQueue();
    }

    private static void RemoveUid(List<string> pile, string uid)
    {
        pile.Remove(uid);
    }

    // ---------- 对敌伤害（battle.core hitFoe） ----------
    private bool AegisBlocked(BattleUnit foe) => foe.Affix == "aegis" && _turn % 2 == 0 && (foe.Status?.GetValueOrDefault("abreak") ?? 0) <= 0;

    private int HitFoe(BattleUnit foe, CardRecord card, int amount, BattleDamageKind type, string seg)
    {
        if (foe.Dead) return 0;
        if (AegisBlocked(foe))
        {
            Sfx("parry");
            _floats.Add(new FloatEvent { Unit = _foes.IndexOf(foe).ToString(), Text = "免伤", Cls = "block" });
            Log($"[[icon:crystal]] {seg}<b>{foe.Name}</b> 的元素庇幕展开：伤害被完全减免！（破甲可击碎）", "warn");
            return 0;
        }
        // 破隐一击：自己处于潜行中发动的攻击伤害 ×2
        var stealthedBefore = CombatModel.IsStealthed(_pstat);
        var amt = amount;
        if (_stealthStrike && stealthedBefore && amount > 0)
        {
            amt *= 2;
            Log($"[[icon:runner]] <b>破隐一击</b>：从潜行中发动，伤害翻倍（{amount} → {amt}）", "ok");
        }
        // 法伤加成；「受法伤加成翻倍」在此翻倍（spellUp 不预加防双算）
        var sp = _game.SpellPower + (_pstat.Status?.GetValueOrDefault("spellUp") ?? 0);
        if (Regex.IsMatch(card?.Desc ?? "", "受法伤加成翻倍")) sp *= 2;
        var statusForHit = new Dictionary<string, int>(_pstat.Status ?? new Dictionary<string, int>());
        statusForHit["spellUp"] = 0;
        var frzM = card is not null ? Regex.Match(card.Desc ?? "", @"对冰冻[^。]*?伤害\s*\+\s*(\d+)") : Match.Empty;
        if (frzM.Success && foe.Status.GetValueOrDefault("freeze") > 0) amt += int.Parse(frzM.Groups[1].Value);
        if (card is not null && Regex.IsMatch(card.Desc ?? "", "流血伤害翻倍") && foe.Status.GetValueOrDefault("bleed") > 0)
        {
            amt += foe.Status.GetValueOrDefault("bleed");
            Log($"[[icon:blood]] <b>流血伤害翻倍</b>：流血加成 {foe.Status.GetValueOrDefault("bleed")} → {foe.Status.GetValueOrDefault("bleed") * 2}", "sys");
        }
        var r = CombatModel.DealDamage(new CasterRef { Atk = _game.Atk, SpellPower = sp, Status = statusForHit }, foe, amt, type);
        if (r.Stealthed)
        {
            Sfx("parry");
            _floats.Add(new FloatEvent { Unit = _foes.IndexOf(foe).ToString(), Text = "未命中", Cls = "block" });
            Log($"[[icon:runner]] {seg}<b>{foe.Name}</b> 处于<b>潜行</b>中：无法成为被攻击对象！", "warn");
            return 0;
        }
        Sfx("hit");
        if (r.Dealt > 0) _floats.Add(new FloatEvent { Unit = _foes.IndexOf(foe).ToString(), Text = "-" + r.Dealt, Cls = "dmg" });
        Log($"[[icon:play]] <b>{card?.Name}</b>{seg} → {foe.Name}：造成 <b>{r.Dealt}</b> 点{BattleDamage.TypeName[type]}" +
            (r.Log.Count > 0 ? $"（{string.Join("，", r.Log)}）" : ""), "sys");
        if (r.Dealt > 0 && CombatModel.BreakStealth(_pstat))
            Log("[[icon:runner]] 你造成了伤害，<b>潜行</b>被破除", "dim");
        if (foe.Hp <= 0 && !foe.Dead)
        {
            foe.Dead = true;
            Log($"[[icon:skull]] <b>{foe.Name}</b> 被击倒！（剩 {Alive().Count} 个敌人）", "ok");
            _floats.Add(new FloatEvent { Unit = _foes.IndexOf(foe).ToString(), Text = "💥", Cls = "stk" });
            _floats.Add(new FloatEvent { Unit = "self", Text = KillCheer[_rng.NextInt(KillCheer.Length)], Cls = "stk stk-late" });
        }
        return r.Dealt;
    }

    private CardRecord? RandomDiscoverCard(Func<CardRecord, bool>? pred)
    {
        // BOSS 战发现池排除道具（入手即死牌）；对局内一律不出现资源卡
        var bossBan = _mode == "boss";
        List<CardRecord> pool;
        if (pred is not null)
            pool = _cards.All.Where(c => c.Rarity != "衍生" && c.Type is not ("生物" or "事件" or "资源") && !(bossBan && c.Type == "道具") && pred(c)).ToList();
        else
            pool = _cards.All.Where(c => c.Rarity != "衍生" && c.Type != "资源" && !(bossBan && c.Type == "道具") && CardLib.IsRandomObtainable(c)).ToList();
        return pool.Count == 0 ? null : pool[_rng.NextInt(pool.Count)];
    }

    // ---------- 手牌选卡 ----------
    private static bool MatchHandSelectKey(CardRecord card, string? key)
    {
        if (string.IsNullOrEmpty(key) || key == "牌") return true;
        if (key is "杀" or "初始攻击") return Regex.IsMatch(card.Name ?? "", "^(杀|初始攻击)$");
        return card.Type == key;
    }

    private void ProcessHandSelect()
    {
        if (_handSelecting is not null || _handSelectQueue.Count == 0) return;
        var job = _handSelectQueue[0];
        _handSelectQueue.RemoveAt(0);
        var matched = _hand.Count(uid => FindCard(uid) is { } o && MatchHandSelectKey(o.Card, job.Type));
        if (matched == 0)
        {
            Log($"[[icon:cards]] 手牌中没有{(job.Type is not null ? $"「{job.Type}」" : "")}卡牌可选，该效果跳过", "warn");
            ProcessHandSelect();
            return;
        }
        _handSelecting = new HandSelectState
        {
            N = Math.Min(job.N == 0 ? 1 : job.N, matched),
            Type = job.Type,
            Act = string.IsNullOrEmpty(job.Act) ? "play" : job.Act,
            ThenText = job.ThenText ?? "",
            Target = job.Target,
            SrcCard = job.SrcCard,
        };
    }

    public void SkipHandSelect()
    {
        if (_handSelecting is null) return;
        _handSelecting = null;
        Log("[[icon:cards]] 跳过手牌选择，该效果未结算", "warn");
        ProcessHandSelect();
    }

    public void PickHandSelect(string uid)
    {
        if (_handSelecting is null) return;
        var entry = FindCard(uid);
        if (entry is null) return;
        if (_handSelecting.Act == "play")
        {
            _handSelecting = null;
            QueueCardExecution(uid, entry.Card, new List<string>(), FirstAlive(), isFree: true);
            return;
        }
        if (_handSelecting.Act == "copy")
        {
            AddTempCard(entry.Card.Clone());
            Log($"[[icon:cards]] 复制了手牌中的【<b>{entry.Card.Name}</b>】（置入手牌，原牌保留）", "loot");
            _handSelecting.N -= 1;
            if (_handSelecting.N > 0) return;
            var doneJob = _handSelecting;
            _handSelecting = null;
            if (doneJob.ThenText.Length > 0) _applyTextEffects(entry.Card, doneJob.ThenText, null, null);
            if (Alive().Count == 0) { Finish(true); return; }
            ProcessHandSelect();
            return;
        }
        if (_handSelecting.Act == "zero")
        {
            _zeroFeeUntil[uid] = _turn + 1;
            Log($"[[icon:bolt]] 【{entry.Card.Name}】下回合打出时变为 <b>0</b> 费", "sys");
            _handSelecting = null;
            ProcessHandSelect();
            return;
        }
        // consume
        RemoveUid(_hand, uid);
        _consumed.Add(uid);
        Log($"[[icon:flask]] 消耗了手牌中的【<b>{entry.Card.Name}</b>】", "sys");
        FireConsumeTriggers(entry.Card, null);
        _handSelecting.N -= 1;
        if (_handSelecting.N > 0) return;
        var job = _handSelecting;
        _handSelecting = null;
        if (job.ThenText.Length > 0) _applyTextEffects(job.SrcCard ?? entry.Card, job.ThenText, job.Target, null);
        if (Alive().Count == 0) { Finish(true); return; }
        ProcessHandSelect();
    }

    private int RestoreConsumed(int n)
    {
        var cnt = 0;
        while (cnt < n && _consumed.Count > 0)
        {
            var uid = _consumed[^1];
            _consumed.RemoveAt(_consumed.Count - 1);
            _hand.Add(uid);
            cnt++;
        }
        if (cnt > 0) Log($"[[icon:gem]] 复原 {cnt} 张消耗卡，回到手牌", "ok");
        return cnt;
    }

    // ---------- 战斗背包 / 药水栏 ----------
    private List<OwnedCard> BattleBagItems() => _game.OwnedCards.Where(o => o.Card is not null && o.Card.Type == "道具" && !o.Safe).ToList();

    private (bool Usable, string Why) ItemUsability(CardRecord? card)
    {
        if (card is null) return (false, "未知道具");
        if (card.Id == "tt-token-color") return (false, "合成材料：集齐 2 枚彩色令牌碎片后在背包里合成");
        if (_mode == "boss" && Regex.IsMatch(card.Desc ?? "", "非\\s*BOSS\\s*战")) return (false, "BOSS 战中无法逃跑");
        if (BattleRules.ItemTargetSideFor(card) == "enemy" && Alive().Count == 0) return (false, "场上没有敌人可用");
        return (true, "");
    }

    public void UsePotion(string uid)
    {
        var entry = BattleBagItems().FirstOrDefault(o => o.Uid == uid);
        if (entry is null) return;
        if (BattleRules.ItemTargetSideFor(entry.Card) == "enemy")
        {
            var n = Alive().Count;
            if (n == 0) { Log("[[icon:cross]] 场上没有敌人可以使用", "warn"); return; }
            if (n > 1)
            {
                _pendingItem = new PendingItemState { Uid = entry.Uid, Card = entry.Card };
                Log($"[[icon:flask]] <b>{entry.Card.Name}</b>：点击一名敌人使用（或把它拖到敌人身上）", "sys");
                return;
            }
            UseItem(uid, _foes.IndexOf(Alive()[0]));
            return;
        }
        UseItem(uid, null);
    }

    public void UseItem(string uid, object? side)
    {
        var entry = BattleBagItems().FirstOrDefault(o => o.Uid == uid);
        if (entry is null) return;
        if (_busy || _infusing is not null || _discovering is not null || _choosing is not null || _handSelecting is not null) return;
        var card = entry.Card;
        var desc = card.Desc ?? "";
        var healM = Regex.Match(desc, @"回复\s*(\d+)\s*点生命");
        var isCrystal = card.Id == "tt-crystal" || Regex.IsMatch(desc, @"复活最多\s*3\s*张卡牌");
        var isPotion = card.Id == "tt3-mystery-potion" || Regex.IsMatch(desc, "随机神秘效果");
        var rm = Regex.Match(desc, @"获得\s*(\d+)\s*份?\s*口粮") is { Success: true } rm1 ? rm1 : Regex.Match(desc, @"口粮\s*[×x]\s*(\d+)");
        var wm = Regex.Match(desc, @"木材\s*[×x]\s*(\d+)");
        if (!healM.Success && !isCrystal && !isPotion && !rm.Success && !wm.Success)
        {
            // 战斗效果类道具（药水/TNT/烟雾弹/通行证C/彩色令牌）走执行器结算
            UseBattleEffectItem(entry, side);
            return;
        }
        _game.OwnedCards.Remove(entry);
        Log($"[[icon:bag]] 使用道具【<b>{card.Name}</b>】", "sys");
        if (healM.Success)
        {
            var n = int.Parse(healM.Groups[1].Value);
            if (_pstat.Status.GetValueOrDefault("healban") > 0)
                Log($"[[icon:heart]] 禁疗中：回复 <b>{n}</b> 点生命无效（还剩 {_pstat.Status.GetValueOrDefault("healban")} 回合）", "warn");
            else
            {
                _game.Heal(n);
                _floats.Add(new FloatEvent { Unit = "self", Text = "💚", Cls = "stk", Warm = true });
            }
        }
        if (isCrystal)
        {
            if (RestoreConsumed(3) == 0) Log("消耗堆是空的，没有可复原的卡牌", "dim");
        }
        if (isPotion)
        {
            var r = _rng.NextDouble();
            if (r < 1.0 / 3)
            {
                if ((_pstat.Status?.GetValueOrDefault("healban") ?? 0) > 0) Log("[[icon:flask]] 禁疗中：神秘药水的回复无效", "warn");
                else
                {
                    _game.Heal(8);
                    _floats.Add(new FloatEvent { Unit = "self", Text = "💚", Cls = "stk", Warm = true });
                }
            }
            else if (r < 2.0 / 3)
            {
                _game.Coins += 3;
                Log("[[icon:flask]] 神秘药水：获得 <b>3</b> 币", "coin");
            }
            else
            {
                var pool = _cards.All.Where(CardLib.IsRandomObtainable).ToList();
                var got = pool.Count > 0 ? pool[_rng.NextInt(pool.Count)] : null;
                if (got is not null)
                {
                    if (_mode == "boss") AddDeckCard(got.Clone());
                    else AddTempCard(got.Clone());
                    Log($"[[icon:flask]] 神秘药水：随机获得【<b>{got.Name}</b>】{(_mode == "boss" ? "（洗入牌库）" : "（置入手牌）")}", "loot");
                    FireCatGift(got);
                }
            }
        }
        if (rm.Success) _game.AddItem("rations", int.Parse(rm.Groups[1].Value));
        if (wm.Success) _game.AddItem("wood", int.Parse(wm.Groups[1].Value));
    }

    private void UseBattleEffectItem(OwnedCard entry, object? side)
    {
        var card = entry.Card;
        if (BattleRules.ItemTargetSideFor(card) == "enemy" && side is null)
        {
            var n = Alive().Count;
            if (n == 0) { Log("[[icon:cross]] 场上没有敌人可以使用", "warn"); return; }
            if (n > 1)
            {
                _pendingItem = new PendingItemState { Uid = entry.Uid, Card = card };
                Log($"[[icon:flask]] <b>{card.Name}</b>：点击一名敌人使用（或把它拖到敌人身上）", "sys");
                return;
            }
            side = _foes.IndexOf(Alive()[0]);
        }
        var idx = side is int i ? i : side is string s && int.TryParse(s, out var p) ? p : -1;
        BattleUnit? target = idx >= 0 && idx < _foes.Count && !_foes[idx].Dead ? _foes[idx] : FirstAlive();
        _game.OwnedCards.Remove(entry);
        Log($"[[icon:bag]] 使用道具【<b>{card.Name}</b>】{(target is not null ? $"→ {target.Name}" : "")}", "sys");
        _applyTextEffects(card, card.Desc ?? "", target, new EffectFlags());
        SweepDead();
    }

    // 背包砸击（免费动作按钮外的 2 费动作）
    public void BagSlam()
    {
        if (_busy || _infusing is not null || _discovering is not null || _choosing is not null || _handSelecting is not null || _viewingGrave || _selectingDeck) return;
        if (_slamPending) { CancelSlam(); return; }
        if (_energy < 2) { Log("[[icon:bolt]] 能量不足：背包砸击需要 2 点能量", "warn"); return; }
        if (Alive().Count == 0) { Log("[[icon:cross]] 场上没有敌人可以砸击", "warn"); return; }
        _slamPending = true;
        Log("[[icon:bag]] <b>背包砸击</b>：点击一名敌人砸下（2 费 · 4 点固定伤害 · 不消耗卡牌）", "sys");
    }

    private void CancelSlam() => _slamPending = false;

    public void ResolveSlam(object? side)
    {
        _slamPending = false;
        if (_energy < 2) { Log("[[icon:bolt]] 能量不足：背包砸击需要 2 点能量", "warn"); return; }
        var idx = side is int i ? i : side is string s && int.TryParse(s, out var p) ? p : -1;
        var t = idx >= 0 && idx < _foes.Count && !_foes[idx].Dead ? _foes[idx] : FirstAlive();
        if (t is null) return;
        _energy -= 2;
        Sfx("strike");
        var r = CombatModel.DealDamage(new CasterRef { Atk = _game.Atk }, t, 4, BattleDamageKind.Fixed);
        if (r.Dealt > 0) _floats.Add(new FloatEvent { Unit = _foes.IndexOf(t).ToString(), Text = "-" + r.Dealt, Cls = "dmg" });
        Log($"[[icon:bag]] <b>背包砸击</b>砸向 {t.Name}：造成 <b>{r.Dealt}</b> 点固定伤害（-2 能量）", "sys");
        SweepDead();
        if (Alive().Count == 0) { Finish(true); return; }
    }

    // ---------- 抉择面板 ----------
    private void ProcessChoice()
    {
        if (_choosing is not null || _choiceQueue.Count == 0) return;
        var job = _choiceQueue[0];
        _choiceQueue.RemoveAt(0);
        _choosing = new ChoiceState { CardName = string.IsNullOrEmpty(job.CardName) ? "？" : job.CardName, Options = job.Options.ToList(), SecondDoor = job.SecondDoor };
    }

    public void PickChoice(int i)
    {
        if (_choosing is null) return;
        var job = _choosing;
        _choosing = null;
        var text = i >= 0 && i < job.Options.Count ? job.Options[i] : "";
        Log($"[[icon:question]] <b>抉择</b>（【{job.CardName}】）：你选择了「{text}」", "sys");
        // 选项指名生物/门类卡：把它的「回合开始时」效果注册为每回合重复的持续效果
        var quoted = Regex.Match(text, "[‘“「]([^\\s，。；‘’“”「」]+)[’”」]");
        var refCard = quoted.Success ? _cards.ByName(quoted.Groups[1].Value) : null;
        if (refCard is { Type: "生物" })
        {
            var parts = TextClauses.SplitEffectClauses(refCard.Desc);
            if (parts.TurnStart.Count > 0)
            {
                foreach (var it in parts.TurnStart)
                {
                    var regText = it.Text;
                    var paren = Regex.Match(refCard.Desc ?? "", "（[^）]*从这些中随机[^）]*）");
                    if (paren.Success && Regex.IsMatch(regText, "随机获取一项祝福")) regText += paren.Value;
                    _delayed.Add(new DelayedItem { Text = regText, CardName = refCard.Name, Repeat = true });
                }
                Log($"[[icon:hourglass]] <b>{refCard.Name}</b> 展开：{string.Join("；", parts.TurnStart.Select(it => it.Text))}（每回合开始生效）", "sys");
            }
            else Log($"[[icon:question]] 【{refCard.Name}】没有可展开的回合开始效果（占位）", "dim");
        }
        else
        {
            _applyTextEffects(new CardRecord { Name = job.CardName }, text, FirstAlive(), null);
        }
        // 花开两面：两回合后开启未选择的那扇门
        if (job.SecondDoor && job.Options.Count == 2)
        {
            var otherText = job.Options[i == 0 ? 1 : 0];
            var q2 = Regex.Match(otherText, "[‘“「]([^\\s，。；‘’“”「」]+)[’”」]");
            var ref2 = q2.Success ? _cards.ByName(q2.Groups[1].Value) : null;
            if (ref2 is { Type: "生物" })
            {
                var parts2 = TextClauses.SplitEffectClauses(ref2.Desc);
                foreach (var it in parts2.TurnStart)
                    _delayed.Add(new DelayedItem { Text = it.Text, CardName = ref2.Name, Repeat = true, NotBeforeTurn = _turn + 2 });
                if (parts2.TurnStart.Count > 0) Log($"[[icon:hourglass]] <b>两回合后</b>：未选择的【{ref2.Name}】也将展开", "sys");
            }
        }
        SweepDead();
        if (Alive().Count == 0) { Finish(true); return; }
        ProcessChoice();
        ProcessDiscoverQueue();
    }

    // ---------- 发现面板 ----------
    private void ProcessDiscoverQueue()
    {
        if (_discovering is not null || _discoverQueue.Count == 0) return;
        var job = _discoverQueue[0];
        _discoverQueue.RemoveAt(0);
        var options = new List<CardRecord>();
        var taken = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < 3 && options.Count < 3; i++)
        {
            var c = RandomDiscoverCard(job.Pred);
            var guard = 0;
            while (c is not null && taken.Contains(c.Id) && guard++ < 40) c = RandomDiscoverCard(job.Pred);
            if (c is not null && !taken.Contains(c.Id)) { taken.Add(c.Id); options.Add(c); }
        }
        if (options.Count == 0) { Log("（没有符合条件的卡牌可发现）", "dim"); return; }
        _discovering = new DiscoverState
        {
            Options = options,
            N = job.N,
            Pred = job.Pred,
            Act = job.Act,
            PriceArmor = job.PriceArmor,
            PouchUid = job.PouchUid,
            ConsumeTempAtTurn = job.ConsumeTempAtTurn,
            TempUids = new List<string>(),
            SwapPair = job.SwapPair,
        };
    }

    public void PickDiscover(int i)
    {
        if (_discovering is null) return;
        var card = i >= 0 && i < _discovering.Options.Count ? _discovering.Options[i] : null;
        if (card is null) return;
        var st = _discovering;
        _discovering = null;
        if (st.Act != "pouch") FireCatGift(card);
        if (st.Act is "play" or "potion")
        {
            var uid = AddTempCard(card.Clone());
            Log($"[[icon:question]] 发现：【<b>{card.Name}</b>】并直接施放（免费用 · 战斗内临时卡，战后消散）", "loot");
            QueueCardExecution(uid, FindCard(uid)!.Card, new List<string>(), FirstAlive(), isFree: true);
        }
        else if (st.Act == "playKeep")
        {
            var uid = AddTempCard(card.Clone());
            Log($"[[icon:question]] 发现：【<b>{card.Name}</b>】并直接施放（战斗内临时卡，战后消散）", "loot");
            QueueCardExecution(uid, FindCard(uid)!.Card, new List<string>(), FirstAlive(), isFree: true);
            foreach (var o in st.Options.Where(o => o.Id != card.Id))
            {
                AddTempCard(o.Clone());
                Log($"[[icon:cards]] 其余的【<b>{o.Name}</b>】置入手牌", "loot");
            }
        }
        else if (st.Act == "pouch")
        {
            var pouchEntry = st.PouchUid is not null ? FindCard(st.PouchUid) : null;
            if (pouchEntry?.Card.Pouch is { } pouch)
            {
                var pi = pouch.FindIndex(c => c.Id == card.Id);
                if (pi >= 0) pouch.RemoveAt(pi);
            }
            var uid = AddTempCard(card.Clone());
            Log($"[[icon:question]] <b>法师锦囊</b>：施放其中的【<b>{card.Name}</b>】（锦囊余 {pouchEntry?.Card.Pouch?.Count ?? 0} 张）", "loot");
            QueueCardExecution(uid, FindCard(uid)!.Card, new List<string>(), FirstAlive(), isFree: true);
        }
        else if (st.Act == "dup")
        {
            AddTempCard(card.Clone());
            AddTempCard(card.Clone());
            Log($"[[icon:question]] 发现：【<b>{card.Name}</b>】并额外获得 1 张复制（×2 置入手牌 · 战斗内临时卡，战后消散）", "loot");
        }
        else
        {
            var uid = AddTempCard(card.Clone());
            Log($"[[icon:question]] 发现：【<b>{card.Name}</b>】置入手牌（战斗内临时卡，战后消散）", "loot");
            if (st.PriceArmor)
            {
                var price = CardLib.SellPrice(_cards, card);
                _pdef.Armor += price;
                Log($"[[icon:plate]] <b>挖宝</b>：【{card.Name}】价格 {price} → 获得 {price} 点护甲（当前 {_pdef.Armor}）", "sys");
            }
            if (st.ConsumeTempAtTurn) st.TempUids.Add(uid);
            if (st.SwapPair is not null) st.SwapPair.Add(uid);
        }
        SweepDead();
        if (Alive().Count == 0) { Finish(true); return; }
        if (st.N > 1)
        {
            _discoverQueue.Insert(0, new DiscoverJob
            {
                N = st.N - 1, Pred = st.Pred, Act = st.Act, PriceArmor = st.PriceArmor,
                PouchUid = st.PouchUid, ConsumeTempAtTurn = st.ConsumeTempAtTurn, SwapPair = st.SwapPair,
            });
        }
        else if (st.ConsumeTempAtTurn && st.TempUids.Count > 0)
        {
            _delayed.Add(new DelayedItem { Special = "consumeTemps", Uids = st.TempUids.ToList(), CardName = "江湖救急" });
            Log($"[[icon:hourglass]] <b>江湖救急</b>：置入的 {st.TempUids.Count} 张临时卡将在下个回合开始时消耗", "sys");
        }
        else if (st.SwapPair is { Count: >= 2 } pair)
        {
            SwapCardCosts(pair[0], pair[1]);
        }
        ProcessDiscoverQueue();
    }

    // ---------- 玩家承伤 / 回合流转 ----------
    private int PlayerTakeHit(BattleUnit foe)
    {
        var playerRef = new BattleUnit("player", "你", Math.Max(1, _game.Hp), false)
        {
            Hp = _game.Hp,
            Status = _pstat.Status,
            Defense = _pdef,
        };
        var r = CombatModel.DealDamage(new CasterRef { Atk = foe.Atk }, playerRef, 0, BattleDamageKind.Attack);
        if (r.Dealt > 0 && _game.Hp - r.Dealt <= 0 && _deathSave > 0)
        {
            _deathSave--;
            CombatModel.AddBlessing(_pstat, "immune", 1);
            Log($"[[icon:sparkles]] <b>致命一击被挡下！</b>（死亡保险剩余 {_deathSave} 次，本回合无敌）", "ok");
            return 0;
        }
        _game.Hp = Math.Max(0, playerRef.Hp);
        Sfx("hurt");
        _floats.Add(new FloatEvent { Unit = "self", Text = "-" + r.Dealt, Cls = "hurt" });
        if (r.Dealt > 0) _floats.Add(new FloatEvent { Unit = "self", Text = "💢", Cls = "stk stk-late" });
        Log($"[[icon:demon]] <b>{foe.Name}</b> 反击：你受到 <b>{r.Dealt}</b> 点攻击伤害（{_game.Hp}/{_game.MaxHp}）", "warn");
        return r.Dealt;
    }

    private void FrenzyCurse(BattleUnit foe)
    {
        var key = _rng.NextDouble() < 0.5 ? "bleed" : "poison";
        CombatModel.AddCurse(_pstat, key, 1);
        Sfx("curse");
        Log($"[[icon:bolt]] <b>{foe.Name}</b> 的攻击附加了 <b>1</b> 层{CombatModel.CurseMeta[key].Name}", "warn");
    }

    private void ElCurse(BattleUnit foe)
    {
        var keys = new[] { "bleed", "poison", "burn" };
        var key = keys[_rng.NextInt(keys.Length)];
        CombatModel.AddCurse(_pstat, key, 1);
        Sfx("curse");
        Log($"[[icon:skull]] <b>{foe.Name}</b> 的攻击附加了 <b>1</b> 层{CombatModel.CurseMeta[key].Name}", "warn");
    }

    public void EndTurn()
    {
        if (_busy || _infusing is not null || _discovering is not null || _choosing is not null) return;
        _pendingItem = null;
        _slamPending = false;
        _busy = true;
        try
        {
            // 额外回合（命运钟表）：跳过敌方阶段
            if (_extraTurn)
            {
                _extraTurn = false;
                _turn++;
                foreach (var foe in _foes.Where(f => !f.Dead)) foe.Intent = IntentFor(foe, _turn);
                _energy = _maxEnergy;
                if ((_pstat.Status?.GetValueOrDefault("natureForm") ?? 0) > 0) _energy++;
                if ((_pstat.Status?.GetValueOrDefault("swordForm") ?? 0) > 0)
                {
                    if (_mode == "boss") { var got = DrawCards(1); Log($"[[icon:sword]] <b>剑仙形态</b>：额外抽了 {got} 张牌", "ok"); }
                    else GrantSha(1);
                }
                if (_noDrawNext) { _noDrawNext = false; Log("[[icon:cross]] <b>下回合无法抽牌</b>生效：本回合开始不抽牌", "warn"); }
                else if (_mode == "boss") DrawCards(_rules.BattleTurnDraw);
                ProcessDelayed();
                Log($"[[icon:hourglass]] <b>额外回合</b>：敌人被钉在原地，你再次行动！（第 {_turn} 回合）", "ok");
                _phase = BattlePhase.Player;
                return;
            }
            _phase = BattlePhase.Enemy;
            _pendingTarget = null;
            // 玩家回合结束：中毒 / 灼烧结算
            var pref = new BattleUnit("player", "你", Math.Max(1, _game.Hp), false) { Hp = _game.Hp, Status = _pstat.Status, Defense = _pdef };
            var pr = CombatModel.TickPoison(pref);
            var br = CombatModel.TickBurn(pref);
            _game.Hp = Math.Max(0, pref.Hp);
            if (pr is not null)
            {
                _floats.Add(new FloatEvent { Unit = "self", Text = "-" + pr.Dealt, Cls = "hurt" });
                Log($"[[icon:skull]] 中毒结算：你受到 <b>{pr.Dealt}</b> 点固定伤害（{_game.Hp}/{_game.MaxHp}）", "warn");
            }
            if (br is not null)
            {
                _floats.Add(new FloatEvent { Unit = "self", Text = "-" + br.Dealt, Cls = "hurt" });
                Log($"[[icon:fire]] 灼烧结算：你受到 <b>{br.Dealt}</b> 点固定伤害（{_game.Hp}/{_game.MaxHp}）", "warn");
            }
            if (_game.Hp <= 0) { Finish(false); return; }
            // 随从自动攻击
            foreach (var a in _allies.Where(a => !a.Dead))
            {
                var t = FirstAlive();
                if (t is null) break;
                var r = CombatModel.DealDamage(new CasterRef { Atk = a.Atk, Status = a.Status }, t, 0, BattleDamageKind.Attack);
                if (r.Dealt > 0) _floats.Add(new FloatEvent { Unit = _foes.IndexOf(t).ToString(), Text = "-" + r.Dealt, Cls = "dmg" });
                Log($"[[icon:swords]] <b>{a.Name}</b> 自动攻击 {t.Name}：造成 <b>{r.Dealt}</b> 点攻击伤害", "sys");
            }
            SweepDead();
            if (Alive().Count == 0) { Finish(true); return; }
            // 敌人回合：逐个行动（同步）
            var acting = Alive();
            foreach (var foe in acting)
            {
                if (_game.Hp <= 0) { Finish(false); return; }
                if (foe.Dead) continue;
                if (!CombatModel.CanAct(foe))
                {
                    Log($"[[icon:crystal]] <b>{foe.Name}</b> 被冰冻，无法行动！", "sys");
                    continue;
                }
                var hits = foe.Affix == "frenzy" ? 2 : 1;
                for (var h = 0; h < hits && _game.Hp > 0; h++)
                {
                    if (CombatModel.IsStealthed(_pstat))
                    {
                        Log($"[[icon:runner]] 你在<b>潜行</b>中，<b>{foe.Name}</b> 无法将你作为攻击对象", "sys");
                        break;
                    }
                    // 随从优先替主人承受伤害
                    var guard = _allies.FirstOrDefault(a => !a.Dead);
                    if (guard is not null)
                    {
                        var ar = CombatModel.DealDamage(new CasterRef { Atk = foe.Atk }, guard, 0, BattleDamageKind.Attack);
                        Sfx("hurt");
                        _floats.Add(new FloatEvent { Unit = "ally:" + _allies.IndexOf(guard), Text = "-" + ar.Dealt, Cls = "hurt" });
                        Log($"[[icon:runner]] <b>{guard.Name}</b> 替你承受了 <b>{ar.Dealt}</b> 点攻击伤害（{Math.Max(0, guard.Hp)}/{guard.MaxHp}）", "sys");
                        if (guard.Hp <= 0 && !guard.Dead)
                        {
                            guard.Dead = true;
                            Log($"[[icon:skull]] <b>{guard.Name}</b> 阵亡", "warn");
                        }
                        continue;
                    }
                    var dealt = PlayerTakeHit(foe);
                    if (dealt > 0 && CombatModel.BreakStealth(foe))
                        Log($"[[icon:runner]] <b>{foe.Name}</b> 发动了攻击，<b>潜行</b>被破除", "dim");
                    if (dealt > 0 && foe.Affix == "frenzy") FrenzyCurse(foe);
                    if (dealt > 0 && foe.Behavior == "burn")
                    {
                        CombatModel.AddCurse(_pstat, "burn", 2);
                        Sfx("curse");
                        Log($"[[icon:fire]] <b>{foe.Name}</b> 的攻击附加了<b>灼烧</b>（2 回合内每回合结束受 1 点固定伤害）", "warn");
                    }
                    else if (dealt > 0 && foe.Behavior == "curse")
                    {
                        ElCurse(foe);
                    }
                }
            }
            if (_game.Hp <= 0) { Finish(false); return; }
            AfterEnemies();
        }
        finally
        {
            _busy = false;
        }
    }

    private void AfterEnemies()
    {
        var aliveBeforeTick = Alive().Count;
        foreach (var foe in _foes)
        {
            if (foe.Dead) continue;
            var er = CombatModel.TickPoison(foe);
            if (er is not null)
            {
                _floats.Add(new FloatEvent { Unit = _foes.IndexOf(foe).ToString(), Text = "-" + er.Dealt, Cls = "dmg" });
                Log($"[[icon:skull]] 中毒结算：<b>{foe.Name}</b> 受到 <b>{er.Dealt}</b> 点固定伤害（{Math.Max(0, foe.Hp)}/{foe.MaxHp}）", "sys");
            }
            var eb = CombatModel.TickBurn(foe);
            if (eb is not null)
            {
                _floats.Add(new FloatEvent { Unit = _foes.IndexOf(foe).ToString(), Text = "-" + eb.Dealt, Cls = "dmg" });
                Log($"[[icon:fire]] 灼烧结算：<b>{foe.Name}</b> 受到 <b>{eb.Dealt}</b> 点固定伤害（{Math.Max(0, foe.Hp)}/{foe.MaxHp}）", "sys");
            }
            if (foe.Hp <= 0 && !foe.Dead)
            {
                foe.Dead = true;
                Log($"[[icon:skull]] <b>{foe.Name}</b> 毒发倒地！（剩 {Alive().Count} 个敌人）", "ok");
                _floats.Add(new FloatEvent { Unit = _foes.IndexOf(foe).ToString(), Text = "💥", Cls = "stk" });
            }
        }
        if (Alive().Count == 0) { Finish(true); return; }
        ApplyKillRewards(null, aliveBeforeTick - Alive().Count);
        // 军威：回合结束时攻击力 +2
        foreach (var foe in _foes)
        {
            if (!foe.Dead && foe.Affix == "grow")
            {
                foe.Atk += 2;
                Log($"[[icon:arrow]] <b>军威</b>：<b>{foe.Name}</b> 攻击力增至 <b>{foe.Atk}</b>", "warn");
            }
        }
        // 共享回合钟：计时状态统一递减
        TickDurationsLog(_pstat.Status!, "你");
        foreach (var foe in _foes.Where(f => !f.Dead)) TickDurationsLog(foe.Status!, foe.Name);
        foreach (var foe in _foes)
        {
            if (foe.Dead || foe.StealRestore <= 0) continue;
            foe.Atk += foe.StealRestore;
            Log($"[[icon:arrow]] <b>{foe.Name}</b> 被偷取的攻击力归还（恢复至 {foe.Atk}）", "dim");
            foe.StealRestore = 0;
        }
        SyncCurseCondEquips();
        _turn++;
        foreach (var foe in _foes.Where(f => !f.Dead)) foe.Intent = IntentFor(foe, _turn);
        _energy = _maxEnergy;
        _playedMartialThisTurn = 0;
        _playedMovesThisTurn = 0;
        AccrueGrowth();
        if ((_pstat.Status?.GetValueOrDefault("natureForm") ?? 0) > 0)
        {
            _energy++;
            Log($"[[icon:wood]] <b>自然形态</b>：额外获得 1 点能量（当前 {_energy}/{_maxEnergy}）", "ok");
        }
        if ((_pstat.Status?.GetValueOrDefault("swordForm") ?? 0) > 0)
        {
            if (_mode == "boss")
            {
                var got = DrawCards(1);
                Log($"[[icon:sword]] <b>剑仙形态</b>：额外抽了 {got} 张牌", "ok");
            }
            else
            {
                GrantSha(1);
                Log("[[icon:sword]] <b>剑仙形态</b>：额外获得 1 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）", "ok");
            }
        }
        ProcessDelayed();
        if (_noDrawNext)
        {
            _noDrawNext = false;
            Log("[[icon:cross]] <b>下回合无法抽牌</b>生效：本回合开始不抽牌", "warn");
        }
        else if (_mode == "boss") DrawCards(_rules.BattleTurnDraw);
        _phase = BattlePhase.Player;
    }

    private void TickDurationsLog(Dictionary<string, int> status, string who)
    {
        var probe = new BattleUnit(null, who, 1, false) { Status = status };
        var expired = CombatModel.TickDurations(probe);
        foreach (var k in expired)
            Log($"[[icon:sparkles]] {who} 的<b>{CombatModel.CurseMeta.GetValueOrDefault(k)?.Name ?? CombatModel.BuffMeta.GetValueOrDefault(k)?.Name ?? k}</b>效果结束了", "dim");
    }

    // ---------- 结束 / 撤退 ----------
    public void Flee()
    {
        if (_busy || _infusing is not null || _discovering is not null || _choosing is not null) return;
        Sfx("flee");
        Log("[[icon:runner]] 你撤出了战斗（打出过的卡照常结算）", "sys");
        Finish(null);
    }

    public void Surrender()
    {
        if (_busy || _infusing is not null || _discovering is not null || _choosing is not null || _handSelecting is not null) return;
        Sfx("flee");
        Log("[[icon:cross]] 你选择了撤离——<b>本局视为失败</b>，安全格中的卡牌将被抢运回基地", "warn");
        Finish(false);
    }

    private void Finish(bool? win)
    {
        if (win == true && _phase != BattlePhase.Victory) _phase = BattlePhase.Victory;
        if (win == false && _phase != BattlePhase.Defeat) _phase = BattlePhase.Defeat;
        Sfx(win == true ? "victory" : win == false ? "defeat" : "flee");
        var playedCopy = _played.ToList();
        var consumedCopy = _consumed.ToList();
        _played.Clear(); _consumed.Clear();
        _drawPile.Clear(); _hand.Clear(); _discard.Clear(); _granted.Clear(); _grave.Clear();
        _floats.Clear();
        _sel.Clear();
        _infusing = null; _discovering = null; _discoverQueue.Clear(); _pendingTarget = null;
        _handSelecting = null; _handSelectQueue.Clear();
        _choosing = null; _choiceQueue.Clear(); _stealthStrike = false; _nextSpellTwice = 0;
        _delayed.Clear(); _noDrawNext = false; _spellCost1 = false; _meleeCost1 = false;
        _shaTransform = null; _consumeFireballN = 0; _lastDrawnUids.Clear(); _lastPlayedType = null;
        ResetBattleExtras();
        _game.OnBattleEnd(new BattleEndInfo
        {
            IsBoss = _opts.IsBoss,
            Layer = _opts.Layer,
            Name = _opts.Name,
            ReturnTo = _opts.ReturnTo,
            FoeNames = _foes.Select(f => f.Name).ToArray(),
            Played = playedCopy.ToArray(),
            Win = win,
            Consumed = consumedCopy.ToArray(),
        });
        _finished = true;
    }

    private bool _finished;

    public bool IsFinished => _finished;

    // ---------- 敌方意图 ----------
    private static readonly IReadOnlyDictionary<string, (string Icon, string Label)> IntentMeta = new Dictionary<string, (string, string)>
    {
        ["strike"] = ("[[icon:swords]]", "攻击"),
        ["volley"] = ("[[icon:swords]]", "远程攻击"),
        ["charge"] = ("[[icon:fire]]", "蓄力攻击"),
        ["guard"] = ("[[icon:shield]]", "防御/反击"),
        ["burn"] = ("[[icon:fire]]", "攻击并灼烧"),
        ["curse"] = ("[[icon:skull]]", "攻击并施加诅咒"),
        ["dragon"] = ("[[icon:demon]]", "重击/特殊"),
        ["general"] = ("[[icon:arrow]]", "军威强化"),
        ["orc_boss"] = ("[[icon:tools]]", "双击+诅咒"),
        ["element_boss"] = ("[[icon:crystal]]", "元素庇幕"),
    };

    private static EnemyIntent IntentFor(BattleUnit def, int round)
    {
        var kind = def.Behavior ?? (def.Affix == "grow" ? "general" : def.Affix == "frenzy" ? "orc_boss" : def.Affix == "aegis" ? "element_boss" : "strike");
        var meta = IntentMeta.GetValueOrDefault(kind, ("[[icon:swords]]", "攻击"));
        var suffix = kind == "guard" && round % 2 == 1 ? "（蓄势）"
            : kind == "charge" && round % 2 == 0 ? "（本回合强化）" : "";
        return new EnemyIntent { Kind = kind, Icon = meta.Item1, Label = meta.Item2 + suffix, Damage = Math.Max(0, def.Atk) };
    }

    // ---------- 端口装配 ----------
    private EffectPorts BuildPorts() => new()
    {
        GetAlive = Alive,
        GetPlayerStatus = () => _pstat,
        GetPlayerDefense = () => _pdef,
        GetMode = () => _mode,
        Log = Log,
        EscapeHtml = s => s,
        Heal = n => _game.Heal(n),
        PushFloat = value => _floats.Add(value),
        DrawCards = DrawCards,
        GrantStarterAttack = GrantSha,
        MarkNoDrawNext = () => _noDrawNext = true,
        QueueDiscover = job => { _discoverQueue.Add(job); ProcessDiscoverQueue(); },
        RandomDiscoverCard = RandomDiscoverCard,
        AddTempCard = AddTempCard,
        AddDeckCard = AddDeckCard,
        QueueHandSelect = job => { _handSelectQueue.Add(job); ProcessHandSelect(); },
        RestoreConsumed = RestoreConsumed,
        Random01 = () => _rng.NextDouble(),
        AllCards = () => _cards.All,
        ShuffleDeck = () => { Shuffle(_drawPile); return _drawPile.Count; },
        AddEnergy = amount => { _energy += amount; return _energy; },
        AddEnergyCap = amount => { _maxEnergy += amount; _energy += amount; return _maxEnergy; },
        QueueChoice = job => { _choiceQueue.Add(job); ProcessChoice(); },
        RegisterTurnStartText = (text, cardName) => _delayed.Add(new DelayedItem { Text = text, CardName = cardName, Repeat = true }),
        SetStealthStrike = v => _stealthStrike = v,
        SetNextSpellTwice = n => _nextSpellTwice = n,
        GetPlayerHp = () => _game.Hp,
        GetHandSize = () => _hand.Count,
        GetHandCards = () => _hand.Select(FindCard).Where(o => o is not null).Cast<OwnedCard>().ToList(),
        BurstPoison = t => CombatModel.TickPoison(t),
        DeckDraw = DeckDraw,
        FleeBattle = Flee,
        GetPlayerClass = () => _game.MyClass,
        GetPlayerCaster = () => new CasterRef
        {
            Atk = _game.Atk,
            SpellPower = _game.SpellPower,
            Status = _pstat.Status,
        },
        FoeIndexOf = t => _foes.IndexOf(t),
        ReleaseHandMatches = (key, drawEach, max) => ReleaseHandMatches(key, drawEach, max),
        AutoPlayHandType = AutoPlayHandType,
        SetShaTransform = name => _shaTransform = name,
        SetConsumeFireball = n => _consumeFireballN = n,
        DamagePlayer = n =>
        {
            if (n > 0 && _game.Hp - n <= 0 && _deathSave > 0)
            {
                _deathSave--;
                CombatModel.AddBlessing(_pstat, "immune", 1);
                Log($"[[icon:sparkles]] <b>致命一击被挡下！</b>（死亡保险剩余 {_deathSave} 次，本回合无敌）", "ok");
                return;
            }
            _game.Hp = Math.Max(0, _game.Hp - n);
            _floats.Add(new FloatEvent { Unit = "self", Text = "-" + n, Cls = "hurt" });
            Log($"[[icon:blood]] 受到 <b>{n}</b> 点伤害（{_game.Hp}/{_game.MaxHp}）", "warn");
        },
        AddPlayerMaxHp = n =>
        {
            _game.MaxHp += n;
            _game.Heal(n);
            Log($"[[icon:heart]] 血量上限 +{n}（当前上限 {_game.MaxHp}，并回复 {n} 点）", "ok");
        },
        DumpHand = () =>
        {
            var uids = _hand.ToList();
            _hand.Clear();
            foreach (var u in uids)
            {
                _consumed.Add(u);
                if (_mode == "boss") _grave.Add(u);
            }
            return uids.Count;
        },
        GetInfuseFuels = () => _infuseFuels,
        GetPriceOfLastDrawn = () =>
        {
            var uid = _lastDrawnUids.Count > 0 ? _lastDrawnUids[^1] : null;
            var o = uid is not null ? FindCard(uid) : null;
            return o is not null ? CardLib.SellPrice(_cards, o.Card) : 0;
        },
        DealAoeFixed = n =>
        {
            foreach (var t in Alive())
            {
                var r = CombatModel.DealDamage(new CasterRef { Atk = _game.Atk }, t, n, BattleDamageKind.Fixed);
                if (r.Dealt > 0) _floats.Add(new FloatEvent { Unit = _foes.IndexOf(t).ToString(), Text = "-" + r.Dealt, Cls = "dmg" });
            }
            SweepDead();
        },
        ReplaceShaInDeck = ReplaceShaInDeck,
        SummonAlly = SummonAlly,
        SetExtraTurn = v => _extraTurn = v,
        SetDeathSave = n => _deathSave = n,
        QueuePouchCast = QueuePouchCast,
        RegisterGrowthCard = card => { if (card?.Name.Length > 0 == true) _growthNames.Add(card.Name); },
        UnlockSeal = TryUnlockSeal,
        RandomAcquired = FireCatGift,
        HandCurseSpecs = HandCurseSpecs,
        QueueSwapCostDiscover = QueueSwapCostDiscover,
    };

    private void Log(string message, string kind) => _game.Log(message, kind);

    private void Sfx(string key) => _sfx.Add(key);

    /// <summary>取走挂起的音效请求（[7a→A] 战斗音效信号；GameAudio.PlaySfx(key) 一行接线）。</summary>
    public IReadOnlyList<string> DrainSfx()
    {
        var list = _sfx.ToList();
        _sfx.Clear();
        return list;
    }

    public IReadOnlyList<FloatEvent> DrainFloats()
    {
        var list = _floats.ToList();
        _floats.Clear();
        return list;
    }

    // ---------- 面板内部状态 ----------
    private sealed class InfuseState
    {
        public string Uid = "";
        public CardRecord Card = new();
        public int Need;
        public List<string> Picked { get; } = new();
    }

    private sealed class DiscoverState
    {
        public List<CardRecord> Options = new();
        public int N = 1;
        public Func<CardRecord, bool>? Pred;
        public string? Act;
        public bool PriceArmor;
        public string? PouchUid;
        public bool ConsumeTempAtTurn;
        public List<string> TempUids = new();
        public List<string>? SwapPair;
    }

    private sealed class HandSelectState
    {
        public int N = 1;
        public string? Type;
        public string Act = "play";
        public string ThenText = "";
        public BattleUnit? Target;
        public CardRecord? SrcCard;
    }

    private sealed class ChoiceState
    {
        public string CardName = "";
        public List<string> Options = new();
        public bool SecondDoor;
    }

    private sealed class PendingTargetState
    {
        public string Uid = "";
        public CardRecord Card = new();
    }

    private sealed class PendingItemState
    {
        public string Uid = "";
        public CardRecord Card = new();
    }

    private sealed class DelayedItem
    {
        public string Text = "";
        public string CardName = "";
        public bool Repeat;
        public int? Left;
        public int? NotBeforeTurn;
        public string? Special;
        public List<string>? Uids;
    }

    // ---------- 快照 ----------
    public BattleSnapshot Snapshot
    {
        get
        {
            var sfxPending = _sfx.ToList();
            return new BattleSnapshot
            {
                Mode = _mode,
                Turn = _turn,
                Energy = _energy,
                MaxEnergy = _maxEnergy,
                Phase = _phase.ToString().ToLowerInvariant(),
                Busy = _busy,
                Player = new BattlePlayerSnapshot
                {
                    Hp = _game.Hp, MaxHp = _game.MaxHp, Atk = _game.Atk,
                    SpellPower = _game.SpellPower, MyClass = _game.MyClass,
                },
                Pdef = new BattleDefenseSnapshot { Shield = _pdef.Shield, Armor = _pdef.Armor, Guard = _pdef.Guard },
                Pstat = new BattleStatusSnapshot
                {
                    Hp = _pstat.Hp,
                    Status = new Dictionary<string, int>(_pstat.Status ?? new Dictionary<string, int>()),
                },
                Foes = _foes.Select(f => new BattleFoeSnapshot
                {
                    Id = f.Id, Name = f.Name, Hp = f.Hp, MaxHp = f.MaxHp, Atk = f.Atk,
                    Affix = f.Affix, AffixName = f.AffixName, Behavior = f.Behavior, Dead = f.Dead,
                    Status = new Dictionary<string, int>(f.Status ?? new Dictionary<string, int>()),
                    Shield = f.Defense?.Shield ?? 0,
                    Armor = f.Defense?.Armor ?? 0,
                    Guard = f.Defense?.Guard ?? false,
                    Intent = f.Intent,
                }).ToList(),
                Allies = _allies.Select(a => new BattleAllySnapshot
                {
                    Name = a.Name, Hp = a.Hp, MaxHp = a.MaxHp, Atk = a.Atk, Dead = a.Dead,
                }).ToList(),
                Hand = _hand.ToArray(),
                DrawPile = _drawPile.ToArray(),
                Discard = _discard.ToArray(),
                Grave = _grave.ToArray(),
                Infusing = _infusing is null ? null : new BattleInfuseSnapshot
                {
                    Uid = _infusing.Uid, Need = _infusing.Need, Picked = _infusing.Picked.ToArray(),
                },
                Discovering = _discovering is null ? null : new BattleDiscoverSnapshot
                {
                    N = _discovering.N,
                    Act = _discovering.Act,
                    Options = _discovering.Options.Select(o => o.Name).ToArray(),
                },
                HandSelecting = _handSelecting is null ? null : new BattleHandSelectSnapshot
                {
                    N = _handSelecting.N, Type = _handSelecting.Type, Act = _handSelecting.Act, ThenText = _handSelecting.ThenText,
                },
                Choosing = _choosing is null ? null : new BattleChoiceSnapshot
                {
                    CardName = _choosing.CardName, Options = _choosing.Options.ToArray(),
                },
                DeckSelection = _selectingDeck ? new BattleDeckSelectSnapshot
                {
                    Need = _rules.BossDeckSize,
                    Max = _selDeckMax,
                    StarterCount = _selShaN,
                    Selected = _sel.OrderBy(s => s, StringComparer.Ordinal).ToArray(),
                    Cards = _selPool.Select(e => new BattleCardRefSnapshot(e.Uid, e.Card.Name, e.Card.Type, e.Card.Cost)).ToList(),
                    Equips = _selEquipPool.Select(e => new BattleCardRefSnapshot(e.Uid, e.Card.Name, e.Card.Type, e.Card.Cost)).ToList(),
                    EquipsSelected = _selEquips.OrderBy(s => s, StringComparer.Ordinal).ToArray(),
                } : null,
                Equipped = _equipped.Select(e => new BattleEquipSnapshot
                {
                    Uid = e.Uid, Name = e.Card?.Name ?? "?", Skill = EquipSkillText(e.Card), Used = e.Used,
                }).ToList(),
                SfxRequests = sfxPending,
                FloatsPending = _floats.Count,
            };
        }
    }
}

// ---------- 快照契约 ----------
public sealed class BattleSnapshot
{
    public string Mode { get; init; } = "normal";
    public int Turn { get; init; }
    public int Energy { get; init; }
    public int MaxEnergy { get; init; }
    public string Phase { get; init; } = "start";
    public bool Busy { get; init; }
    public BattlePlayerSnapshot? Player { get; init; }
    public BattleDefenseSnapshot? Pdef { get; init; }
    public BattleStatusSnapshot? Pstat { get; init; }
    public IReadOnlyList<BattleFoeSnapshot> Foes { get; init; } = Array.Empty<BattleFoeSnapshot>();
    public IReadOnlyList<BattleAllySnapshot> Allies { get; init; } = Array.Empty<BattleAllySnapshot>();
    public IReadOnlyList<string> Hand { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> DrawPile { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Discard { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Grave { get; init; } = Array.Empty<string>();
    public BattleInfuseSnapshot? Infusing { get; init; }
    public BattleDiscoverSnapshot? Discovering { get; init; }
    public BattleHandSelectSnapshot? HandSelecting { get; init; }
    public BattleChoiceSnapshot? Choosing { get; init; }
    public BattleDeckSelectSnapshot? DeckSelection { get; init; }
    public IReadOnlyList<BattleEquipSnapshot> Equipped { get; init; } = Array.Empty<BattleEquipSnapshot>();
    /// <summary>战斗音效信号（[7a→A]）：UI 侧逐个 GameAudio.PlaySfx(key) 后清空。</summary>
    public IReadOnlyList<string> SfxRequests { get; init; } = Array.Empty<string>();
    public int FloatsPending { get; init; }
}

public sealed class BattlePlayerSnapshot
{
    public int Hp { get; init; }
    public int MaxHp { get; init; }
    public int Atk { get; init; }
    public int SpellPower { get; init; }
    public string? MyClass { get; init; }
}

public sealed class BattleDefenseSnapshot
{
    public int Shield { get; init; }
    public int Armor { get; init; }
    public bool Guard { get; init; }
}

public sealed class BattleStatusSnapshot
{
    public int Hp { get; init; }
    public IReadOnlyDictionary<string, int> Status { get; init; } = new Dictionary<string, int>();
}

public sealed class BattleFoeSnapshot
{
    public string? Id { get; init; }
    public string Name { get; init; } = "";
    public int Hp { get; init; }
    public int MaxHp { get; init; }
    public int Atk { get; init; }
    public string? Affix { get; init; }
    public string? AffixName { get; init; }
    public string? Behavior { get; init; }
    public bool Dead { get; init; }
    public IReadOnlyDictionary<string, int> Status { get; init; } = new Dictionary<string, int>();
    public int Shield { get; init; }
    public int Armor { get; init; }
    public bool Guard { get; init; }
    public EnemyIntent? Intent { get; init; }
}

public sealed class BattleAllySnapshot
{
    public string Name { get; init; } = "";
    public int Hp { get; init; }
    public int MaxHp { get; init; }
    public int Atk { get; init; }
    public bool Dead { get; init; }
}

public sealed class BattleInfuseSnapshot
{
    public string Uid { get; init; } = "";
    public int Need { get; init; }
    public IReadOnlyList<string> Picked { get; init; } = Array.Empty<string>();
}

public sealed class BattleDiscoverSnapshot
{
    public int N { get; init; }
    public string? Act { get; init; }
    public IReadOnlyList<string> Options { get; init; } = Array.Empty<string>();
}

public sealed class BattleHandSelectSnapshot
{
    public int N { get; init; }
    public string? Type { get; init; }
    public string Act { get; init; } = "";
    public string ThenText { get; init; } = "";
}

public sealed class BattleChoiceSnapshot
{
    public string CardName { get; init; } = "";
    public IReadOnlyList<string> Options { get; init; } = Array.Empty<string>();
}

public sealed record BattleCardRefSnapshot(string Uid, string Name, string Type, int Cost);

public sealed class BattleDeckSelectSnapshot
{
    public int Need { get; init; }
    public int Max { get; init; }
    public int StarterCount { get; init; }
    public IReadOnlyList<string> Selected { get; init; } = Array.Empty<string>();
    public IReadOnlyList<BattleCardRefSnapshot> Cards { get; init; } = Array.Empty<BattleCardRefSnapshot>();
    public IReadOnlyList<BattleCardRefSnapshot> Equips { get; init; } = Array.Empty<BattleCardRefSnapshot>();
    public IReadOnlyList<string> EquipsSelected { get; init; } = Array.Empty<string>();
}

public sealed class BattleEquipSnapshot
{
    public string Uid { get; init; } = "";
    public string Name { get; init; } = "";
    public string Skill { get; init; } = "";
    public bool Used { get; init; }
}
