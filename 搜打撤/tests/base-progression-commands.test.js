import { describe, expect, it } from 'vitest';
import { commitBaseMutation } from '../game/src/hub/base-mutation.js';
import { createBaseProgressionCommands } from '../game/src/hub/base-progression.commands.js';

function setup(initial = {}) {
  let state = { keys: 0, nestUnlocked: false, selMode: 'standard', ...initial };
  let writes = 0;
  let saveSucceeds = true;
  const commands = createBaseProgressionCommands({
    read: () => state,
    mutate: (prepare, failure = false) => {
      const result = commitBaseMutation(state, prepare, candidate => {
        writes += 1;
        if (!saveSucceeds) return false;
        state = candidate;
        return true;
      });
      return result.ok ? result.value : failure;
    },
    keyNeeded: 10,
  });
  return {
    commands,
    read: () => state,
    writes: () => writes,
    failSaves: () => { saveSucceeds = false; },
  };
}

describe('base progression commands', () => {
  it('validates and persists only supported modes', () => {
    const base = setup();
    expect(base.commands.selectMode('elite')).toEqual({ ok: true, mode: 'elite' });
    expect(base.read().selMode).toBe('elite');
    expect(base.commands.selectMode('casual')).toEqual({ ok: false, code: 'INVALID_MODE' });
    expect(base.read().selMode).toBe('elite');
    expect(base.writes()).toBe(1);
  });

  it('does not write when the selected mode is unchanged', () => {
    const base = setup();
    expect(base.commands.selectMode('standard')).toEqual({ ok: true, mode: 'standard' });
    expect(base.writes()).toBe(0);
  });

  it('reports insufficient keys without changing the saved state', () => {
    const base = setup({ keys: 9 });
    expect(base.commands.unlockNestGate()).toEqual({
      ok: false, code: 'INSUFFICIENT_KEYS', need: 10, available: 9,
    });
    expect(base.read()).toMatchObject({ keys: 9, nestUnlocked: false });
    expect(base.writes()).toBe(0);
  });

  it.each(['10', 10.5, -1])('fails closed when a readable save contains invalid key count %s', keys => {
    const base = setup({ keys });
    expect(base.commands.unlockNestGate()).toEqual({ ok: false, code: 'INVALID_STATE' });
    expect(base.read().keys).toBe(keys);
    expect(base.writes()).toBe(0);
  });

  it('spends exactly the required keys and makes later unlocks idempotent', () => {
    const base = setup({ keys: 12 });
    expect(base.commands.unlockNestGate()).toEqual({ ok: true, alreadyUnlocked: false, spent: 10 });
    expect(base.read()).toMatchObject({ keys: 2, nestUnlocked: true });
    expect(base.commands.unlockNestGate()).toEqual({ ok: true, alreadyUnlocked: true });
    expect(base.writes()).toBe(1);
  });

  it('does not publish mode or gate changes when persistence fails', () => {
    const modeBase = setup();
    modeBase.failSaves();
    expect(modeBase.commands.selectMode('elite')).toEqual({ ok: false, code: 'SAVE_FAILED' });
    expect(modeBase.read().selMode).toBe('standard');

    const gateBase = setup({ keys: 10 });
    gateBase.failSaves();
    expect(gateBase.commands.unlockNestGate()).toEqual({ ok: false, code: 'SAVE_FAILED' });
    expect(gateBase.read()).toMatchObject({ keys: 10, nestUnlocked: false });
  });

  it('retains the legacy no-cost unlock behavior', () => {
    const base = setup({ keys: 3 });
    expect(base.commands.unlockNestLegacy()).toEqual({ ok: true, alreadyUnlocked: false });
    expect(base.read()).toMatchObject({ keys: 3, nestUnlocked: true });
  });
});
