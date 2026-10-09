// All navigation surfaces share this choreography. Tune timing and keyframes here.
// Gameplay, focus restoration and actual hiding stay with their existing owners.
export const surfaceTiming = { enter: 500, stagger: 35, exit: 180, fastEnter: 180, fastExit: 110 };

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
  const regions = children.length === 1 && children[0].children.length > 1
    ? [...children[0].children].filter(visible) : children;
  return regions.slice(0, 8);
}

export function enterSurface(root, { restart = true, fast = false } = {}) {
  if (!root) return;
  root.dataset.surfaceMotion = fast ? 'fast' : 'page';
  const phase = root.dataset.surfacePhase;
  const next = restart || !phase || phase === 'out' ? (phase === 'a' ? 'b' : 'a') : phase;
  const regions = blocks(root);
  regions.forEach((el, index) => {
    el.dataset.surfaceBlock = '1';
    el.style.setProperty('--surface-delay', `${fast ? 0 : Math.min(index * surfaceTiming.stagger, 105)}ms`);
    el.style.setProperty('--surface-x', `${index % 2 ? 32 : -32}px`);
    // Home keeps its picked-control priority and the distance-based delays.
    if (root.id === 'title' && el.classList.contains('home-plate')) {
      el.style.setProperty('--surface-delay', el.style.getPropertyValue('--hd') || '0ms');
      const right = !!el.closest('.home-secondary');
      el.style.setProperty('--surface-x', right ? '40px' : '-40px');
      el.style.setProperty('--surface-clip', right ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)');
    }
  });
  root.dataset.surfacePhase = next;
}

export function leaveSurface(root) {
  if (root) root.dataset.surfacePhase = 'out';
}

export function clearSurface(root) {
  if (root) delete root.dataset.surfacePhase;
}

// One stylesheet owns navigation animation. Repeated #overlay deliberately outranks
// theme rules containing :has(#hubMain), regardless of their stylesheet load order.
const style = document.createElement('style');
style.dataset.surfaceMotion = '1';
style.textContent = `
body [data-surface-motion] {
  --surface-in: ${surfaceTiming.enter}ms; --surface-out: ${surfaceTiming.exit}ms;
  --surface-ease: cubic-bezier(.22,1,.36,1);
}
body [data-surface-motion="fast"] {
  --surface-in: ${surfaceTiming.fastEnter}ms; --surface-out: ${surfaceTiming.fastExit}ms;
}
body #overlay#overlay#overlay[data-surface-motion][data-surface-phase] {
  animation: surfaceVeilIn var(--surface-in) var(--surface-ease) both !important;
}
body #overlay#overlay#overlay[data-surface-motion][data-surface-phase="b"] {
  animation-name: surfaceVeilInB !important;
}
body #overlay#overlay#overlay[data-surface-motion][data-surface-phase="out"] {
  animation: surfaceVeilOut var(--surface-out) cubic-bezier(.5,0,.8,.4) both !important;
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
  animation: surfacePanelOut var(--surface-out) cubic-bezier(.5,0,.8,.4) both !important;
}
/* Nested regions share home-style slides; both panel and veil use the same timing. */
body :is(#title,#overlay,#homeCredits,#exitScr,#sugLayer,[data-surface-motion])[data-surface-motion][data-surface-motion][data-surface-phase][data-surface-phase] [data-surface-block][data-surface-block] {
  animation: surfaceBlockIn var(--surface-in) var(--surface-ease) var(--surface-delay,0ms) both !important;
}
body :is(#title,#overlay,#homeCredits,#exitScr,#sugLayer,[data-surface-motion])[data-surface-motion][data-surface-motion][data-surface-phase="b"][data-surface-phase] [data-surface-block][data-surface-block] {
  animation-name: surfaceBlockInB !important;
}
body :is(#title,#overlay,#homeCredits,#exitScr,#sugLayer,[data-surface-motion])[data-surface-motion][data-surface-motion][data-surface-phase="out"][data-surface-phase] [data-surface-block][data-surface-block] {
  animation: surfaceBlockOut var(--surface-out) cubic-bezier(.5,0,.8,.4) both !important;
}
body #title.home-composed[data-surface-motion][data-surface-motion][data-surface-phase="out"][data-surface-phase][data-home-pick] .is-picked[data-surface-block][data-surface-block] {
  animation: surfacePickedOut .44s var(--surface-ease) both !important;
}
body #title.home-composed[data-surface-motion][data-surface-motion][data-surface-phase="out"][data-surface-phase][data-home-pick] [data-surface-block][data-surface-block] {
  animation-duration: .3s !important; animation-delay: var(--surface-delay,0ms) !important;
}
body #title.home-composed[data-surface-motion][data-surface-motion][data-surface-phase="out"][data-surface-phase][data-home-pick] .is-picked[data-surface-block][data-surface-block] {
  animation-duration: .44s !important; animation-delay: 0ms !important;
}
@keyframes surfacePanelIn { from { opacity: 0; transform: translateX(-24px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes surfacePanelInB { from { opacity: 0; transform: translateX(-24px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes surfacePanelOut { to { opacity: 0; transform: translateX(20px) scale(.985); } }
@keyframes surfaceVeilIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes surfaceVeilInB { from { opacity: 0; } to { opacity: 1; } }
@keyframes surfaceVeilOut { to { opacity: 0; } }
@keyframes surfaceBlockIn { from { opacity: 0; transform: translateX(var(--surface-x,-32px)); } to { opacity: 1; transform: none; } }
@keyframes surfaceBlockInB { from { opacity: 0; transform: translateX(var(--surface-x,-32px)); } to { opacity: 1; transform: none; } }
@keyframes surfaceBlockOut { to { opacity: 0; transform: translateX(var(--surface-x,-32px)) scale(.97); } }
@keyframes surfacePickedOut { 0% { opacity: 1; transform: none; } 28% { opacity: 1; transform: scale(1.035); } 100% { opacity: 0; transform: scale(1.12); } }
body #title.home-composed[data-surface-motion][data-surface-motion][data-surface-phase]:not([data-surface-phase="out"]) .home-plate[data-surface-block][data-surface-block] {
  animation-name: surfaceHomeIn !important;
}
@keyframes surfaceHomeIn { from { opacity: 0; transform: translateX(var(--surface-x)); clip-path: var(--surface-clip); } to { opacity: 1; transform: none; clip-path: inset(-14px -30px); } }
body #title.home-composed[data-surface-motion][data-surface-motion][data-surface-phase]:not([data-surface-phase="out"]) .is-picked[data-surface-block][data-surface-block] {
  animation: surfacePickedIn .42s var(--surface-ease) both !important;
}
@keyframes surfacePickedIn { from { opacity: 0; transform: scale(1.07); } to { opacity: 1; transform: none; } }
`.replaceAll('body ', 'body:not(.reduce-motion) ');
style.textContent = `@media (prefers-reduced-motion: no-preference) { ${style.textContent} }`;
document.head.appendChild(style);

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
