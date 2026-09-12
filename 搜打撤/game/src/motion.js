import SDT from './sdt-facade.js';
import { animate } from 'motion/mini';
import '../css/combat-feedback.css';


function resolveReducedMotion(storage, mediaQuery) {
  let local = false;
  try {
    local = storage?.getItem('sdt-reduce-motion') === '1';
  } catch (_) { /* System preference still applies when local storage is unavailable. */ }
  return local || !!mediaQuery?.matches;
}

function syncReducedMotionClass(reduced) {
  if (typeof document !== 'undefined' && document.body?.classList) {
    document.body.classList.toggle('reduce-motion', reduced);
  }
}

const reduceMotion = () => {
  let mediaQuery = null;
  try { mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null; } catch (_) {}
  const reduced = resolveReducedMotion(typeof localStorage === 'undefined' ? null : localStorage, mediaQuery);
  syncReducedMotionClass(reduced);
  return reduced;
};
reduceMotion();
try {
  const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  mediaQuery?.addEventListener?.('change', () => reduceMotion());
} catch (_) { /* Media query is optional; the local setting remains available. */ }
const canAnimate = element => element && typeof element.animate === 'function' && !reduceMotion();
const activeHits = new WeakMap();

function pop(element) {
  if (!canAnimate(element)) return;
  animate(element, { scale: [1, 1.16, 0.98, 1] }, { duration: 0.32, ease: 'ease-out' });
}

function overlayIn(element) {
  if (!canAnimate(element)) return;
  animate(element, { opacity: [0, 1], y: [18, 0], scale: [0.985, 1] },
    { duration: 0.28, ease: [0.22, 1, 0.36, 1] });
  const options = element.querySelectorAll('.evt-opt, .mode-card, .cls-card');
  if (options.length) {
    options.forEach((option, index) => animate(option, { opacity: [0, 1], x: [14, 0] },
      { delay: index * 0.035, duration: 0.22, ease: 'ease-out' }));
  }
}

function hit(element, self = false) {
  if (!canAnimate(element)) return false;
  const previous = activeHits.get(element);
  if (previous && typeof previous.stop === 'function') previous.stop();
  const x = self ? [0, -7, 6, -4, 2, 0] : [0, 9, -7, 5, -2, 0];
  // 位移之外加极轻的旋转和纵向压缩，命中方向更清楚；幅度短暂且回到原位。
  const rotate = self ? [0, -1.2, 0.9, -0.5, 0.2, 0] : [0, 1.4, -1, 0.6, -0.2, 0];
  const control = animate(element, { x, rotate, scale: [1, 0.965, 1.025, 1] }, { duration: self ? 0.42 : 0.36, ease: 'ease-out' });
  activeHits.set(element, control);
  return true;
}

SDT.Motion = Object.freeze({ pop, overlayIn, hit, reduceMotion });

export { hit, overlayIn, pop, reduceMotion, resolveReducedMotion };
