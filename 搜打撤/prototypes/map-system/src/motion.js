import { animate } from 'motion/mini';

const SDT = window.SDT = window.SDT || {};
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canAnimate = element => element && typeof element.animate === 'function' && !reduceMotion();

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
  const x = self ? [0, -7, 6, -4, 2, 0] : [0, 9, -7, 5, -2, 0];
  animate(element, { x, scale: [1, 0.97, 1.02, 1] }, { duration: 0.4, ease: 'ease-out' });
  return true;
}

SDT.Motion = Object.freeze({ pop, overlayIn, hit, reduceMotion });

export { hit, overlayIn, pop, reduceMotion };
