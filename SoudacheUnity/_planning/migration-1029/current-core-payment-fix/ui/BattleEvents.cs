// ported from src/battle.core.js（viewApi/commands/renderBattle 挂接面的 C# 侧契约）
// 本文件由 W9 拥有：定义战斗「命令→快照→渲染」事件挂接点，W1 移植 battle.core.js 时按此实现。
//   对应关系：
//     configureBattleRenderer(render) / requestBattleRender()  → BattleEvents.SnapshotChanged 事件
//     commands.{...}                                              → IBattleCommands
//     viewApi.{...}                                               → IBattleViewApi
//     getSnapshot()                                               → BattleSession.Snapshot（Sdt.Core.Battle，W1 实现）
using System;
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Core.Battle;

namespace Sdt.UI.Screens.Battle
{
    /// <summary>
    /// 战斗渲染事件（对应 battle.core.js 的 requestBattleRender → 注入的 render）。
    /// W1 的 BattleSession 在每个命令执行完毕后 Emit 一次（携带最新 Snapshot）。
    /// BattleScreen 订阅此事件并同步常驻舞台、单位与手牌区域。
    /// </summary>
    public static class BattleEvents
    {
        public static Action RetrySettlement;
        public static bool SettlementPending => RetrySettlement != null;
        public static event Action<BattleSnapshot> SnapshotChanged;
        public static void Raise(BattleSnapshot snapshot) => SnapshotChanged?.Invoke(snapshot);
    }

    /// <summary>battle.core.js commands 对象 → C#（W1 在 BattleSession 上实现本接口）。
    /// PlayCard 的 targetIndex：-1 = 指向自己（JS play(uid,'self')），>=0 = foes 下标。</summary>
    public interface IBattleCommands
    {
        CommandResult PlayCard(string uid, int targetIndex, bool infused);  // commands.playCard
        void SelectInfusion(string uid);   // toggleInfusePick
        void ConfirmInfusion();            // confirmInfusion
        void CancelInfusion();             // cancelInfuse
        void EndTurn();                    // endTurn
        void Flee();                       // flee
        void OpenGrave();                  // openGrave
        void CloseGrave();                 // closeGrave
        void CancelPendingTarget();        // cancelPendingTarget
        void PickDiscover(int index);      // pickDiscover
        void SetPendingHint(string text);  // setPendingHint
        void LockPendingTarget(string uid);// lockPendingTarget
        void SelectDeckCard(string uid);   // selectDeckCard
        void ConfirmDeck();                // confirmDeck
        void CancelDeck();                 // cancelDeck
        CommandResult UseEquipment(string uid);
        CommandResult UseItem(string uid, int targetIndex = -1);
        CommandResult ChooseRuleOption(int index);
        CommandResult SelectRuleHand(string uid);
        CommandResult ConfirmRuleHandPayment(long selectionId, string[] materialUids);
        CommandResult UseHeroSkill(int targetIndex = -1);
        CommandResult SkipInfusion();
    }

    /// <summary>battle.core.js viewApi 对象 → C#（W1 实现；BattleScreen 只经此门面取数据）。</summary>
    public interface IBattleViewApi
    {
        bool AegisBlocked(FoeSnapshot foe);                      // aegisBlocked（UI 只有快照；Boot 接线时由会话映射）
        IReadOnlyList<StatusChip> CurseChips(IReadOnlyDictionary<string, int> status); // curseChips/statusChips
        int EffCostOf(CardDef card);                             // effCostOf
        OwnedCard FindCard(string uid);                          // findCard
        int InfuseOf(CardDef card);                              // infuseOf
        void MarkDreadShown();                                   // markDreadShown
        string PileTip(IReadOnlyList<string> uids);              // pileTip
        IReadOnlyList<FloatSpec> TakeFloats();                   // takeFloats
        string TargetSide(CardDef card);                         // targetSide："enemy"/"self"/null
        string UnplayableReason(CardDef card);                   // unplayableReason
        PreviewResult PreviewDamage(int playerAtk, int spellPower, FoeSnapshot foe, int amount, string dmgType, CardDef card = null); // Combat.previewDamage 预结算（克隆快照，不改真实状态）
        AffixDef AffixMeta(string affix);                       // AFFIX_META（词缀角标）
        string DmgTypeName(string dmgType);                     // Combat.TYPE_NAME（法术伤害/攻击伤害…，无效 key 回落 fixed）
        // R()（rules.js 数值）——战斗 UI 需要的字段
        int BattleStartDraw { get; } int BattleTurnDraw { get; } int BattleEnergy { get; }
        int StarterSha { get; } int BossDeckSize { get; }
        IReadOnlyList<CardDef> AllCards { get; }                 // SDT.Cards.all()（发现/初始攻击）
        CardDef StarterAttack { get; }                           // SDT.Cards.SHA（初始攻击模板）
    }

    // ---- 以下为 viewApi 涉及的数据形状（W1 在 Sdt.Core.Battle 提供，字段名对齐 JS）----

    /// <summary>findCard 返回：背包/临时卡统一条目 {uid, card}。</summary>
    public sealed class OwnedCard { public string Uid; public CardDef Card; }

    /// <summary>状态角标（curseChips 的单枚：[[icon:x]] 名 值/回合）。</summary>
    public sealed class StatusChip { public string Icon; public string Name; public string Value; public string Desc; public bool IsCurse; }

    /// <summary>飘字/受击特效条目（battle.core floats.push 项，unit:"self"|敌人下标）。</summary>
    public sealed class FloatSpec { public int Unit; public bool IsSelf; public string Text; public string Cls; public bool Warm; public long PresentationSequence; }

    /// <summary>Combat.previewDamage 返回（预结算）。</summary>
    public sealed class PreviewResult { public int Dealt; public bool Stealthed; public IReadOnlyList<string> Log; }

    /// <summary>AFFIX_META 单项（battle.core.js）：grow/frenzy/aegis。</summary>
    public sealed class AffixDef { public string Icon; public string Name; public string Desc; }

    /// <summary>BattleScreen 的静态挂接点（W3/W7 进入战斗时设置，离开战斗清空）。</summary>
    public static class BattleView
    {
        public static IBattleCommands Commands;
        public static IBattleViewApi Api;
    }
}
