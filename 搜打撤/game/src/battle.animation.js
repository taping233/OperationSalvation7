/* 可取消的轻量动画等待器；真实 DOM/CSS 动画由视图层注入。 */

function createAnimationController() {
  const active = new Set();

  function wait(duration = 0) {
    const ms = Math.max(0, Number(duration) || 0);
    let timer;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      rejectPromise = reject;
      timer = setTimeout(() => { active.delete(cancel); resolve(); }, ms);
    });
    function cancel() {
      clearTimeout(timer);
      active.delete(cancel);
      rejectPromise(new Error('animation cancelled'));
    }
    active.add(cancel);
    return { promise, cancel };
  }

  function cancelAll() {
    [...active].forEach((cancel) => cancel());
  }

  return Object.freeze({ wait, cancelAll, get activeCount() { return active.size; } });
}

export { createAnimationController };
