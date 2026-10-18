// Differential checks against real grantEventCard and real bag accounting.
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { canReceiveCardFromBag, PEARL_BOX_ID, previewCardRewards, stackCapOf } from '../game/src/core/card-capacity.js';
import { Random } from '../game/src/core/random.js';
const H = vi.hoisted(() => ({ game:{}, UI:{}, uid:0 }));
vi.mock('../game/src/run/game.session.js', () => ({
  game:H.game, MAP:{ rules:{} }, bagCap:()=>H.game.bagCap(), usedSlots:()=>H.game.usedSlots(),
  newUid:()=>`preview-${++H.uid}`, pick:items=>items[0], scaledEnemy:item=>item, saveGame:()=>H.game.persistSave(),
}));
vi.mock('../game/src/run/game.session.kernel.js', () => ({ game:H.game, MAP:{ rules:{ fireHeal:10 } } }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen(){}, cardHTML:card=>`<span>${card.name}</span>` }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots:{ showBackpack:vi.fn() } }));
const ordinary = { id:'ordinary', name:'普通卡', type:'法术', rarity:'古朴' };
const starter = { ...ordinary, id:'starter', name:'初始攻击' };
const fireball = { ...ordinary, id:'fireball', name:'火球' };
const pearl = { ...ordinary, id:PEARL_BOX_ID, name:'珍珠盒', type:'装备' };
const resource = i => ({ ...ordinary, id:`resource-${i}`, name:`资源${i}`, type:'资源' });
const other = i => ({ ...ordinary, id:`other-${i}`, name:`别的卡${i}` });
const copies = (card,n,flags={}) => Array.from({ length:n },(_,i)=>({ uid:`${card.id}-${i}-${JSON.stringify(flags)}`, card, ...flags }));
const acts = {};
let Bag, Chests, scenes;
// Reopening rewards legitimately refreshes the node checkpoint; projection must
// leave the bag, gameplay fields and RNG unchanged.
const snapshot = () => JSON.stringify({ ...H.game, nodeChestRewards:undefined });
function arrange(ownedCards=[],used=18) {
  H.game.ownedCards=ownedCards;
  H.game.inventory=Array.from({ length:used-Bag.cardStacks(false).length },(_,i)=>({ name:`物资${i}`, count:1 }));
  expect(Bag.usedSlots()).toBe(used);
}
function projection(rewards) {
  return previewCardRewards(rewards, { ownedCards:H.game.ownedCards, usedSlots:Bag.usedSlots(), baseCap:18, totalCap:Bag.bagCap() });
}
function compareRealGrant(rewards,accepted,blocked) {
  const before=snapshot(), rng=Random.snapshot(), saves=H.game.persistSave.mock.calls.length, storage=localStorage.length;
  const result=projection(rewards);
  expect(result.acceptedIndices).toEqual(accepted); expect(result.blockedIndices).toEqual(blocked);
  expect(result.canTake).toBe(accepted.length); expect(result.cant).toBe(blocked.length);
  expect(snapshot()).toBe(before); expect(Random.snapshot()).toEqual(rng);
  expect(H.game.persistSave).toHaveBeenCalledTimes(saves); expect(localStorage.length).toBe(storage);
  expect(H.game.grantCard).not.toHaveBeenCalled();
  const actualAccepted=[], actualBlocked=[];
  rewards.forEach((card,i)=>(H.game.grantCard(card,{ silent:true })?actualAccepted:actualBlocked).push(i));
  expect(actualAccepted).toEqual(result.acceptedIndices); expect(actualBlocked).toEqual(result.blockedIndices);
  expect(Bag.usedSlots()).toBe(result.usedSlots); expect(Bag.bagCap()).toBe(result.totalCap);
  expect(Random.snapshot()).toEqual(rng);
  return result;
}
function open({ rewards,kind='small',taken=[],lost=[],choiceCount }={}) {
  const saved={ version:1, seed:7, layerIdx:0, trackPos:1, queue:[{ kind }], index:1, context:{ onCell:true },
    current:{ kind, cards:rewards, coins:0, coinsReceived:false, taken,lost,rewardStage:'cards', ...(choiceCount==null?{}:{choiceCount}) } };
  expect(Chests.restore(H.game,saved,()=>{})).toBe(true);
}
beforeAll(async () => {
  Object.assign(H.UI,{ el:{}, act:(name,fn)=>acts[name]=fn,
    showOverlay:(_title,html)=>{ H.UI.el.ovBody.innerHTML=html; H.UI.el.overlay.hidden=false; },
    hideOverlay:()=>H.UI.el.overlay.hidden=true,refresh(){},log:vi.fn(),showCardReward:vi.fn(),_checkPageBg(){} });
  window.SDT ||= {}; Object.assign(window.SDT,{ game:H.game,UI:H.UI,Icons:{rich:html=>html},Sound:{sfx(){}},Meta:{},
    Base:{slot:1,bagCap:()=>18,safeCap:()=>3,isSha:()=>false,data:{}},
    MAP:{chestKinds:{small:{name:'小宝箱'},medium:{name:'中宝箱',pickFrom:3}}},
    Cards:{all:()=>[ordinary],cardHTML:card=>`<span>${card.name}</span>`,rarityOf:card=>card.rarity,sellPrice:()=>1},
  });
  Bag=await import('../game/src/run/game.session.bag.js'); scenes=await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js'); Chests=window.SDT.Chests;
});
beforeEach(()=>{
  vi.useFakeTimers();vi.clearAllMocks();localStorage.clear();H.uid=0;Random.reseed('capacity-preview');
  document.body.innerHTML='<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  H.UI.el={overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody'),ovTitle:document.getElementById('ovTitle')};
  Object.assign(H.game,{seed:7,layerIdx:0,trackPos:1,discoveredPairs:new Set(),state:'modal',ownedCards:[],inventory:[],coins:0,
    usedSlots:Bag.usedSlots,bagCap:Bag.bagCap,bagCapacityText:Bag.bagCapacityText,
    grantCard:vi.fn((card,opts)=>scenes.grantEventCard(card,opts)),gainCoins:vi.fn(),persistSave:vi.fn(()=>true)});
  const source=readFileSync('game/src/run/game.session.js','utf8');
  const match=source.match(/function canReceiveCard\(card\)\s*\{([\s\S]*?)\n {2}\}/);expect(match).toBeTruthy();
  H.game.canReceiveCard=new Function('game','canReceiveCardFromBag','canAcceptCard',`return function(card){${match[1]}}`)(H.game,canReceiveCardFromBag,Bag.canAcceptCard);
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});

