using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

// ported from 搜打撤/game/src/game.run.flow.js eventChoiceSpec —— 2026-09-09 事件 v2 覆盖层（批次 4c-fix）。
//
// 真源：game.run.flow.js:275-318 的「V2」表（`if (V2[card.id]) return V2[card.id]()`，flow.js:319）。
// 网页实跑语义：这 6 张事件卡的 intro 仍取 ink 结点（flow.js:249 nodeShell sub=narrative.intro），
// 但「选项文案+效果」被 V2 表整体覆盖——ink 里这 6 个结点的选项是 v2 前旧文案（网页不实跑），
// 且 V2 的 run() 不推进 ink、没有 narrate() 后果文本（flow.js:252-258 evtChoice 直调 choice.run()）。
// 其余事件维持 ink 纯净链（@@effect@@ 驱动，落地表在 RunState.ApplyEventChoice）。
//
// 内容唯一来源原则：V2 选项文案只存在于本表（外置常量表，逐条注释真源行号），
// src/Core 其余位置不得散落硬编码事件文案；测试侧的文案字面量是独立复核（对照真源逐项断言）。
internal static class EventV2Overlay
{
    // —— v2 覆盖效果键（RunState.ApplyEventChoice 的 v2_* 分支；键名为本移植命名，非网页字段）——
    public const string MysteryReceive = "v2_mystery_receive";         // flow.js:279 碎片×1 + 2 币
    public const string SystemSupplyReceive = "v2_systemsupply_receive"; // flow.js:282-285 碎片×1 + 木材卡
    public const string DemonAccept = "v2_demon_accept";               // flow.js:289-293 -5 血 + 大宝箱
    public const string DemonRefuse = "v2_demon_refuse";               // flow.js:294 无事发生
    public const string AirdropWood = "v2_airdrop_wood";               // flow.js:302 木材卡 ×1
    public const string AirdropRations = "v2_airdrop_rations";         // flow.js:303 口粮卡 ×1
    public const string AirdropPeach = "v2_airdrop_peach";             // flow.js:304 回复 6 血
    public const string AirdropPotion = "v2_airdrop_potion";           // flow.js:297+305 随机药水
    public const string ChestDrawOpen = "v2_chestdraw_open";           // flow.js:309-313 大/中/小随机 1 箱
    public const string GoldhammerTake = "v2_goldhammer_take";         // flow.js:316 直发「闪金之锤」

    /// <summary>tt6-airdrop 的药水选项 detail 模板（flow.js:305 `获得【${potion.name}】`；{0}=卡名）。</summary>
    public const string PotionDetailTemplate = "获得【{0}】";
    /// <summary>药水池为空时的 detail（flow.js:305 `（补给已耗尽）`）。</summary>
    public const string PotionDetailExhausted = "（补给已耗尽）";
    /// <summary>tt6-airdrop「随机药水」池判定：名字含「药水」或等于「能量饮料」（flow.js:297）。</summary>
    public const string PotionFallbackName = "能量饮料";
    /// <summary>「闪金之锤」卡 id（flow.js:316 直发的卡）。</summary>
    public const string GoldhammerCardId = "cmtn0xt0zr7";
    public const string GoldhammerCardName = "闪金之锤";
    /// <summary>tt6-airdrop 卡 id（药水池在选项构建时掷定，RunState 需按卡识别）。</summary>
    public const string AirdropCardId = "tt6-airdrop";

    // —— v2 落地后果文案（网页 V2 run() 闭包里的 UI.log；flow.js 行号逐条标注）——
    /// <summary>flow.js:273 gainFragment 的入账文案（{0}=当前碎片数；mystery/systemsupply 共用）。</summary>
    public const string FragmentGainTemplate = "获得彩色令牌碎片（{0}/2，集齐 2 枚可随员工通行证A合成彩色令牌）";
    /// <summary>flow.js:291 成交。</summary>
    public const string DemonAcceptLog = "恶魔收走了 5 点生命力，并丢给你一个军用保险柜";
    /// <summary>flow.js:294 拒绝。</summary>
    public const string DemonRefuseLog = "你顶住了诱惑，继续赶路";
    /// <summary>flow.js:304 桃。</summary>
    public const string AirdropPeachLog = "一颗鲜桃下肚，回复 6 点生命";
    /// <summary>flow.js:312 开箱（宝箱浮层标题的等价文案）。</summary>
    public const string ChestDrawLog = "你撬开了一个未知的箱子";

