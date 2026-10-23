import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeUiAction, isActionTargetAvailable } from '../game/src/ui/action-dispatch.js';

let UI;
window.SDT = { Icons:{rich:value => value}, Sound:{sfx() {}}, Motion:{overlayIn() {}},
  Cards:{all:() => [], cardHTML:() => '<article class="hs-card"></article>'} };
beforeAll(async () => { ({ UI } = await import('../game/src/ui/ui.js')); });
beforeEach(() => {
  document.body.innerHTML = '<div id="heroAva"></div><div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI._acts={}; UI._baseActs={}; UI._overlayInerted=[]; UI.init();
  UI.showOverlay('操作', '<button data-act="perform" data-i="7">确认</button>', 'page');
});
afterEach(() => {
  document.getElementById('cardZoom')?._closeCardZoom(true);
  UI.hideOverlay({immediate:true});
});
const fire = element => element.dispatchEvent(new MouseEvent('click', {bubbles:true}));
const blockers = ['disabled', 'aria-disabled', 'hidden', 'inert', 'closing', 'display', 'visibility'];
function block(element, kind) {
  if (kind === 'disabled') element.disabled=true;
  if (kind === 'aria-disabled') element.setAttribute('aria-disabled', 'true');
  if (kind === 'hidden') element.parentElement.hidden=true;
  if (kind === 'inert') element.parentElement.inert=true;
  if (kind === 'closing') element.parentElement.classList.add('closing');
  if (kind === 'display') element.parentElement.style.display='none';
  if (kind === 'visibility') element.parentElement.style.visibility='hidden';
}

describe.each(['overlay', 'zoom'])('shared %s action execution admission', surface => {
  function mount() {
    if (surface === 'zoom') UI.showCardZoom({id:'card', name:'卡牌'}, {
      hideNote:true, footer:'<button data-act="perform" data-i="7">领取</button>',
    });
    return document.querySelector(surface === 'zoom' ? '#cardZoom .cz-foot [data-act]' : '#ovBody [data-act]');
  }
  it.each(blockers)('rejects %s applied after mounting, including a bubbling synthetic click', kind => {
    const element=mount(), callback=vi.fn(); UI.act('perform', callback);
    expect(isActionTargetAvailable(element, UI)).toBe(true);
    block(element, kind); fire(element);
    expect(callback).not.toHaveBeenCalled();
  });
  it('preserves the registered callback parameters and leaves valid repeated actions available', () => {
    const element=mount(), callback=vi.fn(); UI.act('perform', callback);
    fire(element); fire(element);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(element.dataset);
  });
});

it('zoom owns input over its still-mounted source page; removing it restores the source action', () => {
  const source=document.querySelector('#ovBody [data-act]'), callback=vi.fn(); UI.act('perform', callback);
  UI.showCardZoom({id:'card', name:'卡牌'}, {hideNote:true});
  fire(source); expect(callback).not.toHaveBeenCalled();
  document.getElementById('cardZoom')._closeCardZoom(true);
  fire(source); expect(callback).toHaveBeenCalledOnce();
});

it.each(['hide', 'remove'])('an inner dialog owns actions until details close by %s, then the parent action recovers', closeMode => {
  const source=document.querySelector('#ovBody [data-act]'), parent=vi.fn(); UI.act('perform', parent);
  UI.el.ovBody.insertAdjacentHTML('beforeend', '<section role="dialog" aria-label="详情"><button data-act="closeDetails">关闭详情</button></section>');
  const details=UI.el.ovBody.querySelector('[role="dialog"]');
  UI.act('closeDetails', () => { if (closeMode === 'hide') details.hidden=true; else details.remove(); });
  expect(UI._overlayInteractionRoot()).toBe(details);
  expect(invokeUiAction(UI, source)).toMatchObject({ok:false,reason:'unavailable'});
  fire(source); expect(parent).not.toHaveBeenCalled();
  fire(details.querySelector('[data-act="closeDetails"]'));
  expect(UI._overlayInteractionRoot()).toBe(UI.el.ovBody);
  fire(source); expect(parent).toHaveBeenCalledOnce();
});

it('a host without an interaction-root method keeps the ovBody fallback', () => {
  const source=document.querySelector('#ovBody [data-act]'), callback=vi.fn();
  const host={el:UI.el,_acts:{perform:callback}};
  UI.el.ovBody.insertAdjacentHTML('beforeend', '<section role="dialog"><button>详情</button></section>');
  expect(invokeUiAction(host, source).ok).toBe(true);
  expect(callback).toHaveBeenCalledWith(source.dataset);
});

it('rejects a detached source even when its action name exists on the replacement page', () => {
  const source=document.querySelector('#ovBody [data-act]'), callback=vi.fn(); UI.act('perform', callback);
  UI.showOverlay('新页面', '<button data-act="perform">新确认</button>', 'page');
  expect(invokeUiAction(UI, source)).toMatchObject({ok:false,reason:'unavailable'});
  expect(callback).not.toHaveBeenCalled();
  fire(document.querySelector('#ovBody [data-act]')); expect(callback).toHaveBeenCalledOnce();
});

it.each([false, undefined, {ok:false,code:'DOMAIN'}, Promise.resolve('accepted')])('preserves callback result %s and photo source argument', result => {
  const source=document.querySelector('#ovBody [data-act]'); source.setAttribute('data-photo-zoom-source', '');
  const callback=vi.fn(() => result); UI.act('perform', callback);
  expect(invokeUiAction(UI, source)).toEqual({ok:true,value:result});
  expect(callback).toHaveBeenCalledWith(source.dataset, source);
});

it('keeps base action fallback for the overlay and the zoom footer own-action-only contract', () => {
  const callback=UI._baseActs.perform=vi.fn();
  fire(document.querySelector('#ovBody [data-act]')); expect(callback).toHaveBeenCalledOnce();
  UI.showCardZoom({id:'card',name:'卡牌'}, {hideNote:true,footer:'<button data-act="perform">领取</button>'});
  fire(document.querySelector('#cardZoom .cz-foot [data-act]')); expect(callback).toHaveBeenCalledOnce();
});
