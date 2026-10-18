import {SETTINGS,createRenderer} from './motion.js';
import {zip} from './zip.js';
const canvas=document.querySelector('#new'),old=document.querySelector('#old'),status=document.querySelector('#status');
const image=new Image();image.src='base.png';await image.decode();
const originals=await Promise.all(Array.from({length:6},async(_,i)=>{const img=new Image();img.src=`../idle/idle-${String(i).padStart(3,'0')}.webp`;await img.decode();return img;}));
const render=createRenderer(canvas,image);
const ms=[240,260,300,260,260,240];
let elapsed=0,last=0,playing=true,exporting=false;
let strength=2;
function show(){
 const index=Math.floor(elapsed/SETTINGS.durationMs*SETTINGS.frames)%SETTINGS.frames;
 render(index/SETTINGS.frames,strength);
 let rest=elapsed%1560,i=0;while(rest>=ms[i]&&i<5){rest-=ms[i];i++;}old.src=originals[i].src;
 status.textContent=`新版 ${index+1}/72 · 24帧/秒 · ${playing?'播放中':'已暂停'}`;
 document.body.dataset.frame=String(index);document.body.dataset.ready='true';
}
show();document.querySelector('#export').disabled=false;
document.querySelector('#pause').addEventListener('click',()=>{playing=!playing;document.querySelector('#pause').textContent=playing?'暂停':'继续';show();});
document.querySelector('#reset').addEventListener('click',()=>{elapsed=0;show();});
document.querySelector('#step').addEventListener('click',()=>{playing=false;document.querySelector('#pause').textContent='继续';elapsed=(Math.floor(elapsed/SETTINGS.durationMs*72)+1)%72/72*3000+.001;show();});
document.querySelector('#anchors').addEventListener('change',event=>{document.querySelector('#marks').hidden=!event.target.checked;});
document.querySelector('#strength').addEventListener('input',event=>{strength=Number(event.target.value);document.querySelector('#strength-value').textContent=`${strength}×`;show();});
document.querySelector('#comparison').addEventListener('change',event=>{document.querySelector('#old-panel').hidden=!event.target.checked;document.querySelector('#pair').classList.toggle('solo',!event.target.checked);});
document.querySelector('#export').addEventListener('click',async()=>{
 const button=document.querySelector('#export');button.disabled=true;exporting=true;
 const saved=elapsed,files=[],exportStrength=strength;
 try{
  for(let i=0;i<72;i++){
   render(i/72,exportStrength);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)throw new Error('帧导出失败');
   files.push({name:`frames/idle-${String(i).padStart(3,'0')}.png`,bytes:new Uint8Array(await blob.arrayBuffer())});
   status.textContent=`已导出 ${i+1}/72 帧`;
  }
  render(1,exportStrength);const endpoint=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!endpoint)throw new Error('循环端点导出失败');
  files.push({name:'checks/loop-end.png',bytes:new Uint8Array(await endpoint.arrayBuffer())});
  const spec={...SETTINGS,character:'wu',animation:'idle',loop:true,method:'one fixed base PNG; continuous compact-region displacement; native browser raster export',strength:exportStrength,amplitudesPx:{chest:1.65*exportStrength,rightHand:[.65*exportStrength,.65*exportStrength],leftHand:[1.15*exportStrength,.75*exportStrength],hair:.55*exportStrength},swordAngleRadians:.00175*exportStrength};
  files.push({name:'export.json',bytes:new TextEncoder().encode(JSON.stringify(spec,null,2))});
  const url=URL.createObjectURL(zip(files)),link=document.createElement('a');link.href=url;link.download='wu-continuous-idle-72.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(error){status.textContent=String(error);document.body.dataset.error=String(error);}
 finally{elapsed=saved;exporting=false;button.disabled=false;show();}
});
function tick(now){const delta=last?Math.min(now-last,100):0;last=now;if(playing&&!exporting){elapsed=(elapsed+delta)%3000;show();}requestAnimationFrame(tick);}
requestAnimationFrame(tick);
