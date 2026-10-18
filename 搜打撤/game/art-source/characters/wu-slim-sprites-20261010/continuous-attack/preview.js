import {createAttackRenderer,SIZE,pose,geometry} from './rig.js';
import {createRenderer as createIdle} from '../continuous-idle/motion.js';
import {zip} from '../continuous-idle/zip.js';
const load=async url=>{const im=new Image();im.src=url;await im.decode();return im;};
const stage=document.querySelector('#stage'),status=document.querySelector('#status');
stage.width=SIZE.width;stage.height=SIZE.height;document.querySelector('.stage').style.aspectRatio='1';
let mode='idle',phase=0,elapsed=0,last=0,playing=true,loop=false,exporting=false;
const [base,repair,neutral]=await Promise.all(['base.png','body-repair.png','../continuous-idle/frames/idle-000.png'].map(load));
const attack=createAttackRenderer(stage,base,repair,neutral);
const idleCanvas=document.createElement('canvas');idleCanvas.width=576;idleCanvas.height=560;
const idle=createIdle(idleCanvas,base),ctx=stage.getContext('2d');
const history=[];
function show(){
 if(mode==='idle'){idle(Math.floor((elapsed%3000)/3000*72)/72,2);ctx.clearRect(0,0,SIZE.width,SIZE.height);ctx.drawImage(idleCanvas,SIZE.padX,SIZE.padY);status.textContent=`两倍待机 · ${playing?'播放中':'已暂停'}`;}
 else{const index=Math.min(SIZE.frames-1,Math.floor(phase*(SIZE.frames-1)+.0001));attack(index/(SIZE.frames-1),document.querySelector('#joints').checked);status.textContent=`攻击 ${index+1}/${SIZE.frames} · ${phase<.30?'举剑':phase<.50?'前挥':phase<.82?'收势':'收回'} · ${playing?'播放中':'已暂停'}`;}
 document.body.dataset.mode=mode;document.body.dataset.phase=String(phase);document.body.dataset.ready='true';
}
function start(){mode='attack';phase=0;playing=true;document.querySelector('#pause').textContent='暂停';show();history.push('attack');}
for(const b of document.querySelectorAll('button'))b.disabled=false;
document.querySelector('#attack').addEventListener('click',()=>{loop=false;document.querySelector('#loop').textContent='循环演示';start();});
document.querySelector('#loop').addEventListener('click',()=>{loop=!loop;document.querySelector('#loop').textContent=loop?'停止循环':'循环演示';if(loop)start();});
document.querySelector('#pause').addEventListener('click',()=>{playing=!playing;document.querySelector('#pause').textContent=playing?'暂停':'继续';show();});
document.querySelector('#step').addEventListener('click',()=>{mode='attack';playing=false;phase=((Math.floor(phase*(SIZE.frames-1)+.0001)+1)%SIZE.frames)/(SIZE.frames-1);document.querySelector('#pause').textContent='继续';show();});
document.querySelector('#joints').addEventListener('change',show);
document.querySelector('#export').addEventListener('click',async()=>{
 exporting=true;const controls=[...document.querySelectorAll('button,input')];controls.forEach(c=>c.disabled=true);const files=[];
 try{
  for(let i=0;i<SIZE.frames;i++){attack(i/(SIZE.frames-1),false);const blob=await new Promise(resolve=>stage.toBlob(resolve,'image/png'));if(!blob)throw new Error('导出失败');files.push({name:`frames/attack-${String(i).padStart(3,'0')}.png`,bytes:new Uint8Array(await blob.arrayBuffer())});status.textContent=`导出 ${i+1}/${SIZE.frames}`;}
  for(const [name,part] of Object.entries(attack.parts)){const blob=await new Promise(resolve=>part.toBlob(resolve,'image/png'));files.push({name:`parts/${name}.png`,bytes:new Uint8Array(await blob.arrayBuffer())});}
  const spec={...SIZE,character:'wu',animation:'attack',loop:false,endpointSource:'../continuous-idle/frames/idle-000.png',method:'one selected portrait; repaired occluded body only; forearm-led shoulder/elbow/wrist articulation; rigid blade; planted-foot torso motion',samples:Array.from({length:SIZE.frames},(_,i)=>({phase:i/(SIZE.frames-1),...geometry(pose(i/(SIZE.frames-1)))}))};
  files.push({name:'export.json',bytes:new TextEncoder().encode(JSON.stringify(spec,null,2))});const url=URL.createObjectURL(zip(files)),a=document.createElement('a');a.href=url;a.download='wu-continuous-attack-33.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(error){document.body.dataset.error=String(error);status.textContent=String(error);}
 finally{controls.forEach(c=>c.disabled=false);exporting=false;show();}
});
function tick(now){const dt=last?Math.min(now-last,100):0;last=now;if(playing&&!exporting){elapsed+=dt;if(mode==='attack'){phase=Math.min(1,phase+dt/((SIZE.frames-1)*1000/SIZE.fps));if(phase>=1){mode='idle';elapsed=0;history.push('idle');}}else if(loop&&elapsed>850){start();}show();}requestAnimationFrame(tick);}
show();requestAnimationFrame(tick);
