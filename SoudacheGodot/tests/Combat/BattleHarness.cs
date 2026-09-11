using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Soudache;
using Soudache.Battle;

// ported from 搜打撤/tests/battle-all-cards.test.js（假对局环境 makeGame/drain/observe/playInBattle）。
// BattleEngine 是同步引擎：网页版用异步动作队列 + drain() 轮询的地方，这里退化为
// 「面板自动点选循环」——反复关闭发现/抉择/手选面板直到回到空闲。

internal sealed class TestGame : IBattleGame
{
    private int _uidSeq;
    public List<OwnedCard> Owned { get; }
    public IList<OwnedCard> OwnedCards => Owned;
    public int Hp;
    public int MaxHp;
    public int Atk;
    public int SpellPower;
    public int Coins;
    public string? MyClass = "侠客";
    public List<string> Logs { get; } = new();
    public BattleEndInfo? LastEnd;

    int IBattleGame.Hp { get => Hp; set => Hp = value; }
    int IBattleGame.MaxHp { get => MaxHp; set => MaxHp = value; }
    int IBattleGame.Atk { get => Atk; set => Atk = value; }
    int IBattleGame.SpellPower { get => SpellPower; set => SpellPower = value; }
    int IBattleGame.Coins { get => Coins; set => Coins = value; }
    string? IBattleGame.MyClass => MyClass;

    public TestGame(IEnumerable<CardRecord> cards, int hp = 99999, int atk = 5, int spellPower = 2)
    {
        Owned = cards.Select(c => new OwnedCard { Uid = "g" + (_uidSeq++), Card = c }).ToList();
        Hp = hp;
        MaxHp = 99999;
        Atk = atk;
        SpellPower = spellPower;
    }

    public void Log(string message, string kind) => Logs.Add(Regex.Replace(message, @"\[\[[^\]]+\]\]", ""));

    public void Heal(int amount) => Hp = Math.Min(MaxHp, Hp + amount);

    public void AddItem(string itemKey, int amount) { }

    public void OnBattleEnd(BattleEndInfo info) => LastEnd = info;
}

/// <summary>共享的战斗测试 harness（8 单卡回归 + 全卡审计同口径）。</summary>
internal static class BattleHarness
{
    /// <summary>审计口径规则（与网页版 battle-all-cards.test.js 的 MAP.rules 相同）。</summary>
    public static readonly BattleRulesTable AuditRules = new()
    {
        BattleEnergy = 99, BattleHandMax = 99, BossDeckSize = 1, StarterSha = 0,
        BattleStartDraw = 5, BattleTurnDraw = 2,
    };

    public static readonly FoeDef Foe = new() { Id = "infantry", Name = "审计靶子", Hp = 99999, Atk = 1 };

    public static BattleEngine Start(TestGame game, IReadOnlyList<FoeDef>? foes = null, CardLib? cards = null, BattleRulesTable? rules = null)
        => new(game, foes ?? new[] { Foe }, new BattleOptions { Name = "测试" }, cards ?? SharedCards(), rules ?? AuditRules);

    public static BattleEngine StartBoss(TestGame game, int bossDeckSize = 1, CardLib? cards = null, BattleRulesTable? rules = null)
        => new(game, new[] { Foe }, new BattleOptions { IsBoss = true, Name = "BOSS测试" }, cards ?? SharedCards(),
            rules ?? (AuditRules with { BossDeckSize = bossDeckSize }));

    private static CardLib? _cards;

    /// <summary>进程级共享卡库（ensureDmgTypes/ensureEffectFields 已在 FromJson 内应用）。</summary>
    public static CardLib SharedCards() => _cards ??= CardLib.LoadDefault();

    public static BattleSnapshot Snap(BattleEngine engine) => engine.Snapshot;

    /// <summary>关掉发现/抉择/手选面板（都选第 0 项/跳过），直到空闲。</summary>
    public static BattleSnapshot Drain(BattleEngine engine, int maxLoops = 300, bool pickChoice = true)
    {
        for (var i = 0; i < maxLoops; i++)
        {
            var s = engine.Snapshot;
            if (s.Discovering is not null) { engine.PickDiscover(0); continue; }
            if (s.Choosing is not null) { if (pickChoice) { engine.PickChoice(0); continue; } if (!s.Busy) return s; continue; }
            if (s.HandSelecting is not null) { engine.SkipHandSelect(); continue; }
            if (!s.Busy) return engine.Snapshot;
        }
        return engine.Snapshot;
    }

