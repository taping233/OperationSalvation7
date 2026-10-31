import { connectSdtFixture, runPendingFields } from './helpers/environment-fixtures.js';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let session, game, UI, showBackpack, bagClose;
const pearl = { id: 'tt2-pearlbox', name: '珍珠盒', type: '装备', rarity: '稀有' };
const wood = { id: 'pearl-ui-wood', name: '木材卡', type: '资源', rarity: '稀有' };
const food = { id: 'pearl-ui-food', name: '口粮卡', type: '资源', rarity: '稀有' };
const copies = (card, count, flags = {}) => Array.from({ length: count }, (_, n) => ({ uid: `${card.id}-${n}`, card, ...flags }));
const button = (action, name) => [...document.querySelectorAll(`button[data-act="${action}"]`)].find(b => !name || b.dataset.name === name);
function open() {
  showBackpack(true);
  UI._acts.inspectStack({ name: pearl.name, safe: '0' });
  UI._acts.pearlStoreZoom();
}

beforeAll(async () => {
  document.body.innerHTML = readFileSync('game/index.html', 'utf8');
  await connectSdtFixture({ Icons: { img: () => '', rich: String, TYPE_ART: {} },
    Sound: { music() {}, sfx: vi.fn(), setDucked() {} }, FX: { feedback() {} } });
  await import('../game/src/cards/cards.js');
  await import('../game/src/ui/ui.js');
  await import('../game/src/hub/base.js');
  session = await import('../game/src/run/game.session.js');
  ({ showBackpack } = await import('../game/src/hub/game.bag.js'));
  game = session.game; UI = window.SDT.UI;
  UI.init(); UI.log = vi.fn(); UI.refresh = () => {};
  window.SDT.Cards.cardHTML = card => `<div class="hs-card sm"><span>${card.name}</span><div tabindex="0">长规则</div></div>`;
  window.SDT.Cards.cardBackHTML = () => '';
  vi.spyOn(window.SDT.Base, 'bagCap').mockReturnValue(16);
  window.SDT.Chests = { isOpen: () => false };
  session._set_active_slot(null);
  bagClose = UI._bagCloseHook;
});
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(game, { seed: 'pearl-ui-run', discoveredPairs: new Set(), runActive: true, state: 'idle', myClass: '战士', inventory: [],
    ownedCards: [...copies(pearl, 1), ...copies(wood, 2), ...copies(food, 1, { stored: 1 })],
    ...runPendingFields() });
  UI.beginRoom(); open();
});
afterEach(() => {
  UI._bagCloseHook = bagClose;
  UI.hideOverlay({ immediate: true }); UI.endRoom();
});

