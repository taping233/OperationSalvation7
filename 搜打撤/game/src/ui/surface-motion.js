// All navigation surfaces share this choreography. Tune timing and keyframes here.
// Gameplay, focus restoration and actual hiding stay with their existing owners.
import { pageMotionProfile, pageMotionBlocks } from './page-motion-profiles.js';
import { motionTiming, motionEasing } from './motion-presets.js';
import { navigationTiming } from './navigation-motion.js';
import { retargetVisual, clearVisual } from './target-motion.js';
export const surfaceTiming = { enter: motionTiming.pageEnter, stagger: motionTiming.stagger, exit: motionTiming.exit, fastEnter: motionTiming.fastEnter, fastExit: motionTiming.fastExit };

// Keep the logical phase contract, but let ordinary surfaces change visual targets.
// Dedicated archive/loading, home and camp sequences keep their choreography.
const visualSurfaces = new Map();
const dedicatedLayouts = new Set(['archives', 'base-content', 'preparation', 'departure']);

function releaseVisual(root) {
  const state = visualSurfaces.get(root);
  if (!state) return;
  for (const [el, saved] of state.elements) {
    clearVisual(el);
    if (saved.animation) el.style.setProperty('animation', saved.animation, saved.priority);
    else el.style.removeProperty('animation');
    delete el.dataset.surfaceTarget;
  }
  visualSurfaces.delete(root);
}

function targetSurface(root, regions, profile, fast, restart, phase) {
  // Fast close preparation can omit the page profile. Read the live content too,
  // so archive dealing and saved-run cuts never receive inline animation:none.
  const dedicatedScene = root.id === 'overlay' && root.querySelector(
    '#ovBody .slot-page:not(.camp-entry-ghost), #ovBody .city-run-transition, #ovBody .expedition-cut',
  );
  if (root.id === 'title' || dedicatedLayouts.has(profile?.key) || dedicatedScene) {
    releaseVisual(root);
    return;
  }
  if (reduced()) { releaseVisual(root); return; }
  let state = visualSurfaces.get(root);
  const reversing = phase === 'out' || state?.leaving;
  const continuing = !!state && (!restart || reversing);
  const preparingExit = root.dataset.uiClosing === '1' || root.dataset.uiMotionScreen === 'close';
  if (!state) {
    state = { elements: new Map() };
    visualSurfaces.set(root, state);
  }
  state.leaving = false;
  const duration = fast ? surfaceTiming.fastEnter
    : profile?.duration ?? (root.dataset.uiMotion === 'panel' || root.dataset.uiMotion === 'confirm'
      ? motionTiming.detailEnter : surfaceTiming.enter);
  const entries = new Map();
  const panel = root.id === 'overlay' ? root.querySelector(':scope > .card') : root;
  // One opacity owner per content chain: the surface reveals/hides the whole layer.
  // Shells and regions only move, so their alpha curves cannot multiply the veil.
  entries.set(root, { from: { opacity: profile ? 1 : 0 }, target: { opacity: 1 }, exit: { opacity: 0 }, delay: 0 });
  if (panel) {
    const shell = {
      from: profile ? { y: 0, scale: 1 } : { y: 10, scale: .992 },
      target: { y: 0, scale: 1 },
      exit: profile ? { y: 0, scale: 1 } : { y: 6, scale: .992 }, delay: 0,
    };
    if (panel === root) {
      for (const part of ['from', 'target', 'exit']) Object.assign(shell[part], entries.get(root)[part]);
    }
    entries.set(panel, shell);
  }
  for (const el of regions) {
    let x = parseFloat(el.style.getPropertyValue('--surface-x')) || -10;
    let y = 0;
    let scale = 1;
    if (profile) {
      x = 0;
      y = profile.rise ?? 12;
      if (el.dataset.surfaceRole === 'heading') y = -8;
      if (el.dataset.surfaceRole === 'nav') { x = -12; y = 0; }
      if (el.dataset.surfaceRole === 'portrait') { x = -24; y = 0; scale = 1.025; }
      if (el.dataset.surfaceRole === 'actions') y = 8;
      if (profile.expedition) { x = 8; y = 0; scale = 1; }
      if (profile.key === 'backpack') { x = 24; y = 0; }
    }
    entries.set(el, {
      from: { x, y, scale }, target: { x: 0, y: 0, scale: 1 },
      exit: profile?.key === 'backpack' ? { x: 24, y: 0, scale: 1 }
        : { x: 0, y: -6, scale: 1 },
      delay: fast ? 0 : parseFloat(el.style.getPropertyValue('--surface-delay')) || 0,
    });
  }
  for (const [el, saved] of state.elements) {
    if (entries.has(el)) continue;
    clearVisual(el);
    if (saved.animation) el.style.setProperty('animation', saved.animation, saved.priority);
    else el.style.removeProperty('animation');
    delete el.dataset.surfaceTarget;
    state.elements.delete(el);
  }
  for (const [el, entry] of entries) {
    const previous = state.elements.get(el);
    if (!previous) state.elements.set(el, {
      animation: el.style.getPropertyValue('animation'), priority: el.style.getPropertyPriority('animation'), ...entry,
    });
    else Object.assign(previous, entry);
    el.dataset.surfaceTarget = '1';
    // Inline priority also defeats theme-owned keyframes without changing theme files.
    el.style.setProperty('animation', 'none', 'important');
    if (continuing && previous && !reversing) continue;
    retargetVisual(el, entry.target, {
      duration, delay: continuing || preparingExit ? 0 : entry.delay,
      // Refresh/contentOnly can leave visible regions unregistered until closing.
      // Enrol those at rest; the paired leave call supplies their actual exit.
      from: preparingExit && !previous ? entry.target : entry.from,
    });
  }
}

