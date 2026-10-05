/* SYS-03 物资事务审计（2026-10-03 老板 SYS-03）：搜刮页与商店买卖的事务顺序钉现状。
 * 审计结论：五拍（校验→确认→提交→回执→画面）齐全、无「已领/未领搞混」缺陷——
 * 本文件只钉现状，不改任何源码：
 *   搜刮页 chestTake1/chestPick 消费 grantCard 返回值（满包拒绝留在面板、卡保持可点）；
 *   chestSkip 币照收（无主物）、卡散落；takeAll 返回值不消费=满包强收散落（口径如此，
 *   面板 warnLine 预检已明示放不下张数）；商店缺币/满包拒绝不扣币、售出即时成交。
 * 模式沿用 tests/chest-click-flow.test.js（手搭 window.SDT 后动态 import chests.js）
 * 与 tests/shop-sell-stored-guard.test.js（createShopController 依赖注入）。 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const CARD_A = { id: 'sys03-a', name: '搜刮卡甲', rarity: '古朴', type: '法术', desc: '测试甲', cost: 0 };
const CARD_B = { id: 'sys03-b', name: '搜刮卡乙', rarity: '古朴', type: '武术', desc: '测试乙', cost: 0 };

function bootDom() {
  const ovBody = document.createElement('div');
  ovBody.id = 'ovBody';
  ovBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (button) acts[button.dataset.act]?.(button.dataset);
  });
  const cardShell = document.createElement('div');
  cardShell.className = 'card';
  cardShell.innerHTML = '<h2 id="ovTitle"></h2>';
  cardShell.append(ovBody);
  const overlay = document.createElement('div');
  overlay.id = 'overlay';
  overlay.append(cardShell);
  document.body.append(overlay);
  return { overlay, ovBody };
}

function bootSdt({ overlay, ovBody, ownedCards, grantCard, canReceiveCard }) {
  const logs = [];
  const UI = {
    el: { overlay, ovBody, ovTitle: cardTitle(), ovCloseX: null },
    showOverlay(title, html) {
      this.el.ovTitle.innerHTML = title;
      ovBody.innerHTML = html;
      overlay.hidden = false;
    },
    hideOverlay() { overlay.hidden = true; },
    act: (name, fn) => { acts[name] = fn; },
    refresh: vi.fn(),
    log: (msg) => logs.push(String(msg)),
  };
  function cardTitle() { return overlay.querySelector('#ovTitle'); }
  window.SDT = {
    UI,
    MAP: { chestKinds: { small: { name: '小宝箱', cards: 2, coins: [7, 7] }, medium: { name: '中宝箱', pickFrom: 3, coins: [7, 7] } } },
    Cards: {
      RARITIES: ['古朴', '稀有', '史诗', '传说'],
      all: () => [CARD_A, CARD_B],
      randomDropCard: () => CARD_A,
      pickOfRarity: () => CARD_A,
      classPool: () => [],
      rarityOf: (item) => item.rarity,
      sellPrice: () => 1,
      cardHTML: () => '<div class="hs-card">测试卡</div>',
    },
    Base: {
      data: { eggPity: 0, eggBattles: 0 }, save: vi.fn(),
      petEggDropChance: () => 0,
      recordPetEggChestResult: vi.fn(),
      bagCap: () => 10, isSha: () => false,
    },
    Sound: { sfx: vi.fn() },
    Icons: { rich: (html) => html },
  };
  const game = {
    state: 'idle', myClass: '', ownedCards,
    usedSlots: () => ownedCards.length,
    bagCap: () => 10,
    canReceiveCard: canReceiveCard || (() => true),
    grantCard: grantCard || ((card) => { ownedCards.push({ card }); return true; }),
    gainCoins: vi.fn(),
  };
  return { game, logs };
}

let acts = {};
let shopMod = null;
afterEach(() => {
  vi.useRealTimers();
  delete window.SDT;
  document.body.innerHTML = '';
  acts = {};
  shopMod = null;
});

async function revealFirst(game, kind = 'small') {
  vi.resetModules();   // chests.js 顶层捕获 window.SDT：每个用例重载模块以绑定本用例的 SDT/DOM
  const { SDT: chestFacade } = await import('../game/src/run/chests.js');
  chestFacade.Chests.open(game, [{ kind }]);
  const reveal = document.querySelector('[data-eps-search]');
  expect(reveal).not.toBeNull();
  reveal.click();   // 搜索演出点击立即揭晓 → render() 注册 chestTake1/chestSkip/chestTake
  return chestFacade;
}

describe('SYS-03 搜刮页事务序（chests.js）', () => {
  it('chestTake1 满包拒绝：grantCard false 不入包不标记，卡保持可点（可再点）', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const ownedCards = [];
    const grantCalls = [];
    const { game } = bootSdt({
      overlay, ovBody, ownedCards,
      grantCard(card) {
        grantCalls.push(card.name);
        return false;   // 背包满：grantCard 内部 warn、返回 false
      },
    });
    await revealFirst(game);
    const take1 = () => ovBody.querySelector('[data-act="chestTake1"]');
    expect(take1()).not.toBeNull();
    take1().click();
    take1().click();   // 卡保持可点：失败后可重试（腾格后再收）
    expect(ownedCards).toHaveLength(0);
    expect(grantCalls).toEqual([CARD_A.name, CARD_A.name]);
    expect(game.state).toBe('modal');   // 未被静默 next()
    expect(overlay.hidden).toBe(false); // 面板还在
  });

  it('chestTake1 成功后标记已收，takeAll 不重复发放已拾取卡', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const ownedCards = [];
    const grantCalls = [];
    const { game } = bootSdt({
      overlay, ovBody, ownedCards,
      grantCard(card) { grantCalls.push(card.name); ownedCards.push({ card }); return true; },
    });
    // rollContents 的卡池随机：两张卡名不同才测得了重复保护；面板同面去重保证 A/B 不同名
    // 这里直接把 randomDropCard 换成按调用序发 A、B
    window.SDT.Cards.randomDropCard = (() => { let n = 0; return () => (n++ === 0 ? CARD_A : CARD_B); })();
    await revealFirst(game);
    ovBody.querySelector('[data-act="chestTake1"]').click();
    expect(ownedCards).toHaveLength(1);
    const callsAfterTake1 = grantCalls.length;
    ovBody.querySelector('[data-act="chestTake"]').click();   // 全部收下
    expect(grantCalls.length).toBeGreaterThan(callsAfterTake1);
    expect(grantCalls.filter(n => n === CARD_A.name)).toHaveLength(1);   // 已拾取的 A 不重复发
    expect(game.state).toBe('idle');
  });

  it('chestTake1 成功后 takeAll 满包强收：放不下的卡散落不入包，币照收一次', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const ownedCards = [];
    // 满包模拟：A 收得下（同名并入不占格口径由上层判定），B 拒收
    const { game } = bootSdt({
      overlay, ovBody, ownedCards,
      grantCard(card) {
        if (card.name === CARD_A.name) { ownedCards.push({ card }); return true; }
        return false;   // B 放不下：takeAll 返回值不消费 → 散落（口径如此，warnLine 已预检提示）
      },
    });
    window.SDT.Cards.randomDropCard = (() => { let n = 0; return () => (n++ === 0 ? CARD_A : CARD_B); })();
    await revealFirst(game);
    ovBody.querySelector('[data-act="chestTake"]').click();   // 全部收下（含放不下的）
    expect(ownedCards.map(o => o.card.name)).toEqual([CARD_A.name]);
    expect(game.gainCoins).toHaveBeenCalledTimes(1);
    expect(game.gainCoins).toHaveBeenCalledWith(7);
    expect(game.state).toBe('idle');   // 强收散落后照常收箱结束，不卡死流程
  });

  it('三选一（chestPick）满包拒绝：不 next、币不发、面板保留可腾格重选', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const ownedCards = [];
    const grantCalls = [];
    const { game } = bootSdt({
      overlay, ovBody, ownedCards,
      canReceiveCard: () => false,   // 三选一满包：选中的卡收不下
      grantCard(card) { grantCalls.push(card.name); return false; },
    });
    await revealFirst(game, 'medium');
    const pick = () => ovBody.querySelector('[data-act="chestPick"]');
    expect(pick()).not.toBeNull();
    pick().click();
    expect(grantCalls).toHaveLength(1);
    expect(game.gainCoins).not.toHaveBeenCalled();   // 币只在收取成功后才发
    expect(game.state).toBe('modal');
    expect(overlay.hidden).toBe(false);
    expect(pick()).not.toBeNull();   // 留在面板：可腾格重选或只收金币离开
  });

  it('三选一成功：收卡后币照发、立即 next；放弃（chestSkip）币照收卡散落', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const ownedCards = [];
    const { game } = bootSdt({ overlay, ovBody, ownedCards });
    await revealFirst(game, 'medium');
    ovBody.querySelector('[data-act="chestPick"]').click();
    expect(ownedCards).toHaveLength(1);
    expect(game.gainCoins).toHaveBeenCalledTimes(1);
    expect(game.state).toBe('idle');   // 唯一一只箱开完 → 收尾

    // 第二只箱：放弃分支
    ownedCards.length = 0;
    game.gainCoins.mockClear();
    await revealFirst(game, 'medium');
    ovBody.querySelector('[data-act="chestSkip"]').click();
    expect(ownedCards).toHaveLength(0);            // 卡散落
    expect(game.gainCoins).toHaveBeenCalledTimes(1); // 币是无主物，跳过也收
    expect(game.state).toBe('idle');
  });
});

/* ---------- 商店买卖（game.run.shop.js createShopController 依赖注入） ---------- */

