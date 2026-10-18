import {zip} from '../continuous-idle/zip.js';
const rig=await (await fetch('rig.json')).json(),skin=rig.skins[0].attachments;
const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d'),status=document.querySelector('#status');
const imgs={};await Promise.all(rig.slots.map(async slot=>{const name=skin[slot.name][slot.attachment].path;if(imgs[name])return;const im=new Image();im.src=`images/${name}.png`;await im.decode();imgs[name]=im;}));
const DURATION=.8,FPS=30,COUNT=25,origin=[768,1050];
// time, body degrees, hip x/y, grip x/y offset, blade delta, free arm, hair.
const KEYS=[
 [0,0,0,0,0,0,0,0,0],
 [.10,3,-5,-3,-25,-100,58,-5,-2],
 [.17,6,-10,-5,-45,-160,94,-12,-4],
 [.20,6,-10,-5,-30,-143,88,-12,-4],
 [.233,-7,24,-4,95,-36,18,12,-1],
 [.267,-10,35,-2,110,-10,-29,20,5],
 [.333,-10,35,-2,110,-10,-29,20,9],
 [.43,-6,25,0,67,32,-53,12,12],
 [.63,-1,6,0,10,12,-13,-2,4],
 [.8,0,0,0,0,0,0,0,0]
];
const rad=Math.PI/180;
function motion(t){let i=0;while(i<KEYS.length-2&&t>KEYS[i+1][0])i++;const a=KEYS[i],b=KEYS[i+1];let u=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));if(t<.20||t>.333)u=u*u*(3-2*u);return a.slice(1).map((v,j)=>v+(b[j+1]-v)*u);}
function value(keys,t,key,fallback=0){if(!keys?.length)return fallback;if(t<=keys[0].time)return keys[0][key]??fallback;for(let i=1;i<keys.length;i++){if(t<=keys[i].time){const a=keys[i-1],b=keys[i],u=(t-a.time)/(b.time-a.time);return(a[key]??fallback)*(1-u)+(b[key]??fallback)*u;}}return keys.at(-1)[key]??fallback;}
function mul(p,q){return[p[0]*q[0]+p[2]*q[1],p[1]*q[0]+p[3]*q[1],p[0]*q[2]+p[2]*q[3],p[1]*q[2]+p[3]*q[3],p[0]*q[4]+p[2]*q[5]+p[4],p[1]*q[4]+p[3]*q[5]+p[5]];}
function transforms(t,idle=false){
 const m={},v=motion(t),extra={};
 if(!idle){
  extra.body={r:v[0],x:v[1],y:v[2]};extra.head={r:-v[0]*.45};extra.ponytail={r:v[7]};extra.free_arm_hand={r:v[6]};
  // Solve the two arm segments toward a strong grip silhouette, retain lengths.
  const angle=v[0]*rad,shoulder=[690+v[1]-83*Math.cos(angle)-193*Math.sin(angle),534-v[2]-(-83*Math.sin(angle)+193*Math.cos(angle))];
  let x=798.1515619877346+v[3]-shoulder[0],y=shoulder[1]-(464.3281786547658+v[4]);
  const l1=Math.hypot(50.6,-122.1),l2=Math.hypot(110,-87.5),d=Math.hypot(x,y),safe=Math.min(l1+l2-1,Math.max(Math.abs(l1-l2)+1,d));x*=safe/d;y*=safe/d;
  const bend=Math.acos(Math.max(-1,Math.min(1,(safe*safe-l1*l1-l2*l2)/(2*l1*l2))));
  const a=Math.atan2(y,x)-Math.atan2(l2*Math.sin(bend),l1+l2*Math.cos(bend));
  const upper=a/rad-Math.atan2(-122.1,50.6)/rad,fore=(a+bend)/rad-Math.atan2(-87.5,110)/rad;
  extra.sword_upper_arm={r:upper-v[0]};extra.sword_forearm_hand={r:fore-upper-38};extra.sword={r:38+v[5]-fore};
 }
 for(const bone of rig.bones){const tl=idle?rig.animations.idle.bones?.[bone.name]??{}:{};const e=extra[bone.name]??{};const a=((bone.rotation??0)+(e.r??value(tl.rotate,t,'value')))*rad,x=(bone.x??0)+(e.x??value(tl.translate,t,'x')),y=(bone.y??0)+(e.y??value(tl.translate,t,'y'));const local=[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),x,y];m[bone.name]=bone.parent?mul(m[bone.parent],local):local;}
 return m;
}
function part(slot,m,alpha=1){const a=skin[slot.name][slot.attachment],matrix=m[slot.bone];ctx.save();ctx.translate(...origin);ctx.scale(1,-1);ctx.transform(...matrix);ctx.translate(a.x,a.y);ctx.scale(1,-1);ctx.globalAlpha=alpha;ctx.drawImage(imgs[a.path],-a.width/2,-a.height/2,a.width,a.height);ctx.restore();}
function render(t,idle=false){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(70,165);ctx.scale(.82,.82);const m=transforms(t,idle);
 for(const slot of rig.slots){if(!idle&&slot.name==='sword'&&document.querySelector('#smear').checked&&t>.205&&t<.27){for(let k=7;k>=1;k--)part(slot,transforms(Math.max(.20,t-k*.008)),.10+(7-k)*.025);}part(slot,m);}
 ctx.restore();
}
let mode='attack',clock=0,last=0,paused=false,loop=true,speed=1,exporting=false;
function show(){const t=mode==='attack'?Math.min(DURATION,Math.floor(clock*FPS)/FPS):clock%2.4;render(t,mode==='idle');document.querySelector('#seek').value=Math.min(24,Math.floor(t*FPS));status.textContent=mode==='idle'?'待机':`攻击 ${Math.min(25,Math.floor(t*FPS)+1)}/25 · ${t<.2?'举剑蓄力':t<.267?'快速斩击':t<.333?'命中停留':'收势'}`;}
function attack(){mode='attack';clock=0;paused=false;document.querySelector('#pause').textContent='暂停';show();}
document.querySelector('#attack').onclick=attack;
document.querySelector('#loop').onclick=()=>{loop=!loop;document.querySelector('#loop').textContent=loop?'停止循环':'循环演示';if(loop)attack();};
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'继续':'暂停';};
document.querySelector('#seek').oninput=e=>{mode='attack';clock=Number(e.target.value)/FPS;paused=true;document.querySelector('#pause').textContent='继续';show();};
document.querySelector('#speed').onchange=e=>speed=Number(e.target.value);
document.querySelector('#smear').onchange=show;
document.querySelector('#export').onclick=async()=>{exporting=true;const files=[];try{for(let i=0;i<COUNT;i++){render(i/FPS);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));files.push({name:`frames/attack-${String(i).padStart(3,'0')}.png`,bytes:new Uint8Array(await blob.arrayBuffer())});}files.push({name:'sprite.json',bytes:new TextEncoder().encode(JSON.stringify({character:'wu',animation:'attack',frameWidth:1536,frameHeight:1280,frameCount:COUNT,fps:FPS,durationMs:800,status:'unreviewed',frames:Array.from({length:COUNT},(_,i)=>`frames/attack-${String(i).padStart(3,'0')}.png`)},null,2))});const url=URL.createObjectURL(zip(files)),a=document.createElement('a');a.href=url;a.download='wu-quick-slash-v3.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}finally{exporting=false;show();}};
function tick(now){const dt=last?Math.min(.1,(now-last)/1000):0;last=now;if(!paused&&!exporting){clock+=dt*speed;if(mode==='attack'&&clock>DURATION+1/FPS){mode='idle';clock=0;}else if(mode==='idle'&&loop&&clock>.65)attack();show();}requestAnimationFrame(tick);}
show();requestAnimationFrame(tick);
