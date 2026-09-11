using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Soudache.Battle;

// ported from 搜打撤/game/src/combat.js —— 战斗公式：四类伤害 / 诅咒 / 祝福 / 状态计时（纯计算）。
// 伤害通道 / 叠层与计时口径 / NaN 兜底 / 潜行与免疫短路全部逐行对齐。

public enum BattleDamageKind { Attack, Spell, Fixed, True }

public static class BattleDamage
{
    public static readonly IReadOnlyDictionary<BattleDamageKind, string> TypeName =
        new Dictionary<BattleDamageKind, string>
        {
            [BattleDamageKind.Attack] = "攻击伤害",
            [BattleDamageKind.Spell] = "法术伤害",
            [BattleDamageKind.Fixed] = "固定伤害",
            [BattleDamageKind.True] = "真实伤害",
        };
}

public sealed class CurseMeta
{
    public string Key; public string Name; public bool Stack; public string Desc;
    public CurseMeta(string key, string name, bool stack, string desc) { Key = key; Name = name; Stack = stack; Desc = desc; }
}

public sealed class BuffMeta
{
    public string Key; public string Name; public bool Value; public bool Timed; public bool Flag; public string Desc;
    public BuffMeta(string key, string name, bool value, bool timed, bool flag, string desc)
    { Key = key; Name = name; Value = value; Timed = timed; Flag = flag; Desc = desc; }
}

public static class CombatModel
{
    // 诅咒状态表：bleed/poison 为叠层（无上限不衰减），其余为计时（共享回合钟）。
    // burn 灼烧：独立于中毒的计时诅咒——不叠加、每回合结束 1 点固定伤害。
    public static readonly string[] Curses = { "bleed", "poison", "freeze", "silence", "abreak", "healban", "burn" };
    public static readonly IReadOnlyDictionary<string, CurseMeta> CurseMeta = new Dictionary<string, CurseMeta>
    {
        ["bleed"] = new("bleed", "流血", true, "每层使受到的攻击伤害 +1"),
        ["poison"] = new("poison", "中毒", true, "每层在回合结束时受到 1 点固定伤害"),
        ["freeze"] = new("freeze", "冰冻", false, "1 回合无法行动"),
        ["silence"] = new("silence", "沉默", false, "1 回合技能无法生效（攻击除外）"),
        ["abreak"] = new("abreak", "破甲", false, "2 回合内无法减免伤害"),
        ["healban"] = new("healban", "禁疗", false, "2 回合内无法回复生命"),
        ["burn"] = new("burn", "灼烧", false, "每回合结束时受到 1 点固定伤害（不叠加，重复施加刷新持续时间）"),
    };

    // 祝福状态表：value=数值型（可叠加，本场战斗）；timed=计时型；flag=开关型（本局对战常驻）。
    public static readonly string[] Buffs = { "atkUp", "spellUp", "stealth", "immune", "reduce", "swordForm", "natureForm", "cosmosForm" };
    public static readonly IReadOnlyDictionary<string, BuffMeta> BuffMeta = new Dictionary<string, BuffMeta>
    {
        ["atkUp"] = new("atkUp", "攻击强化", true, false, false, "攻击伤害 +N（本场战斗）"),
        ["spellUp"] = new("spellUp", "法术强化", true, false, false, "法术伤害 +N（本场战斗）"),
        ["stealth"] = new("stealth", "潜行", false, true, false, "无法成为被攻击对象；造成伤害会破除潜行"),
        ["immune"] = new("immune", "免疫伤害", false, true, false, "不受到任何伤害"),
        ["reduce"] = new("reduce", "减伤", true, false, false, "每次受到的伤害 -N（真实伤害除外）"),
        ["swordForm"] = new("swordForm", "剑仙形态", false, false, true, "回合开始时额外抽 1 张"),
        ["natureForm"] = new("natureForm", "自然形态", false, false, true, "回合开始时额外获得 1 点能量"),
        ["cosmosForm"] = new("cosmosForm", "宇宙形态", false, false, true, "本局对战所有卡牌变为 1 费"),
    };

    /// <summary>给任意单位补齐战斗字段（玩家与敌人通用）。</summary>
    public static void EnsureStatus(BattleUnit unit)
    {
        foreach (var key in Curses) unit.Status.TryAdd(key, 0);
        foreach (var key in Buffs) unit.Status.TryAdd(key, 0);
        return;
    }