function makeShop({ coins = 100, canReceiveCard, stock } = {}) {
  const logs = [];
  const acts = {};
  const overlayHidden = { value: true };
  const ownedCards = [];
  const game = {
    state: 'idle', coins,
    ownedCards,
    canReceiveCard: canReceiveCard || (() => true),
    // 预置具名 key 的持久货架（D-1 防重刷口径）：openShop 只在首次生成时掷骰，
    // 已存在的 shopStocks[stockKey] 原样复用——测试注入的 stock 不被重掷覆盖
    shopStocks: { sys03: stock || [
      { card: { id: 's1', name: '货架卡甲', rarity: '古朴', type: '法术' }, price: 5, sold: false },
      { card: { id: 's2', name: '货架卡乙', rarity: '稀有', type: '武术' }, price: 9, sold: false },
      { empty: true, label: '卡牌库无货' },
    ] },
    shopStock: null,
  };
  const UI = {
    act(name, fn) { acts[name] = fn; },
    log(message) { logs.push(String(message)); },
    refresh() {}, showOverlay() { overlayHidden.value = false; }, hideOverlay() { overlayHidden.value = true; },
    registerHelp() {}, helpBtn: () => '',
  };
  const controller = shopMod.createShopController({
    UI, SDT: window.SDT, game,
    bagCap: () => 10, cardHTML: () => '', newUid: (() => { let n = 0; return () => 'u' + n++; })(),
    saveGame() {}, setCardPageOpen() {}, usedSlots: () => ownedCards.length,
  });
  controller.openShop('sys03');   // 具名 key：复用预置货架，不重掷
  return { game, acts, logs, ownedCards, overlayHidden };
}