describe('真实发卡与只读顺序容量预估一致',()=>{
  it('抽取后的live判定在1215组状态上与抽取前规则逐项相同',()=>{
    let checked=0;
    for (const card of [ordinary,starter,fireball]) for (let n=0;n<=8;n++) {
      for (const flags of [{},{safe:true},{stored:true}]) for (const used of [17,18,27]) {
        arrange([...copies(pearl,1),...copies(card,n,flags)],used);
        for (const candidate of [card,{...card,type:'资源'},other(0),resource(0),null]) {
          // Independent reference: the exact pre-extraction live branch order and limits.
          let expected=false;
          if (candidate) {
            const count=H.game.ownedCards.filter(o=>!o.safe&&!o.stored&&o.card.name===candidate.name).length;
            const limit=candidate.type==='装备'?1:3;
            expected=(count>0&&count%limit!==0)||Bag.usedSlots()<18||(candidate.type==='资源'&&Bag.usedSlots()<Bag.bagCap());
          }
          expect(H.game.canReceiveCard(candidate)).toBe(expected);checked++;
        }
      }
    }
    expect(checked).toBe(1215);
  });
  it.each([
    ['普通1/3满包',ordinary,1,18,3,[0,1],[2]],
    ['普通2/3满包',ordinary,2,18,2,[0],[1]],
    ['普通3/3满包',ordinary,3,18,2,[],[0,1]],
    ['普通空堆一格',ordinary,0,17,4,[0,1,2],[3]],
    ['普通空堆跨两格',ordinary,0,16,7,[0,1,2,3,4,5],[6]],
    ['普通2/3跨堆',ordinary,2,17,5,[0,1,2,3],[4]],
    ['初始1/3满包',starter,1,18,5,[0,1],[2,3,4]],
    ['初始3/3满包',starter,3,18,2,[],[0,1]],
    ['初始2/3跨堆',starter,2,17,7,[0,1,2,3],[4,5,6]],
    ['火球1/3满包',fireball,1,18,5,[0,1],[2,3,4]],
  ])('%s',(_name,card,n,used,rewardCount,accepted,blocked)=>{
    arrange(copies(card,n),used);compareRealGrant(Array(rewardCount).fill(card),accepted,blocked);
  });
  it('两个新卡抢一个空格，只让原顺序第一张使用',()=>{
    arrange([],17);compareRealGrant([other(0),other(1)],[0],[1]);
  });
  it('失败不推进，后续已有同名未满堆仍可收',()=>{
    arrange(copies(ordinary,1));compareRealGrant([other(0),ordinary,ordinary],[1,2],[0]);
  });
  it('safe/stored同名不充当普通背包可合并堆',()=>{
    arrange([...copies(ordinary,2,{safe:true}),...copies(ordinary,2,{stored:true})]);
    compareRealGrant([ordinary],[],[0]);
  });
  it('普通同名余量不被safe/stored同名数量干扰',()=>{
    arrange([...copies(ordinary,1),...copies(ordinary,4,{safe:true}),...copies(ordinary,3,{stored:true})]);
    compareRealGrant([ordinary,ordinary,ordinary],[0,1],[2]);
  });
  it('无扩容满基础格，资源也不能凭类型突破总容量',()=>{
    arrange();compareRealGrant([resource(0)],[],[0]);
  });
  it('珍珠盒资源专用格不能被新普通卡抢占，资源逐张占满后再拒收',()=>{
    arrange(copies(pearl,1));compareRealGrant([other(0),...Array.from({length:10},(_,i)=>resource(i))],[1,2,3,4,5,6,7,8,9],[0,10]);
  });
  it('已越基础格时，普通卡仍能并入既有未满堆但不能新开普通格',()=>{
    arrange([...copies(pearl,1),...copies(ordinary,1)],20);
    compareRealGrant([ordinary,ordinary,other(0),resource(0)],[0,1,3],[2]);
  });
  it('safe/stored珍珠盒不占普通格，但每张仍贡献真实9格扩容',()=>{
    arrange([...copies(pearl,1,{safe:true}),...copies(pearl,1,{stored:true})]);
    expect(Bag.bagCap()).toBe(36);
    compareRealGrant(Array.from({length:19},(_,i)=>resource(i)),Array.from({length:18},(_,i)=>i),[18]);
  });
  it('先成功收到珍珠盒，后续资源立即使用新增空间',()=>{
    arrange([],17);compareRealGrant([pearl,resource(0),resource(1),other(0)],[0,1,2],[3]);
  });
  it('前卡占掉最后基础格后珍珠盒被拒，不产生虚假扩容',()=>{
    arrange([],17);compareRealGrant([resource(0),pearl,resource(1)],[0],[1,2]);
  });
  it('同名装备珍珠盒不能并堆突破基础容量',()=>{
    arrange(copies(pearl,1));compareRealGrant([pearl,...Array.from({length:10},(_,i)=>resource(i))],Array.from({length:9},(_,i)=>i+1),[0,10]);
  });
  it('预估支持冻结输入，不修改owned/card/奖励数组或flags',()=>{
    arrange(copies(ordinary,2),17);
    const owned=H.game.ownedCards.map(o=>Object.freeze({...o,card:Object.freeze({...o.card})}));Object.freeze(owned);
    const rewards=Object.freeze([Object.freeze({...ordinary}),Object.freeze({...other(0)})]);
    expect(previewCardRewards(rewards,{ownedCards:owned,usedSlots:17,baseCap:18,totalCap:18}).acceptedIndices).toEqual([0,1]);
  });
  it('bag旧stackCap/珍珠盒ID导出仍与共享规则同一接口',()=>{
    expect(Bag.stackCapOf).toBe(stackCapOf);expect(Bag.PEARL_BOX_ID).toBe(PEARL_BOX_ID);
    expect([stackCapOf(ordinary),stackCapOf(starter),stackCapOf(fireball)]).toEqual([3,3,3]);
  });
});