    /// <summary>卡面记号解析：'3''' → 3 点法术伤害；'3"''"' → 3 点真实伤害；无角标 type=null。</summary>
    public static (int Amount, BattleDamageKind? Type)? ParseNotation(string text)
    {
        var m = Regex.Match((text ?? "").Trim(), @"^(\d+)('')?(')?$");
        if (!m.Success) return null;
        if (m.Groups[2].Success) return (int.Parse(m.Groups[1].Value), BattleDamageKind.True);
        if (m.Groups[3].Success) return (int.Parse(m.Groups[1].Value), BattleDamageKind.Spell);
        return (int.Parse(m.Groups[1].Value), null);
    }

    /// <summary>结算一次伤害。attacker/target 为带 atk/spellPower/status/defense 的引用。</summary>
    public static BattleDamageResult DealDamage(CasterRef? attacker, BattleUnit target, int amount, BattleDamageKind type)
    {
        EnsureStatus(target);
        var r = new BattleDamageResult { Type = type, Raw = amount };
        // 免疫伤害：不受到任何伤害
        if (target.Status!.GetValueOrDefault("immune") > 0)
        {
            r.Immune = true;
            r.Log.Add("免疫伤害");
            return r;
        }
        // 潜行：无法成为被攻击对象
        if (target.Status.GetValueOrDefault("stealth") > 0)
        {
            r.Stealthed = true;
            r.Log.Add("潜行：无法成为被攻击对象");
            return r;
        }

        var dmg = amount;
        if (type == BattleDamageKind.Attack)
        {
            // 网页版：攻击力可为负修正（偷袭 -1），总伤害最低 0 由调用方按 dealt 判定
            var atk = attacker?.Atk ?? 0;
            var atkUp = attacker?.Status?.GetValueOrDefault("atkUp") ?? 0;
            var bleed = target.Status.GetValueOrDefault("bleed");
            r.AtkPart = atk;
            r.BleedBonus = bleed;
            r.Bonus = atk + bleed;
            dmg = amount + atk + bleed;
            if (atk != 0) r.Log.Add($"攻击力 +{atk}");
            if (bleed != 0) r.Log.Add($"流血 +{bleed}");
        }
        else if (type == BattleDamageKind.Spell)
        {
            var sp = (attacker?.SpellPower ?? 0) + (attacker?.Status?.GetValueOrDefault("spellUp") ?? 0);
            r.SpellPart = sp;
            r.Bonus = sp;
            dmg = amount + sp;
            if (sp != 0) r.Log.Add($"法伤加成 +{sp}");
        }

        // 破甲（abreak > 0）：格挡与护盾/护甲吸收全部失效
        var broken = target.Status.GetValueOrDefault("abreak") > 0;

        // 格挡：非真实伤害每次结算降为 1 点
        if (target.Defense!.Guard && type != BattleDamageKind.True && !broken && dmg > 1)
        {
            dmg = 1;
            r.Guarded = true;
            r.Log.Add("格挡：伤害降为 1");
        }

        // 减伤：每次受到的伤害 -N；真实伤害无视
        if (target.Status.GetValueOrDefault("reduce") > 0 && type != BattleDamageKind.True && dmg > 0)
        {
            var cut = Math.Min(target.Status.GetValueOrDefault("reduce"), dmg);
            dmg -= cut;
            r.Reduced = cut;
            r.Log.Add($"减伤 -{cut}");
        }

        if (type != BattleDamageKind.True && !broken)
        {
            var def = target.Defense;
            var useShield = Math.Min(def.Shield, dmg);
            def.Shield -= useShield; dmg -= useShield;
            var useArmor = Math.Min(def.Armor, dmg);
            def.Armor -= useArmor; dmg -= useArmor;
            r.Absorbed = useShield + useArmor;
            if (r.Absorbed > 0) r.Log.Add($"防御吸收 {r.Absorbed}");
        }
        else if (type == BattleDamageKind.True)
        {
            r.Log.Add("无视防御手段");
        }
        else
        {
            r.Log.Add("破甲：无法减免伤害");
        }

        r.Dealt = dmg;
        if (dmg > 0)
        {
            target.Hp -= dmg;
            if (target.Hp < 0) { r.Overkill = -target.Hp; target.Hp = 0; }
        }
        return r;
    }

