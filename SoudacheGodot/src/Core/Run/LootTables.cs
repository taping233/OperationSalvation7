using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

// ported from src/cards.js（pickOfRarity / randomDropCard / isRandomObtainable / SHOP_WEIGHTS）
// + src/chests.js（classChestChance / 宠物蛋 0.7% / 保底）。
// 商店与宝箱共用同一套掉落权重：稀有度先掷档（古朴60/稀有28/史诗9/传说3，与宝箱爆率同源），
// 同稀有度内类型均分、道具 ×0.7、装备 ×0.8；初始/职业/衍生/棱彩稀有度与能力卡/生物类型
// 以及 unrandom 卡一律不进随机池（isRandomObtainable）。
public static class LootTables
{
    /// <summary>道具类爆率下调（cards.js DROP_ITEM_DISCOUNT）。</summary>
    public const double ItemDiscount = 0.7;
    /// <summary>装备类爆率下调 20%（cards.js DROP_EQUIP_DISCOUNT，2026-09-09 需求 #12，未入导出契约）。</summary>
    public const double EquipDiscount = 0.8;
    /// <summary>精英突袭玩法高稀有度权重 ×1.2（cards.js randomDropCard 的 mode='elite'；当前无该模式，恒 false）。</summary>
    public const double EliteRarityBoost = 1.2;
    /// <summary>职业宝箱概率（chests.js classChestChance 基础 0.25；猎鹰宝宝 0.35 归批次 5 宠物）。</summary>
    public const double ClassChestChance = 0.25;
    /// <summary>宠物蛋固定爆率（chests.js：0.7%，不占随机卡池；孵化系统归批次 5）。</summary>
    public const double PetEggChance = 0.007;
    public const string PetEggId = "pet-egg";

    /// <summary>cards.js isRandomObtainable：初始/职业/衍生/棱彩稀有度、能力卡/生物类型、unrandom 排除。</summary>
    public static bool IsRandomObtainable(RunCard card, GameData data)
    {
        ArgumentNullException.ThrowIfNull(card);
        if (card.Rarity is "初始" or "职业" or "衍生" or "棱彩") return false;
        if (card.Type is "能力卡" or "生物") return false;
        return !card.Unrandom;
    }

    /// <summary>宝箱/商店只会开出的五类（cards.js DROP_TYPES）。</summary>
    public static bool IsDropType(RunCard card, GameData data) => data.CardDropTypes.Contains(card.Type);

    /// <summary>
    /// cards.js pickOfRarity：同稀有度内挑 1 张可随机获取的卡——类型均分、道具 ×0.7、装备 ×0.8，
    /// taken = 已开出的卡 id 集合（同一宝箱内尽量不重复）；档内无可用卡返回 null。
    /// </summary>
    public static RunCard? PickOfRarity(string rarity, IReadOnlyList<RunCard> pool, GameData data,
        DeterministicRng rng, ISet<string>? taken = null)
    {
        ArgumentNullException.ThrowIfNull(pool);
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(rng);
        var candidates = new List<(RunCard Card, double Weight)>();
        foreach (var card in pool)
        {
            if (card.Rarity != rarity || !IsDropType(card, data) || !IsRandomObtainable(card, data)) continue;
            if (taken is not null && taken.Contains(card.Id)) continue;
            var weight = data.CardDropDiscountTypes.Contains(card.Type) ? ItemDiscount
                : card.Type == "装备" ? EquipDiscount : 1.0;
            candidates.Add((card, weight));
        }
        if (candidates.Count == 0) return null;
        var total = candidates.Sum(entry => entry.Weight);
        var roll = rng.NextDouble() * total;
        foreach (var (card, weight) in candidates)
        {
            roll -= weight;
            if (roll <= 0) return card;
        }
        return candidates[^1].Card;
    }

    /// <summary>
    /// cards.js randomDropCard：先按稀有度掷档（60:28:9:3，不受卡库各稀有度卡牌数量影响），
    /// 再调 pickOfRarity 档内挑卡；该档无可用卡则重掷（50 次上限），全部失败返回 null。
    /// </summary>
    public static RunCard? RandomDropCard(IReadOnlyList<RunCard> pool, GameData data, DeterministicRng rng,
        ISet<string>? taken = null, bool eliteMode = false)
    {
        ArgumentNullException.ThrowIfNull(pool);
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(rng);
        var entries = data.CardDropWeights
            .Select(kv => (kv.Key, eliteMode && kv.Key != "古朴" ? kv.Value * EliteRarityBoost : (double)kv.Value))
            .ToArray();
        var totalWeight = entries.Sum(entry => entry.Item2);
        if (totalWeight <= 0) return null;
        for (var tries = 0; tries < 50; tries++)
        {
            var roll = rng.NextDouble() * totalWeight;
            var rarity = entries[0].Key;
            foreach (var (name, weight) in entries)
            {
                roll -= weight;
                if (roll <= 0) { rarity = name; break; }
            }
            var card = PickOfRarity(rarity, pool, data, rng, taken);
            if (card is not null) return card;
        }
        return null;
    }
}
