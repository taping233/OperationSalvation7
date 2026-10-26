import { runPendingFields } from './helpers/environment-fixtures.js';
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let session, game, UI, bag, originalBagClose;
const pearl = { id: 'tt2-pearlbox', name: '珍珠盒', type: '装备', rarity: '稀有' };
const key = { id: 'safe-pearl-key', name: '一把钥匙', type: '资源', rarity: '稀有' };
const threeKeys = { id: 'safe-pearl-three-keys', name: '三把钥匙', type: '资源', rarity: '稀有' };
const ordinary = { id: 'safe-pearl-ordinary', name: '普通招式', type: '武术', rarity: '稀有' };
const copies = (card, count, flags = {}) => Array.from({ length: count }, (_, n) => ({ uid: `${card.id}-${n}`, card: { ...card }, ...flags }));
const button = (action, name) => [...document.querySelectorAll(`button[data-act="${action}"]`)].find(el => !name || el.dataset.name === name);
const tile = name => [...document.querySelectorAll('[data-act="inspectStack"]')].find(el => el.dataset.name === name);
const snapshot = () => JSON.stringify(game.ownedCards);
async function inspectSafe() {
  document.querySelector('.bag-rz[data-zone="safe"]').click(); await settleContainer();
  tile(pearl.name).click(); await settleContainer();
}
async function openSafe() {
  await inspectSafe();
  const action = button('pearlStoreZoom');
  expect(action).toBeInstanceOf(HTMLButtonElement);
  action.click(); await settleContainer();
}

beforeAll(async () => {
  document.body.innerHTML = readFileSync('game/index.html', 'utf8');
  window.SDT = { Icons: { img: () => '', rich: String, TYPE_ART: {} },
    Sound: { music() {}, sfx: vi.fn(), setDucked() {} }, FX: { feedback() {} } };
  await import('../game/src/cards/cards.js');
  await import('../game/src/ui/ui.js');
  await import('../game/src/hub/base.js');
  session = await import('../game/src/run/game.session.js');
  bag = await import('../game/src/hub/game.bag.js');
  game = session.game; UI = window.SDT.UI;
  UI.init(); UI.log = vi.fn(); UI.refresh = () => {};
  window.SDT.Cards.cardHTML = card => `<span>${card.name}</span>`;
  window.SDT.Cards.cardBackHTML = () => '';
  vi.spyOn(window.SDT.Base, 'bagCap').mockReturnValue(18);
  session._set_active_slot(null);
  originalBagClose = UI._bagCloseHook;
});
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(game, { seed: 'safe-pearl-run', discoveredPairs: new Set(), runActive: true, state: 'idle', myClass: '战士', inventory: [],
    ownedCards: [...copies(pearl, 1, { safe: true }), ...copies(threeKeys, 1, { stored: 1 }), ...copies(key, 1)],
    ...runPendingFields() });
  window.SDT.Chests = { isOpen: () => false };
  UI.beginRoom(); bag.showBackpackSection('main');
});
afterEach(() => {
  document.getElementById('cardZoom')?._closeCardZoom?.(true);
  UI._bagCloseHook = originalBagClose;
  UI.hideOverlay({ immediate: true }); UI.endRoom();
});