    /// <summary>预览结算结果（不修改任何状态）。</summary>
    public static BattleDamageResult PreviewDamage(CasterRef? attacker, BattleUnit target, int amount, BattleDamageKind type)
    {
        var clone = new BattleUnit(target.Id ?? "preview", target.Name, Math.Max(1, target.Hp), target.IsEnemy)
        {
            Hp = target.Hp,
            Status = new Dictionary<string, int>(target.Status ?? new Dictionary<string, int>()),
            Defense = new BattleDefense { Shield = target.Defense?.Shield ?? 0, Armor = target.Defense?.Armor ?? 0, Guard = target.Defense?.Guard ?? false },
        };
        return DealDamage(attacker, clone, amount, type);
    }

    // —— 诅咒（设计者 2026-09-02 定版）——
    public static int AddCurse(BattleUnit target, string key, int n)
    {
        if (!CurseMeta.ContainsKey(key)) return 0;
        // 层数/回合数兜底：NaN/负值按 1 处理
        n = n > 0 ? n : 1;
        EnsureStatus(target);
        if (CurseMeta[key].Stack)
            target.Status![key] = Math.Max(0, target.Status.GetValueOrDefault(key) + n);
        else
            target.Status![key] = Math.Max(target.Status.GetValueOrDefault(key), n);
        return target.Status[key];
    }

    public static bool HasCurse(BattleUnit? target)
        => target?.Status is not null && Curses.Any(k => target.Status.GetValueOrDefault(k) > 0);

    public static List<string> Purify(BattleUnit target)
    {
        EnsureStatus(target);
        var cleared = Curses.Where(k => target.Status!.GetValueOrDefault(k) > 0).ToList();
        foreach (var k in Curses) target.Status![k] = 0;
        return cleared;
    }

    /// <summary>中毒结算：每层 1 点固定伤害（免疫可挡；层数不衰减）。</summary>
    public static BattleDamageResult? TickPoison(BattleUnit target)
    {
        EnsureStatus(target);
        var stacks = target.Status!.GetValueOrDefault("poison");
        if (stacks <= 0) return null;
        if (target.Status.GetValueOrDefault("immune") > 0)
            return new BattleDamageResult { PoisonStacks = stacks, Dealt = 0, Immune = true, Log = { "免疫伤害" } };
        var r = new BattleDamageResult { PoisonStacks = stacks, Dealt = stacks };
        target.Hp -= stacks;
        if (target.Hp < 0) { r.Overkill = -target.Hp; target.Hp = 0; }
        return r;
    }

    /// <summary>灼烧结算：每回合结束 1 点固定伤害（免疫可挡）。</summary>
    public static BattleDamageResult? TickBurn(BattleUnit target)
    {
        EnsureStatus(target);
        var turns = target.Status!.GetValueOrDefault("burn");
        if (turns <= 0) return null;
        if (target.Status.GetValueOrDefault("immune") > 0)
            return new BattleDamageResult { BurnTurns = turns, Dealt = 0, Immune = true, Log = { "免疫伤害" } };
        var r = new BattleDamageResult { BurnTurns = turns, Dealt = 1 };
        target.Hp -= 1;
        if (target.Hp < 0) { r.Overkill = -target.Hp; target.Hp = 0; }
        return r;
    }

    /// <summary>计时状态递减（共享回合钟，每回合结束调用一次），返回到点解除的键。</summary>
    public static List<string> TickDurations(BattleUnit? target)
    {
        if (target?.Status is null) return new List<string>();
        var expired = new List<string>();
        var timedKeys = Curses.Where(k => !CurseMeta[k].Stack)
            .Concat(Buffs.Where(k => BuffMeta[k].Timed));
        foreach (var k in timedKeys)
        {
            if (target.Status.GetValueOrDefault(k) > 0)
            {
                target.Status[k]--;
                if (target.Status[k] == 0) expired.Add(k);
            }
        }
        if (target.TimedBuffs is { Count: > 0 })
        {
            var keep = new List<TimedBuff>();
            foreach (var rec in target.TimedBuffs)
            {
                rec.Turns -= 1;
                if (rec.Turns <= 0)
                {
                    target.Status[rec.Key] = Math.Max(0, target.Status.GetValueOrDefault(rec.Key) - rec.Amount);
                    expired.Add(rec.Key);
                }
                else keep.Add(rec);
            }
            target.TimedBuffs = keep.Count > 0 ? keep : null;
        }
        return expired;
    }

