import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { showRewardCardFeedback } from '../game/src/ui/reward-card-feedback.js';
import { clearCardFeedback } from '../game/src/ui/card-result-feedback.js';
let stage, animate;
const card={id:'a',name:'圣光治愈'};
beforeEach(()=>{
 vi.useFakeTimers();
 document.body.innerHTML='<div id="overlay"><div id="ovBody"><section class="reward-replica"><span data-card-receive-anchor="bag">背包 2/16</span></section></div></div>';
 stage=document.querySelector('#ovBody');
 window.SDT ||= {};window.SDT.Motion={reduceMotion:()=>false};window.SDT.Cards={cardHTML:c=>`<b>${c.name}</b>`};
 animate=vi.fn(()=>({cancel:vi.fn()}));Element.prototype.animate=animate;
});
afterEach(()=>{clearCardFeedback();vi.useRealTimers();delete Element.prototype.animate;});
it('shows only supplied successful cards, groups copies and never grants',()=>{
 const grant=vi.fn();window.SDT.game={grantCard:grant};
 showRewardCardFeedback(stage,[]);expect(document.querySelector('.bt-card-reveal')).toBeNull();
 showRewardCardFeedback(stage,[card,{id:'b',name:'冰箭'},card]);
 expect([...document.querySelectorAll('.bt-card-reveal-caption')].map(n=>n.textContent)).toEqual(['已入背包 ×2','已入背包']);
 expect(grant).not.toHaveBeenCalled();expect(card).toEqual({id:'a',name:'圣光治愈'});
});
it('flies to an actually visible bag anchor and falls back to a truthful static destination when hidden',()=>{
 const anchor=stage.querySelector('[data-card-receive-anchor]');
 anchor.getBoundingClientRect=()=>({left:800,top:700,width:120,height:40});
 showRewardCardFeedback(stage,[card]);vi.advanceTimersByTime(480);
 expect(document.querySelector('.bt-card-arrival')).not.toBeNull();
 clearCardFeedback();anchor.hidden=true;showRewardCardFeedback(stage,[card]);vi.advanceTimersByTime(480);
 expect(document.querySelector('.bt-card-arrival')).toBeNull();
 expect(document.querySelector('.bt-card-reveal-caption').textContent).toBe('已入背包');
});
it('keeps fast reward rerenders in one queue but cancels on leaving the reward scene',async()=>{
 showRewardCardFeedback(stage,[card],{token:'run'});
 stage.innerHTML='<section class="reward-replica">next claim</section>';
 showRewardCardFeedback(stage,[card],{token:'run'});await Promise.resolve();
 expect(document.querySelectorAll('.bt-card-reveal')).toHaveLength(2);
 stage.innerHTML='<section>backpack</section>';await Promise.resolve();
 expect(document.querySelector('.bt-card-feedback-layer')).toBeNull();expect(vi.getTimerCount()).toBe(0);
});
it('respects reduced motion and clears when overlay closes or changes mode',()=>{
 window.SDT.Motion.reduceMotion=()=>true;showRewardCardFeedback(stage,[card]);
 expect(document.querySelector('.bt-card-reveal').dataset.reducedMotion).toBe('true');expect(animate).not.toHaveBeenCalled();
 document.dispatchEvent(new CustomEvent('sdt-overlay-mode',{detail:'page'}));
 expect(document.querySelector('.bt-card-reveal')).toBeNull();expect(vi.getTimerCount()).toBe(0);
 showRewardCardFeedback(stage,[card]);document.dispatchEvent(new Event('sdt-overlay-close'));
 expect(document.querySelector('.bt-card-reveal')).toBeNull();expect(vi.getTimerCount()).toBe(0);
});

it('does not fly toward a capacity label scrolled outside the visible overlay',()=>{
 document.querySelector('#overlay').getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});
 stage.querySelector('[data-card-receive-anchor]').getBoundingClientRect=()=>({left:200,top:900,width:100,height:30});
 showRewardCardFeedback(stage,[card]);vi.advanceTimersByTime(480);
 expect(document.querySelector('.bt-card-arrival')).toBeNull();
 expect(document.querySelector('.bt-card-reveal-caption').textContent).toBe('已入背包');
});