function reduced() {
  return document.body.classList.contains('reduce-motion')
    || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function blocks(root) {
  if (root.id === 'title') return [...root.querySelectorAll('.home-brand, .home-plate, .home-footer, .home-readout')];
  const content = root.id === 'overlay' ? root.querySelector('#ovBody') : root;
  if (!content) return [];
  const visible = el => !el.matches('script, style, link, dialog, [hidden], [aria-hidden="true"]');
  const children = [...content.children].filter(visible);
  // Most pages have one layout wrapper. Animate its regions, never each item in a large list.
  const regions = children.length === 1 && children[0].children.length > 1 && children[0].children.length <= 8
    ? [...children[0].children].filter(visible) : children;
  return regions.slice(0, 8);
}

export function enterSurface(root, { restart = true, fast = false, contentOnly = false, navigation = null } = {}) {
  if (!root) return;
  root.dataset.surfaceMotion = fast ? 'fast' : 'page';
  const phase = root.dataset.surfacePhase;
  const next = restart || !phase || phase === 'out' ? (phase === 'a' ? 'b' : 'a') : phase;
  const profile = root.id === 'overlay' && (!fast || (!restart && root.dataset.surfaceLayout))
    ? pageMotionProfile(root.querySelector('#ovBody')) : null;
  if (profile) root.dataset.surfaceLayout = profile.key;
  else delete root.dataset.surfaceLayout;
  if (profile?.expedition) root.dataset.surfaceContext = 'expedition';
  else delete root.dataset.surfaceContext;
  let choreography = profile ? pageMotionBlocks(profile, contentOnly) : [];
  // 页面换布局后旧分区选择器可能全失配；仍让可见内容入场，不能只禁用旧动画。
  if (profile && !choreography.length) {
    choreography = blocks(profile.page).map((el, index) => ({
      el, role: 'content', delay: Math.min(index * surfaceTiming.stagger, 66),
    }));
    if (!choreography.length && !profile.page.closest('[hidden]')) {
      choreography = [{ el: profile.page, role: 'content', delay: 0 }];
    }
  }
  const regions = profile ? choreography.map(region => region.el) : blocks(root);
  if (profile) {
    profile.page.querySelectorAll('.page-in').forEach(el => el.classList.remove('page-in'));
    // 只让选中的信息区展开，祖先布局容器不叠加旧的大幅滑入。
    for (const el of regions) {
      for (let frame = el.parentElement; frame && profile.page.contains(frame); frame = frame.parentElement) {
        frame.dataset.surfaceFrame = '1';
      }
    }
  }
  regions.forEach((el, index) => {
    el.dataset.surfaceBlock = '1';
    el.style.setProperty('--surface-delay', `${fast ? 0 : Math.min(index * surfaceTiming.stagger, 105)}ms`);
    el.style.setProperty('--surface-x', `${index % 2 ? 10 : -10}px`);
    if (profile) {
      const region = choreography[index];
      el.dataset.surfaceRole = region.role;
      if (profile.key === 'base-content') {
        el.style.setProperty('--base-region-x', `${navigation?.x ?? 28}px`);
      }
      el.style.setProperty('--surface-delay', `${Math.min(region.delay, profile.staggerMax ?? navigationTiming.staggerMax)}ms`);
      el.style.setProperty('--surface-region-in', `${navigation?.duration ?? profile.duration ?? navigationTiming.enter}ms`);
      el.style.setProperty('--surface-region-rise', `${profile.rise ?? 12}px`);
    }
    // Home keeps its picked-control priority and the distance-based delays.
    if (root.id === 'title' && el.classList.contains('home-plate')) {
      el.style.setProperty('--surface-delay', el.style.getPropertyValue('--hd') || '0ms');
      const right = !!el.closest('.home-secondary');
      el.style.setProperty('--surface-x', right ? '40px' : '-40px');
      el.style.setProperty('--surface-clip', right ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)');
    }
  });
  targetSurface(root, regions, profile, fast, restart, phase);
  if (restart && phase && !reduced() && !visualSurfaces.has(root)) {
    // 同一帧内关闭/重开或连续换页会合并样式更新，a→b→a可能被当作未变化。
    // 先提交无入场标记的样式，再给本次页面设置新阶段，确保重播。
    delete root.dataset.surfacePhase;
    void root.offsetWidth;
  }
  root.dataset.surfacePhase = next;
}

export function leaveSurface(root) {
  if (!root) return;
  root.dataset.surfacePhase = 'out';
  if (reduced()) { releaseVisual(root); return; }
  const state = visualSurfaces.get(root);
  if (state) state.leaving = true;
  const duration = parseFloat(root.style.getPropertyValue('--page-out'))
    || (root.dataset.surfaceMotion === 'fast' ? surfaceTiming.fastExit : surfaceTiming.exit);
  for (const [el, entry] of state?.elements ?? []) {
    retargetVisual(el, entry.exit, { duration, easing: motionEasing.exit });
  }
}

export function clearSurface(root, { preserveVisual = false } = {}) {
  if (!root) return;
  delete root.dataset.surfacePhase;
  if (!preserveVisual) releaseVisual(root);
}

// One stylesheet owns navigation animation. Repeated #overlay deliberately outranks
// theme rules containing :has(#hubMain), regardless of their stylesheet load order.
const style = document.createElement('style');
style.dataset.surfaceMotion = '1';
style.textContent = `
body [data-surface-motion] {
  --surface-in: ${surfaceTiming.enter}ms; --surface-out: ${surfaceTiming.exit}ms;
  --surface-ease: ${motionEasing.enter};
}
body [data-surface-motion="fast"] {
  --surface-in: ${surfaceTiming.fastEnter}ms; --surface-out: ${surfaceTiming.fastExit}ms;
}
body #overlay[data-ui-motion="panel"], body #overlay[data-ui-motion="confirm"] {
  --surface-in: ${motionTiming.detailEnter}ms;
}
body #overlay#overlay#overlay[data-surface-motion][data-surface-phase] {
  animation: surfaceVeilIn var(--surface-in) var(--surface-ease) both !important;
}
body #overlay#overlay#overlay[data-surface-motion][data-surface-phase="b"] {
  animation-name: surfaceVeilInB !important;
}
body #overlay#overlay#overlay[data-surface-motion][data-surface-phase="out"] {
  animation: surfaceVeilOut var(--surface-out) ${motionEasing.exit} both !important;
  pointer-events: none;
}
body #overlay#overlay#overlay[data-surface-motion] .hub-page.page-in {
  animation: none !important;
}
body #overlay#overlay#overlay[data-surface-motion][data-surface-phase][data-surface-phase] > .card,
body #homeCredits[data-surface-motion][data-surface-motion][data-surface-phase][data-surface-phase],
body :is(#exitScr, #sugLayer, [data-surface-motion]):not(#title):not(#overlay)[data-surface-motion][data-surface-phase] {
  animation: surfacePanelIn var(--surface-in) var(--surface-ease) both !important;
}
body #overlay#overlay#overlay[data-surface-motion][data-surface-phase="b"][data-surface-phase] > .card {
  animation-name: surfacePanelInB !important;
}
body #overlay#overlay#overlay[data-surface-motion][data-surface-phase="out"][data-surface-phase] > .card,
body #homeCredits[data-surface-motion][data-surface-motion][data-surface-phase="out"][data-surface-phase],
body :is(#exitScr, #sugLayer, [data-surface-motion]):not(#title):not(#overlay)[data-surface-motion][data-surface-phase="out"] {
  animation: surfacePanelOut var(--surface-out) ${motionEasing.exit} both !important;
}
/* Nested regions share home-style slides; both panel and veil use the same timing. */
body :is(#title,#overlay,#homeCredits,#exitScr,#sugLayer,[data-surface-motion])[data-surface-motion][data-surface-motion][data-surface-phase][data-surface-phase] [data-surface-block][data-surface-block] {
  animation: surfaceBlockIn var(--surface-in) var(--surface-ease) var(--surface-delay,0ms) both !important;
}
body :is(#title,#overlay,#homeCredits,#exitScr,#sugLayer,[data-surface-motion])[data-surface-motion][data-surface-motion][data-surface-phase="b"][data-surface-phase] [data-surface-block][data-surface-block] {
  animation-name: surfaceBlockInB !important;
}
body :is(#title,#overlay,#homeCredits,#exitScr,#sugLayer,[data-surface-motion])[data-surface-motion][data-surface-motion][data-surface-phase="out"][data-surface-phase] [data-surface-block][data-surface-block] {
  animation: surfaceBlockOut var(--surface-out) ${motionEasing.exit} both !important;
}
body #title.home-composed[data-surface-motion][data-surface-motion][data-surface-phase="out"][data-surface-phase][data-home-pick] .is-picked[data-surface-block][data-surface-block] {
  animation: surfacePickedOut var(--surface-out) var(--surface-ease) both !important;
}
body #title.home-composed[data-surface-motion][data-surface-motion][data-surface-phase="out"][data-surface-phase][data-home-pick] [data-surface-block][data-surface-block] {
  animation-duration: var(--motion-exit,180ms) !important; animation-delay: var(--surface-delay,0ms) !important;
}
body #title.home-composed[data-surface-motion][data-surface-motion][data-surface-phase="out"][data-surface-phase][data-home-pick] .is-picked[data-surface-block][data-surface-block] {
  animation-duration: var(--motion-exit,180ms) !important; animation-delay: 0ms !important;
}
@keyframes surfacePanelIn { from { opacity: 0; transform: translateY(10px) scale(.992); } to { opacity: 1; transform: none; } }
@keyframes surfacePanelInB { from { opacity: 0; transform: translateY(10px) scale(.992); } to { opacity: 1; transform: none; } }
@keyframes surfacePanelOut { to { opacity: 0; transform: translateY(6px) scale(.992); } }
@keyframes surfaceVeilIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes surfaceVeilInB { from { opacity: 0; } to { opacity: 1; } }
@keyframes surfaceVeilOut { to { opacity: 0; } }
@keyframes surfaceBlockIn { from { opacity: 0; transform: translateX(var(--surface-x,-10px)); } to { opacity: 1; transform: none; } }
@keyframes surfaceBlockInB { from { opacity: 0; transform: translateX(var(--surface-x,-10px)); } to { opacity: 1; transform: none; } }
@keyframes surfaceBlockOut { to { opacity: 0; transform: translateX(var(--surface-x,-10px)) scale(.97); } }
@keyframes surfacePickedOut { 0% { opacity: 1; transform: none; } 28% { opacity: 1; transform: scale(1.035); } 100% { opacity: 0; transform: scale(1.12); } }
body #title.home-composed[data-surface-motion][data-surface-motion][data-surface-phase]:not([data-surface-phase="out"]) .home-plate[data-surface-block][data-surface-block] {
  animation-name: surfaceHomeIn !important;
}
@keyframes surfaceHomeIn { from { opacity: 0; transform: translateX(var(--surface-x)); clip-path: var(--surface-clip); } to { opacity: 1; transform: none; clip-path: inset(-14px -30px); } }
body #title.home-composed[data-surface-motion][data-surface-motion][data-surface-phase]:not([data-surface-phase="out"]) .is-picked[data-surface-block][data-surface-block] {
  animation: surfacePickedIn .42s var(--surface-ease) both !important;
}
@keyframes surfacePickedIn { from { opacity: 0; transform: scale(1.07); } to { opacity: 1; transform: none; } }
/* 已规划页面：外壳稳定承接，只展开具体信息区；标记保留到下一页，防旧动画回播。 */
body #overlay#overlay#overlay#overlay[data-surface-layout]:not([data-surface-phase="out"]),
body #overlay#overlay#overlay#overlay[data-surface-layout]:not([data-surface-phase="out"]) > .card {
  animation: none !important; opacity: 1; transform: none;
}
body #overlay#overlay#overlay#overlay[data-surface-layout] [data-surface-frame] { animation: none !important; }
body #overlay#overlay#overlay#overlay[data-surface-layout] [data-surface-role] {
  --page-x: 0px; --page-y: var(--surface-region-rise,12px); --page-scale: 1;
  animation: surfacePageIn var(--surface-region-in,${motionTiming.regionEnter}ms) ${motionEasing.enter} var(--surface-delay,0ms) backwards !important;
}
body #overlay#overlay#overlay#overlay[data-surface-layout] [data-surface-role="heading"] { --page-y: -8px; }
body #overlay#overlay#overlay#overlay[data-surface-layout] [data-surface-role="nav"] { --page-x: -12px; --page-y: 0px; }
body #overlay#overlay#overlay#overlay[data-surface-layout] [data-surface-role="portrait"] { --page-x: -24px; --page-y: 0px; --page-scale: 1.025; }
body #overlay#overlay#overlay#overlay[data-surface-layout] [data-surface-role="actions"] { --page-y: 8px; }
body #overlay#overlay#overlay#overlay[data-surface-layout][data-surface-phase="b"] [data-surface-role] { animation-name: surfacePageInB !important; }
/* 远征页只让信息区短距离展开；背景和货架不重复闪回，主动作最迟48ms开始。 */
body #overlay#overlay#overlay#overlay[data-surface-context="expedition"] [data-surface-role] {
  --page-x: 8px; --page-y: 0px; --page-scale: 1;
}
body #overlay#overlay#overlay#overlay[data-surface-context="expedition"] .evt-opt {
  animation: none !important;
}
/* Backpack is one attached surface: all regions enter from the right and leave there. */
body #overlay#overlay#overlay#overlay[data-surface-layout="backpack"] [data-surface-role] {
  --page-x: 24px; --page-y: 0px; --page-scale: 1;
}
body #overlay#overlay#overlay#overlay[data-surface-layout="backpack"][data-surface-phase="out"] [data-surface-role] {
  animation-name: surfacePanelReturn !important;
}
@keyframes surfacePanelReturn { to { opacity: 0; transform: translateX(24px); } }
/* 玻璃父层只动画 transform，opacity 两端均为 1 也不纳入动画。 */
body #overlay#overlay#overlay#overlay[data-surface-layout="base-content"] [data-surface-role] {
  --page-x: var(--base-region-x,28px); --page-y: 0px; --page-scale: 1;
  animation-name: surfaceGlassIn !important;
}
body #overlay#overlay#overlay#overlay[data-surface-layout="base-content"][data-surface-phase="b"] [data-surface-role] { animation-name: surfaceGlassInB !important; }
@keyframes surfaceGlassIn { from { transform: translateX(var(--page-x)); } to { transform: none; } }
@keyframes surfaceGlassInB { from { transform: translateX(var(--page-x)); } to { transform: none; } }
body #overlay#overlay#overlay#overlay[data-surface-layout][data-surface-phase="out"] {
  animation: surfaceVeilOut var(--page-out,.18s) ease-out both !important;
}
body #overlay#overlay#overlay#overlay[data-surface-layout][data-surface-phase="out"] > .card { animation: none !important; }
body #overlay#overlay#overlay#overlay[data-surface-layout][data-surface-phase="out"] [data-surface-role] {
  animation: surfacePageOut var(--page-out,140ms) ease-out both !important;
}
@keyframes surfacePageIn { from { opacity: 0; transform: translate(var(--page-x),var(--page-y)) scale(var(--page-scale)); } to { opacity: 1; transform: none; } }
@keyframes surfacePageInB { from { opacity: 0; transform: translate(var(--page-x),var(--page-y)) scale(var(--page-scale)); } to { opacity: 1; transform: none; } }
@keyframes surfacePageOut { to { opacity: 0; transform: translateY(-6px); } }
`.replaceAll('body ', 'body:not(.reduce-motion) ');
style.textContent = `@media (prefers-reduced-motion: no-preference) { ${style.textContent} }`;
document.head.appendChild(style);

// DOM owners still hide/unmount. Release only our visual state when that happens.
const visualLifecycle = new MutationObserver(() => {
  for (const [root, state] of visualSurfaces) {
    if (!root.isConnected || root.closest('[hidden]') || reduced()) {
      releaseVisual(root);
      continue;
    }
    for (const [el, saved] of state.elements) {
      if (el.isConnected) continue;
      clearVisual(el);
      if (saved.animation) el.style.setProperty('animation', saved.animation, saved.priority);
      else el.style.removeProperty('animation');
      delete el.dataset.surfaceTarget;
      state.elements.delete(el);
    }
  }
});
visualLifecycle.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => {
  if (reduced()) for (const root of visualSurfaces.keys()) releaseVisual(root);
});

