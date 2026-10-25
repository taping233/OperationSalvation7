import { afterEach, expect, it, vi } from 'vitest';

const visual = vi.hoisted(() => ({
  retargetVisual: vi.fn(() => ({ finished: Promise.resolve(true), stop: vi.fn() })),
  clearVisual: vi.fn(),
}));
vi.mock('../game/src/ui/target-motion.js', () => visual);
import { enterSurface, leaveSurface, clearSurface } from '../game/src/ui/surface-motion.js';
import { enterArchive, clearArchiveMotion } from '../game/src/ui/archive-motion.js';
import { captureArchiveExit } from '../game/src/ui/camp-entry.js';

afterEach(() => {
  clearArchiveMotion(document.getElementById('overlay'));
  document.querySelectorAll('[data-surface-motion]').forEach(root => clearSurface(root));
  document.body.replaceChildren();
  document.body.className = '';
  vi.clearAllMocks();
});

function overlay(content = '<main><header>Heading</header><section>Content</section></main>') {
  document.body.innerHTML = `<div id="overlay"><div class="card"><div id="ovBody">${content}</div></div></div>`;
  return document.getElementById('overlay');
}

it.each([
  ['ordinary dialog', '<main><header>Heading</header><section>Content</section></main>'],
  ['backpack', '<main class="bag-v2"><nav class="bag-rail">Bag</nav><section class="bag-board">Cards</section></main>'],
  ['reward', '<main class="reward-v14"><div class="reward-main">Reward</div></main>'],
])('gives %s one opacity owner on entry and paired exit', (_name, content) => {
  const root = overlay(content);
  enterSurface(root);
  // Child transforms must not multiply a parent fade, including their initial values.
  const opacityOwners = () => visual.retargetVisual.mock.calls
    .filter(([, target, options]) => 'opacity' in target || 'opacity' in (options.from ?? {}))
    .map(([el]) => el);
  expect(opacityOwners()).toEqual([root]);
  expect(visual.retargetVisual).toHaveBeenCalledWith(root, { opacity: 1 }, expect.any(Object));
  visual.retargetVisual.mockClear();
  leaveSurface(root);
  expect(opacityOwners()).toEqual([root]);
  expect(visual.retargetVisual).toHaveBeenCalledWith(root, { opacity: 0 }, expect.any(Object));
});

it('keeps one fade when the native surface is also its own panel', () => {
  const root = document.createElement('dialog');
  root.innerHTML = '<header>Heading</header><section>Content</section>';
  document.body.append(root);
  enterSurface(root);
  expect(visual.retargetVisual).toHaveBeenCalledWith(root,
    { opacity: 1, y: 0, scale: 1 }, expect.objectContaining({ from: { opacity: 0, y: 10, scale: 1 } }));
  expect(visual.retargetVisual.mock.calls.filter(([el, target]) => el !== root && 'opacity' in target)).toHaveLength(0);
  visual.retargetVisual.mockClear();
  leaveSurface(root);
  expect(visual.retargetVisual).toHaveBeenCalledWith(root, { opacity: 0, y: 6, scale: 1 }, expect.any(Object));
});

it('reverses the same surface immediately without reset, queued delay, or CSS keyframes', () => {
  const root = overlay();
  const panel = root.querySelector('.card');
  panel.style.setProperty('animation', 'original-panel 1s');
  enterSurface(root);
  expect(panel.style.getPropertyValue('animation')).toBe('none');
  expect(panel.style.getPropertyPriority('animation')).toBe('important');
  const region = root.querySelector('section');
  expect(visual.retargetVisual).toHaveBeenCalledWith(region, { x: 0, y: 0, scale: 1 }, expect.objectContaining({ delay: 35 }));
  visual.retargetVisual.mockClear();
  // The logical close path prepares the existing surface without replaying entry.
  enterSurface(root, { restart: false });
  expect(visual.retargetVisual).not.toHaveBeenCalled();
  leaveSurface(root);
  expect(visual.retargetVisual).toHaveBeenCalledWith(region, { x: 0, y: -6, scale: 1 }, expect.objectContaining({ duration: 180 }));
  clearSurface(root, { preserveVisual: true });
  visual.retargetVisual.mockClear();
  enterSurface(root);
  expect(visual.clearVisual).not.toHaveBeenCalled();
  expect(visual.retargetVisual).toHaveBeenCalledWith(region, { x: 0, y: 0, scale: 1 }, expect.objectContaining({ delay: 0 }));
  clearSurface(root);
  expect(panel.style.getPropertyValue('animation')).toBe('original-panel 1s');
});

