using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

// ported from src/meta.js:7-9/45-60/97-212（成就与职业收藏室系统，2026-09-09）
// + src/base.js:463-474（collectToggle 收藏切换）+ game/data/achievements.json。
// 收藏池 = 在册职业卡（rarity=职业 且归属五职业）+ 能力卡（type=能力卡 且有归属）；
// 职业整合时退役的旧职业卡（已去 cls）与能力卡的衍生牌不入池、不计进度。
// 卡牌数据缺失 cls 的（旧存档恢复）不入池。

/// <summary>局外成长数值（meta.js LEVEL_MAX/xpForNext：约 10 次通关满级，每级 +1 生命上限）。</summary>
public static class MetaRules
{
    /// <summary>职业熟练度上限（meta.js LEVEL_MAX=10）。</summary>
    public const int ClassLevelMax = 10;
    /// <summary>收藏转化经验：职业卡 +10（meta.js onCollect）。</summary>
    public const int CollectXpClassCard = 10;
    /// <summary>收藏转化经验：能力卡 +50（meta.js onCollect）。</summary>
    public const int CollectXpAbilityCard = 50;

    /// <summary>升到 lv+1 所需经验（meta.js xpForNext = 50 + (lv-1)*40）。</summary>
    public static int XpForNext(int lv) => 50 + (Math.Max(1, lv) - 1) * 40;
}

/// <summary>职业熟练度存档态（base.js/classes.js：{ lv, xp }；lv 从 1 起）。</summary>
public sealed record ClassProgress(int Lv, int Xp)
{
    public static readonly ClassProgress Fresh = new(1, 0);
}

/// <summary>收藏经验结算结果（meta.js onCollect 返回 {cls, amount, ups}；未转化时各字段为空/0）。</summary>
public sealed record CollectXpResult(bool Converted, string? Cls = null, int Amount = 0, int Ups = 0);

/// <summary>收藏里程碑领奖结果（meta.js claimColl 返回 {ok} / {ok:false,why:'full'}）。</summary>
public sealed record MilestoneClaimResult(bool Ok, string Why = "", string Message = "");

/// <summary>职业收藏室纯逻辑（输入基地存档态 + 卡牌目录，输出转化/进度/领奖）。</summary>
public static class CollectionRoom
{
    /// <summary>meta.js isCollectible：归属在册职业 且（稀有度=职业 或 类型=能力卡）。</summary>
    public static bool IsCollectible(RunCard card, IReadOnlyList<string> classes) =>
        card is not null && card.Cls is not null && classes.Contains(card.Cls) &&
        (card.Rarity == "职业" || card.Type == "能力卡");

    /// <summary>meta.js collectPool：收藏池（保持目录顺序，进度=「不同」张数）。</summary>
    public static IReadOnlyList<RunCard> Pool(IReadOnlyList<RunCard> catalog, IReadOnlyList<string> classes) =>
        catalog.Where(card => IsCollectible(card, classes)).ToList();

    /// <summary>meta.js collProgress：图鉴中「不同」的收藏池卡张数。</summary>
    public static int Progress(RunBaseState state, IReadOnlyList<RunCard> pool) =>
        pool.Count(card => state.Collection.Contains(card.Id));

    /// <summary>meta.js collMsNeed：need='all' 时=全收集张数，否则为定值。</summary>
    public static int MilestoneNeed(CollectionMilestoneData milestone, int total) =>
        milestone.Need == "all" ? total : milestone.NeedInt;

    /// <summary>meta.js collMsReached。</summary>
    public static bool MilestoneReached(CollectionMilestoneData milestone, RunBaseState state,
        IReadOnlyList<RunCard> pool) => Progress(state, pool) >= MilestoneNeed(milestone, pool.Count);

    /// <summary>meta.js pendingColl：已达成未领取的里程碑。</summary>
    public static IReadOnlyList<CollectionMilestoneData> PendingMilestones(
        IReadOnlyList<CollectionMilestoneData> milestones, RunBaseState state, IReadOnlyList<RunCard> pool) =>
        milestones.Where(m => !state.CollClaimed.Contains(m.Id) && MilestoneReached(m, state, pool)).ToList();

    /// <summary>meta.js collectToggle：切换收藏记录；返回本次是否变为「已收藏」。</summary>
    public static bool Toggle(RunBaseState state, RunCard card)
    {
        ArgumentNullException.ThrowIfNull(state);
        ArgumentNullException.ThrowIfNull(card);
        if (state.Collection.Add(card.Id)) return true;
        state.Collection.Remove(card.Id);
        return false;
    }

