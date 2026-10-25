// 完整插画过场视图与基地入口适配；准备和揭幕由 transition-handoff 统一控制。
import '../../css/camp-entry.css';
import { waitPageVisual } from './page-visual-ready.js';
import { createPageSurfaceLifetime } from './page-surface-lifetime.js';
import { createSilentNodeCut, prepareSilentFilm } from './silent-node-film.js';
import { revealTransition } from './transition-handoff.js';
import { pageMotionProfile } from './page-motion-profiles.js';
// Load artwork only for the cut that is actually requested; prepareCityCut owns readiness.

let cleanup = null;
const identities = new WeakMap();

export function clearCampEntry() {
  cleanup?.();
  cleanup = null;
}

export function captureArchiveExit(body) {
  const picker = /** @type {HTMLElement} */ (body?.querySelector('.slot-page'));
  if (!picker) return null;
  const cards = [.../** @type {NodeListOf<HTMLElement>} */ (picker.querySelectorAll('.slot-card'))];
  const picked = /** @type {HTMLElement} */ (picker.querySelector('[data-archive-picked]'))
    || document.activeElement?.closest?.('.slot-card')
    || /** @type {HTMLElement} */ (picker.querySelector('.slot-card:hover'));
  const bounds = picker.getBoundingClientRect();
  const name = /** @type {HTMLElement} */ (picked?.querySelector('.slot-card-name'));
  const copy = /** @type {HTMLElement} */ (picker.cloneNode(true));
  copy.classList.add('camp-entry-ghost');
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  Object.assign(copy.style, {
    position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`,
    right: 'auto', bottom: 'auto', width: `${bounds.width}px`, height: `${bounds.height}px`,
  });
  /** @type {NodeListOf<HTMLElement>} */ (copy.querySelectorAll('[id]')).forEach(el => el.removeAttribute('id'));
  /** @type {NodeListOf<HTMLElement>} */ (copy.querySelectorAll('[data-act]')).forEach(el => el.removeAttribute('data-act'));
  const index = cards.indexOf(picked);
  if (index >= 0) /** @type {NodeListOf<HTMLElement>} */ (copy.querySelectorAll('.slot-card'))[index]?.classList.add('archive-picked');
  if (name) {
    const style = getComputedStyle(name);
    identities.set(copy, { text: name.textContent, rect: name.getBoundingClientRect(),
      font: style.font, fontSize: parseFloat(style.fontSize), color: style.color, letterSpacing: style.letterSpacing });
    /** @type {HTMLElement} */ (copy.querySelector('.archive-picked .slot-card-name'))?.classList.add('camp-identity-source');
  }
  return copy;
}

function transferIdentity(overlay, ghost) {
  const from = identities.get(ghost);
  const target = /** @type {HTMLElement} */ (overlay.querySelector('.hub-slot-label'));
  const to = target?.getBoundingClientRect();
  if (!from?.rect.width || !to?.width) return null;
  const style = getComputedStyle(target);
  const identity = document.createElement('span');
  identity.className = 'camp-entry-identity';
  identity.textContent = from.text;
  identity.setAttribute('aria-hidden', 'true');
  identity.inert = true;
  Object.assign(identity.style, { left: `${from.rect.left}px`, top: `${from.rect.top}px`,
    font: from.font, color: from.color, letterSpacing: from.letterSpacing });
  document.body.appendChild(identity);
  const scale = from.fontSize ? parseFloat(style.fontSize) / from.fontSize : 1;
  const motion = identity.animate?.([
    { opacity: 1, transform: 'none', offset: 0 },
    { opacity: 1, transform: 'scale(1.04)', offset: .16 },
    { opacity: 1, color: style.color,
      transform: `translate(${to.left - from.rect.left}px,${to.top - from.rect.top}px) scale(${scale})`, offset: .84 },
    { opacity: 0, color: style.color,
      transform: `translate(${to.left - from.rect.left}px,${to.top - from.rect.top}px) scale(${scale})`, offset: 1 },
  ], { duration: 680, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
  return () => { motion?.cancel(); identity.remove(); };
}

// Existing page adapters retain their readiness/lifetime API; the public film
// selects symbolic imagery and motion, with no decorative words or folios.
/** @param {{archive?:string,title?:string,subtitle?:string,edition?:string,destination?:string,watermark?:string,scene?:string}} [options] */
export function createCityCut({archive='基地档案',title='返回基地',subtitle='',scene='camp'}={}) {
  const cut=createSilentNodeCut(scene==='general' ? 'loading' : scene);
  cut.setAttribute('aria-label',`${archive} / ${title}${subtitle ? ` / ${subtitle}` : ''}`);
  return cut;
}

export const cityCutDuration = 980;

// The curtain's own artwork must be ready before the destination is revealed.
// A failed decorative image falls back to the cut's opaque colour.
/** @param {HTMLElement} cut @param {{signal?: AbortSignal,deferPlayback?:boolean}} [options] */
export async function prepareCityCut(cut, { signal, deferPlayback=false } = {}) {
  return prepareSilentFilm(cut,{signal,deferPlayback});
}

// A mounted city cut holds its first pose until the destination's representative assets settle.
export function playPreparedCut(page, cut, duration = cityCutDuration, onFinish) {
  // 成就保留独立荣誉档案过场；其他普通导航仍不使用场景遮幕。
  const profile = pageMotionProfile(page?.closest('#ovBody'));
  if (profile?.navigation && profile.key !== 'achievements') {
    cut.remove();
    onFinish?.();
    return () => {};
  }
  // A cold-entry cover already owns readiness and reveal for this route.
  const loading = document.querySelector('.page-loading');
  if (loading) {
    cut.classList.add('page-cut-waiting');
    loading.querySelector('.camp-entry-cut')?.remove();
    loading.append(cut);
    return () => {};
  }
  const overlay = page?.closest('#overlay');
  const card = page?.closest('.card');
  if (!overlay || !card) return () => {};
  const controller = new AbortController();
  let finished = false;
  cut.classList.add('page-cut-waiting');
  card.append(cut);
  const finish = () => {
    if (finished) return;
    finished = true; controller.abort();
    lifetime.dispose(); cut.remove(); onFinish?.();
  };
  const lifetime = createPageSurfaceLifetime(page, { overlay, onInvalidate: finish });
  // Match the other destination gates; the cut artwork has its own readiness.
  const body = page.closest('#ovBody') || page;
  const preparation = Promise.all([prepareCityCut(cut, { signal:controller.signal }),
    waitPageVisual(body, { signal:controller.signal, background:window.SDT?.UI?._pageBgReady })]);
  revealTransition(cut, { signal:controller.signal, isCurrent:() => !finished && lifetime.current(),
    duration,
    ready:async () => (await preparation).every(Boolean),
    onReveal:() => cut.classList.remove('page-cut-waiting'),
  }).then(finish, finish);
  return finish;
}

// 成就首次打开使用独立荣誉档案切幕，关闭或换页即清理装饰层。
export function enterAchievementCut(page, reduced) {
  const overlay = page?.closest('#overlay');
  const card = page?.closest('.card');
  if (reduced || !overlay || !card) return () => {};
  const cut = createCityCut({ scene: 'achievement', archive: '荣誉档案', title: '成就总览',
    subtitle: 'ACHIEVEMENTS / 远征荣誉陈列', destination: 'ACHIEVEMENTS', watermark: 'HONOR' });
  return playPreparedCut(page, cut);
}

// Base data may refresh the mounted hub before the initial curtain is ready.
// Follow that new surface under the same curtain, but never reveal a later route.
async function waitCampVisual(overlay, artwork, { signal, isCurrent }) {
  const active = () => !signal.aborted && isCurrent() && overlay.isConnected
    && !overlay.hidden && !overlay.dataset.uiClosing && !overlay.classList.contains('closing')
    && !!overlay.querySelector('#hubMain');
  while (active()) {
    const body = overlay.querySelector('#ovBody') || overlay;
    const page = body.firstElementChild || body;
    const ui = window.SDT?.UI;
    const controller = new AbortController();
    let invalidate;
    const invalidated = new Promise(resolve => { invalidate = resolve; });
    const stop = () => { controller.abort(); invalidate(); };
    signal.addEventListener('abort', stop, { once: true });
    const lifetime = createPageSurfaceLifetime(page, { overlay,
      getRevision: () => ui?._overlayRevision, onInvalidate: stop });
    try {
      const ready = await Promise.race([invalidated, Promise.all([artwork,
        waitPageVisual(body, { signal: controller.signal, background: ui?._pageBgReady, revisionOwner: ui }),
      ])]);
      if (ready?.every(Boolean) && lifetime.current()) return true;
      if (ready && !ready[0]) return false;
    } finally {
      signal.removeEventListener('abort', stop);
      lifetime.dispose(); controller.abort();
    }
  }
  return false;
}

export function enterCamp(overlay, ghost, reduced) {
  clearCampEntry();
  // 首次进入仅由本模块展开；临时编排结束后不能恢复 page-in 再播一遍。
  /** @type {HTMLElement} */ (overlay.querySelector('#hubMain .hub-page'))?.classList.remove('page-in');
  if (reduced) return;
  const loading = document.querySelector('.page-loading');
  if (loading) {
    const cut = createCityCut({ archive:ghost && identities.get(ghost)?.text || '基地档案' });
    cut.classList.add('page-cut-waiting');
    loading.querySelector('.camp-entry-cut')?.remove();
    loading.append(cut);
    ghost?.remove();
    return;
  }
  // 先取目标位置，再挂入场标记，避免把目标的暂时位移当作落点。
  let removeIdentity = null;
  overlay.dataset.campEntry = 'preparing';
  const card = /** @type {HTMLElement} */ (overlay.querySelector('#ovBody'))?.parentElement;
  if (ghost && card) card.appendChild(ghost);
  // 切面承接旧页和基地，装饰层不参与点击、焦点或业务等待。
  const cut = card ? createCityCut({ archive: ghost && identities.get(ghost)?.text || '基地档案' }) : null;
  if (cut) { cut.classList.add('page-cut-waiting'); card.append(cut); }
  const controller = new AbortController();
  let finished = false;
  let routeObserver;
  const finish = () => {
    if (finished) return;
    finished = true;
    controller.abort();
    routeObserver?.disconnect();
    ghost?.remove();
    cut?.remove();
    removeIdentity?.();
    if (cleanup === finish) { delete overlay.dataset.campEntry; cleanup = null; }
  };
  cleanup = finish;
  if (!cut) { finish(); return; }
  routeObserver = new MutationObserver(() => {
    if (!overlay.isConnected || overlay.hidden || !overlay.querySelector('#hubMain')) finish();
  });
  routeObserver.observe(overlay, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden'] });
  // The archive ghost and cut are presentation copies, not destination assets.
  const preparation = waitCampVisual(overlay, prepareCityCut(cut, { signal:controller.signal }),
    { signal:controller.signal, isCurrent:() => cleanup === finish });
  revealTransition(cut, { signal:controller.signal,
    isCurrent:() => cleanup === finish && !!overlay.querySelector('#hubMain'),
    ready:() => preparation,
    onReveal:() => {
      overlay.dataset.campEntry = '1';
      cut?.classList.remove('page-cut-waiting');
      ghost?.remove();
      removeIdentity = ghost ? transferIdentity(overlay, ghost) : null;
    },
  }).then(finish, finish);
}
