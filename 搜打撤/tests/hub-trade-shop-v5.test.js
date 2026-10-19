// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreHubFocus } from '../game/src/hub/hub.presentation.js';
import { departureStackKey } from '../game/src/hub/base-departure.commands.js';
import { bindTradeShopV5, createTradeShopState, tradeShopV5HTML } from '../game/src/hub/hub.trade-shop-v5.js';

const cheap = { id: 'cheap', name: '普通卡', type: '武术', rarity: '古朴', value: 2, desc: '造成伤害。' };
const rare = { id: 'rare', name: '珍贵卡', type: '法术', rarity: '稀有', value: 6, desc: '恢复生命。' };
const collected = { id: 'collected', name: '收藏卡', type: '装备', value: 8 };
const wood = { id: 'tt-wood', name: '木材', type: '资源' };
const rations = { id: 'tt-rations', name: '口粮', type: '资源' };
const goods = [
  { id: 'cheap', price: 6, tip: '基础招式' }, { id: 'rare', price: 6 },
  { material: 'wood', name: '木材', price: 4 }, { material: 'rations', name: '口粮', price: 4 },
];
let base, cards, ui, state, host, dispose, render, notice, sound, preview, protectedIds;

beforeEach(() => {
  vi.useFakeTimers();
  protectedIds = new Set(['collected']);
  base = {
    slot: 1, PET_EGG_ID: 'egg',
    data: { coins: 20, wood: 1, rations: 0, stash: [
      { card: cheap, count: 3 }, { card: rare, count: 2 }, { card: collected, count: 1 },
      { card: wood, count: 1 }, { card: { id: 'egg', name: '宠物蛋' }, count: 1 },
      { card: { id: 'tt-econpack', name: '经济卡包' }, count: 1 },
    ] },
    stashRoom: vi.fn(() => 3), isCollected: card => protectedIds.has(card.id),
    materialInfo: card => card.id === wood.id ? { kind: 'wood' } : null,
    purchase: vi.fn(input => {
      base.data.coins -= input.price;
      if (input.material) base.data[input.material]++;
      else { const stack = base.data.stash.find(item => item.card.id === input.card.id); if (stack) stack.count++; else base.data.stash.push({ card: input.card, count: 1 }); }
      return { ok: true };
    }),
    sellStashCards: vi.fn((name, count, key) => {
      const stack = base.data.stash.find(item => item.card.name === name && (key === undefined || departureStackKey(item) === key));
      if (!stack || protectedIds.has(stack.card.id)) return { ok: false, why: 'collected' };
      const coins = stack.card.value * count;
      stack.count -= count; base.data.stash = base.data.stash.filter(item => item.count > 0); base.data.coins += coins;
      return { ok: true, qty: count, coins };
    }),
  };
  cards = { all: () => [cheap, rare, collected, wood, rations], sellPrice: card => card.value || 1,
    cardHTML: card => `<article class="hs-card">${card.name}</article>`,
    isSellable: vi.fn(() => { throw new Error('局内规则不用于基地交易'); }) };
  ui = { _acts: {}, act: (name, handler) => { ui._acts[name] = handler; }, log: vi.fn() };
  state = createTradeShopState(); notice = vi.fn(); sound = { tick: vi.fn(), ding: vi.fn() }; preview = vi.fn();
  host = document.createElement('main'); document.body.append(host);
  host.addEventListener('click', event => { const button = event.target.closest('[data-act]'); if (button && !button.disabled) ui._acts[button.dataset.act]?.(button.dataset); });
  render = vi.fn(() => {
    dispose?.();
    host.innerHTML = tradeShopV5HTML({ base, cards, goods, state, art: { cardIcon: card => `<img src="${card.id}.webp" alt="${card.name}">` } });
    dispose = bindTradeShopV5({ root: host.firstElementChild, base, cards, goods, state, ui, render, notice, sound, preview });
  });
  render();
});
afterEach(() => { dispose?.(); document.body.replaceChildren(); vi.useRealTimers(); });
const button = action => host.querySelector(`[data-act="${action}"]`);
const click = action => button(action).click();
const sellMode = () => ui._acts.tradeShopMode({ mode: 'sell' });
const selectStack = name => [...host.querySelectorAll('[data-act="tradeShopSelectStack"]')].find(item => item.textContent.includes(name)).click();
const selectGood = key => ui._acts.tradeShopSelectGood({ key });
const stashCount = id => base.data.stash.find(stack => stack.card.id === id)?.count || 0;

