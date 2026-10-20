import { afterEach, expect, it, vi } from 'vitest';
import { createEventTimingMatcher, sanitizeTraceRow, installRuntimeTrace, TRACE_LIMIT } from '../game/src/core/runtime-trace.local.js';
import { alignRuntimeTrace, summarizeRuntimeStages } from '../scripts/runtime-trace-alignment.mjs';
import { reportHTML } from '../scripts/video-review.mjs';
let installed;
afterEach(() => { installed?.destroy(); installed = null; document.body.innerHTML = ''; window.history.replaceState({}, '', '/'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const entry = (extra = {}) => ({ name: 'click', startTime: 100, processingStart: 120, processingEnd: 132, duration: 48, interactionId: 987654, ...extra });
it('matches timestamps/types, reports separate delays and remaps groups without touching private entry fields', () => {
  const match = createEventTimingMatcher(); match.remember('click', 100, 1); match.remember('pointerup', 99, 2);
  const input = entry();
  for (const key of ['target', 'targetSelector', 'key', 'clientX', 'url']) Object.defineProperty(input, key, { get() { throw new Error('private field read'); } });
  expect(match.match(input)).toEqual({ kind: 'event-timing', tMs: 100, durationMs: 48, interaction: 1, trigger: 'click', inputDelayMs: 20, processingMs: 12, browserInteraction: 1 });
  expect(match.match(entry({ name: 'pointerup', startTime: 99 }))).toMatchObject({ interaction: 2, browserInteraction: 1 });
  expect(match.match(input)).toBeNull();
});
it('drops unknown, ambiguous, mismatched and invalid timings, bounds matching and clears pending work', () => {
  const match = createEventTimingMatcher(); match.remember('click', 100, 1); match.remember('click', 100, 2);
  expect(match.match(entry())).toBeNull(); match.clear();
  match.remember('keydown', 100, 3); expect(match.match(entry())).toBeNull();
  expect(match.match(entry({ name: 'keydown', startTime: 100.01 }))).toBeNull();
  expect(match.match(entry({ name: 'keydown', processingEnd: 119 }))).toBeNull();
  expect(match.match(entry({ name: 'keydown', interactionId: 0 }))).toMatchObject({ trigger: 'escape' });
  match.clear(); expect(match.match(entry({ name: 'keydown' }))).toBeNull();
  for (let i = 0; i <= TRACE_LIMIT; i++) match.remember('click', i, i + 1);
  expect(match.match(entry({ startTime: 0 }))).toBeNull();
});
it('whitelists event fields in online and offline paths and leaves old traces compatible', () => {
  const row = sanitizeTraceRow({ kind: 'event-timing', tMs: 1, durationMs: 24, inputDelayMs: 3, processingMs: 7, browserInteraction: 1, interaction: 1, visible: true, target: 'secret', interactionId: 987654, key: 'private' });
  const trace = { schema: 'sdt-runtime-trace-v1', eventTimingSupport: 'supported', eventDurationThresholdMs: 16, records: [{ kind: 'sync', marker: 1, tMs: 0 }, row] };
  const aligned = alignRuntimeTrace(trace, { marker: 1, videoSeconds: 0 });
  expect(JSON.stringify(aligned)).not.toMatch(/secret|private|987654/);
  expect(summarizeRuntimeStages(trace).eventTiming).toMatchObject({ inputDelay: { n: 1, medianMs: 3 }, anonymousGroups: 1 });
  expect(summarizeRuntimeStages({ ...trace, records: [] }).eventTiming.duration.medianMs).toBeNull();
  expect(sanitizeTraceRow({ kind: 'input', inputDelayMs: 3 })).not.toHaveProperty('inputDelayMs');
  const html = reportHTML({ videos: [], runtimeTrace: aligned });
  expect(html).toContain('inputDelayMs=3'); expect(html).toContain('browserGroup=1'); expect(html).toContain('事件时序API：supported');
});
it('registers only while opted in, degrades failures, disconnects and does not leak generic keyboard entries', () => {
  const observers = [];
  class Observer { static supportedEntryTypes = ['event']; constructor(cb) { this.cb = cb; observers.push(this); } observe = vi.fn(); disconnect = vi.fn(); takeRecords = vi.fn(() => []); }
  vi.stubGlobal('PerformanceObserver', Observer);
  expect(installRuntimeTrace()).toBeNull(); expect(observers).toHaveLength(0);
  window.history.replaceState({}, '', '/?runtimeTrace=1'); document.body.innerHTML = '<div id="overlay"></div>';
  installed = installRuntimeTrace();
  expect(observers[0].observe).toHaveBeenCalledWith({ type: 'event', buffered: false, durationThreshold: 16 });
  expect(installed.read().eventTimingSupport).toBe('supported');
  observers[0].cb({ getEntries: () => [entry({ startTime: performance.now(), name: 'keydown' })] });
  expect(installed.read().records.some(row => row.kind === 'event-timing')).toBe(false);
  window.dispatchEvent(new Event('pagehide')); expect(observers[0].disconnect).toHaveBeenCalled();
  installed.destroy(); installed = null;
  class Broken extends Observer { constructor(cb) { super(cb); this.observe = () => { throw new Error('unsupported'); }; } }
  vi.stubGlobal('PerformanceObserver', Broken);
  installed = installRuntimeTrace(); expect(installed.read().eventTimingSupport).toBe('unavailable');
});
it('collects matched inputs only and rejects stale entries across clear, visibility and stop', () => {
  let observer;
  class Observer { static supportedEntryTypes = ['event']; constructor(cb) { this.cb = cb; observer = this; } observe() {} disconnect = vi.fn(); takeRecords = vi.fn(() => []); }
  vi.stubGlobal('PerformanceObserver', Observer);
  const listeners = vi.spyOn(document, 'addEventListener');
  window.history.replaceState({}, '', '/?runtimeTrace=1'); document.body.innerHTML = '<div id="overlay"><button>private</button></div>';
  installed = installRuntimeTrace();
  const input = listeners.mock.calls.find(([name]) => name === 'click')[1];
  const stamp = () => performance.now();
  const fire = t => input({ type: 'click', target: document.querySelector('#overlay button'), isTrusted: true, timeStamp: t });
  const emit = t => observer.cb({ getEntries: () => [entry({ startTime: t, processingStart: t + 2, processingEnd: t + 5 })] });
  const first = stamp(); fire(first); emit(first);
  expect(installed.read().records.filter(row => row.kind === 'event-timing')).toEqual([expect.objectContaining({ interaction: 1, inputDelayMs: 2, processingMs: 3, visible: true })]);
  const old = stamp(); fire(old); document.querySelector('[data-trace="clear"]').click(); emit(old);
  expect(installed.read().records).toHaveLength(0);
  const hidden = stamp(); fire(hidden); document.dispatchEvent(new Event('visibilitychange')); emit(hidden);
  expect(installed.read().records.filter(row => row.kind === 'event-timing')).toHaveLength(0);
  const resumed = stamp(); fire(resumed); emit(resumed);
  expect(installed.read().records.filter(row => row.kind === 'event-timing')).toHaveLength(1);
  installed.stop(); const count = installed.read().records.length; emit(stamp());
  expect(installed.read().records).toHaveLength(count); expect(observer.disconnect).toHaveBeenCalled();
});
it('bounds anonymous mapping without reusing evicted or cleared group identities', () => {
  const match = createEventTimingMatcher();
  const sample = (i, raw) => { match.remember('click', i, i + 1); return match.match(entry({ startTime: i, processingStart: i + 1, processingEnd: i + 2, interactionId: raw })); };
  for (let i = 0; i <= TRACE_LIMIT; i++) expect(sample(i, i + 1000).browserInteraction).toBe(i + 1);
  expect(sample(500, 1000).browserInteraction).toBe(402);
  match.clear(); expect(sample(600, 1000).browserInteraction).toBe(403);
});
