import { describe, expect, it } from 'vitest';
import { alignRuntimeTrace } from '../scripts/runtime-trace-alignment.mjs';
import { reportHTML } from '../scripts/video-review.mjs';
const trace = { schema: 'sdt-runtime-trace-v1', longTaskSupport: 'unsupported', dropped: 2, records: [{ kind: 'sync', marker: 1, tMs: 1000 }, { kind: 'input', tMs: 1500, interaction: 1, action: 'card', secret: 'password' }] };
describe('manual runtime/video alignment', () => {
  it('requires explicit anchor and matching retained marker', () => {
    expect(() => alignRuntimeTrace(trace, {})).toThrow();
    expect(() => alignRuntimeTrace(trace, { marker: 2, videoSeconds: 0 })).toThrow();
    expect(() => alignRuntimeTrace(trace, { marker: 1, videoSeconds: -1 })).toThrow();
  });
  it('maps trace time to primary source time while preserving metric limits', () => {
    const result = alignRuntimeTrace(trace, { marker: 1, videoSeconds: 4.2 });
    expect(result.records[1].videoSeconds).toBe(4.7); expect(result.dropped).toBe(2);
    expect(JSON.stringify(result)).not.toMatch(/password|secret/);
    const html = reportHTML({ videos: [], runtimeTrace: result });
    expect(html).toContain('4.700s input card'); expect(html).toContain('unsupported'); expect(html).toContain('仅主视频');
  });
  it('retains whitelisted stage labels in aligned JSON and video report', () => {
    const staged = { ...trace, records: [...trace.records, { kind: 'stage', stage: 'settings-overlay-sync', tMs: 1600, durationMs: 20, interaction: 1 }] };
    const result = alignRuntimeTrace(staged, { marker: 1, videoSeconds: 4.2 });
    expect(result.records.at(-1)).toMatchObject({ stage: 'settings-overlay-sync', videoSeconds: 4.8, durationMs: 20 });
    expect(reportHTML({ videos: [], runtimeTrace: result })).toContain('4.800s stage settings-overlay-sync');
  });
  it('rejects oversized and duplicate sync anchors', () => {
    expect(() => alignRuntimeTrace({ ...trace, records: Array(401).fill(trace.records[0]) }, { marker: 1, videoSeconds: 0 })).toThrow();
    expect(() => alignRuntimeTrace({ ...trace, records: [trace.records[0], trace.records[0]] }, { marker: 1, videoSeconds: 0 })).toThrow();
  });
});

describe('stage comparisons', () => {
  const stage = (name, durationMs, interaction = 1, extra = {}) => ({ kind:'stage', stage:name, durationMs, interaction, tMs:100, visible:true, ...extra });
  const input = records => ({ schema:'sdt-runtime-trace-v1', records, dropped:0, longTaskSupport:'supported' });
  it('pairs synchronous samples per interaction, excluding asynchronous waits', async () => {
    const { compareRuntimeStages } = await import('../scripts/runtime-trace-alignment.mjs');
    const before = input([stage('settings-overlay-sync', 50), stage('settings-navigation-sync', 30), stage('settings-module-wait', 900)]);
    const after = input([stage('settings-overlay-sync', 20), stage('settings-navigation-sync', 10)]);
    const result = compareRuntimeStages(before, after);
    expect(result.before.synchronousSettings).toMatchObject({ n:1, medianMs:80, moduleWaitObserved:{ n:1 } });
    expect(result.after.synchronousSettings.noModuleWaitObserved.n).toBe(1);
    expect(result.synchronousMedianChangeMs).toBe(-50);
  });
  it('excludes hidden, unknown and invalid samples without inventing zero medians', async () => {
    const { summarizeRuntimeStages } = await import('../scripts/runtime-trace-alignment.mjs');
    const result = summarizeRuntimeStages(input([stage('settings-overlay-sync', 10, 1, { visible:false }), stage('secret', 10), stage('settings-navigation-sync', -1)]));
    expect(result.synchronousSettings.medianMs).toBeNull(); expect(result.excludedStageRecords).toBe(3);
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('does not pair duplicate or incomplete boundaries', async () => {
    const { summarizeRuntimeStages } = await import('../scripts/runtime-trace-alignment.mjs');
    const result = summarizeRuntimeStages(input([stage('settings-overlay-sync', 10), stage('settings-overlay-sync', 20), stage('settings-navigation-sync', 3), stage('settings-overlay-sync', 5, 2)]));
    expect(result.synchronousSettings).toMatchObject({ n:0, incompleteOrAmbiguousInteractions:2 });
  });
  it('counts distinct overlapping long tasks once and retains missing API/dropped caveats', async () => {
    const { summarizeRuntimeStages } = await import('../scripts/runtime-trace-alignment.mjs');
    const result = summarizeRuntimeStages({ ...input([stage('settings-overlay-sync', 20), stage('settings-navigation-sync', 20), {kind:'longtask',tMs:90,durationMs:60,visible:true}]), dropped:7, longTaskSupport:'unsupported' });
    expect(result.longTasks).toEqual({ support:'unsupported', visibleRecords:1, overlappingStageRecords:1 }); expect(result.dropped).toBe(7);
  });
  it('rejects wrong schema and oversized inputs', async () => {
    const { summarizeRuntimeStages } = await import('../scripts/runtime-trace-alignment.mjs');
    expect(() => summarizeRuntimeStages({})).toThrow(); expect(() => summarizeRuntimeStages(input(Array(401).fill({})))).toThrow();
  });
});
