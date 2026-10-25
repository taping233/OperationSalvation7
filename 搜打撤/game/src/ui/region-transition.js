import { retargetVisual, clearVisual } from './target-motion.js';
import { motionReduced, motionTiming, motionEasing } from './motion-presets.js';
import { createPageSurfaceLifetime } from './page-surface-lifetime.js';

const operations = new WeakMap();

// Content navigation owns one retained region. New input cancels the old request;
// it never queues old text, replaces the navigation, or changes business actions.
export function cancelRegionTransition(root) { operations.get(root)?.cancel(); }

function waitMotion(handle, duration, signal) {
  return new Promise(resolve => {
    let timer;
    const finish = value => {
      clearTimeout(timer); signal.removeEventListener('abort', abort); resolve(value);
    };
    const abort = () => finish(false);
    signal.addEventListener('abort', abort, { once:true });
    timer = setTimeout(() => finish(true), duration + motionTiming.completionSlack);
    Promise.resolve(handle.finished).then(finish, () => finish(false));
    if (signal.aborted) abort();
  });
}

/** @param {HTMLElement} root @param {() => unknown} update
 * @param {{direction?: number, signal?: AbortSignal, isCurrent?: () => boolean, prepare?: (signal: AbortSignal) => unknown, enterGroups?: string[]}} [options] */
export async function transitionRegion(root, update, { direction = 1, signal,
  isCurrent = () => true, prepare, enterGroups = [] } = {}) {
  if (!root?.isConnected || signal?.aborted) return false;
  const previous = operations.get(root);
  const base = previous?.base || { inert:root.inert, busy:root.getAttribute('aria-busy') };
  previous?.cancel(true);
  const controller = new AbortController();
  let handle;
  const animatedGroups = new Set();
  const clearGroups = () => { for (const node of animatedGroups) clearVisual(node); animatedGroups.clear(); };
  const current = () => operations.get(root) === operation && !controller.signal.aborted
    && root.isConnected && !root.closest('[hidden],.closing,[data-ui-closing]') && isCurrent();
  const release = () => {
    if (operations.get(root) !== operation) return;
    operations.delete(root);
    clearVisual(root);
    clearGroups();
    root.inert = base.inert;
    if (base.busy === null) root.removeAttribute('aria-busy');
    else root.setAttribute('aria-busy', base.busy);
    delete root.dataset.regionTransition;
  };
  const operation = { base, cancel(preserve = false) {
    controller.abort(); handle?.stop(); clearGroups();
    if (preserve) operations.delete(root);
    else release();
  } };
  operations.set(root, operation);
  const abort = () => operation.cancel();
  signal?.addEventListener('abort', abort, { once:true });
  const overlay = /** @type {HTMLElement} */ (root.closest('#overlay'));
  const lifetime = overlay ? createPageSurfaceLifetime(root, { overlay, onInvalidate:abort }) : null;
  root.inert = true;
  root.setAttribute('aria-busy', 'true');
  const travel = Math.sign(direction) * 8;
  try {
    if (!current()) return false;
    if (!motionReduced()) {
      root.dataset.regionTransition = 'out';
      handle = retargetVisual(root, { opacity:0, x:-travel }, { duration:motionTiming.regionExit, easing:motionEasing.exit });
      if (!await waitMotion(handle, motionTiming.regionExit, controller.signal) || !current()) return false;
    }
    clearVisual(root);
    if (update() === false || !current()) return false;
    root.dataset.regionTransition = 'preparing';
    if (!motionReduced()) retargetVisual(root, { opacity:0, x:travel }, { duration:0 });
    if (prepare) {
      let stop;
      const cancelled = new Promise(resolve => { stop = () => resolve(false); });
      controller.signal.addEventListener('abort', stop, { once:true });
      let ready;
      try { ready = await Promise.race([Promise.resolve().then(() => prepare(controller.signal)), cancelled]); }
      finally { controller.signal.removeEventListener('abort', stop); }
      if (ready === false || !current()) return false;
    }
    clearVisual(root);
    root.dataset.regionTransition = 'in';
    if (motionReduced()) return current();
    const groups = [];
    for (const selector of enterGroups) {
      for (const node of root.querySelectorAll(selector)) {
        if (!(node instanceof HTMLElement) || node.closest('[hidden]') || groups.length >= 8
          || groups.some(other => other === node || other.contains(node) || node.contains(other))) continue;
        groups.push(node);
      }
    }
    if (groups.length) {
      // A retained frame stays steady. Only declared, non-overlapping regions
      // reveal in reading order; there is no second parent fade on this path.
      const handles = groups.map((node, index) => {
        animatedGroups.add(node);
        return retargetVisual(node, { opacity:1, x:0, y:0 }, {
          from:{ opacity:0, x:travel, y:4 }, duration:motionTiming.regionSwap,
          delay:Math.min(index * motionTiming.stagger, motionTiming.staggerMax),
        });
      });
      handle = { finished:Promise.all(handles.map(item => item.finished)).then(results => results.every(Boolean)),
        stop:() => handles.forEach(item => item.stop()) };
      return !!await waitMotion(handle, motionTiming.regionSwap
        + Math.min((groups.length - 1) * motionTiming.stagger, motionTiming.staggerMax), controller.signal) && current();
    }
    handle = retargetVisual(root, { opacity:1, x:0 }, { from:{ opacity:0, x:travel }, duration:motionTiming.regionSwap });
    return !!await waitMotion(handle, motionTiming.regionSwap, controller.signal) && current();
  } catch (error) {
    console.error('界面内容切换失败：', error);
    return false;
  } finally {
    lifetime?.dispose();
    signal?.removeEventListener('abort', abort);
    release();
  }
}
