import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { showCardFeedback, clearCardFeedback, CARD_FEEDBACK_LAYOUT } from '../game/src/battle/view/battle.card-feedback.js';
let stage, animations;
beforeEach(() => {
  vi.useFakeTimers(); animations=[];
  document.body.innerHTML='<div id="overlay"><div class="battle-stage"><div class="sts-hand"><div class="bt-card" data-uid="a"><span class="hsc-name">火球</span></div></div><div class="sts-hud-l"><div class="bt-pile"></div></div><div class="sts-foe" data-eidx="1"><div class="sts-figure"></div></div></div></div>';
  stage=document.querySelector('.battle-stage');stage._battleToken=4;
  window.SDT ||= {};
  window.SDT.Motion={reduceMotion:()=>false};
  window.SDT.Cards={cardHTML:card=>`<div class="hs-card sm"><b>${card.name}</b><span tabindex="0">规则</span></div>`};
  Element.prototype.animate=vi.fn(function(frames,options){const animation={cancel:vi.fn(),frames,options,node:this};animations.push(animation);return animation;});
});
afterEach(()=>{delete document.body.dataset.renderQuality;clearCardFeedback();vi.useRealTimers();delete Element.prototype.animate;});
const gain=()=>({kind:'draw',acquired:true,uid:'a',name:'火球',card:{name:'火球'}});
it('shows the actual face, merges identical gains, does not mutate events or block commands',()=>{
 const events=[gain(),gain(),gain()];const before=JSON.stringify(events);
 expect(showCardFeedback(stage,events)).toBeUndefined();
 expect(document.querySelectorAll('.bt-card-reveal')).toHaveLength(1);
 expect(document.querySelector('.bt-card-reveal').textContent).toContain('入手 ×3');
 expect(document.querySelector('.bt-card-reveal [tabindex]').tabIndex).toBe(-1);
 expect(JSON.stringify(events)).toBe(before);
 vi.runAllTimers();expect(document.querySelectorAll('.bt-card-reveal,.bt-card-arrival')).toHaveLength(0);
});
it('ignores ordinary draws, queued-cast acquisitions, stale battles and replayed events',()=>{
 const event=gain();showCardFeedback(stage,[event,event,{...gain(),battleToken:3},{...gain(),acquired:false},{...gain(),source:'pouch'}]);
 expect(document.querySelectorAll('.bt-card-reveal')).toHaveLength(1);
 showCardFeedback(stage,[event]);expect(document.querySelectorAll('.bt-card-reveal')).toHaveLength(1);
});
it('keeps random casts in two nonblocking lanes and aims at the actual enemy',()=>{
 const enemy=stage.querySelector('.sts-figure');enemy.getBoundingClientRect=()=>({left:700,top:100,width:100,height:200});
 showCardFeedback(stage,[1,2,3,4].map(i=>({kind:'surge',name:'火球',card:{name:'火球'},target:1,targetName:'敌二',i,n:4})));
 expect(document.querySelectorAll('.bt-card-reveal')).toHaveLength(2);
 vi.advanceTimersByTime(480);
 expect(document.querySelectorAll('.bt-card-arrival')).toHaveLength(2);
 expect(animations.some(a=>a.frames.some(f=>f.transform?.includes('scale(.16)')))).toBe(true);
 vi.runAllTimers();expect(document.querySelectorAll('.bt-card-reveal')).toHaveLength(0);
});
it('reduced motion keeps static readable feedback without flights or rings',()=>{
 window.SDT.Motion.reduceMotion=()=>true;showCardFeedback(stage,[gain()]);
 expect(document.querySelector('.bt-card-reveal').dataset.reducedMotion).toBe('true');
 vi.runAllTimers();expect(animations).toHaveLength(0);expect(document.querySelector('.bt-card-reveal')).toBeNull();
});
it('cancels all timers and animations on close, token changes, or removal',async()=>{
 showCardFeedback(stage,[gain()]);document.dispatchEvent(new Event('sdt-overlay-close'));
 expect(vi.getTimerCount()).toBe(0);expect(animations.every(a=>a.cancel.mock.calls.length)).toBe(true);
 showCardFeedback(stage,[gain()]);stage._battleToken=5;showCardFeedback(stage,[]);
 expect(document.querySelector('.bt-card-feedback-layer')).toBeNull();
 showCardFeedback(stage,[gain()]);stage.remove();await Promise.resolve();
 expect(vi.getTimerCount()).toBe(0);expect(document.querySelector('.bt-card-feedback-layer')).toBeNull();
});
it('bounds burst nodes and preserves overflow quantity',()=>{
 showCardFeedback(stage,Array.from({length:40},(_,i)=>({...gain(),name:`卡${i}`})));
 expect(document.querySelectorAll('.bt-card-reveal')).toHaveLength(2);
 expect(document.querySelector('.bt-card-feedback-overflow').textContent).toContain('32');
 vi.runAllTimers();expect(document.querySelectorAll('.bt-card-reveal,.bt-card-feedback-overflow')).toHaveLength(0);
});

it('renews overflow lifetime after a later burst and clears only the current count',()=>{
 const burst=base=>Array.from({length:12},(_,i)=>({kind:'shuffle',name:base+i}));
 showCardFeedback(stage,burst('a'));vi.advanceTimersByTime(1000);showCardFeedback(stage,burst('b'));
 const badge=document.querySelector('.bt-card-feedback-overflow');
 expect(badge.textContent).toContain('12');vi.advanceTimersByTime(801);
 expect(document.querySelector('.bt-card-feedback-overflow')).toBe(badge);
 expect(badge.textContent).toContain('12');vi.advanceTimersByTime(999);
 expect(document.querySelector('.bt-card-feedback-overflow')).toBeNull();
});

it('maps the larger 2:3 card size and readable captions to two nonoverlapping central lanes',()=>{
 stage.getBoundingClientRect=()=>({left:0,top:0,width:1920,height:1080});
 showCardFeedback(stage,[gain(),{...gain(),name:'冰箭'}]);
 const layer=document.querySelector('.bt-card-feedback-layer'),nodes=[...document.querySelectorAll('.bt-card-reveal')];
 expect(CARD_FEEDBACK_LAYOUT.width).toBe(240);expect(CARD_FEEDBACK_LAYOUT.height).toBe(360);
 expect(layer.style.getPropertyValue('--card-feedback-width')).toBe('240px');
 expect(layer.style.getPropertyValue('--card-feedback-height')).toBe('360px');
 expect(layer.style.getPropertyValue('--card-feedback-captionFont')).toBe('21px');
 const left=nodes.map(node=>parseFloat(node.style.left)),top=parseFloat(nodes[0].style.top);
 expect(left[1]-left[0]).toBe(288);expect(left[0]+240).toBeLessThan(left[1]);
 expect(top).toBe(360);expect(top+360).toBeLessThan(800);
 expect((left[0]+left[1])/2+120).toBe(960);
});

it('low quality shares the static feedback contract and winter theme without flight timers changing settlement',()=>{
 document.body.dataset.renderQuality='low';showCardFeedback(stage,[gain()]);
 expect(document.querySelector('.bt-card-feedback-layer').classList.contains('sdt-feedback-theme')).toBe(true);
 expect(document.querySelector('.bt-card-reveal').dataset.reducedMotion).toBe('true');
 vi.runAllTimers();expect(animations).toHaveLength(0);expect(document.querySelector('.bt-card-reveal')).toBeNull();
});
