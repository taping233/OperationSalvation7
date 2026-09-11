using System;
using System.Collections.Generic;
using System.Linq;
using Soudache;

namespace SoudacheGodot.App;

/// <summary>
/// 批次 8-prep 接口 [6b'→A]：RunUiSnapshot 基地/制作坊明细行的纯组装逻辑。
/// 不依赖 Godot（CoreGameAdapter 调用、tests/Core 直接断言），只做「Core 数据 → 快照 DTO」的字段映射。
/// </summary>
public static class CoreUiSnapshots
{
    /// <summary>制作坊材料行关心的令牌卡 id（员工通行证B / 员工通行证A / 彩色令牌，cards.json 数据 id）。</summary>
    public static readonly string[] TokenCardIds = { "tt-token-gold", "tt-token-color", "cmtmvq6ss84l" };

    /// <summary>
    /// 令牌栈计数（接口需求 [6b'→A] #2）：只收 TokenCardIds 中的卡，同 id 计数。
    /// 输入口径随上下文：无局传基地仓库栈（state.Stash）、有局传随身背包栈（run.OwnedCards）。
    /// </summary>
    public static IReadOnlyDictionary<string, int> TokenCounts(IEnumerable<RunCardStack> stacks)
    {
        ArgumentNullException.ThrowIfNull(stacks);
        var result = new Dictionary<string, int>();
        foreach (var stack in stacks)
            if (TokenCardIds.Contains(stack.Card.Id, StringComparer.Ordinal))
                result[stack.Card.Id] = stack.Count;
        return result;
    }

    /// <summary>
    /// 仓库明细行（接口需求 [6b'→A] #3，对应网页 hubStashHTML stash-row）：
    /// 名/数量/cost/type/rarity/cls/收购价/isSellable/收藏态/材料种类，保持仓库栈顺序。
    /// costOf = 卡 id → 费用（adapter 侧用 CardCatalog；目录缺失=0）。
    /// </summary>
    public static StashItemUiSnapshot[] StashRows(IEnumerable<RunCardStack> stash, IReadOnlySet<string> collected, Func<string, int> costOf)
    {
        ArgumentNullException.ThrowIfNull(stash);
        ArgumentNullException.ThrowIfNull(collected);
        ArgumentNullException.ThrowIfNull(costOf);
        return stash.Select(stack => new StashItemUiSnapshot
        {
            CardId = stack.Card.Id,
            Name = stack.Card.Name,
            Count = stack.Count,
            Cost = costOf(stack.Card.Id),
            Type = stack.Card.Type,
            Rarity = stack.Card.Rarity,
            Cls = stack.Card.Cls,
            SellPrice = Math.Max(1, stack.Card.SellPrice),
            Sellable = stack.Card.Sellable,
            Collected = collected.Contains(stack.Card.Id),
            MaterialKind = stack.Card.MaterialKind
        }).ToArray();
    }

    /// <summary>消耗口袋明细行（接口需求 [6b'→A] #3，对应网页 pocket 行；PocketKeyCost=稀有度价×张数）。</summary>
    public static PocketItemUiSnapshot[] PocketRows(IEnumerable<RunCardStack> pocket)
    {
        ArgumentNullException.ThrowIfNull(pocket);
        return pocket.Select(stack => new PocketItemUiSnapshot
        {
            CardId = stack.Card.Id,
            Name = stack.Card.Name,
            Count = stack.Count,
            Rarity = stack.Card.Rarity,
            PocketKeyCost = RunBaseState.PocketKeyCost(stack)
        }).ToArray();
    }

    /// <summary>图鉴收藏态全集（base.js isCollected=data.collection 全量口径；排序输出保证跨快照稳定）。</summary>
    public static string[] CollectedIds(IReadOnlySet<string> collection)
    {
        ArgumentNullException.ThrowIfNull(collection);
        return collection.OrderBy(id => id, StringComparer.Ordinal).ToArray();
    }
}
