/* 战斗动作队列：逻辑动作串行，视觉层可在动作内部等待动画完成。 */

function createActionQueue() {
  const pending = [];
  let running = false;
  let wake = null;

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (pending.length) {
        const item = pending.shift();
        try {
          item.resolve(await item.execute());
        } catch (error) {
          item.reject(error);
        }
      }
    } finally {
      running = false;
      wake?.();
      wake = null;
    }
  }

  function enqueue(execute) {
    if (typeof execute !== 'function') return Promise.reject(new TypeError('battle action must be a function'));
    const promise = new Promise((resolve, reject) => pending.push({ execute, resolve, reject }));
    void drain();
    return promise;
  }

  async function idle() {
    if (!running && !pending.length) return;
    await new Promise((resolve) => { wake = resolve; });
    return idle();
  }

  // 终局清队：只丢弃尚未开始执行的回调（length 是只读 getter，外部不能直接置 0）
  function clear() {
    pending.length = 0;
  }

  return Object.freeze({ enqueue, idle, clear, get length() { return pending.length; }, get running() { return running; } });
}

export { createActionQueue };
