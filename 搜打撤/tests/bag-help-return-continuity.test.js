import { connectSdtFixture } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const H = vi.hoisted(() => ({ game: {}, save: vi.fn(), uid: 0 }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { items: {} }, game: H.game, bagCap: () => 16, safeCap: () => 6, newUid: () => `new-${++H.uid}`, safeUsed: () => 0, usedSlots: () => 0, saveGame: H.save,
  cardStacks: safe => {
    const stacks = new Map(); for (const owned of H.game.ownedCards.filter(item => !!item.safe === !!safe && !item.stored)) {
      const name = owned.card.name; if (!stacks.has(name)) stacks.set(name, { card: owned.card, count: 0, uids: [] });
      stacks.get(name).count++; stacks.get(name).uids.push(owned.uid);
    } return [...stacks.values()];
  },
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen: vi.fn() }));
vi.mock('../game/src/hub/game.bag.settle.js', () => ({ bindBagMixins: vi.fn(), resumeBattleRewards: vi.fn() }));
const potion = { id: 'potion', name: '药剂', type: '道具', desc: '回复 3 点生命' };
const spell = { id: 'spell', name: '法术', type: '法术' };
const resource = { id: 'wood', name: '木材卡', type: '资源' };
let bag, drag, ui, frames, leave, guide;
beforeEach(async () => {
  vi.resetModules(); H.save.mockReset();
  Object.assign(H.game, { seed:'run-1', discoveredPairs:new Set(), runActive:true, nestActive:false, state:'idle', myClass:'法师', battleActive:false,
    inventory:[], ownedCards:[{ uid:'potion', card:potion }, { uid:'spell', card:spell }, { uid:'wood', card:resource }],
    usedPocket:[], cardOrder:[], hp:10, maxHp:30, coins:0, fragments:0 });
  document.body.innerHTML = '<main id="viewport"><div id="overlay" tabindex="-1" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  await connectSdtFixture({ game:H.game, Base:{slot:1, bagCap:() => 16}, Icons:{rich:markup => markup}, Sound:{sfx:vi.fn()}, Cards:{SHA:{id:'starter',name:'攻击'}, cardHTML:card => `<span>${card.name}</span>`, cardBackHTML:() => ''} });
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  ui = { ...overlayMethods, _overlayInerted:[], _acts:{},
    el:Object.fromEntries(['overlay','ovTitle','ovBody','viewport'].map(id => [id, document.getElementById(id)])),
    act(name, fn) { this._acts[name] = fn; }, log:vi.fn(), refresh:vi.fn() };
  window.SDT.UI = ui;
  ui.el.ovBody.addEventListener('click', event => { const button = event.target.closest('[data-act]'); if (button && !button.disabled) ui._acts[button.dataset.act]?.(button.dataset); });
  // Synthetic key delivery into the real shared Escape dismissal method.
  ui.el.overlay.addEventListener('keydown', event => { if (event.key === 'Escape') ui.closeTopOverlayByEsc(); });
  frames = []; vi.stubGlobal('requestAnimationFrame', fn => { frames.push(fn); return frames.length; }); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  bag = await import('../game/src/hub/game.bag.js'); drag = await import('../game/src/hub/game.bag.drag.js');
  const { createMenuGuidePages } = await import('../game/src/ui/menu-guide.js');
  const { createMenuLeaveFlow } = await import('../game/src/ui/menu-leave.js');
  guide = createMenuGuidePages({ UI:ui, game:H.game, document, readBattle:()=>null });
  leave = createMenuLeaveFlow({ UI:ui, game:H.game, document, runtime:{}, esc:String,
    getActiveSlot:()=>window.SDT.Base.slot, openGuide:guide.openTitleGuide,
    readCards:()=>window.SDT.Cards, readSound:()=>window.SDT.Sound, readAgent:()=>null });
  bag.showBackpack(true); flushFrames();
});
afterEach(() => { drag?.resetBagDrag(); ui?._restoreOverlayBackground(); document.body.replaceChildren(); vi.unstubAllGlobals(); });
function flushFrames() { const queued = frames.splice(0); queued.forEach(fn => fn()); }
function click(selector) { document.querySelector(selector).click(); }
function openHelp(scroll = 217) {
  document.querySelector('.bag-board').scrollTop = scroll;
  (document.querySelector('[data-act="bagSortCycle"]') || document.querySelector('.bag-rz[aria-pressed="true"]')).focus();
  leave.openLeaveMenu(); click('[data-act="leaveGuide"]'); flushFrames();
}
async function returnFromGuide(method='button') {
  if(method==='button')click('[data-act="guideBack"]');
  else document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  await ui._acts.leaveCancel(); flushFrames();
}

