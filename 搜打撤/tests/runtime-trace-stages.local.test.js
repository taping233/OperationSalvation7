import { afterEach, describe, expect, it, vi } from 'vitest';
import { installRuntimeTrace, sanitizeTraceRow } from '../game/src/core/runtime-trace.local.js';
import { beginRuntimeStage, captureRuntimeStageContext, withRuntimeStageContext, RUNTIME_STAGES } from '../game/src/core/runtime-trace-stages.local.js';
let trace;
afterEach(() => { trace?.destroy(); trace = null; document.body.replaceChildren(); window.history.replaceState({}, '', '/'); vi.restoreAllMocks(); vi.useRealTimers(); });
function install() {
  vi.useFakeTimers(); window.history.replaceState({}, '', '/?runtimeTrace=1');
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><button>private</button></div></div>';
  trace = installRuntimeTrace(); return trace;
}
const input = () => document.querySelector('#ovBody button').click();
const stages = () => trace.read().records.filter(row => row.kind === 'stage');
describe('bounded local stage instrumentation', () => {
  it('is inert before explicit trace installation, with no clock or listener work', () => {
    const now = vi.spyOn(performance, 'now'), listener = vi.spyOn(document, 'addEventListener');
    const finish = beginRuntimeStage('settings-overlay-sync'); finish();
    expect(captureRuntimeStageContext()).toBeUndefined(); expect(now).not.toHaveBeenCalled(); expect(listener).not.toHaveBeenCalled();
  });
  it('accepts only eight fixed labels and strips arbitrary payloads', () => {
    install(); input();
    for (const stage of RUNTIME_STAGES) { const finish = beginRuntimeStage(stage); vi.advanceTimersByTime(2); finish(); finish(); }
    beginRuntimeStage('secret-token')();
    expect(stages()).toHaveLength(8); expect(stages().map(row => row.stage)).toEqual(RUNTIME_STAGES);
    expect(sanitizeTraceRow({ kind: 'stage', stage: 'password', token: 'secret', durationMs: -1 })).toEqual({ kind: 'stage' });
    expect(sanitizeTraceRow({ kind: 'input', stage: 'settings-overlay-sync' })).toEqual({ kind: 'input' });
  });
  it('keeps async stages and subsequent scoped sync work on their original input', () => {
    install(); input(); const context = captureRuntimeStageContext();
    const finish = beginRuntimeStage('settings-module-wait', context);
    vi.advanceTimersByTime(40); input(); finish();
    withRuntimeStageContext(context, () => beginRuntimeStage('settings-overlay-sync')());
    beginRuntimeStage('settings-navigation-sync')();
    expect(stages().map(row => row.interaction)).toEqual([1, 1, 2]);
    expect(stages()[0].durationMs).toBe(40);
  });
  it('does not fabricate an interaction when no input was observed', () => {
    install(); beginRuntimeStage('settings-overlay-sync')(); expect(stages()).toEqual([]);
  });
  it.each(['clear', 'visibility', 'stop', 'destroy'])('invalidates pending and captured stages on %s', mode => {
    install(); input(); const context = captureRuntimeStageContext(); const finish = beginRuntimeStage('settings-module-wait');
    if (mode === 'clear') document.querySelector('[data-trace="clear"]').click();
    if (mode === 'visibility') document.dispatchEvent(new Event('visibilitychange'));
    if (mode === 'stop') trace.stop();
    if (mode === 'destroy') trace.destroy();
    vi.advanceTimersByTime(20); finish(); withRuntimeStageContext(context, () => beginRuntimeStage('settings-overlay-sync')());
    expect(stages()).toEqual([]);
  });
  it('restores scope after throw and rejects context from an earlier installation', () => {
    install(); input(); const old = captureRuntimeStageContext(); trace.destroy(); trace = installRuntimeTrace();
    input(); const current = captureRuntimeStageContext();
    expect(() => withRuntimeStageContext(old, () => { throw new Error('expected'); })).toThrow('expected');
    expect(captureRuntimeStageContext()).toEqual(current);
    beginRuntimeStage('settings-module-wait', old)(); beginRuntimeStage('settings-overlay-sync')();
    expect(stages()).toHaveLength(1);
  });
});
