import {createAttackRenderer,SIZE as ATTACK} from '../continuous-attack-v7/rig.js';
import {createHurtRenderer,SIZE as HURT} from '../continuous-hurt-v1/rig.js';
import {createGalleryIdle} from './idle.js';
const ids=['idle','attack','hurt','death'],globalStatus=document.querySelector('#global-status'),gallery=document.querySelector('.gallery');
const states=Object.fromEntries(ids.map(id=>[id,{clock:0,frame:0,playing:true,rest:false,loop:id!=='death',dirty:true}]));
const counts={idle:72,attack:6,hurt:HURT.frames,death:5};
const durations={idle:3000,attack:760,hurt:HURT.durationMs};
const controls=Object.fromEntries(ids.map(id=>[id,{card:document.querySelector(`[data-action="${id}"]`),status:document.querySelector(`[data-status="${id}"]`),seek:document.querySelector(`[data-seek="${id}"]`),canvas:document.querySelector(`#${id}-canvas`)}]));
const load=async url=>{const im=new Image();im.src=String(url);try{await im.decode();}catch(error){console.error('Image decode failed',String(url),error);throw new Error('动作图片载入失败');}return im;};
let attack,hurt,idle,idleWork,drawnAttackSpec,drawnAttackImages,drawnAttackWork,deathSpec,deathImages,attackWork,hurtWork,deathWork,last=0,speed=1,paused=false,sequence=null,sequenceStage=-1;
const VIEW={x:80,y:50,width:690,height:740};
function copy(work,id){const c=controls[id].canvas,ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(work,VIEW.x,VIEW.y,VIEW.width,VIEW.height,0,0,c.width,c.height);}
function paintDeath(frame){const ctx=deathWork.getContext('2d');ctx.clearRect(0,0,832,832);if(frame===0){ctx.drawImage(attack.rest,0,0);return;}const f=deathSpec.frames[frame],im=deathImages[frame],scale=Math.min(1024/im.width,1024/im.height);ctx.save();ctx.setTransform(.5625,0,0,.5625,40,208);ctx.drawImage(im,(1024-im.width*scale)/2+(f.offsetX||0),(1024-im.height*scale)/2+(f.offsetY||0),im.width*scale,im.height*scale);ctx.restore();}
function paintAttackFrame(ctx,index){const f=drawnAttackSpec.frames[index];if(!f.path){ctx.drawImage(attack.rest,0,0);return;}const im=drawnAttackImages[index],fit=Math.min(1536/im.width,1024/im.height),scale=.6*fit;ctx.drawImage(im,-40+(1536-im.width*fit)*.3+(f.offsetX||0)*.6,176+(1024-im.height*fit)*.3+(f.offsetY||0)*.6,im.width*scale,im.height*scale);}
function paintDrawnAttack(s){const ctx=drawnAttackWork.getContext('2d');ctx.clearRect(0,0,832,832);if(document.querySelector('#effects').checked&&s.playing&&(s.frame===2||s.frame===3)){ctx.save();ctx.globalAlpha=.18*Math.max(0,1-(s.frameElapsed||0)/75);ctx.filter='blur(2.4px)';paintAttackFrame(ctx,s.frame-1);ctx.restore();}paintAttackFrame(ctx,s.frame);}
function render(id){const s=states[id],c=controls[id];let label;
 if(id==='idle'){idle((s.frame/72)%1);copy(idleWork,id);label=s.playing&&!paused?'呼吸循环':'已暂停';}
 else if(id==='attack'){if(s.rest){idle((s.clock%3000)/3000);copy(idleWork,id);label='待机';}else{paintDrawnAttack(s);if(!drawnAttackSpec.frames[s.frame].path)copy(drawnAttackWork,id);else{const ctx=c.canvas.getContext('2d');ctx.clearRect(0,0,c.canvas.width,c.canvas.height);ctx.drawImage(drawnAttackWork,0,0,832,832,0,55,690,690);}label=drawnAttackSpec.frames[s.frame].label;}}
 else if(id==='hurt'){if(s.rest){idle((s.clock%3000)/3000);copy(idleWork,id);label='待机';}else{hurt(s.frame/(counts[id]-1),false,document.querySelector('#effects').checked);copy(hurtWork,id);label=`${s.frame+1}/${counts[id]}`;}}
 else{paintDeath(s.frame);copy(deathWork,id);label=s.frame===4?'倒地停留':deathSpec.frames[s.frame].label;}
 c.status.textContent=label;c.seek.value=s.frame;c.card.dataset.frame=s.frame;c.card.dataset.playing=s.playing;s.dirty=false;
}
function play(id){const s=states[id];s.clock=0;s.frame=0;s.rest=false;s.playing=true;s.dirty=true;render(id);}
function stopSequence(){sequence=null;sequenceStage=-1;for(const id of ids)controls[id].card.classList.remove('active-sequence');globalStatus.textContent='四动作独立预览';}
function seqTick(dt){if(!sequence)return;sequence.clock+=dt;const stages=[['idle',1500],['attack',durations.attack+300],['hurt',durations.hurt+300],['death',1550]];let t=sequence.clock,i=0;while(i<stages.length&&t>=stages[i][1]){t-=stages[i][1];i++;}if(i>=stages.length){stopSequence();globalStatus.textContent='顺序演示完成 · 死亡倒地停留';return;}if(i!==sequenceStage){sequenceStage=i;for(const id of ids){controls[id].card.classList.toggle('active-sequence',id===stages[i][0]);if(id!=='idle'){states[id].playing=false;states[id].rest=id!=='death';states[id].dirty=true;}}play(stages[i][0]);globalStatus.textContent=`顺序演示：${{idle:'待机',attack:'攻击',hurt:'受击',death:'死亡'}[stages[i][0]]}`;}}
function advance(id,dt){const s=states[id];if(!s.playing)return;s.clock+=dt;
 if(id==='idle'){s.frame=Math.floor((s.clock%3000)/3000*72);s.dirty=true;return;}
 if(id==='death'){let t=s.clock,index=0;while(index<4&&t>=deathSpec.frames[index].durationMs){t-=deathSpec.frames[index].durationMs;index++;}if(index===4){s.frame=4;if(s.loop&&!sequence&&t>=1200){s.clock=0;s.frame=0;}else if(!s.loop)s.playing=false;}else s.frame=index;s.dirty=true;return;}
 if(s.rest){if(s.loop&&!sequence&&s.clock>850){s.clock=0;s.rest=false;s.frame=0;}s.dirty=true;return;}
 if(id==='attack'){let t=s.clock,i=0;while(i<drawnAttackSpec.frames.length-1&&t>=drawnAttackSpec.frames[i].durationMs){t-=drawnAttackSpec.frames[i].durationMs;i++;}s.frame=i;s.frameElapsed=t;s.dirty=true;if(s.clock>=durations.attack){s.rest=true;s.clock=0;}return;}
 s.frame=Math.min(counts[id]-1,Math.floor(s.clock/durations[id]*counts[id]));s.dirty=true;if(s.clock>=durations[id]){s.rest=true;s.clock=0;}
}
function frame(now){const dt=last?Math.min(100,now-last)*speed:0;last=now;if(!paused){seqTick(dt);for(const id of ids)advance(id,dt);}for(const id of ids)if(states[id].dirty||states[id].playing&&!paused)render(id);requestAnimationFrame(frame);}
function focus(id){gallery.dataset.focus=id;for(const key of ids)controls[key].card.classList.toggle('focused',key===id);document.querySelector('#overview').hidden=!id;globalStatus.textContent=id?`单独查看：${{idle:'待机',attack:'攻击',hurt:'受击',death:'死亡'}[id]}`:'四动作独立预览';}
for(const b of document.querySelectorAll('[data-play]'))b.onclick=()=>{stopSequence();paused=false;document.querySelector('#all-pause').textContent='全部暂停';play(b.dataset.play);};
for(const b of document.querySelectorAll('[data-step]'))b.onclick=()=>{stopSequence();const id=b.dataset.step,s=states[id];s.playing=false;s.rest=false;s.frame=(s.frame+1)%counts[id];s.clock=id==='idle'?s.frame/72*3000:0;s.dirty=true;render(id);};
for(const input of document.querySelectorAll('[data-seek]'))input.oninput=()=>{stopSequence();const id=input.dataset.seek,s=states[id];s.playing=false;s.rest=false;s.frame=Number(input.value);s.dirty=true;render(id);};
for(const input of document.querySelectorAll('[data-loop]'))input.onchange=()=>{const s=states[input.dataset.loop];s.loop=input.checked;if(s.loop&&!s.playing)play(input.dataset.loop);};
for(const b of document.querySelectorAll('[data-focus]'))if(b.tagName==='BUTTON')b.onclick=()=>focus(b.dataset.focus);
document.querySelector('#overview').onclick=()=>focus('');document.addEventListener('keydown',e=>{if(e.key==='Escape')focus('');});
document.querySelector('#all-play').onclick=()=>{stopSequence();paused=false;document.querySelector('#all-pause').textContent='全部暂停';for(const id of ids)play(id);};
document.querySelector('#all-pause').onclick=()=>{paused=!paused;document.querySelector('#all-pause').textContent=paused?'全部继续':'全部暂停';globalStatus.textContent=paused?'全部动作已暂停':'播放中';for(const id of ids)states[id].dirty=true;};
document.querySelector('#sequence').onclick=()=>{paused=false;document.querySelector('#all-pause').textContent='全部暂停';for(const id of ids){states[id].playing=id==='idle';states[id].rest=id!=='death'&&id!=='idle';states[id].frame=0;states[id].clock=0;states[id].dirty=true;}sequence={clock:0};sequenceStage=-1;seqTick(0);};
document.querySelector('#speed').onchange=e=>{speed=Number(e.target.value);};document.querySelector('#effects').onchange=()=>{states.attack.dirty=true;states.hurt.dirty=true;};
async function init(){
 const source=new URL('../continuous-attack-v7/',document.baseURI),specUrl=new URL('../drawn-death-v2/sprite.json',document.baseURI),attackUrl=new URL('../drawn-attack-v8/sprite.json',document.baseURI);
 const [base,repair,neutral,spec,newAttack]=await Promise.all([load(new URL('base.png',source)),load(new URL('body-repair.png',source)),load(new URL('../continuous-idle/frames/idle-000.png',document.baseURI)),fetch(specUrl).then(r=>r.json()),fetch(attackUrl).then(r=>r.json())]);
 deathSpec=spec;drawnAttackSpec=newAttack;deathImages=await Promise.all(spec.frames.map(f=>load(new URL(f.path,specUrl))));drawnAttackImages=await Promise.all(newAttack.frames.map(f=>f.path?load(new URL(f.path,attackUrl)):null));
 attackWork=document.createElement('canvas');hurtWork=document.createElement('canvas');deathWork=document.createElement('canvas');drawnAttackWork=document.createElement('canvas');deathWork.width=drawnAttackWork.width=832;deathWork.height=drawnAttackWork.height=832;
 attack=createAttackRenderer(attackWork,base,repair,neutral);idleWork=document.createElement('canvas');idle=createGalleryIdle(idleWork,attack.parts,neutral);hurt=createHurtRenderer(hurtWork,base,repair,neutral);
 for(const b of document.querySelectorAll('button'))b.disabled=false;for(const id of ids)render(id);globalStatus.textContent='四动作独立预览';document.body.dataset.ready='true';requestAnimationFrame(frame);
}
init().catch(error=>{globalStatus.textContent=`载入失败：${error.message}`;document.body.dataset.error=error.message;console.error(error);});
