import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTraceBuffer, installRuntimeTrace, sanitizeTraceRow, TRACE_LIMIT } from '../game/src/core/runtime-trace.local.js';
let installed;
afterEach(() => { installed?.destroy(); installed = null; document.body.innerHTML = ''; window.history.replaceState({}, '', '/'); vi.restoreAllMocks(); vi.useRealTimers(); });
function install(extra = {}) {
  window.history.replaceState({}, '', '/?runtimeTrace=1');
  document.body.innerHTML = '<div id="overlay"><div id="hubMain"><button>secret password</button></div></div>';
  installed = installRuntimeTrace(extra); return installed;
}
describe('opt-in local runtime trace', () => {
  it('does nothing without exact opt-in, including observer, frame, listeners and panel', () => {
    const listener = vi.spyOn(document, 'addEventListener'), raf = vi.spyOn(window, 'requestAnimationFrame');
    expect(installRuntimeTrace()).toBeNull(); expect(listener).not.toHaveBeenCalled(); expect(raf).not.toHaveBeenCalled();
    expect(document.getElementById('sdtRuntimeTrace')).toBeNull();
  });
  it('exports the controlled build label without collecting the page URL', () => {
    const trace = install();
    expect(trace.read().buildVersion).toBe(typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : 'dev');
    expect(JSON.stringify(trace.read())).not.toContain('runtimeTrace=1');
  });
  it('bounds memory, scrubs arbitrary text and clears counters', () => {
    const buffer = createTraceBuffer();
    for (let i = 0; i < TRACE_LIMIT + 4; i++) buffer.push({ kind: 'input', tMs: i, page: 'secret', action: 'password', token: 'secret' });
    expect(buffer.read().records).toHaveLength(TRACE_LIMIT); expect(buffer.read().dropped).toBe(4);
    expect(JSON.stringify(buffer.read())).not.toMatch(/secret|password|token/);
    expect(sanitizeTraceRow({ tMs: Infinity, durationMs: -1 })).toEqual({ kind: 'input' });
    buffer.clear(); expect(buffer.read()).toEqual({ dropped: 0, records: [] });
  });
  it('captures real event pathway, overlay update and frame opportunity with shared interaction ID, not text', async () => {
    vi.useFakeTimers(); const trace = install();
    document.querySelector('#hubMain button').click();
    document.querySelector('#overlay').innerHTML = '<div class="sts-hud">private save</div>';
    await Promise.resolve(); vi.advanceTimersByTime(80);
    const rows = trace.read().records;
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'input', interaction: 1, page: 'hub' }), expect.objectContaining({ kind: 'dom-update', interaction: 1, page: 'battle' }), expect.objectContaining({ kind: 'frame-opportunity', interaction: 1 })]));
    expect(JSON.stringify(trace.read())).not.toMatch(/secret|password|private save/);
    expect(trace.read().longTaskSupport).toBe('unsupported');
    expect(installRuntimeTrace()).toBeNull();
  });
  it('records long tasks by entry time and disconnects all collection on pagehide', () => {
    let callback; const disconnect = vi.fn(), takeRecords = vi.fn(() => []);
    class Observer { static supportedEntryTypes = ['longtask']; constructor(cb) { callback = cb; } observe() {} disconnect = disconnect; takeRecords = takeRecords; }
    vi.stubGlobal('PerformanceObserver', Observer);
    const trace = install(); callback({ getEntries: () => [{ startTime: performance.now() + 7, duration: 66, name: 'secret' }] });
    expect(trace.read()).toMatchObject({ longTaskSupport: 'supported' });
    expect(trace.read().records.at(-1)).toMatchObject({ kind: 'longtask', durationMs: 66 });
    window.dispatchEvent(new Event('pagehide')); const count = trace.read().records.length;
    document.querySelector('#hubMain button').click();
    expect(trace.read().active).toBe(false); expect(trace.read().records).toHaveLength(count); expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('cancels pending frame intervals when visibility changes', () => {
    vi.useFakeTimers(); const trace = install();
    document.querySelector('#hubMain button').click();
    document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(10000);
    expect(trace.read().records.some(row => row.kind === 'visibility')).toBe(true);
    expect(trace.read().records.some(row => row.kind === 'frame-opportunity')).toBe(false);
  });
  it('tracks card drag start/release outside the hand without reading card identity', () => {
    const trace = install();
    document.querySelector('#hubMain').innerHTML = '<div class="sts-hand"><div data-uid="private-card">card</div></div>';
    document.querySelector('[data-uid]').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.body.dispatchEvent(new Event('pointerup', { bubbles: true }));
    const rows = trace.read().records.filter(row => row.kind === 'input');
    expect(rows.map(row => [row.action, row.trigger])).toEqual([['card', 'pointerdown'], ['card', 'pointerup']]);
    expect(JSON.stringify(rows)).not.toContain('private-card');
  });
  it('requires visible sync action, clear cancels old frame callbacks, download is explicit', () => {
    vi.useFakeTimers(); const trace = install();
    const create = vi.fn(() => 'blob:test'), revoke = vi.fn();
    window.URL.createObjectURL = create; window.URL.revokeObjectURL = revoke;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(create).not.toHaveBeenCalled();
    document.querySelector('[data-trace="sync"]').click();
    expect(trace.read().records.at(-1)).toMatchObject({ kind: 'sync', marker: 1 });
    document.querySelector('#hubMain button').click(); document.querySelector('[data-trace="clear"]').click(); vi.advanceTimersByTime(100);
    expect(trace.read().records).toEqual([]);
    document.querySelector('[data-trace="export"]').click(); expect(create).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
