import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state=vi.hoisted(()=>({scale:1,snap:null,card:{name:'瞄准样例',side:'enemy'}}));
const commands=vi.hoisted(()=>({getCardPlayAvailability:vi.fn(()=>({status:'ready'})),submitCardPlay:vi.fn(),playCard:vi.fn(),bagSlam:vi.fn(),slamSkill:vi.fn(),resolveSlam:vi.fn(),useItem:vi.fn(),cancelPendingTarget:vi.fn()}));
vi.mock('../game/src/battle/core/battle.core.js',()=>({commands,getSnapshot:()=>state.snap,getBattleLiveness:()=>state.snap,findEffectiveCard:()=>({card:state.card}),targetSide:card=>card.side,infuseOf:()=>null}));
vi.mock('../game/src/ui/ui-scale.js',()=>({scale:()=>state.scale,viewport:()=>({width:1920*state.scale,height:1080*state.scale})}));
vi.mock('../game/src/battle/view/battle.hover.js',()=>({showFoePreview:vi.fn(),clearFoePreview:vi.fn(),showThoughtBubble:vi.fn(),clearThoughtBubble:vi.fn()}));
const UI={el:{}};
window.SDT={UI,Sound:{sfx:vi.fn()},Motion:{reduceMotion:()=>true}};
const Aim=await import('../game/src/battle/view/battle.aim.js');
const {BATTLE_PHASES}=await import('../game/src/battle/runtime/battle.state.js');
let frames,clock,ctx,card,box;
const pointer=(type,x,y)=>{const event=new MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true});Object.defineProperty(event,'pointerId',{value:1});return event;};
function step(){clock+=16;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(clock));}
function begin(scale,dpr){
  state.scale=scale;vi.stubGlobal('devicePixelRatio',dpr);
  box={left:100,top:40,width:1920*scale,height:1080*scale};
  Aim.startAim(pointer('pointerdown',250,550),card,'potion');
  window.dispatchEvent(pointer('pointermove',700,300));step();
  return document.getElementById('aimArrow');
}
beforeEach(()=>{
  vi.clearAllMocks();clock=0;frames=new Map();let id=0;
  vi.stubGlobal('requestAnimationFrame',fn=>{frames.set(++id,fn);return id;});
  vi.stubGlobal('cancelAnimationFrame',key=>frames.delete(key));
  ctx=Object.fromEntries(['setTransform','clearRect','beginPath','moveTo','quadraticCurveTo','stroke','lineTo','closePath','fill','arc'].map(name=>[name,vi.fn()]));
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx);
  document.body.innerHTML='<div id="overlay"><div id="body"><div class="battle-stage"><button class="bt-card" data-uid="sample"></button><div class="field"></div></div></div></div>';
  UI.el={overlay:document.getElementById('overlay'),ovBody:document.getElementById('body')};
  card=document.querySelector('.bt-card');card.getBoundingClientRect=()=>({left:200,top:500,width:100,height:100});
  UI.el.overlay.getBoundingClientRect=()=>box;
  document.elementFromPoint=vi.fn(()=>document.querySelector('.field'));
  state.snap={battleToken:'canvas-test',phase:BATTLE_PHASES.PLAYER,foes:[{hp:20,dead:false}],hand:['sample']};
});
afterEach(()=>{Aim.cancelAim();Aim.cancelClickSelection();step();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
it.each([[0.615,1],[0.615,2],[1,1],[1,2],[2,1],[2,2]])('matches displayed pixels at zoom %s and DPR %s without changing CSS or arrow coordinates',(scale,dpr)=>{
  const canvas=begin(scale,dpr);
  expect(canvas.width).toBe(Math.round(box.width*dpr));
  expect(canvas.height).toBe(Math.round(box.height*dpr));
  expect(canvas.style.width).toBe('1920px');expect(canvas.style.height).toBe('1080px');
  expect(ctx.setTransform.mock.calls).toEqual([[1,0,0,1,0,0],[dpr,0,0,dpr,0,0]]);
  expect(ctx.clearRect).toHaveBeenCalledWith(0,0,canvas.width,canvas.height);
  expect(ctx.moveTo.mock.calls[0]).toEqual([150,466]);
  expect(ctx.lineTo.mock.calls).toHaveLength(2);
  expect(ctx.moveTo.mock.calls).toContainEqual([600,260]);
  expect(commands.useItem).not.toHaveBeenCalled();
});
it('reuses the canvas, skips unchanged coordinates, redraws movement once and removes it on cancel',()=>{
  const canvas=begin(0.615,2),draws=ctx.clearRect.mock.calls.length;
  step();step();expect(ctx.clearRect).toHaveBeenCalledTimes(draws);
  window.dispatchEvent(pointer('pointermove',740,320));step();
  expect(document.getElementById('aimArrow')).toBe(canvas);
  expect(ctx.clearRect).toHaveBeenCalledTimes(draws+1);
  expect(ctx.moveTo.mock.calls).toContainEqual([640,280]);
  expect(ctx.clearRect).toHaveBeenLastCalledWith(0,0,canvas.width,canvas.height);
  Aim.cancelAim();step();expect(document.getElementById('aimArrow')).toBeNull();expect(frames.size).toBe(0);
});
