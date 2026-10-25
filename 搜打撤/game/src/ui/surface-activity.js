import { motionReduced } from './motion-presets.js';

// Visibility ownership is independent of routes. Observe the retained surface's
// ancestors, not every changing card or animated inline style in the document.
/** @param {HTMLElement} root
 * @param {{isActive?: () => boolean, extraRoots?: HTMLElement[], onChange?: (active: boolean) => void, onRefresh?: (active: boolean) => void}} [options] */
export function watchSurfaceActivity(root, { isActive = () => true, extraRoots = [],
  onChange = () => {}, onRefresh = () => {} } = {}) {
  const document = root.ownerDocument, window = document.defaultView;
  let active, disposed = false, suspended = false, queued = false;
  let watchedBlockers = new Set();
  const blockers = '.action-confirmation:not(.confirmation-leaving),.page-loading:not(.leaving),'
    + '[data-dialog-surface]:not([hidden]):not([inert]),#sugLayer:not([hidden]):not([inert]):not(.scr-out)';
  const refresh = () => {
    queued = false;
    if (disposed) return;
    // One discovery pass serves both subscriptions and the active blocker check.
    const candidates = document.querySelectorAll('.action-confirmation,.page-loading,[data-dialog-surface],#sugLayer');
    let blockersChanged = candidates.length !== watchedBlockers.size;
    if (!blockersChanged) for (const node of candidates) {
      if (!watchedBlockers.has(node)) { blockersChanged = true; break; }
    }
    if (blockersChanged) {
      blockerObserver.disconnect();
      watchedBlockers = new Set(candidates);
      for (const blocker of watchedBlockers) {
        blockerObserver.observe(blocker, { attributes:true, attributeFilter:['class','hidden','inert','data-dialog-surface'] });
      }
    }
    let blocked = false;
    for (const node of candidates) {
      if (node.matches(blockers) && node !== root && !node.contains(root) && !node.closest('[hidden]')) { blocked = true; break; }
    }
    const next = !!root?.isConnected && !document.hidden && !suspended
      && !root.closest('[hidden],[inert],[aria-hidden="true"],.closing,[data-ui-closing],[data-visual-pending]')
      && !blocked && isActive();
    if (next !== active) {
      active = next;
      root.dataset.uiActivity = active ? 'active' : 'paused';
      onChange(active);
    }
    onRefresh(active);
  };
  const schedule = () => { if (!queued && !disposed) { queued = true; queueMicrotask(refresh); } };
  const observer = new MutationObserver(schedule);
  const blockerObserver = new MutationObserver(schedule);
  for (let host = root; host; host = host.parentElement) {
    observer.observe(host, { attributes:true, childList:host !== root, attributeFilter:[
      'class','hidden','inert','aria-hidden','open','data-ui-closing','data-visual-pending','data-home-phase','data-dialog-surface',
    ] });
  }
  for (const host of extraRoots) if (host) observer.observe(host, {
    attributes:true, attributeFilter:['class','hidden','inert','open'],
  });
  const hide = () => { suspended = true; refresh(); };
  const show = () => { suspended = false; refresh(); };
  document.addEventListener('visibilitychange', refresh);
  const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  preference?.addEventListener('change', refresh);
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    blockerObserver.disconnect();
    watchedBlockers.clear();
    document.removeEventListener('visibilitychange', refresh);
    preference?.removeEventListener('change', refresh);
    window.removeEventListener('pagehide', hide);
    window.removeEventListener('pageshow', show);
    delete root.dataset.uiActivity;
  };
  refresh();
  return { refresh, active:() => !!active, dispose };
}

