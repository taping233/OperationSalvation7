// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../game/src/core/icons-bitmap.js';
import { configureShopRuntime, createShopController } from '../game/src/run/game.run.shop.js';

const Icons = window.SDT.Icons;
const makeCard = (id, name = id) => ({ id, name, rarity:'古朴', type:'法术' });
function shop({ coins = 5, canReceiveCard = () => true, stock } = {}) {
  const acts = {}, host = document.createElement('main');
  let pendingAction;
  document.body.append(host);
  const game = { state:'idle', coins, ownedCards:[], canReceiveCard,
    shopStocks:{ guidance:stock || [
      { card:makeCard('first'), price:5, sold:false },
      { card:makeCard('second'), price:9, sold:false },
      { card:makeCard('gift'), price:0, free:true, sold:false },
      { card:makeCard('sha'), price:1, shaReplenish:5, sold:false },
      { card:makeCard('sold'), price:3, sold:true },
      { card:makeCard('secret', '不应提前揭晓的卡名'), price:3, mystery:true, sold:false },
    ] } };
  const UI = { el:{ ovBody:host, overlay:host }, act:(name, action) => { acts[name] = action; },
    showOverlay:(_title, html) => { host.innerHTML = Icons.rich(html); }, hideOverlay:vi.fn(),
    refresh:vi.fn(), log:vi.fn(), registerHelp:vi.fn(), helpBtn:() => '' };
  host.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled) pendingAction=acts[button.dataset.act]?.(button.dataset);
  });
  const saveGame = vi.fn();
  let nextUid = 0;
  const controller = createShopController({ game, UI,
    SDT:{ Icons, Base:{slot:1}, Sound:{sfx:vi.fn()}, Motion:{reduceMotion:() => true},
      Cards:{ isSellable:card => !!card.sellable, sellPrice:card => card.value || 0 } },
    bagCap:() => 16, usedSlots:() => game.ownedCards.length,
    cardHTML:card => `<div class="hs-card">${card.name}</div>`, newUid:() => `shop-${++nextUid}`,
    saveGame, setCardPageOpen:vi.fn() });
  controller.openShop('guidance');
  return { acts, game, host, saveGame, controller, settle:()=>pendingAction };
}
const slots = host => [...host.querySelectorAll('.shop-slot')];
const state = slot => slot.querySelector('.shop-stock-state').textContent;
afterEach(() => { document.body.replaceChildren(); configureShopRuntime({ openBag:undefined }); vi.restoreAllMocks(); });

