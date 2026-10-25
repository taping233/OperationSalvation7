// Local character-browser motion; never changes selection or storage itself.
import { motionTiming, motionEasing, motionReduced as reduced } from './motion-presets.js';
import { linkedAnimate } from './home-linked-interactions.js';
import { createLatestPageMotion } from './latest-page-motion.js';
import { prepareVisualImages } from './visual-image-preparation.js';
import { createPageSurfaceLifetime } from './page-surface-lifetime.js';
import { createVisualRecoveryNotice } from './visual-resource-recovery.js';
export function createCharacterViewMotion({ isCurrent = /** @type {() => boolean} */ (() => true) } = {}) {
  const previews = new WeakMap();
  const portraitRequests = new WeakMap();
  const swaps = new WeakMap();
  const navigation = createLatestPageMotion({
    getRoot:() => document.querySelector('#overlay .cls2-page, #overlay .cls-pool-page'), isCurrent,
  });

  function preparePortrait(owner, current, next, ready, requests) {
    requests.get(owner)?.dispose();
    // Template contents have an inert document: their images cannot load/decode
    // until adopted, even with loading="eager". Keep the adopted artwork detached.
    if (next.ownerDocument !== current.ownerDocument) current.ownerDocument.adoptNode(next);
    let disposed = false, loading = false, controller, notice = null, lifetime;
    const valid = () => !disposed && requests.get(owner) === request && current.isConnected && isCurrent();
    const dispose = () => {
      if (disposed) return;
      disposed = true; controller?.abort(); lifetime?.dispose(); notice?.panel.remove();
      if (requests.get(owner) === request) {
        requests.delete(owner); delete current.dataset.portraitPreparation;
      }
    };
    const start = () => {
      if (!valid()) { dispose(); return; }
      if (loading) return;
      loading = true; current.dataset.portraitPreparation = 'loading';
      if (notice) { notice.message.textContent = '正在准备立绘…'; notice.button.disabled = true; }
      // A manual retry restarts failed detached images without touching the displayed artwork.
      for (const image of next.querySelectorAll('img[data-visual-state="unavailable"]')) {
        const src = image.getAttribute('src'), srcset = image.getAttribute('srcset');
        image.removeAttribute('src'); image.removeAttribute('srcset');
        if (src) image.setAttribute('src', src);
        if (srcset) image.setAttribute('srcset', srcset);
      }
      controller = new AbortController();
      prepareVisualImages(next, { signal:controller.signal }).then(status => {
        if (!valid()) { dispose(); return; }
        loading = false;
        if (status === 'cancelled') { dispose(); return; }
        if (status === 'ready') {
          const restoreFocus = notice?.panel.contains(document.activeElement);
          try { ready(); } finally { dispose(); }
          if (restoreFocus && isCurrent()) {
            /** @type {HTMLElement} */ (document.querySelector('#overlay .cls2-face.sel, #overlay .cls2-confirm'))?.focus({ preventScroll:true });
          }
          return;
        }
        current.dataset.portraitPreparation = 'unavailable';
        notice ||= createVisualRecoveryNotice({ host:current, floating:true,
          label:'新立绘暂未加载，当前画面已保留', onRetry:start });
        notice.message.textContent = '新立绘暂未加载，当前画面已保留'; notice.button.disabled = false;
      });
    };
    const request = { dispose };
    requests.set(owner, request);
    lifetime = createPageSurfaceLifetime(current, { onInvalidate:dispose });
    start();
    return request;
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
    previews.get(target)?.cancel();
    preparePortrait(target, target, target, () => {
      if (reduced()) return;
      const fade = linkedAnimate(target, [
        { opacity: .15, transform: `translateX(${Math.sign(direction) * 36}px)` },
        { opacity: 1, transform: 'none' },
      ], { duration: motionTiming.regionEnter, easing: motionEasing.enter });
      previews.set(target, fade);
      fade.finished.catch(() => {});
    }, portraitRequests);
  }

  function swapPortrait(current, next, direction = 0) {
    if (!current || !next) return;
    const parent = current.parentElement;
    if (!parent) return;
    let request;
    next.querySelectorAll('[data-portrait-outgoing]').forEach(node => node.remove());
    const commit = () => {
      if (!current.isConnected || swaps.get(parent) !== request) return;
      if (reduced() || typeof next.animate !== 'function') { current.replaceWith(next); return; }
      const surface = /** @type {HTMLElement} */ (current.querySelector('.roster-art-surface'));
      const replacement = /** @type {HTMLElement} */ (next.querySelector('.roster-art-surface'));
      if (direction === 0 && surface && replacement) {
        // 换肤保留原画框与待机进度，只有内部画面短距离交叠滑动。
        /** @type {NodeListOf<HTMLElement>} */ (current.querySelectorAll('[data-portrait-outgoing]')).forEach(node => node.remove());
        const idle = /** @type {HTMLElement} */ (surface.querySelector('.art-figure-wrap'))?.getAnimations?.()
          .find(animation => ('animationName' in animation && typeof animation.animationName === 'string' ? animation.animationName : '')?.startsWith('idle'));
        const idleTime = idle?.currentTime;
        // Freeze the outgoing layout before default/scene selectors change it.
        for (const image of /** @type {NodeListOf<HTMLElement>} */ (surface.querySelectorAll('img'))) {
          const layout = getComputedStyle(image);
          const snapshot = ['display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'max-width', 'max-height', 'translate', 'object-fit', 'object-position']
            .map(property => [property, layout.getPropertyValue(property)]);
          for (const [property, value] of snapshot) image.style.setProperty(property, value);
        }
        surface.style.setProperty('--skin-focus', getComputedStyle(current).getPropertyValue('--skin-focus') || 'center');
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
        linkedAnimate(replacement, [{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }],
          { duration: motionTiming.regionEnter, easing: motionEasing.enter });
        const fade = linkedAnimate(surface, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-24px)' }],
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
    request = preparePortrait(parent, current, next, commit, swaps);
  }

  return Object.freeze({ page:navigation.page, cancelPage:navigation.cancel,
    preview, portrait, swapPortrait, enter, get busy() { return navigation.busy; } });
}
