// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShopController } from '../game/src/run/game.run.shop.js';
import { openShopCommission } from '../game/src/run/shop-commission.js';
import { Random, SeededRandomService, setRandomService } from '../game/src/core/random.js';

const card = { id:'settlement-card', name:'货品', type:'法术', rarity:'古朴' };
const coin = { id:'settlement-coin', name:'铜币', type:'资源', sellable:true, value:3 };
const sha = { id:'settlement-sha', name:'初始攻击', type:'武术', rarity:'初始' };
function dom() {
  const host = document.createElement('main'); document.body.append(host);
  const acts = {};
  const UI = { el:{ ovBody:host, overlay:host }, act:(name,handler) => { acts[name] = handler; },
    showOverlay:(_title,html) => { host.innerHTML = html; }, hideOverlay:vi.fn(),
    log:vi.fn(), refresh:vi.fn(), helpBtn:() => '', registerHelp:vi.fn() };
  return { host, acts, UI };
}
function shop({ save = () => true, receive = () => true, newUid } = {}) {
  const h = dom(); let sequence = 0;
  const owned = { uid:'owned-coin', card:coin };
  const game = { state:'idle', coins:20, ownedCards:[owned], canReceiveCard:receive,
    shopStocks:{ one:[{ card, price:5, sold:false }, { card:sha, price:1, sold:false, shaReplenish:5 }] } };
  const SDT = { Base:{ slot:1 }, Cards:{ isSellable:item => !!item.sellable, sellPrice:item => item.value || 0 },
    Sound:{ sfx:vi.fn() }, Icons:{ rich:html => html } };
  const saveGame = vi.fn(save), onClose = vi.fn();
  const controller = createShopController({ UI:h.UI, SDT, game, saveGame,
    bagCap:() => 16, usedSlots:() => game.ownedCards.length, cardHTML:() => '',
    newUid:newUid || (() => `received-${sequence++}`), setCardPageOpen:vi.fn() });
  controller.openShop('one', onClose);
  return { ...h, game, SDT, owned, saveGame, onClose, controller };
}

let randomBefore;
beforeEach(() => { randomBefore = Random.snapshot(); });
afterEach(() => {
  const restored = new SeededRandomService(randomBefore.seed); restored.restore(randomBefore); setRandomService(restored);
  document.body.replaceChildren(); vi.restoreAllMocks();
});

