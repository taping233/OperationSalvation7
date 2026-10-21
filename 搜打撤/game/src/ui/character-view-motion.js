// Local character-browser motion; never changes selection or storage itself.
import { motionTiming, motionEasing } from './motion-presets.js';
import { linkedAnimate } from './home-linked-interactions.js';
export function createCharacterViewMotion() {
  let switching = false;
  const previews = new WeakMap();
  const portraitRequests = new WeakMap();
  const swaps = new WeakMap();
  const reduced = () => document.body.classList.contains('reduce-motion')
    || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

  function page(commit) {
    if (switching) return false;
    const root = /** @type {HTMLElement} */ (document.querySelector('#overlay .cls2-page, #overlay .cls-pool-page'));
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
    const root = /** @type {HTMLElement} */ (document.querySelector('#overlay .cls2-page, #overlay .cls-pool-page'));
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
    const target = /** @type {HTMLElement} */ (element?.querySelector('.art-figure-wrap')) || element;
    if (!target || reduced() || typeof target.animate !== 'function') return;
    const request = {};
    portraitRequests.set(target, request);
    previews.get(target)?.cancel();
    const images = [.../** @type {NodeListOf<HTMLImageElement>} */ (target.querySelectorAll('img'))];
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

  function swapPortrait(current, next, direction = 0) {
    if (!current || !next) return;
    const parent = current.parentElement;
    if (!parent) return;
    const request = {};
    swaps.set(parent, request);
    if (reduced() || typeof next.animate !== 'function') {
      current.replaceWith(next);
      return;
    }
    const commit = () => {
      if (!current.isConnected || swaps.get(parent) !== request) return;
      if (reduced()) { current.replaceWith(next); return; }
      const surface = /** @type {HTMLElement} */ (current.querySelector('.roster-art-surface'));
      const replacement = /** @type {HTMLElement} */ (next.querySelector('.roster-art-surface'));
      if (direction === 0 && surface && replacement) {
        // 换肤保留原画框；两张图共用同一坐标，待机进度也连续。
        /** @type {NodeListOf<HTMLElement>} */ (current.querySelectorAll('[data-portrait-outgoing]')).forEach(node => node.remove());
        const idle = /** @type {HTMLElement} */ (surface.querySelector('.art-figure-wrap'))?.getAnimations?.()
          .find(animation => ('animationName' in animation && typeof animation.animationName === 'string' ? animation.animationName : '')?.startsWith('idle'));
        const idleTime = idle?.currentTime;
        current.dataset.skin = next.dataset.skin;
        surface.before(replacement);
        if (idleTime != null) {
          /** @type {HTMLElement} */ (replacement.querySelector('.art-figure-wrap'))?.getAnimations?.()
            .filter(animation => 'animationName' in animation && 'animationName' in idle && animation.animationName === idle.animationName)
            .forEach(animation => { animation.currentTime = idleTime; });
        }
        surface.dataset.portraitOutgoing = 'true';
        surface.setAttribute('aria-hidden', 'true');
        surface.style.pointerEvents = 'none';
        surface.style.zIndex = '2';
        linkedAnimate(replacement, [{ opacity: 0 }, { opacity: 1 }],
          { duration: motionTiming.regionEnter, easing: motionEasing.enter });
        const fade = linkedAnimate(surface, [{ opacity: 1 }, { opacity: 0 }],
          { duration: motionTiming.regionEnter, easing: motionEasing.enter, fill: 'forwards' });
        fade?.finished.then(() => surface.remove(), () => surface.remove());
        return;
      }
      const outgoing = current.cloneNode(true);
      /** @type {NodeListOf<HTMLElement>} */ (outgoing.querySelectorAll('[data-portrait-outgoing]')).forEach(node => node.remove());
      outgoing.dataset.portraitOutgoing = 'true';
      outgoing.setAttribute('aria-hidden', 'true');
      outgoing.style.cssText += ';position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';
      current.replaceWith(next);
      next.append(outgoing);
      const incoming = /** @type {HTMLElement} */ (next.querySelector('.art-figure-wrap')) || /** @type {HTMLImageElement} */ (next.querySelector('img')) || next;
      const offset = Math.sign(direction) * 14;
      linkedAnimate(incoming, [
        { opacity: 0, transform: `translateX(${offset}px)` },
        { opacity: 1, transform: 'none' },
      ], { duration: motionTiming.regionEnter, easing: motionEasing.enter });
      const fade = linkedAnimate(outgoing, [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: `translateX(${-offset}px)` },
      ], { duration: motionTiming.regionEnter, easing: motionEasing.enter, fill: 'forwards' });
      fade?.finished.then(() => outgoing.remove(), () => outgoing.remove());
    };
    // Keep the visible portrait until its replacement is decoded; only the latest click wins.
    Promise.all([.../** @type {NodeListOf<HTMLImageElement>} */ (next.querySelectorAll('img'))].map(image => image.decode?.().catch(() => {}) ?? Promise.resolve()))
      .then(commit);
  }

  return Object.freeze({ page, preview, portrait, swapPortrait, enter, get busy() { return switching; } });
}
