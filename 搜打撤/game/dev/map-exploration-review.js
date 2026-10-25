import SDT from '../src/core/sdt-facade.js';
import '../src/core/icons-bitmap.js';
import '../src/ui/ui-scale.js';
import '../src/core/camera.js';
import '../src/core/renderer.js';
import { createExplorationLayeredMap } from '../src/run/map-exploration-adapter.js';
import { renderScheduler } from '../src/core/render-scheduler.js';
import { renderExpeditionPanel } from '../src/run/expedition.view.js';

// Actual 7/9 generation and renderer, with in-memory review state and no owner saves.
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),result=document.querySelector('#reviewMapResult');
let seed=25,layer=0,all=false,scheduled=false;
const game={map:{cols:30,rows:30,tile:48},layerIdx:0,trackPos:0,layerData:[],nodes:[],nodePos:[],
  seen:{},visited:{},explored:{},state:'idle',runActive:false,time:1000,toggles:{index:false},nodeRewards:{},
  inventory:[],usedPocket:[],hp:33,maxHp:35};
function redraw(){if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;SDT.Renderer.draw(ctx,game);});}}
renderScheduler.setWake(redraw);
function reveal(){
  const key=`${layer},${game.trackPos}`;game.seen[key]=1;game.visited[key]=1;game.explored[key]=1;
  for(const [li,idx] of game.layerData[layer].logical[game.trackPos].next)if(li===layer)game.seen[`${li},${idx}`]=1;
}
function frame(overview=true){game.cam.frameExploration(game,overview);redraw();}
function install(){
  const layers=createExplorationLayeredMap(seed);
  game.layerData=layers;game.layerIdx=layer;game.trackPos=layers[layer].entrances[0];
  game.nodePos=layers.map(l=>l.logical.map(n=>({x:180+(n.x-l.gridBounds.minX)*180,y:180+(n.row-l.gridBounds.minRow)*180})));
  game.nodes=layers.flatMap((l,li)=>l.logical.map((n,idx)=>({...game.nodePos[li][idx],li,idx,def:n.def})));
  game.geometryVersion=`review-${seed}`;game.seen={};game.visited={};game.explored={};
  game.pos=game.nodePos[layer][game.trackPos];
  if(all)for(let idx=0;idx<layers[layer].logical.length;idx++)game.seen[`${layer},${idx}`]=1;
  else reveal();
  game.runActive=true;renderExpeditionPanel(null,game,icon=>SDT.Icons.img(icon));game.runActive=false;
  resize();result.textContent='';
}
function resize(){
  const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  if(!game.cam)game.cam=new SDT.Camera(game.map,rect.width,rect.height);else game.cam.resize(rect.width,rect.height);
  frame();
}
document.addEventListener('click',e=>{
  const tool=e.target.closest('[data-expedition-tool]')?.dataset.expeditionTool;
  if(tool==='focus'||tool==='overview'){frame(tool==='overview');return;}
  const action=e.target.closest('[data-review]')?.dataset.review;
  if(action==='layer'){layer=(layer+1)%4;install();}
  if(action==='seed'){seed++;install();}
  if(action==='local'){all=false;install();}
  if(action==='known'){all=true;install();}
  if(action==='inset'){game.cam.setDetailInset(game.cam.detailInset?0:game.cam.viewW*.30);frame();}
  if(action==='hide'){document.querySelector('.map-review-tools').hidden=true;result.textContent='';}
  if(action==='check'){
    const l=game.layerData[layer],degree=n=>n.next.filter(([li])=>li===layer).length;
    const ends=l.nodes.filter(n=>n.idx!==l.entrances[0]&&n.idx!==l.exit&&degree(n)===1);
    const loops=l.nodes.reduce((sum,n)=>sum+degree(n),0)/2-l.nodes.length+1;
    result.textContent=`种子${seed} · 第${layer+1}层 · ${l.nodes.length}地点 · ${ends.length}探索尽头 · ${loops}回环。点击相邻地点可展开探索。`;
  }
});
canvas.addEventListener('click',e=>{
  const rect=canvas.getBoundingClientRect(),p=game.cam.screenToWorld(e.clientX-rect.left,e.clientY-rect.top);
  const next=game.layerData[layer].logical[game.trackPos].next.filter(([li])=>li===layer).map(([,idx])=>idx);
  const idx=next.find(i=>Math.hypot(p.x-game.nodePos[layer][i].x,p.y-game.nodePos[layer][i].y)<45/game.cam.zoom);
  if(idx===undefined)return;
  game.trackPos=idx;game.pos=game.nodePos[layer][idx];reveal();redraw();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){document.querySelector('.map-review-tools').hidden=false;result.textContent='';}
});
window.addEventListener('resize',resize);
install();await SDT.Renderer.warm();redraw();
