using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

// ported from 搜打撤/game/src/game.bag.js（craftColorToken / craftColorTokenByFragments）
// —— 令牌合成的 Core 语义（落入 run 状态）：
//   3 张员工通行证B（tt-token-gold）→ 1 张员工通行证A（tt-token-color）
//   员工通行证A + 2 枚彩色令牌碎片 → 1 张彩色令牌（cmtmvq6ss84l，使用后获取本职业能力卡）
// 彩色令牌碎片计数在 RunState.Fragments（网页版 game.fragments，随存档持久化）。

public static class TokenCraft
{
    public const string TokenGoldId = "tt-token-gold";     // 员工通行证B
    public const string TokenColorId = "tt-token-color";   // 员工通行证A
    public const string ColorTokenId = "cmtmvq6ss84l";     // 彩色令牌

    /// <summary>合成结果。</summary>
    public readonly record struct CraftResult(bool Ok, string Message, string? CraftedCardId);

    /// <summary>3 张员工通行证B → 1 张员工通行证A。owned 为 (id, count) 背包栈；直接原地改写。</summary>
    public static CraftResult CraftTokenAFromB(RunState run, IList<(string Id, int Count)> owned)
    {
        ArgumentNullException.ThrowIfNull(run);
        var golds = owned.FirstOrDefault(x => x.Id == TokenGoldId);
        if (golds.Count < 3) return new CraftResult(false, "员工通行证B不足 3 张，无法合成", null);
        var idx = owned.IndexOf(golds);
        owned[idx] = (golds.Id, golds.Count - 3);
        return new CraftResult(true, "合成成功：3 张员工通行证B → 1 张员工通行证A", TokenColorId);
    }

    /// <summary>员工通行证A + 2 枚碎片 → 1 张彩色令牌（碎片计数从 run.Fragments 扣除）。</summary>
    public static CraftResult CraftColorTokenByFragments(RunState run, IList<(string Id, int Count)> owned)
    {
        ArgumentNullException.ThrowIfNull(run);
        if (run.Fragments < 2) return new CraftResult(false, "彩色令牌碎片不足 2 枚，无法合成", null);
        var color = owned.FirstOrDefault(x => x.Id == TokenColorId);
        if (color.Count < 1) return new CraftResult(false, "缺少员工通行证A，无法合成彩色令牌", null);
        if (!run.TryConsumeFragments(2)) return new CraftResult(false, "彩色令牌碎片不足 2 枚，无法合成", null);
        var idx = owned.IndexOf(color);
        owned[idx] = (color.Id, color.Count - 1);
        return new CraftResult(true, "合成成功：员工通行证A + 2 枚碎片 → 1 张彩色令牌（使用后获取本职业能力卡）", ColorTokenId);
    }
}
