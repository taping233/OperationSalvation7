import {boxes,anchors,pose,REST} from './rig.js';
const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d');
const status=document.querySelector('#status'),slider=document.querySelector('#phase');
const [index,plan]=await Promise.all(['asset-index.json','parts-plan.json'].map(p=>fetch(p).then(r=>r.json())));
const images={},hidden=new Set();let mode='static',start=performance.now(),lastPhase=0;
const boneTextures={};
async function load(src){const img=new Image();img.src=src;await img.decode();return img;}
await Promise.all(Object.entries(index).map(async([id,p])=>{images[id]=await load(p.file);}));
if(index['02'].variants?.hurt) images['02-hurt']=await load(index['02'].variants.hurt.file);
const reference=await load('./reference-battle.png');
for(const p of plan.parts){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.addEventListener('change',()=>input.checked?hidden.delete(p.id):hidden.add(p.id));label.append(input,document.createTextNode(`${p.id} ${p.name}`));document.querySelector('#part-list').append(label);}
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>{mode=button.dataset.mode;start=performance.now();slider.value=0;document.querySelector('#zoom').value=1;for(const b of document.querySelectorAll('[data-mode]'))b.classList.toggle('active',b===button);});
document.querySelector('#pause').addEventListener('change',()=>{start=performance.now()-Number(slider.value)*duration()*1000;});
slider.addEventListener('input',()=>{document.querySelector('#pause').checked=true;});
function duration(){return mode==='idle'?4:mode==='attack'?1.5:mode==='hit'?1.1:1;}
function crop(id){const [x,y,x1,y1]=index[id==='02-hurt'?'02':id].solidBounds;return [x,y,x1-x,y1-y];}
function box(id,rect,angle=0,pivot=null){if(hidden.has(id==='02-hurt'?'02':id))return;let [x,y,w,h]=rect;const c=crop(id);if(['02','02-hurt','04','18','21'].includes(id)){const nativeWidth=h*c[2]/c[3];x+=(w-nativeWidth)/2;w=nativeWidth;}ctx.save();if(angle){const center=pivot||[x+w/2,y+h/2];ctx.translate(...center);ctx.rotate(angle);ctx.translate(-center[0],-center[1]);}if(id==='21'){ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(images[id],...c,0,0,w,h);}else ctx.drawImage(images[id],...c,x,y,w,h);ctx.restore();}
function at(id,point,size,pivot,angle=0){if(hidden.has(id))return;ctx.save();ctx.translate(...point);ctx.rotate(angle);ctx.drawImage(images[id],...crop(id),-pivot[0]*size[0],-pivot[1]*size[1],...size);ctx.restore();}
function legTexture(id,c,ap,bp){
 if(!['16','17','19','20'].includes(id))return null;if(boneTextures[id])return boneTextures[id];
 const thigh=id==='16'||id==='19',gain={16:.32,19:.62,17:.15,20:.12}[id],jointGain=thigh?.12:0;
 const texture=document.createElement('canvas'),pad=Math.ceil(c[2]*gain);
 texture.width=c[2]+2*pad;texture.height=c[3];const t=texture.getContext('2d');
 for(let y=0;y<c[3];y+=2){const v=y/c[3],along=Math.max(0,Math.min(1,(v-ap[1])/(bp[1]-ap[1]))),center=(ap[0]+(bp[0]-ap[0])*along)*c[2];
  let weight=thigh?(v<.25?v/.25:v<.80?1:v<bp[1]?(bp[1]-v)/(bp[1]-.80):0):1-Math.min(1,v/.85);weight=Math.max(0,Math.min(1,weight));weight=weight*weight*(3-2*weight);const factor=1+jointGain+(gain-jointGain)*weight,rows=Math.min(2,c[3]-y);
  t.drawImage(images[id],c[0],c[1]+y,c[2],rows,pad+center*(1-factor),y,c[2]*factor,rows);
 }
 if(thigh){const gradient=t.createLinearGradient(0,0,0,c[3]);gradient.addColorStop(0,'#fff');gradient.addColorStop(bp[1],'#fff');gradient.addColorStop(1,'rgba(255,255,255,0)');t.globalCompositeOperation='destination-in';t.fillStyle=gradient;t.fillRect(0,0,texture.width,texture.height);}
 return boneTextures[id]={texture,pad};
}
function bone(id,a,b){if(hidden.has(id))return;const c=crop(id),[ap,bp]=index[id].boneAnchors||anchors[id],ax=ap[0]*c[2],ay=ap[1]*c[3],bx=bp[0]*c[2],by=bp[1]*c[3],texture=legTexture(id,c,ap,bp);const scale=Math.hypot(b[0]-a[0],b[1]-a[1])/Math.hypot(bx-ax,by-ay);ctx.save();ctx.translate(...a);ctx.rotate(Math.atan2(b[1]-a[1],b[0]-a[0])-Math.atan2(by-ay,bx-ax));ctx.scale(scale,scale);if(texture)ctx.drawImage(texture.texture,-ax-texture.pad,-ay);else ctx.drawImage(images[id],...c,-ax,-ay,c[2],c[3]);ctx.restore();}
function bodyDraw(p,callback){ctx.save();ctx.translate(p.dx,p.dy);ctx.translate(...REST.waist);ctx.rotate(p.lean);ctx.translate(-REST.waist[0],-REST.waist[1]);callback();ctx.restore();}
function draw(phase){
 const background=document.querySelector('#background').value;ctx.clearRect(0,0,canvas.width,canvas.height);if(background!=='transparent'){ctx.fillStyle=background==='dark'?'#303640':'#dde0e5';ctx.fillRect(0,0,canvas.width,canvas.height);}
 if(background==='checker'){for(let y=0;y<canvas.height;y+=24)for(let x=0;x<canvas.width;x+=24){ctx.fillStyle=(x/24+y/24)%2?'#c5c9d0':'#e6e9ed';ctx.fillRect(x,y,24,24);}}
 ctx.save();const zoom=Number(document.querySelector('#zoom').value);ctx.translate(768,650);ctx.scale(.72*zoom,.72*zoom);ctx.translate(-817,-535);const p=pose(mode,phase);
 if(document.querySelector('#reference').checked){ctx.save();ctx.globalAlpha=.35;ctx.drawImage(reference,0,0,1536,1024);ctx.restore();}
 bodyDraw(p,()=>{box('05',boxes['05'],p.ponySway,[625,60]);box('08',boxes['08']);});
 bone('20',p.kneeL,p.ankleL);bone('19',p.hipL,p.kneeL);box('21',boxes['21']);
 bone('17',p.kneeR,p.ankleR);bone('16',p.hipR,p.kneeR);box('18',boxes['18']);
 bone('13',p.shoulderL,p.elbowL);bone('14',p.elbowL,p.wristL);at('15',p.wristL,[70,44],[.05,.30],-.12);
 bone('10',p.shoulderR,p.elbowR);
 const headId=mode==='hit'&&phase>.12&&phase<.88&&images['02-hurt']?'02-hurt':'02';
 bodyDraw(p,()=>{box('09',boxes['09']);bone('01',REST.neck,REST.waist);box('04',boxes['04']);box(headId,boxes['02']);box('03',boxes['03']);box('07',boxes['07']);box('06',boxes['06']);});
 bone('11',p.elbowR,p.wrist);
 at('22',p.grip,[610,58],[.105,.48],p.swing);at('12',p.wrist,[70,44],[.06,.30],p.handAngle);
 if(document.querySelector('#joints').checked){ctx.lineWidth=2;ctx.strokeStyle='#c92955';ctx.fillStyle='#ffe33b';for(const pts of [[p.hipL,p.kneeL,p.ankleL],[p.hipR,p.kneeR,p.ankleR],[p.shoulderL,p.elbowL,p.wristL],[p.shoulderR,p.elbowR,p.wrist,p.grip]]){ctx.beginPath();pts.forEach((pt,i)=>i?ctx.lineTo(...pt):ctx.moveTo(...pt));ctx.stroke();for(const pt of pts){ctx.beginPath();ctx.arc(...pt,4,0,Math.PI*2);ctx.fill();}}}
 ctx.restore();status.textContent=`${Object.keys(index).length}/22 件 · ${mode} · ${phase.toFixed(2)}`;
 document.querySelector('#report').textContent='部件已全部载入。当前为自主检验小样，正在检查比例、接缝和动作。';
 canvas.dataset.mode=mode;canvas.dataset.phase=phase.toFixed(3);canvas.dataset.loaded=Object.keys(index).length;
}
function tick(now){const paused=document.querySelector('#pause').checked;lastPhase=mode==='static'?0:paused?Number(slider.value):((now-start)/1000/duration())%1;if(!paused)slider.value=lastPhase;draw(lastPhase);requestAnimationFrame(tick);}requestAnimationFrame(tick);
document.querySelector('#save').addEventListener('click',async()=>{const name=`render-${mode}-${Math.round(lastPhase*100).toString().padStart(3,'0')}-${document.querySelector('#background').value}.png`;const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const response=await fetch('/save-frame?name='+name,{method:'POST',body:blob});status.textContent=response.ok?'已保存 '+name:'保存失败';});
document.querySelector('#proof').addEventListener('paste',async event=>{
 const encoded=event.clipboardData.getData('text/plain');if(!/^[A-Za-z0-9+/=]+$/.test(encoded)||encoded.length>12000000)return;
 event.preventDefault();const raw=atob(encoded),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),extension=bytes[0]===255?'jpg':'png';
 const name=`browser-${mode}-${Math.round(lastPhase*100).toString().padStart(3,'0')}.${extension}`;
 const result=await fetch('/save-proof?name='+name,{method:'POST',body:bytes});
 document.querySelector('#proof-result').textContent=result.ok?'已存档 '+name:'截图存档失败';
});