    // —— V2 表：选项文案/色调/效果键，逐条对照 flow.js:277-318 ——
    public static readonly IReadOnlyDictionary<string, V2ChoiceSpec[]> Table = new Dictionary<string, V2ChoiceSpec[]>
    {
        // flow.js:278-280 神秘补给：接收补给 = 彩色令牌碎片 ×1 + 2 币
        ["tt6-mystery"] = new[]
        {
            new V2ChoiceSpec(MysteryReceive, "接收补给", "获得彩色令牌碎片，+2 币", "ok"),
        },
        // flow.js:281-287 系统补给：接收补给 = 彩色令牌碎片 ×1 + 木材卡 ×1
        ["tt6-systemsupply"] = new[]
        {
            new V2ChoiceSpec(SystemSupplyReceive, "接收补给", "获得彩色令牌碎片，木材卡 ×1", "ok"),
        },
        // flow.js:288-295 恶魔交易：成交 = -5 血 + 1 个大宝箱（「恶魔的报酬」）；拒绝 = 无事发生
        ["tt6-demondeal"] = new[]
        {
            new V2ChoiceSpec(DemonAccept, "成交", "-5 血，获得 1 个大宝箱", "danger"),
            new V2ChoiceSpec(DemonRefuse, "拒绝", "无事发生"),
        },
        // flow.js:296-307 空中补给：木材/口粮/桃/随机药水（药水 detail 运行时按抽定卡名格式化）
        ["tt6-airdrop"] = new[]
        {
            new V2ChoiceSpec(AirdropWood, "木材", "木材卡 ×1"),
            new V2ChoiceSpec(AirdropRations, "口粮", "口粮卡 ×1"),
            new V2ChoiceSpec(AirdropPeach, "桃", "回复 6 血", "ok"),
            new V2ChoiceSpec(AirdropPotion, "随机药水", PotionDetailTemplate, "ok"),
        },
        // flow.js:308-314 宝箱：开箱 = 从大、中、小宝箱中随机抽 1 个
        ["tt6-chestdraw"] = new[]
        {
            new V2ChoiceSpec(ChestDrawOpen, "开箱", "从大、中、小宝箱中随机抽取 1 个", "ok"),
        },
        // flow.js:315-317 矮人的帮助：收下 = 直发卡牌「闪金之锤」（非锤击敌人，ink 旧文案为锤击）
        ["tt6-goldhammer"] = new[]
        {
            new V2ChoiceSpec(GoldhammerTake, "收下", "获得卡牌「闪金之锤」", "ok"),
        },
    };

    public sealed record V2ChoiceSpec(string Effect, string Label, string Detail, string Tone = "");

    /// <summary>卡 id 是否被 V2 覆盖（RunState.ChooseEvent 据此跳过 ink 推进）。</summary>
    public static bool IsCovered(string cardId) => Table.ContainsKey(cardId);

    /// <summary>覆盖事件的选项数（测试矩阵用）。</summary>
    public static int ChoiceCount(string cardId) => Table.TryGetValue(cardId, out var specs) ? specs.Length : 0;

    /// <summary>
    /// 构建 V2 覆盖选项；cardId 未被覆盖返回 null（调用方回落 ink 链）。
    /// potionName：tt6-airdrop 开面板时已抽定的药水卡名（null=池空，detail 用「补给已耗尽」）。
    /// </summary>
    public static RunEventChoice[]? BuildChoices(string cardId, string? potionName)
    {
        if (!Table.TryGetValue(cardId, out var specs)) return null;
        return specs.Select(spec => new RunEventChoice(
            spec.Effect,
            spec.Label,
            spec.Effect == AirdropPotion
                ? (potionName is null ? PotionDetailExhausted : string.Format(PotionDetailTemplate, potionName))
                : spec.Detail,
            spec.Tone)).ToArray();
    }
}
