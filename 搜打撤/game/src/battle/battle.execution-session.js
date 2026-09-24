import { createActionQueue } from './battle.actions.js';

// 一场战斗的命令执行态；规则数据仍由 battle.runtime.js 持有。
export function createBattleExecutionSession() {
  const actionQueue = createActionQueue();
  const stagedDeathFx = new Set();
  const handSelectQueue = [];
  const choiceQueue = [];
  let stagedResolutionDepth = 0;
  let generation = 0;

  function reset(reason = 'battle replaced') {
    // 先使旧演出的收尾失效，再取消动作，避免跨战斗的 finally 清理新状态。
    generation++;
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
    reset,
    abort: (reason = 'battle ended') => reset(reason),
  };
}
