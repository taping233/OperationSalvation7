// 默认构造内存测试局；显式持久化模式仅允许独立5308端口，不替代自然跑局证据。
import '../src/main.js';
import { game, newUid, _set_active_slot, loadGame } from '../src/run/game.session.js';
import { RunStorage } from '../src/hub/game.storage.js';
import { devJumpNode } from '../src/run/game.run.dev.js';
import { showBackpack } from '../src/hub/game.bag.js';
import { openBossGate } from '../src/run/game.run.altar.js';
import { startBattle } from '../src/battle/battle-loader.js';
import { warehouseHTML, bindWarehouse } from '../src/hub/hub.warehouse.js';
import { createShopController } from '../src/run/game.run.shop.js';
import { runEventDeck } from '../src/run/game.run.flow.js';
import { _set_cardPageOpen, cardHTML } from '../src/hub/game.cardslib.js';
const SDT=window.SDT, UI=SDT.UI;
const card=id=>{const found=SDT.Cards.all().find(c=>c.id===id);if(!found)throw new Error(`缺少卡牌 ${id}`);return {...found};};
const originalPersistSave=game.persistSave;
const durableReview=location.hostname==='127.0.0.1'&&location.port==='5308'&&new URLSearchParams(location.search).get('durable')==='1';
let rewardSaveBlocked=false;
function prepare(ids) {
  game.persistSave=originalPersistSave;rewardSaveBlocked=false;
  const saveControl=controls.querySelector('[data-review="reward-save"]');
  saveControl.disabled=true;saveControl.textContent='模拟奖励保存失败';
  _set_active_slot(null);
  SDT.Sound.setMuted?.(true);
  devJumpNode('shop');
  UI.hideOverlay({immediate:true});
  game.state='idle';game.battleActive=false;game.hp=30;game.maxHp=30;
  game.inventory=[];game.usedPocket=[];game.cardOrder=[];
  game.ownedCards=ids.map(id=>({uid:newUid(),card:card(id)}));
}
const controls=document.createElement('nav');
const { openShop:openReviewShop }=createShopController({UI,SDT,game,newUid,
  bagCap:()=>game.bagCap(),usedSlots:()=>game.usedSlots(),cardHTML,setCardPageOpen:_set_cardPageOpen,
  saveGame:()=>!rewardSaveBlocked});
