import { reduceMotion } from '../core/motion.js';
import { isTurbo } from '../core/turbo.js';
import { visualFrame } from './page-visual-ready.js';
import { createPageSurfaceLifetime } from './page-surface-lifetime.js';
import '../../css/map-passage.css';
import { createSilentNodeCut, prepareSilentFilm, silentFilmRemaining } from './silent-node-film.js';
import { layerPassageProfile } from './layer-passage-profiles.js';

let active = null;
const passageDuration = 3600;
const passageExit = 700;
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
  const profile = layerPassageProfile(to);
  const layer = document.createElement('div');
  layer.className = 'map-layer-passage';
  layer.setAttribute('role', 'status'); layer.setAttribute('aria-live', 'polite');
  layer.setAttribute('aria-label', `第 ${from + 1} 层 → 第 ${to + 1} 层`);
  const film=createSilentNodeCut('passage', { duration: passageDuration });
  // This illustrated entrance owns its staging independently of short node cuts.
  const scenery = /** @type {HTMLElement} */ (film.querySelector('.silent-film-scenery'));
  scenery.dataset.filmMotion = profile.motion;
  scenery.dataset.filmRenderer = 'image';
  const image = document.createElement('img');
  image.className = 'silent-node-art'; image.src = profile.art;
  image.alt = ''; image.decoding = 'async'; image.draggable = false;
  scenery.prepend(image);
  film.dataset.filmExit = 'fade';
  film.style.setProperty('--sf-exit', 'sfExit-fade');
  layer.append(film);
  const caption = document.createElement('div');
  caption.className = 'layer-passage-caption';
  const cue = document.createElement('small');
  cue.textContent = to > from ? '继续深入' : '返回上层';
  const heading = document.createElement('h2');
  heading.textContent = `第 ${to + 1} 层`;
  const region = document.createElement('p');
  region.textContent = game.layerData?.[to]?.name || '';
  caption.append(cue, heading, region);
  layer.append(caption);
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
  const deadline = setTimeout(dispose, 6500);
  (async () => {
    try {
      const artwork=prepareSilentFilm(film,{signal:lifetime.signal,timeout:1200});
      artwork.then(() => { if (current()) layer.classList.add('passage-playing'); });
      await visualFrame(lifetime.signal);
      if (!current() || game.layerIdx !== to) return;
      // Route travel owns its interpolated camera. Explicit gates have already
      // committed their target and can prepare that first map frame under the curtain.
      if (game.state === 'idle') await window.SDT?.Renderer?.prepare?.(game, current);
      await visualFrame(lifetime.signal);
      await artwork;
      await delay(silentFilmRemaining(film),lifetime.signal);
      if (!current()) return;
      layer.style.setProperty('--silent-film-exit-duration',`${passageExit}ms`);
      film.classList.add('leaving');
      layer.classList.add('leaving');
      await delay(passageExit, lifetime.signal);
    } catch (error) { console.warn('跨层画面准备失败，保留已提交位置：', error); }
    finally { dispose(); }
  })();
  return operation;
}
if (import.meta.hot) import.meta.hot.dispose(cancelLayerPassage);
