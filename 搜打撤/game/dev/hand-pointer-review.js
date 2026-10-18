import { resolveHandHit, readingAccessBands } from './hand-fixed-hit.js';
import { createPointerLog } from './hand-pointer-log.js';
import SDT, { sdtDefine } from '../src/core/sdt-facade.js';
import '../src/core/icons-bitmap.js';
import '../src/core/art.js';
import { scale as uiScale } from '../src/ui/ui-scale.js';
import { rulesSlice } from '../src/cards/cards.rules.js';
import { dataSlice } from '../src/cards/cards.data.js';
import { cardHTML } from '../src/cards/cards.view.js';
import { handDisplayLayout } from '../src/battle/view/battle.hand-layout.js';
// Observable DOM events only. No battle engine, game state, save, audio or issuing commands.
const catalog=Object.values(dataSlice).filter(Array.isArray).flat();
sdtDefine('Cards',{...rulesSlice,all:()=>catalog,cardHTML});
const ids=['tt7-holyheal','tt3sp-bloodstorm','tt3-ice-spike','tt3-azure-sword','tt4-woodify'];
const cards=ids.map(id=>catalog.findLast(card=>card.id===id));
const body=document.querySelector('#ovBody'),select=document.querySelector('#reviewCase'),output=document.querySelector('#reviewOutput');
const policySelect=document.querySelector('#hitPolicy');
function policyForEvent(e){
  const actualCard=e.target.closest?.('.bt-card') || e.target.closest?.('.bt-slot')?.querySelector('.bt-card');
  const actualUid=actualCard?.dataset.uid || null;
  if(policySelect.value==='original')return {strategy:'original',uid:actualUid,route:'native'};
  const slots=[...body.querySelectorAll('.bt-slot')],scale=uiScale();
  const regions=slots.map(slot=>{
    const r=slot.getBoundingClientRect(),card=slot.querySelector('.bt-card');
    const height=card.offsetHeight*scale,rest=parseFloat(slot.style.getPropertyValue('--hand-rest'))*scale;
    return {uid:card.dataset.uid,left:r.left,right:r.right,top:r.top+Math.min(rest,height),bottom:Math.max(r.top+rest+height,r.bottom)};
  });
  const owner=body.querySelector('.review-active .bt-card');
  const ownerRect=owner?.getBoundingClientRect(),ownerSlot=owner?.closest('.bt-slot');
  const ownerSlotRect=ownerSlot?.getBoundingClientRect();
  const accessBands=owner?readingAccessBands({uid:owner.dataset.uid,left:ownerSlotRect.left,right:ownerSlotRect.right,
    raisedTop:ownerSlotRect.top,restDrop:parseFloat(ownerSlot.style.getPropertyValue('--hand-rest'))*scale,
    cardTop:ownerRect.top,controls:[...owner.querySelectorAll('.bt-infchip,.hsc-desc')].map(el=>el.getBoundingClientRect())}):[];
  const choice=resolveHandHit({regions,x:e.clientX,y:e.clientY,actualUid,ownerUid:owner?.dataset.uid,accessBands,
    interactive:!!e.target.closest?.('button,[data-term],.hsc-desc,input,select,textarea,a')});
  for(const slot of slots)slot.classList.toggle('review-active',slot.querySelector('.bt-card').dataset.uid===choice.uid);
  return {strategy:'fixed',...choice,accessBands};
}
const pointerLog=createPointerLog(body,output,policyForEvent);
const record=pointerLog.record;
function describe(el){return el instanceof Element ? `${el.tagName.toLowerCase()}.${el.classList[0]||''} uid=${el.closest('[data-uid]')?.getAttribute('data-uid')||'-'} act=${el.closest('[data-act]')?.getAttribute('data-act')||'-'}`:'-';}
function paint(){
  body.innerHTML='<section class="battle-stage sts"><div class="sts-arena"></div><div class="bt-hand sts-hand"></div></section>';
  body.querySelector('.battle-stage').dataset.reviewHit=policySelect.value;
  const hand=body.querySelector('.sts-hand'),n=Number(select.value);
  for(let i=0;i<n;i++){
    const card=cards[i%cards.length],uid=`fixture-${i+1}`,L=handDisplayLayout(i,n,hand.clientWidth),slot=document.createElement('div');
    slot.className='bt-slot';slot.dataset.uid=uid;slot.dataset.act='btPlay';
    for(const [key,value] of Object.entries({'--fx':`${L.x}px`,'--fs':L.scale,'--hand-index':i,'--hand-rest':`${L.rest}px`,'--hand-visible-width':`${L.visibleWidth}px`}))slot.style.setProperty(key,String(value));
    slot.innerHTML=SDT.Icons.rich(`<div class="bt-card compact need-target" data-uid="${uid}" data-act="btPlay" data-aim="1" data-hand-state="ready" role="group" aria-label="${card.name}">${cardHTML(card)}${card.infuse?`<button class="bt-infchip" data-act="btInfuseStart" data-uid="${uid}">[[icon:crystal]] 注能${card.infuse}</button>`:''}</div>`);
    hand.appendChild(slot);
  }
}
for(const type of ['pointerover','pointerdown','pointerup','click'])body.addEventListener(type,pointerLog.event,true);
body.addEventListener('pointermove',e=>{if(policySelect.value==='fixed')policyForEvent(e);},true);
body.addEventListener('pointerleave',()=>body.querySelectorAll('.review-active').forEach(slot=>slot.classList.remove('review-active')));
policySelect.addEventListener('change',()=>{paint();pointerLog.clear();record(`命中策略=${policySelect.value}；仅夹具记录，不执行拿起`);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){record('Escape: 已记录取消输入，无资源或卡牌变化');document.querySelector('.review-tools').hidden=false;}else if(e.key==='Enter')record(`Enter target ${describe(e.target)}`);});
select.addEventListener('change',paint);
document.querySelector('#reset').addEventListener('click',()=>{pointerLog.clear();record('已清空；无生产动作需要撤销');});
document.querySelector('#diagnose').addEventListener('click',()=>{for(const el of body.querySelectorAll('.bt-infchip')){const r=el.getBoundingClientRect();record(`${describe(el)} rect=${[r.x,r.y,r.width,r.height].map(Math.round).join(',')} centerHit=${describe(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}`);}});
document.querySelector('#hideTools').addEventListener('click',()=>{document.querySelector('.review-tools').hidden=true;output.hidden=true;});
paint();
