import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHandHitController } from '../game/src/battle/view/battle.hand-hit.js';
let root, cards, controller, aiming, down, play, delegated;
const box = (left, top, width, height) => ({ left, top, right:left+width, bottom:top+height, width, height });
function event(target, type, { x=220, y=320, pointerType='mouse', id=1, detail=1, button=0, primary=true }={}) {
  const e = new MouseEvent(type, { bubbles:true, cancelable:true, clientX:x, clientY:y, detail, button });
  Object.defineProperties(e, { pointerId:{value:id}, pointerType:{value:pointerType}, isPrimary:{value:primary} });
  target.dispatchEvent(e); return e;
}
beforeEach(() => {
  document.body.innerHTML='<div id="parent"><div id="hand"></div></div>';
  root=document.getElementById('hand'); aiming=false;
  cards=['7','8'].map((uid,i) => {
    const slot=document.createElement('div'); slot.className='bt-slot';slot.style.setProperty('--hand-rest','64px');
    slot.innerHTML=`<div class="bt-card" data-uid="${uid}"><div class="art"></div><div class="hsc-desc">规则<span data-term="poison">中毒</span></div><button class="bt-infchip">注能</button></div>`;
    const card=slot.firstElementChild;
    slot.getBoundingClientRect=()=>box(100+i*80,200,160,296);
    card.getBoundingClientRect=()=>box(100+i*80,200,160,232);
    Object.defineProperty(card,'offsetHeight',{value:232});
    card.querySelector('.bt-infchip').getBoundingClientRect=()=>box(200+i*80,220,50,20);
    card.querySelector('.hsc-desc').getBoundingClientRect=()=>box(100+i*80,400,160,40);
    root.appendChild(slot);return card;
  });
  down=vi.fn();play=vi.fn();delegated=vi.fn();root.parentElement.addEventListener('click',delegated);
  controller=createHandHitController(root,{getCards:()=>cards,scale:()=>1,isAiming:()=>aiming,onPointerDown:down,onPlay:play});controller.sync(1);
});
afterEach(()=>controller.dispose());
it('uses one real UID for hover, down and click from either incoming card, and dispatches only once',()=>{
  for(const card of cards){
    event(card,'pointermove');expect(cards[1].parentElement.classList.contains('hand-reading')).toBe(true);
    event(card,'pointerdown');event(card,'click');
    expect(down.mock.lastCall[1]).toBe(cards[1]);expect(play.mock.lastCall).toEqual(['8']);
  }
  expect(play).toHaveBeenCalledTimes(2);expect(delegated).not.toHaveBeenCalled();
});
it('holds the press UID through a layout change without selecting the replacement under the release',()=>{
  event(cards[0],'pointerdown',{x:150});event(cards[1],'click',{x:290});expect(play).toHaveBeenCalledWith('7');
});
it('does not issue a click play after aim starts or finishes on this gesture',()=>{
  down.mockImplementation(()=>{aiming=true;});event(cards[0],'pointerdown');aiming=false;
  event(cards[0],'click');expect(play).not.toHaveBeenCalled();expect(delegated).not.toHaveBeenCalled();
});
it('keeps the continuous raised reading-to-button route and native button action',()=>{
  event(cards[0],'pointermove',{x:150});
  event(cards[1],'pointermove',{x:220,y:280});
  expect(cards[0].parentElement.classList.contains('hand-reading')).toBe(true);
  const button=cards[0].querySelector('button');event(button,'pointerdown',{x:220,y:230});event(button,'click',{x:220,y:230});
  expect(down).not.toHaveBeenCalled();expect(play).not.toHaveBeenCalled();expect(delegated).toHaveBeenCalledTimes(1);
});
it('preserves text/keyword reading and does not start dragging or play through the text',()=>{
  const desc=cards[0].querySelector('.hsc-desc');event(desc,'pointerdown');event(desc,'click');
  const keyword=desc.firstElementChild;event(keyword,'pointerdown');
  expect(down).not.toHaveBeenCalled();expect(play).not.toHaveBeenCalled();expect(delegated).not.toHaveBeenCalled();
});
it('never snaps empty space and rejects nonprimary/right presses',()=>{
  event(root,'pointermove',{x:20});event(root,'pointerdown',{x:20});event(root,'click',{x:20});
  event(cards[0],'pointerdown',{primary:false});event(cards[0],'pointerdown',{button:2});
  expect(down).not.toHaveBeenCalled();expect(play).not.toHaveBeenCalled();expect(root.querySelector('.hand-reading')).toBeNull();
});
it('touch does not inherit mouse reading ownership and keyboard click retains its native path',()=>{
  event(cards[0],'pointermove',{x:150});event(cards[1],'pointerdown',{x:220,y:280,pointerType:'touch'});
  expect(down.mock.lastCall[1]).toBe(cards[1]);
  event(cards[0],'click',{detail:0});expect(play).not.toHaveBeenCalled();expect(delegated).toHaveBeenCalledOnce();
});
it('clears owner and stale press on page/UID changes, blur and pointercancel',()=>{
  event(cards[0],'pointerdown',{x:150});cards[0].dataset.uid='replacement';controller.sync(1);
  expect(root.querySelector('.hand-reading')).toBeNull();
  event(cards[0],'click');expect(play).not.toHaveBeenCalled();
  event(cards[1],'pointermove');window.dispatchEvent(new Event('blur'));expect(root.querySelector('.hand-reading')).toBeNull();
  event(cards[1],'pointermove');event(cards[1],'pointercancel');expect(root.querySelector('.hand-reading')).toBeNull();
  event(cards[1],'pointermove');controller.sync(2);expect(root.querySelector('.hand-reading')).toBeNull();
});
it('ignores inactive/inert cards and never captures an existing aim',()=>{
  cards[1].setAttribute('inert','');event(cards[0],'pointerdown');expect(down.mock.lastCall[1]).toBe(cards[0]);
  down.mockClear();aiming=true;event(cards[0],'pointerdown');event(cards[0],'click');expect(down).not.toHaveBeenCalled();expect(play).not.toHaveBeenCalled();
});
it('shares the production command callback and keeps production CSS scoped away from original fixture mode',()=>{
  const view=readFileSync('game/src/battle/view/battle.view.js','utf8');
  const layers=readFileSync('game/src/battle/view/battle.layers.js','utf8');
  const css=readFileSync('game/css/battle-stage.css','utf8');
  expect(view).toContain("UI.act('btPlay', playHandCard)");expect(view).toContain('mountHandLayer(body, tip, snapshot.battleToken, playHandCard)');
  expect(layers).toContain("onPointerDown: (event, card) => { if (card.dataset.aim === '1') startAim(event, card); }");
  expect(layers).not.toContain("rec.slot.addEventListener('pointerdown'");
  expect(css).toContain(':where(.sts-hand:not([data-hand-hit="fixed"])) .bt-slot:hover');
  expect(css).toContain('.bt-slot:is(.hand-reading,:has(:focus-visible))');
});

