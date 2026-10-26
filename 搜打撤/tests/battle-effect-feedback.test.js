import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const timers=vi.hoisted(()=>[]);
vi.mock('../game/src/battle/runtime/battle.clock.js',()=>({schedulePresentationMs:(callback,ms)=>{const t={callback,ms,cancelled:false};timers.push(t);return()=>{t.cancelled=true;};}}));
import { updateHandAcquisitionFeedback, showBattleEffectFeedback, retainBattleFeedback, ownsHandPageFeedback } from '../game/src/battle/view/battle.effect-feedback.js';
let stage, slot, button;
const snapshot=hand=>({battleToken:7,hand});
const arrival=(uid,extra={})=>({kind:'draw',uid,acquired:true,battleToken:7,...extra});
const recast=(eventId,extra={})=>({kind:'recast',eventId,uid:'a',battleToken:7,...extra});
const finish=()=>{for(const t of timers.splice(0))if(!t.cancelled)t.callback();};
const update=(hand,visible,events=[],before=[])=>updateHandAcquisitionFeedback(stage,snapshot(hand),[{slot,group:{uids:visible}}],new Map([[slot,new Set(before)]]),events);
beforeEach(()=>{
 document.dispatchEvent(new Event('sdt-overlay-close'));timers.length=0;
 document.body.innerHTML='<div id="overlay"><div class="battle-stage sts"><div id="btSelf"><div class="sts-figure"></div></div><div class="sts-foe" data-eidx="0"><div class="sts-figure"></div></div><div class="sts-hand"><div class="bt-slot"><div class="bt-card" data-uid="a"></div></div></div><div class="sts-resource-dock"><div class="bt-hand-page" role="group" aria-label="当前第 1 栏，共 2 栏">第 1/2 栏</div></div></div></div>';
 stage=document.querySelector('.battle-stage');stage._battleToken=7;slot=stage.querySelector('.bt-slot');button=stage.querySelector('.bt-hand-page');
 window.SDT ||= {};window.SDT.Motion={reduceMotion:()=>false};
});
afterEach(()=>{document.dispatchEvent(new Event('sdt-overlay-close'));vi.restoreAllMocks();});
it('same-stack arrivals retain every new UID in one image badge and keep words in its accessible label',()=>{
 update(['old','a','b'],['old','a','b'],[arrival('a'),arrival('b')],['old']);
 const badge=slot.querySelector('.bt-hand-acquired');expect(badge.getAttribute('aria-label')).toBe('入手 2 张');expect(badge.textContent).toBe('');expect(badge.classList.contains('fx-art-draw')).toBe(true);
 expect(slot.querySelectorAll('.bt-hand-acquired')).toHaveLength(1);finish();expect(slot.querySelector('.bt-hand-acquired')).toBeNull();
});
it('play-and-return UIDs and stale battle events do not become new acquisitions',()=>{
 update(['a'],['a'],[arrival('a')],['a']);expect(slot.querySelector('.bt-hand-acquired')).toBeNull();
 update(['a','b'],['a','b'],[arrival('b',{battleToken:6})],['a']);expect(slot.querySelector('.bt-hand-acquired')).toBeNull();
});
it('other-page counts reconcile on eventless renders and never force a page switch',()=>{
 update(['a','b','c'],['a'],[arrival('b'),arrival('c')],['a']);
 const badge=button.querySelector('.bt-hand-page-new');expect(badge.getAttribute('aria-label')).toBe('新增 2');expect(badge.textContent).toBe('');expect(button.textContent).toBe('第 1/2 栏');
 update(['a','b'],['a']);expect(button.querySelector('.bt-hand-page-new')).toBe(badge);expect(badge.getAttribute('aria-label')).toBe('新增 1');
 update(['a','b'],['a','b']);expect(button.querySelector('.bt-hand-page-new')).toBeNull();expect(button.getAttribute('aria-label')).toBe('当前第 1 栏，共 2 栏');
});
it('page feedback ownership requires the actual state node and structural parent',()=>{
 update(['a','b'],['a'],[arrival('b')]);const badge=button.querySelector('.bt-hand-page-new');expect(ownsHandPageFeedback(button,badge)).toBe(true);
 expect(ownsHandPageFeedback(button,badge.cloneNode(true))).toBe(false);button.removeAttribute('role');expect(ownsHandPageFeedback(button,badge)).toBe(false);
});
it.each([false,true])('acquisition artwork stays noninteractive and follows reduced motion=%s',reduced=>{
 window.SDT.Motion.reduceMotion=()=>reduced;update(['a'],['a'],[arrival('a')]);const badge=slot.querySelector('.bt-hand-acquired');
 expect(badge.dataset.reducedMotion).toBe(String(reduced));expect(badge.getAttribute('role')).toBe('status');expect(badge.style.backgroundImage).toContain('fx-atlas.webp');expect(badge.querySelector('button,input,a')).toBeNull();
});
it('recasts distinguish full casts from damage repeats without legacy text banners',()=>{
 showBattleEffectFeedback(stage,[recast(1),recast(2,{scope:'damage'})]);expect(document.querySelectorAll('.fx-art-magic')).toHaveLength(1);expect(document.querySelectorAll('.fx-art-pulse')).toHaveLength(1);expect(document.querySelector('.bt-recast-feedback')).toBeNull();
});
it('monotonic IDs reject replayed events and remain bounded after a large batch',()=>{
 showBattleEffectFeedback(stage,Array.from({length:160},(_,i)=>recast(i+1)));expect(document.querySelectorAll('.bt-fx-art')).toHaveLength(36);
 const last=document.querySelector('.bt-fx-art:last-child');showBattleEffectFeedback(stage,[recast(1)]);expect(document.querySelector('.bt-fx-art:last-child')).toBe(last);
});
it('item feedback targets real units, uses the shared art and deduplicates event IDs',()=>{
 const event={kind:'item-use',eventId:1,battleToken:7,name:'治疗药水',targets:['self',0]};showBattleEffectFeedback(stage,[event,event]);expect(document.querySelectorAll('.fx-art-heal')).toHaveLength(1);expect(document.querySelectorAll('.fx-art-debuff')).toHaveLength(1);expect(document.querySelector('.bt-item-use-feedback')).toBeNull();
});
it('extra turns delegate once to the retained turn-title presenter',()=>{
 const extra=vi.fn();const event={kind:'extra-turn-start',eventId:1,battleToken:7};showBattleEffectFeedback(stage,[event,event],null,extra);expect(extra).toHaveBeenCalledOnce();expect(document.querySelector('.bt-recast-feedback')).toBeNull();
});
it('explicit retention caps local transients at twelve and expiry removes all of them',()=>{
 for(let i=0;i<20;i++){const n=document.createElement('i');n.className='test-notice';stage.append(n);retainBattleFeedback(stage,n,100);}
 expect(stage.querySelectorAll('.test-notice')).toHaveLength(12);finish();expect(stage.querySelector('.test-notice')).toBeNull();
});
it.each(['close','mode','token'])('%s invalidates local badges and artwork',kind=>{
 update(['a','b'],['a'],[arrival('a'),arrival('b')]);showBattleEffectFeedback(stage,[recast(1)]);
 if(kind==='close')document.dispatchEvent(new Event('sdt-overlay-close'));else if(kind==='mode')document.dispatchEvent(new CustomEvent('sdt-overlay-mode',{detail:'settings'}));else{stage._battleToken=8;updateHandAcquisitionFeedback(stage,{battleToken:8,hand:['a']},[],new Map());}
 expect(document.querySelector('.bt-hand-acquired,.bt-hand-page-new,.fx-art-magic')).toBeNull();
});
it('removing the stage clears its pending local feedback',async()=>{
 update(['a'],['a'],[arrival('a')]);stage.remove();await Promise.resolve();expect(timers.every(t=>t.cancelled)).toBe(true);
});
