using System;
using System.Collections.Generic;

namespace Soudache;

/// <summary>
/// 批次 5 rider [6c→A]：战斗音效信号的适配层生产器。
/// CoreGameAdapter 的对局战斗路径 = CombatState/CardPlayEngine（骨架同步化引擎），
/// 状态变化只能在其组合根按动作粒度观测；本类把这些可观测变化折算成 sound.js
/// 同名音效键（对照 _planning/audio-inventory.md §3 / §1.4 的网页触发点），
/// 由 PublishBattle 装进 BattleUiSnapshot.SfxRequests，UI 逐键 PlaySfx 后由 Drain 清空。
/// 网页触发点：execPlay→card（battle.core.js:1241）、hitFoe→hit（:1376）、
/// 玩家受伤→hurt（:1812）、恢复→heal（game.session.js:95）、finish→victory/defeat（:2147）。
/// </summary>
public sealed class BattleSfxTracker
{
    private readonly List<string> _pending = new();

    public IReadOnlyList<string> Pending => _pending;

    public void Push(string key)
    {
        if (!string.IsNullOrWhiteSpace(key)) _pending.Add(key);
    }

    /// <summary>出牌结算（打牌必 card；敌人总血下降→hit；玩家受伤→hurt / 回复→heal）。</summary>
    public void OnCardResolved(int enemiesHpBefore, int enemiesHpAfter, int playerHpBefore, int playerHpAfter)
    {
        Push("card");
        if (enemiesHpAfter < enemiesHpBefore) Push("hit");
        if (playerHpAfter < playerHpBefore) Push("hurt");
        else if (playerHpAfter > playerHpBefore) Push("heal");
    }

    /// <summary>敌方回合结算（玩家受伤→hurt / 回复→heal；敌人总血下降不在此发生）。</summary>
    public void OnEnemyTurnResolved(int playerHpBefore, int playerHpAfter)
    {
        if (playerHpAfter < playerHpBefore) Push("hurt");
        else if (playerHpAfter > playerHpBefore) Push("heal");
    }

    /// <summary>战斗终局（网页 finish(true/false)）。</summary>
    public void OnCombatEnded(bool victory) => Push(victory ? "victory" : "defeat");

    /// <summary>取走并清空挂起的音效请求（UI 逐键 PlaySfx 消费）。</summary>
    public IReadOnlyList<string> Drain()
    {
        var list = _pending.ToArray();
        _pending.Clear();
        return list;
    }
}
