import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ game: null, saveGame: null, transition: null, actions: null, chestDone: null }));

vi.mock('../game/src/game.session.js', () => ({
  game: state.game, saveGame: (...args) => state.saveGame(...args), getActiveSlot: () => 1,
  doDeath: vi.fn(), cardStacks: vi.fn(), newUid: vi.fn(), safeUsed: vi.fn(), usedSlots: vi.fn(),
}));
vi.mock('../game/src/game.storage.js', () => ({ RunStorage: { readIdentity: () => ({ ok: true, value: { runId: state.runId } }) } }));
vi.mock('../game/src/game.run.js', () => ({ showRunTransition: (...args) => state.transition(...args) }));
vi.mock('../game/src/game.bag.bridge.js', () => ({ bagSlots: { closeBackpack: vi.fn(), pocketAdd: vi.fn() } }));
vi.mock('../game/src/event-bus.js', () => ({ on: vi.fn() }));
vi.mock('../game/src/random.js', () => ({ Random: { random: () => 0.5 } }));
vi.mock('../game/src/shared.js', () => ({ esc: String }));

beforeEach(() => {
  vi.resetModules();
  state.actions = {};
  state.chestDone = null;
  state.runId = 'test-run';
  state.game ||= {};
  Object.keys(state.game).forEach(key => { delete state.game[key]; });
  Object.assign(state.game, {
    state: 'idle', ownedCards: [], usedPocket: [], visited: {}, layerIdx: 0, trackPos: 1,
    grantCard: vi.fn(), addItem: vi.fn(), myClass: 'wu',
  });
  state.saveGame = vi.fn(() => true);
  state.transition = vi.fn(async () => {});
  window.SDT = {
    UI: {
      hideOverlay: vi.fn(), showOverlay: vi.fn(), refresh: vi.fn(), log: vi.fn(),
      act: (name, fn) => { state.actions[name] = fn; },
    },
    Base: { data: { eggBattles: 0, ammoTaught: true }, save: vi.fn(() => true), isSha: () => false },
    Cards: { all: () => [{ id: 'legend', rarity: '传说' }], isRandomObtainable: () => true },
    Meta: { track: vi.fn() },
    Chests: {
      rollDrops: vi.fn(() => [{ kind: 'small' }]), dropText: () => '小宝箱',
      open: vi.fn((_game, _drops, done) => { state.chestDone = done; }),
    },
  };
});

async function bind() {
  const { bindBagMixins } = await import('../game/src/game.bag.settle.js');
  bindBagMixins();
  return state.game.onBattleEnd;
}

describe('真实战后结算入口的重复通知和保存重试', () => {
  it('过场失败后重试，不再次消耗已转入口袋的牌', async () => {
    const onBattleEnd = await bind();
    const card = { id: 'played', name: '已打出的牌', rarity: '古朴' };
    state.game.ownedCards.push({ uid: 'played-1', card });
    state.transition.mockRejectedValueOnce(new Error('transition failed'));
    const opts = { isBoss: false, foeNames: ['敌人'] };

    expect(await onBattleEnd(opts, ['played-1'], true, [])).toBe(false);
    expect(state.game.ownedCards).toHaveLength(0);
    const { bagSlots } = await import('../game/src/game.bag.bridge.js');
    expect(bagSlots.pocketAdd).toHaveBeenCalledTimes(1);
    await state.actions.battleSettleRetry();
    expect(bagSlots.pocketAdd).toHaveBeenCalledTimes(1);
    expect(window.SDT.Chests.open).toHaveBeenCalledTimes(1);
    state.chestDone();
    expect(state.saveGame).toHaveBeenCalledTimes(1);
  });

  it('重复结束通知及保存失败重试，只发一次额外奖励与统计', async () => {
    const onBattleEnd = await bind();
    let releaseTransition;
    state.transition.mockImplementationOnce(() => new Promise(resolve => { releaseTransition = resolve; }));
    state.saveGame.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const opts = { isBoss: true, foeNames: ['首脑'] };

    const first = onBattleEnd(opts, [], true, []);
    const duplicate = onBattleEnd(opts, [], true, []);
    expect(state.transition).toHaveBeenCalledTimes(1);
    releaseTransition();
    await Promise.all([first, duplicate]);
    expect(window.SDT.Chests.open).toHaveBeenCalledTimes(1);

    state.chestDone();
    expect(state.game.grantCard).toHaveBeenCalledTimes(1);
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    expect(state.saveGame).toHaveBeenCalledTimes(1);
    expect(window.SDT.Base.save).not.toHaveBeenCalled();
    await state.actions.battleSettleRetry();
    expect(state.saveGame).toHaveBeenCalledTimes(2);
    expect(state.game.grantCard).toHaveBeenCalledTimes(1);
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    expect(window.SDT.Chests.rollDrops).toHaveBeenCalledTimes(1);
    await onBattleEnd(opts, [], true, []);
    expect(state.saveGame).toHaveBeenCalledTimes(2);
  });

  it('基地保存失败后重试，不重复增加保底计数或重开宝箱', async () => {
    const onBattleEnd = await bind();
    window.SDT.Base.save.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const opts = { isBoss: false, foeNames: ['敌人'] };

    await onBattleEnd(opts, [], true, []);
    state.chestDone();
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    expect(state.saveGame).toHaveBeenCalledTimes(1);
    await state.actions.battleSettleRetry();
    expect(window.SDT.Base.save).toHaveBeenCalledTimes(2);
    expect(state.saveGame).toHaveBeenCalledTimes(1);
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    expect(window.SDT.Chests.open).toHaveBeenCalledTimes(1);
  });

  it('过场中同槽开启新局时，旧回调不能把奖励写进新局', async () => {
    const onBattleEnd = await bind();
    let releaseTransition;
    state.transition.mockImplementationOnce(() => new Promise(resolve => { releaseTransition = resolve; }));
    const pending = onBattleEnd({ isBoss: true, foeNames: ['首脑'] }, [], true, []);
    state.runId = 'next-run';
    releaseTransition();
    expect(await pending).toBe(false);
    expect(state.game.grantCard).not.toHaveBeenCalled();
    expect(state.saveGame).not.toHaveBeenCalled();
    expect(window.SDT.Base.save).not.toHaveBeenCalled();
    expect(window.SDT.Chests.open).not.toHaveBeenCalled();
  });
});