it('routes a physical click without down through the current fixed region once',()=>{
  event(cards[0],'click');expect(play).toHaveBeenCalledExactlyOnceWith('8');expect(delegated).not.toHaveBeenCalled();
});
it('leaves existing window capture cancellation ahead of local click dispatch',()=>{
  const cancel=vi.fn(()=>{aiming=false;});
  window.addEventListener('click',cancel,{capture:true,once:true});
  down.mockImplementation(()=>{aiming=true;});event(cards[0],'pointerdown');event(cards[0],'click');
  expect(cancel).toHaveBeenCalledOnce();expect(play).not.toHaveBeenCalled();
});
it('uses viewport geometry consistently at non-unit zoom',()=>{
  controller.dispose();
  controller=createHandHitController(root,{getCards:()=>cards,scale:()=>0.5,isAiming:()=>aiming,onPointerDown:down,onPlay:play});
  event(cards[0],'pointerdown',{x:220,y:240});event(cards[0],'click',{x:220,y:240});
  expect(down.mock.lastCall[1]).toBe(cards[1]);expect(play).toHaveBeenCalledExactlyOnceWith('8');
});

it('does not start a new pickup when the existing aim consumes this pointerdown before hand capture',()=>{
  aiming=true;
  const finish=vi.fn(()=>{aiming=false;});
  window.addEventListener('pointerdown',finish,{capture:true,once:true});
  event(cards[0],'pointerdown');
  expect(finish).toHaveBeenCalledOnce();expect(down).not.toHaveBeenCalled();
});
