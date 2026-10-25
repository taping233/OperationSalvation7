import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installSelectionStateMotion } from '../game/src/ui/selection-state-motion.js';
import { patchBackpackPane } from '../game/src/hub/bag-pane-view.js';

const motion = vi.hoisted(() => ({ retargetVisual: vi.fn(), clearVisual: vi.fn() }));
vi.mock('../game/src/ui/target-motion.js', () => motion);
let dispose;
const rect = (x, y, width = 90, height = 40) => ({ left: x, top: y, width, height });
async function flush() { await Promise.resolve(); await vi.advanceTimersByTimeAsync(32); }
beforeEach(() => { vi.useFakeTimers(); motion.retargetVisual.mockClear(); motion.clearVisual.mockClear(); });
afterEach(() => { dispose?.(); dispose = null; document.body.replaceChildren(); vi.useRealTimers(); });

function mount() {
  document.body.innerHTML = '<div id="overlay"><nav class="settings-nav"><button class="settings-tab" aria-selected="true">A</button><button class="settings-tab" aria-selected="false">B</button><button class="settings-tab" aria-selected="false">C</button></nav></div>';
  const group = document.querySelector('nav'), tabs = [...group.children];
  group.getBoundingClientRect = () => rect(10, 20, 120, 180);
  tabs.forEach((tab, i) => { tab.getBoundingClientRect = () => rect(10, 20 + i * 50); });
  dispose = installSelectionStateMotion(document.body);
  return { group, tabs, plate: group.querySelector('.selection-state-plate') };
}
function select(tabs, index) { tabs.forEach((tab, i) => tab.setAttribute('aria-selected', String(i === index))); }

it('keeps one decorative plate through interrupted selection and never moves focus or changes tab stops', async () => {
  const { group, tabs, plate } = mount();
  tabs[0].focus();
  expect(motion.retargetVisual).toHaveBeenLastCalledWith(plate, expect.objectContaining({ y: 0, opacity: 1 }), { duration: 0 });
  select(tabs, 1); await flush();
  expect(motion.retargetVisual).toHaveBeenLastCalledWith(plate, expect.objectContaining({ y: 50 }), {});
  select(tabs, 2); await flush();
  expect(motion.retargetVisual).toHaveBeenLastCalledWith(plate, expect.objectContaining({ y: 100 }), {});
  expect(group.querySelectorAll('.selection-state-plate')).toHaveLength(1);
  expect(group.hasAttribute('data-selection-motion-ready')).toBe(true);
  expect(plate.getAttribute('aria-hidden')).toBe('true');
  expect(plate.hasAttribute('tabindex')).toBe(false);
  expect(document.activeElement).toBe(tabs[0]);
});

it('coalesces rapid synchronous updates, bounds empty selection, and clears detached groups', async () => {
  const { group, tabs, plate } = mount();
  await flush(); motion.retargetVisual.mockClear();
  select(tabs, 1); select(tabs, 2); await flush();
  expect(motion.retargetVisual).toHaveBeenCalledTimes(1);
  select(tabs, -1); await flush();
  expect(motion.retargetVisual).toHaveBeenLastCalledWith(plate, { opacity: 0 });
  group.remove(); await flush();
  expect(motion.clearVisual).toHaveBeenCalledWith(plate);
});

it('installation is idempotent, disposal removes the layer, and reopening starts at the current selection', () => {
  const { group, tabs, plate } = mount();
  expect(installSelectionStateMotion(document.body)).toBe(dispose);
  dispose(); expect(plate.isConnected).toBe(false);
  expect(group.hasAttribute('data-selection-motion-ready')).toBe(false);
  select(tabs, 2); dispose = installSelectionStateMotion(document.body);
  expect(group.querySelectorAll('.selection-state-plate')).toHaveLength(1);
  expect(motion.retargetVisual).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ y: 100 }), { duration: 0 });
});

it('leaves business selection responsible for paint until layout is measurable, then releases it again when hidden', async () => {
  document.body.innerHTML = '<div id="overlay"><nav class="settings-nav"><button class="settings-tab" aria-selected="true">A</button><button class="settings-tab" aria-selected="false">B</button></nav></div>';
  const group = document.querySelector('nav'), tabs = [...group.children];
  let visible = false;
  group.getBoundingClientRect = () => rect(10, 20, visible ? 120 : 0, visible ? 180 : 0);
  tabs.forEach((tab, i) => { tab.getBoundingClientRect = () => rect(10, 20 + i * 50, visible ? 90 : 0, visible ? 40 : 0); });
  dispose = installSelectionStateMotion(document.body);
  const plate = group.querySelector('.selection-state-plate');
  expect(group.hasAttribute('data-selection-motion')).toBe(true);
  expect(group.hasAttribute('data-selection-motion-ready')).toBe(false);
  expect(tabs[0].getAttribute('aria-selected')).toBe('true');

  visible = true; window.dispatchEvent(new Event('resize')); await flush();
  expect(group.hasAttribute('data-selection-motion-ready')).toBe(true);
  expect(motion.retargetVisual).toHaveBeenLastCalledWith(plate, expect.objectContaining({ y: 0, opacity: 1 }), { duration: 0 });

  visible = false; group.hidden = true; await flush();
  expect(group.hasAttribute('data-selection-motion-ready')).toBe(false);
  expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  visible = true; group.hidden = false; select(tabs, 1); await flush();
  expect(group.hasAttribute('data-selection-motion-ready')).toBe(true);
  expect(motion.retargetVisual).toHaveBeenLastCalledWith(plate, expect.objectContaining({ y: 50, opacity: 1 }), { duration: 0 });
});

it('retains backpack filter buttons and the plate through refresh, with scroll and focus intact', () => {
  const markup = filter => `<div class="bag-v2"><nav class="bag-rail"><button class="bag-rz on" data-zone="bag" aria-label="bag"><span class="bag-bdg">0</span></button></nav><section class="bag-col"><header class="bag-head2">背包</header><div class="bag-tools"><button class="bag-pill${filter === 'all' ? ' on' : ''}" data-act="bagFilter" data-f="all">全部</button><button class="bag-pill${filter === 'move' ? ' on' : ''}" data-act="bagFilter" data-f="move">招式</button></div><div class="bag-board"><div class="bag-grid" data-zone="bag"></div></div></section></div>`;
  document.body.innerHTML = `<div id="overlay"><div id="ovBody">${markup('all')}</div></div>`;
  dispose = installSelectionStateMotion(document.body);
  const tools = document.querySelector('.bag-tools'), button = tools.querySelector('[data-f="move"]');
  const plate = tools.querySelector('.selection-state-plate'), board = document.querySelector('.bag-board');
  board.scrollTop = 97; button.focus();
  const UI = { el: { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') } };
  expect(patchBackpackPane(UI, { Icons: { rich: html => html } }, markup('move'), 'bag', true)).toBe(true);
  expect(document.querySelector('.bag-tools')).toBe(tools);
  expect(tools.querySelector('.selection-state-plate')).toBe(plate);
  expect(document.activeElement).toBe(button);
  expect(button.classList.contains('on')).toBe(true);
  expect(board.scrollTop).toBe(97);
});
