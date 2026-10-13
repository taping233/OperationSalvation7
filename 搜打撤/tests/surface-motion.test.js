import { beforeAll, afterEach, expect, it, vi } from 'vitest';

let motion;
beforeAll(async () => { motion = await import('../game/src/ui/surface-motion.js'); });
afterEach(() => { document.body.replaceChildren(); document.body.className = ''; vi.useRealTimers(); });

it('automatically mounts page regions and replays entry only on navigation', () => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><main><header>Head</header><nav>Tabs</nav><section>Body</section><aside hidden>Hidden</aside></main></div></div>';
  const root = document.getElementById('overlay');
  motion.enterSurface(root);
  expect(root.querySelectorAll('[data-surface-block]')).toHaveLength(3);
  expect(root.querySelector('nav').style.getPropertyValue('--surface-x')).toBe('10px');
  expect(root.querySelector('section').style.getPropertyValue('--surface-delay')).toBe('70ms');
  expect(root.dataset.surfacePhase).toBe('a');
  motion.enterSurface(root, { restart: false });
  expect(root.dataset.surfacePhase).toBe('a');
  motion.enterSurface(root);
  expect(root.dataset.surfacePhase).toBe('b');
  motion.leaveSurface(root);
  expect(root.dataset.surfacePhase).toBe('out');
  motion.enterSurface(root, { restart: false });
  expect(root.dataset.surfacePhase).toBe('a');
});

it('caps animated regions rather than animating every card in a large list', () => {
  const root = document.createElement('section');
  root.innerHTML = `<main>${'<article>Card</article>'.repeat(200)}</main>`;
  motion.enterSurface(root, { fast: true });
  expect(root.dataset.surfaceMotion).toBe('fast');
  expect(root.querySelectorAll('[data-surface-block]')).toHaveLength(8);
  expect(root.querySelector('article').style.getPropertyValue('--surface-delay')).toBe('0ms');
});

it('keeps hidden and close behavior with the caller, and clears only animation phase', () => {
  const root = document.createElement('dialog');
  root.hidden = false;
  motion.enterSurface(root);
  motion.leaveSurface(root);
  expect(root.hidden).toBe(false);
  motion.clearSurface(root);
  expect(root.dataset.surfacePhase).toBeUndefined();
  expect(root.hidden).toBe(false);
});

it('home plate direction and delay keep the picked control choreography', () => {
  document.body.innerHTML = '<section id="title"><div class="home-primary"><button class="home-plate" style="--hd: 55ms">Left</button></div><div class="home-secondary"><button class="home-plate">Right</button></div></section>';
  const root = document.getElementById('title');
  motion.enterSurface(root);
  const plates = root.querySelectorAll('.home-plate');
  expect(plates[0].style.getPropertyValue('--surface-delay')).toBe('55ms');
  expect(plates[0].style.getPropertyValue('--surface-clip')).toBe('inset(0 100% 0 0)');
  expect(plates[1].style.getPropertyValue('--surface-x')).toBe('40px');
});

async function installOverlay() {
  vi.resetModules();
  document.body.innerHTML = '<div id="overlay" class="room-view" hidden><div class="card"><div id="ovBody"></div></div></div>';
  const root = document.getElementById('overlay');
  const body = document.getElementById('ovBody');
  const ui = {
    showOverlay(_heading, html, mode) { body.innerHTML = html; root.hidden = false; this._lastMode = mode; },
    hideOverlay: vi.fn(() => { root.hidden = true; body.replaceChildren(); }),
  };
  const closeSpy = ui.hideOverlay;
  window.SDT = { UI: ui };
  await import('../game/src/ui/interface-motion.js');
  return { root, body, ui, closeSpy };
}

it('reopening during a room exit cannot let the old timer erase the new page', async () => {
  vi.useFakeTimers();
  const { root, body, ui } = await installOverlay();
  ui.showOverlay('Old', '<main>Old</main>', 'page');
  ui.hideOverlay();
  expect(root.dataset.surfacePhase).toBe('out');
  expect(root.hidden).toBe(false);
  ui.showOverlay('New', '<main>New</main>', 'page');
  await vi.advanceTimersByTimeAsync(200);
  expect(root.hidden).toBe(false);
  expect(body.textContent).toBe('New');
  expect(root.dataset.surfacePhase).not.toBe('out');
});

it('reduced motion preserves synchronous room cleanup', async () => {
  vi.useFakeTimers();
  const { root, ui, closeSpy } = await installOverlay();
  document.body.classList.add('reduce-motion');
  ui.showOverlay('Page', '<main>Page</main>', 'page');
  ui.hideOverlay();
  expect(root.hidden).toBe(true);
  expect(closeSpy).toHaveBeenCalledTimes(1);
});

const hubPage = (tab, sub = '') => `<main id="hubMain" class="base-camp"><header class="hub-head">Base</header><div class="hub-body"><nav class="hub-tabs"><button class="hub-tab on" data-tab="${tab}">Tab</button></nav><nav><button class="stash-section-tab on" data-view="${sub}">Section</button></nav><section class="hub-page">${tab}/${sub}</section></div></main>`;

it('base navigation keeps the veil and shell stable and animates only changed content', async () => {
  const { root, body, ui } = await installOverlay();
  ui.showOverlay('', hubPage('deploy'), 'page');
  // 首次基地入场由城廓编排负责，通用遮罩/外壳阶段不再叠加。
  expect(root.dataset.surfacePhase).toBeUndefined();
  expect(root.dataset.uiEnter).toBeUndefined();

  for (const [tab, sub] of [['stash', 'cards'], ['stash', 'pets'], ['shop', '']]) {
    ui.showOverlay('', hubPage(tab, sub), 'page');
    expect(root.hidden).toBe(false);
    expect(root.dataset.surfaceLayout).toBe('base-content');
    expect(root.dataset.uiEnter).toBeUndefined();
    expect(body.querySelector('.hub-head').dataset.surfaceBlock).toBeUndefined();
    expect(body.querySelector('.hub-tabs').dataset.surfaceBlock).toBeUndefined();
    expect([...body.querySelectorAll('[data-surface-role]')].every(el => el.dataset.surfaceRole === 'content')).toBe(true);
  }
});

it('same-page base updates stay quiet while leaving the base retains normal entry', async () => {
  const { root, body, ui } = await installOverlay();
  ui.showOverlay('', hubPage('shop'), 'page');
  ui.showOverlay('', hubPage('shop'), 'page');
  expect(root.dataset.surfacePhase).toBeUndefined();
  expect(body.querySelector('.hub-page').classList.contains('page-in')).toBe(false);
  expect(body.querySelectorAll('[data-surface-block]')).toHaveLength(0);

  ui.showOverlay('', '<main class="settings-page">Settings</main>', 'page');
  expect(root.dataset.surfacePhase).toBeDefined();
  expect(root.dataset.uiEnter).toBeDefined();
});
