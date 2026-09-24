import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/core/random.js', () => ({ Random: { random: () => 0.99 } }));

const baseSave = vi.fn(() => true);
const actions = new Map();
window.SDT = {
  MAP: { chestKinds: { small: { name: '小宝箱', cards: 0 } } },
  Base: { data: { eggPity: 0, eggBattles: 0 }, save: baseSave, bagCap: () => 5 },
  UI: {
    showOverlay() {}, refresh() {}, hideOverlay() {}, log() {},
    act(name, callback) { actions.set(name, callback); },
  },
  Sound: { sfx() {} },
  Cards: { all: () => [], randomDropCard: () => null, RARITIES: ['古朴', '稀有', '史诗', '传说'] },
};
await import('../game/src/run/chests.js');
const Chests = window.SDT.Chests;

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); actions.clear(); baseSave.mockClear(); });

describe('prepared battle chest persistence', () => {
  it('pre-rolls a JSON queue without saving Base, then persists progress before completion', async () => {
    vi.useFakeTimers();
    const game = {
      state: 'idle', ownedCards: [], usedSlots: () => 0, bagCap: () => 5,
      grantCard: () => true, gainCoins: () => {},
    };
    const pending = Chests.prepareBattle([{ kind: 'small' }], { game, battleSummary: { defeated: 1, hp: 8, maxHp: 10 } });
    expect(pending.queue).toHaveLength(1);
    expect(() => JSON.stringify(pending)).not.toThrow();
    expect(window.SDT.Base.data.eggPity).toBe(1);
    expect(baseSave).not.toHaveBeenCalled();

    game.pendingBattleLoot = { chests: pending };
    const persist = vi.fn(() => true);
    const done = vi.fn();
    expect(Chests.openPrepared(game, pending, done, { isCurrent: () => true, persist })).toBe(true);
    vi.advanceTimersByTime(780);
    actions.get('chestTake')();
    await Promise.resolve();
    await Promise.resolve();
    expect(persist).toHaveBeenCalledWith(pending);
    expect(pending.index).toBe(1);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