// Only media that this controller paused may resume; finite navigation motion
// remains with its existing completion owner. Replaced media sources stay stopped.
export function manageSurfaceActivity(root) {
  const document = root.ownerDocument, window = document.defaultView;
  const media = new Set(root.querySelectorAll('video,audio'));
  const pausedMedia = new Map();
  const loops = new Set();
  const pausedLoops = new Set();
  let active = false, disposed = false, queued = false, reduced = false;
  const sourceOf = node => node.srcObject || node.src || [...node.querySelectorAll('source')]
    .map(source => `${source.src}|${source.type}|${source.media}`).join('\n') || node.currentSrc || '';
  const visible = node => node?.isConnected && root.contains(node)
    && !node.closest('[hidden],[inert],[aria-hidden="true"]')
    && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
  const trackLoop = animation => {
    if (animation.effect?.getTiming().iterations === Infinity) loops.add(animation);
  };
  const syncMembers = () => {
    queued = false;
    if (disposed) return;
    for (const node of media) {
      if (!node.isConnected || !root.contains(node)) { media.delete(node); pausedMedia.delete(node); continue; }
      const available = active && visible(node);
      if (!available && !node.paused && !node.ended) {
        pausedMedia.set(node, sourceOf(node)); node.pause();
      } else if (available && pausedMedia.has(node)) {
        const source = pausedMedia.get(node);
        pausedMedia.delete(node);
        if (sourceOf(node) === source && node.paused && !node.ended) {
          try { node.play()?.catch(() => {}); } catch { /* Autoplay refusal keeps the poster. */ }
        }
      }
    }
    for (const animation of loops) {
      const node = animation.effect?.target;
      if (!node?.isConnected || !root.contains(node) || ['idle','finished'].includes(animation.playState)) {
        loops.delete(animation); pausedLoops.delete(animation); continue;
      }
      const available = active && !motionReduced(document) && visible(node);
      if (!available && animation.playState === 'running') { pausedLoops.add(animation); animation.pause(); }
      else if (available && pausedLoops.has(animation)) {
        pausedLoops.delete(animation);
        if (animation.playState === 'paused') animation.play();
      }
    }
  };
  const schedule = () => { if (!queued && !disposed) { queued = true; queueMicrotask(syncMembers); } };
  const activity = watchSurfaceActivity(root, {
    onChange:value => {
      active = value;
      if (!active) root.getAnimations?.({ subtree:true }).forEach(trackLoop);
      schedule();
    },
    onRefresh:() => {
      const next = motionReduced(document);
      if (active && next && !reduced) root.getAnimations?.({ subtree:true }).forEach(trackLoop);
      reduced = next;
      schedule();
    },
  });
  const addMedia = node => {
    if (!(node instanceof Element)) return;
    if (node.matches('video,audio')) media.add(node);
    node.querySelectorAll('video,audio').forEach(item => media.add(item));
  };
  const affectsMembers = target => {
    for (const node of media) if (target === node || target.contains(node)) return true;
    for (const animation of loops) {
      const node = animation.effect?.target;
      if (node && target.contains(node)) return true;
    }
    return false;
  };
  // Local tab/disclosure changes affect their media, not the whole page. Ignore
  // inline animation styles and unrelated selection classes in large card grids.
  const contentObserver = new MutationObserver(records => {
    let changed = false;
    for (const record of records) {
      if (record.type === 'childList') {
        record.addedNodes.forEach(addMedia);
        if (media.size || loops.size) changed = true;
      } else {
        // Discover an existing native loop only when its region is actually hidden;
        // normal card selection classes never require a full animation enumeration.
        if (record.attributeName !== 'class' && record.target instanceof Element
          && (record.target.matches('[hidden],[inert],[aria-hidden="true"]')
            || record.target.matches('details:not([open])'))) record.target.getAnimations?.({ subtree:true }).forEach(trackLoop);
        if (affectsMembers(record.target)) changed = true;
      }
    }
    if (changed) schedule();
  });
  contentObserver.observe(root, { subtree:true, childList:true, attributes:true,
    attributeFilter:['hidden','inert','aria-hidden','open','class'] });
  const onPlay = event => {
    if (!(event.target instanceof window.HTMLMediaElement)) return;
    media.add(event.target);
    // Stop even a newly started video in a hidden child panel before it can play on.
    if ((!active || !visible(event.target)) && !event.target.paused) {
      pausedMedia.set(event.target, sourceOf(event.target)); event.target.pause();
    }
  };
  const onAnimation = event => {
    if (event.target instanceof Element) { event.target.getAnimations?.().forEach(trackLoop); schedule(); }
  };
  root.addEventListener('play', onPlay, true);
  root.addEventListener('animationstart', onAnimation, true);
  // CSS loops enroll through animationstart; native loops enroll at real pause boundaries.
  schedule();
  return () => {
    disposed = true;
    activity.dispose(); contentObserver.disconnect();
    root.removeEventListener('play', onPlay, true);
    root.removeEventListener('animationstart', onAnimation, true);
    media.clear(); pausedMedia.clear(); loops.clear(); pausedLoops.clear();
  };
}
