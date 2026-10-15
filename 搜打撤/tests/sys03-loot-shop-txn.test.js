/* SYS-03 物资事务审计（2026-10-03 老板 SYS-03）：搜刮页与商店买卖的事务顺序。
 * 2026-10-12 领奖改为先查看再确认；grantCard 返回值仍决定入包/散落，
 * chestSkip 经剩余确认后结算金币，商店缺币/满包仍拒绝成交。
 * 模式沿用 tests/chest-click-flow.test.js（手搭 window.SDT 后动态 import chests.js）
 * 与 tests/shop-sell-stored-guard.test.js（createShopController 依赖注入）。 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const bagPort = vi.hoisted(() => ({ showBackpack: vi.fn() }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots: bagPort }));

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
  bagPort.showBackpack.mockReset();
});

async function revealFirst(game, kind = 'small') {
  vi.resetModules();   // chests.js 顶层捕获 window.SDT：每个用例重载模块以绑定本用例的 SDT/DOM
  const { SDT: chestFacade } = await import('../game/src/run/chests.js');
  chestFacade.Chests.open(game, [{ kind }]);
  const reveal = document.querySelector('[data-eps-search]');
  expect(reveal).not.toBeNull();
  reveal.click();   // 搜索演出点击立即揭晓 → render() 注册查看与领取动作
  return chestFacade;
}

describe('SYS-03 搜刮页事务序（chests.js）', () => {
  it('满包整理通过背包命令入口，返回后保留所选卡与待领状态', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const ownedCards = [];
    const { game } = bootSdt({ overlay, ovBody, ownedCards, canReceiveCard: () => false });
    const bagButton = document.createElement('button');
    bagButton.id = 'bagBtnFloat';
    document.body.append(bagButton);
    let facade;
    let bagOpens = 0;
    bagPort.showBackpack.mockImplementation(() => {
      bagOpens++;
      facade.Chests.suspend();
      ovBody.innerHTML = '<p>整理背包</p>';
      facade.Chests.resume();
    });
    facade = await revealFirst(game);
    ovBody.querySelector('[data-act="chestSelect"]').click();
    expect(ovBody.querySelector('[data-act="chestOpenBag"]')).not.toBeNull();
    ovBody.querySelector('[data-act="chestOpenBag"]').click();
    expect(bagOpens).toBe(1);
    expect(bagButton.disabled).toBe(false);
    expect(ovBody.querySelector('.reward-unit [data-act="chestSelect"]')).not.toBeNull();
    expect(ovBody.querySelector('[data-act="chestOpenBag"]')).not.toBeNull();
    expect(ownedCards).toHaveLength(0);
  });

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
    ovBody.querySelector('[data-act="chestSelect"]').click();
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
    const showCount = vi.spyOn(window.SDT.UI, 'showOverlay');
    const scroll = ovBody.querySelector('.loot-scroll');
    scroll.scrollTop = 32;
    ovBody.querySelector('[data-act="chestSelect"]').click();
    ovBody.querySelector('[data-act="chestTake1"]').focus();
    ovBody.querySelector('[data-act="chestTake1"]').click();
    expect(ownedCards).toHaveLength(1);
    expect(showCount).not.toHaveBeenCalled();
    expect(ovBody.querySelector('.loot-scroll').scrollTop).toBe(32);
    expect(document.activeElement.dataset.act).toBe('chestSelect');
    const callsAfterTake1 = grantCalls.length;
    acts.chestTake();   // 重绘前的批量请求仍不得重复领取已收卡。
    expect(grantCalls.length).toBeGreaterThan(callsAfterTake1);
    expect(grantCalls.filter(n => n === CARD_A.name)).toHaveLength(1);   // 已拾取的 A 不重复发
    expect(game.state).toBe('modal');   // 结果留原位供核对
    ovBody.querySelector('[data-act="chestContinue"]').click();
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
    acts.chestTake();   // 全部收下（含放不下的），重绘后请求也必须守住事务边界。
    expect(ownedCards.map(o => o.card.name)).toEqual([CARD_A.name]);
    expect(game.gainCoins).toHaveBeenCalledTimes(1);
    expect(game.gainCoins).toHaveBeenCalledWith(7);
    expect(ovBody.querySelector('.reward-final').textContent).toContain('1 张已散落');
    ovBody.querySelector('[data-act="chestContinue"]').click();
    expect(game.state).toBe('idle');
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
    ovBody.querySelector('[data-act="chestSelect"]').click();
    acts.chestTake();       // 三选一不能由隐藏的批量动作越权收三张
    acts.chestContinue();   // 尚有待领对象不能跳过离开确认
    expect(grantCalls).toHaveLength(0);
    expect(game.state).toBe('modal');
    const pick = () => ovBody.querySelector('[data-act="chestPick"]');
    expect(pick()).toBeNull();   // 放不下时主动作是整理背包
    expect(ovBody.querySelector('[data-act="chestOpenBag"]')).not.toBeNull();
    // 直调旧动作也不得绕过当前容量判定。
    acts.chestPick({ i: 0 });
    expect(grantCalls).toHaveLength(1);
    expect(game.gainCoins).not.toHaveBeenCalled();   // 币只在收取成功后才发
    expect(game.state).toBe('modal');
    expect(overlay.hidden).toBe(false);
    expect(ovBody.querySelector('[data-act="chestOpenBag"]')).not.toBeNull();
  });

  it('三选一成功：收卡后币照发、立即 next；放弃（chestSkip）币照收卡散落', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const ownedCards = [];
    const { game } = bootSdt({ overlay, ovBody, ownedCards });
    await revealFirst(game, 'medium');
    ovBody.querySelector('[data-act="chestSelect"]').click();
    ovBody.querySelector('[data-act="chestPick"]').click();
    expect(ownedCards).toHaveLength(1);
    expect(game.gainCoins).toHaveBeenCalledTimes(1);
    expect(game.state).toBe('modal');
    ovBody.querySelector('[data-act="chestContinue"]').click();
    expect(game.state).toBe('idle');

    // 第二只箱：放弃分支
    ownedCards.length = 0;
    game.gainCoins.mockClear();
    await revealFirst(game, 'medium');
    ovBody.querySelector('[data-act="chestSkip"]').click();
    expect(game.gainCoins).not.toHaveBeenCalled();   // 离开确认前不结算
    expect(ovBody.querySelector('.reward-leave-confirm').textContent).toContain('放弃剩余');
    ovBody.querySelector('[data-act="chestStay"]').click();
    expect(game.gainCoins).not.toHaveBeenCalled();
    ovBody.querySelector('[data-act="chestSkip"]').click();
    ovBody.querySelector('[data-act="chestLeave"]').click();
    expect(ownedCards).toHaveLength(0);            // 卡散落
    expect(game.gainCoins).toHaveBeenCalledTimes(1); // 币是无主物，跳过也收
    ovBody.querySelector('[data-act="chestContinue"]').click();
    expect(game.state).toBe('idle');
  });
});

describe('宝箱开启帧与唯一揭晓', () => {
  async function animatedChest(game, chests = [{ kind:'small' }]) {
    vi.resetModules();
    const { SDT: facade } = await import('../game/src/run/chests.js');
    facade.Cards.randomDropCard = (() => { let count = 0; return () => count++ % 2 ? CARD_B : CARD_A; })();
    facade.Chests.configureFrameArt({ small:{ frames:['closed.webp','unlock.webp','small-angle.webp','mid.webp','open.webp'], fps:10 } });
    const show = vi.spyOn(facade.UI, 'showOverlay');
    facade.Chests.open(game, chests);
    return { facade, show };
  }

  it('手动揭晓取消原780ms自动timer，同箱只揭晓一次且不会重复排音效', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const { game } = bootSdt({ overlay, ovBody, ownedCards:[] });
    const { show } = await animatedChest(game);
    ovBody.querySelector('[data-act="chestReveal"]').click();
    expect(show).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(2000);
    expect(show).toHaveBeenCalledTimes(2);
    expect(window.SDT.Sound.sfx.mock.calls.filter(([name]) => name === 'reveal')).toHaveLength(2);
    expect(game.ownedCards).toHaveLength(0);
  });

  it('依次播放开启帧，最终帧结束前不公开牌，领奖才发卡和金币一次', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const { game } = bootSdt({ overlay, ovBody, ownedCards:[] });
    await animatedChest(game);
    vi.advanceTimersByTime(780);
    expect(ovBody.querySelector('.ps-chest').getAttribute('src')).toBe('unlock.webp');
    expect(ovBody.querySelector('.reward-head')).toBeNull();
    vi.advanceTimersByTime(300);
    expect(ovBody.querySelector('.ps-chest').getAttribute('src')).toBe('open.webp');
    expect(ovBody.querySelector('.reward-head')).toBeNull();
    vi.advanceTimersByTime(100);
    expect(ovBody.querySelector('.reward-head')).not.toBeNull();
    expect(game.ownedCards).toHaveLength(0);
    ovBody.querySelector('[data-act="chestTake"]').click();
    vi.advanceTimersByTime(2000);
    expect(game.ownedCards).toHaveLength(2);
    expect(game.gainCoins).toHaveBeenCalledTimes(1);
  });

  it('开启中跳过后进下一箱，旧帧timer不串新箱或重复领奖', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const { game } = bootSdt({ overlay, ovBody, ownedCards:[] });
    await animatedChest(game, [{ kind:'small' }, { kind:'small' }]);
    vi.advanceTimersByTime(830);
    ovBody.querySelector('[data-act="chestReveal"]').click();
    const staleTake = acts.chestTake;
    ovBody.querySelector('[data-act="chestTake"]').click();
    ovBody.querySelector('[data-act="chestContinue"]').click();
    staleTake();   // a departed box cannot claim the next box before its reveal
    vi.advanceTimersByTime(500);
    expect(ovBody.querySelector('.ps-chest').getAttribute('src')).toBe('closed.webp');
    expect(ovBody.querySelector('.reward-head')).toBeNull();
    expect(game.ownedCards).toHaveLength(2);
    expect(game.gainCoins).toHaveBeenCalledTimes(1);
  });

  it('开启中挂起到背包，旧timer不抢面板，恢复原结果不重抽或提前发放', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const { game } = bootSdt({ overlay, ovBody, ownedCards:[] });
    const { facade } = await animatedChest(game);
    vi.advanceTimersByTime(900);
    facade.Chests.suspend();
    ovBody.innerHTML = '<p>整理背包</p>';
    vi.advanceTimersByTime(2000);
    expect(ovBody.textContent).toBe('整理背包');
    facade.Chests.resume();
    expect(ovBody.querySelector('.reward-head')).not.toBeNull();
    expect(game.ownedCards).toHaveLength(0);
    ovBody.querySelector('[data-act="chestTake"]').click();
    expect(game.ownedCards).toHaveLength(2);
    expect(game.gainCoins).toHaveBeenCalledTimes(1);
  });

  it('减少动态直接静态揭晓，帧等待不阻塞收取', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const { game } = bootSdt({ overlay, ovBody, ownedCards:[] });
    window.SDT.Motion = { reduceMotion:() => true };
    await animatedChest(game);
    vi.advanceTimersByTime(780);
    expect(ovBody.querySelector('.reward-head')).not.toBeNull();
    expect(ovBody.querySelector('.ps-chest')).toBeNull();
    expect(game.ownedCards).toHaveLength(0);
  });

  it('切到其他节点面板作废开启timer，不抢新界面或提前领奖', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const { game } = bootSdt({ overlay, ovBody, ownedCards:[] });
    await animatedChest(game);
    vi.advanceTimersByTime(830);
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail:'page' }));
    ovBody.innerHTML = '<p>其他节点</p>';
    vi.advanceTimersByTime(2000);
    expect(ovBody.textContent).toBe('其他节点');
    expect(game.ownedCards).toHaveLength(0);
    expect(game.gainCoins).not.toHaveBeenCalled();
  });

  it('turbo直接到静态结果，卡和币仍只由领取动作发放', async () => {
    vi.useFakeTimers();
    const { overlay, ovBody } = bootDom();
    const { game } = bootSdt({ overlay, ovBody, ownedCards:[] });
    await animatedChest(game);
    const { setTurbo } = await import('../game/src/core/turbo.js');
    setTurbo(true);
    try {
      // Reopen uses the unchanged presentation-only turbo switch; no card rules change.
      window.SDT.Chests.open(game, [{ kind:'small' }]);
      vi.advanceTimersByTime(0);
      expect(ovBody.querySelector('.reward-head')).not.toBeNull();
      expect(game.ownedCards).toHaveLength(0);
      ovBody.querySelector('[data-act="chestTake"]').click();
      expect(game.ownedCards).toHaveLength(2);
      expect(game.gainCoins).toHaveBeenCalledTimes(1);
    } finally { setTurbo(false); }
  });
});

/* ---------- 商店买卖（game.run.shop.js createShopController 依赖注入） ---------- */