describe('独立交易所的现行经济与同页交易台', () => {
  it('卡牌详情使用现行牌效，陈旧商品提示不能覆盖规则；物资保留用途提示', () => {
    expect(host.querySelector('.trade-v5-description').textContent).toBe(cheap.desc);
    const supplies = goods.map(good => good.material === 'wood' ? { ...good, tip:'基地物资 +1 · 扩建背包与仓库' } : good);
    state.goodKey = 'wood';
    host.innerHTML = tradeShopV5HTML({ base, cards, goods:supplies, state });
    expect(host.querySelector('.trade-v5-description').textContent).toBe('基地物资 +1 · 扩建背包与仓库');
  });

  it('浏览与切换只改变界面选择，购入一次仍走 Base 原命令', () => {
    const before = structuredClone(base.data);
    selectGood('rare'); sellMode(); selectStack('普通卡');
    expect(base.data).toEqual(before);
    ui._acts.tradeShopMode({ mode: 'buy' });
    expect(host.querySelector('.trade-v5-desk h3').textContent).toBe('珍贵卡');
    click('tradeShopBuy');
    expect(base.purchase).toHaveBeenCalledExactlyOnceWith({ price: 6, material: undefined, card: rare });
    expect(base.data.coins).toBe(14); expect(stashCount(rare.id)).toBe(3);
    expect(notice).toHaveBeenLastCalledWith('购入珍贵卡 ×1 · 储备 −6 币');
    expect(cards.isSellable).not.toHaveBeenCalled();
  });

  it('缺币与满仓明确阻止买卡，物资直入储备不受仓库容量影响', () => {
    base.data.coins = 3; base.stashRoom.mockReturnValue(0); render();
    expect(button('tradeShopBuy').disabled).toBe(true);
    expect(host.querySelector('.trade-v5-shortfall').textContent).toBe('还需 3 储备币 · 仓库已满');
    ui._acts.tradeShopBuy(); expect(base.purchase).not.toHaveBeenCalled();
    base.data.coins = 10; selectGood('wood');
    expect(button('tradeShopBuy').disabled).toBe(false);
    expect(host.querySelector('.trade-v5-capacity')).toBeNull();
    click('tradeShopBuy');
    expect(base.purchase).toHaveBeenCalledExactlyOnceWith({ price: 4, material: 'wood', card: null });
    expect(base.data.wood).toBe(2); expect(stashCount(wood.id)).toBe(1);
  });

  it('材料、蛋和卡包不进入出售列表，收藏卡保留只读保护状态', () => {
    sellMode();
    const text = host.querySelector('.trade-v5-list').textContent;
    expect(text).not.toContain('木材'); expect(text).not.toContain('宠物蛋'); expect(text).not.toContain('经济卡包');
    expect(host.querySelectorAll('[data-act="tradeShopSelectStack"]')).toHaveLength(3);
    selectStack('收藏卡');
    expect(host.querySelector('.trade-v5-protection').textContent).toBe('收藏卡牌受保护');
    expect(button('tradeShopSellOne').disabled).toBe(true);
    ui._acts.tradeShopSellOne(); expect(base.sellStashCards).not.toHaveBeenCalled();
    expect(protectedIds.has(collected.id)).toBe(true);
  });

  it('普通堆单张直接出售，最后一张必须二次确认', () => {
    sellMode(); click('tradeShopSellOne'); click('tradeShopSellOne');
    expect(base.sellStashCards).toHaveBeenCalledTimes(2); expect(stashCount(cheap.id)).toBe(1);
    click('tradeShopSellOne');
    expect(base.sellStashCards).toHaveBeenCalledTimes(2);
    expect(button('tradeShopSellOne').textContent).toContain('确认出售 ×1 · +2 币');
    click('tradeShopSellOne'); expect(stashCount(cheap.id)).toBe(0);
  });

  it('高价和整堆沿用 2.6 秒确认，过期后再点仍是确认', () => {
    sellMode(); selectStack('珍贵卡'); click('tradeShopSellOne');
    expect(base.sellStashCards).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2600);
    expect(button('tradeShopSellOne').dataset.confirming).toBeUndefined();
    click('tradeShopSellOne'); expect(base.sellStashCards).not.toHaveBeenCalled();
    click('tradeShopSellOne'); expect(base.sellStashCards).toHaveBeenCalledExactlyOnceWith('珍贵卡', 1, 'card:rare');
    selectStack('普通卡'); click('tradeShopSellAll');
    expect(base.sellStashCards).toHaveBeenCalledTimes(1);
    click('tradeShopSellAll'); expect(base.sellStashCards).toHaveBeenLastCalledWith('普通卡', 3, 'card:cheap');
  });

  it('更换卡堆与工作区解除旧确认，选卡不放大且不会卖错卡', () => {
    sellMode(); selectStack('珍贵卡'); click('tradeShopSellAll');
    selectStack('普通卡'); click('tradeShopSellAll');
    expect(base.sellStashCards).not.toHaveBeenCalled();
    selectStack('珍贵卡');
    expect(button('tradeShopSellAll').dataset.confirming).toBeUndefined();
    expect(preview).not.toHaveBeenCalled();
    click('tradeShopSellAll'); ui._acts.tradeShopMode({ mode: 'buy' }); sellMode(); click('tradeShopSellAll');
    expect(base.sellStashCards).not.toHaveBeenCalled();
  });

  it('整堆售空后余额、列表与交易台同步刷新到剩余卡牌', () => {
    sellMode(); click('tradeShopSellAll'); click('tradeShopSellAll');
    expect(stashCount(cheap.id)).toBe(0); expect(base.data.coins).toBe(26);
    expect(host.querySelector('.trade-v5-wallet').textContent).toContain('26');
    expect(host.querySelector('.trade-v5-desk h3').textContent).toBe('珍贵卡');
    expect([...host.querySelectorAll('[data-act="tradeShopSelectStack"]')].some(item => item.textContent.includes('普通卡'))).toBe(false);
  });

  it('确认之间库存、价格或保护变化会拒绝旧报价，先展示新状态', () => {
    sellMode(); selectStack('珍贵卡'); click('tradeShopSellAll');
    base.data.stash.find(stack => stack.card.id === rare.id).count = 1;
    click('tradeShopSellAll'); expect(base.sellStashCards).not.toHaveBeenCalled();
    expect(notice).toHaveBeenLastCalledWith('库存已变化，请重新确认', 'warn');
    expect(button('tradeShopSellAll')).toBeNull();
    click('tradeShopSellOne'); cards.sellPrice = () => 9; click('tradeShopSellOne');
    expect(base.sellStashCards).not.toHaveBeenCalled();
    expect(notice).toHaveBeenLastCalledWith('库存已变化，请重新确认', 'warn');
    click('tradeShopSellOne'); protectedIds.add(rare.id); ui._acts.tradeShopSellOne();
    expect(base.sellStashCards).not.toHaveBeenCalled(); expect(button('tradeShopSellOne').disabled).toBe(true);
  });

  it('按稳定身份重读库存，数组换序可出售但同名异卡不误卖', () => {
    sellMode(); selectStack('珍贵卡'); click('tradeShopSellOne');
    base.data.stash.reverse(); click('tradeShopSellOne');
    expect(base.sellStashCards).toHaveBeenCalledExactlyOnceWith('珍贵卡', 1, 'card:rare');
    selectStack('普通卡'); base.data.stash.unshift({ card: { ...cheap, id: 'other' }, count: 1 });
    ui._acts.tradeShopSellOne();
    expect(base.sellStashCards).toHaveBeenCalledTimes(2);
    expect(base.sellStashCards).toHaveBeenLastCalledWith('普通卡', 1, 'card:cheap');
    expect(stashCount('cheap')).toBe(2);
    expect(stashCount('other')).toBe(1);
  });

  it('购买或出售保存失败时保留完整状态并明确提示', () => {
    const before = structuredClone(base.data);
    base.purchase.mockReturnValue({ ok: false, why: 'save', msg: '写盘失败' }); click('tradeShopBuy');
    expect(base.data).toEqual(before); expect(notice).toHaveBeenLastCalledWith('写盘失败', 'warn');
    sellMode(); base.sellStashCards.mockReturnValue({ ok: false, why: 'save' }); click('tradeShopSellOne');
    expect(base.data).toEqual(before);
    expect(notice).toHaveBeenLastCalledWith('基地存档未保存，请重新载入后重试', 'warn');
    expect(host.querySelector('.trade-v5-desk h3').textContent).toBe('普通卡');
  });

  it('销毁或换档后旧动作不再成交，确认定时器随销毁移除', () => {
    sellMode(); click('tradeShopSellAll'); const staleSell = ui._acts.tradeShopSellAll;
    dispose(); expect(vi.getTimerCount()).toBe(0); staleSell();
    expect(base.sellStashCards).not.toHaveBeenCalled();
    render(); base.slot = 2; ui._acts.tradeShopSellOne();
    expect(base.sellStashCards).not.toHaveBeenCalled();
  });

  it('无出售堆显示空态，物资详情沿只读预览传递原卡与来源', () => {
    selectGood('wood');
    expect(preview).not.toHaveBeenCalled();
    expect(host.querySelector('[data-act="tradeShopPreview"]')).toBeNull();
    expect(host.querySelector('.trade-v5-art')).not.toBeNull();
    base.data.stash = []; sellMode();
    expect(host.querySelector('.trade-v5-empty h3').textContent).toBe('暂无可出售卡牌');
    expect(host.querySelector('[data-tab="stash"]')).not.toBeNull();
    expect(host.querySelector('.trade-v5-checkout')).toBeNull();
  });
});