it('targets backpack and reward regions as groups while preserving caller hiding', () => {
  const root = overlay(`<main class="bag-v2"><nav class="bag-rail">Bag</nav><section class="bag-board">${'<button>Card</button>'.repeat(100)}</section></main>`);
  enterSurface(root);
  expect(root.querySelectorAll('button[data-surface-target]')).toHaveLength(0);
  const board = root.querySelector('.bag-board');
  expect(visual.retargetVisual).toHaveBeenCalledWith(board, { x: 0, y: 0, scale: 1 },
    expect.objectContaining({ from: { x: 24, y: 0, scale: 1 } }));
  leaveSurface(root);
  expect(visual.retargetVisual).toHaveBeenCalledWith(board, { x: 24, y: 0, scale: 1 }, expect.any(Object));
  expect(root.hidden).toBe(false);
  clearSurface(root);
  root.querySelector('#ovBody').innerHTML = '<main class="reward-v14"><div class="reward-main"><button>Reward</button></div></main>';
  enterSurface(root);
  expect(root.querySelector('.reward-main').dataset.surfaceTarget).toBe('1');
  expect(root.querySelector('button').dataset.surfaceTarget).toBeUndefined();
});

it('closes refreshed backpack regions from rest without resetting the retained shell', () => {
  const bag = '<main class="bag-v2"><nav class="bag-rail">Bag</nav><section class="bag-board">Cards</section></main>';
  const root = overlay(bag);
  enterSurface(root);
  clearSurface(root, { preserveVisual: true });
  root.querySelector('#ovBody').innerHTML = bag;
  const board = root.querySelector('.bag-board');
  root.dataset.uiClosing = '1';
  visual.retargetVisual.mockClear();
  enterSurface(root, { restart: false });
  expect(visual.retargetVisual).toHaveBeenCalledWith(board, { x: 0, y: 0, scale: 1 },
    expect.objectContaining({ from: { x: 0, y: 0, scale: 1 }, delay: 0 }));
  expect(visual.retargetVisual.mock.calls.some(([el]) => el === root || el === root.querySelector('.card'))).toBe(false);
  leaveSurface(root);
  expect(visual.retargetVisual).toHaveBeenCalledWith(board, { x: 24, y: 0, scale: 1 }, expect.any(Object));
});

it('enrols contentOnly headings and navigation at rest when first discovered during close', () => {
  const root = overlay('<main class="settings-page settings-tabbed"><header class="pg-head">Settings</header><nav class="settings-nav">Tabs</nav><section class="settings-content">Content</section></main>');
  enterSurface(root, { contentOnly: true });
  const heading = root.querySelector('.pg-head');
  const nav = root.querySelector('.settings-nav');
  const content = root.querySelector('.settings-content');
  expect(heading.dataset.surfaceTarget).toBeUndefined();
  expect(nav.dataset.surfaceTarget).toBeUndefined();
  root.dataset.uiClosing = '1';
  visual.retargetVisual.mockClear();
  enterSurface(root, { restart: false });
  for (const el of [heading, nav]) {
    expect(visual.retargetVisual).toHaveBeenCalledWith(el, { x: 0, y: 0, scale: 1 },
      expect.objectContaining({ from: { x: 0, y: 0, scale: 1 }, delay: 0 }));
  }
  expect(visual.retargetVisual.mock.calls.some(([el]) => el === content)).toBe(false);
  leaveSurface(root);
  expect(visual.retargetVisual).toHaveBeenCalledWith(nav, { x: 0, y: -6, scale: 1 }, expect.any(Object));
});

