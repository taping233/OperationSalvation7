import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShopController } from '../game/src/run/game.run.shop.js';
import { captureOverlayReturnState, restoreOverlayReturnState } from '../game/src/ui/overlay-return-state.js';
let UI, frames, game, controller;
function flush() { frames.splice(0).forEach(fn => fn()); }
function click(action) { UI.el.ovBody.querySelector(`[data-act="${action}"]`).click(); }
beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = '<main id="viewport"><div id="overlay" tabindex="-1" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  window.SDT = { Base: {slot:1}, Icons: {rich: html => html}, Sound: {sfx:vi.fn()}, Cards: {isSellable: c => !!c.sellable, sellPrice: c => c.value || 0} };
  const {overlayMethods} = await import('../game/src/ui/overlay.js');
  UI = {...overlayMethods, helpTopics:{}, _acts:{}, _overlayInerted:[],
    el:Object.fromEntries(['viewport','overlay','ovTitle','ovBody'].map(id => [id, document.getElementById(id)])),
    act(name, fn) { this._acts[name] = fn; }, refresh:vi.fn(), log:vi.fn()};
  window.SDT.UI = UI;
  UI.el.ovBody.addEventListener('click', event => { const button = event.target.closest('[data-act]'); if (button) UI._acts[button.dataset.act]?.(button.dataset); });
  UI.act('openHelp', data => UI.showHelp(data.page));
  frames = []; vi.stubGlobal('requestAnimationFrame', fn => frames.push(fn));
  game = {state:'idle', coins:10, ownedCards:[{uid:'coin', card:{id:'coin', name:'金币', sellable:true, value:2}}],
    shopStocks:{one:[{card:{id:'potion', name:'药剂'},price:2,sold:false}]}};
  controller = createShopController({UI, SDT:window.SDT, game, saveGame:vi.fn(), bagCap:()=>16,
    cardHTML:()=>'', newUid:()=> 'new', usedSlots:()=>1, setCardPageOpen:vi.fn()});
  controller.openShop('one'); flush();
});
afterEach(() => { UI._restoreOverlayBackground(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
describe('公共帮助返回生命周期，真实商店消费者（jsdom合成交互）', () => {
  it.each([['shop','button'],['shop','Escape'],['shopSell','button'],['shopSell','Escape']])('%s %s 保留双轴滚动并恢复帮助入口', (page, method) => {
    if (page === 'shopSell') click('openSell');
    const board = UI.el.ovBody.querySelector('.shop-board'); board.scrollTop = 213; board.scrollLeft = 19;
    const before = JSON.stringify(game);
    click('openHelp'); flush(); const oldBack = UI._acts.helpBack;
    if (method === 'Escape') UI.closeTopOverlayByEsc(); else click('helpBack');
    flush();
    expect(UI.el.ovBody.querySelector('.shop-board').scrollTop).toBe(213);
    expect(UI.el.ovBody.querySelector('.shop-board').scrollLeft).toBe(19);
    expect(document.activeElement.dataset.page).toBe(page);
    expect(JSON.stringify(game)).toBe(before);
    const current = UI.el.ovBody.firstElementChild; oldBack();
    expect(UI.el.ovBody.firstElementChild).toBe(current);
  });
  it.each(['new-help','new-page','closed','closing','new-session'])('%s 拒绝旧返回，不抢焦点', change => {
    click('openHelp'); flush(); const oldBack = UI._acts.helpBack;
    if (change === 'new-help') UI.showHelp('shop');
    if (change === 'new-page') UI.showOverlay('下一页','<button>继续</button>');
    if (change === 'closed') UI.el.overlay.hidden = true;
    if (change === 'closing') UI.el.overlay.classList.add('closing');
    if (change === 'new-session') game.ownedCards = [...game.ownedCards];
    const current = UI.el.ovBody.firstElementChild, focus = document.activeElement;
    oldBack(); flush();
    expect(UI.el.ovBody.firstElementChild).toBe(current);
    if (change !== 'new-page' && change !== 'new-help') expect(document.activeElement).toBe(focus);
  });
  it('兼容 before/back(state)，返回一次；没有back仍为无操作', () => {
    const back = vi.fn(), before = vi.fn(() => ({custom:7}));
    UI.registerHelp('custom',{title:'自定义',html:'内容', before,back}); UI.showHelp('custom');
    UI._acts.helpBack(); UI._acts.helpBack();
    expect(before).toHaveBeenCalledOnce(); expect(back).toHaveBeenCalledExactlyOnceWith({custom:7});
    UI.registerHelp('none',{title:'说明',html:'内容'}); UI.showHelp('none');
    const content = UI.el.ovBody.firstElementChild; UI._acts.helpBack(); expect(UI.el.ovBody.firstElementChild).toBe(content);
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
  it('帮助往返保留展开/收起状态，重排也不改变其他说明', () => {
    const render = () => UI.showOverlay('收纳说明', '<details id="closed" open><summary>原先收起</summary></details><details id="opened"><summary>原先展开</summary></details>'+UI.helpBtn('disclosures'));
    render(); UI.el.ovBody.querySelector('#closed').open=false; UI.el.ovBody.querySelector('#opened').open=true;
    UI.registerHelp('disclosures',{title:'帮助',html:'说明',back:render});
    UI.showHelp('disclosures'); UI._acts.helpBack(); flush();
    expect(UI.el.ovBody.querySelector('#closed').open).toBe(false);
    expect(UI.el.ovBody.querySelector('#opened').open).toBe(true);
    expect(document.activeElement.dataset.page).toBe('disclosures');
  });
  it.each(['disabled', 'inert', 'hidden', 'aria-hidden'])('返回时原焦点目标变为%s，保留当前安全焦点', state => {
    const root=UI.el.ovBody; root.innerHTML='<button id="source">原操作</button><button id="safe">返回</button>';
    const snapshot=captureOverlayReturnState(root,root.querySelector('#source'));
    root.querySelector('#source').setAttribute(state,state==='aria-hidden'?'true':'');
    root.querySelector('#safe').focus(); restoreOverlayReturnState(root,snapshot);
    expect(document.activeElement.id).toBe('safe');
  });

});
