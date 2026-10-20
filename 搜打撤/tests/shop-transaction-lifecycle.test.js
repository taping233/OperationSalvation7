// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureShopRuntime, createShopController } from '../game/src/run/game.run.shop.js';

const card = { id: 'shop-test', name: '商店测试卡', type: '法术', rarity: '古朴' };
const coin = { id: 'shop-coin', name: '铜币', type: '资源', sellable: true, value: 3 };
const sha = { id: 'sha', name: '初始攻击', type: '武术', rarity: '初始' };

function shop({ save = () => true, stored = false, coins = 20, canReceive = () => true } = {}) {
  const acts = {};
  const owned = { uid: 'coin-owned', card: coin, safe: true, stored };
  const game = { state: 'idle', coins, ownedCards: [owned], canReceiveCard: canReceive,
    shopStocks: { one: [{ card, price: 5, sold: false }, { card: sha, price: 1, sold: false, shaReplenish: 5 }],
      two: [{ card: { ...card, id: 'other', name: '另一商店卡' }, price: 9, sold: false }] } };
  const host = document.createElement('main'); document.body.append(host);
  host.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button) acts[button.dataset.act]?.(button.dataset);
  });
  const UI = { el: { ovBody: host, overlay: host }, act: (name, handler) => { acts[name] = handler; },
    showOverlay: (_title, html) => { host.innerHTML = html; }, hideOverlay: vi.fn(),
    refresh: vi.fn(), log: vi.fn(), registerHelp: vi.fn(), helpBtn: () => '' };
  const SDT = { Base: { slot: 1 }, Cards: { isSellable: item => !!item.sellable, sellPrice: item => item.value || 0 },
    Sound: { sfx: vi.fn() }, Icons: { rich: html => html } };
  const saveGame = vi.fn(save);
  let uid = 0;
  const controller = createShopController({ UI, SDT, game, saveGame, bagCap: () => 16,
    cardHTML: () => '', newUid: () => `new-${uid++}`, usedSlots: () => game.ownedCards.length, setCardPageOpen: vi.fn() });
  controller.openShop('one');
  return { acts, game, owned, host, UI, SDT, saveGame, controller };
}

afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); configureShopRuntime({ openBag: undefined }); });