it('releases hidden, removed and reduced-motion surfaces without taking focus responsibility', async () => {
  const root = overlay();
  enterSurface(root);
  root.hidden = true;
  await Promise.resolve();
  expect(visual.clearVisual).toHaveBeenCalledWith(root);
  expect(root.querySelector('.card').style.getPropertyValue('animation')).toBe('');
  root.hidden = false;
  enterSurface(root);
  visual.clearVisual.mockClear();
  document.body.classList.add('reduce-motion');
  await Promise.resolve();
  expect(visual.clearVisual).toHaveBeenCalledWith(root);
  visual.retargetVisual.mockClear();
  enterSurface(root);
  expect(visual.retargetVisual).not.toHaveBeenCalled();
  document.body.className = '';
  enterSurface(root);
  visual.clearVisual.mockClear();
  root.remove();
  await Promise.resolve();
  expect(visual.clearVisual).toHaveBeenCalledWith(root);
});

it('keeps home and camp choreography outside ordinary surface targets', () => {
  const root = overlay('<main id="hubMain" class="base-camp"><section class="pv12-agent-data">Data</section></main>');
  enterSurface(root);
  expect(visual.retargetVisual).not.toHaveBeenCalled();
  const home = document.createElement('section');
  home.id = 'title';
  home.innerHTML = '<button class="home-plate">Start</button>';
  document.body.append(home);
  enterSurface(home);
  expect(visual.retargetVisual).not.toHaveBeenCalled();
});

const archive = '<main class="slot-page"><header class="slot-page-head">档案</header><article class="slot-card"><b class="slot-card-name">档位 01</b><button data-act="enterSlot">进入存档</button></article></main>';

it.each([false, true])('leaves archive dealing and its captured handoff free of target overrides (fast=%s)', fast => {
  const root = overlay(archive), body = root.querySelector('#ovBody');
  enterSurface(root, { fast });
  enterArchive(root, body);
  body.querySelector('[data-act="enterSlot"]').click();
  const ghost = captureArchiveExit(body);
  expect(visual.retargetVisual).not.toHaveBeenCalled();
  expect(root.querySelectorAll('[data-surface-target]')).toHaveLength(0);
  expect(root.querySelector('.slot-card').style.getPropertyValue('animation')).toBe('');
  expect(ghost.querySelector('.slot-card').style.getPropertyValue('animation')).toBe('');
  expect(ghost.querySelector('.archive-picked')).not.toBeNull();
  expect(ghost.querySelector('[data-act]')).toBeNull();
});

it('releases the previous ordinary surface before handing the same shell to archives', () => {
  const root = overlay(), panel = root.querySelector('.card');
  panel.style.animation = 'original-shell 1s';
  enterSurface(root);
  expect(panel.style.animation).toBe('none');
  clearSurface(root, { preserveVisual:true });
  root.querySelector('#ovBody').innerHTML = archive;
  visual.retargetVisual.mockClear();
  enterSurface(root);
  expect(visual.retargetVisual).not.toHaveBeenCalled();
  expect(visual.clearVisual).toHaveBeenCalledWith(root);
  expect(panel.style.animation).toBe('original-shell 1s');
  expect(root.dataset.surfaceTarget).toBeUndefined();
  expect(root.querySelector('.slot-card').style.animation).toBe('');
});

it('leaves the saved-run loading cut with its dedicated owner during close preparation', () => {
  const root = overlay('<main class="flow-transition city-run-transition"><header>继续对局</header><section>载入中</section></main>');
  root.dataset.uiClosing = '1';
  enterSurface(root, { restart:false, fast:true });
  leaveSurface(root);
  expect(visual.retargetVisual).not.toHaveBeenCalled();
  expect(root.querySelectorAll('[data-surface-target]')).toHaveLength(0);
});
