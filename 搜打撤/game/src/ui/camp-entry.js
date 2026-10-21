// 基地初次展开独立编排；只保留选档画面的短暂装饰副本，不接管存档或焦点。
import '../../css/camp-entry.css';
import { waitPageVisual } from './page-visual-ready.js';
import { createPageSurfaceLifetime } from './page-surface-lifetime.js';
import { mapImageReady } from '../core/map-image-ready.js';
import { GENERAL_TRANSITION_ART } from './general-transition.js';
const CUT_SCENES = {
  camp: new URL('../../assets/scenes/transition-camp-v2.webp', import.meta.url).href,
  photo: new URL('../../assets/scenes/transition-photo-v2.webp', import.meta.url).href,
  field: new URL('../../assets/scenes/transition-field-v2.webp', import.meta.url).href,
  general: GENERAL_TRANSITION_ART,
  battle: GENERAL_TRANSITION_ART,
  boss: GENERAL_TRANSITION_ART,
  achievement: new URL('../../assets/scenes/transition-achievement-v2.webp', import.meta.url).href,
};
// 各目的页小图随模块预热，首次切幕出现前即可加载。
for (const src of new Set(Object.values(CUT_SCENES))) {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
}

let cleanup = null;
const identities = new WeakMap();

export function clearCampEntry() {
  cleanup?.();
  cleanup = null;
}

