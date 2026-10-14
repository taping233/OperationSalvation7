/* G-2（2026-09-29 夜班）：sellCard 引擎侧复检 owned.stored——珍珠盒存放卡的销售拦截
 * 原先只在收购台渲染过滤（sellableOwned 滤 !stored），直调 UI.act('sellCard', {uid}) 可绕过。
 * 修复：game.run.shop.js sellCard 在 isSellable 之后补 stored 早退。 */
import { afterEach, describe, expect, it } from 'vitest';

window.SDT = window.SDT || {};
window.SDT.Icons = window.SDT.Icons || { img: () => '' };
window.SDT.Sound = window.SDT.Sound || { music() {}, sfx() {} };
window.SDT.Base = window.SDT.Base || { carriedPet: () => null };
window.SDT.MAP = window.SDT.MAP || {
  rules: {},
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
// 卡库播种（同 tests/m3-contract.test.js 先例）：all() 走存储层，测试环境需先播种才有货架数据
Cards.ensureSha();
Cards.ensureStarters();
Cards.ensureTabletop();
Cards.ensureDmgTypes();
Cards.ensureEffectFields();
const { createShopController } = await import('../game/src/run/game.run.shop.js');

function makeShop() {
  const logs = [];
  const acts = {};
  const game = {
    state: 'idle', coins: 100,
    ownedCards: [
      // 存放中的可售卡（珍珠盒 o.stored 标记，同卡也出现在收购买卖判定范围内）
      { uid: 'sell-stored', card: { id: 't-stored-copper', name: '存放的铜币', type: '资源', desc: '可出售。', value: 3, sellable: true }, stored: true },
      // 随身的可售卡（回归锚）
      { uid: 'sell-free', card: { id: 't-free-copper', name: '随身的铜币', type: '资源', desc: '可出售。', value: 3, sellable: true } },
    ],
  };
  const UI = {
    act(name, fn) { acts[name] = fn; },
    log(message) { logs.push(String(message)); },
    refresh() {}, showOverlay(_title, html) { document.body.innerHTML = html; }, hideOverlay() {},
    registerHelp() {}, helpBtn: () => '',
  };
  const shop = createShopController({
    UI, SDT: window.SDT, game,
    bagCap: () => 20, cardHTML: () => '', newUid: () => 'u0',
    saveGame() {}, setCardPageOpen() {}, usedSlots: () => 0,
  });
  shop.openShop('');   // 空 key 直调路径：渲染主商店并注册 UI.act（sellCard 在此登记）
  acts.openSell();
  expect(typeof acts.sellCard).toBe('function');
  return { game, acts, logs };
}

afterEach(() => { document.body.replaceChildren(); });

describe('sellCard 引擎侧 stored 拦截（G-2）', () => {
  it('珍珠盒存放卡直调卖不出：卡还在、金币不变', () => {
    const { game, acts } = makeShop();
    // 前置：该卡本身满足 isSellable，拦截只可能来自 stored
    expect(Cards.isSellable(game.ownedCards[0].card)).toBe(true);
    expect(game.ownedCards[0].stored).toBe(true);
    acts.sellCard({ uid: 'sell-stored' });
    expect(game.ownedCards.some(o => o.uid === 'sell-stored')).toBe(true);
    expect(game.coins).toBe(100);
  });

  it('回归锚：非存放可卖卡照常出售（卡移除、金币按面值增加）', () => {
    const { game, acts } = makeShop();
    acts.sellCard({ uid: 'sell-free' });
    expect(game.ownedCards.some(o => o.uid === 'sell-free')).toBe(false);
    expect(game.coins).toBe(100 + Cards.sellPrice(game.ownedCards[0].card));
  });
});