describe('shop settlement ownership and checkpoint receipts', () => {
  it.each(['false', 'throw'])('%s保存失败保留同次完整内存成交，给出未保存回执且不重复购入', failure => {
    const h = shop({ save:() => { if (failure === 'throw') throw new Error('disk unavailable'); return false; } });
    h.acts.buyCard({ i:0 }); h.acts.buyCard({ i:0 });
    expect(h.game.coins).toBe(15); expect(h.game.ownedCards).toHaveLength(2);
    expect(h.game.shopStock[0].sold).toBe(true); expect(h.saveGame).toHaveBeenCalledTimes(1);
    expect(h.UI.log.mock.calls.some(([message]) => message.includes('本局已成交') && message.includes('保存未成功'))).toBe(true);
    expect(h.SDT.Sound.sfx).toHaveBeenCalledWith('tradeBuy');
  });

  it('保存端口同步重入不能再买补充位或提前关闭会话', () => {
    let h;
    h = shop({ save:() => { h.acts.buySha({ i:1 }); h.acts.closeShop(); return true; } });
    h.acts.buySha({ i:1 });
    expect(h.game.coins).toBe(19); expect(h.game.shopStock[1].shaReplenish).toBe(4);
    expect(h.game.ownedCards).toHaveLength(2); expect(h.saveGame).toHaveBeenCalledTimes(1);
    expect(h.game.state).toBe('modal'); expect(h.onClose).not.toHaveBeenCalled();
  });

  it('未保存交易离店时保留重试入口，保存成功后才关闭且只回调一次', () => {
    let saved = false;
    const h = shop({ save:() => saved });
    h.acts.buyCard({ i:0 }); h.acts.closeShop();
    expect(h.game.state).toBe('modal'); expect(h.UI.hideOverlay).not.toHaveBeenCalled();
    expect(h.host.textContent).toContain('保存仍未成功');
    saved = true;
    const close = h.acts.closeShop; close(); close();
    expect(h.game.state).toBe('idle'); expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.game.coins).toBe(15); expect(h.game.ownedCards).toHaveLength(2);
  });

  it.each(['slot', 'card', 'price'])('同数组内%s被替换后旧购买引用不能买入另一个报价', change => {
    const h = shop();
    if (change === 'slot') h.game.shopStock[0] = { card, price:5, sold:false };
    else if (change === 'card') h.game.shopStock[0].card = { ...card, id:'replacement' };
    else h.game.shopStock[0].price = 1;
    h.acts.buyCard({ i:0 });
    expect(h.game.coins).toBe(20); expect(h.game.ownedCards).toHaveLength(1);
    expect(h.saveGame).not.toHaveBeenCalled();
  });

  it.each(['owned', 'card'])('同UID的%s身份被替换后旧出售引用失效', change => {
    const h = shop(); h.acts.openSell();
    if (change === 'owned') h.game.ownedCards[0] = { uid:h.owned.uid, card:coin };
    else h.owned.card = { ...coin };
    h.acts.sellCard({ uid:h.owned.uid });
    expect(h.game.coins).toBe(20); expect(h.game.ownedCards).toHaveLength(1); expect(h.saveGame).not.toHaveBeenCalled();
  });

  it('普通购买不能绕过补充位次数，售罄补充位不能走另一个入口', () => {
    const h = shop(); h.acts.buyCard({ i:1 });
    expect(h.game.shopStock[1].shaReplenish).toBe(5);
    h.game.shopStock[1].sold = true; h.acts.buySha({ i:1 });
    expect(h.game.coins).toBe(20); expect(h.saveGame).not.toHaveBeenCalled();
  });

  it('旧容量端口与预览同源，不因有同名卡就越过满包限制', () => {
    const h = shop(); delete h.game.canReceiveCard; h.game.canAcceptCard = () => false;
    h.game.ownedCards.push({ uid:'same-name', card });
    h.acts.buyCard({ i:0 }); h.acts.buySha({ i:1 });
    expect(h.game.coins).toBe(20); expect(h.game.ownedCards).toHaveLength(2); expect(h.saveGame).not.toHaveBeenCalled();
  });

  it.each(['throw', 'duplicate'])('卡牌UID%s时准备失败，不留下扣款或售出标记', mode => {
    const h = shop({ newUid:() => { if (mode === 'throw') throw new Error('uid'); return 'owned-coin'; } });
    expect(() => h.acts.buyCard({ i:0 })).not.toThrow();
    expect(h.game.coins).toBe(20); expect(h.game.ownedCards).toHaveLength(1);
    expect(h.game.shopStock[0].sold).toBe(false); expect(h.saveGame).not.toHaveBeenCalled();
  });

  it('通知端口异常发生在保存之后，不割裂已经完成的交易', () => {
    const h = shop();
    h.UI.log.mockImplementation(() => { throw new Error('notification'); });
    h.SDT.Sound.sfx.mockImplementation(() => { throw new Error('sound'); });
    expect(() => h.acts.buyCard({ i:0 })).not.toThrow();
    expect(h.saveGame).toHaveBeenCalledTimes(1); expect(h.game.coins).toBe(15);
    expect(h.game.ownedCards).toHaveLength(2); expect(h.game.shopStock[0].sold).toBe(true);
  });

  it('免费商品也须容量通过，成功只入包一次且不扣币', () => {
    let fits = false;
    const h = shop({ receive:() => fits });
    h.game.shopStock[0].price = 0; h.game.shopStock[0].free = true; h.game.shopStock[0].commissionFree = true;
    h.controller.openShop('one'); h.acts.buyCard({ i:0 });
    expect(h.game.ownedCards).toHaveLength(1); expect(h.saveGame).not.toHaveBeenCalled();
    fits = true; h.acts.buyCard({ i:0 }); h.acts.buyCard({ i:0 });
    expect(h.game.coins).toBe(20); expect(h.game.ownedCards).toHaveLength(2); expect(h.saveGame).toHaveBeenCalledTimes(1);
  });
});

