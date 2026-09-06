import { T, disposeScene } from './primitives.js';
import { createMapScene } from './map-scene.js';
import { createBattleScene } from './battle-scene.js';
import { MapCamera } from './camera.js';
const SDT=window.SDT;
const QUALITY={low:.7,standard:1,high:1.25};
let renderer,map,battle,nodeSource,labels,lastLabelKey='',quality='standard';
try{quality=localStorage.getItem('sdt-quality')||'standard';}catch{}
if(!QUALITY[quality])quality='standard';
const metrics={calls:0,triangles:0,geometries:0,textures:0,frames:0,mode:'map',quality};
function ensure(canvas){
  if(renderer)return;
  renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor('#9faeb4');
  labels=document.createElement('div');labels.id='mapLabels';canvas.parentElement.append(labels);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.body.dataset.gpuLost='true';});
  canvas.addEventListener('webglcontextrestored',()=>{delete document.body.dataset.gpuLost;SDT.RenderScheduler.invalidate();});
}
function draw(_,game){
  const canvas=document.getElementById('game');ensure(canvas);
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  const ratio=Math.min(window.devicePixelRatio||1,2)*QUALITY[quality];
  if(renderer.getPixelRatio()!==ratio||canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);}
  const stage=document.querySelector('.battle-stage');
  const battleActive=!!stage&&game.battleActive;
  document.body.classList.toggle('scene-battle-3d',battleActive);labels.hidden=battleActive;
  if(battleActive){
    battle ||= createBattleScene();const snapshot=SDT.Battle.getSnapshot();
    battle.sync(snapshot,game.time,canvas.getBoundingClientRect());renderer.render(battle.scene,battle.camera);metrics.mode='battle';
  }else{
    if(nodeSource!==game.nodes){if(map)disposeScene(map.scene);map=createMapScene(game);nodeSource=game.nodes;lastLabelKey='';labels.replaceChildren();for(const n of map.labels){const e=document.createElement('span');e.className='map-label';e.textContent=n.def.type==='boss'?'首领':n.def.type==='altar'?'核心':String(n.idx+1).padStart(2,'0');e.dataset.layer=n.li;labels.append(e);}}
    game.cam.sync();map.update(game.time);renderer.render(map.scene,game.cam.camera);metrics.mode='map';
    const labelKey=[game.cam.cx,game.cam.cy,game.cam.zoom,game.cam.angle,w,h,game.layerIdx].join('|');
    if(labelKey!==lastLabelKey){lastLabelKey=labelKey;const p=new T.Vector3();map.labels.forEach((n,i)=>{p.set(n.wx,.30,n.wz).project(game.cam.camera);const e=labels.children[i];e.style.transform=`translate(${(p.x+1)*w/2}px,${(1-p.y)*h/2+12}px)`;e.hidden=p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;e.classList.toggle('current',n.li===game.layerIdx);});}
  }
  Object.assign(metrics,{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,frames:metrics.frames+1});
  // The retired 2D FX queues still receive domain notifications; expire them without a second renderer.
  const now=performance.now();for(const key of ['floats','pulses','shakes'])if(SDT.FX?.[key])SDT.FX[key].splice(0,SDT.FX[key].length);
}
function setQuality(value){if(!QUALITY[value])return;quality=value;metrics.quality=value;localStorage.setItem('sdt-quality',value);SDT.RenderScheduler.invalidate();}
SDT.Camera=MapCamera;
SDT.Renderer={draw,metrics,setQuality};
export { metrics,setQuality };