describe('SYS-03 商店买卖事务序（game.run.shop.js）', () => {
  it('买入成功：先验币与容量，扣币/标记 sold/入包一次到位', async () => {
    window.SDT = { Cards: { isSellable: c => !!c.sellable, sellPrice: c => c.value || 0 }, Sound: { sfx() {} }, Icons: { rich: x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { game, acts, ownedCards } = makeShop();
    acts.buyCard({ i: 0 });
    expect(game.coins).toBe(95);
    expect(game.shopStock[0].sold).toBe(true);
    expect(ownedCards).toHaveLength(1);
    expect(ownedCards[0].card.name).toBe('货架卡甲');
  });

  it('缺币拒绝：不扣币、不标记 sold、无卡入包', async () => {
    window.SDT = { Cards: { isSellable: c => !!c.sellable, sellPrice: c => c.value || 0 }, Sound: { sfx() {} }, Icons: { rich: x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { game, acts, ownedCards, logs } = makeShop({ coins: 3 });
    acts.buyCard({ i: 1 });   // 9 币的卡只有 3 币
    expect(game.coins).toBe(3);
    expect(game.shopStock[1].sold).toBeFalsy();
    expect(ownedCards).toHaveLength(0);
    expect(logs.some(l => l.includes('币不够'))).toBe(true);
  });

  it('满包拒绝：canReceiveCard false 不扣币不标记 sold（已保护，钉现状）', async () => {
    window.SDT = { Cards: { isSellable: c => !!c.sellable, sellPrice: c => c.value || 0 }, Sound: { sfx() {} }, Icons: { rich: x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { game, acts, ownedCards } = makeShop({ canReceiveCard: () => false });
    acts.buyCard({ i: 0 });
    expect(game.coins).toBe(100);
    expect(game.shopStock[0].sold).toBeFalsy();
    expect(ownedCards).toHaveLength(0);
  });

  it('取消不扣币：buySha 拒绝与离开商店都不产生扣费；卖出即时成交卡减币加', async () => {
    window.SDT = { Cards: { isSellable: c => !!c.sellable, sellPrice: c => c.value || 0 }, Sound: { sfx() {} }, Icons: { rich: x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { game, acts, ownedCards, overlayHidden } = makeShop({
      stock: [{ card: { id: 'sha', name: '初始攻击', rarity: '初始', type: '武术' }, price: 1, sold: false, shaReplenish: 5 }],
    });
    game.canReceiveCard = () => false;   // 满包：补充被拒
    acts.buySha({ i: 0 });
    expect(game.coins).toBe(100);
    expect(game.shopStock[0].shaReplenish).toBe(5);
    game.canReceiveCard = () => true;
    acts.buySha({ i: 0 });
    expect(game.coins).toBe(99);
    expect(game.shopStock[0].shaReplenish).toBe(4);
    acts.closeShop();   // 取消=直接离开：无挂起扣费、页面关闭
    expect(game.coins).toBe(99);
    expect(game.state).toBe('idle');
    expect(overlayHidden.value).toBe(true);

    // 卖出：uid 即时成交；已成交的 uid 再点（幽灵点击）无二次入账
    ownedCards.push({ uid: 'coin-1', card: { id: 'c1', name: '铜币', type: '资源', value: 3, sellable: true } });
    acts.sellCard({ uid: 'coin-1' });
    expect(game.coins).toBe(102);
    expect(ownedCards.some(o => o.uid === 'coin-1')).toBe(false);
    acts.sellCard({ uid: 'coin-1' });
    expect(game.coins).toBe(102);
  });
});
