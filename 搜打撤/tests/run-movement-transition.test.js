import { beforeEach, describe, expect, it } from 'vitest';
import { RunStorage } from '../game/src/hub/game.storage.js';
import { beginRunMove, cancelRunMove, commitRunMove, interpolateRunPosition } from '../game/src/run/game.run.movement.js';

describe('Run movement transitions', () => {
  beforeEach(() => localStorage.clear());

  it('keeps animation transient, then commits one stable landing and round-trips it through run storage', () => {
    const initial = { state: 'idle', pos: { x: 0.1, y: 0.2 }, layerIdx: 1, trackPos: 3, turn: 8, hop: 2, moveTarget: null };
    const started = beginRunMove({ from: initial.pos, to: { li: 2, idx: 4 }, seq: 10 });
    expect(initial).toMatchObject({ state: 'idle', layerIdx: 1, trackPos: 3, turn: 8 });
    expect(started).toMatchObject({ state: 'moving', moveTarget: { li: 2, idx: 4, seq: 10 } });
    expect(interpolateRunPosition(initial.pos, { x: 0.9, y: 0.8 }, 1)).toEqual({ x: 0.9, y: 0.8 });

    const landed = {
      ...initial,
      ...commitRunMove(initial, {
        to: { li: 2, idx: 4, pos: { x: 0.9, y: 0.8 } },
        layerBounds: { min: 0, max: 4 },
        geometryVersion: 'seed-1:2',
      }),
    };
    expect(landed).toMatchObject({ state: 'idle', pos: { x: 0.9, y: 0.8 }, layerIdx: 2, trackPos: 4, turn: 9, hop: 0, moveTarget: null });
    RunStorage.readForLoad(1);
    expect(RunStorage.write(1, landed)).toBe(true);
    expect(RunStorage.read(1)).toMatchObject({ pos: { x: 0.9, y: 0.8 }, layerIdx: 2, trackPos: 4, turn: 9, hop: 0, moveTarget: null });
  });

  it('cancels to the previous stable landing without advancing the run', () => {
    const initial = { state: 'idle', pos: { x: 0.1, y: 0.2 }, layerIdx: 1, trackPos: 3, turn: 8 };
    const started = beginRunMove({ from: initial.pos, to: { li: 2, idx: 4 }, seq: 11 });
    const moving = { ...initial, ...started, pos: { x: 0.5, y: 0.6 } };
    const cancelled = { ...moving, ...cancelRunMove(initial) };
    expect(cancelled).toMatchObject({ state: 'idle', pos: initial.pos, layerIdx: 1, trackPos: 3, turn: 8, moveTarget: null });
  });
});
