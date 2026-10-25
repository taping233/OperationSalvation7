import { beforeAll, afterEach, expect, it, vi } from 'vitest';

let motion;
beforeAll(async () => { motion = await import('../game/src/ui/surface-motion.js'); });
afterEach(() => { document.body.replaceChildren(); document.body.className = ''; vi.useRealTimers(); vi.unstubAllGlobals(); });

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
  expect(root.querySelectorAll('[data-surface-block]')).toHaveLength(1);
  expect(root.querySelector('main').style.getPropertyValue('--surface-delay')).toBe('0ms');
  expect(root.querySelector('article').dataset.surfaceBlock).toBeUndefined();
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
    el: {
      get overlay() { return document.getElementById('overlay'); },
      get ovBody() { return document.getElementById('ovBody'); },
    },
    showOverlay(_heading, html, mode) { body.innerHTML = html; root.hidden = false; this._lastMode = mode; },
    hideOverlay: vi.fn(() => { root.hidden = true; body.replaceChildren(); }),
  };
  const closeSpy = ui.hideOverlay;
  window.SDT = { UI: ui };
  await import('../game/src/ui/interface-motion.js');
  return { root, body, ui, closeSpy };
}

it.each([false, true])('entry supplies wait without a second scene (outgoing scene=%s)', async outgoing => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const { root, body, ui } = await installOverlay();
  if (outgoing) ui.showOverlay('', '<div class="flow-transition"><div class="silent-node-cut">Previous departure</div></div>', 'scene');
  const html = '<section class="entry-reward-scene entry-supply-strips"><header class="reward-head">Supply</header><main class="reward-main">Cards</main></section>';
  ui.showOverlay('', html, 'page');
  expect(document.querySelector('.page-visual-handoff')).not.toBeNull();
  expect(document.querySelector('.page-visual-handoff .silent-node-cut')).toBeNull();
  const page = body.firstElementChild;
  ui.showOverlay('', html, 'page');
  expect(body.firstElementChild).toBe(page);
  await vi.advanceTimersByTimeAsync(1000);
  expect(document.querySelector('.page-visual-handoff')).toBeNull();
  expect(root.hidden).toBe(false);
  expect(body.firstElementChild).toBe(page);
});

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

it('carries the node illustration through slow destination readiness without a second black veil', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const { root, body, ui, closeSpy } = await installOverlay();
  ui.showOverlay('', '<div class="flow-transition expedition-cut illustrated-cut" data-act="flowContinue"><h2 id="scene-title">拾荒商队</h2></div>', 'scene');
  let ready;
  ui._pageBgReady = new Promise(resolve => { ready = resolve; });
  ui.showOverlay('', '<main class="shop-market">商店</main>', 'page');
  const cover = root.querySelector(':scope > .page-visual-scene');
  expect(cover.textContent).toBe('拾荒商队');
  expect(cover.querySelector('[id], [data-act], i')).toBeNull();
  expect(document.querySelectorAll('.page-visual-handoff')).toHaveLength(1);
  expect(closeSpy).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(100);
  expect(cover.classList.contains('leaving')).toBe(false);
  ready();
  await vi.advanceTimersByTimeAsync(32);
  expect(cover.classList.contains('leaving')).toBe(true);
  await vi.advanceTimersByTimeAsync(224);
  expect(cover.isConnected).toBe(false);
  expect(body.textContent).toBe('商店');
  expect(root.hidden).toBe(false);
});

const hubPage = (tab, sub = '') => `<main id="hubMain" class="base-camp"><header class="hub-head">Base</header><div class="hub-body"><nav class="hub-tabs"><button class="hub-tab on" data-tab="${tab}">Tab</button></nav><section class="hub-page" data-view="${tab}/${sub}"><div class="pv12-agent-strip">Strip</div><div class="pv12-agent-data">Data</div>${tab}/${sub}</section></div></main>`;

it('base navigation keeps the veil and shell stable and animates only changed content', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const { root, body, ui } = await installOverlay();
  ui.showOverlay('', hubPage('deploy'), 'page');
  // 首次基地入场由城廓编排负责，通用遮罩/外壳阶段不再叠加。
  expect(root.dataset.surfacePhase).toBeUndefined();
  expect(root.dataset.uiEnter).toBeUndefined();

  for (const [tab, sub] of [['stash', 'cards'], ['stash', 'pets'], ['shop', '']]) {
    ui.showOverlay('', hubPage(tab, sub), 'page');
    expect(document.querySelector('.page-visual-handoff')).toBeNull();
    expect(root.hidden).toBe(false);
    expect(root.dataset.surfaceLayout).toBe('base-content');
    expect(root.dataset.uiEnter).toBeUndefined();
    expect(body.querySelector('.hub-head').dataset.surfaceBlock).toBeUndefined();
    expect(body.querySelector('.hub-tabs').dataset.surfaceBlock).toBeUndefined();
    const marked = [...body.querySelectorAll('[data-surface-block]')];
    expect(marked.length).toBeGreaterThan(0);   // 分区内容照常入场
    expect(marked.every(el => body.querySelector('.hub-page').contains(el))).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(document.querySelector('.page-visual-handoff')).toBeNull();
  }
});

it('same-page base updates stay quiet and interface navigation opens without a scene curtain', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const { root, body, ui } = await installOverlay();
  ui.showOverlay('', hubPage('shop'), 'page');
  ui.showOverlay('', hubPage('shop'), 'page');
  expect(root.dataset.surfacePhase).toBeUndefined();
  expect(body.querySelector('.hub-page').classList.contains('page-in')).toBe(false);
  expect(body.querySelectorAll('[data-surface-block]')).toHaveLength(0);

  ui.showOverlay('', '<main class="settings-page">Settings</main>', 'page');
  expect(document.querySelector('.page-visual-handoff')).toBeNull();
  expect(root.dataset.surfacePhase).toBeDefined();
  expect(root.dataset.uiEnter).toBeUndefined();   // 普通界面只播区域入场，不叠整页翻入。
});

it('interface pages sharing an empty heading apply their own profile without a loading curtain', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const { root, ui } = await installOverlay();
  ui.showOverlay('', '<main class="settings-page"><section class="settings-content">Settings</section></main>', 'page');
  await vi.advanceTimersByTimeAsync(400);
  ui.showOverlay('', '<main class="beginner-guide"><div class="bg-copy">Guide</div></main>', 'page');
  expect(root.dataset.visualPending).toBeUndefined();
  await vi.advanceTimersByTimeAsync(400);
  expect(root.dataset.surfaceLayout).toBe('guide');
  expect(root.querySelector('.bg-copy').dataset.surfaceRole).toBe('content');
  expect(document.querySelector('.page-visual-handoff')).toBeNull();
});

it('backpack filters do not replay entry, and closing uses its paired panel duration', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const { root, ui } = await installOverlay();
  const bag = '<main class="bag-v2"><nav class="bag-rail">Zones</nav><section class="bag-col"><header class="bag-head2">Bag</header><div class="bag-board">Cards</div></section></main>';
  ui.showOverlay('Bag', bag, 'bagpage');
  await vi.advanceTimersByTimeAsync(400);
  expect(root.dataset.surfaceLayout).toBe('backpack');
  ui.showOverlay('Bag', bag, 'bagpage');
  expect(root.dataset.surfacePhase).toBeUndefined();
  expect(document.querySelector('.page-visual-handoff')).toBeNull();
  ui.hideOverlay();
  expect(ui._motionExitDuration).toBe(160);
  expect(root.hidden).toBe(false);
  await vi.advanceTimersByTimeAsync(170);
  expect(root.hidden).toBe(true);
});