describe('珍珠盒可读存取界面', () => {
  it('真实容量和存入守卫读取结构声明，改写卡文不改变规则', async () => {
    const box = game.ownedCards.find(entry => entry.card.id === pearl.id);
    box.card = { ...pearl, desc:'任意展示文字', rules:{ version:1, equip:{ container:{ slots:2, accepts:'资源' } } } };
    open();
    expect(session.bagCap()).toBe(18);
    const before = JSON.stringify(game.ownedCards);
    await UI._acts.pearlPut({ ...button('pearlPut', wood.name).dataset });
    expect(JSON.stringify(game.ownedCards)).toBe(before);
    expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('1/2'), 'warn');
  });
  it('复用远征决策壳和bag模式，不再继承room全屏居中壳', () => {
    expect(UI._lastMode).toBe('bag');
    expect(UI.el.ovBody.querySelector('.battle-decision.pearl-store')).not.toBeNull();
    expect(UI.el.ovBody.parentElement.classList.contains('room')).toBe(false);
    expect(UI.el.ovBody.parentElement.classList.contains('bag-modal')).toBe(true);
    expect(UI.el.ovBody.querySelectorAll('.pearl-store-columns > section')).toHaveLength(2);
    expect(UI.el.ovBody.querySelector('.battle-decision-actions [data-act="pearlBack"]')).not.toBeNull();
  });

  it('存取是带卡名/张数/整叠动作的原生按钮，卡面内部没有嵌套焦点', () => {
    for (const [action, name, count, text] of [['pearlPut', wood.name, 2, '整叠存入珍珠盒'], ['pearlTake', food.name, 1, '整叠取出回背包']]) {
      const target = button(action, name);
      expect(target).toBeInstanceOf(HTMLButtonElement);
      expect(target.type).toBe('button'); expect(target.tabIndex).toBe(0);
      expect(target.getAttribute('aria-label')).toBe(`${name}，${count} 张，${text}`);
      expect(target.textContent).toContain(text.slice(0, 4));
      expect(target.querySelector('[tabindex]')).toBeNull();
      expect(target.querySelector('.pearl-store-art').getAttribute('aria-hidden')).toBe('true');
    }
    expect(button('pearlTake').title).not.toContain('一个空背包格');
  });

  it('正常按钮存取整叠，盒中计数更新且安全格保护与UID原样保留', async () => {
    // 构造已在安全格的标记，确认存取展示和回调不会改变现有保护归属。
    game.ownedCards.find(o => o.card.id === pearl.id).safe = true;
    showBackpack(true); UI._acts.bagZone({ zone:'safe' });
    UI._acts.inspectStack({ name:pearl.name, safe:'1' }); UI._acts.pearlStoreZoom();
    const before = game.ownedCards.map(o => o.uid);
    button('pearlPut', wood.name).click(); await settleContainer();
    expect(game.ownedCards.filter(o => o.card.id === wood.id && o.stored)).toHaveLength(2);
    expect(document.querySelector('.pearl-store [role="status"]').textContent.replace(/\s/g, '')).toContain('3/9');
    button('pearlTake', wood.name).click(); await settleContainer();
    expect(game.ownedCards.filter(o => o.card.id === wood.id && o.stored)).toHaveLength(0);
    expect(document.querySelector('.pearl-store [role="status"]').textContent.replace(/\s/g, '')).toContain('1/9');
    expect(game.ownedCards.map(o => o.uid)).toEqual(before);
    expect(game.ownedCards.find(o => o.card.id === pearl.id).safe).toBe(true);
  });

  it('最后一张同方向按钮消失后焦点回返回键，不跳到相反存取动作', async () => {
    const put = button('pearlPut', wood.name); put.focus(); put.click(); await settleContainer();
    expect(document.activeElement).toBe(button('pearlBack'));
    expect(document.activeElement.dataset.act).not.toBe('pearlTake');
  });

  it('同方向仍有候选时重绘维持存取区域的原生焦点', async () => {
    game.ownedCards.push(...copies({ ...food, id: 'extra-food', name: '额外口粮卡' }, 1));
    open(); const put = button('pearlPut', wood.name); put.focus(); put.click(); await settleContainer();
    expect(document.activeElement.dataset.act).toBe('pearlPut');
    expect(document.activeElement.dataset.name).toBe('额外口粮卡');
  });

  it('盒容量不足仍整叠拒收，按钮不改卡与焦点', async () => {
    game.ownedCards = [...copies(pearl, 1), ...copies(food, 8, { stored: 1 }), ...copies(wood, 2)]; open();
    const target = button('pearlPut', wood.name), before = JSON.stringify(game.ownedCards), focus = button('pearlBack');
    expect(target.disabled).toBe(true);
    expect(target.getAttribute('aria-label')).toContain('剩余 1 张空间，放不下整叠');
    expect(target.closest('.container-store-slot').querySelector('.container-store-blocked').textContent).toBe('剩余 1 张空间，放不下整叠');
    focus.focus(); UI.log.mockClear(); target.click(); await settleContainer();
    expect(JSON.stringify(game.ownedCards)).toBe(before);
    expect(document.activeElement).toBe(focus); expect(UI.log).not.toHaveBeenCalled();
    // 绕过禁用按钮调用当前动作时，执行层仍须拒绝整叠。
    await UI._acts.pearlPut({ ...target.dataset });
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(document.activeElement).toBe(focus);
    expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('珍珠盒放不下'), 'warn');
  });

  it('背包空间不足仍拒绝整叠取出，不受新布局影响', async () => {
    game.ownedCards = [...copies(pearl, 1), ...copies(wood, 9, { stored: 1 }), ...copies(food, 69)]; open();
    expect(session.usedSlots()).toBe(24); expect(session.bagCap()).toBe(25);
    const before = JSON.stringify(game.ownedCards), target = button('pearlTake', wood.name), focus = button('pearlBack');
    expect(target.disabled).toBe(true);
    expect(target.closest('.container-store-slot').querySelector('.container-store-blocked').textContent).toBe('背包空间不足，整叠需 3 格');
    focus.focus(); UI.log.mockClear(); target.click(); await settleContainer();
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(document.activeElement).toBe(focus);
    expect(UI.log).not.toHaveBeenCalled();
    await UI._acts.pearlTake({ name:wood.name });
    expect(JSON.stringify(game.ownedCards)).toBe(before);
    expect(session.usedSlots()).toBe(24); expect(document.activeElement).toBe(focus);
    expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('背包放不下'), 'warn');
  });

  it('Esc准确探测返回按钮，只回背包；旧回调不能再存取或抢新页面', () => {
    const put = UI._acts.pearlPut, take = UI._acts.pearlTake, back = UI._acts.pearlBack;
    const close = UI._bagCloseHook = vi.fn();
    expect(UI._findCancelBtn()).toBe(button('pearlBack'));
    expect(UI.closeTopOverlayByEsc()).toBe(true);
    expect(close).not.toHaveBeenCalled(); expect(game.runActive).toBe(true); expect(game.state).toBe('modal');
    expect(document.querySelector('.bag-view')).not.toBeNull();
    const body = UI.el.ovBody.firstElementChild, before = JSON.stringify(game.ownedCards);
    put({ name: wood.name }); take({ name: food.name }); back();
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(UI.el.ovBody.firstElementChild).toBe(body);
    open(); const current = UI.el.ovBody.firstElementChild;
    put({ name: wood.name }); take({ name: food.name }); back();
    expect(JSON.stringify(game.ownedCards)).toBe(before); expect(UI.el.ovBody.firstElementChild).toBe(current);
  });

  it('CSS只加珍珠盒域，说明和控件沿1920逻辑坐标可读，内容保留共享滚动区', () => {
    const css = postcss.parse(readFileSync('game/css/container-store.css', 'utf8'));
    const values = selector => {
      const result = {}; css.walkRules(selector, rule => {
        if(rule.parent.selector === '#overlay .collection-workspace[data-collection-variant="container"]') rule.walkDecls(d => { result[d.prop] = d.value; });
      }); return result;
    };
    const scope = '&';
    expect(values(`${scope} .collection-columns`)['grid-template-columns']).toBe('repeat(2,minmax(0,1fr))');
    expect(values(`${scope} .battle-decision-summary .ov-note`)['font-size']).toBe('var(--card-copy-size,24px)');
    expect(parseFloat(values(`${scope} .pearl-store-hint`)['font-size']) * 1188 / 1920).toBeGreaterThanOrEqual(13);
    const tokens = postcss.parse(readFileSync('game/css/secondary-ui-tokens.css','utf8'));
    let controlHeight;tokens.walkDecls('--ui-control-height',decl=>{controlHeight=decl.value;});
    expect(values(`${scope} .battle-decision-actions .ov-btn`)['min-height']).toBe('var(--ui-control-height)');
    expect(parseFloat(controlHeight) * 1188 / 1920).toBeGreaterThanOrEqual(36);
    expect(values(`${scope} .pearl-store-card`).width).toBe('300px');
    expect(parseFloat(values(`${scope} .pearl-store-card`).width) * 1188 / 1920).toBeGreaterThan(160);
    expect(document.querySelector('.pearl-store-columns').classList.contains('battle-decision-content')).toBe(true);
  });
});

const settleContainer = () => vi.waitFor(() => expect(document.querySelector('.pearl-store[aria-busy="true"], .pouch-store[aria-busy="true"]')).toBeNull());