    public static bool CanAct(BattleUnit? target) => !((target?.Status?.GetValueOrDefault("freeze") ?? 0) > 0);

    // —— 祝福：value 型加数值；timed 型取较大值；flag 型置 1；turns>0 时 value 型 N 回合后自动扣除 ——
    public static int AddBlessing(BattleUnit target, string key, int n = 1, int turns = 0)
    {
        if (!BuffMeta.ContainsKey(key)) return 0;
        EnsureStatus(target);
        var m = BuffMeta[key];
        if (m.Value)
        {
            target.Status![key] = Math.Max(0, target.Status.GetValueOrDefault(key) + n);
            if (turns > 0)
            {
                target.TimedBuffs ??= new List<TimedBuff>();
                var rec = target.TimedBuffs.FirstOrDefault(r => r.Key == key);
                if (rec is not null) { rec.Amount += n; rec.Turns = Math.Max(rec.Turns, turns); }
                else target.TimedBuffs.Add(new TimedBuff { Key = key, Amount = n, Turns = turns });
            }
        }
        else if (m.Timed) target.Status![key] = Math.Max(target.Status.GetValueOrDefault(key), n);
        else target.Status![key] = 1;
        return target.Status[key];
    }

    public static bool IsStealthed(BattleUnit? target) => (target?.Status?.GetValueOrDefault("stealth") ?? 0) > 0;

    public static bool BreakStealth(BattleUnit target)
    {
        if (!IsStealthed(target)) return false;
        target.Status!["stealth"] = 0;
        return true;
    }
}

/// <summary>攻击方引用（网页版传裸对象 {atk, spellPower, status} 的等价物）。</summary>
public sealed class CasterRef
{
    public int Atk { get; init; }
    public int SpellPower { get; init; }
    public IReadOnlyDictionary<string, int>? Status { get; init; }
}

public sealed class BattleDefense
{
    public int Shield { get; set; }
    public int Armor { get; set; }
    public bool Guard { get; set; }

    public BattleDefense Clone() => new() { Shield = Shield, Armor = Armor, Guard = Guard };
}

public sealed class TimedBuff
{
    public string Key = "";
    public int Amount;
    public int Turns;
}

/// <summary>战斗单位（敌人 / 玩家状态载体 / 随从通用）。</summary>
public sealed class BattleUnit
{
    public string? Id { get; set; }
    public string Name { get; set; }
    public int Hp { get; set; }
    public int MaxHp { get; set; }
    public int Atk { get; set; }
    public int SpellPower { get; set; }
    public bool IsEnemy { get; set; }
    public bool Dead { get; set; }
    public string? Affix { get; set; }
    public string? AffixName { get; set; }
    public string? Behavior { get; set; }
    public Dictionary<string, int> Status { get; set; } = new();
    public BattleDefense Defense { get; set; } = new();
    public List<TimedBuff>? TimedBuffs { get; set; }
    /// <summary>偷取攻击到期还原量（battle.core _stealRestore）。</summary>
    public int StealRestore { get; set; }
    /// <summary>敌方意图（intentFor 产物）。</summary>
    public EnemyIntent? Intent { get; set; }

    public BattleUnit(string? id, string name, int hp, bool isEnemy)
    {
        Id = id; Name = name; Hp = hp; MaxHp = hp; IsEnemy = isEnemy;
    }
}

public sealed class EnemyIntent
{
    public string Kind { get; init; } = "strike";
    public string Icon { get; init; } = "";
    public string Label { get; init; } = "";
    public int Damage { get; init; }
}

public sealed class BattleDamageResult
{
    public BattleDamageKind Type { get; set; }
    public int Raw { get; set; }
    public int Bonus { get; set; }
    public int AtkPart { get; set; }
    public int SpellPart { get; set; }
    public int BleedBonus { get; set; }
    public int Absorbed { get; set; }
    public int Dealt { get; set; }
    public int Overkill { get; set; }
    public int Reduced { get; set; }
    public int PoisonStacks { get; set; }
    public int BurnTurns { get; set; }
    public bool Immune { get; set; }
    public bool Stealthed { get; set; }
    public bool Guarded { get; set; }
    public List<string> Log { get; } = new();
}
