import { escAttr } from '../core/shared.js';
import '../../css/chest-opening.css';

const SAFE_FRAMES = [
  new URL('../../assets/scenes/chests/safe-simple-v7/frame-00.webp', import.meta.url).href,
  new URL('../../assets/scenes/chests/safe-simple-v7/frame-01.webp', import.meta.url).href,
  new URL('../../assets/scenes/chests/safe-simple-v7/frame-02.webp', import.meta.url).href,
  new URL('../../assets/scenes/chests/safe-simple-v7/frame-03.webp', import.meta.url).href,
];
export const SAFE_CLOSED = SAFE_FRAMES[0];
export const SAFE_BURST = new URL('../../assets/scenes/chests/safe-simple-v7/burst.webp', import.meta.url).href;

const SUPPLY_FRAMES = {
  small: [
    new URL('../../assets/scenes/chests/supply-opening-v6/small/frame-00.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/supply-opening-v6/small/frame-01.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/supply-opening-v6/small/frame-02.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/supply-opening-v6/small/frame-03.webp', import.meta.url).href,
  ],
  medium: [
    new URL('../../assets/scenes/chests/supply-opening-v6/medium/frame-00.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/supply-opening-v6/medium/frame-01.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/supply-opening-v6/medium/frame-02.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/supply-opening-v6/medium/frame-03.webp', import.meta.url).href,
  ],
  large: [
    new URL('../../assets/scenes/chests/supply-opening-v6/large/frame-00.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/supply-opening-v6/large/frame-01.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/supply-opening-v6/large/frame-02.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/supply-opening-v6/large/frame-03.webp', import.meta.url).href,
  ],
};
const SUPPLY_EFFECTS = [
  new URL('../../assets/scenes/chests/supply-opening-v6/fx/frame-00.webp', import.meta.url).href,
  new URL('../../assets/scenes/chests/supply-opening-v6/fx/frame-01.webp', import.meta.url).href,
  new URL('../../assets/scenes/chests/supply-opening-v6/fx/frame-02.webp', import.meta.url).href,
  new URL('../../assets/scenes/chests/supply-opening-v6/fx/frame-03.webp', import.meta.url).href,
];

// Hold the lock and half-open poses, then let the full-open flash settle before rewards.
/** @typedef {{fps:number, frames:string[], effects?:string[], phases?:string[], durationsMs?:number[]}} ChestFrameSet */
export function createChestFrameSets() {
  const sequence = [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 3];
  /** @type {Record<string, ChestFrameSet>} */
  const sets = Object.fromEntries(['class', 'boss'].map(kind =>
    [kind, { fps: 10, frames: sequence.map(index => SAFE_FRAMES[index]) }]));
  for (const [kind, frames] of Object.entries(SUPPLY_FRAMES)) sets[kind] = {
    fps:10, frames:frames.slice(), effects:SUPPLY_EFFECTS.slice(),
    // The closed pose already holds during the search; subsequent stages total 1s.
    durationsMs:[780, 160, 140, 700], phases:['charging', 'opening', 'burst', 'settle'],
  };
  return sets;
}

export function safeOpeningHTML({ kind, src, animated, effect = SAFE_BURST, effectFrames = false }) {
  return `<button type="button" class="pick-search safe-opening" data-eps-search data-act="chestReveal" data-chest-kind="${escAttr(kind)}" data-chest-phase="charging"${effectFrames ? ' data-chest-fx="frames"' : ''} title="点击立即揭晓">
    <span class="safe-stage" aria-hidden="true">
      ${effectFrames ? '' : `<img class="safe-glow" src="${SAFE_BURST}" alt="" draggable="false">`}
      <img class="chest-prop ps-chest" data-chest-animated="${animated}" data-chest-frame="0" src="${escAttr(src)}" alt="" draggable="false">
      <img class="safe-burst" src="${escAttr(effect)}" alt="" draggable="false">
    </span>
    <span class="safe-caption">封存物资</span><span class="ps-tip">正在解除锁定 · 点击跳过</span>
  </button>`;
}
