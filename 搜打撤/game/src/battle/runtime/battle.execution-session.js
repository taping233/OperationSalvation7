import { createActionQueue } from '../core/battle.actions.js';

// 一场战斗的命令执行态；规则数据仍由 battle.runtime.js 持有。
export function createBattleExecutionSession() {
  const actionQueue = createActionQueue();
  const stagedDeathFx = new Set();
  const handSelectQueue = [];
  const choiceQueue = [];
  let stagedResolutionDepth = 0;
  let generation = 0;
  let turnEndContinuation = null;

  // 回合结束属于整条出牌链：等待动作及其交互全部收口，且只续接一次。
  function deferTurnEnd(resume, isReady, cancel = () => {}) {
    if (turnEndContinuation) return false;
    turnEndContinuation = { generation, resume, isReady, cancel };
    return true;
  }

  function resumeTurnEnd() {
    const pending = turnEndContinuation;
    if (!pending || pending.generation !== generation || actionQueue.running ||
        actionQueue.length || stagedResolutionDepth || !pending.isReady()) return false;
    turnEndContinuation = null;   // 先移交所有权，重入/重复点击不能再次续接。
    pending.resume();
    return true;
  }

  function reset(reason = 'battle replaced') {
    // 先使旧演出的收尾失效，再取消动作，避免跨战斗的 finally 清理新状态。
    generation++;
    const cancelled = turnEndContinuation;
    turnEndContinuation = null;
    try { cancelled?.cancel(); } catch (error) { console.error('Battle continuation cancellation failed', error); }
    actionQueue.clear(reason);
    stagedDeathFx.clear();
    handSelectQueue.length = 0;
    choiceQueue.length = 0;
    stagedResolutionDepth = 0;
  }

  return {
    actionQueue,
    stagedDeathFx,
    handSelectQueue,
    choiceQueue,
    get stagedResolutionDepth() { return stagedResolutionDepth; },
    set stagedResolutionDepth(value) { stagedResolutionDepth = value; },
    get generation() { return generation; },
    get turnEndPending() { return !!turnEndContinuation; },
    deferTurnEnd,
    resumeTurnEnd,
    reset,
    abort: (reason = 'battle ended') => reset(reason),
  };
}
