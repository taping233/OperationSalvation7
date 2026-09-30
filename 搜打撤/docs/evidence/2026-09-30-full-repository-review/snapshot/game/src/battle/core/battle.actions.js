/* 战斗动作队列：逻辑动作串行，视觉层可在动作内部等待动画完成。 */

function createActionQueue() {
  const pending = [];
  let running = false;
  let current = null;
  const idleWaiters = new Set();

  function cancellationError(reason = 'battle action queue cleared') {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    if (error.name === 'Error') error.name = 'BattleActionCancelledError';
    return error;
  }

  function wakeIdleWaiters() {
    if (running || pending.length) return;
    [...idleWaiters].forEach(resolve => resolve());
    idleWaiters.clear();
  }

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (pending.length) {
        const item = pending.shift();
        current = item;
        try {
          const value = await item.execute(item.controller.signal);
          if (item.controller.signal.aborted) throw cancellationError(item.controller.signal.reason);
          item.resolve(value);
        } catch (error) {
          item.reject(error);
        } finally {
          current = null;
        }
      }
    } finally {
      running = false;
      wakeIdleWaiters();
    }
  }

  function enqueue(execute) {
    if (typeof execute !== 'function') return Promise.reject(new TypeError('battle action must be a function'));
    const controller = new AbortController();
    const promise = new Promise((resolve, reject) => pending.push({ execute, resolve, reject, controller }));
    void drain();
    return promise;
  }

  async function idle() {
    if (!running && !pending.length) return;
    await new Promise(resolve => idleWaiters.add(resolve));
  }

  // 终局清队：尚未开始的动作必须显式结束 Promise，不能留下永久 pending 的等待链。
  // 正在执行的动作收到 AbortSignal；异步动作必须在等待点响应它，避免终局后继续写状态。
  function clear(reason = 'battle action queue cleared') {
    const error = cancellationError(reason);
    if (current && !current.controller.signal.aborted) current.controller.abort(error);
    while (pending.length) {
      const item = pending.shift();
      item.controller.abort(error);
      item.reject(error);
    }
    wakeIdleWaiters();
  }

  return Object.freeze({ enqueue, idle, clear, get length() { return pending.length; }, get running() { return running; } });
}

export { createActionQueue };
