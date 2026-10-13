'use strict';
const imageDialog=document.getElementById('imageDialog');
const largeImage=document.getElementById('largeImage');
const imageTitle=document.getElementById('imageTitle');
document.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{
 largeImage.src=button.dataset.zoom;largeImage.alt=button.dataset.title;imageTitle.textContent=button.dataset.title;imageDialog.showModal();
}));
document.getElementById('imageClose').addEventListener('click',()=>imageDialog.close());
imageDialog.addEventListener('click',event=>{if(event.target===imageDialog){const r=imageDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) imageDialog.close();}});

const eventTitle=document.getElementById('eventTitle');
const eventState=document.getElementById('eventState');
const eventCopy=document.getElementById('eventCopy');
const eventButtons=document.getElementById('eventButtons');
function eventView(view){
 const states={
  entry:{title:'物资交接',state:'待查看',copy:'桌上留着一份交接单。查看来意后，再决定是否现在处理。',buttons:[['查看来意 →','read']]},
  read:{title:'无 · 物资交接',state:'正文与选择',copy:'“交接单放在桌上了。要现在看看，还是稍后再来？”\n\n这是一段演示文案，用于展示人物、正文与选择的分区。',buttons:[['查看交接单 →','result'],['稍后处理','later']]},
  result:{title:'交接单已查看',state:'已处理',copy:'结果摘要：这份示例交接单已经查看。返回后保留处理状态，不重新要求执行。\n\n本示例没有发放奖励，也没有改变游戏内容。',buttons:[['返回事件入口','done']]},
  done:{title:'物资交接',state:'已处理',copy:'事件入口现在展示“已处理”。原摘要与人物身份保留，执行按钮转为“重读内容”。',buttons:[['重读内容','reread']]},
  reread:{title:'无 · 物资交接',state:'已处理 · 重读',copy:'“交接单放在桌上了。”\n\n这里仅重读已处理内容，不再次执行。',buttons:[['返回事件入口','done']]},
  later:{title:'物资交接',state:'待处理',copy:'稍后处理：原事件仍待处理。关闭或离开没有改变完成状态。',buttons:[['查看来意 →','read']]}
 };
 const current=states[view];
 eventTitle.textContent=current.title;eventState.textContent=current.state;eventCopy.textContent=current.copy;eventCopy.style.whiteSpace='pre-line';eventButtons.replaceChildren();
 for(const [label,next] of current.buttons){const b=document.createElement('button');b.className=next==='later'?'product-secondary':'product-primary';b.textContent=label;b.addEventListener('click',()=>eventView(next));eventButtons.appendChild(b);}
}
document.getElementById('eventStart').addEventListener('click',()=>eventView('read'));
document.getElementById('eventReset').addEventListener('click',()=>eventView('entry'));

const receiptDialog=document.getElementById('receiptDialog');
const claimStatus=document.getElementById('claimStatus');
const pendingCount=document.getElementById('pendingCount');
const simulateFull=document.getElementById('simulateFull');
const claimed=[false,false];
const rewards=[{name:'金币',quantity:'1,200',destination:'基地资源',symbol:'币'},{name:'卡牌',quantity:'1',destination:'后勤仓库',symbol:'卡'}];
function refreshClaims(){
 pendingCount.textContent=String(claimed.filter(x=>!x).length);
 document.querySelectorAll('[data-claim]').forEach(button=>{const id=Number(button.dataset.claim);button.disabled=claimed[id];button.textContent=claimed[id]?'✓ 已领取':'领取奖励';document.querySelector(`[data-reward="${id}"]`).classList.toggle('claimed',claimed[id]);});
}
document.querySelectorAll('[data-claim]').forEach(button=>button.addEventListener('click',()=>{
 const id=Number(button.dataset.claim);if(claimed[id])return;
 if(id===1&&simulateFull.checked){claimStatus.classList.add('error');claimStatus.textContent='仓库空间不足，奖励尚未领取。可查看后勤或扩建；本演示取消勾选后重试。';return;}
 claimed[id]=true;refreshClaims();claimStatus.classList.remove('error');claimStatus.textContent=claimed.every(Boolean)?'示例奖励全部已领取。仍留在收藏室，已领取记录保留。':`示例奖励已领取，剩余 ${claimed.filter(x=>!x).length} 项待领取。`;
 const reward=rewards[id];const item=document.createElement('div');item.className='product-loot';
 const icon=document.createElement('span');icon.className=`loot-icon${id===1?' card-icon':''}`;icon.textContent=reward.symbol;
 const name=document.createElement('b');name.textContent=`${reward.name} × ${reward.quantity}`;item.append(icon,name);
 document.getElementById('receiptLoot').replaceChildren(item);document.getElementById('receiptDestination').textContent=`去向：${reward.destination}`;receiptDialog.showModal();
}));
document.getElementById('receiptConfirm').addEventListener('click',()=>receiptDialog.close());
document.getElementById('receiptClose').addEventListener('click',()=>receiptDialog.close());
document.getElementById('claimReset').addEventListener('click',()=>{claimed.fill(false);simulateFull.checked=false;refreshClaims();claimStatus.classList.remove('error');claimStatus.textContent='点击领取后，“已领取”与计数同步；确认只关闭结果。';});
const chapterLinks=[...document.querySelectorAll('.toc a')];
const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){chapterLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${entry.target.id}`));}}},{rootMargin:'-5% 0px -75% 0px'});
document.querySelectorAll('.chapter').forEach(section=>observer.observe(section));
