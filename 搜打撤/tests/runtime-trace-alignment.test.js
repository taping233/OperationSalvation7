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
