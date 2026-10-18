import { readFileSync } from 'node:fs';
import { it, expect, afterEach, vi } from 'vitest';
import { reduceMotion, refreshReduceMotion } from '../game/src/core/motion.js';
import { showCardFeedback, clearCardFeedback } from '../game/src/battle/view/battle.card-feedback.js';
afterEach(()=>{clearCardFeedback();localStorage.removeItem('sdt-reduce-motion');refreshReduceMotion();vi.restoreAllMocks();vi.useRealTimers();});
it('the real saved motion preference immediately drives the card feedback node after refresh',()=>{
 vi.useFakeTimers();
 document.body.innerHTML='<div id="overlay"><div class="battle-stage"><div class="sts-hand"></div></div></div>';
 const stage=document.querySelector('.battle-stage');stage._battleToken=1;
 localStorage.setItem('sdt-reduce-motion','1');refreshReduceMotion();
 expect(reduceMotion()).toBe(true);
 showCardFeedback(stage,[{kind:'draw',acquired:true,name:'测试牌'}]);
 expect(document.querySelector('.bt-card-reveal').dataset.reducedMotion).toBe('true');
 expect(document.body.classList.contains('reduce-motion')).toBe(true);
 vi.runAllTimers();expect(document.querySelector('.bt-card-reveal')).toBeNull();
 localStorage.setItem('sdt-reduce-motion','0');refreshReduceMotion();
 expect(reduceMotion()).toBe(false);
 showCardFeedback(stage,[{kind:'draw',acquired:true,name:'测试牌'}]);
 expect(document.querySelector('.bt-card-reveal').dataset.reducedMotion).toBe('false');
});
it('the fixture uses the real motion module and its isolated preference instead of a replacement facade',()=>{
 const html=readFileSync('game/dev/card-feedback-review.html','utf8');
 expect(html).toContain("import { reduceMotion, refreshReduceMotion } from '/src/core/motion.js'");
 expect(html).toContain("localStorage.setItem('sdt-reduce-motion'");
 expect(html).not.toContain("sdtDefine('Motion'");
 expect(html).toContain('refreshReduceMotion();');
});
