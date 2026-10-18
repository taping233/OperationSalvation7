import { rollEventDice } from './helpers/event-dice.js';
// Real session/loadGame/RunStorage, event flow/choice, fixed rewards and Chests.
// Canvas, narrative lookup and presentation are isolated; no browser/player data.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RULES } from '../game/src/core/rules.js';
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative:async()=>null,lastLampNarrative:async()=>null }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands:{ inspect:()=>({ok:true,value:{kind:'complete'}}) } }));
const canvas = new Proxy({}, { get:()=>()=>canvas, set:()=>true });
window.HTMLCanvasElement.prototype.getContext=()=>canvas;
document.body.innerHTML='<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT ||= {}; Object.assign(window.SDT,{ Icons:{img:()=>'',rich:html=>html,TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){}},FX:{feedback(){}},MAP:{rules:{...RULES},items:{rations:{name:'口粮'},wood:{name:'木材'}}} });
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
const session=await import('../game/src/run/game.session.js');
const {RunStorage}=await import('../game/src/hub/game.storage.js');
const Base=window.SDT.Base, UI=window.SDT.UI, Cards=window.SDT.Cards;
const acts={},logs=[];
Object.assign(UI,{_acts:acts,_baseActs:{},_roomActive:true,el:{},
  act:(name,fn)=>acts[name]=fn,log:message=>logs.push(message),refresh(){},clearLog(){},hideScreen(){},showScreen(){},registerHelp(){},helpBtn:()=>'',
  showOverlay:(_title,html)=>{UI.el.ovBody.innerHTML=html;UI.el.overlay.hidden=false;},hideOverlay:()=>{UI.el.overlay.hidden=true;},showCardReward:vi.fn(),
});
window.SDT.Meta={setXpMul(){},track(){},checkUnlocks(){}};
window.SDT.Nest={renderNestMap:vi.fn()};window.SDT.Battle={restore:vi.fn()};
const scenes=await import('../game/src/run/game.run.scenes.js');
const flow=await import('../game/src/run/game.run.flow.js');
await import('../game/src/run/chests.js');
const Chests=window.SDT.Chests;
const {Random}=await import('../game/src/core/random.js');
const {setBagReturnHook,takeBagReturnHook}=await import('../game/src/hub/bag-return-hook.js');
const {bagSlots}=await import('../game/src/hub/game.bag.bridge.js');
const apollo={id:'tt2-apollo',name:'阿猫的礼物',type:'装备',rarity:'史诗',cost:0};
const bonus={id:'gift-bonus',name:'征用附赠牌',type:'法术',rarity:'古朴',cost:0};
const plain={id:'plain-equipment',name:'普通征用装备',type:'装备',rarity:'古朴',cost:0};
const event={id:'ev19-quartermaster',name:'装备征用令',type:'事件',rarity:'衍生',unrandom:true};
let catalog,key;
const saved=()=>RunStorage.read(1);
const ownCount=id=>session.game.ownedCards.filter(owned=>owned.card.id===id).length;
function fill(n){return Array.from({length:n},(_,i)=>({uid:`filler-${i}`,card:{id:`filler-${i}`,name:`不同已有卡${i}`,type:'法术',rarity:'古朴'}}));}
async function openQuartermaster(card=apollo){
  catalog=[event,card,bonus];const opening=flow.runEventDeck();await vi.advanceTimersByTimeAsync(1000);await opening;
  acts.evtChoice({i:'0'}); rollEventDice(UI);expect(session.game.coins).toBe(15);expect(saved().nodeRewards[key]).toMatchObject({paidCoins:3,taken:null});
}
function reload(){session.game.state='title';const result=session.loadGame(1);expect(result,JSON.stringify(result)).toMatchObject({ok:true});}
beforeEach(()=>{
  vi.useFakeTimers();vi.clearAllMocks();localStorage.clear();for(let slot=1;slot<=5;slot++)RunStorage.remove(slot);
  document.body.innerHTML='<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div><div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el={overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody'),ovTitle:document.getElementById('ovTitle')};
  UI.el.ovBody.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b)acts[b.dataset.act]?.(b.dataset);});
  for(const name of Object.keys(acts))delete acts[name];logs.length=0;setBagReturnHook(null);
  window.SDT.MAP.chestKinds={small:{name:'小宝箱'}};UI._roomActive=true;
  catalog=[event,apollo,bonus];vi.spyOn(Cards,'all').mockImplementation(()=>catalog);vi.spyOn(Cards,'cardHTML').mockImplementation(card=>`<span>${card.name}</span>`);
  Base.use(1);session._set_active_slot(1);session.buildDerived('quartermaster-gift-cloud');
  Object.assign(session.game,{runActive:true,nestActive:false,state:'idle',layerIdx:0,trackPos:session.game.layerData[0].entrances[0],myClass:'warrior',coins:18,
    ownedCards:fill(Base.bagCap()-1),usedPocket:[],inventory:[],nodeRewards:{},discoveredPairs:new Set(),visited:{},entrySupply:null,
    pendingExtraction:null,extractionPending:null,terminalPending:null,battleActive:false,hp:35,maxHp:35,fragments:0});
  key=`0,${session.game.trackPos}`;session.game.grantCard=scenes.grantEventCard;session.game.persistSave=session.saveGame;
  session.configureGameRuntime({resumeEventCardChoice:flow.resumeEventCardChoice,resumeChestsOnCell:scenes.resumeChestsOnCell,openClassChoice:vi.fn()});
  Random.reseed('quartermaster-gift-cloud');session.game.seed=Random.seed;expect(session.saveGame()).toBe(true);
});
afterEach(()=>{vi.restoreAllMocks();vi.clearAllTimers();vi.useRealTimers();});

