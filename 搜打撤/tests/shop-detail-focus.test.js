import { connectSdtFixture } from './helpers/environment-fixtures.js';
import { overlayMethods } from '../game/src/ui/overlay.js';
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureShopRuntime, createShopController } from '../game/src/run/game.run.shop.js';

const card = { id: 'shop-test', name: '商店测试卡', type: '法术', rarity: '古朴' };
const coin = { id: 'shop-coin', name: '铜币', type: '资源', sellable: true, value: 3 };
const sha = { id: 'sha', name: '初始攻击', type: '武术', rarity: '初始' };

async function shop({ save = () => true, stored = false, coins = 20, canReceive = () => true, renderCard = () => '' } = {}) {
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
  const UI = { el: { ovBody: host, overlay: host }, _overlayInteractionRoot: overlayMethods._overlayInteractionRoot, act: (name, handler) => { acts[name] = handler; },
    showOverlay: (_title, html) => { host.innerHTML = html; }, hideOverlay: vi.fn(),
    refresh: vi.fn(), log: vi.fn() };
  const SDT = { Base: { slot: 1 }, Cards: { isSellable: item => !!item.sellable, sellPrice: item => item.value || 0 },
    Sound: { sfx: vi.fn() }, Icons: { rich: html => html } };
  await connectSdtFixture({ ...SDT, game });
  const saveGame = vi.fn(save);
  let uid = 0;
  const controller = createShopController({ UI, SDT, game, saveGame, bagCap: () => 16,
    cardHTML: renderCard, newUid: () => `new-${uid++}`, usedSlots: () => game.ownedCards.length, setCardPageOpen: vi.fn() });
  controller.openShop('one');
  return { acts, game, owned, host, UI, SDT, saveGame, controller };
}

afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); configureShopRuntime({ openBag: undefined }); });

