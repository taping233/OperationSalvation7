/** @typedef {HTMLElement & {_battleToken?: number, _misTimer?: ReturnType<typeof setTimeout>}} BattleElement */
// Enemy IDs identify species, not combat instances. Indices stay aligned with
// the snapshot/DOM foe slots, including dead placeholders, for this battle token.
export const isTargetableEnemy = (foe, index, excludedIndex = null) => !!foe && !foe.dead
  && Number.isInteger(index) && index >= 0 && index !== excludedIndex;
// 单次战斗目标会话：负责命中筛选、hover 转换及一次性选择/取消结果。
export function createTargetSession({ side, snapshot, isBattleCurrent, getTargets, onHover = undefined }) {
  let hover = null;
  let settled = false;
  let resolve;
  const promise = new Promise(done => { resolve = done; });

  function isCurrent() {
    if (settled) return false;
    if (isBattleCurrent?.()) return true;
    const previous = hover;
    hover = null;
    if (previous) onHover?.(null, previous);
    settled = true;
    resolve({ status: 'cancelled', target: null });
    return false;
  }
  function hitAt(x, y) {
    if (!isCurrent() || !side) return null;
    const elAt = document.elementFromPoint(x, y);
    if (!elAt) return null;
    if (side === 'any') {
      if (!elAt.closest('.battle-stage')) return null;
      if (elAt.closest('.sts-hud, .sts-topbar, .bt-potions')) return null;
      return { kind: 'any', el: elAt.closest('.battle-stage') };
    }
    if (side === 'enemy') {
      const el = /** @type {HTMLElement} */ (elAt.closest('.bt-foe[data-eidx]'));
      if (!el) return null;
      const idx = +el.dataset.eidx;
      const foe = snapshot?.foes[idx];
      return isTargetableEnemy(foe, idx, snapshot?.pendingTarget?.excludedTargetIndex) ? { kind: 'enemy', idx, el } : null;
    }
    const el = elAt.closest('#btSelf');
    return el ? { kind: 'self', el } : null;
  }
  function setHover(next) {
    if (!isCurrent()) return null;
    if (hover?.el === next?.el) return hover;
    const previous = hover;
    hover = next || null;
    onHover?.(hover, previous);
    return hover;
  }
  function select(target) {
    if (!isCurrent() || !target) return false;
    if (target.kind === 'enemy') {
      const targets = getTargets ? getTargets() : snapshot?.foes;
      const foe = targets?.[target.idx];
      if (!isTargetableEnemy(foe, target.idx, snapshot?.pendingTarget?.excludedTargetIndex)) return false;
    }
    setHover(null);
    settled = true;
    resolve({ status: 'selected', target });
    return true;
  }
  function selectDirect(kind, idx) {
    if (!isCurrent() || kind !== side && !(side == null && kind === 'any')) return false;
    if (kind === 'enemy') {
      const targets = getTargets ? getTargets() : snapshot?.foes;
      const foe = targets?.[idx];
      if (!isTargetableEnemy(foe, idx, snapshot?.pendingTarget?.excludedTargetIndex)) return false;
      return select({ kind, idx });
    }
    if (kind === 'self' || kind === 'any') return select({ kind });
    return false;
  }
  function cancel() {
    if (settled) return false;
    setHover(null);
    settled = true;
    resolve({ status: 'cancelled', target: null });
    return true;
  }
  return { promise, hitAt, setHover, select, selectDirect, cancel, get hover() { return hover; }, get settled() { return settled; }, isCurrent };
}