describe('局内商店事务及旧页面动作', () => {
  it('玩家已离开商店坐标时，仍连接着的旧购买动作也不能扣币或成交', () => {
    const { acts, game, saveGame } = shop();
    const buy = acts.buyCard, before = JSON.stringify(game.ownedCards);
    game.layerIdx = 0; game.trackPos = 8;
    buy({ i:0 });
    expect(game.coins).toBe(20);expect(game.shopStock[0].sold).toBe(false);
    expect(JSON.stringify(game.ownedCards)).toBe(before);expect(saveGame).not.toHaveBeenCalled();
  });
  it.each(['buyCard', 'buySha', 'sellCard'])('%s 保存失败仍沿用局内检查点契约，币与背包/库存同步推进', action => {
    const { acts, game, owned, SDT, saveGame } = shop({ save: () => false });
    acts.openSell();
    if (action !== 'sellCard') acts.backShop();
    const bag = game.ownedCards, stock = game.shopStock;
    acts[action](action === 'sellCard' ? { uid: owned.uid } : { i: action === 'buySha' ? 1 : 0 });
    expect(game.coins).toBe(action === 'sellCard' ? 23 : action === 'buySha' ? 19 : 15);
    expect(game.ownedCards).toBe(bag); expect(game.ownedCards).toHaveLength(action === 'sellCard' ? 0 : 2);
    if (action === 'buyCard') expect(stock[0].sold).toBe(true);
    if (action === 'buySha') expect(stock[1].shaReplenish).toBe(4);
    expect(game.shopStock).toBe(stock); expect(saveGame).toHaveBeenCalledTimes(1);
    expect(SDT.Sound.sfx).toHaveBeenCalledWith(action === 'sellCard' ? 'tradeSell' : 'tradeBuy');
  });

  it('检查点保存失败后商品仍只能购入一次，后续成功保存完整内存状态', () => {
    let saved = false;
    const { acts, game, saveGame } = shop({ save: () => saved });
    acts.buyCard({ i: 0 });
    saved = true; acts.buyCard({ i: 0 }); acts.buyCard({ i: 0 });
    expect(game.coins).toBe(15); expect(game.ownedCards).toHaveLength(2);
    expect(game.shopStock[0].sold).toBe(true); expect(saveGame).toHaveBeenCalledTimes(1);
    expect(saveGame()).toBe(true); expect(game.ownedCards[1].card.id).toBe(card.id);
    expect(game.shopStocks.one[0]).toBe(game.shopStock[0]);
  });

  it('补充位重复购买只扣实际购入数量，本站第六次不再成交', () => {
    const { acts, game, saveGame } = shop();
    for (let n = 0; n < 6; n++) acts.buySha({ i: 1 });
    expect(game.coins).toBe(15); expect(game.ownedCards).toHaveLength(6);
    expect(game.shopStock[1].shaReplenish).toBe(0); expect(saveGame).toHaveBeenCalledTimes(5);
  });

  it.each([{ coins: 0 }, { canReceive: () => false }])('缺币或容量不足（%o）不会调用保存或修改任何交易状态', options => {
    const { acts, game, saveGame } = shop(options);
    const before = structuredClone({ coins: game.coins, ownedCards: game.ownedCards, shopStock: game.shopStock });
    acts.buyCard({ i: 0 }); acts.buySha({ i: 1 });
    expect(game.coins).toBe(before.coins); expect(game.ownedCards).toEqual(before.ownedCards);
    expect(game.shopStock).toEqual(before.shopStock); expect(saveGame).not.toHaveBeenCalled();
  });

  it('只持有珍珠盒存放卡时货架提示与收购台一致', () => {
    const { acts, host } = shop({ stored: true });
    expect(host.querySelector('.sellpost-hint').textContent).toBe('暂无可出售卡牌');
    acts.openSell(); expect(host.querySelector('[data-act="sellCard"]')).toBeNull();
  });

  it('离店后保留的购买/补充/出售/离店动作不能再成交或重复触发节点收尾', () => {
    const { acts, game, saveGame, controller } = shop();
    const onClose = vi.fn(); controller.openShop('one', onClose);
    const old = { ...acts };
    acts.closeShop();
    old.buyCard({ i: 0 }); old.buySha({ i: 1 }); old.sellCard({ uid: 'coin-owned' }); old.closeShop();
    expect(game.coins).toBe(20); expect(game.ownedCards).toHaveLength(1);
    expect(saveGame).not.toHaveBeenCalled(); expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('换入另一商店后旧货架购买回调不能按旧索引买到新商品', () => {
    const { acts, game, controller, saveGame } = shop();
    const oldBuy = acts.buyCard;
    controller.openShop('two'); oldBuy({ i: 0 });
    expect(game.coins).toBe(20); expect(game.ownedCards).toHaveLength(1);
    expect(saveGame).not.toHaveBeenCalled(); expect(game.shopStocks.two[0].sold).toBe(false);
    acts.buyCard({ i: 0 }); expect(game.coins).toBe(11);
  });

  it('切换收购台或覆盖页后旧购买回调作废，不动背包和币', () => {
    const { acts, game, host, saveGame } = shop();
    const oldBuy = acts.buyCard;
    acts.openSell(); oldBuy({ i: 0 });
    host.innerHTML = '<section>其他节点面板</section>'; acts.sellCard({ uid: 'coin-owned' });
    expect(game.coins).toBe(20); expect(game.ownedCards).toHaveLength(1);
    expect(saveGame).not.toHaveBeenCalled(); expect(host.textContent).toBe('其他节点面板');
  });

  it('整理背包正常返回保留货架，但换店后旧背包返回回调不能抢新页面', () => {
    const { acts, game, host, controller } = shop();
    let onReturn;
    configureShopRuntime({ openBag: callback => { onReturn = callback; host.innerHTML = '<section class="bag-view">背包</section>'; } });
    acts.shopOpenBag(); onReturn();
    expect(host.querySelector('.shop-market')).not.toBeNull(); expect(game.shopStock).toBe(game.shopStocks.one);
    acts.shopOpenBag(); const oldReturn = onReturn;
    controller.openShop('two'); const currentRoot = host.firstElementChild;
    oldReturn(); expect(host.firstElementChild).toBe(currentRoot); expect(game.shopStock).toBe(game.shopStocks.two);
  });

  it.each(['slot', 'seed', 'ownedCards'])('%s 上下文变化后旧交易不再改变新上下文', change => {
    const { acts, game, SDT, saveGame } = shop();
    if (change === 'slot') SDT.Base.slot = 2;
    else if (change === 'seed') game.seed = 'new-run';
    else game.ownedCards = [{ uid: 'new-context', card: coin }];
    const before = structuredClone({ coins: game.coins, ownedCards: game.ownedCards, stock: game.shopStock });
    acts.buyCard({ i: 0 }); acts.buySha({ i: 1 }); acts.sellCard({ uid: 'new-context' });
    expect({ coins: game.coins, ownedCards: game.ownedCards, stock: game.shopStock }).toEqual(before);
    expect(saveGame).not.toHaveBeenCalled();
  });

  it('真实按钮重复购买和出售不会重复结算同一卡', () => {
    const { host, game, saveGame, acts } = shop();
    host.querySelector('[data-act="shopInspect"][data-i="0"]').click();
    const buy = host.querySelector('[data-act="buyCard"]'); buy.click(); buy.click();
    expect(game.coins).toBe(15); expect(game.ownedCards).toHaveLength(2);
    acts.openSell(); const sell = host.querySelector('[data-act="sellCard"]'); sell.click(); sell.click();
    expect(game.coins).toBe(18); expect(game.ownedCards).toHaveLength(1); expect(saveGame).toHaveBeenCalledTimes(2);
  });

  it('商店帮助正常返回；换店后旧帮助返回不能覆盖新页面', () => {
    const { UI, host, controller } = shop();
    const oldBack = UI.registerHelp.mock.calls.find(([id]) => id === 'shop')[1].back;
    host.innerHTML = '<section class="help-body">商店帮助</section>'; oldBack();
    expect(host.querySelector('.shop-market')).not.toBeNull();
    controller.openShop('two'); const current = host.firstElementChild;
    oldBack(); expect(host.firstElementChild).toBe(current);
  });

  it('离开背包或帮助改看其他节点后，旧返回动作不覆盖当前页', () => {
    const { acts, UI, host } = shop();
    const helpBack = UI.registerHelp.mock.calls.find(([id]) => id === 'shop')[1].back;
    let onReturn;
    configureShopRuntime({ openBag: callback => { onReturn = callback; host.innerHTML = '<section class="bag-view">背包</section>'; } });
    acts.shopOpenBag();
    host.innerHTML = '<section>其他节点</section>'; const current = host.firstElementChild;
    onReturn(); helpBack(); expect(host.firstElementChild).toBe(current);
  });

  it('减少动态关闭背包后立即清空弹层，也能正常且仅一次返回商店', () => {
    const { acts, UI, host } = shop();
    let onReturn;
    UI.el = { ovBody: host, overlay: { hidden: false } };
    configureShopRuntime({ openBag: callback => { onReturn = callback; host.innerHTML = '<section class="bag-view">背包</section>'; } });
    acts.shopOpenBag(); host.replaceChildren(); UI.el.overlay.hidden = true;
    onReturn(); const current = host.firstElementChild;
    expect(current.classList.contains('shop-market')).toBe(true);
    onReturn(); expect(host.firstElementChild).toBe(current);
  });
});


describe('商店往返浏览连续性', () => {
  function visibleButtons() {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width:100, height:30 }]);
  }

  it('收购台返回货架恢复滚动、展开详情和原入口焦点', () => {
    visibleButtons();
    const { acts, host, game } = shop();
    game.shopStock[0].card = { ...card, desc:'商品完整规则。'.repeat(20) };
    acts.shopInspect({ i:0 });
    host.querySelector('.shop-detail-rules').open = true;
    host.querySelector('.shop-board').scrollTop = 175;
    host.querySelector('.shop-detail-scroll').scrollTop = 65;
    host.scrollTop = 220;
    host.querySelector('[data-act="openSell"]').focus();
    acts.openSell(); acts.backShop(); vi.runOnlyPendingTimers();
    expect(host.querySelector('.shop-board').scrollTop).toBe(175);
    expect(host.querySelector('.shop-detail-scroll').scrollTop).toBe(65);
    expect(host.querySelector('.shop-detail-rules').open).toBe(true);
    expect(host.scrollTop).toBe(220);
    expect(document.activeElement.dataset.act).toBe('openSell');
  });

  it('收购台整理背包后保留收购规则、位置和入口焦点', () => {
    visibleButtons();
    const { acts, host } = shop();
    let onReturn;
    configureShopRuntime({ openBag: callback => { onReturn = callback; host.innerHTML = '<section class="bag-view">背包</section>'; } });
    acts.openSell();
    host.querySelector('.sell-ledger-rule').open = true;
    host.querySelector('.shop-exchange').scrollTop = 155;
    host.querySelector('[data-act="shopOpenBag"]').focus();
    acts.shopOpenBag(); onReturn(); vi.runOnlyPendingTimers();
    expect(host.querySelector('.sell-ledger-rule').open).toBe(true);
    expect(host.querySelector('.shop-exchange').scrollTop).toBe(155);
    expect(document.activeElement.dataset.act).toBe('shopOpenBag');
  });

  it('返回货架后的延迟恢复不会抢新商店的焦点或滚动', () => {
    visibleButtons();
    const { acts, host, controller } = shop();
    host.querySelector('.shop-board').scrollTop = 175;
    acts.openSell(); acts.backShop();
    controller.openShop('two');
    const current = host.firstElementChild;
    const button = host.querySelector('[data-act="shopOpenBag"]'); button.focus();
    vi.runOnlyPendingTimers();
    expect(host.firstElementChild).toBe(current);
    expect(host.querySelector('.shop-board').scrollTop).toBe(0);
    expect(document.activeElement).toBe(button);
  });

  it('反复往返与出售后仍回原货架，不撤销成交或重放旧入口', () => {
    visibleButtons();
    const { acts, host, game } = shop();
    host.querySelector('.shop-board').scrollTop = 175;
    host.querySelector('[data-act="openSell"]').focus();
    acts.openSell(); acts.sellCard({ uid:'coin-owned' }); acts.backShop();
    vi.runOnlyPendingTimers();
    expect(game.coins).toBe(23);
    expect(host.querySelector('.shop-board').scrollTop).toBe(175);
    host.querySelector('.shop-board').scrollTop = 85;
    acts.openSell(); acts.backShop(); vi.runOnlyPendingTimers();
    expect(host.querySelector('.shop-board').scrollTop).toBe(85);
  });

  it('收购台经背包整理再返回货架，仍使用原货架快照', () => {
    visibleButtons();
    const { acts, host } = shop();
    let onReturn;
    configureShopRuntime({ openBag: callback => { onReturn = callback; host.innerHTML = '<section class="bag-view">背包</section>'; } });
    host.querySelector('.shop-board').scrollTop = 175;
    host.querySelector('[data-act="openSell"]').focus();
    acts.openSell(); acts.shopOpenBag(); onReturn();
    acts.backShop(); vi.runOnlyPendingTimers();
    expect(host.querySelector('.shop-board').scrollTop).toBe(175);
    expect(document.activeElement.dataset.act).toBe('openSell');
  });

  it('离店后旧返回动作不重开货架；新店不沿用上次滚动', () => {
    visibleButtons();
    const { acts, host, controller } = shop();
    host.querySelector('.shop-board').scrollTop = 175;
    acts.openSell(); const oldBack = acts.backShop;
    acts.closeShop(); const current = host.firstElementChild;
    oldBack(); vi.runOnlyPendingTimers();
    expect(host.firstElementChild).toBe(current);
    controller.openShop('two'); acts.openSell(); acts.backShop(); vi.runOnlyPendingTimers();
    expect(host.querySelector('.shop-board').scrollTop).toBe(0);
  });

});