function restoreTradeFocus(data) {
  host.id = 'hubMain';
  const page = host.firstElementChild;
  page.classList.add('hub-page'); page.dataset.view = `shop/${state.mode}`;
  restoreHubFocus(page.dataset.view, new Map([[page.dataset.view, data]]));
}

it.each(['coins', 'capacity'])('购买后%s不足禁用主按钮，焦点留在当前商品供继续浏览', reason => {
  if (reason === 'coins') base.data.coins = 6;
  render();
  button('tradeShopBuy').focus();
  if (reason === 'capacity') base.stashRoom.mockReturnValue(0);
  // The command succeeds once, then the refreshed availability changes.
  if (reason === 'capacity') base.purchase.mockImplementationOnce(input => { base.stashRoom.mockReturnValue(0); base.data.coins -= input.price; return {ok:true}; });
  if (reason === 'capacity') base.stashRoom.mockReturnValueOnce(3);
  click('tradeShopBuy');
  expect(base.purchase).toHaveBeenCalledOnce();
  expect(button('tradeShopBuy').disabled).toBe(true);
  restoreTradeFocus({ act:'tradeShopBuy' });
  expect(document.activeElement).toBe(host.querySelector('[data-act="tradeShopSelectGood"][aria-pressed="true"]'));
  expect(base.purchase).toHaveBeenCalledOnce();
});

it('最后可售卡售空后焦点回当前交易方式，切回购入可继续键盘浏览', () => {
  base.data.stash = [{ card:cheap, count:1 }]; sellMode();
  button('tradeShopSellOne').focus();
  click('tradeShopSellOne'); click('tradeShopSellOne');
  expect(base.sellStashCards).toHaveBeenCalledOnce();
  expect(button('tradeShopSellOne')).toBeNull();
  restoreTradeFocus({ act:'tradeShopSellOne' });
  expect(document.activeElement).toBe(host.querySelector('[data-act="tradeShopMode"][data-mode="sell"]'));
  ui._acts.tradeShopMode({ mode:'buy' });
  restoreTradeFocus({ act:'tradeShopMode', mode:'buy' });
  expect(document.activeElement).toBe(host.querySelector('[data-act="tradeShopMode"][data-mode="buy"]'));
});

it('主按钮仍可使用时保持原动作焦点，不转移到浏览回退项', () => {
  button('tradeShopBuy').focus(); click('tradeShopBuy');
  restoreTradeFocus({ act:'tradeShopBuy' });
  expect(document.activeElement).toBe(button('tradeShopBuy'));
});
