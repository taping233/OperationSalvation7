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
  preparePresentation,
  deferPersist = write => write(),
  onIdle = () => {},
  onFailure = (...details) => { void details; },
}) {
  return function queueBattleAction(execute, label = '战斗动作', onError = null) {
    const battleToken = getBattleState().token;
    const generation = session.generation;
    const queue = session.actionQueue;
    let presentationDeparted = false;
    // Reactive casts belong to the enemy phase; its async owner waits for this queue.
    if (getBattleState().phase !== BATTLE_PHASES.ENEMY)
      setBattleState(transitionBattle(getBattleState(), BATTLE_PHASES.RESOLVING));
    setBusy(true);
    render();

    return queue.enqueue(async signal => {
      if (session.generation !== generation || getBattleState().token !== battleToken || !getGame()?.battleActive) {
        throw actionCancellationError(signal);
      }
      throwIfActionCancelled(signal);
      setActiveActionSignal(signal);
      try {
        // 选牌面板返回必须先挂载真正就绪的舞台，再执行费用、随机和逐段反馈。
        // 无视觉层的规则测试仍保留同步开跑；取消不等待未完成的资源请求。
        const prepared = preparePresentation?.(signal);
        const ready = prepared && typeof prepared.then === 'function' ? await new Promise((resolve, reject) => {
          const cancel = () => { signal.removeEventListener('abort', cancel); reject(actionCancellationError(signal)); };
          signal.addEventListener('abort', cancel, { once: true });
          if (signal.aborted) { cancel(); return; }
          Promise.resolve(prepared).then(value => { signal.removeEventListener('abort', cancel); resolve(value); },
            error => { signal.removeEventListener('abort', cancel); reject(error); });
        }) : prepared;
        throwIfActionCancelled(signal);
        presentationDeparted = ready === false;
        if (presentationDeparted || session.generation !== generation || getBattleState().token !== battleToken || !getGame()?.battleActive) {
          throw actionCancellationError(signal);
        }
        return await execute(signal);
      }
      finally { if (getActiveActionSignal() === signal) setActiveActionSignal(null); }
    })
      .catch(error => {
        onError?.(error);
        if (error?.name !== 'BattleActionCancelledError' && error?.name !== 'AbortError') {
          console.error(`[battle] ${label}异常：`, error);
          if (session.generation === generation && getBattleState().token === battleToken && getGame()?.battleActive) onFailure(error, { label, battleToken });
        }
      })
      .finally(async () => {
        if (session.generation !== generation) return;
        await queue.idle();
        if (session.generation !== generation || getBattleState().token !== battleToken) return;
        if (queue.length === 0 && !queue.running) onIdle();
        if (queue.length === 0 && !queue.running && getBattleState().phase === BATTLE_PHASES.RESOLVING) {
          setBattleState(transitionBattle(getBattleState(), BATTLE_PHASES.PLAYER));
          setBusy(false);
          const game = getGame();
          if (game?.persistSave && game.battleActive && getBattleState().phase === BATTLE_PHASES.PLAYER) {
            const now = performance.now();
            if (now - getLastPersistAt() >= PERSIST_MIN_MS) {
              setLastPersistAt(now);
              deferPersist(() => { if (game.battleActive) game.persistSave(); });
            }
          }
        }
        if (!presentationDeparted) render();
      });
  };
}