export function captureArchiveExit(body) {
  const picker = body?.querySelector('.slot-page');
  if (!picker) return null;
  const cards = [...picker.querySelectorAll('.slot-card')];
  const picked = picker.querySelector('[data-archive-picked]')
    || document.activeElement?.closest?.('.slot-card')
    || picker.querySelector('.slot-card:hover');
  const bounds = picker.getBoundingClientRect();
  const name = picked?.querySelector('.slot-card-name');
  const copy = picker.cloneNode(true);
  copy.classList.add('camp-entry-ghost');
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  Object.assign(copy.style, {
    position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`,
    right: 'auto', bottom: 'auto', width: `${bounds.width}px`, height: `${bounds.height}px`,
  });
  copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  copy.querySelectorAll('[data-act]').forEach(el => el.removeAttribute('data-act'));
  const index = cards.indexOf(picked);
  if (index >= 0) copy.querySelectorAll('.slot-card')[index]?.classList.add('archive-picked');
  if (name) {
    const style = getComputedStyle(name);
    identities.set(copy, { text: name.textContent, rect: name.getBoundingClientRect(),
      font: style.font, fontSize: parseFloat(style.fontSize), color: style.color, letterSpacing: style.letterSpacing });
    copy.querySelector('.archive-picked .slot-card-name')?.classList.add('camp-identity-source');
  }
  return copy;
}

function transferIdentity(overlay, ghost) {
  const from = identities.get(ghost);
  const target = overlay.querySelector('.hub-slot-label');
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

// 共用斜切编排，画面、文案与水印按目的页选择。
export function createCityCut({ archive = '基地档案', title = '返回基地',
  subtitle = 'BASE CAMP / 冬日远征档案室', edition = 'WINTER EXPEDITION / VII',
  destination = 'BASE CAMP', watermark = 'BASE', scene = 'camp' } = {}) {
  const cut = document.createElement('div');
  cut.className = 'camp-entry-cut';
  cut.setAttribute('aria-hidden', 'true');
  cut.inert = true;
  const caption = document.createElement('div');
  caption.className = 'camp-entry-caption';
  const label = document.createElement('small');
  label.textContent = archive;
  const heading = document.createElement('strong');
  heading.textContent = title;
  const sub = document.createElement('span');
  sub.textContent = subtitle;
  caption.append(label, heading, sub);
  const register = document.createElement('div');
  register.className = 'camp-entry-register';
  register.dataset.watermark = watermark;
  const issue = document.createElement('small');
  issue.textContent = edition;
  const folio = document.createElement('span');
  folio.textContent = `${archive} / ${destination}`;
  register.append(issue, folio);
  const scenery = document.createElement('div');
  scenery.className = 'camp-entry-scenery';
  const image = document.createElement('img');
  image.src = CUT_SCENES[scene] || CUT_SCENES.camp;
  image.style.objectPosition = 'center';
  image.alt = '';
  image.decoding = 'async';
  scenery.append(image);
  cut.append(scenery, register, caption);
  return cut;
}

export const cityCutDuration = 980;

// The curtain's own artwork must be ready before the destination is revealed.
// A failed decorative image falls back to the cut's opaque colour and lettering.
export async function prepareCityCut(cut, { signal } = {}) {
  const image = cut?.querySelector('.camp-entry-scenery img');
  if (!image || signal?.aborted) return false;
  const ready = await mapImageReady(image, { signal, timeout: 3000 });
  if (signal?.aborted) return false;
  if (!ready) { image.style.display = 'none'; cut.dataset.scenery = 'fallback'; }
  return true;
}

// A mounted city cut holds its first pose until the destination's representative assets settle.
export function playPreparedCut(page, cut, duration = cityCutDuration, onFinish) {
  const overlay = page?.closest('#overlay');
  const card = page?.closest('.card');
  if (!overlay || !card) return () => {};
  const controller = new AbortController();
  let timer;
  let finished = false;
  cut.classList.add('page-cut-waiting');
  card.append(cut);
  const finish = () => {
    if (finished) return;
    finished = true; controller.abort(); clearTimeout(timer);
    lifetime.dispose(); cut.remove(); onFinish?.();
  };
  const lifetime = createPageSurfaceLifetime(page, { overlay, onInvalidate: finish });
  // Match the other destination gates; the cut artwork has its own readiness.
  const body = page.closest('#ovBody') || page;
  Promise.all([prepareCityCut(cut, { signal: controller.signal }),
    waitPageVisual(body, { signal: controller.signal, background: window.SDT?.UI?._pageBgReady })])
    .then(([cutReady, ready]) => {
      if (!cutReady || !ready || finished || !lifetime.current()) { finish(); return; }
      cut.classList.remove('page-cut-waiting');
      timer = setTimeout(finish, duration);
    }).catch(finish);
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
  overlay.querySelector('#hubMain .hub-page')?.classList.remove('page-in');
  if (reduced) return;
  // 先取目标位置，再挂入场标记，避免把目标的暂时位移当作落点。
  let removeIdentity = null;
  overlay.dataset.campEntry = 'preparing';
  const card = overlay.querySelector('#ovBody')?.parentElement;
  if (ghost && card) card.appendChild(ghost);
  // 切面承接旧页和基地，装饰层不参与点击、焦点或业务等待。
  const cut = card ? createCityCut({ archive: ghost && identities.get(ghost)?.text || '基地档案' }) : null;
  if (cut) { cut.classList.add('page-cut-waiting'); card.append(cut); }
  const controller = new AbortController();
  let timer;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    controller.abort();
    ghost?.remove();
    cut?.remove();
    removeIdentity?.();
    if (cleanup === finish) { delete overlay.dataset.campEntry; cleanup = null; }
  };
  cleanup = finish;
  // The archive ghost and cut are presentation copies, not destination assets.
  waitCampVisual(overlay, cut ? prepareCityCut(cut, { signal: controller.signal }) : true,
    { signal: controller.signal, isCurrent: () => cleanup === finish })
    .then(ready => {
      if (!ready || cleanup !== finish || !overlay.querySelector('#hubMain')) { finish(); return; }
      overlay.dataset.campEntry = '1';
      cut?.classList.remove('page-cut-waiting');
      removeIdentity = ghost ? transferIdentity(overlay, ghost) : null;
      timer = setTimeout(finish, cityCutDuration);
    }).catch(finish);
}