describe('装备征用阿猫整体交接固定待领奖',()=>{
  it('主卡选择锁定与待领快照同份保存；旧关闭不覆盖新页，实际主卡/附赠分别领取',async()=>{
    await openQuartermaster();const oldPick=acts.eventCardPick,oldExit=acts.eventExit;const rng=Random.snapshot();
    UI.el.ovBody.querySelector('[data-act="eventCardPick"]').click();
    expect(ownCount(apollo.id)).toBe(0);expect(Random.snapshot()).toEqual(rng);expect(UI.el.ovBody.querySelector('.reward-v14')).toBeTruthy();
    expect(saved().nodeRewards[key]).toMatchObject({paidCoins:3,taken:0});expect(saved().visited[key]).toBe(1);
    expect(saved().chestReward.current.cards.map(card=>card.id)).toEqual([apollo.id]);expect(saved().chestReward.current.taken).toEqual([]);
    const page=UI.el.ovBody.firstElementChild;oldPick({i:0});oldExit();expect(UI.el.ovBody.firstElementChild).toBe(page);expect(session.game.coins).toBe(15);
    acts.chestTake1({i:0});expect(ownCount(apollo.id)).toBe(1);expect(ownCount(bonus.id)).toBe(0);expect(saved().chestReward.current.cards[1].id).toBe(bonus.id);
    session.game.ownedCards.splice(0,1);Chests.resume();acts.chestTake1({i:1});acts.chestTake1({i:1});
    expect(ownCount(apollo.id)).toBe(1);expect(ownCount(bonus.id)).toBe(1);expect(session.game.coins).toBe(15);
  });

  it('真实loadGame在主卡未领和附赠待领两阶段均优先恢复chest，不重付或重领',async()=>{
    await openQuartermaster();acts.eventCardPick({i:0});reload();
    expect(session.game.nodeRewards[key].taken).toBe(0);expect(ownCount(apollo.id)).toBe(0);expect(UI.el.ovBody.querySelector('.reward-v14')).toBeTruthy();
    acts.chestTake1({i:0});const rng=Random.snapshot();catalog=[event,apollo,{...bonus,id:'changed',name:'改池奖励'}];reload();
    expect(ownCount(apollo.id)).toBe(1);expect(saved().chestReward.current.cards[1].id).toBe(bonus.id);acts.chestTake1({i:0});expect(ownCount(apollo.id)).toBe(1);
    session.game.ownedCards.splice(0,1);Chests.resume();acts.chestTake1({i:1});expect(ownCount(bonus.id)).toBe(1);expect(session.game.coins).toBe(15);expect(Random.snapshot().streams.loot).toBe(rng.streams.loot);expect(Random.snapshot().streams.event).toBe(rng.streams.event);
    reload();acts.chestTake1({i:1});expect(ownCount(bonus.id)).toBe(1);
  });

  it('完全满包也只锁定主卡待领，不实际发本体或附赠；整理后才发',async()=>{
    session.game.ownedCards=fill(Base.bagCap());await openQuartermaster();acts.eventCardPick({i:0});const rng=Random.snapshot();acts.chestTake1({i:0});
    expect(ownCount(apollo.id)).toBe(0);expect(Chests.serialize(session.game).current.taken).toEqual([]);expect(Random.snapshot()).toEqual(rng);
    session.game.ownedCards.pop();Chests.resume();acts.chestTake1({i:0});expect(ownCount(apollo.id)).toBe(1);expect(Chests.serialize(session.game).current.cards).toHaveLength(2);
  });

  it.each(['missing','missing-serialize','false','throw-before'])('承接器%s时不发任何卡/不锁选择/不消费节点，已付3币与固定候选保留',async failure=>{
    await openQuartermaster();const before=saved(),rng=Random.snapshot();
    if(failure==='missing')Chests.restore=undefined;
    else if(failure==='missing-serialize')Chests.serialize=undefined;
    else vi.spyOn(Chests,'restore').mockImplementation(()=>{if(failure==='throw-before')throw new Error('before adoption');return false;});
    try{
      acts.eventCardPick({i:0});expect(ownCount(apollo.id)).toBe(0);expect(ownCount(bonus.id)).toBe(0);expect(session.game.nodeRewards[key].taken).toBeNull();
      expect(session.game.visited[key]).toBe(1);expect(session.game.coins).toBe(15);expect(Random.snapshot()).toEqual(rng);
      expect(saved().nodeRewards[key]).toEqual(before.nodeRewards[key]);expect(saved().chestReward).toBeNull();expect(UI.el.ovBody.querySelector('[data-event-capacity]').textContent).toMatch(/保留/);
    }finally{if(failure==='missing')Chests.restore=originalRestore;if(failure==='missing-serialize')Chests.serialize=originalSerialize;}
  });

  it('承接已建立并保存后才抛异常时保留已锁选择与待领，不回滚成可重选',async()=>{
    await openQuartermaster();vi.spyOn(Chests,'restore').mockImplementation((...args)=>{originalRestore(...args);throw new Error('after adoption');});
    acts.eventCardPick({i:0});expect(session.game.nodeRewards[key].taken).toBe(0);expect(saved().nodeRewards[key].taken).toBe(0);
    expect(saved().chestReward.current.cards[0].id).toBe(apollo.id);expect(UI.el.ovBody.querySelector('.reward-v14')).toBeTruthy();expect(ownCount(apollo.id)).toBe(0);
  });

  it.each([[[1]],[[2]],[[1,2]]])('交接两次保存失败序列%j：每一尝试都含锁定+chest，成功盘面不留刷新复制窗口',async failedWrites=>{
    await openQuartermaster();const beforeRaw=localStorage.getItem(RunStorage.key(1)),attempts=[],original=Storage.prototype.setItem;let writes=0;
    const failure=vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(storageKey,value){
      if(storageKey===RunStorage.key(1)){writes++;attempts.push(JSON.parse(value));if(failedWrites.includes(writes))throw new Error('isolated transfer save failure');}
      return original.call(this,storageKey,value);
    });
    acts.eventCardPick({i:0});expect(writes).toBe(2);expect(ownCount(apollo.id)).toBe(0);
    for(const attempt of attempts){expect(attempt.nodeRewards[key]).toMatchObject({taken:0,paidCoins:3});expect(attempt.visited[key]).toBe(1);expect(attempt.chestReward.current.cards[0].id).toBe(apollo.id);}
    if(failedWrites.length===2){expect(localStorage.getItem(RunStorage.key(1))).toBe(beforeRaw);expect(session.game.nodeRewards[key].taken).toBe(0);expect(Chests.serialize(session.game).current.cards[0].id).toBe(apollo.id);}
    else{expect(saved().nodeRewards[key].taken).toBe(0);expect(saved().chestReward.current.cards[0].id).toBe(apollo.id);}
    failure.mockRestore();expect(session.saveGame()).toBe(true);reload();acts.chestTake1({i:0});expect(ownCount(apollo.id)).toBe(1);expect(session.game.coins).toBe(15);
  });

  it('普通非阿猫选择保持原即时发卡/关闭/保存，不依赖固定领奖端口',async()=>{
    await openQuartermaster(plain);Chests.restore=undefined;
    try{acts.eventCardPick({i:0});expect(ownCount(plain.id)).toBe(1);expect(saved().nodeRewards[key].taken).toBe(0);expect(saved().chestReward).toBeNull();expect(UI.el.overlay.hidden).toBe(true);}
    finally{Chests.restore=originalRestore;}
  });

  it('整理返回同候选、交接后旧背包回调不覆盖固定领奖页，完成重进无新付款',async()=>{
    await openQuartermaster();const ids=[...session.game.nodeRewards[key].cardIds];
    bagSlots.showBackpack=()=>{UI.showOverlay('背包','<main class="bag-view">背包</main>');};acts.eventCardBag();const oldReturn=takeBagReturnHook();oldReturn();
    expect(session.game.nodeRewards[key].cardIds).toEqual(ids);acts.eventCardPick({i:0});const page=UI.el.ovBody.firstElementChild;oldReturn();expect(UI.el.ovBody.firstElementChild).toBe(page);
    acts.chestTake1({i:0});session.game.ownedCards.splice(0,1);acts.chestTake1({i:1});acts.chestContinue();expect(session.game.state).toBe('idle');
    flow.reenterCell();expect(session.game.coins).toBe(15);expect(ownCount(apollo.id)).toBe(1);expect(ownCount(bonus.id)).toBe(1);
  });
});
const originalRestore=Chests.restore,originalSerialize=Chests.serialize;
