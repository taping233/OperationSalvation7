import { esc, escAttr } from '../core/shared.js';
import '../../css/chest-opening.css';

const SAFE_FRAMES = [
  new URL('../../assets/scenes/chests/safe-simple-v7/frame-00.webp', import.meta.url).href,
  new URL('../../assets/scenes/chests/safe-simple-v7/frame-01.webp', import.meta.url).href,
  new URL('../../assets/scenes/chests/safe-simple-v7/frame-02.webp', import.meta.url).href,
  new URL('../../assets/scenes/chests/safe-simple-v7/frame-03.webp', import.meta.url).href,
];
export const SAFE_CLOSED = SAFE_FRAMES[0];
export const SAFE_BURST = new URL('../../assets/scenes/chests/safe-simple-v7/burst.webp', import.meta.url).href;

// Hold the lock and half-open poses, then let the full-open flash settle before rewards.
export function createChestFrameSets() {
  const sequence = [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 3];
  return Object.fromEntries(['small', 'medium', 'large', 'class', 'boss'].map(kind =>
    [kind, { fps: 10, frames: sequence.map(index => SAFE_FRAMES[index]) }]));
}

export function safeOpeningHTML({ kind, src, animated }) {
  return `<button type="button" class="pick-search safe-opening" data-eps-search data-act="chestReveal" data-chest-kind="${escAttr(kind)}" data-chest-phase="charging" title="点击立即揭晓">
    <span class="safe-stage" aria-hidden="true">
      <img class="safe-glow" src="${SAFE_BURST}" alt="" draggable="false">
      <img class="chest-prop ps-chest" data-chest-animated="${animated}" data-chest-frame="0" src="${escAttr(src)}" alt="" draggable="false">
      <img class="safe-burst" src="${SAFE_BURST}" alt="" draggable="false">
    </span>
    <span class="safe-caption">封存物资</span><span class="ps-tip">正在解除锁定 · 点击跳过</span>
  </button>`;
}

export function chestOfferHTML({ name, src }) {
  return `<article class="chest-offer"><button type="button" class="chest-offer-card" data-act="chestClaim" aria-label="领取${escAttr(name)}">
    <img src="${escAttr(src)}" alt="" draggable="false"><strong>${esc(name)}</strong><span>领取后开启</span>
  </button></article>`;
}