describe('真实背包与帮助模块的合成交互连续性（非浏览器实页）', () => {
  it.each(['button', 'Escape'])('%s 经系统菜单指南返回保留分类排序、滚动与原控件焦点', async method => {
    click('[data-act="bagFilter"][data-f="move"]');
    click('[data-act="bagSortCycle"]');
    const selected = document.querySelector('[data-act="bagFilter"].on').dataset.f;
    const sort = document.querySelector('[data-act="bagSortCycle"]').textContent;
    const cards = H.game.ownedCards;
    openHelp();
    expect(document.querySelector('.beginner-guide')).not.toBeNull();
    expect(document.querySelector('[data-act="guideBack"]').dataset.cancel).toBe('true');
    await returnFromGuide(method);
    expect(document.querySelector('.bag-board').scrollTop).toBe(217);
    expect(document.activeElement).toBe(document.querySelector('[data-act="bagSortCycle"]'));
    expect(document.querySelector('[data-act="bagFilter"].on').dataset.f).toBe(selected);
    expect(document.querySelector('[data-act="bagSortCycle"]').textContent).toBe(sort);
    expect(H.game.ownedCards).toBe(cards);
    openHelp(349); await returnFromGuide();
    expect(document.querySelector('.bag-board').scrollTop).toBe(349);
    expect(document.activeElement.dataset.act).toBe('bagSortCycle');
  });
  it.each(['safe', 'pocket'])('%s 分区经指南往返保持分区与滚动，不跳回主背包', async zone => {
    click(`.bag-rz[data-zone="${zone}"]`); flushFrames();
    openHelp(123); await returnFromGuide();
    expect(document.querySelector('.bag-grid').dataset.zone).toBe(zone);
    expect(document.querySelector('.bag-board').scrollTop).toBe(123);
    expect(document.activeElement.dataset.act).toBe('bagZone');
    expect(document.activeElement.dataset.zone).toBe(zone);
  });
  it.each(['run', 'slot', 'new-page'])('旧指南返回在 %s 变化后不能回跳或抢焦点', change => {
    openHelp(); const oldBack = ui._acts.guideBack;
    if (change === 'run') H.game.discoveredPairs = new Set();
    if (change === 'slot') window.SDT.Base.slot = 2;
    if (change === 'new-page') ui.showOverlay('新页', '<button id="newPage">继续</button>');
    const current = ui.el.ovBody.firstElementChild;
    const focus = document.activeElement;
    oldBack();
    expect(ui.el.ovBody.firstElementChild).toBe(current);
    expect(document.activeElement).toBe(focus);
    expect(document.querySelector('.bag-view')).toBeNull();
  });
  it('指南返回系统菜单后，旧背包来源拒绝替换的库存实例', async () => {
    openHelp(); const cards = [...H.game.ownedCards]; H.game.ownedCards = cards;
    click('[data-act="guideBack"]'); const menu = ui.el.ovBody.firstElementChild;
    expect(menu.matches('[data-leave-step]')).toBe(true);
    await ui._acts.leaveCancel(); flushFrames();
    expect(ui.el.ovBody.firstElementChild).toBe(menu);
    expect(document.querySelector('.bag-view')).toBeNull();
    expect(H.game.ownedCards).toBe(cards); expect(H.save).not.toHaveBeenCalled();
  });
  it('没有来源的独立指南返回关闭页面，不修改背包', async () => {
    const cards=H.game.ownedCards; guide.openTitleGuide();
    click('[data-act="guideBack"]');
    await vi.waitFor(()=>expect(ui.el.overlay.hidden).toBe(true));
    expect(H.game.ownedCards).toBe(cards); expect(H.game.state).toBe('idle');
  });
});


