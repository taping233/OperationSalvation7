import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

let game, battle, gate, entered, UI, loadCount;
beforeEach(() => {
  vi.resetModules();
  gate = deferred(); entered = deferred(); loadCount = 0;
  game = { runActive: true, nestActive: false, state: 'modal', seed: 'same-seed',
    discoveredPairs: new Set(), nestRunes: [], layerIdx: 0, trackPos: 2, nestPos: 0 };
  battle = { start: vi.fn(() => true), restore: vi.fn() };
  UI = { log: vi.fn(), refresh: vi.fn() };
  window.SDT = { game, UI };
  vi.doMock('../game/src/battle/view/battle.view.js', async () => {
    loadCount++;
    entered.resolve();
    await gate.promise;
    window.SDT.Battle = battle;
    return {};
  });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('E4 battle lazy-load request ownership', () => {
  it('shares a prefetched module with the current request', async () => {
    const { ensureBattleReady, startBattle } = await import('../game/src/battle/battle-loader.js');
    const prefetch = ensureBattleReady();
    const request = startBattle(game, ['foe'], { name: 'current' });
    await entered.promise;
    gate.resolve();
    expect(await prefetch).toBe(battle);
    expect(await request).toBe(true);
    expect(loadCount).toBe(1);
    expect(battle.start).toHaveBeenCalledExactlyOnceWith(game, ['foe'], { name: 'current' });
  });

  it.each([
    ['exit', () => { game.state = 'title'; game.runActive = false; }],
    ['same-slot same-seed new run', () => { game.discoveredPairs = new Set(); }],
    ['nest restart', () => { game.nestRunes = []; }],
    ['node changed', () => { game.trackPos++; }],
    ['layer changed', () => { game.layerIdx++; }],
    ['nest node changed', () => { game.nestPos++; }],
    ['game instance replaced', () => { window.SDT.game = { ...game }; }],
  ])('does not start after %s', async (_label, change) => {
    const { startBattle } = await import('../game/src/battle/battle-loader.js');
    const request = startBattle(game, ['old'], {});
    await entered.promise;
    change();
    const state = game.state;
    gate.resolve();
    expect(await request).toBe(false);
    expect(battle.start).not.toHaveBeenCalled();
    expect(game.state).toBe(state);
    expect(UI.log).not.toHaveBeenCalled();
    expect(UI.refresh).not.toHaveBeenCalled();
  });

  it('only starts the latest request without cancelling its shared import', async () => {
    const { startBattle } = await import('../game/src/battle/battle-loader.js');
    const old = startBattle(game, ['old'], {});
    await entered.promise;
    const current = startBattle(game, ['current'], {});
    gate.resolve();
    expect(await old).toBe(false);
    expect(await current).toBe(true);
    expect(loadCount).toBe(1);
    expect(battle.start).toHaveBeenCalledExactlyOnceWith(game, ['current'], {});
  });

  it('does not start a request already belonging to a replaced game', async () => {
    const { startBattle } = await import('../game/src/battle/battle-loader.js');
    window.SDT.game = { ...game };
    const request = startBattle(game, ['old'], {});
    await entered.promise; gate.resolve();
    expect(await request).toBe(false);
    expect(battle.start).not.toHaveBeenCalled();
  });

  it('invalidation survives a title exit followed by the same in-memory flags', async () => {
    const { startBattle, invalidateBattleContext } = await import('../game/src/battle/battle-loader.js');
    const request = startBattle(game, ['old'], {});
    await entered.promise;
    invalidateBattleContext(game);
    gate.resolve();
    expect(await request).toBe(false);
    expect(battle.start).not.toHaveBeenCalled();
    expect(game.state).toBe('modal');
  });

  it('does not log or clear new-page state when an old import rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { startBattle } = await import('../game/src/battle/battle-loader.js');
    const request = startBattle(game, ['old'], {});
    await entered.promise;
    game.discoveredPairs = new Set(); game.state = 'modal';
    gate.reject(new Error('offline'));
    expect(await request).toBe(false);
    expect(game.state).toBe('modal');
    expect(UI.log).not.toHaveBeenCalled();
    expect(UI.refresh).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('reports a current failure and permits the next interaction to retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { startBattle } = await import('../game/src/battle/battle-loader.js');
    const request = startBattle(game, ['old'], {});
    await entered.promise;
    gate.reject(new Error('offline'));
    expect(await request).toBe(false);
    expect(game.state).toBe('idle');
    expect(UI.log).toHaveBeenCalledOnce();
    // Replace only the failed module transport; retain the real loader's promise state.
    vi.doMock('../game/src/battle/view/battle.view.js', () => { window.SDT.Battle = battle; return {}; });
    expect(await startBattle(game, ['retry'], {})).toBe(true);
    expect(battle.start).toHaveBeenCalledExactlyOnceWith(game, ['retry'], {});
  });
});
