import { registerScreenOwner } from '../game/src/ui/screen-owner.js';
import { createBattleDecisionPresenter } from '../game/src/battle/view/battle.decision-shell.js';
import { battleDiscoverBodyHTML } from '../game/src/battle/view/battle.discover-view.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoveryActionsHTML, bindDiscoverySelection } from '../game/src/ui/discovery-selection.js';

function setup({ onConfirm=vi.fn(() => true), onCancel=vi.fn(), onError=undefined } = {}) {
  document.body.innerHTML = `<section id="discovery"><button data-act="pick" data-i="0">甲</button><button data-act="pick" data-i="1">乙</button>${discoveryActionsHTML({confirmAct:'confirm',cancelAct:'cancel'})}</section>`;
  const root=document.getElementById('discovery'), acts={}; let active=true;
  const UI={act:(name,handler) => { acts[name]=handler; }};
  const controls=bindDiscoverySelection({UI,root,optionSelector:'[data-act="pick"]',selectAct:'pick',confirmAct:'confirm',cancelAct:'cancel',
    isCurrent:() => active,onConfirm,onCancel,onError});
  const choices=[...root.querySelectorAll('[data-act="pick"]')], confirm=root.querySelector('[data-act="confirm"]');
  return {root,choices,confirm,acts,controls,onConfirm,onCancel,invalidate:() => {active=false;}};
}
afterEach(() => document.body.replaceChildren());

