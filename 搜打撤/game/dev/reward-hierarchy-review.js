import { markReviewReady } from './review-readiness.js';
import SDT, { sdtDefine } from '../src/core/sdt-facade.js';
import '../src/core/icons-bitmap.js';
import '../src/core/art.js';
import '../src/ui/ui-scale.js';
import { rulesSlice } from '../src/cards/cards.rules.js';
import { dataSlice } from '../src/cards/cards.data.js';
import { cardHTML } from '../src/cards/cards.view.js';
import { rewardSceneHTML, rewardClaimHTML } from '../src/ui/reward-scene-view.js';
import { rewardPickerTitle } from '../src/ui/reward-picker-heading.js';
import { chestRewardFrameHTML, chestRewardOverviewHTML } from '../src/ui/chest-reward-overview.js';
import { inspectVisibleLayout } from './visible-layout-check.js';
// Fixed examples, production views. No bootstrap, command binding, save or audio.
const catalog = Object.values(dataSlice).filter(Array.isArray).flat();
sdtDefine('Cards', { ...rulesSlice, all:() => catalog, cardHTML });
const cards = ['tt3-ice-spike','tt3-azure-sword','tt4-woodify'].map(id => catalog.find(card => card.id === id));
const select = document.querySelector('#reviewCase'), body = document.querySelector('#ovBody'), output = document.querySelector('#reviewOutput');
function paint() {
  const mode = select.value, receipt = ['receipt','lost','long'].includes(mode);
  const standalone = mode === 'event-single' || mode === 'event-full';
  const full = mode === 'full' || mode === 'event-full';
  const list = standalone ? [catalog.find(card => card.id === 'tt3-iceheart-potion')] : mode === 'random' || mode === 'bonus' ? cards.slice(0,1) : cards;
  const isPick = mode === 'choice' || mode === 'full';
  const claimedCards = mode === 'receipt' ? [cards[0],cards[0],cards[1]] : mode === 'long' ? Array.from({length:18}, (_,i) => ({name:`长名称奖励样例${i+1}·冰原遗物`})) : [];
  const overview = chestRewardOverviewHTML({ complete:receipt, title:'战斗胜利', notice:receipt ? '本批奖励已处理' : '选择你的收获', boxes:[{index:0,name:'密封物资箱',completed:receipt,takenCount:claimedCards.length,lostCount:mode==='lost'?3:0}], footer:'背包 8/16 格', primaryAction:receipt?null:{index:0,label:'搜刮物资'} });
  const overviewOnly = mode.startsWith('overview');
  const overviewPreview = overviewOnly ? chestRewardOverviewHTML({title:'战斗胜利',coins:{total:1,pending:0},boxes:Array.from({length:mode==='overview-multi'?4:1},(_,index)=>({index,name:index?'密封物资箱':'职业补给箱',choice:true,rule:'3 张中选 1 张',art:'<img src="/assets/scenes/chests/class-rig-v1/frame-00.webp" alt="">',active:index===0})),footer:'[[icon:bag]] 3/16 格',primaryAction:{index:0,label:'搜刮物资'}}) : overview;
  const picker = overviewOnly || receipt ? '' : rewardSceneHTML({compact:list.length===1&&!isPick,claimMode:isPick?'one':'all',progress:{total:list.length,pending:list.length,received:0,choiceCount:list.length,choicePending:isPick},className:`reward-v14${standalone ? ' reward-standalone-picker' : ''}`,source:standalone?'污染空投箱':'',title:standalone?'领取奖励':rewardPickerTitle({isPick,choice:mode==='bonus',count:list.length,randomSingle:mode==='random'}),countLabel:'',rule:'',cards:list.map((card,index)=>`<article class="reward-unit" data-reward-category="${isPick?'choice':'loot'}"><button type="button" class="reward-card" data-act="fixtureInspect">${cardHTML(card)}</button>${list.length===1&&!isPick?'':rewardClaimHTML({index,cardName:card.name,choice:isPick,fits:!full,claimMode:isPick?'one':'all'})}</article>`).join(''),actions:list.length===1&&!isPick?rewardClaimHTML({index:0,cardName:list[0].name,fits:!full,claimMode:'all'}):'',count:list.length,footer:`<span class="reward-capacity">[[icon:bag]] ${full?'16':'8'}/16 格</span><button class="reward-bag${full?' is-primary':''}" data-act="fixtureBag">整理背包</button>${standalone?'<button class="reward-bag" data-act="fixtureReturn">返回地图</button>':''}<details class="reward-secondary-options"><summary>其他操作</summary><button class="reward-bag danger" data-act="fixtureSkip">放弃剩余卡牌</button></details>${full?'<span class="reward-capacity-note" role="status">当前候选都放不下，奖励保留。</span>':''}`});
  body.innerHTML=SDT.Icons.rich(standalone ? picker : chestRewardFrameHTML({overview:overviewPreview,picker,label:mode==='random'?'小型物资箱':'密封物资箱'}));output.hidden=true;markReviewReady(body);
}
select.addEventListener('change',paint);
document.querySelector('#before').addEventListener('change',e=>body.classList.toggle('review-before',e.target.checked));
document.querySelector('#diagnose').addEventListener('click',()=>{output.textContent=JSON.stringify(inspectVisibleLayout(body),null,2);output.hidden=false;});
document.querySelector('#hideTools').addEventListener('click',()=>{document.querySelector('.review-tools').hidden=true;output.hidden=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelector('.review-tools').hidden=false;output.hidden=true;}});
body.addEventListener('click',e=>{if(e.target.closest('[data-act]')){output.textContent='隔离展示：不执行领取、丢弃或存档操作。';output.hidden=false;}});
paint();

