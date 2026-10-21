import { sdtDefine } from './sdt-facade.js';
import { animate as motionAnimate } from 'motion/mini';
/** The installed implementation accepts strings and maps unrecognised names to its native default. Preserve the existing CSS input.
 * @type {(element:Parameters<typeof motionAnimate>[0],keyframes:Parameters<typeof motionAnimate>[1],options:Omit<Parameters<typeof motionAnimate>[2], 'ease'> & {ease?:'ease-out' | NonNullable<Parameters<typeof motionAnimate>[2]>['ease']})=>ReturnType<typeof motionAnimate>} */
const animate = motionAnimate;
import '../../css/combat-feedback.css';


function resolveReducedMotion(storage, mediaQuery) {
  let local = false;
  try {
    local = storage?.getItem('sdt-reduce-motion') === '1';
  } catch { /* System preference still applies when local storage is unavailable. */ }
  return local || !!mediaQuery?.matches;
}

function syncReducedMotionClass(reduced) {
  if (typeof document !== 'undefined' && document.body?.classList) {
    document.body.classList.toggle('reduce-motion', reduced);
  }
}

// 结果缓存（迭代评审 09-20 D-P3）：此前每次动画创建都同步读 localStorage+matchMedia+classList。
// 缓存经 refreshReduceMotion() 失效——媒体查询 change 与设置页「减少动态效果」开关都会调它
let cachedReducedMotion = null;
const reduceMotion = () => {
  if (cachedReducedMotion !== null) return cachedReducedMotion;
  let mediaQuery = null;
  try { mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null; } catch { /* matchMedia 不可用：按无减弱动效偏好处理 */ }
  const reduced = resolveReducedMotion(typeof localStorage === 'undefined' ? null : localStorage, mediaQuery);
  syncReducedMotionClass(reduced);
  cachedReducedMotion = reduced;
  return reduced;
};
const refreshReduceMotion = () => { cachedReducedMotion = null; reduceMotion(); };
reduceMotion();
try {
  const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  mediaQuery?.addEventListener?.('change', () => refreshReduceMotion());
} catch { /* Media query is optional; the local setting remains available. */ }
const canAnimate = element => element && typeof element.animate === 'function' && !reduceMotion();

function pop(element) {
  if (!canAnimate(element)) return;
  animate(element, { scale: [1, 1.16, 0.98, 1] }, { duration: 0.32, ease: 'ease-out' });
}

const overlayAnimations = new WeakMap();
function cancelOverlayIn(element) {
  const animation = overlayAnimations.get(element);
  if (!animation) return false;
  overlayAnimations.delete(element);
  animation.cancel();
  return true;
}
function overlayIn(element) {
  if (!canAnimate(element)) return;
  cancelOverlayIn(element);
  const animation = animate(element, { opacity: [0, 1], y: [18, 0], scale: [0.985, 1] },
    { duration: 0.28, ease: [0.22, 1, 0.36, 1] });
  overlayAnimations.set(element, animation);
  const release = () => { if (overlayAnimations.get(element) === animation) overlayAnimations.delete(element); };
  animation.finished.then(release, release);
  const options = element.querySelectorAll('.evt-opt, .mode-card, .cls-card');
  if (options.length) {
    options.forEach((option, index) => animate(option, { opacity: [0, 1], x: [14, 0] },
      { delay: index * 0.035, duration: 0.22, ease: 'ease-out' }));
  }
}

export const Motion = sdtDefine('Motion', Object.freeze({ pop, overlayIn, cancelOverlayIn, reduceMotion, refreshReduceMotion }));

export { overlayIn, cancelOverlayIn, pop, reduceMotion, refreshReduceMotion, resolveReducedMotion };
