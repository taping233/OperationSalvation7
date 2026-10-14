// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { bindTradeShopV5, createTradeShopState, tradeShopV5HTML } from '../game/src/hub/hub.trade-shop-v5.js';

let dispose;
afterEach(() => { dispose?.(); document.body.replaceChildren(); vi.restoreAllMocks(); localStorage.clear(); });

it('selects the clicked variant stack rather than the first same-id/name stack', () => {
  const card = { id: 'same-card', name: '同名卡', type: '武术', rarity: '古朴', desc: '第一堆' };
  const base = {
    slot: 1, PET_EGG_ID: 'egg',
    data: { coins: 0, stash: [
      { card, variantKey: 'first', count: 9 },
      { card: { ...card, desc: '第二堆' }, variantKey: 'second', count: 2 },
    ] },
    isCollected: () => false, materialInfo: () => null, stashRoom: () => 10,
    sellStashCards: vi.fn(),
  };
  const cards = { all: () => [], sellPrice: () => 1, cardHTML: c => `<span>${c.desc}</span>` };
  const ui = { _acts: {}, act(name, fn) { this._acts[name] = fn; } };
  const state = { ...createTradeShopState(), mode: 'sell' };
  const host = document.createElement('main'); document.body.append(host);
  host.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button) ui._acts[button.dataset.act]?.(button.dataset);
  });
  const render = () => {
    dispose?.();
    host.innerHTML = tradeShopV5HTML({ base, cards, goods: [], state });
    dispose = bindTradeShopV5({ root: host.firstElementChild, base, cards, goods: [], state,
      ui, render, notice: vi.fn(), sound: {} });
  };
  render();
  const choices = host.querySelectorAll('[data-act="tradeShopSelectStack"]');
  choices[1].click();
  expect(host.querySelector('.trade-v5-description').textContent).toBe('第二堆');
  expect(host.querySelector('.trade-v5-owned b').textContent).toBe('2');
  expect(host.querySelectorAll('[data-act="tradeShopSelectStack"][aria-pressed="true"]')).toHaveLength(1);
});

async function realBase() {
  const { RULES } = await import('../game/src/core/rules.js');
  await import('../game/src/hub/base.js');
  const Base = window.SDT.Base;
  localStorage.clear();
  window.SDT.MAP = { rules: RULES };
  window.SDT.UI = { log: vi.fn() };
  window.SDT.Sound = { sfx: vi.fn() };
  window.SDT.Cards = { sellPrice: card => card.value || 1 };
  Base.use(1);
  Object.assign(Base.data, { coins: 0, collection: {}, stash: [
    { card: { id: 'same-card', name: '同名卡', type: '武术', value: 1 }, variantKey: 'first', count: 9 },
    { card: { id: 'same-card', name: '同名卡', type: '武术', value: 4 }, variantKey: 'second', count: 2 },
  ] });
  expect(Base.save()).toBe(true);
  return Base;
}

it('sells the explicitly identified second stack and retains the first stack', async () => {
  const Base = await realBase();
  expect(Base.sellStashCards('同名卡', 1, 'card:same-card:second')).toMatchObject({ ok: true, qty: 1, coins: 4 });
  expect(Base.data.stash.map(stack => stack.count)).toEqual([9, 1]);
});

it('rejects stale or ambiguous explicit identity without falling back to the same name', async () => {
  const Base = await realBase();
  const before = structuredClone(Base.data);
  expect(Base.sellStashCards('同名卡', 1, 'card:missing')).toMatchObject({ ok: false });
  expect(Base.data).toEqual(before);
  Base.data.stash.push(structuredClone(Base.data.stash[1]));
  expect(Base.save()).toBe(true);
  const ambiguous = structuredClone(Base.data);
  expect(Base.sellStashCards('同名卡', 1, 'card:same-card:second')).toMatchObject({ ok: false });
  expect(Base.data).toEqual(ambiguous);
});

it('keeps legacy name calls compatible and refuses an explicit key paired with another name', async () => {
  const Base = await realBase();
  expect(Base.sellStashCards('别的名称', 1, 'card:same-card:second')).toMatchObject({ ok: false });
  expect(Base.sellStashCards('同名卡', 1)).toMatchObject({ ok: true, coins: 1 });
  expect(Base.data.stash.map(stack => stack.count)).toEqual([8, 2]);
});

it('rolls back an explicit sale on storage failure and preserves collection protection', async () => {
  const Base = await realBase();
  const before = structuredClone(Base.data), raw = localStorage.getItem(Base.SLOT_KEY(1));
  const original = Storage.prototype.setItem;
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === Base.SLOT_KEY(1)) throw new Error('quota fixture');
    return original.call(this, key, value);
  });
  expect(Base.sellStashCards('同名卡', 2, 'card:same-card:second')).toMatchObject({ ok: false, why: 'save' });
  expect(Base.data).toEqual(before);
  expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(raw);
  spy.mockRestore();
  Base.data.collection['same-card'] = { name: '同名卡' };
  expect(Base.save()).toBe(true);
  expect(Base.sellStashCards('同名卡', 1, 'card:same-card:second')).toMatchObject({ ok: false, why: 'collected' });
  expect(Base.data.stash.map(stack => stack.count)).toEqual([9, 2]);
});

it('passes the selected variant identity from actual shop buttons into the real Base transaction', async () => {
  const base = await realBase();
  const cards = { all: () => base.data.stash.map(stack => stack.card), sellPrice: c => c.value,
    cardHTML: c => `<span>${c.name}</span>` };
  const ui = { _acts: {}, act(name, fn) { this._acts[name] = fn; } };
  const state = { ...createTradeShopState(), mode: 'sell' };
  const host = document.createElement('main'); document.body.append(host);
  host.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled) ui._acts[button.dataset.act]?.(button.dataset);
  });
  const render = () => {
    dispose?.();
    host.innerHTML = tradeShopV5HTML({ base, cards, goods: [], state });
    dispose = bindTradeShopV5({ root: host.firstElementChild, base, cards, goods: [], state,
      ui, render, notice: vi.fn(), sound: {} });
  };
  render();
  host.querySelectorAll('[data-act="tradeShopSelectStack"]')[1].click();
  host.querySelector('[data-act="tradeShopSellAll"]').click();
  expect(base.data.stash.map(stack => stack.count)).toEqual([9, 2]);
  host.querySelector('[data-act="tradeShopSellAll"]').click();
  expect(base.data.stash).toHaveLength(1);
  expect(base.data.stash[0].variantKey).toBe('first');
  expect(base.data.stash[0].count).toBe(9);
  expect(base.data.coins).toBe(8);
  expect(JSON.parse(localStorage.getItem(base.SLOT_KEY(1))).coins).toBe(8);
});