describe('商店金币与交易状态引导', () => {
  it('余额、货架、详情和购买按钮沿用已批准的金币图，并隐藏装饰图标名称', async () => {
    const { acts, host } = shop();
    const wallet = host.querySelector('.shop-resource.coin');
    expect(wallet.textContent).toBe('可用金币5币');
    expect(wallet.querySelector('img').src).toContain('map-hud-1015/gold-is7-v2.webp');
    expect(host.querySelector('.shop-browse-hint')).toBeNull();
    acts.shopInspect({i:0});
    const button = host.querySelector('.shop-detail-buy');
    expect(button.textContent).toBe('购买 · 5 币');
    expect(button.querySelector('img').src).toContain('map-hud-1015/gold-is7-v2.webp');
    expect(host.querySelector('.shop-detail-account')).toBeNull();
    expect(host.querySelector('.shop-detail-facts')).toBeNull();
    for (const icon of host.querySelectorAll('.shop-coin-icon img')) {
      expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(icon.dataset.assetKey).toBe('icon-coin');
    }
    expect(host.textContent).not.toContain('[[icon:');
  });

  it('货架用文字与ARIA区分可买、差额、免费、售罄，并保留售出价与神秘身份', async () => {
    const { host } = shop();
    const items = slots(host);
    expect(items.map(item => item.dataset.availability)).toEqual(['ready','short','ready','ready','sold','ready']);
    expect(items.map(state)).toEqual(['可购买','还差 4 币','可免费领取','可购买','已售出','可购买']);
    expect(items[1].querySelector('.shop-preview').getAttribute('aria-label')).toContain('9 金币，还差 4 币');
    expect(items[4].querySelector('.shop-v14-price').textContent).toBe('3币');
    expect(items[4].querySelector('.shop-preview').disabled).toBe(false);
    expect(items[5].textContent).not.toContain('不应提前揭晓的卡名');
    expect(items[5].querySelector('.shop-preview').getAttribute('aria-label')).toContain('神秘货箱');
    expect(host.querySelector('.shop-detail-buy')).toBeNull();
  });

  it('成交后同步其余价签差额和无障碍名称，保留未购货位及其焦点/卡面身份', async () => {
    const { acts, host, game, saveGame, settle } = shop();
    const second = slots(host)[1], gift = slots(host)[2], sha = slots(host)[3];
    acts.shopInspect({i:0});
    host.querySelector('.shop-detail-buy').focus();
    host.querySelector('.shop-detail-buy').click(); await settle();
    expect(game.coins).toBe(0); expect(game.ownedCards).toHaveLength(1);
    expect(saveGame).toHaveBeenCalledOnce();
    expect(host.querySelector('#resCoins').textContent).toBe('0');
    expect(slots(host)[1]).toBe(second); expect(slots(host)[2]).toBe(gift);
    expect(state(second)).toBe('还差 9 币'); expect(state(sha)).toBe('还差 1 币');
    expect(state(gift)).toBe('可免费领取');
    expect(second.querySelector('.shop-preview').getAttribute('aria-label')).toContain('还差 9 币');
    expect(host.querySelector('.shop-slot.sold .shop-v14-price img')).not.toBeNull();
    expect(document.activeElement.classList.contains('shop-detail-done')).toBe(true);
    expect(host.querySelector('.shop-detail-account')).toBeNull();
    expect(host.querySelector('.shop-live').textContent).toContain('剩余 0 币');
  });

  it('满包状态由真实收卡判定投影，不把余额充足或免费误报为可买', async () => {
    const { acts, host, game, saveGame } = shop({ canReceiveCard:() => false });
    expect(state(slots(host)[0])).toBe('背包装不下');
    expect(state(slots(host)[2])).toBe('背包装不下');
    acts.shopInspect({i:1});
    expect(host.querySelector('.shop-detail-facts').textContent).toContain('还差 4 币');
    expect(host.querySelector('.shop-detail-facts').textContent).toContain('背包装不下');
    expect(host.querySelector('.shop-detail-buy').disabled).toBe(true);
    expect(host.querySelector('.shop-detail-buy').textContent).toBe('金币不足 · 9 币');
    expect(host.querySelector('.shop-detail-account')).toBeNull();
    expect(host.querySelector('.shop-detail-bag')).not.toBeNull();
    await acts.buyCard({i:1});
    expect(game.coins).toBe(5); expect(saveGame).not.toHaveBeenCalled();
  });

  it('购买导致容量变化后，其余商品状态立即更新，免费卡也受原容量约束', async () => {
    const { acts, host, game } = shop({coins:20});
    game.canReceiveCard = () => game.ownedCards.length < 1;
    await acts.buyCard({i:0});
    expect(game.coins).toBe(15);
    expect(state(slots(host)[1])).toBe('背包装不下');
    expect(state(slots(host)[2])).toBe('背包装不下');
    acts.shopInspect({i:2});
    expect(host.querySelector('.shop-detail-buy').disabled).toBe(true);
    expect(host.querySelector('.shop-detail-buy').textContent).toBe('背包装不下 · 0 币');
  });

  it('补充耗尽显示售罄而非缺币，免费领取不扣币且详情继续沿用真实完成出口', async () => {
    const { acts, host, game } = shop();
    for (let count = 0; count < 5; count++) await acts.buySha({i:3});
    const item = slots(host)[3];
    expect(game.coins).toBe(0); expect(item.dataset.availability).toBe('sold');
    expect(item.classList.contains('unaffordable')).toBe(false);
    expect(state(item)).toBe('补充已售罄');
    acts.shopInspect({i:2});
    expect(host.querySelector('.shop-detail-buy').textContent).toBe('免费领取');
    await acts.buyCard({i:2});
    expect(game.coins).toBe(0); expect(game.ownedCards).toHaveLength(6);
    expect(host.querySelector('.shop-detail-done')).not.toBeNull();
  });

  it('连续补货保留展开规则、阅读位置与摘要焦点，并明确每次支出', async () => {
    const card={...makeCard('long'),desc:'完整材料规则。'.repeat(30)};
    const {acts,host}=shop({coins:5,stock:[{card,price:1,shaReplenish:5,sold:false}]});
    acts.shopInspect({i:0});const rules=host.querySelector('.shop-detail-rules');rules.open=true;
    host.querySelector('.shop-detail-scroll').scrollTop=120;rules.querySelector('summary').focus();
    await acts.buySha({i:0});
    expect(host.querySelector('.shop-detail-rules').open).toBe(true);
    expect(host.querySelector('.shop-detail-scroll').scrollTop).toBe(120);
    expect(document.activeElement.tagName).toBe('SUMMARY');
    expect(host.querySelector('.shop-live').textContent).toContain('已入本次远征背包 · 支出 1 币 · 剩余 4 币');
  });
  it('免费成交明确未扣币，重绘回执把卡名作为文字呈现', async () => {
    const {acts,host}=shop({stock:[{card:makeCard('gift','<b>礼物</b>'),price:0,free:true,sold:false}]});
    await acts.buyCard({i:0});acts.backShop();
    expect(host.querySelector('.shop-live').textContent).toBe('免费领取「<b>礼物</b>」 · 已入本次远征背包 · 未扣币 · 剩余 5 币');
    expect(host.querySelector('.shop-live b')).toBeNull();
  });
  it('收购规则默认收拢，卖出显示实际收入并保留列表位置和下张操作焦点', async () => {
    const frames=[];vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>{frames.push(fn);return frames.length;});
    vi.spyOn(HTMLElement.prototype,'getClientRects').mockImplementation(()=>[{}]);
    const {acts,host,game}=shop();
    game.ownedCards.push(...['one','two'].map(uid=>({uid,card:{...makeCard(uid),sellable:true,value:3}})));
    acts.openSell();expect(host.querySelector('.sell-ledger-rule').tagName).toBe('DETAILS');expect(host.querySelector('.sell-ledger-rule').open).toBe(false);
    host.querySelector('.shop-board').scrollTop=140;host.querySelector('[data-act="sellCard"]').focus();
    await acts.sellCard({uid:'one'});frames.splice(0).forEach(fn=>fn());
    expect(host.querySelector('.shop-live').textContent).toContain('已从背包出售「one」 · 收入 3 币 · 当前 8 币');
    expect(host.querySelector('.shop-board').scrollTop).toBe(140);
    expect(document.activeElement.dataset.uid).toBe('two');
    await acts.sellCard({uid:'two'});frames.splice(0).forEach(fn=>fn());
    expect(document.activeElement.dataset.act).toBe('backShop');
  });

  it('收购收入明确标为卖出可得，出售后返店重新投影余额和可买状态', async () => {
    const { acts, host, game } = shop({coins:2});
    game.ownedCards.push({uid:'sellable', card:{...makeCard('铜币'), sellable:true, value:3}});
    acts.openSell();
    expect(host.querySelector('.sell-item-offer').textContent).toBe('卖出可得+3 币');
    expect(host.querySelector('.sell-item-offer img').dataset.assetKey).toBe('icon-coin');
    expect(host.querySelector('.sell-ledger-total').textContent).toBe('合计3币');
    await acts.sellCard({uid:'sellable'});
    expect(game.coins).toBe(5); expect(game.ownedCards).toHaveLength(0);
    expect(host.querySelector('.shop-resource.coin').textContent).toBe('可用金币5币');
    acts.backShop(); expect(state(slots(host)[0])).toBe('可购买');
  });
});
