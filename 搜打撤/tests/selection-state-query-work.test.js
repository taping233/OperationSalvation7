import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installSelectionStateMotion } from '../game/src/ui/selection-state-motion.js';

const motion = vi.hoisted(() => ({ retargetVisual: vi.fn(), clearVisual: vi.fn() }));
vi.mock('../game/src/ui/target-motion.js', () => motion);
let dispose, resize;
const rect = (left = 0) => ({ left, top: 0, width: 100, height: 40 });
const flush = async () => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(40); };
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback) { resize = { callback, observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }; return resize; }
  });
});
afterEach(() => {
  dispose?.(); dispose = null; document.body.replaceChildren();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});
async function mount() {
  document.body.innerHTML = '<nav class="settings-nav"><button class="settings-tab" aria-selected="true">A</button><button class="settings-tab" aria-selected="false">B</button></nav>';
  const group = document.querySelector('nav'), [first, second] = group.children;
  group.getBoundingClientRect = () => rect();
  first.getBoundingClientRect = () => rect(); second.getBoundingClientRect = () => rect(100);
  dispose = installSelectionStateMotion(document.body); await flush();
  const rootQueries = vi.spyOn(document.body, 'querySelectorAll');
  const itemQueries = vi.spyOn(group, 'querySelectorAll');
  return { group, first, second, rootQueries, itemQueries };
}

it('does zero membership scans across 20 scroll/resize frames while still following geometry', async () => {
  const { group, rootQueries, itemQueries } = await mount();
  for (let i = 1; i <= 20; i++) {
    group.scrollLeft = i;
    group.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('resize')); resize.callback();
    await flush();
  }
  expect.soft(rootQueries).toHaveBeenCalledTimes(0); expect.soft(itemQueries).toHaveBeenCalledTimes(0);
  expect(motion.retargetVisual).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ x: 20 }), {});
});

it('selects live aria state and hides zero-sized selection without rediscovering members', async () => {
  const { first, second, rootQueries, itemQueries } = await mount();
  first.setAttribute('aria-selected', 'false'); second.setAttribute('aria-selected', 'true'); await flush();
  expect(motion.retargetVisual).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ x: 100 }), {});
  second.hidden = true; second.getBoundingClientRect = () => ({ ...rect(), width: 0 }); await flush();
  expect(motion.retargetVisual).toHaveBeenLastCalledWith(expect.any(HTMLElement), { opacity: 0 });
  second.hidden = false; second.getBoundingClientRect = () => rect(100); await flush();
  expect(motion.retargetVisual).toHaveBeenLastCalledWith(expect.any(HTMLElement), expect.objectContaining({ x: 100 }), { duration: 0 });
  expect(rootQueries).not.toHaveBeenCalled(); expect(itemQueries).not.toHaveBeenCalled();
});

it('discovers added members and groups, unobserves removed members, and releases removed groups', async () => {
  const { group, first, rootQueries } = await mount();
  const added = first.cloneNode(true); added.getBoundingClientRect = () => rect(200);
  first.remove(); group.append(added); await flush();
  expect(rootQueries).toHaveBeenCalledTimes(6);
  expect(resize.unobserve).toHaveBeenCalledWith(first); expect(resize.observe).toHaveBeenCalledWith(added);
  const newGroup = group.cloneNode(true); newGroup.querySelector('.selection-state-plate').remove();
  document.body.append(newGroup); await flush(); expect(resize.observe).toHaveBeenCalledWith(newGroup);
  const plate = group.querySelector('.selection-state-plate'); group.remove(); await flush();
  expect(motion.clearVisual).toHaveBeenCalledWith(plate); expect(resize.unobserve).toHaveBeenCalledWith(added);
});

it('invalidates class-based group and item membership including the root group', async () => {
  const { group, first } = await mount();
  first.classList.remove('settings-tab'); await flush(); expect(resize.unobserve).toHaveBeenCalledWith(first);
  first.classList.add('settings-tab'); await flush(); expect(resize.observe).toHaveBeenCalledWith(first);
  const plate = group.querySelector('.selection-state-plate'); group.classList.remove('settings-nav'); await flush();
  expect(motion.clearVisual).toHaveBeenCalledWith(plate); expect(plate.isConnected).toBe(false);
  dispose(); group.classList.add('settings-nav'); dispose = installSelectionStateMotion(group); await flush();
  expect(group.querySelectorAll('.selection-state-plate')).toHaveLength(1);
});

it('disposal cancels queued work and observers and reopening rediscovers the current tree', async () => {
  const { group, rootQueries, itemQueries } = await mount();
  group.dispatchEvent(new Event('scroll')); dispose();
  const calls = motion.retargetVisual.mock.calls.length;
  group.append(document.createElement('button')); resize.callback(); window.dispatchEvent(new Event('resize'));
  group.dispatchEvent(new Event('scroll')); await flush();
  expect(rootQueries).not.toHaveBeenCalled(); expect(itemQueries).not.toHaveBeenCalled();
  expect(motion.retargetVisual).toHaveBeenCalledTimes(calls); expect(resize.disconnect).toHaveBeenCalledOnce();
  dispose = installSelectionStateMotion(document.body); await flush(); expect(rootQueries).toHaveBeenCalled();
  expect(group.querySelectorAll('.selection-state-plate')).toHaveLength(1);
});
