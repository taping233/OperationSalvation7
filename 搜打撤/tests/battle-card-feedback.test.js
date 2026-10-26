import { scale } from '../game/src/ui/ui-scale.js';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { showCardFeedback, clearCardFeedback } from '../game/src/battle/view/battle.card-feedback.js';
let stage, animations;
beforeEach(() => {
  vi.useFakeTimers(); animations=[];
  document.body.innerHTML='<div id="overlay"><div class="battle-stage"><div class="sts-hand"></div><div class="sts-hud-l"><div class="bt-pile"></div></div><div class="sts-foe" data-eidx="1"><div class="sts-figure"></div></div></div></div>';
  stage=document.querySelector('.battle-stage'); stage._battleToken=4;
  window.SDT ||= {}; window.SDT.Motion={reduceMotion:()=>false};
  Element.prototype.animate=vi.fn(function(frames,options){ const animation={cancel:vi.fn(),frames,options}; animations.push(animation); return animation; });
});
afterEach(()=>{delete document.body.dataset.renderQuality;clearCardFeedback();vi.useRealTimers();vi.restoreAllMocks();delete Element.prototype.animate;});
const gain=()=>({kind:'draw',acquired:true,uid:'a',name:'火球',card:{name:'火球'}});
it('settled acquisitions use the shared atlas without card popups or text notices',async()=>{
 const events=[gain(),gain(),gain()], before=JSON.stringify(events);
 showCardFeedback(stage,events);
 expect(document.querySelectorAll('.bt-fx-art.fx-art-draw')).toHaveLength(3);
 expect(document.querySelector('.bt-card-reveal,.bt-card-feedback-overflow')).toBeNull();
 expect(document.querySelector('.bt-fx-art').style.backgroundImage).toContain('fx-atlas.webp');
 expect(document.querySelector('.bt-fx-art').getAttribute('aria-hidden')).toBe('true');
 expect(JSON.stringify(events)).toBe(before);
 await vi.runAllTimersAsync(); expect(document.querySelector('.bt-fx-art')).toBeNull();
});
it('ordinary draws, stale battles and replayed event identities do not duplicate effects',async()=>{
 const event=gain(); showCardFeedback(stage,[event,event,{...gain(),battleToken:3},{...gain(),acquired:false}]);
 expect(document.querySelectorAll('.bt-fx-art')).toHaveLength(1);
 showCardFeedback(stage,[event]); expect(document.querySelectorAll('.bt-fx-art')).toHaveLength(1);
});
it('random casts use magic artwork at the actual target while ordinary arrivals use the hand',async()=>{
 const enemy=stage.querySelector('.sts-figure'); enemy.getBoundingClientRect=()=>({left:700,top:100,right:800,bottom:300,width:100,height:200});
 showCardFeedback(stage,[{kind:'surge',name:'火球',target:1}]);
 const art=document.querySelector('.fx-art-magic'); expect(art).not.toBeNull(); expect(parseFloat(art.style.left)).toBe(750 / scale());
 expect(document.querySelector('.bt-card-reveal')).toBeNull();
});
it.each(['reduced','low'])('%s motion retains a short static effect without animation',async mode=>{
 if(mode==='reduced')window.SDT.Motion.reduceMotion=()=>true;else document.body.dataset.renderQuality='low';
 showCardFeedback(stage,[gain()]); expect(document.querySelector('.fx-art-draw')).not.toBeNull(); expect(animations).toHaveLength(0);
 await vi.advanceTimersByTimeAsync(360); expect(document.querySelector('.bt-fx-art')).toBeNull();
});
it('closing the overlay and explicit cleanup remove the actual atlas timers and animations',async()=>{
 showCardFeedback(stage,[gain()]); document.dispatchEvent(new Event('sdt-overlay-close'));
 expect(vi.getTimerCount()).toBe(0); expect(animations.every(a=>a.cancel.mock.calls.length===1)).toBe(true);
 showCardFeedback(stage,[gain()]); clearCardFeedback(); expect(document.querySelector('.bt-fx-art')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});
it('a new battle token clears old effects and accepts new event identities',async()=>{
 const event=gain(); showCardFeedback(stage,[event]); stage._battleToken=5; showCardFeedback(stage,[]);
 expect(document.querySelector('.bt-fx-art')).toBeNull(); showCardFeedback(stage,[event]); expect(document.querySelectorAll('.bt-fx-art')).toHaveLength(1);
});
it('bursts remain bounded and all pending effects expire',async()=>{
 showCardFeedback(stage,Array.from({length:80},()=>gain())); expect(document.querySelectorAll('.bt-fx-art')).toHaveLength(36);
 expect(document.querySelector('.bt-card-feedback-overflow')).toBeNull(); await vi.runAllTimersAsync(); expect(document.querySelector('.bt-fx-art')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});