describe('shop detail covered-region focus isolation', () => {
  it.each([true, false])('保存结果%s释放控件后聚焦可用的成交出口，不重建货架或详情', async saved => {
    let release;
    const { acts, host, game } = await shop({save:() => new Promise(resolve => {release=resolve;})});
    acts.shopInspect({i:0});
    const root=host.firstElementChild, detail=host.querySelector('.shop-detail'), slot=host.querySelector('.shop-slot');
    host.querySelector('.shop-detail-buy').focus();
    const pending=acts.buyCard({i:0});
    expect([...root.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
    release(saved); await pending;
    const done=host.querySelector('.shop-detail-done');
    expect(done.disabled).toBe(false); expect(document.activeElement).toBe(done);
    expect(host.firstElementChild).toBe(root); expect(host.querySelector('.shop-detail')).toBe(detail);
    expect(host.querySelector('.shop-slot')).toBe(slot); expect(game.coins).toBe(15);
  });
  it('保存期间用户把焦点移到其他控件，完成后不抢回详情', async () => {
    let release;
    const { acts, host } = await shop({save:() => new Promise(resolve => {release=resolve;})});
    acts.shopInspect({i:0}); host.querySelector('.shop-detail-buy').focus();
    const pending=acts.buyCard({i:0});
    const other=document.createElement('button'); other.textContent='其他操作'; document.body.append(other); other.focus();
    release(true); await pending;
    expect(document.activeElement).toBe(other);
    expect(host.querySelector('.shop-detail-done').disabled).toBe(false);
  });
  it('购买保存中的提示留在页脚，补货后保留货架、卡面和详情宿主', async () => {
    let resolveSave;
    const { acts, host } = await shop({ save:() => new Promise(resolve => { resolveSave = resolve; }),
      renderCard:() => '<div class="hs-card"><img src="/test.webp"></div>' });
    acts.shopInspect({ i:1 });
    const root = host.querySelector('.shop-market'), slot = host.querySelectorAll('.shop-slot')[1];
    const art = slot.querySelector('img'), detail = host.querySelector('.shop-detail');
    const buying = acts.buySha({ i:1 });
    expect(root.querySelector(':scope > .room-saving')).toBeNull();
    expect(root.querySelector('.shop-live .room-saving')).not.toBeNull();
    resolveSave(true); await buying;
    expect(host.querySelector('.shop-market')).toBe(root);
    expect(host.querySelectorAll('.shop-slot')[1]).toBe(slot);
    expect(slot.querySelector('img')).toBe(art);
    expect(host.querySelector('.shop-detail')).toBe(detail);
  });
  it('keeps focus in the top detail dialog, excluding shelf, merchant and parent navigation', async () => {
    const { acts, host, UI } = await shop({ renderCard: () => '<input type="checkbox" aria-label="灵能召唤">' });
    acts.shopInspect({ i: 0 });
    const focusables = overlayMethods._overlayFocusable.call(UI);
    expect(document.activeElement).toBe(host.querySelector('.shop-detail-close'));
    expect(focusables).not.toContain(host.querySelector('.shop-board input[type=checkbox]'));
    expect(focusables.some(node => node.closest('.shop-board, .shop-merchant'))).toBe(false);
    expect(focusables).not.toContain(host.querySelector('[data-act=shopOpenBag]'));
    expect(focusables).not.toContain(host.querySelector('[data-act=closeShop]'));
    expect(focusables).toContain(host.querySelector('.shop-detail [data-act=buyCard]'));
  });

  it('restores shelf accessibility and the original preview after reduced-motion close', async () => {
    const { acts, host, SDT, UI } = await shop();
    SDT.Motion = { reduceMotion: () => true };
    acts.shopInspect({ i: 1 });
    acts.shopCloseInspect();
    expect(host.querySelector('.shop-detail').hidden).toBe(true);
    expect(host.querySelector('.shop-board').hasAttribute('inert')).toBe(false);
    expect(host.querySelector('.shop-merchant').hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(host.querySelector('.shop-preview[data-i="1"]'));
    expect(overlayMethods._overlayFocusable.call(UI)).toContain(document.activeElement);
    expect(overlayMethods._overlayFocusable.call(UI)).toContain(host.querySelector('[data-act=shopOpenBag]'));
    expect(overlayMethods._overlayFocusable.call(UI)).toContain(host.querySelector('[data-act=closeShop]'));
  });

  it('keeps the shade background blocked through exit and ignores a cancelled close on quick reopen', async () => {
    vi.useFakeTimers();
    const { acts, host } = await shop();
    acts.shopInspect({ i: 0 });
    acts.shopCloseInspect();
    expect(host.querySelector('.shop-board').hasAttribute('inert')).toBe(true);
    acts.shopInspect({ i: 1 });
    vi.runAllTimers();
    expect(host.querySelector('.shop-detail').hidden).toBe(false);
    expect(host.querySelector('.shop-board').hasAttribute('inert')).toBe(true);
    acts.shopCloseInspect();
    vi.runAllTimers();
    expect(host.querySelector('.shop-board').hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(host.querySelector('.shop-preview[data-i="1"]'));
  });

  it('preserves a preexisting inert merchant across repeated opens', async () => {
    const { acts, host, SDT } = await shop();
    SDT.Motion = { reduceMotion: () => true };
    const merchant = host.querySelector('.shop-merchant');
    merchant.setAttribute('inert', '');
    acts.shopInspect({ i: 0 });
    acts.shopInspect({ i: 1 });
    acts.shopCloseInspect();
    expect(merchant.hasAttribute('inert')).toBe(true);
    expect(host.querySelector('.shop-board').hasAttribute('inert')).toBe(false);
  });

  it('reapplies covered-region isolation when returning from the bag redraws an open detail', async () => {
    const { acts, host, UI } = await shop();
    acts.shopInspect({ i: 0 });
    let onReturn;
    configureShopRuntime({ openBag:callback => { onReturn=callback; host.innerHTML='<section class=bag-view>背包</section>'; } });
    acts.shopOpenBag();
    expect(onReturn()).toBe(true);
    expect(host.querySelector('.shop-detail').hidden).toBe(false);
    expect(host.querySelector('.shop-board').hasAttribute('inert')).toBe(true);
    expect(overlayMethods._overlayFocusable.call(UI).some(node => node.closest('.shop-merchant'))).toBe(false);
  });
  it('releases owned inert on leaving but preserves preexisting inert', async () => {
    const { acts, host } = await shop();
    const board = host.querySelector('.shop-board');
    const merchant = host.querySelector('.shop-merchant');
    merchant.setAttribute('inert', '');
    acts.shopInspect({ i: 0 });
    await acts.closeShop();
    expect(board.hasAttribute('inert')).toBe(false);
    expect(merchant.hasAttribute('inert')).toBe(true);
  });

  it('releases replaced roots and ignores a late close after a fresh page opens', async () => {
    vi.useFakeTimers();
    const { acts, host, controller } = await shop();
    const oldRoot = host.querySelector('.shop-market');
    const merchant = oldRoot.querySelector('.shop-merchant');
    merchant.setAttribute('inert', '');
    acts.shopInspect({ i: 0 });
    acts.shopCloseInspect();
    host.innerHTML = '<section>replacement</section>';
    await Promise.resolve(); // Existing page-surface observer invalidates the detached owner.
    expect(oldRoot.querySelector('.shop-board').hasAttribute('inert')).toBe(false);
    expect(merchant.hasAttribute('inert')).toBe(true);
    controller.openShop('one');
    acts.shopInspect({ i: 1 });
    vi.runAllTimers();
    expect(host.querySelector('.shop-board').hasAttribute('inert')).toBe(true);
    expect(host.querySelector('.shop-detail').hidden).toBe(false);
  });

  it('keeps purchased detail isolated and continues browsing without charging twice', async () => {
    const { acts, host, SDT, game, saveGame } = await shop();
    SDT.Motion = { reduceMotion: () => true };
    acts.shopInspect({ i: 0 });
    host.querySelector('.shop-detail-buy').click();
    for (let n=0;n<10;n++) await Promise.resolve();
    expect(game.coins).toBe(15);
    expect(saveGame).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.shop-board').hasAttribute('inert')).toBe(true);
    expect(host.querySelector('.shop-merchant').hasAttribute('inert')).toBe(true);
    host.querySelector('.shop-detail-done').click();
    expect(document.activeElement).toBe(host.querySelector('.shop-preview[data-i="0"]'));
    expect(host.querySelector('.shop-board').hasAttribute('inert')).toBe(false);
    await acts.buyCard({ i: 0 }); // A stale buy callback still cannot repurchase sold stock.
    expect(game.coins).toBe(15);
    expect(saveGame).toHaveBeenCalledTimes(1);
  });

  it('returns focus to detail close when replenishment becomes unaffordable', async () => {
    const { acts, host, game, SDT } = await shop({ coins: 1 });
    SDT.Motion = { reduceMotion: () => true };
    acts.shopInspect({ i: 1 });
    const buy = host.querySelector('.shop-detail-buy'); buy.focus(); buy.click(); for (let n=0;n<10;n++) await Promise.resolve();
    expect(game.coins).toBe(0);
    expect(host.querySelector('.shop-detail-buy').disabled).toBe(true);
    expect(document.activeElement).toBe(host.querySelector('.shop-detail-close'));
    expect(document.activeElement.disabled).toBe(false);
    expect(host.querySelector('.shop-board').hasAttribute('inert')).toBe(true);
    host.querySelector('.shop-detail-close').click();
    expect(document.activeElement).toBe(host.querySelector('.shop-preview[data-i="1"]'));
  });

  it('preserves an available buy action and does not steal visible header focus', async () => {
    const { acts, host, game } = await shop({ coins: 3 });
    acts.shopInspect({ i: 1 });
    const buy = host.querySelector('.shop-detail-buy'); buy.focus(); buy.click(); for (let n=0;n<10;n++) await Promise.resolve();
    expect(game.coins).toBe(2);
    expect(document.activeElement).toBe(host.querySelector('.shop-detail-buy'));
    const bagButton = host.querySelector('[data-act=shopOpenBag]'); bagButton.focus();
    await acts.buySha({ i: 1 });
    expect(document.activeElement).toBe(bagButton);
  });

});
