// @ts-check

/** @typedef {{ keys: number, nestUnlocked: boolean, selMode: string }} BaseProgressionState */

/**
 * 持久化基地模式偏好与研究所门禁命令。
 * @template {BaseProgressionState} TState
 * @param {{read: () => TState, mutate: (prepare: (draft: TState) => boolean, failure?: boolean) => boolean, keyNeeded: number}} ports
 */
export function createBaseProgressionCommands({ read, mutate, keyNeeded }) {
  /**
   * @param {'standard' | 'elite'} mode
   * @returns {{ok: true, mode: 'standard' | 'elite'} | {ok: false, code: 'INVALID_MODE' | 'SAVE_FAILED'}}
   */
  function selectMode(mode) {
    if (mode !== 'standard' && mode !== 'elite') return { ok: false, code: 'INVALID_MODE' };
    if (read().selMode === mode) return { ok: true, mode };
    if (!mutate(draft => { draft.selMode = mode; return true; }, false)) {
      return { ok: false, code: 'SAVE_FAILED' };
    }
    return { ok: true, mode };
  }

  /** @returns {{ok: true, alreadyUnlocked: true} | {ok: true, alreadyUnlocked: false, spent: number} | {ok: false, code: 'INSUFFICIENT_KEYS', need: number, available: number} | {ok: false, code: 'INVALID_STATE'} | {ok: false, code: 'SAVE_FAILED'}} */
  function unlockNestGate() {
    const state = read();
    if (state.nestUnlocked) return { ok: true, alreadyUnlocked: true };
    const available = state.keys;
    if (!Number.isInteger(available) || available < 0 || !Number.isInteger(keyNeeded) || keyNeeded < 1) {
      return { ok: false, code: 'INVALID_STATE' };
    }
    if (available < keyNeeded) {
      return { ok: false, code: 'INSUFFICIENT_KEYS', need: keyNeeded, available };
    }
    if (!mutate(draft => {
      draft.keys -= keyNeeded;
      draft.nestUnlocked = true;
      return true;
    }, false)) {
      return { ok: false, code: 'SAVE_FAILED' };
    }
    return { ok: true, alreadyUnlocked: false, spent: keyNeeded };
  }

  /** Legacy no-cost unlock contract retained for old game.nest.js callers. */
  function unlockNestLegacy() {
    if (read().nestUnlocked) return { ok: true, alreadyUnlocked: true };
    if (!mutate(draft => { draft.nestUnlocked = true; return true; }, false)) {
      return { ok: false, code: 'SAVE_FAILED' };
    }
    return { ok: true, alreadyUnlocked: false };
  }

  return { selectMode, unlockNestGate, unlockNestLegacy };
}
