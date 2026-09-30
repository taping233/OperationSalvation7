import { BATTLE_PHASES, transitionBattle } from './battle.state.js';

const PERSIST_MIN_MS = 8000;

// 只调度命令；规则结算由调用方传入的 execute 完成。
export function createBattleActionRunner({
  session,
  getBattleState, setBattleState,
  getGame, setBusy,
  getActiveActionSignal, setActiveActionSignal,
  getLastPersistAt, setLastPersistAt,
  render, actionCancellationError, throwIfActionCancelled,
}) {
  return function queueBattleAction(execute, label = '战斗动作') {
    const battleToken = getBattleState().token;
    const generation = session.generation;
    const queue = session.actionQueue;
    setBattleState(transitionBattle(getBattleState(), BATTLE_PHASES.RESOLVING));
    setBusy(true);
    render();

    queue.enqueue(async signal => {
      if (session.generation !== generation || getBattleState().token !== battleToken || !getGame()?.battleActive) {
        throw actionCancellationError(signal);
      }
      throwIfActionCancelled(signal);
      setActiveActionSignal(signal);
      try { return await execute(signal); }
      finally { if (getActiveActionSignal() === signal) setActiveActionSignal(null); }
    })
      .catch(error => {
        if (error?.name !== 'BattleActionCancelledError') console.error(`[battle] ${label}异常：`, error);
      })
      .finally(async () => {
        if (session.generation !== generation) return;
        await queue.idle();
        if (session.generation !== generation || getBattleState().token !== battleToken) return;
        if (queue.length === 0 && !queue.running && getBattleState().phase === BATTLE_PHASES.RESOLVING) {
          setBattleState(transitionBattle(getBattleState(), BATTLE_PHASES.PLAYER));
          setBusy(false);
          const game = getGame();
          if (game?.persistSave && game.battleActive && getBattleState().phase === BATTLE_PHASES.PLAYER) {
            const now = performance.now();
            if (now - getLastPersistAt() >= PERSIST_MIN_MS) {
              setLastPersistAt(now);
              // F5②（09-30 性能审计）：全量存档序列化可到几十 ms，出牌收尾即写会掉帧——
              // 挪到 idle 窗口执行，2s 超时兜底；页面隐藏无 idle 调度直接写。
              // 崩溃安全窗口最多放宽 2s，正常关窗仍由 beforeunload 全量保存兜底。
              if (typeof requestIdleCallback === 'function' && !document.hidden) {
                requestIdleCallback(() => { if (game.battleActive) game.persistSave(); }, { timeout: 2000 });
              } else {
                game.persistSave();
              }
            }
          }
        }
        render();
      });
  };
}
