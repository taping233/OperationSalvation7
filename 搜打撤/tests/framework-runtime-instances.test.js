// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createBattleRuntime } from '../game/src/battle/runtime/battle.runtime.factory.js';
import { defaultBattleRuntime } from '../game/src/battle/runtime/battle.runtime.default.js';
import * as compatibility from '../game/src/battle/runtime/battle.runtime.js';

describe('battle runtime ownership and legacy live bindings', () => {
  it('owns independent mutable collections and keeps aggregate writes visible inside callbacks', () => {
    const a = createBattleRuntime(), b = createBattleRuntime();
    a.set$G({ hp: 12 });
    a.hand.push('only-a'); a.zeroFeeUntil.set('only-a', 0); a.set$energy(7);
    expect(b.hand).toEqual([]); expect(b.zeroFeeUntil.size).toBe(0); expect(b.energy).toBe(0);
    const observations = [];
    a.subscribe((state, key) => { if (key === 'energy') observations.push(state.energy); });
    a.resetBattlePlayerState(4);
    expect(observations).toEqual([4]);
    expect(b.energy).toBe(0);
  });

  it('derives default ESM bindings synchronously from the same state during aggregate restore', () => {
    const game = { hp: 12 };
    defaultBattleRuntime.restoreBattleSession(game, { opts: {}, turn: 3, energy: 2 }, 4);
    expect(compatibility.G).toBe(game);
    expect(compatibility.energy).toBe(2);
    const observed = [];
    defaultBattleRuntime.subscribe((state, key) => {
      if (key === 'energy') observed.push([compatibility.energy, state.energy]);
    });
    compatibility.resetBattlePlayerState(6);
    expect(observed).toEqual([[6, 6]]);
    expect(compatibility.pstat).toBe(defaultBattleRuntime.pstat);
    compatibility.set$G(null);
  });
});