describe('背包关闭重开浏览连续性', () => {
  it.each(['bag', 'safe', 'pocket'])('%s 关闭重开保留列表位置与焦点，延后聚焦不覆盖', zone => {
    click(`.bag-rz[data-zone="${zone}"]`);
    if (zone === 'bag') click('[data-act="bagFilter"][data-f="move"]');
    const board = document.querySelector('.bag-board'); board.scrollTop = 217; board.scrollLeft = 19;
    const target = document.querySelector(zone === 'bag' ? '[data-stack="法术"]' : `.bag-rz[data-zone="${zone}"]`);
    target.focus(); bag.showBackpack(); flushFrames();
    bag.showBackpack(); flushFrames();
    expect(document.querySelector('.bag-board').scrollTop).toBe(217);
    expect(document.querySelector('.bag-board').scrollLeft).toBe(19);
    expect(document.querySelector('.bag-grid').dataset.zone).toBe(zone);
    expect(document.activeElement.dataset.act).toBe(target.dataset.act);
    if (zone === 'bag') {
      expect(document.activeElement.dataset.stack).toBe('法术');
      expect(document.querySelector('[data-act="bagFilter"].on').dataset.f).toBe('move');
    }
  });
  it.each(['run', 'cards', 'section'])('%s 变化不恢复旧列表位置', change => {
    document.querySelector('.bag-board').scrollTop = 217;
    document.querySelector('[data-stack="法术"]').focus(); bag.showBackpack(); flushFrames();
    if (change === 'run') H.game.discoveredPairs = new Set();
    if (change === 'cards') H.game.ownedCards = [...H.game.ownedCards];
    if (change === 'section') bag.showBackpackSection('pocket'); else bag.showBackpack();
    flushFrames();
    expect(document.querySelector('.bag-board').scrollTop).toBe(0);
    expect(document.activeElement.dataset.stack).not.toBe('法术');
  });
});


it.each(['safe', 'pocket'])('%s 分区按钮关闭重开仍聚焦原分区按钮', zone => {
  click(`.bag-rz[data-zone="${zone}"]`);
  document.querySelector(`.bag-rz[data-zone="${zone}"]`).focus();
  bag.showBackpack(); flushFrames(); bag.showBackpack(); flushFrames();
  expect(document.activeElement.dataset.zone).toBe(zone);
});

it('关闭按钮重开后恢复关闭按钮焦点，关闭返回来源仍只调用一次', async () => {
  await ui._acts.closeBag();
  const back = vi.fn(() => { H.game.state = 'idle'; ui.showOverlay('来源', '<main>来源</main>'); });
  ui.showOverlay('来源', '<main>来源</main>');
  bag.setBagReturnHook(back);
  bag.showBackpack(); flushFrames();
  document.querySelector('.bag-board').scrollTop = 157;
  document.querySelector('[data-act="closeBag"]').focus();
  await ui._acts.closeBag(); flushFrames();
  expect(back).toHaveBeenCalledTimes(1);
  bag.showBackpack(); flushFrames();
  expect(document.querySelector('.bag-board').scrollTop).toBe(157);
  expect(document.activeElement.dataset.act).toBe('closeBag');
  click('[data-act="closeBag"]'); expect(back).toHaveBeenCalledTimes(1);
});