    /// <summary>
    /// meta.js onCollect（169-185）：收藏经验结算——职业卡 +10 / 能力卡 +50 对应人物熟练度。
    /// 同一张卡只结算一次（collXp 落档）：取消收藏不退还、重新收藏不重复发放。
    /// </summary>
    public static CollectXpResult OnCollect(RunBaseState state, RunCard card, bool nowCollected,
        IReadOnlyList<string> classes)
    {
        ArgumentNullException.ThrowIfNull(state);
        ArgumentNullException.ThrowIfNull(card);
        if (!nowCollected || !IsCollectible(card, classes)) return new(false);
        if (!state.CollXp.Add(card.Id)) return new(false);
        var amount = card.Type == "能力卡" ? MetaRules.CollectXpAbilityCard : MetaRules.CollectXpClassCard;
        var ups = AddClassXp(state, card.Cls!, amount);
        return new(true, card.Cls, amount, ups);
    }

    /// <summary>meta.js addXP（45-60）：加经验并连升，返回升级次数；满级（Lv.10）后不再累计。</summary>
    public static int AddClassXp(RunBaseState state, string cls, int amount)
    {
        if (string.IsNullOrEmpty(cls) || amount <= 0) return 0;
        var progress = state.Classes.TryGetValue(cls, out var existing) ? existing : ClassProgress.Fresh;
        if (progress.Lv >= MetaRules.ClassLevelMax) return 0;
        var lv = progress.Lv;
        var xp = progress.Xp + amount;
        var ups = 0;
        while (lv < MetaRules.ClassLevelMax && xp >= MetaRules.XpForNext(lv))
        {
            xp -= MetaRules.XpForNext(lv);
            lv++;
            ups++;
        }
        state.Classes[cls] = new(lv, xp);
        return ups;
    }

    /// <summary>
    /// meta.js claimColl（135-167）：领取收藏里程碑奖励（每个一次性）。
    /// 传说卡与「员工通行证」同池：稀有度传说且可随机获得，去重后随机取；
    /// 宠物蛋 = 蛋卡入仓库。卡牌奖励入库前检查仓库容量，不足则整批缓发。
    /// </summary>
    public static MilestoneClaimResult Claim(RunBaseState state, CollectionMilestoneData milestone,
        IReadOnlyList<RunCard> catalog, PetTableSpec pets, GameData data, Func<double> random)
    {
        ArgumentNullException.ThrowIfNull(state);
        ArgumentNullException.ThrowIfNull(milestone);
        ArgumentNullException.ThrowIfNull(catalog);
        ArgumentNullException.ThrowIfNull(pets);
        ArgumentNullException.ThrowIfNull(data);
        ArgumentNullException.ThrowIfNull(random);
        if (state.CollClaimed.Contains(milestone.Id)) return new(false, "claimed");
        var pool = Pool(catalog, data.CardClasses.ToList());
        if (!MilestoneReached(milestone, state, pool)) return new(false, "locked");
        var cards = new List<RunCardStack>();
        if (milestone.Reward.Legend > 0)
        {
            var legends = catalog.Where(card => card.Rarity == "传说" && LootTables.IsRandomObtainable(card, data)).ToList();
            var taken = new HashSet<string>(StringComparer.Ordinal);
            for (var k = 0; k < milestone.Reward.Legend; k++)
            {
                var free = legends.Where(card => !taken.Contains(card.Id)).ToList();
                if (free.Count == 0) break;
                var got = free[(int)(random() * free.Count)];
                taken.Add(got.Id);
                cards.Add(new RunCardStack(got, 1));
            }
        }
        if (milestone.Reward.Egg > 0)
        {
            var egg = catalog.FirstOrDefault(card => card.Id == pets.EggId);
            if (egg is not null) cards.Add(new RunCardStack(egg, 1));
        }
        var needed = cards.Sum(card => card.Count);
        if (needed > 0 && state.StashRoom < needed) return new(false, "full", "仓库容量不足——先卖出或扩建卡牌仓库再来领取");
        state.CollClaimed.Add(milestone.Id);
        if (milestone.Reward.Wood > 0) state.AddResources(wood: milestone.Reward.Wood);
        if (milestone.Reward.Rations > 0) state.AddResources(rations: milestone.Reward.Rations);
        if (milestone.Reward.Keys > 0) state.AddResources(keys: milestone.Reward.Keys);
        if (cards.Count > 0) state.DepositCards(cards);
        return new(true, "", $"领取职业收藏奖励【收藏 {MilestoneNeed(milestone, pool.Count)} 张】");
    }
}