controls.style.cssText='position:fixed;left:12px;top:12px;z-index:100000;display:flex;flex-wrap:wrap;max-width:calc(100vw - 24px);gap:6px;background:#18232b;padding:8px;color:white;font:14px sans-serif';
controls.innerHTML='<button data-review="bag">构造背包</button><button data-review="battle">构造战斗</button><button data-review="boss">构造首脑入口</button><button data-review="warehouse">构造后勤资源</button><button data-review="rewards">构造满包战利品</button><button data-review="reward-save" disabled>模拟奖励保存失败</button><button data-review="hide">隐藏验收入口</button>';
if(!durableReview)controls.insertAdjacentHTML('beforeend','<button data-review="checkpoint-rewards">构造完成保存奖励</button><button data-review="checkpoint-shop">构造商店结算</button><button data-review="event-choice">构造军需事件</button><button data-review="event-dice">构造救护事件</button>');
if(durableReview)controls.insertAdjacentHTML('beforeend','<button data-review="durable-rewards">建立持久化奖励（测试档1）</button><button data-review="load">读取测试档1</button><button data-review="inspect-save">查看落盘结果</button><output id="reviewSaveStatus" hidden style="flex-basis:100%;max-height:180px;overflow:auto;white-space:pre-wrap"></output>');
controls.addEventListener('click',async event=>{
  const kind=event.target.closest('[data-review]')?.dataset.review;
  if(!kind)return;
  if(kind==='hide'){controls.hidden=true;return;}
  if(kind==='inspect-save'&&durableReview){
    const saved=RunStorage.read(1),key=saved?`${saved.layerIdx},${saved.trackPos}`:'';
    const reward=saved?.chestReward||saved?.nodeChestRewards?.[key];
    const output=controls.querySelector('#reviewSaveStatus');
    output.hidden=!output.hidden;
    output.textContent=JSON.stringify({origin:location.origin,slot:1,saved:!!saved,seed:saved?.seed,node:key,coins:saved?.coins,
      revision:saved?._r2?.revision,owned:saved?.ownedCards?.map(owned=>({uid:owned.uid,id:owned.card.id,name:owned.card.name,safe:!!owned.safe})),
      reward:reward?{cards:reward.current?.cards?.map(card=>card.id),taken:reward.current?.taken,lost:reward.current?.lost,screen:reward.screen}:null});
    return;
  }
  if(kind==='load'&&durableReview){
    _set_active_slot(1);SDT.Sound.setMuted?.(true);
    const result=loadGame(1);
    if(result.ok)document.getElementById('title').hidden=true;
    else UI.log(`测试档读取失败：${result.code}`,'warn');
    return;
  }
  if(kind==='reward-save'){
    rewardSaveBlocked=!rewardSaveBlocked;
    event.target.textContent=rewardSaveBlocked?'恢复奖励保存':'模拟奖励保存失败';
    return;
  }
  if(game.battleActive){UI.log('请刷新隔离夹具后再切换场景','warn');return;}
  if(kind==='checkpoint-shop'){
    prepare(['tt-wood','tt-rations']);game.coins=20;
    game.persistSave=()=>!rewardSaveBlocked;
    controls.querySelector('[data-review="reward-save"]').disabled=false;
    openReviewShop('checkpoint-review');
  }else if(kind==='event-choice'||kind==='event-dice'){
    prepare([]);game.coins=18;
    const key=`${game.layerIdx},${game.trackPos}`;
    game.nodeRewards||={};game.nodeChestRewards||={};game.visited||={};
    delete game.nodeChestRewards[key];delete game.visited[key];
    game.nodeRewards[key]={version:1,type:'event',eventId:kind==='event-choice'?'ev19-quartermaster':'tt6-relief'};
    await runEventDeck();
  }else if(kind==='checkpoint-rewards'){
    prepare([]);game.persistSave=()=>!rewardSaveBlocked;
    controls.querySelector('[data-review="reward-save"]').disabled=false;
    const reward={kind:'small',cards:[card('tt3-ice-spike')],coins:0,coinsReceived:true,
      claimMode:'all',taken:[],lost:[],rewardStage:'cards',source:'完成保存隔离夹具',title:'领取奖励'};
    SDT.Chests.restore(game,{version:1,seed:game.seed,layerIdx:game.layerIdx,trackPos:game.trackPos,
      queue:[{kind:'small',reward}],index:1,current:reward,screen:'cards',context:{onCell:true}},()=>{
      game.state='idle';UI.hideOverlay();UI.refresh(game);
    });
  }else if(kind==='bag'){
    prepare(['tt4-shine-token','tt4-shine-token','tt3-grass-armor','tt3-grass-armor',...Array(5).fill('starter-attack')]);
    game.inventory=[{name:'木材',tier:'C',value:1,count:4}];
    showBackpack();
  }else if(kind==='battle'){
    prepare(['tt3-grass-armor','cc-cursed-blade','tt12-barriermend','tt3-holy-shield','tt3-frostfall',...Array(5).fill('starter-attack')]);
    await startBattle(game,{id:'infantry',name:'留言训练靶',hp:999,maxHp:999,atk:1},{isBoss:false,devSample:true});
  }else if(kind==='boss'){
    prepare(['tt3-grass-armor','tt3-frostfall',...Array(16).fill('tt3-holy-shield'),...Array(5).fill('starter-attack')]);
    game.altarActivated=true;openBossGate();
  }else if(kind==='rewards'||(kind==='durable-rewards'&&durableReview)){
    if(kind==='durable-rewards'&&RunStorage.has(1)){UI.log('测试档已存在，请读取继续；本入口不覆盖已有对局','warn');return;}
    const fillers=SDT.Cards.all().filter(c=>c.type==='装备').slice(0,14);
    if(fillers.length!==14)throw new Error('满包夹具需要14张装备');
    prepare([...fillers.map(c=>c.id),...Array(5).fill('starter-attack')]);
    if(kind==='durable-rewards'){
      SDT.Base.use(1);_set_active_slot(1);
    }else{
      // Memory-only fault port; durable review keeps the production save implementation.
      game.persistSave=()=>!rewardSaveBlocked;
      controls.querySelector('[data-review="reward-save"]').disabled=false;
    }
    const reward={kind:'small',cards:['tt3-ice-spike','tt3-frostfall'].map(card),coins:0,coinsReceived:true,
      claimMode:'all',taken:[],lost:[],rewardStage:'cards',source:'满包战利品隔离夹具',title:'领取奖励'};
    SDT.Chests.restore(game,{version:1,seed:game.seed,layerIdx:game.layerIdx,trackPos:game.trackPos,
      queue:[{kind:'small',reward}],index:1,current:reward,screen:'cards',context:{onCell:true}},()=>{
      game.state='idle';UI.hideOverlay();UI.refresh(game);
    });
  }else if(kind==='warehouse'){
    prepare([]);
    // 此Base端口仅持有夹具内存，不调用真实基地持久化。
    const base={slot:'feedback-fixture',PET_EGG_ID:'egg',data:{stash:[{card:card('tt-wood'),count:2}],pocket:[],keys:0,wood:0},stashUsed:()=>base.data.stash.reduce((n,s)=>n+s.count,0),stashCap:()=>25,
      materialInfo:()=>({kind:'wood',label:'木材'}),useStashMaterial(name){const stack=base.data.stash.find(s=>s.card.name===name);if(!stack)return {ok:false};stack.count--;base.data.wood++;if(!stack.count)base.data.stash=[];return {ok:true,msg:`已使用木材；夹具库存 ${base.data.wood}`};}};
    SDT.Base=base;
    const render=()=>{game.state='modal';UI.showOverlay('后勤隔离夹具',warehouseHTML(),'page');bindWarehouse({ui:UI,base,sound:{tick(){},ding(){}},refresh:render});};render();
  }
});
document.body.append(controls);
// Keep the fixture's fault controls usable above production dialogs.
new MutationObserver(()=>controls.removeAttribute('inert')).observe(controls,{attributes:true,attributeFilter:['inert']});
