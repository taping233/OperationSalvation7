import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFlightRecorder, recordRestoreStage, recordFrameStage, traceRestoreStep, sanitizeFlight } from '../game/src/core/flight-recorder.local.js';
let flight;
const stages = () => flight.read().records.filter(row => row.kind === 'restore-stage');
function install(query = '?flightRecord=1') {
  history.replaceState(null, '', `/${query}`);
  flight = installFlightRecorder({ SDT: {}, game: {} });
}
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { flight?.stop(); flight = null; history.replaceState(null, '', '/'); vi.useRealTimers(); vi.unstubAllEnvs(); });
describe('opt-in restore stage diagnostics', () => {
  it.each(['', '?flightRecord=0'])('does not record stages when disabled (%s)', query => {
    install(query); const operation = vi.fn(() => 7);
    recordRestoreStage('transition-mounted');
    expect(traceRestoreStep('load-game', operation)).toBe(7);
    expect(operation).toHaveBeenCalledOnce(); expect(stages()).toEqual([]);
  });
  it('does not activate stage diagnostics outside DEV even with query enabled', () => {
    vi.stubEnv('DEV', false); install();
    traceRestoreStep('load-game', () => true); expect(stages()).toEqual([]);
  });
  it('records parallel warm completion and nested synchronous restore in execution order', async () => {
    install(); let releaseModule, releaseWarm;
    const modulePromise = new Promise(resolve => { releaseModule = resolve; });
    const warmPromise = new Promise(resolve => { releaseWarm = resolve; });
    recordRestoreStage('transition-mounted');
    const moduleResult = traceRestoreStep('battle-module', () => modulePromise);
    const warmResult = traceRestoreStep('map-warm', () => warmPromise);
    expect(moduleResult).toBe(modulePromise); expect(warmResult).toBe(warmPromise);
    releaseWarm(); await warmPromise; releaseModule(); await modulePromise;
    const originalResult = { ok: true };
    expect(traceRestoreStep('load-game', () => {
      expect(traceRestoreStep('battle-restore', () => true)).toBe(true); return originalResult;
    })).toBe(originalResult);
    expect(stages().map(row => row.stage)).toEqual([
      'transition-mounted', 'battle-module-start', 'map-warm-start', 'map-warm-complete',
      'battle-module-complete', 'load-game-start', 'battle-restore-start', 'battle-restore-complete', 'load-game-complete',
    ]);
    expect(stages().map(row => row.stageSequence)).toEqual([1,2,3,4,5,6,7,8,9]);
  });
  it('preserves the exact synchronous error and rejected promise', async () => {
    install(); const error = new Error('private diagnostic text');
    expect(() => traceRestoreStep('battle-restore', () => { throw error; })).toThrow(error);
    const rejected = Promise.reject(error);
    const result = traceRestoreStep('battle-module', () => rejected);
    expect(result).toBe(rejected); await expect(result).rejects.toBe(error);
    expect(stages().map(row => row.stage)).toEqual(['battle-restore-start', 'battle-restore-failed', 'battle-module-start', 'battle-module-failed']);
    expect(JSON.stringify(stages())).not.toContain(error.message);
  });
  it('persists frame phases immediately with only bounded summaries and renderer backend', () => {
    install();
    recordFrameStage('renderer-loading', { roles:0, rendererBackend:'none' });
    recordFrameStage('app-init', { roles:2, roleNames:['private'], rendererBackend:'none', private:'secret' });
    recordFrameStage('app-ready', { roles:2, basePixels:200, resolution:1.5, rendererBackend:'webgl', staticDiagnostic:false });
    const rows = flight.read().records.filter(row => row.kind === 'frame-stage');
    expect(rows.map(row => row.framePhase)).toEqual(['renderer-loading', 'app-init', 'app-ready']);
    expect(rows[2]).toMatchObject({ roles:2, basePixels:200, resolution:1.5, rendererBackend:'webgl', staticDiagnostic:false });
    expect(JSON.stringify(rows)).not.toMatch(/private|secret|roleNames/);
    flight.stop(); recordFrameStage('released', {});
    expect(flight.read().records.filter(row => row.kind === 'frame-stage')).toHaveLength(3);
  });
  it('stops observations and rejects non-enum fields', () => {
    install(); recordRestoreStage('card-private-name'); expect(stages()).toEqual([]);
    const clean = sanitizeFlight({ kind:'restore-stage', stage:'private', slot:1, save:{}, cardName:'private', stageSequence:4 });
    expect(clean).toEqual({ at:null, kind:'restore-stage', stageSequence:4 });
    flight.stop(); traceRestoreStep('load-game', () => true); expect(stages()).toEqual([]);
  });
});
