import { reduceMotion } from '../core/motion.js';
import { isTurbo } from '../core/turbo.js';
import { visualFrame } from './page-visual-ready.js';
import { createPageSurfaceLifetime } from './page-surface-lifetime.js';
import '../../css/map-passage.css';
import { transitionHeadingHTML } from './transition-heading.js';

let active = null;
export function cancelLayerPassage() { active?.dispose(); }
export function isLayerPassageActive(game) {
  if (active && !active.current()) active.dispose();
  return active?.game === game;
}
function delay(ms, signal) {
  return new Promise((/** @type {(value?: void) => void} */ resolve) => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

// One presentation for route travel and explicit gates. Commit/save remain synchronous
// in their owners; cancellation can only dismiss this curtain, never undo travel.
export function showLayerPassage(game, from, to) {
  if (from === to || reduceMotion() || isTurbo()) return null;
  cancelLayerPassage();
  const token = game.discoveredPairs, map = game.layerData;
  const layer = document.createElement('div');
  layer.className = 'map-layer-passage';
  layer.setAttribute('role', 'status'); layer.setAttribute('aria-live', 'polite');
  layer.setAttribute('aria-label', `第 ${from + 1} 层 → 第 ${to + 1} 层`);
  layer.innerHTML = transitionHeadingHTML(`第 ${to + 1} 层`);
  document.body.append(layer);
  let settled = false, complete;
  const done = new Promise((/** @type {(value?: void) => void} */ resolve) => { complete = resolve; });
  const current = () => !settled && active === operation && lifetime.current()
    && game.runActive && game.discoveredPairs === token && game.layerData === map
    && !game.battleActive && !game.nestActive && ['idle', 'moving'].includes(game.state)
    && (game.layerIdx === from || game.layerIdx === to);
  const block = event => {
    if (!current()) { dispose(); return; }
    event.preventDefault(); event.stopImmediatePropagation();
  };
  const dispose = () => {
    if (settled) return;
    settled = true; clearTimeout(deadline); lifetime.dispose(); layer.remove();
    window.removeEventListener('keydown', block, true);
    window.removeEventListener('pointerdown', block, true);
    window.removeEventListener('click', block, true);
    if (active === operation) active = null;
    complete();
  };
  const operation = { game, current, dispose, done };
  const lifetime = createPageSurfaceLifetime(layer, { overlay: layer, onInvalidate: dispose });
  active = operation;
  for (const name of ['keydown', 'pointerdown', 'click']) window.addEventListener(name, block, true);
  // A background tab or an unresponsive decorative renderer cannot strand input.
  const deadline = setTimeout(dispose, 3000);
  (async () => {
    try {
      const minimum = delay(820, lifetime.signal);
      await visualFrame(lifetime.signal);
      if (!current() || game.layerIdx !== to) return;
      // Route travel owns its interpolated camera. Explicit gates have already
      // committed their target and can prepare that first map frame under the curtain.
      if (game.state === 'idle') await window.SDT?.Renderer?.prepare?.(game, current);
      await visualFrame(lifetime.signal);
      await minimum;
      if (!current()) return;
      layer.classList.add('leaving');
      await delay(180, lifetime.signal);
    } catch (error) { console.warn('跨层画面准备失败，保留已提交位置：', error); }
    finally { dispose(); }
  })();
  return operation;
}
if (import.meta.hot) import.meta.hot.dispose(cancelLayerPassage);
