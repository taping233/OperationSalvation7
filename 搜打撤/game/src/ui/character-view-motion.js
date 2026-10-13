// Local character-browser motion; never changes selection or storage itself.
import { motionTiming, motionEasing } from './motion-presets.js';
import { linkedAnimate } from './home-linked-interactions.js';
export function createCharacterViewMotion() {
  let switching = false;
  const previews = new WeakMap();
  const portraitRequests = new WeakMap();
  const reduced = () => document.body.classList.contains('reduce-motion')
    || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

  function page(commit) {
    if (switching) return false;
    const root = document.querySelector('#overlay .cls2-page, #overlay .cls-pool-page');
    if (!root || reduced() || typeof root.animate !== 'function') {
      commit();
      return true;
    }
    switching = true;
    root.dataset.characterView = 'out';
    const current = getComputedStyle(root);
    const fade = linkedAnimate(root, [
      { opacity: current.opacity, transform: current.transform },
      { opacity: 0, transform: 'translateY(-8px)' },
    ], { duration: motionTiming.exit, easing: motionEasing.exit, fill: 'forwards' });
    // Navigation follows a bounded UI clock: hidden/captured pages can pause
    // or cancel native animations without delivering a finished event.
    window.setTimeout(() => {
      const overlay = document.getElementById('overlay');
      const active = root.isConnected && overlay && !overlay.hidden && !overlay.classList.contains('closing');
      switching = false;
      delete root.dataset.characterView;
      fade.cancel();
      if (active) commit();
    }, motionTiming.exit);
    fade.finished.catch(() => {});
    return true;
  }

  function preview(element) {
    if (!element || reduced() || typeof element.animate !== 'function') return;
    previews.get(element)?.cancel();
    const fade = linkedAnimate(element, [
      { opacity: .4, transform: 'translateY(4px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: motionTiming.feedback, easing: motionEasing.enter });
    previews.set(element, fade);
    fade.finished.catch(() => {});
  }

  function enter() {
    const root = document.querySelector('#overlay .cls2-page, #overlay .cls-pool-page');
    if (!root || reduced() || typeof root.animate !== 'function') return;
    // 共用分区入场已展开时，不能再在祖先叠加整页淡入。
    if (root.closest('[data-surface-layout="character"], [data-surface-layout="card-pool"]')) return;
    const fade = linkedAnimate(root, [
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: motionTiming.change, easing: motionEasing.enter });
    fade.finished.catch(() => {});
  }

  function portrait(element, direction = 1) {
    const target = element?.querySelector('.art-figure-wrap') || element;
    if (!target || reduced() || typeof target.animate !== 'function') return;
    const request = {};
    portraitRequests.set(target, request);
    previews.get(target)?.cancel();
    const images = [...target.querySelectorAll('img')];
    Promise.all(images.map(image => image.decode?.().catch(() => {}) ?? Promise.resolve())).then(() => {
      if (!target.isConnected || reduced() || portraitRequests.get(target) !== request) return;
      const fade = linkedAnimate(target, [
        { opacity: .15, transform: `translateX(${Math.sign(direction) * 36}px)` },
        { opacity: 1, transform: 'none' },
      ], { duration: motionTiming.regionEnter, easing: motionEasing.enter });
      previews.set(target, fade);
      fade.finished.catch(() => {});
    });
  }

  return Object.freeze({ page, preview, portrait, enter, get busy() { return switching; } });
}