function makeShop({ coins = 100, canReceiveCard, stock } = {}) {
  const logs = [];
  const acts = {};
  let overlayHTML = '';
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
    refresh() {}, showOverlay(_title, html) { overlayHidden.value = false; overlayHTML = html; document.body.innerHTML = html; }, hideOverlay() { overlayHidden.value = true; },
    showCardZoom: vi.fn(),
    registerHelp() {}, helpBtn: () => '',
  };
  const controller = shopMod.createShopController({
    UI, SDT: window.SDT, game,
    bagCap: () => 10, cardHTML: () => '', newUid: (() => { let n = 0; return () => 'u' + n++; })(),
    saveGame() {}, setCardPageOpen() {}, usedSlots: () => ownedCards.length,
  });
  controller.openShop('sys03');   // 具名 key：复用预置货架，不重掷
  return { game, acts, logs, ownedCards, overlayHidden, UI, controller, get overlayHTML() { return overlayHTML; } };
}

describe('SYS-03 商店买卖事务序（game.run.shop.js）', () => {
  it('查看货品不消费、不改变货架，购买按钮才成交', async () => {
    window.SDT = { Cards: { isSellable: () => false }, Sound: { sfx() {} }, Icons: { rich: x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { game, acts, ownedCards, UI, overlayHTML } = makeShop();
    expect(document.getElementById('shopLive').textContent).toBe('');
    expect(document.getElementById('resCards')).toBeNull();
    expect(document.querySelectorAll('.shop-item-title')).toHaveLength(0);
    expect(document.querySelectorAll('.shop-owned')).toHaveLength(0);
    expect(document.querySelector('.shop-detail').hidden).toBe(true);
    expect(document.querySelector('.shop-detail-buy')).toBeNull();
    expect(overlayHTML).not.toContain('class="shop-purchase');
    acts.shopInspect({ i: 0 });
    expect(document.querySelector('.shop-detail').hidden).toBe(false);
    expect(document.querySelector('.shop-detail-buy').textContent).toBe('购买 · 5 币');
    expect(document.querySelector('.shop-detail h3')).toBeNull();
    expect(document.querySelector('.shop-detail-rules')).toBeNull();
    expect(UI.showCardZoom).not.toHaveBeenCalled();
    expect(game.coins).toBe(100);
    expect(game.shopStock[0].sold).toBe(false);
    expect(ownedCards).toHaveLength(0);
    acts.buyCard({ i: 0 });
    expect(game.coins).toBe(95);
    expect(ownedCards).toHaveLength(1);
  });

  it('查看神秘货箱不泄露随机卡或消费', async () => {
    window.SDT = { Cards: { isSellable: () => false }, Sound: { sfx() {} }, Icons: { rich: x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { game, acts, ownedCards, UI } = makeShop({ stock: [{ card: CARD_A, mystery:true, price:3, sold:false }] });
    acts.shopInspect({ i: 0 });
    expect(UI.showCardZoom).not.toHaveBeenCalled();
    expect(game.coins).toBe(100);
    expect(game.shopStock[0].sold).toBe(false);
    expect(ownedCards).toHaveLength(0);
  });
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
    acts.shopInspect({ i: 0 });
    expect(document.querySelector('.shop-detail .tone-limited').textContent).toBe('余额不足：还差 2 币');
    expect(document.querySelector('.shop-detail-buy').disabled).toBe(true);
    expect(document.querySelector('.shop-detail-buy').getAttribute('aria-disabled')).toBe('true');
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
    acts.shopInspect({ i: 0 });
    expect(document.querySelector('.shop-detail .tone-limited').textContent).toContain('背包装不下');
    expect(document.querySelector('.shop-detail-buy').disabled).toBe(true);
    expect(document.querySelector('.shop-detail-buy').getAttribute('aria-disabled')).toBe('true');
    acts.buyCard({ i: 0 });
    expect(game.coins).toBe(100);
    expect(game.shopStock[0].sold).toBeFalsy();
    expect(ownedCards).toHaveLength(0);
  });

  it('商品详情按需打开，收起或 Escape 回到原货位且不离店、不成交', async () => {
    vi.useFakeTimers();
    window.SDT = { Cards: { isSellable: () => false }, Sound: { sfx() {} }, Icons: { rich: x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { game, acts, ownedCards, overlayHidden } = makeShop();
    const shelf = document.querySelector('.shop-board-grid');
    acts.shopInspect({ i: 1 });
    expect(document.activeElement.classList.contains('shop-detail-close')).toBe(true);
    acts.shopCloseInspect();
    expect(document.querySelector('.shop-detail').dataset.shopMotion).toBe('out');
    expect(document.querySelector('.shop-detail').hidden).toBe(false);
    vi.advanceTimersByTime(300);
    expect(document.querySelector('.shop-detail').hidden).toBe(true);
    expect(document.activeElement.dataset.i).toBe('1');
    expect(document.querySelector('.shop-detail').textContent).toBe('');
    acts.shopInspect({ i: 0 });
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    vi.advanceTimersByTime(300);
    expect(document.querySelector('.shop-detail').hidden).toBe(true);
    expect(document.querySelector('.shop-board-grid')).toBe(shelf);
    expect(overlayHidden.value).toBe(false);
    expect(game.state).toBe('modal');
    expect(game.coins).toBe(100);
    expect(ownedCards).toHaveLength(0);
  });

  it('收起过渡中快速重开另一货品，旧收起回调不隐藏新详情', async () => {
    vi.useFakeTimers();
    window.SDT = { Cards:{ isSellable:() => false }, Sound:{ sfx() {} }, Icons:{ rich:x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { acts } = makeShop();
    acts.shopInspect({ i:0 });
    const detail = document.querySelector('.shop-detail');
    expect(detail.dataset.shopMotion).toBe('in');
    acts.shopCloseInspect();
    expect(detail.inert).toBe(true);
    acts.shopInspect({ i:1 });
    vi.advanceTimersByTime(300);
    expect(detail.hidden).toBe(false);
    expect(detail.inert).toBe(false);
    expect(detail.dataset.shopMotion).toBe('in');
    expect(detail.querySelector('.shop-detail-buy').textContent).toBe('购买 · 9 币');
    const entered = new Event('animationend', { bubbles:true });
    Object.defineProperty(entered, 'animationName', { value:'shop-detail-in' });
    detail.dispatchEvent(entered);
    expect(detail.dataset.shopMotion).toBeUndefined();
    acts.buyCard({ i:1 });
    expect(detail.dataset.shopMotion).toBeUndefined();
    expect(detail.querySelector('.shop-detail-done')).not.toBeNull();
  });

  it.each(['setting', 'system'])('减少动态效果（%s）立即收起并回焦原货位', async preference => {
    const originalMatchMedia = window.matchMedia;
    window.SDT = { Cards:{ isSellable:() => false }, Sound:{ sfx() {} }, Icons:{ rich:x => x }, Motion:{ reduceMotion:() => preference === 'setting' } };
    window.matchMedia = () => ({ matches:preference === 'system' });
    try {
      shopMod = await import('../game/src/run/game.run.shop.js');
      const { acts } = makeShop();
      acts.shopInspect({ i:0 });
      expect(document.querySelector('.shop-detail').dataset.shopMotion).toBeUndefined();
      acts.shopCloseInspect();
      expect(document.querySelector('.shop-detail').hidden).toBe(true);
      expect(document.activeElement.dataset.i).toBe('0');
    } finally { window.matchMedia = originalMatchMedia; }
  });

  it('长规则按需展开，短规则不另设重复说明面板', async () => {
    window.SDT = { Cards: { isSellable: () => false }, Sound: { sfx() {} }, Icons: { rich: x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { acts } = makeShop({ stock: [{ card: { id:'long', name:'长规则卡', type:'法术', desc:'完整效果。'.repeat(20) }, price:2, sold:false }] });
    acts.shopInspect({ i:0 });
    const rules = document.querySelector('details.shop-detail-rules');
    expect(rules.open).toBe(false);
    expect(rules.querySelector('summary').textContent).toBe('完整规则');
    expect(rules.querySelector('p').textContent).toContain('完整效果。');
    expect(document.querySelector('.shop-detail h3')).toBeNull();
  });

  it('从控制台回到原商店时刷新余额与可购买状态，不再生成货架', async () => {
    window.SDT = { Cards: { isSellable: () => false }, Sound: { sfx() {} }, Icons: { rich: x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { acts, game } = makeShop({ coins:0 });
    const stock = game.shopStock;
    acts.shopInspect({ i:0 });
    expect(document.querySelector('.shop-detail-buy').disabled).toBe(true);
    game.coins = 50;
    document.querySelector('.shop-replica').dispatchEvent(new CustomEvent('sdt-dev-console-return'));
    expect(game.shopStock).toBe(stock);
    expect(document.getElementById('resCoins').textContent).toBe('50');
    expect(document.querySelector('.shop-detail-buy').disabled).toBe(false);
    expect(document.querySelectorAll('.shop-slot.unaffordable')).toHaveLength(0);
  });

  it('成交保留货位，详情原位显示完成出口并更新其他价格可负担状态', async () => {
    window.SDT = { Cards: { isSellable: () => false }, Sound: { sfx() {} }, Icons: { rich: x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { acts } = makeShop({ coins: 10 });
    acts.shopInspect({ i: 0 });
    document.querySelector('.shop-detail-buy').focus();
    acts.buyCard({ i: 0 });
    expect(document.querySelectorAll('.shop-slot')).toHaveLength(3);
    expect(document.querySelector('.shop-slot.sold .shop-preview').getAttribute('aria-label')).toContain('货架卡甲');
    expect(document.querySelector('.shop-detail').hidden).toBe(false);
    expect(document.querySelector('.shop-detail-buy')).toBeNull();
    expect(document.activeElement.classList.contains('shop-detail-done')).toBe(true);
    expect(document.querySelectorAll('.shop-slot')[1].classList.contains('unaffordable')).toBe(true);
    expect(document.getElementById('resCoins').textContent).toBe('5');
  });

  it('取消不扣币：buySha 拒绝与离开商店都不产生扣费；卖出即时成交卡减币加', async () => {
    window.SDT = { Cards: { isSellable: c => !!c.sellable, sellPrice: c => c.value || 0 }, Sound: { sfx() {} }, Icons: { rich: x => x } };
    shopMod = await import('../game/src/run/game.run.shop.js');
    const { game, acts, ownedCards, overlayHidden, controller } = makeShop({
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
    controller.openShop('sys03');
    acts.openSell();
    acts.sellCard({ uid: 'coin-1' });
    expect(game.coins).toBe(102);
    expect(ownedCards.some(o => o.uid === 'coin-1')).toBe(false);
    acts.sellCard({ uid: 'coin-1' });
    expect(game.coins).toBe(102);
  });
});