describe('安全格珍珠盒直接存取', () => {
  it('安全格详情提供真实按钮和当前动作，打开既有两栏存取页而不移动盒子', async () => {
    const before = snapshot(); await inspectSafe();
    const zoom = document.getElementById('cardZoom');
    expect(zoom.querySelector('[data-act="pearlStoreZoom"]')).not.toBeNull();
    expect(zoom._inventoryActions.pearlStoreZoom).toBe(UI._acts.pearlStoreZoom);
    button('pearlStoreZoom').click(); await settleContainer();
    expect(document.querySelector('.pearl-store-columns')).not.toBeNull();
    expect(button('pearlPut', key.name)).toBeInstanceOf(HTMLButtonElement);
    expect(button('pearlTake', threeKeys.name)).toBeInstanceOf(HTMLButtonElement);
    expect(snapshot()).toBe(before); expect(session.safeUsed()).toBe(1);
  });

  it('19/27时直接整叠存入腾一格，保持safe/stored/UID及收卡限制', async () => {
    game.ownedCards.push(...Array.from({ length: 18 }, (_, n) => ({ uid: `ordinary-${n}`, card: { ...ordinary, name: `普通招式${n}` } })));
    bag.showBackpack(true);
    expect(session.usedSlots()).toBe(19); expect(session.bagCap()).toBe(27);
    const beforeUids = game.ownedCards.map(o => o.uid);
    await openSafe(); button('pearlPut', key.name).click(); await settleContainer();
    expect(session.usedSlots()).toBe(18); expect(session.safeUsed()).toBe(1);
    expect(game.ownedCards.find(o => o.card.id === pearl.id).safe).toBe(true);
    expect(game.ownedCards.find(o => o.card.id === key.id)).toMatchObject({ stored: 1 });
    expect(game.ownedCards.find(o => o.card.id === key.id).safe).toBeUndefined();
    expect(game.ownedCards.map(o => o.uid)).toEqual(beforeUids);
    expect(game.canReceiveCard(ordinary)).toBe(false);
    expect(document.querySelector('.pearl-store [role="status"]').textContent.replace(/\s/g, '')).toContain('2/9');
  });

  it.each(['button', 'Esc'])('%s关闭只回原安全格tab，不关闭背包或改变保护归属', async method => {
    await openSafe(); const before = snapshot(), close = UI._bagCloseHook = vi.fn();
    if (method === 'Esc') expect(UI.closeTopOverlayByEsc()).toBe(true);
    else button('pearlBack').click(); await settleContainer();
    expect(document.querySelector('.bag-grid').dataset.zone).toBe('safe');
    expect(document.querySelector('.bag-rz[data-zone="safe"]').getAttribute('aria-pressed')).toBe('true');
    expect(tile(pearl.name)).toBeInstanceOf(HTMLElement);
    expect(UI.el.overlay.hidden).toBe(false); expect(game.state).toBe('modal');
    expect(close).not.toHaveBeenCalled(); expect(snapshot()).toBe(before);
  });

  it('普通背包珍珠盒原入口和关闭tab保持不变', async () => {
    game.ownedCards.find(o => o.card.id === pearl.id).safe = false;
    bag.showBackpack(true); tile(pearl.name).click(); await settleContainer(); button('pearlStoreZoom').click(); await settleContainer();
    button('pearlBack').click(); await settleContainer();
    expect(document.querySelector('.bag-grid').dataset.zone).toBe('bag');
    expect(game.ownedCards.find(o => o.card.id === pearl.id).safe).toBe(false);
  });

  it('安全格打开后盒满仍拒绝整叠存入，原始张数和保护保持', async () => {
    game.ownedCards = [...copies(pearl, 1, { safe: true }), ...copies(threeKeys, 8, { stored: 1 }), ...copies(key, 2)];
    bag.showBackpack(true); await openSafe(); const before = snapshot(), beforeUids = game.ownedCards.map(o => o.uid);
    const put = button('pearlPut', key.name);
    expect(put.disabled).toBe(true);
    expect(put.closest('.container-store-slot').querySelector('.container-store-blocked').textContent).toBe('剩余 1 张空间，放不下整叠');
    expect(put.getAttribute('aria-label')).toContain('剩余 1 张空间，放不下整叠');
    UI.log.mockClear(); put.click(); await settleContainer();
    expect(UI.log).not.toHaveBeenCalled();
    expect(snapshot()).toBe(before); expect(game.ownedCards.map(o => o.uid)).toEqual(beforeUids);
    expect(game.ownedCards).toHaveLength(11); expect(session.safeUsed()).toBe(1);
  });

  it('直接取出只解除资源stored，安全格盒子与所有UID保留', async () => {
    await openSafe(); const beforeUids = game.ownedCards.map(o => o.uid);
    button('pearlTake', threeKeys.name).click(); await settleContainer();
    expect(game.ownedCards.find(o => o.card.id === threeKeys.id).stored).toBeUndefined();
    expect(game.ownedCards.find(o => o.card.id === threeKeys.id).safe).toBeUndefined();
    expect(game.ownedCards.find(o => o.card.id === pearl.id).safe).toBe(true);
    expect(game.ownedCards.map(o => o.uid)).toEqual(beforeUids);
    expect(session.usedSlots()).toBe(2); expect(session.safeUsed()).toBe(1);
  });

  it('安全格打开后背包仍放不下整叠时拒绝取出', async () => {
    game.ownedCards = [...copies(pearl, 1, { safe: true }), ...copies(threeKeys, 9, { stored: 1 }), ...copies(key, 78)];
    bag.showBackpack(true); await openSafe(); const before = snapshot(), beforeUids = game.ownedCards.map(o => o.uid);
    expect(session.usedSlots()).toBe(26); expect(session.bagCap()).toBe(27);
    const take = button('pearlTake', threeKeys.name);
    expect(take.disabled).toBe(true);
    expect(take.closest('.container-store-slot').querySelector('.container-store-blocked').textContent).toBe('背包空间不足，整叠需 3 格');
    expect(take.getAttribute('aria-label')).toContain('背包空间不足，整叠需 3 格');
    UI.log.mockClear(); take.click(); await settleContainer();
    expect(UI.log).not.toHaveBeenCalled();
    expect(snapshot()).toBe(before); expect(game.ownedCards.map(o => o.uid)).toEqual(beforeUids);
    expect(game.ownedCards).toHaveLength(88); expect(session.safeUsed()).toBe(1);
  });

  it.each([
    ['pearlPut', key.name, 8, 2, '珍珠盒放不下'],
    ['pearlTake', threeKeys.name, 9, 78, '背包放不下'],
  ])('%s显式调用仍保留容量守卫，不能绕过disabled移动资源', async (action, name, storedCount, bagCount, warning) => {
    game.ownedCards = [...copies(pearl, 1, { safe: true }), ...copies(threeKeys, storedCount, { stored: 1 }), ...copies(key, bagCount)];
    bag.showBackpack(true); await openSafe(); const before = snapshot(), beforeUids = game.ownedCards.map(o => o.uid);
    expect(button(action, name).disabled).toBe(true);
    UI.log.mockClear(); UI._acts[action]({ name });
    expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining(warning), 'warn');
    expect(snapshot()).toBe(before); expect(game.ownedCards.map(o => o.uid)).toEqual(beforeUids);
    expect(game.ownedCards).toHaveLength(1 + storedCount + bagCount); expect(session.safeUsed()).toBe(1);
  });

  it('安全格旧详情及已返回的存取回调不能抢新页或改变卡牌', async () => {
    await inspectSafe(); const oldOpen = UI._acts.pearlStoreZoom;
    UI.showOverlay('', '<div id="newPage">新页</div>'); const before = snapshot(); oldOpen();
    expect(document.getElementById('newPage')).not.toBeNull(); expect(snapshot()).toBe(before);
    bag.showBackpack(true); await openSafe();
    const put = UI._acts.pearlPut, take = UI._acts.pearlTake, back = UI._acts.pearlBack;
    button('pearlBack').click(); await settleContainer(); const body = UI.el.ovBody.firstElementChild;
    put({ name: key.name }); take({ name: threeKeys.name }); back();
    expect(UI.el.ovBody.firstElementChild).toBe(body); expect(snapshot()).toBe(before);
  });

  it('从奖励页整理并开安全盒后，第一次关闭回safe，真正关闭背包才恢复奖励', async () => {
    UI.hideOverlay({ immediate: true });
    const resume = vi.fn(), suspend = vi.fn(() => true);
    window.SDT.Chests = { isOpen: () => true, suspend, resume };
    UI.showOverlay('奖励', '<main class="reward-v14">奖励</main>');
    bag.showBackpack(); expect(suspend).toHaveBeenCalledOnce(); await openSafe();
    button('pearlPut', key.name).click(); await settleContainer(); button('pearlBack').click(); await settleContainer();
    expect(document.querySelector('.bag-grid').dataset.zone).toBe('safe'); expect(resume).not.toHaveBeenCalled();
    await UI._acts.closeBag(); expect(resume).toHaveBeenCalledOnce();
    expect(game.ownedCards.find(o => o.card.id === pearl.id).safe).toBe(true);
  });

  it('直接存入安全盒的资源仍进入真实失败抢运清单', async () => {
    await openSafe(); button('pearlPut', key.name).click(); await settleContainer();
    game.hp = 0; game.surrenderedRun = false;
    expect(await session.doDeath()).toBe(true);
    const result = document.querySelector('.settlement-report');
    expect(result.textContent).toContain('已抢运资源卡：三把钥匙 ×1、一把钥匙 ×1');
    expect(result.querySelector('.ui-facts > div:nth-child(2)').textContent).toContain('3 张');
    expect(game.ownedCards.find(o => o.card.id === pearl.id).safe).toBe(true);
  });
});

const settleContainer = () => vi.waitFor(() => expect(document.querySelector('.pearl-store[aria-busy="true"], .pouch-store[aria-busy="true"]')).toBeNull());
