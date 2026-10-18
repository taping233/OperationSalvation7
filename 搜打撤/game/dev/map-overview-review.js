import SDT from '../src/core/sdt-facade.js';
import '../src/core/icons-bitmap.js';
import '../src/ui/ui-scale.js';
import '../src/core/camera.js';
import '../src/core/renderer.js';
import { renderScheduler } from '../src/core/render-scheduler.js';
import { renderExpeditionPanel } from '../src/run/expedition.view.js';

// Fixed visible test data, not a saved expedition. Unknown identities remain renderer-owned.
const positions=Array.from({length:24},(_,i)=>({x:180+(i%6)*180,y:180+Math.floor(i/6)*180}));
const types=['entrance','event','battle','fire','chest','shop'];
const logical=positions.map((_,i)=>({def:{type:types[i%types.length]},next:[i%6<5?[0,i+1]:null,i%6>0?[0,i-1]:null,i<18?[0,i+6]:null,i>=6?[0,i-6]:null].filter(Boolean)}));
const game={map:{cols:30,rows:30,tile:48},layerIdx:0,trackPos:7,nodePos:[positions],layerData:[{name:'风雪哨线',doors:[],logical}],
  nodes:positions.map((p,idx)=>({...p,li:0,idx,def:logical[idx].def})),seen:{'0,1':1,'0,6':1,'0,7':1,'0,8':1,'0,13':1},visited:{'0,7':1},
  pos:positions[7],state:'idle',runActive:false,time:1000,toggles:{index:true},nodeRewards:{},inventory:[],usedPocket:[],hp:33,maxHp:35};
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),result=document.querySelector('#reviewMapResult');
let scheduled=false;
function draw(){scheduled=false;SDT.Renderer.draw(ctx,game);}
function redraw(){if(!scheduled){scheduled=true;requestAnimationFrame(draw);}}
renderScheduler.setWake(redraw);
function resize(){
 const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
 canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 if(!game.cam)game.cam=new SDT.Camera(game.map,rect.width,rect.height);else game.cam.resize(rect.width,rect.height);
 game.cam.frameExploration(game,game.cam.frameMode==='overview');redraw();
}
game.runActive=true;
renderExpeditionPanel(null,game,icon=>SDT.Icons.img(icon));
// Freeze the fixture scene rather than starting live travel/glow clocks.
game.runActive=false;
resize();window.addEventListener('resize',resize);
function frame(overview){game.cam.frameExploration(game,overview);result.textContent='';redraw();}
document.addEventListener('click',e=>{
 const tool=e.target.closest('[data-expedition-tool]')?.dataset.expeditionTool;
 if(tool==='focus'||tool==='overview'){frame(tool==='overview');return;}
 const action=e.target.closest('[data-review]')?.dataset.review;
 if(action==='local'){game.seen={'0,1':1,'0,6':1,'0,7':1,'0,8':1,'0,13':1};frame(true);}
 if(action==='known'){game.seen=Object.fromEntries(positions.map((_,i)=>[`0,${i}`,1]));frame(true);}
 if(action==='inset'){game.cam.setDetailInset(game.cam.detailInset?0:game.cam.viewW*.30);frame(game.cam.frameMode==='overview');}
 if(action==='hide'){document.querySelector('.map-review-tools').hidden=true;result.textContent='';}
 if(action==='check'){
  const points=positions.map(p=>game.cam.worldToScreen(p.x,p.y));
  const inside=points.filter(p=>p.x>=0&&p.x<=game.cam.viewW-game.cam.detailInset&&p.y>=0&&p.y<=game.cam.viewH).length;
  result.textContent=`${game.cam.frameMode==='overview'?'全景':'定位'} · 可见中心 ${inside}/${points.length} · 缩放 ${game.cam.zoom.toFixed(3)}。几何计数不代替节点标签、迷雾或美术验收。`;
 }
});
document.addEventListener('keydown',e=>{
 if(e.target?.matches?.('input,select,textarea'))return;
 if(e.key.toLowerCase()==='g')frame(true);
 if(e.key.toLowerCase()==='f')frame(false);
 if(e.key==='Escape'){document.querySelector('.map-review-tools').hidden=false;result.textContent='';}
});
await SDT.Renderer.warm();redraw();
