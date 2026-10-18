import {createRenderer as createBodyIdle} from '../continuous-idle/motion.js';
import {REST,SIZE} from '../continuous-attack-v7/rig.js';

export function createGalleryIdle(output,parts,neutral){
 output.width=SIZE.width;output.height=SIZE.height;
 const body=document.createElement('canvas');body.width=576;body.height=560;
 const breathe=createBodyIdle(body,parts.body),ctx=output.getContext('2d');
 function paint(texture,upper,lower=0,wrist=0){
  ctx.save();ctx.translate(...REST.shoulder);ctx.rotate(upper);ctx.translate(-REST.shoulder[0],-REST.shoulder[1]);
  if(lower){ctx.translate(...REST.elbow);ctx.rotate(lower);ctx.translate(-REST.elbow[0],-REST.elbow[1]);}
  if(wrist){ctx.translate(...REST.wrist);ctx.rotate(wrist);ctx.translate(-REST.wrist[0],-REST.wrist[1]);}
  ctx.drawImage(texture,0,0);ctx.restore();
 }
 return phase=>{
  const s=Math.sin(phase*Math.PI*2),upper=.063*s,lower=-.075*s,wrist=.012*s;
  breathe(phase,6.6);ctx.clearRect(0,0,SIZE.width,SIZE.height);ctx.save();ctx.translate(SIZE.padX,SIZE.padY);ctx.drawImage(body,0,0);
  ctx.clearRect(-SIZE.padX,490,SIZE.width,SIZE.height-490-SIZE.padY);ctx.drawImage(neutral,0,490,576,70,0,490,576,70);
  paint(parts.upper,upper);ctx.drawImage(parts.shoulderCover,0,0);paint(parts.lower,upper,lower);paint(parts.weapon,upper,lower,wrist);paint(parts.hand,upper,lower,wrist);
  ctx.restore();
 };
}
