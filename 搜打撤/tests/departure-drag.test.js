import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../game/src/ui/ui-scale.js',()=>({scale:()=>1}));
import { bindDepartureDrag } from '../game/src/hub/departure.drag.js';

let pool,bag,source,add,remove,frames;
beforeEach(()=>{
  document.body.innerHTML='<div id="pool"><div data-name="测试卡" draggable="true"><div class="hs-card">测试卡</div></div></div><div id="bag"></div>';
  pool=document.getElementById('pool');bag=document.getElementById('bag');source=pool.firstElementChild;
  frames=[];vi.stubGlobal('requestAnimationFrame',fn=>{frames.push(fn);return frames.length;});vi.stubGlobal('cancelAnimationFrame',vi.fn());
  source.setPointerCapture=vi.fn();source.hasPointerCapture=()=>true;source.releasePointerCapture=vi.fn();
  source.getBoundingClientRect=()=>({left:0,top:0,right:100,bottom:140,width:100,height:140});
  bag.getBoundingClientRect=()=>({left:200,top:0,right:400,bottom:300,width:200,height:300});
  add=vi.fn();remove=vi.fn();bindDepartureDrag(pool,bag,{add,remove});
});
afterEach(()=>{document.body.replaceChildren();vi.unstubAllGlobals();});
function pointer(type,x,y=20) {const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,button:0,clientX:x,clientY:y});source.dispatchEvent(event);}
it('moves an opaque entity into the bag and restores the source after release',()=>{
  pointer('pointerdown',20);pointer('pointermove',240);frames.at(-1)();
  expect(document.querySelector('.departure-drag-card .hs-card').textContent).toBe('测试卡');
  expect(document.querySelector('.departure-drag-card').style.left).toBe('220px');
  expect(source.classList.contains('dep-drag-source')).toBe(true);
  pointer('pointerup',240);
  expect(add).toHaveBeenCalledExactlyOnceWith('测试卡');expect(remove).not.toHaveBeenCalled();
  expect(document.querySelector('.departure-drag-card')).toBeNull();
  expect(source.classList.contains('dep-drag-source')).toBe(false);
});
it('cancel, light click, and release outside the target do not change carried cards',()=>{
  pointer('pointerdown',20);pointer('pointerup',22);expect(add).not.toHaveBeenCalled();
  pointer('pointerdown',20);pointer('pointermove',150);pointer('pointerup',150);expect(add).not.toHaveBeenCalled();
  pointer('pointerdown',20);pointer('pointermove',240);pointer('pointercancel',240);expect(add).not.toHaveBeenCalled();
  expect(document.querySelector('.departure-drag-card')).toBeNull();
});
