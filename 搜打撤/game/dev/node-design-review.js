import { markReviewReady } from './review-readiness.js';
import SDT from '../src/core/sdt-facade.js';
import '../src/core/icons-bitmap.js';
import '../src/ui/ui-scale.js';
import { eventSceneHTML } from '../src/ui/node-scene-view.js';
import { fireRestDecisionHTML } from '../src/ui/fire-rest-view.js';
import { altarRitualHTML, altarRewardHTML, entrySupplyIntroHTML } from '../src/ui/node-decision-view.js';
import { inspectVisibleLayout } from './visible-layout-check.js';

// Pure views and fixed examples only. No game bootstrap, reward commands, storage or audio.
export function nodeReviewScene(mode) {
  const frame = {region:'风雪哨线',layer:1};
  if (mode.startsWith('fire')) return {...frame,tone:'fire',asset:'scene-fire-bg',icon:'[[icon:fire]]',title:'营火休整',sub:'风雪被隔在火光之外。你可以在这里整顿状态，再继续前行。',
    body:fireRestDecisionHTML({heal:10,chance:30,restorable:mode==='fireEmpty'?0:8,fits:mode==='fire',capacity:mode==='fireFull'?'16/16 格':'8/16 格'}),
    foot:'<button class="ov-btn" data-act="fireBag">先整理背包</button><button class="ov-btn" data-act="fireLeave">离开火堆</button>'};
  if (mode.startsWith('altar')) return {...frame,tone:'altar',asset:'scene-altar-bg',icon:'[[icon:altar]]',title:'污染祭坛',sub:'沉睡的祭坛等待你的献礼。',
    body:altarRitualHTML({fragments:mode==='altarLocked'?0:2,capacity:'8/16 格',availableCards:mode==='altarLocked'?2:8,hasItem:mode!=='altarLocked',itemUsed:false,restorable:8}),
    foot:'<button class="ov-btn" data-act="altarBag">整理背包</button><button class="ov-btn" data-act="altarLeave">离开</button>'};
  if (mode.startsWith('reward')) return {...frame,tone:'altar',asset:'scene-altar-bg',icon:'[[icon:altar]]',title:'祭坛回赠',sub:'献礼已经收下。选择你需要的回赠。',
    body:altarRewardHTML({capacity:'8/16 格',restorable:mode==='rewardEmpty'?0:8}),foot:'<button class="ov-btn" data-act="altarLeave">离开</button>'};
  return {...frame,tone:'entry',asset:'scene-door-bg',title:'入城补给',sub:'随行的职业补给已留在城门旁。',body:entrySupplyIntroHTML({count:3,character:'星月',capacity:'8/16 格'})};
}
const select=document.querySelector('#reviewCase'), body=document.querySelector('#ovBody'), output=document.querySelector('#reviewOutput');
function paint(){body.innerHTML=SDT.Icons.rich(eventSceneHTML(nodeReviewScene(select.value)));output.hidden=true;markReviewReady(body);}
select.addEventListener('change',paint);
document.querySelector('#diagnose').addEventListener('click',()=>{output.textContent=JSON.stringify(inspectVisibleLayout(body),null,2);output.hidden=false;});
document.querySelector('#hideTools').addEventListener('click',()=>{document.querySelector('.review-tools').hidden=true;output.hidden=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelector('.review-tools').hidden=false;output.hidden=true;}});
body.addEventListener('click',e=>{const action=e.target.closest('[data-act]');if(action&&!action.disabled){output.textContent=`隔离呈现：${action.textContent.trim()}。本夹具不执行授予、扣除或离开真实对局。`;output.hidden=false;}});
paint();
