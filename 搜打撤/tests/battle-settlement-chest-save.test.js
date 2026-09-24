import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/core/random.js', () => ({ Random: { random: () => 0.99 } }));

const baseSave = vi.fn(() => true);
window.SDT = {
  MAP: { chestKinds: { small: { name: '小宝箱', cards: 0 } } },
  Base: { data: { eggPity: 0, eggBattles: 0 }, save: baseSave },
  UI: { showOverlay() {}, refresh() {}, hideOverlay() {}, log() {} },
  Sound: { sfx() {} },
  Cards: { all: () => [], randomDropCard: () => null, RARITIES: ['古朴', '稀有', '史诗', '传说'] },
};
await import('../game/src/run/chests.js');
const Chests = window.SDT.Chests;

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('战后宝箱保底与 paired settlement', () => {
  it('战斗开箱 defer 模式只改内存；普通宝箱仍保存保底', () => {
    vi.useFakeTimers();
    const game = { state: 'idle' };
    Chests.open(game, [{ kind: 'small' }], () => {}, { deferBaseSave: true });
    expect(window.SDT.Base.data.eggPity).toBe(1);
    expect(baseSave).not.toHaveBeenCalled();

    Chests.open(game, [], null); // close deferred sequence without an extra chest
    window.SDT.Base.data.eggPity = 0;
    Chests.open(game, [{ kind: 'small' }], () => {}, {});
    expect(window.SDT.Base.data.eggPity).toBe(1);
    expect(baseSave).toHaveBeenCalledTimes(1);
  });
});
