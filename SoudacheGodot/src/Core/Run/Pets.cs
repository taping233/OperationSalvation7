using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

// ported from src/base.js:26-39/255-393（宠物系统，2026-09-09 需求 #2/#4/#14）
// + game/data/pets.json（2026-09-11 架构批次 2 外置）+ src/game.session.js:506-530/605-613
// （携带效果 grantStarterSha/maxHp）+ src/chests.js:82-86（classChestChance）
// + src/game.run.shop.js:39-46（招财猫首格免费）。
// 数值真源 = data/pets.json（eggId/hatchCost/levelMax/upCosts/list[].effect），不在代码写死。

/// <summary>宠物携带效果（base.js 注释：携带该宠物时生效）。</summary>
public sealed record PetEffect(
    int MaxHp = 0,
    double ClassChest = 0,
    bool ShopFree = false,
    int ExtraSha = 0,
    bool ShaToFireball = false,
    int SafeBonus = 0);

/// <summary>一只宠物的静态定义（pets.json list 条目）。</summary>
public sealed record PetDef(string Id, string Name, string Icon, string Desc, PetEffect Effect);

/// <summary>pets.json 顶层契约：eggId/hatchCost/levelMax/upCosts + 六只宠物。</summary>
public sealed record PetTableSpec(
    string EggId, int HatchCost, int LevelMax, IReadOnlyList<int> UpCosts, IReadOnlyList<PetDef> List)
{
    public static readonly PetTableSpec Empty = new("pet-egg", 50, 5,
        new[] { 2, 3, 4, 5 }, Array.Empty<PetDef>());
}

/// <summary>已拥有宠物的存档态（base.js：data.pets[id] = { lv, ts }）。</summary>
public sealed record PetSave(int Lv, long Ts);

/// <summary>孵化结果（base.js hatchPet 返回 {ok,why} / {ok,pet}）。</summary>
public sealed record HatchResult(bool Ok, string Why = "", PetDef? Pet = null)
{
    public static readonly HatchResult NoEgg = new(false, "noegg");
    public static readonly HatchResult Poor = new(false, "poor");
    public static readonly HatchResult AllOwned = new(false, "all");
}

/// <summary>宠物无状态工具（等级/费用/容量的纯函数）。状态与消耗在 RunBaseState 上。</summary>
public static class PetSystem
{
    /// <summary>宠物等级（base.js petLevel：1..levelMax 夹取，非法值视为 1）。</summary>
    public static int Level(PetTableSpec spec, int lv) => Math.Max(1, Math.Min(spec.LevelMax, lv <= 0 ? 1 : lv));

    public static PetDef? Def(PetTableSpec spec, string? id) =>
        id is null ? null : spec.List.FirstOrDefault(pet => pet.Id == id);

    /// <summary>升级到下一级所需口粮（base.js petUpCost：upCosts[level-1]，递增 2-3-4-5）。
    /// 满级返回 0（网页同公式在 Lv.5 取 undefined，靠调用方 canUpgradePet 守卫；C# 显式夹取）。</summary>
    public static int UpgradeCost(PetTableSpec spec, int currentLevel)
    {
        if (spec.UpCosts.Count == 0 || Level(spec, currentLevel) >= spec.LevelMax) return 0;
        return spec.UpCosts[Math.Min(Level(spec, currentLevel), spec.LevelMax) - 1];
    }

    /// <summary>安全格容量（base.js:259-264 safeCap）：min(safeMax, safeStart + 携带宠等级 − 1) + safeBonus。
    /// 加成在夹取之后累加——小企鹅咕嘎 Lv.5 = 4-8 格（超出 safeMax 是网页原语义）。</summary>
    public static int SafeCapacity(PetTableSpec spec, string? carriedId, int carriedLevel)
    {
        var def = Def(spec, carriedId);
        var level = def is null ? 1 : Level(spec, carriedLevel);
        var bonus = def?.Effect.SafeBonus ?? 0;
        return Math.Min(RunRules.SafeMax, RunRules.SafeStart + level - 1) + bonus;
    }
}
