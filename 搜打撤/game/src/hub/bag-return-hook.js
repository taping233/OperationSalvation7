/* 背包来源页返回钩子（迭代评审 09-20 C-P1）：
 * 从事件页/物资格页/商店等覆盖页上打开背包再关闭后，恢复原页面——此前事件/物资格页
 * 没有登记恢复路径，closeBackpack 兜底回 idle 会吞掉整格结算。
 * 独立成中立小模块：game.run.scenes / game.run.flow 与 game.bag 都要读写钩子，
 * 三方直接互相导入会成环；boot 原有 setBagReturnHook 引用经 game.bag 再导出不受影响。 */

import { captureBattleContext } from '../battle/battle-loader.js';

let hook = null;

function capturePage() {
  const UI = typeof window === 'undefined' ? null : window.SDT?.UI;
  const body = UI?.el?.ovBody, overlay = UI?.el?.overlay;
  const root = body?.firstElementChild, revision = UI?._overlayRevision;
  return { body, overlay, root, revision,
    current:() => UI?.el?.ovBody === body && UI?.el?.overlay === overlay
      && UI?._overlayRevision === revision && body?.firstElementChild === root
      && !!root && !overlay?.hidden && !overlay?.classList?.contains('closing') };
}

function createOwner(restore) {
  const game = typeof window === 'undefined' ? null : window.SDT?.game;
  return { restore, current:game ? captureBattleContext(game) : () => false,
    source:capturePage(), claimed:false, pending:null };
}

export function setBagReturnHook(fn) {
  hook = typeof fn === 'function' ? createOwner(fn) : null;
  const owner = hook;
  // Some owners register immediately before rendering their source page. Finish
  // that same synchronous render before binding its surface; a bag opened in the
  // same stack claims the existing source first (the shop boot adapter does this).
  if (owner) queueMicrotask(() => {
    if (hook !== owner || owner.claimed || !owner.current()) return;
    const page = capturePage();
    if (page.body === owner.source.body && page.revision === owner.source.revision + 1) owner.source = page;
  });
}

// Claim while the source is still mounted. A hook from another page or run may
// never pull that old page back over a newly opened backpack.
export function claimBagReturnHook(restore = null) {
  const owner = typeof restore === 'function' ? createOwner(restore) : hook;
  if (!owner) return null;
  if (!owner.current() || !owner.source.current()) {
    if (hook === owner) hook = null;
    return null;
  }
  owner.claimed = true;
  return owner;
}

export function returnToBagSource(owner, { isCurrent, didReturn }) {
  if (owner.pending) return owner.pending;
  if (!owner.current() || !isCurrent()) return Promise.resolve(false);
  const pending = Promise.resolve().then(() => {
    if (!owner.current() || !isCurrent()) return false;
    return owner.restore();
  }).then(result => {
    // Legacy render callbacks return void. Their actual page replacement is the
    // success signal; false/rejection or an unchanged bag remains retryable.
    const returned = result !== false && owner.current() && didReturn();
    if (returned && hook === owner) hook = null;
    return returned;
  }).catch(() => false).finally(() => {
    if (owner.pending === pending) owner.pending = null;
  });
  owner.pending = pending;
  return pending;
}

// Compatibility for callers that explicitly need one-shot consumption.
export function takeBagReturnHook() { const fn = hook?.restore || null; hook = null; return fn; }