// Home and native dialogs own their lifecycle outside UI.showOverlay/showScreen.
const title = document.getElementById('title');
const credits = document.getElementById('homeCredits');
const sug = document.getElementById('sugLayer');
const lifecycle = new MutationObserver(records => {
  for (const { target, attributeName } of records) {
    if (target === title && attributeName === 'data-home-phase') {
      if (title.dataset.homePhase === 'in') enterSurface(title);
      else if (title.dataset.homePhase === 'out') { enterSurface(title, { restart: false }); leaveSurface(title); }
      else clearSurface(title);
    } else if (target === credits) {
      if (!credits.open) clearSurface(credits);
      else if (credits.dataset.homeMotion === 'out') leaveSurface(credits);
      else enterSurface(credits, { restart: false });
    } else if (target === sug && attributeName === 'hidden') {
      if (sug.hidden) clearSurface(sug); else enterSurface(sug);
    } else if (target === document.body && reduced()) {
      // CSS disables motion immediately, including a preference changed mid-transition.
      clearSurface(title);
    }
  }
});
for (const root of [title, credits, sug]) {
  if (root) lifecycle.observe(root, { attributes: true, attributeFilter: ['data-home-phase', 'data-home-motion', 'open', 'hidden'] });
}
lifecycle.observe(document.body, { attributes: true, attributeFilter: ['class'] });
