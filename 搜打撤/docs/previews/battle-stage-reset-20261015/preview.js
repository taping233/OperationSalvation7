import { attach, play, hide } from '/src/battle/view/battle.frames.js';
import { sdtDefine } from '/src/core/sdt-facade.js';
import '/src/core/icons-bitmap.js';
import '/src/core/art.js';
import { dataSlice } from '/src/cards/cards.data.js';
import { rulesSlice } from '/src/cards/cards.rules.js';
import { createCardRenderContext } from '/src/cards/card-render-context.js';
import { cardHTML } from '/src/cards/cards.view.js';
import { DATA } from '/src/core/data-loader.js';
import { slamSkillFor } from '/src/battle/bag/battle.slam-skill.js';

// The shared renderer reads its existing data port. Supply an in-memory catalog;
// importing the preview never seeds or changes the player's stored card library.
const catalog = [...new Map([
  rulesSlice.SHA,
  ...Object.values(dataSlice).filter(Array.isArray).flat(),
  ...DATA.cardsSync.cards,
].filter(card => card?.id).map(card => [card.id, card])).values()];
sdtDefine('Cards', { ...rulesSlice, ...createCardRenderContext(catalog), all: () => catalog, cardHTML });
const byId = id => {
  const card = catalog.find(entry => entry.id === id);
  if (!card) throw new Error(`Preview card is missing: ${id}`);
  return card;
};
const careerSkill = slamSkillFor('侠客');
const careerCard = catalog.find(card => card.cls === '侠客' && card.type === '武术' && card.dmg > 0);

const $ = selector => document.querySelector(selector);
const stage = $('.battle-stage');
stage._battleToken = 'battle-stage-design-preview-1015';
const cardSet = [
  {card:byId('starter-attack'),damage:4,action:'atk'},
  {card:byId('tt2-block'),guard:true,action:'cast'},
  {card:byId('tt3-ice-spike'),action:'cast'},
  {card:byId('tt3-fireball'),action:'cast'},
  {card:careerCard,action:'atk'},
].map(entry => ({ ...entry, name:entry.card.name, cost:entry.card.cost, damage:entry.damage ?? entry.card.dmg ?? 2 }));
let energy = 3, block = 5, hp = 28, turn = 1, discard = 3, selected = null, busy = false;
let guarded = false, careerUsed = false, careerPending = false;
let foeHp = [24,18];
const alive = () => foeHp.some(value => value > 0);
const message = text => { $('#actionMessage').textContent = text; };