describe('shared two-step discovery', () => {
  it('keyboard movement reveals an offscreen candidate by scrolling only its owning list', () => {
    const h=setup();
    const row=document.createElement('div');
    h.root.prepend(row);row.append(...h.choices);
    Object.defineProperties(row,{scrollWidth:{value:900},clientWidth:{value:300},scrollHeight:{value:200},clientHeight:{value:200}});
    row.getBoundingClientRect=()=>({left:40,right:340,top:20,bottom:220});
    h.choices[1].getBoundingClientRect=()=>({left:390,right:610,top:20,bottom:200});
    h.controls.select(h.choices[0]);h.choices[0].focus();
    h.choices[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    expect(row.scrollLeft).toBe(270);expect(row.scrollTop).toBe(0);
    expect(document.activeElement).toBe(h.choices[1]);
    expect(h.onConfirm).not.toHaveBeenCalled();
  });
  it('keeps the source untouched on selection and commits only the selected dataset on confirmation', async () => {
    const h=setup(); expect(h.confirm.disabled).toBe(true);
    expect([...h.root.querySelector('.ov-btns').children].map(button=>button.dataset.act)).toEqual(['cancel','confirm']);
    h.choices[1].click(); expect(h.onConfirm).not.toHaveBeenCalled(); expect(h.confirm.disabled).toBe(false);
    expect(h.choices[1].getAttribute('aria-pressed')).toBe('true');
    expect(h.choices[0].getAttribute('aria-pressed')).toBe('false');
    await h.controls.confirm(); expect(h.onConfirm).toHaveBeenCalledWith(h.choices[1].dataset,h.choices[1]);
    expect(await h.controls.confirm()).toBe(false); expect(h.onConfirm).toHaveBeenCalledOnce();
  });

  it('keeps keyboard reading focus independent from the staged business selection', () => {
    const h=setup(); h.choices[1].click(); h.choices[0].focus();
    expect(document.activeElement).toBe(h.choices[0]);
    expect(h.choices[0].getAttribute('aria-pressed')).toBe('false');
    expect(h.choices[1].getAttribute('aria-pressed')).toBe('true');
    expect(h.choices[1].querySelector('.discovery-selection-mark').textContent).toContain('已选中');
    expect(h.confirm.disabled).toBe(false); expect(h.onConfirm).not.toHaveBeenCalled();
  });

  it('captures option activation before the existing page delegate can submit it', () => {
    const h=setup(), delegated=vi.fn(); document.body.addEventListener('click',delegated,{once:true});
    h.choices[0].click(); expect(delegated).not.toHaveBeenCalled();
    document.body.removeEventListener('click',delegated);
    h.acts.cancel(); expect(h.onCancel).toHaveBeenCalledOnce(); expect(h.confirm.disabled).toBe(true);
    expect(h.choices[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('uses the same selector path for keyboard-generated clicks and programmatic selection actions', async () => {
    const h=setup(); h.choices[0].dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));
    expect(h.choices[0].getAttribute('aria-pressed')).toBe('true');
    h.acts.pick({i:'1'}); await h.acts.confirm();
    expect(h.onConfirm).toHaveBeenCalledWith(h.choices[1].dataset,h.choices[1]);
  });

  it('honors the existing opening admission state and rejects stale pages', async () => {
    const h=setup(); h.choices[0].setAttribute('aria-disabled','true'); h.choices[0].click();
    expect(h.confirm.disabled).toBe(true); expect(await h.controls.confirm()).toBe(false);
    h.choices[0].removeAttribute('aria-disabled'); h.choices[0].click(); h.invalidate();
    expect(await h.controls.confirm()).toBe(false); expect(h.controls.cancel()).toBe(false); expect(h.onConfirm).not.toHaveBeenCalled();
    const second=setup(); second.choices[0].click(); second.root.remove();
    expect(await second.controls.confirm()).toBe(false); expect(second.onConfirm).not.toHaveBeenCalled();
  });

  it('blocks double confirmation while saving and permits explicit failure retry without rerolling', async () => {
    let finish; const onConfirm=vi.fn(() => new Promise(resolve => {finish=resolve;}));
    const h=setup({onConfirm}); h.choices[0].click(); const pending=h.controls.confirm();
    expect(await h.controls.confirm()).toBe(false); expect(h.controls.cancel()).toBe(false); expect(onConfirm).toHaveBeenCalledOnce();
    finish(false); expect(await pending).toBe(false); expect(h.confirm.disabled).toBe(false);
    onConfirm.mockReturnValueOnce(true); expect(await h.controls.confirm()).toBe(true); expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('uses arrows to choose, Enter to focus confirmation, and Escape to invoke the cancellation port', async () => {
    const h=setup(); h.choices[0].focus();
    h.root.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    expect(h.choices[0].getAttribute('aria-pressed')).toBe('true');
    h.choices[1].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    expect(document.activeElement).toBe(h.confirm); expect(h.onConfirm).not.toHaveBeenCalled();
    h.confirm.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(h.confirm.disabled).toBe(true); expect(h.onCancel).toHaveBeenCalledOnce();
    h.choices[1].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true}));
    expect(h.confirm.disabled).toBe(true);
    h.choices[1].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    h.confirm.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    await Promise.resolve(); expect(h.onConfirm).toHaveBeenCalledOnce();
  });

  it('reports thrown confirmation errors and keeps the same selection available for retry', async () => {
    const h=setup({onConfirm:vi.fn(() => {throw new Error('save failed');})}); h.choices[0].click();
    expect(await h.controls.confirm()).toBe(false);
    expect(h.root.querySelector('[role="status"]').textContent).toContain('请重试');
    expect(h.confirm.disabled).toBe(false); expect(h.choices[0].getAttribute('aria-pressed')).toBe('true');
    h.onConfirm.mockReturnValueOnce(true); expect(await h.controls.confirm()).toBe(true);
  });


  it('isolates a throwing error observer and releases busy state after reporting the primary error', async () => {
    const h=setup({onConfirm:vi.fn(() => {throw new Error('primary');}),onError:() => {throw new Error('observer');}});
    h.choices[0].click(); expect(await h.controls.confirm()).toBe(false);
    expect(h.confirm.disabled).toBe(false); expect(h.root.dataset.discoveryBusy).toBe('false');
    expect(h.root.querySelector('[role="status"]').textContent).toContain('请重试');
  });

  it('keeps confirmation retryable when the original battle ticket rejects without a return value', async () => {
    document.body.innerHTML='<section><div id="body"></div></section>';
    const body=document.getElementById('body');
    let snapshot={battleToken:7,discovering:{n:1,options:[{id:'a',name:'甲'}]},opts:{}};
    const UI={el:{ovBody:body},_acts:{},act(name,fn){this._acts[name]=fn;},showOverlay(_title,html){body.innerHTML=html;}};
    const show=createBattleDecisionPresenter({UI,getSnapshot:()=>snapshot,R:()=>({battleEnergy:3})});
    const markup=token=>battleDiscoverBodyHTML({candidates:[{card:{name:'甲'}}],cardHTML:()=>'<span>甲</span>',action:'发现',remaining:1,pageToken:token});
    show('发现',markup('page-a'),'discover',snapshot);
    const rejected=vi.fn(() => undefined); UI._acts.btDiscover=rejected;
    body.querySelector('[data-act="btDiscover"]').click();
    expect(await UI._acts.btDiscoverConfirm()).toBe(false);
    expect(await UI._acts.btDiscoverConfirm()).toBe(false); expect(rejected).toHaveBeenCalledTimes(2);
    const oldConfirm=UI._acts.btDiscoverConfirm;
    show('发现',markup('page-b'),'discover',snapshot);
    expect(await oldConfirm()).toBe(false);
    const accepted=vi.fn(() => {snapshot={...snapshot,discovering:null};}); UI._acts.btDiscover=accepted;
    body.querySelector('[data-act="btDiscover"]').click();
    expect(await UI._acts.btDiscoverConfirm()).toBe(true);
    expect(await UI._acts.btDiscoverConfirm()).toBe(false); expect(accepted).toHaveBeenCalledOnce();
  });

  it('binds cancellation to the displayed battle round and uses its actual commitment label', () => {
    document.body.innerHTML='<section><div id="body"></div></section>';
    const body=document.getElementById('body');
    let snapshot={battleToken:8,discovering:{n:1,roundId:'preview-4',sourceCommit:'preview',cancelLabel:'取消使用',options:[{id:'a',name:'甲'}]},opts:{}};
    const cancelDiscover=vi.fn(() => {snapshot={...snapshot,discovering:null};return true;});
    const UI={el:{ovBody:body},_acts:{},act(name,fn){this._acts[name]=fn;},showOverlay(_title,html){body.innerHTML=html;}};
    const show=createBattleDecisionPresenter({UI,getSnapshot:()=>snapshot,R:()=>({battleEnergy:3}),cancelDiscover});
    const markup=battleDiscoverBodyHTML({candidates:[{card:{name:'甲'}}],cardHTML:()=>'<span>甲</span>',action:'发现',remaining:1,pageToken:'cancel-page'});
    show('发现',markup,'discover',snapshot);
    expect(body.querySelector('[data-act="btDiscoverCancel"]').textContent).toBe('取消使用');
    const oldCancel=UI._acts.btDiscoverCancel;
    expect(oldCancel()).toBe(true); expect(cancelDiscover).toHaveBeenCalledExactlyOnceWith('preview-4');
    expect(oldCancel()).toBe(false); expect(cancelDiscover).toHaveBeenCalledOnce();
  });


  it('keeps the real selected state and card content when cancellation is rejected', () => {
    const h=setup({onCancel:vi.fn(() => false)}); h.choices[1].click();
    expect(h.choices[1].dataset.discoverySelected).toBe('true');
    expect(h.choices[1].querySelector('.discovery-selection-mark').getAttribute('aria-hidden')).toBe('true');
    expect(h.controls.cancel()).toBe(false);
    expect(h.choices[1].getAttribute('aria-pressed')).toBe('true');
    expect(h.choices[1].dataset.discoverySelected).toBe('true'); expect(h.confirm.disabled).toBe(false);
  });

  it('blocks duplicate actions during asynchronous cancellation and reports failure without clearing selection', async () => {
    let finish; const cancel=vi.fn(() => new Promise(resolve => {finish=resolve;}));
    const h=setup({onCancel:cancel}); h.choices[0].click(); const pending=h.controls.cancel();
    expect(h.root.getAttribute('aria-busy')).toBe('true');
    expect(h.controls.cancel()).toBe(false); expect(await h.controls.confirm()).toBe(false);
    finish(false); expect(await pending).toBe(false); expect(cancel).toHaveBeenCalledOnce();
    expect(h.choices[0].dataset.discoverySelected).toBe('true'); expect(h.confirm.disabled).toBe(false);
    cancel.mockImplementationOnce(() => Promise.reject(new Error('cancel rejected')));
    expect(await h.controls.cancel()).toBe(false);
    expect(h.root.querySelector('[role="status"]').textContent).toContain('取消未完成');
    expect(h.choices[0].dataset.discoverySelected).toBe('true');
    cancel.mockReturnValueOnce(true); expect(h.controls.cancel()).toBe(true);
    expect(h.choices[0].dataset.discoverySelected).toBe('false'); expect(h.confirm.disabled).toBe(true);
    expect(document.activeElement).toBe(h.choices[0]);
  });

  it('rebinds one live root without duplicate markers, listeners or old submissions', async () => {
    const h=setup(); h.choices[0].innerHTML='<div class="hs-card"><p>原始卡牌说明</p></div>';
    h.choices[0].click(); const old=h.controls, submit=vi.fn(() => true);
    const controls=bindDiscoverySelection({UI:{act:()=>{}},root:h.root,optionSelector:'[data-act="pick"]',
      confirmAct:'confirm',cancelAct:'cancel',isCurrent:()=>true,onConfirm:submit,onCancel:()=>true});
    expect(h.choices[0].dataset.discoverySelected).toBe('true');
    expect(h.choices[0].querySelector('.hs-card').textContent).toBe('原始卡牌说明');
    expect(h.choices[1].querySelectorAll('.discovery-selection-mark')).toHaveLength(1);
    expect(await old.confirm()).toBe(false); h.confirm.click(); await Promise.resolve();
    expect(submit).toHaveBeenCalledOnce(); expect(h.onConfirm).not.toHaveBeenCalled();
    controls.release(); expect(await controls.confirm()).toBe(false);
  });

  it('does not carry a selected index into a replacement candidate set on the same root', () => {
    const h=setup(); h.choices[0].click(); h.choices[0].replaceWith(h.choices[0].cloneNode(true));
    bindDiscoverySelection({UI:{act:()=>{}},root:h.root,optionSelector:'[data-act="pick"]',confirmAct:'confirm',cancelAct:'cancel',
      isCurrent:()=>true,onConfirm:()=>true,onCancel:()=>true});
    expect(h.root.querySelector('[data-i="0"]').dataset.discoverySelected).toBe('false');
    expect(h.confirm.disabled).toBe(true);
  });


  it('hands the same Escape to the current owner when a still-connected discovery page has expired', () => {
    const h=setup(), next=document.createElement('section'), back=vi.fn(); document.body.append(next);
    const release=registerScreenOwner({root:next,priority:10,onBack:back});
    h.invalidate(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(back).toHaveBeenCalledOnce(); expect(h.onCancel).not.toHaveBeenCalled();
    release(); h.controls.release();
  });

  it('removes an owner with a throwing validity predicate without breaking global Escape', () => {
    const root=document.createElement('section'); document.body.append(root);
    const current=vi.fn(), stale=vi.fn();
    const release=registerScreenOwner({root,priority:10,onBack:current});
    const releaseStale=registerScreenOwner({root,priority:30,onBack:stale,isCurrent:()=>{throw new Error('expired');}});
    expect(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))).not.toThrow();
    expect(current).toHaveBeenCalledOnce(); expect(stale).not.toHaveBeenCalled(); release(); releaseStale();
  });

});
