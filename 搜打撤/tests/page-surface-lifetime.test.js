import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPageSurfaceLifetime } from '../game/src/ui/page-surface-lifetime.js';
import { stagePageVisual, stageMapReturn, cancelPageVisual } from '../game/src/ui/page-visual-ready.js';
let ui;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(fn,16)); vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  document.body.innerHTML = '<div id="overlay"><div class="card"><div id="ovBody"><main>旧页</main></div></div></div>';
  ui = {_overlayRevision:1, el:{overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody')},_pageBgReady:new Promise(() => {})};
});
afterEach(() => { cancelPageVisual(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
it('revision guards synchronous stale calls before MutationObserver delivery; invalidation occurs once', async () => {
  const invalidated = vi.fn();
  const lifetime = createPageSurfaceLifetime(document.querySelector('main'),{getRevision:()=>ui._overlayRevision,onInvalidate:invalidated});
  expect(lifetime.current()).toBe(true);
  ui._overlayRevision++;
  expect(lifetime.current()).toBe(false);
  ui.el.ovBody.innerHTML = '<main>新页</main>';
  await Promise.resolve();
  expect(lifetime.signal.aborted).toBe(true); expect(invalidated).toHaveBeenCalledOnce();
  lifetime.dispose(); expect(invalidated).toHaveBeenCalledOnce();
});
it('ordinary page handoff ignores late old readiness and retains a new page cover', async () => {
  const oldReveal=vi.fn(), newReveal=vi.fn();
  stagePageVisual(ui,oldReveal); await vi.advanceTimersByTimeAsync(48);
  ui.el.ovBody.innerHTML = '<main>新页</main>'; ui._overlayRevision++;
  stagePageVisual(ui,newReveal); await vi.advanceTimersByTimeAsync(48);
  expect(document.querySelectorAll('.page-visual-handoff')).toHaveLength(1);
  expect(oldReveal).not.toHaveBeenCalled(); expect(newReveal).not.toHaveBeenCalled();
  await vi.runAllTimersAsync();
  expect(oldReveal).not.toHaveBeenCalled(); expect(newReveal).toHaveBeenCalledOnce();
  expect(document.querySelector('.page-visual-handoff')).toBeNull();
});
it('native closing invalidates an ordinary reveal without hiding the overlay itself', async () => {
  const reveal=vi.fn(); stagePageVisual(ui,reveal);
  ui.el.overlay.classList.add('closing'); await Promise.resolve(); await vi.runAllTimersAsync();
  expect(reveal).not.toHaveBeenCalled(); expect(ui.el.overlay.hidden).toBe(false);
  expect(document.querySelector('.page-visual-handoff')).toBeNull();
});

it('an already hidden host invalidates without waiting for a later DOM mutation', async () => {
  ui.el.overlay.hidden = true;
  const invalidated = vi.fn();
  const lifetime = createPageSurfaceLifetime(document.querySelector('main'), {onInvalidate:invalidated});
  expect(lifetime.current()).toBe(false);
  await Promise.resolve();
  expect(invalidated).toHaveBeenCalledOnce(); expect(lifetime.signal.aborted).toBe(true);
});

it('a cancelled page cannot clear the pending state of the next attached panel', async () => {
  const oldReveal = vi.fn(), newReveal = vi.fn();
  stagePageVisual(ui, oldReveal);
  await vi.advanceTimersByTimeAsync(48);
  ui.el.ovBody.innerHTML = '<main>背包</main>'; ui._overlayRevision++;
  stagePageVisual(ui, newReveal, { kind: 'panel' });
  await vi.advanceTimersByTimeAsync(48);
  expect(ui.el.overlay.dataset.visualPending).toBe('panel');
  const cover = document.querySelector('.page-visual-handoff');
  expect(cover.dataset.kind).toBe('panel'); expect(cover.children).toHaveLength(0);
  cancelPageVisual();
  await vi.runAllTimersAsync();
  expect(ui.el.overlay.dataset.visualPending).toBeUndefined();
  expect(oldReveal).not.toHaveBeenCalled(); expect(newReveal).not.toHaveBeenCalled();
});

it('reduced motion reveals once readiness completes without a decorative exit wait', async () => {
  document.body.classList.add('reduce-motion');
  ui._pageBgReady = Promise.resolve();
  const reveal = vi.fn(); stagePageVisual(ui, reveal);
  await vi.advanceTimersByTimeAsync(100);
  expect(reveal).toHaveBeenCalledOnce();
  expect(document.querySelector('.page-visual-handoff')).toBeNull();
  document.body.classList.remove('reduce-motion');
});

it('backpack return retains a transparent input guard until the first map frame', async () => {
  let ready; const prepare = vi.fn(() => new Promise(resolve => { ready = resolve; }));
  window.SDT = { Renderer: { prepare } };
  const game = { discoveredPairs: [], runActive: true, battleActive: false, nestActive: false };
  stageMapReturn(ui, game, { kind: 'panel' });
  ui.el.overlay.hidden = true;
  await vi.advanceTimersByTimeAsync(32);
  const cover = document.querySelector('.page-visual-return');
  expect(cover.dataset.kind).toBe('panel'); expect(cover.children).toHaveLength(0);
  expect(prepare).toHaveBeenCalledOnce();
  ready(); await vi.advanceTimersByTimeAsync(300);
  expect(document.querySelector('.page-visual-return')).toBeNull();
});

it('settings readiness timing retains original input and stays separate from sync mounting', async () => {
  window.history.replaceState({}, '', '/?runtimeTrace=1');
  const { installRuntimeTrace } = await import('../game/src/core/runtime-trace.local.js');
  ui.el.ovBody.innerHTML = '<main class="settings-page"><button>设置</button></main>';
  const trace = installRuntimeTrace();
  const button = ui.el.ovBody.querySelector('button');
  let release; ui._pageBgReady = new Promise(resolve => { release = resolve; });
  const reveal = vi.fn();
  try {
    button.click(); stagePageVisual(ui, reveal);
    await vi.advanceTimersByTimeAsync(48);
    expect(trace.read().records.some(row => row.kind === 'stage')).toBe(false);
    button.click(); release(); await vi.advanceTimersByTimeAsync(32);
    expect(reveal).toHaveBeenCalledOnce();
    const rows = trace.read().records.filter(row => row.kind === 'stage');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ stage:'settings-visual-wait', interaction:1 });
    expect(rows[0].durationMs).toBeGreaterThanOrEqual(32);
  } finally { trace.destroy(); window.history.replaceState({}, '', '/'); }
});

it('cancelled settings readiness settles its measured wait without implying reveal success', async () => {
  window.history.replaceState({}, '', '/?runtimeTrace=1');
  const { installRuntimeTrace } = await import('../game/src/core/runtime-trace.local.js');
  ui.el.ovBody.innerHTML = '<main class="settings-page"><button>设置</button></main>';
  const trace = installRuntimeTrace(); const reveal = vi.fn();
  try {
    ui.el.ovBody.querySelector('button').click(); stagePageVisual(ui, reveal);
    await vi.advanceTimersByTimeAsync(48); cancelPageVisual(); await vi.runAllTimersAsync();
    expect(reveal).not.toHaveBeenCalled();
    expect(trace.read().records.filter(row => row.kind === 'stage')).toEqual([
      expect.objectContaining({ stage:'settings-visual-wait', interaction:1 }),
    ]);
  } finally { trace.destroy(); window.history.replaceState({}, '', '/'); }
});