describe('奖励页使用同一顺序预估，排除领取/放弃且区分原选择与已掷附赠',()=>{
  it('过滤后pending下标独立，不把原已领/已放弃卡重新发放',()=>{
    const received=other('received'),lost=other('lost');arrange(copies(received,1),17);
    const rewards=[received,lost,ordinary,other('last')];
    const filtered=rewards.filter((_,i)=>i>1);
    expect(projection(filtered).acceptedIndices).toEqual([0]);expect(projection(filtered).blockedIndices).toEqual([1]);
    const before=snapshot(),rng=Random.snapshot();open({rewards,taken:[0],lost:[1]});
    expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')?.textContent).toContain('预计可收 1 张 · 1 张待整理');
    expect(snapshot()).toBe(before);expect(Random.snapshot()).toEqual(rng);expect(H.game.grantCard).not.toHaveBeenCalled();
    acts.chestTake();expect(H.game.grantCard.mock.calls.map(([card])=>card.id)).toEqual([ordinary.id,other('last').id]);
    expect(Chests.serialize(H.game).current).toMatchObject({taken:[0,2],lost:[1]});
  });
  it('choiceCount后的可收gift不能掩盖原三选一候选全部拒收',()=>{
    arrange(copies(pearl,1));const before=snapshot();
    open({kind:'medium',rewards:[ordinary,resource('gift')],choiceCount:1});
    expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')?.textContent).toContain('当前候选都放不下');
    expect(H.UI.el.ovBody.querySelector('[data-act="chestTake"]')).toBeNull();
    expect(H.UI.el.ovBody.querySelector('[data-act="chestTake1"][data-i="1"]')).toBeTruthy();
    expect(snapshot()).toBe(before);expect(H.game.grantCard).not.toHaveBeenCalled();
  });
  it('原选择解决后，只按顺序预估已有gift，不重抽、不重发原奖励',()=>{
    const chosen=other('chosen');arrange(copies(chosen,1),17);
    open({kind:'medium',rewards:[chosen,other('lost'),ordinary,other('gift')],taken:[0],lost:[1],choiceCount:2});
    expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')?.textContent).toContain('预计可收 1 张 · 1 张待整理');
    expect(H.UI.el.ovBody.querySelector('[data-act="chestTake"]')).toBeTruthy();
    const rng=Random.snapshot();acts.chestTake();
    expect(H.game.grantCard.mock.calls.map(([card])=>card.id)).toEqual([ordinary.id,other('gift').id]);
    expect(Chests.serialize(H.game).current).toMatchObject({taken:[0,2],lost:[1],choiceCount:2});
    expect(Random.snapshot()).toEqual(rng);
  });
});
