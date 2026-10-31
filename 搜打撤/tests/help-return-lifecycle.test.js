import { connectSdtFixture } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureOverlayReturnState, restoreOverlayReturnState, createOverlayReturn } from '../game/src/ui/overlay-return-state.js';
let UI, frames, game, controller, guide, leave;
function flush() { frames.splice(0).forEach(fn => fn()); }
function click(action) { UI.el.ovBody.querySelector(`[data-act="${action}"]`).click(); }
beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = '<main id="viewport"><div id="overlay" tabindex="-1" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  game = {seed:7,discoveredPairs:new Set(),runActive:true,state:'idle', coins:10, ownedCards:[{uid:'coin', card:{id:'coin', name:'金币', sellable:true, value:2}}],
    shopStocks:{one:[{card:{id:'potion', name:'药剂'},price:2,sold:false}]}};
  await connectSdtFixture({ game, Base: {slot:1}, Icons: {rich: html => html}, Sound: {sfx:vi.fn()}, Cards: {isSellable: c => !!c.sellable, sellPrice: c => c.value || 0} });
  const {overlayMethods} = await import('../game/src/ui/overlay.js');
  UI = {...overlayMethods, _acts:{}, _overlayInerted:[],
    el:Object.fromEntries(['viewport','overlay','ovTitle','ovBody'].map(id => [id, document.getElementById(id)])),
    act(name, fn) { this._acts[name] = fn; }, refresh:vi.fn(), log:vi.fn()};
  window.SDT.UI = UI;
  UI.el.ovBody.addEventListener('click', event => { const button = event.target.closest('[data-act]'); if (button) UI._acts[button.dataset.act]?.(button.dataset); });
  frames = []; vi.stubGlobal('requestAnimationFrame', fn => frames.push(fn));
  const { createShopController } = await import('../game/src/run/game.run.shop.js');
  controller = createShopController({UI, SDT:window.SDT, game, saveGame:vi.fn(), bagCap:()=>16,
    cardHTML:card=>`<span>${card.name}</span>`, newUid:()=> 'new', usedSlots:()=>1, setCardPageOpen:vi.fn()});
  const { createMenuGuidePages } = await import('../game/src/ui/menu-guide.js');
  const { createMenuLeaveFlow } = await import('../game/src/ui/menu-leave.js');
  guide = createMenuGuidePages({UI,game,document,readBattle:()=>null});
  leave = createMenuLeaveFlow({UI,game,document,runtime:{},esc:String,getActiveSlot:()=>window.SDT.Base.slot,
    openGuide:guide.openTitleGuide,readCards:()=>window.SDT.Cards,readSound:()=>window.SDT.Sound,readAgent:()=>null});
  controller.openShop('one'); flush();
});
afterEach(() => { UI._restoreOverlayBackground(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
function openGuide() { leave.openLeaveMenu(); click('leaveGuide'); flush(); }
async function returnGuide(method='button') {
  if (method==='Escape') UI.closeTopOverlayByEsc(); else click('guideBack');
  await UI._acts.leaveCancel(); flush();
}
describe('系统菜单指南与公共返回生命周期，真实商店消费者（jsdom合成交互）', () => {
  it.each([['shop','button'],['shop','Escape'],['shopSell','button'],['shopSell','Escape']])('%s %s 保留双轴滚动并恢复来源控件', async (page, method) => {
    if (page === 'shopSell') click('openSell');
    const board = UI.el.ovBody.querySelector('.shop-board'); board.scrollTop = 213; board.scrollLeft = 19;
    const selector = page === 'shop' ? '[data-act="openSell"]' : '.sell-ledger-rule summary';
    const source = UI.el.ovBody.querySelector(selector); source.focus();
    const before = JSON.stringify(game);
    openGuide(); const oldBack = UI._acts.guideBack;
    expect(document.querySelector('.beginner-guide')).not.toBeNull();
    await returnGuide(method);
    expect(UI.el.ovBody.querySelector('.shop-board').scrollTop).toBe(213);
    expect(UI.el.ovBody.querySelector('.shop-board').scrollLeft).toBe(19);
    expect(document.activeElement).toBe(UI.el.ovBody.querySelector(selector));
    expect(JSON.stringify(game)).toBe(before);
    const current = UI.el.ovBody.firstElementChild; oldBack();
    expect(UI.el.ovBody.firstElementChild).toBe(current);
  });
  it.each(['new-guide','new-page','closed','closing','new-session'])('%s 拒绝旧指南返回，不抢焦点', change => {
    openGuide(); const oldBack = UI._acts.guideBack;
    if (change === 'new-guide') guide.openTitleGuide();
    if (change === 'new-page') UI.showOverlay('下一页','<button>继续</button>');
    if (change === 'closed') UI.el.overlay.hidden = true;
    if (change === 'closing') UI.el.overlay.classList.add('closing');
    if (change === 'new-session') game.discoveredPairs = new Set();
    const current = UI.el.ovBody.firstElementChild, focus = document.activeElement;
    oldBack(); flush();
    expect(UI.el.ovBody.firstElementChild).toBe(current);
    if (change !== 'new-page' && change !== 'new-guide') expect(document.activeElement).toBe(focus);
  });
  it('同局指南往返后收购台读取替换后的当前库存，不复活旧卡', async () => {
    click('openSell'); openGuide();
    const cards=[{uid:'replacement',card:{id:'replacement',name:'新带回宝石',sellable:true,value:7}}];
    game.ownedCards=cards; click('guideBack'); await UI._acts.leaveCancel(); flush();
    expect(UI.el.ovBody.querySelector('.shop-sell').textContent).toContain('新带回宝石');
    expect([...UI.el.ovBody.querySelectorAll('.sell-item')].map(item=>item.id)).toEqual(['shop-sell-replacement']);
    expect(game.ownedCards).toBe(cards); expect(game.coins).toBe(10);
  });
  it('当前返回拥有者只提交一次，无返回方法时保持页面', () => {
    const before=vi.fn(()=>({custom:7}));
    const snapshot=captureOverlayReturnState(UI.el.ovBody,null,{readContext:before});
    UI.showOverlay('说明','<main>说明正文</main>');
    const back=vi.fn((state,commit)=>commit(()=>UI.showOverlay('返回',`<main>来源${state.custom}</main>`)));
    const options={revision:UI._overlayRevision,getRevision:()=>UI._overlayRevision,isOpen:()=>!UI.el.overlay.hidden,restore:()=>{}};
    const returnOnce=createOverlayReturn({...options,back:commit=>back(snapshot.context,commit)});
    returnOnce(); returnOnce();
    expect(before).toHaveBeenCalledOnce(); expect(back).toHaveBeenCalledExactlyOnceWith({custom:7},expect.any(Function));
    const content=UI.el.ovBody.firstElementChild;
    expect(createOverlayReturn({...options,revision:UI._overlayRevision})()).toBe(false);
    expect(UI.el.ovBody.firstElementChild).toBe(content);
  });
  it('重排按稳定key恢复，歧义项跳过，不保留旧DOM引用', () => {
    const root = UI.el.ovBody;
    root.innerHTML = '<div data-panel="a"></div><div data-panel="b"></div><button data-act="return">返回</button>';
    root.querySelector('[data-panel=a]').scrollTop = 91;
    const snapshot = captureOverlayReturnState(root, root.querySelector('button'));
    root.innerHTML = '<button data-act="return">返回</button><div data-panel="b"></div><div data-panel="a"></div>';
    restoreOverlayReturnState(root,snapshot);
    expect(root.querySelector('[data-panel=a]').scrollTop).toBe(91);
    expect(document.activeElement.dataset.act).toBe('return');
    root.innerHTML = '<div data-panel="a"></div><div data-panel="a"></div>';
    restoreOverlayReturnState(root,snapshot);
    expect([...root.children].every(element => element.scrollTop === 0)).toBe(true);
  });
  it('稳定id跨视觉class变化恢复滚动和焦点，仍拒绝不同来源和重复id', () => {
    const root=UI.el.ovBody;
    root.innerHTML='<section id="cards" class="is-entering" data-zone="safe"><button id="inspect" class="on" data-card="one">详情</button></section>';
    root.querySelector('#cards').scrollTop=187;
    const snapshot=captureOverlayReturnState(root,root.querySelector('#inspect'));
    root.innerHTML='<section id="cards" class="is-settled" data-zone="safe"><button id="inspect" data-card="one">详情</button></section>';
    restoreOverlayReturnState(root,snapshot);
    expect(root.querySelector('#cards').scrollTop).toBe(187);
    expect(document.activeElement.id).toBe('inspect');
    root.innerHTML='<section id="cards" data-zone="bag"><button id="inspect" data-card="two">另一张</button><button id="safe">返回</button></section>';
    root.querySelector('#safe').focus();restoreOverlayReturnState(root,snapshot);
    expect(root.querySelector('#cards').scrollTop).toBe(0);
    expect(document.activeElement.id).toBe('safe');
    root.innerHTML='<section id="cards" data-zone="safe"></section><section id="cards" data-zone="safe"></section>';
    restoreOverlayReturnState(root,snapshot);
    expect([...root.children].every(element=>element.scrollTop===0)).toBe(true);
  });
  it('公共返回恢复展开/收起状态，重排也不改变其他说明', () => {
    const render = () => UI.showOverlay('收纳说明', '<details id="closed" open><summary>原先收起</summary></details><details id="opened"><summary>原先展开</summary></details><button id="disclosure-source">查看说明</button>');
    render(); UI.el.ovBody.querySelector('#closed').open=false; UI.el.ovBody.querySelector('#opened').open=true;
    const snapshot=captureOverlayReturnState(UI.el.ovBody,UI.el.ovBody.querySelector('#disclosure-source'));
    UI.showOverlay('说明','<main>说明正文</main>');
    const back=createOverlayReturn({revision:UI._overlayRevision,getRevision:()=>UI._overlayRevision,isOpen:()=>!UI.el.overlay.hidden,
      back:commit=>commit(render),restore:current=>restoreOverlayReturnState(UI.el.ovBody,snapshot,{isCurrent:current})});
    back(); flush();
    expect(UI.el.ovBody.querySelector('#closed').open).toBe(false);
    expect(UI.el.ovBody.querySelector('#opened').open).toBe(true);
    expect(document.activeElement.id).toBe('disclosure-source');
  });
  it.each(['disabled', 'inert', 'hidden', 'aria-hidden'])('返回时原焦点目标变为%s，保留当前安全焦点', state => {
    const root=UI.el.ovBody; root.innerHTML='<button id="source">原操作</button><button id="safe">返回</button>';
    const snapshot=captureOverlayReturnState(root,root.querySelector('#source'));
    root.querySelector('#source').setAttribute(state,state==='aria-hidden'?'true':'');
    root.querySelector('#safe').focus(); restoreOverlayReturnState(root,snapshot);
    expect(document.activeElement.id).toBe('safe');
  });

});
