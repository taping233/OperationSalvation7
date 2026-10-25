import { describe, expect, it, vi } from 'vitest';
import { createLegacyBagUse } from '../game/src/hub/bag-legacy-use.js';
import { deriveBagRenderState } from '../game/src/core/bag-render-derivation.js';

const token = { id: 'tt-token-color', name: '员工通行证A', type: '道具' };
const ability = { id: 'ability', name: '觉醒能力', type: '能力卡' };
function scenario(ownedCards, cap = 1, pool = [ability]) {
  const game = { ownedCards, inventory: [], usedPocket: [], hp: 1, maxHp: 10 };
  const UI = { log: vi.fn(), showLegendGet: vi.fn() };
  const saveGame = vi.fn(() => true), newUid = vi.fn(() => 'reward');
  const controller = createLegacyBagUse({ UI, game, readCards: () => ({ classPool: () => pool }),
    baseCap: () => cap, items: {}, Random: { random: () => 0 }, newUid, saveGame,
    showBackpack: vi.fn(), usedSlots: () => deriveBagRenderState(game, cap).used,
    bagCap: () => deriveBagRenderState(game, cap).cap, captureContext: () => () => true, setBagReceipt: vi.fn() });
  return { ...controller, game, UI, saveGame, newUid, used: () => deriveBagRenderState(game, cap).used };
}

describe('旧通行证A使用后的真实容量', () => {
  it.each([2, 3])('满格同叠有%i张A时不能额外创建能力卡，A和存档均不变', count => {
    const source = Array.from({ length: count }, (_, i) => ({ uid: `source-${i}`, card: token }));
    const h = scenario(source), before = structuredClone(source);
    h.useOwnedCard('source-0');
    expect(h.game.ownedCards).toEqual(before);
    expect(h.used()).toBe(1); expect(h.newUid).not.toHaveBeenCalled(); expect(h.saveGame).not.toHaveBeenCalled();
    expect(h.UI.log).toHaveBeenCalledWith(expect.stringContaining('空间不足'), 'warn');
  });
  it('仅剩一张A释放原格后可获得能力卡，保存一次', () => {
    const h = scenario([{ uid: 'source', card: token }]);
    h.useOwnedCard('source');
    expect(h.game.ownedCards).toEqual([{ uid: 'reward', card: ability }]);
    expect(h.used()).toBe(1); expect(h.saveGame).toHaveBeenCalledOnce();
  });
  it('已有未满同名能力叠时可合入，不新增格', () => {
    const h = scenario([{ uid: 'source', card: token }, { uid: 'other-source', card: token }, { uid: 'owned-ability', card: ability }], 2);
    h.useOwnedCard('source');
    expect(h.game.ownedCards.map(entry => entry.card.id)).toEqual([token.id, ability.id, ability.id]);
    expect(h.used()).toBe(2); expect(h.saveGame).toHaveBeenCalledOnce();
  });
  it('珍珠盒扩展格不能容纳觉醒能力卡', () => {
    const h = scenario([{ uid: 'source', card: token }, { uid: 'other-source', card: token },
      { uid: 'box', card: { id: 'tt2-pearlbox', name: '珍珠盒', type: '道具' } }], 2);
    const before = structuredClone(h.game.ownedCards);
    h.useOwnedCard('source');
    expect(h.game.ownedCards).toEqual(before); expect(h.saveGame).not.toHaveBeenCalled();
  });
});

describe('旧道具使用只消费可见普通背包来源', () => {
  it.each([{ safe: true }, { stored: 1 }, { stored: 1, pouchOf: 'tt7-stratagem' }])('重复UID不误用隐藏来源 %j', flags => {
    const hidden = { uid: 'same', card: { id: 'protected', name: '不应消费', type: '道具', desc: '回复 9 点生命' }, ...flags };
    const visible = { uid: 'same', card: token };
    const h = scenario([hidden, visible], 3);
    h.game.heal = vi.fn();
    h.useOwnedCard('same');
    expect(h.game.ownedCards).toEqual([hidden, { uid: 'reward', card: ability }]);
    expect(h.game.heal).not.toHaveBeenCalled(); expect(h.saveGame).toHaveBeenCalledOnce();
  });
  it('UID只剩安全格条目时不消费、不发奖、不保存', () => {
    const source = { uid: 'source', card: token, safe: true }, h = scenario([source]);
    h.useOwnedCard('source');
    expect(h.game.ownedCards).toEqual([source]); expect(h.saveGame).not.toHaveBeenCalled(); expect(h.newUid).not.toHaveBeenCalled();
  });
  it.each([undefined, 'duplicate'])('普通背包内UID=%s仍歧义时拒绝，不猜测卡牌', uid => {
    const first = { uid, card: token }, second = { uid, card: { id: 'other', name: '另一道具', type: '道具', desc: '回复 9 点生命' } };
    const h = scenario([first, second], 3); h.game.heal = vi.fn();
    expect(h.useOwnedCard(uid)).toBe(false);
    expect(h.game.ownedCards).toEqual([first, second]); expect(h.saveGame).not.toHaveBeenCalled(); expect(h.game.heal).not.toHaveBeenCalled();
  });
});
