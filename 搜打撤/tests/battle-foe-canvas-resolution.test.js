import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({scale:1,pace:1,floats:[],queue:[],cleanup:[]}));
vi.mock('../game/src/battle/core/battle.core.js',()=>({takeFloats:()=>state.floats.splice(0)}));
vi.mock('../game/src/battle/view/battle.frames.js',()=>({play:()=>false}));
vi.mock('../game/src/battle/runtime/battle.pace.js',()=>({demoMs:ms=>ms/state.pace,getPace:()=>state.pace}));
vi.mock('../game/src/battle/runtime/battle.clock.js',()=>({schedulePresentation:(fn,ms)=>state.cleanup.push({fn,ms}),schedulePresentationMs:(fn,ms)=>{state.cleanup.push({fn,ms});return()=>{};},waitHitStop:()=>Promise.resolve()}));
vi.mock('../game/src/battle/view/battle.feedback.js',()=>({FEEDBACK_DELTA_MS:100,enqueueFeedback:fn=>state.queue.push(fn),feedbackClass:()=>'',feedbackDelay:()=>0,feedbackShakeDuration:()=>100,waitMs:()=>Promise.resolve()}));
vi.mock('../game/src/ui/ui-scale.js',()=>({scale:()=>state.scale,rect:el=>Object.fromEntries(Object.entries(el.getBoundingClientRect()).map(([k,v])=>[k,v/state.scale]))}));
const UI={el:{}};window.SDT={UI,Motion:{reduceMotion:()=>false},Sound:{sfx:vi.fn()}};
const {spawnFloats}=await import('../game/src/battle/view/battle.vfx.js');
const {clearBattleArt}=await import('../game/src/battle/view/battle.fx-art.js');
let animations;
beforeEach(()=>{
 state.scale=1;state.pace=1;state.floats.length=0;state.queue.length=0;state.cleanup.length=0;animations=[];
 document.body.innerHTML='<div id="overlay"><div id="battleBody"><div class="battle-stage"><div id="btSelf"><div class="sts-figure"></div></div><div class="sts-foe" data-eidx="0"><div class="sts-figure"></div></div></div></div></div>';
 UI.el.overlay=document.getElementById('overlay');
 for(const[el,left,top,width,height]of [[UI.el.overlay,100,40,1920,1080],[document.querySelector('.sts-foe .sts-figure'),1300,240,200,400],[document.querySelector('#btSelf .sts-figure'),300,340,200,400]])el.getBoundingClientRect=()=>({left:left*state.scale,top:top*state.scale,width:width*state.scale,height:height*state.scale});
 Element.prototype.animate=vi.fn(function(frames,options){const animation={cancel:vi.fn(),frames,options};animations.push({node:this,animation});return animation;});
});
afterEach(()=>{clearBattleArt();delete Element.prototype.animate;vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
async function attack(scale,dpr){state.scale=scale;vi.stubGlobal('devicePixelRatio',dpr);state.floats.push({unit:0,text:'',cls:'lungefx'});spawnFloats(document.getElementById('battleBody'));await state.queue[0](new AbortController().signal);return document.querySelector('.fx-art-trail');}
it.each([[.615,1],[.615,2],[1,1],[1,2],[2,1],[2,2]])('atlas trajectory keeps logical geometry at zoom %s / DPR %s',async(scale,dpr)=>{
 const art=await attack(scale,dpr);expect(art).not.toBeNull();expect(art.style.left).toBe('1300px');expect(art.style.top).toBe('368px');expect(art.style.width).toBe('130px');expect(art.style.backgroundImage).toContain('fx-atlas.webp');expect(document.querySelector('canvas')).toBeNull();
 const flight=animations.find(a=>a.node===art).animation;expect(flight.frames.at(-1).transform).toContain('translate(-1000px,100px)');
});
it.each([1,2])('atlas flight follows pace %s and both animation completion and fallback remove it',async pace=>{
 state.pace=pace;const art=await attack(.615,1),flight=animations.find(a=>a.node===art).animation;
 expect(flight.options.duration).toBe(300/pace);expect(state.cleanup.some(t=>t.ms===300/pace+80)).toBe(true);
 flight.onfinish();expect(art.isConnected).toBe(false);expect(flight.cancel).toHaveBeenCalledOnce();
 const next=await attack(.615,1);for(const t of state.cleanup)t.fn();expect(next.isConnected).toBe(false);
});