function renderHand() {
  $('#hand').innerHTML = cardSet.map((entry,index)=>`<div class="hand-slot" style="--hand-order:${index}"><div class="play-card${entry.cost>energy?' unaffordable':''}" data-card="${index}" role="button" tabindex="0" aria-label="${entry.name}，${entry.cost}能量">${cardHTML(entry.card, 'sm', { low:false })}<span class="hand-key" aria-hidden="true">${index+1}</span></div></div>`).join('');
}
const forecast = () => Math.max(0,(foeHp[0]>0 ? guarded ? 1 : 6 : 0)-block);
function sync() {
  $('#energyNumber').textContent=energy;
  $('#blockValue').textContent=block;
  $('#playerHp').textContent=hp;
  $('#playerHealth').style.width=`${hp/35*100}%`;
  $('#forecastValue').textContent=forecast();
  $('#discardCount').textContent=discard;
  $('#turnNumber').textContent=String(turn).padStart(2,'0');
  document.querySelectorAll('[data-card]').forEach(button=>{
    const index=Number(button.dataset.card);
    button.classList.toggle('unaffordable',cardSet[index].cost>energy);
    button.classList.toggle('selected',index===selected);
    button.setAttribute('aria-pressed',String(index===selected));
  });
  stage.classList.toggle('targeting',selected!==null || careerPending);
  $('#careerButton').disabled=busy || careerUsed || energy<careerSkill.cost;
  $('#careerButton').classList.toggle('active',careerPending);
  $('#careerButton').setAttribute('aria-pressed',String(careerPending));
  $('#careerStatus').textContent=careerUsed?'本回合已用':careerPending?'请选择敌人':'每回合一次 · 不消耗卡牌';
  foeHp.forEach((value,index)=>{
    $(`#foeHp${index}`).textContent=value;
    $(`#foeHealth${index}`).style.width=`${value/(index===0?24:25)*100}%`;
    $(`[data-target="${index}"]`).classList.toggle('defeated',value<=0);
  });
}
function selectCard(index) {
  if(busy||!alive())return;
  const card=cardSet[index];
  if(card.cost>energy){message('能量不足 · 可结束回合恢复能量');return;}
  careerPending=false;
  if(card.guard){energy-=card.cost;guarded=true;discard++;play(card.action);message('格挡生效 · 本回合所受伤害降为 1');sync();return;}
  selected=selected===index?null:index;
  message(selected===null?'选择手牌，决定下一步':`${card.name} · 选择一个敌人`);
  sync();
}
function target(index) {
  if(busy||foeHp[index]<=0)return;
  if(selected===null && !careerPending){message('先选择手牌或职业技能，再选择目标');return;}
  const card=careerPending?{name:careerSkill.name,cost:careerSkill.cost,damage:careerSkill.dmg,action:'atk'}:cardSet[selected];
  energy-=card.cost;foeHp[index]=Math.max(0,foeHp[index]-card.damage);
  if(careerPending)careerUsed=true;else discard++;
  play(card.action);
  const unit=$(`[data-target="${index}"]`);
  unit.classList.remove('hit');
  requestAnimationFrame(()=>unit.classList.add('hit'));
  const label=document.createElement('span');label.className='floating-damage';label.textContent=card.damage;unit.append(label);
  setTimeout(()=>label.remove(),950);
  selected=null;careerPending=false;message(alive()?'动作播放来自现有战斗系统':'敌人已清空 · 可重置继续看方案');sync();
}
async function endTurn() {
  if(busy)return;
  busy=true;selected=null;careerPending=false;stage.classList.add('enemy-phase');$('#endTurn').disabled=true;
  $('#phaseText').textContent='敌方回合';$('.turn .eyebrow').textContent='ENEMY TURN';
  message('敌方行动 · 现有受击动作演示');sync();
  if(foeHp[0]>0){play('hurt');hp=Math.max(1,hp-forecast());}
  setTimeout(()=>{block=0;guarded=false;careerUsed=false;energy=3;turn++;busy=false;stage.classList.remove('enemy-phase');$('#endTurn').disabled=false;$('#phaseText').textContent='你的回合';$('.turn .eyebrow').textContent='YOUR TURN';message('你的回合 · 能量已恢复');sync();},1700);
}
function reset() {energy=3;block=5;hp=28;turn=1;discard=3;selected=null;guarded=false;careerUsed=false;careerPending=false;foeHp=[24,18];message('选择手牌，决定下一步');sync();}
function info(title,text){$('#infoTitle').textContent=title;$('#infoBody').textContent=text;$('#infoDialog').showModal();}
$('#hand').addEventListener('click',event=>{const button=event.target.closest('[data-card]');if(button)selectCard(Number(button.dataset.card));});
$('#hand').addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const card=event.target.closest('.play-card');if(!card || event.target!==card)return;event.preventDefault();event.stopPropagation();selectCard(Number(card.dataset.card));});
document.querySelectorAll('[data-target]').forEach(button=>button.addEventListener('click',()=>target(Number(button.dataset.target))));
$('#endTurn').addEventListener('click',endTurn);
$('#notesButton').addEventListener('click',()=>$('#notesDialog').showModal());
$('#layersButton').addEventListener('click',()=>$('#layersDialog').showModal());
$('#resetButton').addEventListener('click',()=>{if(!busy)reset();});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();}));
document.querySelectorAll('[data-layer]').forEach(input=>input.addEventListener('change',()=>$('.'+input.dataset.layer).classList.toggle('layer-hidden',!input.checked)));
$('#optionsButton').addEventListener('click',()=>info('战斗选项','正式版本保留设置、首脑规则与撤离入口。设计稿先确定它们的收纳位置。'));
$('#drawButton').addEventListener('click',()=>info('抽牌堆 · 12 张','牌堆位于手牌左侧。正式版本接入原有牌堆查看与洗牌流程。'));
$('#discardButton').addEventListener('click',()=>info('弃牌堆',`当前演示弃牌 ${discard} 张。正式版本接入原有弃牌查看。`));
$('#consumeButton').addEventListener('click',()=>info('消耗区 · 0 张','消耗区与弃牌堆分开显示，保留原有规则。'));
$('#bagButton').addEventListener('click',()=>info('战斗背包','背包入口固定在回合按钮下方。首脑战限制沿用现行规则。'));
$('#itemButton').addEventListener('click',()=>info('恢复药剂 ×2','有道具时显示在左上方，不与敌方意图争抢空间。'));
$('#careerButton').addEventListener('click',()=>{if(busy||careerUsed||energy<careerSkill.cost)return;selected=null;careerPending=!careerPending;message(careerPending?`${careerSkill.name} · 选择一个敌人 · ${careerSkill.aimDesc}`:'已取消职业技能');sync();});
$('#careerName').textContent=careerSkill.name;
$('#careerEffect').textContent=careerSkill.aimDesc;
$('#careerButton').setAttribute('aria-label',`职业技能 ${careerSkill.name}，${careerSkill.cost}能量，${careerSkill.aimDesc}，每回合一次`);
document.addEventListener('keydown',event=>{
  if(document.querySelector('dialog[open]'))return;
  if(/^[1-5]$/.test(event.key))selectCard(Number(event.key)-1);
  if(event.key==='Escape'){selected=null;careerPending=false;message('已取消选择');sync();}
  if(event.key.toLowerCase()==='b')$('#bagButton').click();
});
window.addEventListener('pagehide',hide);
renderHand();sync();
try {
  const ready=await attach($('#ovBody'));
  $('#runtimeNote').textContent=ready?'现有 Pixi 战斗动画 · 独立方案':'动画未就绪 · 请检查预览日志';
} catch(error) {
  $('#runtimeNote').textContent='动画载入失败';
  console.error('[Battle design preview]',error);
}