    /// <summary>出牌前后各拍一次状态指纹（含飘字消费），指纹不变 = 零可观测效果。</summary>
    public static string Observe(TestGame game, BattleEngine engine)
    {
        var floats = engine.DrainFloats().Count;
        var s = engine.Snapshot;
        return string.Join("|", new[]
        {
            "[" + string.Join(",", s.Foes.Select(f => $"{f.Name},{f.Hp},{f.Dead},{StatusSig(f.Status)}")) + "]",
            s.Energy.ToString(),
            "[" + string.Join(",", s.Hand.OrderBy(x => x, StringComparer.Ordinal)) + "]",
            s.DrawPile.Count.ToString(), s.Discard.Count.ToString(), s.Grave.Count.ToString(),
            "[" + string.Join(",", s.Allies.Select(a => $"{a.Name},{a.Hp}")) + "]",
            s.Pdef is null ? "" : $"{s.Pdef.Shield},{s.Pdef.Armor},{s.Pdef.Guard}",
            s.Pstat is null ? "" : $"{s.Pstat.Hp},{StatusSig(s.Pstat.Status)}",
            game.Owned.Count.ToString(),
            floats.ToString(),
        });
    }

    private static string StatusSig(IReadOnlyDictionary<string, int> status)
        => string.Join(";", CombatModel.Curses.Concat(CombatModel.Buffs).Select(k => $"{k}:{status.GetValueOrDefault(k)}"));

    /// <summary>注能燃料：同名一叠只能选一张（toggle 语义），补满后确认。</summary>
    public static void SettleInfusion(BattleEngine engine)
    {
        for (var i = 0; i < 30; i++)
        {
            var s = engine.Snapshot;
            if (s.Infusing is null) return;
            if (s.Infusing.Picked.Count >= s.Infusing.Need) break;
            var target = s.Hand.FirstOrDefault(u => u != s.Infusing.Uid && !s.Infusing.Picked.Contains(u));
            if (target is null) break;
            var before = s.Infusing.Picked.Count;
            engine.SelectInfusion(target);
            s = engine.Snapshot;
            if (s.Infusing is null) return;
            if (s.Infusing.Picked.Count == before) engine.SelectInfusion(target);   // toggle 被撤销时再补一次
        }
        var snap = engine.Snapshot;
        if (snap.Infusing is not null && snap.Infusing.Picked.Count >= snap.Infusing.Need) engine.ConfirmInfuse();
        Drain(engine);
    }

    /// <summary>在已开打的战斗里把一张手牌真正打出（含注能、面板自动点选）。</summary>
    public static (string Before, string After, BattleSnapshot End) PlayInBattle(TestGame game, BattleEngine engine, string uid, CardRecord card)
    {
        engine.DrainFloats();
        var before = Observe(game, engine);
        engine.Play(uid, SideFor(engine, card));
        if (engine.Snapshot.Infusing is not null) SettleInfusion(engine);
        var end = Drain(engine);
        return (before, Observe(game, engine), end);
    }

    /// <summary>目标规则 → 审计侧 side 参数（enemy=0 / self='self' / null=直接打出）。</summary>
    public static object? SideFor(BattleEngine engine, CardRecord card) => engine.TargetSide(card) switch
    {
        "enemy" => 0,
        "self" => "self",
        _ => null,
    };

    /// <summary>分类管线（网页版 classify）：A 手牌 / B 牌库类（BOSS 专） / C 道具 / D 开战被动 / E 排除。</summary>
    public static string Classify(CardRecord card)
    {
        var desc = card.Desc ?? "";
        if (card.Type is "资源" or "事件" or "生物") return "excluded";
        if (card.Type == "道具") return "item";
        if (card.Type == "装备" && Regex.IsMatch(desc, "对战开始时")) return "passive";
        var normalBlocked = BattleRules.UnplayableReasonFor(card, "normal") is not null;
        var bossBlocked = BattleRules.UnplayableReasonFor(card, "boss") is not null;
        if (normalBlocked && !bossBlocked) return "bossOnly";
        return "hand";
    }

    public static string? PlayByName(TestGame game, BattleEngine engine, string name)
    {
        // 网页版 playByName 只按 ownedCards 查卡（不要求在手牌——重放语义与 vitest 同口径）
        var entry = game.Owned.FirstOrDefault(o => o.Card.Name == name);
        if (entry is null) return null;
        engine.Play(entry.Uid, SideFor(engine, entry.Card));
        if (engine.Snapshot.Infusing is not null) SettleInfusion(engine);
        Drain(engine);
        return entry.Uid;
    }
}