function commission({ save = () => true, pending = { status:'pending' } } = {}) {
  const h = dom();
  const stock = [0,1,2].map(index => ({ card:{ ...card, id:`offer-${index}`, name:`商品${index}` }, price:index + 2 }));
  const owner = { commission:pending }, game = { shopStock:stock, nodeRewards:{ a:owner } };
  const saveGame = vi.fn(save), leave = vi.fn(), renderShop = vi.fn();
  const args = { game, UI:h.UI, SDT:{ Cards:{ SHA:sha }, Sound:{ sfx() {} }, Motion:{ reduceMotion:() => true } },
    stockKey:'one', save:saveGame, current:() => true, renderShop, leave };
  setRandomService({ random:() => 0, reseed() {}, snapshot:() => ({}), restore() {} });
  openShopCommission(args);
  return { ...h, game, stock, pending, owner, saveGame, leave, renderShop, args };
}
function pickTwo(h) {
  h.acts.commissionStart();
  h.acts.eventDiceRoll(); h.acts.eventDiceContinue();
  h.acts.eventDiceRoll(); h.acts.eventDiceContinue();
}

describe('shop commission draft commit and old callbacks', () => {
  it.each(['false', 'throw'])('免费货位应用保存%s时回退优惠，原骰子保留且重试只应用一次', failure => {
    let fail = true, h;
    h = commission({ save:() => {
      if (h?.pending.status === 'applied' && fail) { if (failure === 'throw') throw new Error('disk'); return false; }
      return true;
    } });
    pickTwo(h);
    expect(h.pending.slots).toEqual([0,1]); expect(h.pending.status).toBe('pending');
    expect(h.stock.map(slot => slot.price)).toEqual([2,3,4]); expect(h.stock.some(slot => slot.commissionFree)).toBe(false);
    expect(h.leave).not.toHaveBeenCalled(); expect(h.host.textContent).toContain('优惠未应用');
    fail = false; h.acts.commissionRetry();
    expect(h.pending.status).toBe('applied'); expect(h.stock.filter(slot => slot.commissionFree)).toHaveLength(2);
    const enter = h.acts.commissionEnterShop; enter(); enter();
    expect(h.pending.announced).toBe(true); expect(h.renderShop).toHaveBeenCalledTimes(1);
  });

  it('首次绑定保存失败不预占商店，重试前无投骰或免费商品', () => {
    let saved = false;
    const h = commission({ save:() => saved });
    expect(h.pending).toEqual({ status:'pending' }); expect(h.stock.map(slot => slot.price)).toEqual([2,3,4]);
    expect(h.acts.eventDiceRoll).toBeUndefined(); expect(h.leave).not.toHaveBeenCalled();
    saved = true; h.acts.commissionRetry();
    expect(h.pending.shopKey).toBe('one'); expect(h.pending.slots).toEqual([]);
    expect(h.host.textContent).toContain('送到下一家店的信');
  });

  it('宣布回执保存失败不标完成；恢复后原优惠仅确认一次', () => {
    let fail = true, h;
    h = commission({ save:() => !(fail && h?.pending.announced) }); pickTwo(h);
    h.acts.commissionEnterShop();
    expect(h.pending.announced).toBeUndefined(); expect(h.renderShop).not.toHaveBeenCalled();
    expect(h.stock.filter(slot => slot.commissionFree)).toHaveLength(2);
    fail = false; h.acts.commissionRetry();
    const enter = h.acts.commissionEnterShop; enter(); enter();
    expect(h.renderShop).toHaveBeenCalledTimes(1);
  });

  it('替换原事件记录后旧委托按钮不能给新记录或旧货架发优惠', () => {
    const h = commission(), start = h.acts.commissionStart;
    h.owner.commission = { status:'pending' }; start();
    expect(h.pending.slots).toEqual([]); expect(h.stock.some(slot => slot.free)).toBe(false);
    expect(h.saveGame).toHaveBeenCalledTimes(1);
  });

  it('原投骰货位被换对象后旧确认不能给替代商品免单', () => {
    const h = commission(); h.acts.commissionStart(); h.acts.eventDiceRoll();
    const confirm = h.acts.eventDiceContinue;
    h.stock[0] = { card:{ ...card, id:'replacement' }, price:9 }; confirm();
    expect(h.pending.slots).toEqual([]); expect(h.stock[0].price).toBe(9); expect(h.stock.some(slot => slot.free)).toBe(false);
  });

  it('暂离保存失败留在可重试页面，保存成功后只离开一次', () => {
    let saved = true;
    const h = commission({ save:() => saved }); h.acts.commissionStart();
    saved = false; h.acts.eventDiceLeave(); expect(h.leave).not.toHaveBeenCalled();
    expect(h.host.textContent).toContain('保存未成功');
    saved = true; const retry = h.acts.commissionRetry; retry(); retry();
    expect(h.leave).toHaveBeenCalledTimes(1);
  });
});
