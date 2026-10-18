import { describe, it, expect, vi } from 'vitest';
import { createFlightRecorder, readFlight, sanitizeFlight, installFlightRecorder, FLIGHT_KEY, FLIGHT_LIMIT, FLIGHT_BYTES } from '../game/src/core/flight-recorder.local.js';
const port = () => { const data = new Map(); return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }; };
describe('bounded flight recorder', () => {
  it('preserves current epoch timestamps and distinct sessions', () => {
    const at = Date.parse('2026-10-17T17:20:00Z');
    expect(sanitizeFlight({ at, session: at })).toMatchObject({ at, session: at });
    expect(sanitizeFlight({ at: at + 1, session: at + 1 }).session).not.toBe(sanitizeFlight({ at, session: at }).session);
  });
  it('stores only numeric/boolean/enum fields, never arbitrary text or save', () => {
    const clean = sanitizeFlight({ at: 1, kind: 'click', action: 'SECRET', message: 'private', stack: 'secret', save: { hp: 1 }, music: 'private', backend: 'secret', errorName: 'secret' });
    expect(JSON.stringify(clean)).not.toMatch(/SECRET|private|secret|save|stack|message/);
    expect(clean.action).toBe('other');
  });
  it('bounds persisted ring and survives refresh without trusting stored extra fields', () => {
    const storage = port(); const a = createFlightRecorder({ storage, now: () => 2 });
    for (let i = 0; i < 500; i++) a.record({ kind: 'pulse', session: 1, dom: i });
    expect(a.read().records).toHaveLength(FLIGHT_LIMIT);
    expect(storage.getItem(FLIGHT_KEY).length).toBeLessThanOrEqual(FLIGHT_BYTES);
    const b = createFlightRecorder({ storage }); b.record({ kind: 'boot', session: 3 });
    expect(b.read().records.at(-2).dom).toBe(499);
    storage.setItem(FLIGHT_KEY, JSON.stringify([{ at: 1, kind: 'error', message: 'secret', errorName: 'TypeError' }]));
    expect(readFlight(storage)).toEqual([{ at: 1, kind: 'error', errorName: 'TypeError' }]);
  });
  it('handles corrupt, oversize and denied storage without interrupting caller', () => {
    const storage = port(); storage.setItem(FLIGHT_KEY, 'x'.repeat(FLIGHT_BYTES + 1));
    expect(readFlight(storage)).toEqual([]);
    const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
    const a = createFlightRecorder({ storage: bad });
    expect(() => a.record({ kind: 'pulse' })).not.toThrow();
    expect(a.read().persisted).toBe(false);
  });
  it('records heartbeats, lifecycle and categories without recording input text; stop cleans timers/listeners', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button>secret-card-title</button><input value="private">';
    const recorder = installFlightRecorder({ SDT: { Sound: { musicPlayback: { backend: 'html5', current: 'board', playing: true, volume: .45, tracks: [{}] } } }, game: {} });
    document.querySelector('button').dataset.act = 'cancelDragDiscard';
    document.querySelector('button').click();
    expect(recorder.read().records.at(-1).action).toBe('cancel');
    vi.advanceTimersByTime(4100);
    window.dispatchEvent(new Event('pagehide'));
    const rows = recorder.read().records;
    expect(rows.some(r => r.kind === 'boot')).toBe(true);
    expect(rows.filter(r => r.kind === 'pulse').length).toBeGreaterThanOrEqual(3);
    expect(rows.at(-1).kind).toBe('pagehide');
    expect(JSON.stringify(rows)).not.toContain('secret-card-title');
    expect(JSON.stringify(rows)).not.toContain('private');
    const count = rows.length; recorder.stop();
    vi.advanceTimersByTime(5000); document.querySelector('button').click();
    expect(recorder.read().records.length).toBe(count);
    localStorage.removeItem(FLIGHT_KEY); vi.useRealTimers();
  });
});
