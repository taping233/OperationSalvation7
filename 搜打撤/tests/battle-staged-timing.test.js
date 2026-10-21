import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const timing = vi.hoisted(() => ({ remaining: vi.fn(), waits: vi.fn(), feedback: vi.fn() }));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({ actionImpactRemaining: timing.remaining }));
vi.mock('../game/src/battle/view/battle.feedback.js', () => ({
  clearFeedback: vi.fn(), waitForFeedback: timing.feedback, waitMs: timing.waits,
}));
vi.mock('../game/src/battle/runtime/battle.pace.js', () => ({ demoMs: ms => ms / 2 }));
import { createStagedPlayback } from '../game/src/battle/runtime/battle.staged-playback.js';

beforeEach(() => { vi.clearAllMocks(); timing.waits.mockResolvedValue(); timing.feedback.mockResolvedValue(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const run = (steps, floats) => createStagedPlayback({
  session: { generation: 1, stagedResolutionDepth: 0, stagedDeathFx: new Set() },
  getBattleToken: () => 'battle', getFloats: () => floats, foeIdx: () => 0,
  render() {}, finish() {},
})(steps, new AbortController().signal);

it('waits the already paced live frame remainder before damage and keeps later combo beats short', async () => {
  const floats = [], cue = { attacker: 'player-attack', profile: 'combo', windupMs: 90 };
  timing.remaining.mockReturnValueOnce(125).mockReturnValueOnce(0);
  function* steps() {
    for (let i = 0; i < 2; i++) {
      yield { kind: 'windup', targets: [{}], cue };
      expect(timing.waits.mock.calls[i][0]).toBe(i ? 45 : 125);
      floats.push({ unit: 0, hpBefore: 10, hpAfter: 9 });
      yield { kind: 'hit', cue };
    }
  }
  await run(steps(), floats);
  const hits = floats.filter(f => f.hpBefore != null);
  expect(hits).toHaveLength(2);
  expect(hits.every(f => f.cue.frameSynced)).toBe(true);
  expect(timing.remaining).toHaveBeenCalledWith(expect.objectContaining({ attacker: 'player-attack' }), 'battle');
});

it.each([null, 0])('retains cue fallback without a live action and does not add delay to an already reached first contact (%s)', async remaining => {
  const floats = [], cue = { attacker: 'player-spell', windupMs: 200 };
  timing.remaining.mockReturnValue(remaining);
  function* steps() {
    yield { kind: 'windup', targets: [{}], cue };
    floats.push({ unit: 0, hpBefore: 10 });
    yield { kind: 'hit', cue };
  }
  await run(steps(), floats);
  expect(timing.waits.mock.calls[0][0]).toBe(remaining === null ? 100 : 0);
  expect(floats.at(-1).cue.frameSynced).toBe(remaining === null ? undefined : true);
});

it('waits for an asynchronous render to enqueue its delayed windup before sampling live frame timing', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', callback => setTimeout(callback, 16));
  vi.stubGlobal('cancelAnimationFrame', id => clearTimeout(id));
  const floats = [], cue = { attacker: 'player-attack', windupMs: 130 };
  let actorStarted = false, tail = Promise.resolve(), dealt = false;
  timing.feedback.mockImplementation(() => tail);
  timing.remaining.mockImplementation(() => actorStarted ? 167 : null);
  timing.waits.mockImplementation(ms => new Promise(resolve => setTimeout(resolve, ms)));
  const playback = createStagedPlayback({
    session: { generation: 1, stagedResolutionDepth: 0, stagedDeathFx: new Set() },
    getBattleToken: () => 'battle', getFloats: () => floats, foeIdx: () => 0,
    render() { requestAnimationFrame(() => {
      if (!floats.some(f => f.cls === 'windupfx')) return;
      floats.splice(0);
      tail = new Promise(resolve => setTimeout(() => { actorStarted = true; resolve(); }, 340));
    }); }, finish() {},
  });
  function* steps() {
    yield { kind: 'windup', targets: [{}], cue };
    dealt = true; yield { kind: 'hit', cue };
  }
  const done = playback(steps(), new AbortController().signal);
  await vi.advanceTimersByTimeAsync(355);
  expect(actorStarted).toBe(false); expect(dealt).toBe(false);
  expect(timing.remaining).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(actorStarted).toBe(true); expect(dealt).toBe(false);
  expect(timing.waits).toHaveBeenCalledWith(167, expect.any(AbortSignal));
  await vi.advanceTimersByTimeAsync(166); expect(dealt).toBe(false);
  await vi.advanceTimersByTimeAsync(100); await done; expect(dealt).toBe(true);
});

it('cancels a pending rendered-frame barrier without mutating the next battle', async () => {
  const frames = new Map(); let frame = 0, token = 'old';
  vi.stubGlobal('requestAnimationFrame', callback => { frames.set(++frame, callback); return frame; });
  const cancelFrame = vi.fn(id => frames.delete(id)); vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  const controller = new AbortController(), mutate = vi.fn();
  const playback = createStagedPlayback({
    session: { generation: 1, stagedResolutionDepth: 0, stagedDeathFx: new Set() },
    getBattleToken: () => token, getFloats: () => [], foeIdx: () => 0, render() {}, finish() {},
  });
  function* steps() { yield { kind: 'windup', targets: [{}] }; mutate(); }
  const result = playback(steps(), controller.signal).catch(error => error);
  token = 'new'; controller.abort(new Error('switched'));
  expect((await result).message).toBe('switched');
  expect(cancelFrame).toHaveBeenCalledOnce(); expect(frames.size).toBe(0);
  expect(mutate).not.toHaveBeenCalled();
});
