function restartCheckpoint(SDT, game) {
  if (!game?.battleActive || game.terminalPending || !SDT.Battle?.getSnapshot
      || !SDT.Battle?.serialize || !SDT.Battle?.restore) return null;
  try {
    const checkpoint = SDT.Battle.serialize();
    return SDT.Battle.getSnapshot()?.battleToken != null
      && checkpoint?.restartVersion === 1 && Array.isArray(checkpoint.enemyDefs) && checkpoint.enemyDefs.length
      && checkpoint.opts && checkpoint.run && checkpoint.rngState ? checkpoint : null;
  } catch { return null; }
}

export function battleRestartHTML({ SDT, game, buttonClass = 'mini-btn' }) {
  if (!restartCheckpoint(SDT, game)) return '';
  return `<div class="btn-row"><button type="button" class="${buttonClass}" data-act="restartCurrentBattle">重新开始本场战斗</button></div>
    <p class="hint">本场战斗的出牌、受伤与消耗将回到开战时。</p>
    <p class="hint" data-battle-restart-feedback role="status" aria-live="polite"></p>`;
}

/** The local page owns one restart request; the public battle checkpoint API owns all restoration. */
export function bindBattleRestart({ SDT, UI, game, page, isCurrentContext = () => SDT.game === game }) {
  const button = /** @type {HTMLButtonElement} */ (page?.querySelector('[data-act="restartCurrentBattle"]'));
  if (!button) return;
  const battle = SDT.Battle;
  const token = battle.getSnapshot()?.battleToken;
  let used = false;
  const feedback = message => {
    const status = /** @type {HTMLElement} */ (page.querySelector('[data-battle-restart-feedback]'));
    if (status) status.textContent = message;
  };
  const current = () => isCurrentContext() && game.battleActive && !game.terminalPending
    && SDT.Battle === battle && battle.getSnapshot()?.battleToken === token
    && page.isConnected && UI.el.ovBody.contains(page) && !UI.el.overlay.hidden
    && !UI.el.overlay.classList.contains('closing');

  UI.act('restartCurrentBattle', () => {
    if (used) return { ok: false, code: 'BATTLE_RESTART_ALREADY_USED', message: '本次重新开始已执行' };
    if (!current()) {
      feedback('当前设置已失效，请回到战斗后重新打开设置。');
      return { ok: false, code: 'BATTLE_RESTART_STALE', message: '当前设置不再属于这场战斗' };
    }
    const checkpoint = restartCheckpoint(SDT, game);
    if (!checkpoint) {
      feedback('当前战斗没有可用的开战记录，暂时无法重新开始。');
      return { ok: false, code: 'BATTLE_RESTART_UNAVAILABLE', message: '当前战斗无法重新开始' };
    }
    used = true;
    button.disabled = true;
    try {
      if (battle.restore(game, checkpoint) !== true) throw new Error('Battle restart rejected');
    } catch {
      used = false;
      button.disabled = false;
      feedback('未能重新开始本场战斗，请重试。');
      return { ok: false, code: 'BATTLE_RESTART_FAILED', message: '未能重新开始本场战斗' };
    }
    // Restore schedules the new battle view. Hiding this overlay would also hide that new view.
    try { battle.commands?.refreshView?.(); SDT.Sound?.sfx?.('confirm'); }
    catch { feedback('战斗已重新开始，画面尚未刷新，请返回战斗。'); }
    return { ok: true };
  });
}
