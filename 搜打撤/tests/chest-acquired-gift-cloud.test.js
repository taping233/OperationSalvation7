import { overlayElements } from './helpers/environment-fixtures.js';
// Real grantEventCard, Chests, bag capacity/stacking, RunStorage and JSON restore.
// Session and presentation ports are isolated; no browser or player save access.
import { readFileSync } from 'node:fs';
import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Random } from '../game/src/core/random.js';
import { canReceiveCardFromBag } from '../game/src/core/card-capacity.js';
import { RunStorage } from '../game/src/hub/game.storage.js';
import { restoreChestReward } from '../game/src/run/chest-reward-save.js';
const H = vi.hoisted(() => ({ game:{}, cards:[], uid:0, saves:[], UI:{} }));
vi.mock('../game/src/run/game.session.js', () => ({
  game:H.game, MAP:{ rules:{} }, bagCap:()=>H.game.bagCap(), usedSlots:()=>H.game.usedSlots(),
  newUid:()=>`gift-${++H.uid}`, pick:items=>items[0], scaledEnemy:item=>item,
  saveGame:()=>H.game.persistSave(),
}));
vi.mock('../game/src/run/game.session.kernel.js', () => ({ game:H.game, MAP:{ rules:{ fireHeal:10 } } }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen(){}, cardHTML:card=>`<span>${card.name}</span>` }));
const bagPort = vi.hoisted(() => ({ showBackpack:vi.fn() }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots:bagPort }));
const apollo = { id:'tt2-apollo', name:'阿猫的礼物', rarity:'史诗', type:'装备', cost:0 };
const bonus = { id:'bonus', name:'附赠测试卡', rarity:'古朴', type:'法术', cost:0 };
const other = { id:'other', name:'未选卡牌', rarity:'古朴', type:'法术', cost:0 };
const eventBonus = { id:'bonus-event', name:'附赠事件卡', rarity:'古朴', type:'事件', cost:0 };
const acts = {};
let pendingAction;
let scenes, Chests, Bag;
const payload = () => ({ seed:H.game.seed, layerIdx:H.game.layerIdx, trackPos:H.game.trackPos,
  ownedCards:H.game.ownedCards, inventory:H.game.inventory, usedPocket:[], chestReward:Chests.serialize(H.game) });
const disk = () => RunStorage.read(1);
const count = id => H.game.ownedCards.filter(owned=>owned.card.id===id).length;
const fill = n => Array.from({ length:n }, (_,i)=>({ uid:`filler-${i}`, card:{ id:`filler-${i}`, name:`不同已有卡${i}`, rarity:'古朴', type:'法术' } }));
function frozenReward({ kind='small', cards=[apollo], choiceCount }={}) {
  return { version:1, seed:7, layerIdx:0, trackPos:1, queue:[{ kind }], index:1, context:{ onCell:true },
    current:{ kind, cards, coins:0, coinsReceived:false, taken:[], lost:[], rewardStage:'cards', ...(choiceCount===undefined?{}:{ choiceCount }) } };
}
async function open(options) { expect(Chests.restore(H.game,frozenReward(options),()=>{})).toBe(true); await RunStorage.flushWrites(); }
async function reload() {
  await RunStorage.flushWrites();
  const saved = RunStorage.readForLoad(1); expect(saved).toBeTruthy();
  H.game.ownedCards=structuredClone(saved.ownedCards);
  expect(Chests.restore(H.game,saved.chestReward,()=>{})).toBe(true);
}
beforeAll(async () => {
  Object.assign(H.UI, { el:{}, act:(name,fn)=>acts[name]=fn,
    showOverlay:(_title,html)=>{ H.UI.el.ovBody.innerHTML=html; H.UI.el.overlay.hidden=false; },
    hideOverlay:()=>H.UI.el.overlay.hidden=true, refresh(){}, log:vi.fn(), showCardReward:vi.fn(), _checkPageBg(){} });
  window.SDT ||= {}; Object.assign(window.SDT, { game:H.game, UI:H.UI, Icons:{ rich:html=>html }, Sound:{ sfx(){} }, Meta:{},
    Base:{ slot:1, bagCap:()=>16, safeCap:()=>3, isSha:()=>false, data:{} },
    MAP:{ chestKinds:{ small:{ name:'小宝箱' }, medium:{ name:'中宝箱', pickFrom:3 } } },
    Cards:{ all:()=>H.cards, isRandomObtainable:()=>true, cardHTML:card=>`<span>${card.name}</span>`, rarityOf:card=>card.rarity, sellPrice:()=>1 },
  });
  Bag=await import('../game/src/run/game.session.bag.js');
  scenes=await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js'); Chests=window.SDT.Chests;
});
beforeEach(async () => {
  await RunStorage.flushWrites();
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear(); RunStorage.readForLoad(1);
  document.body.innerHTML='<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  H.UI.el={ ...overlayElements() };
  H.UI.el.ovBody.addEventListener('click', event=>{ const button=event.target.closest('[data-act]'); if (button) pendingAction=acts[button.dataset.act]?.(button.dataset); });
  H.cards=[apollo,bonus]; H.uid=0; H.saves=[]; Random.reseed('gift-regression');
  Object.assign(H.game, { seed:7, layerIdx:0, trackPos:1, discoveredPairs:new Set(), ownedCards:fill(15), inventory:[], state:'modal', coins:0,
    bagCap:Bag.bagCap, usedSlots:Bag.usedSlots, bagCapacityText:Bag.bagCapacityText,
    grantCard:(card,opts)=>scenes.grantEventCard(card,opts), gainCoins:n=>H.game.coins+=n,
    persistSave:()=>{ const next=payload(); H.saves.push(structuredClone(next)); return RunStorage.write(1,next); },
  });
  // Execute the current production capacity function, with the real bag/stack ports.
  const source=readFileSync('game/src/run/game.session.js','utf8');
  const match=source.match(/function canReceiveCard\(card\)\s*\{([\s\S]*?)\n {2}\}/); expect(match).toBeTruthy();
  H.game.canReceiveCard=new Function('game','canReceiveCardFromBag','canAcceptCard',`return function(card){${match[1]}}`)(H.game,canReceiveCardFromBag,Bag.canAcceptCard);
});
afterEach(()=>{ vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });

describe('宝箱/固定奖励阿猫附赠独立待领', () => {
  it('15/16格收本体后附赠固定在原快照；满包失败不变，腾位返回后可单独领一次', async () => {
    await open(); const beforeRng=Random.snapshot();
    H.UI.el.ovBody.querySelector('[data-act="chestTake1"][data-i="0"]').click(); await pendingAction;
    const saved=disk(); expect(count(apollo.id)).toBe(1); expect(count(bonus.id)).toBe(0);
    expect(saved.chestReward.current).toMatchObject({ choiceCount:1, taken:[0], lost:[] });
    expect(saved.chestReward.current.cards.map(card=>card.id)).toEqual([apollo.id,bonus.id]);
    expect(Random.snapshot()).not.toEqual(beforeRng); const rng=Random.snapshot();
    await acts.chestTake1({i:0}); await acts.chestTake1({i:1});
    expect(count(apollo.id)).toBe(1); expect(count(bonus.id)).toBe(0); expect(Random.snapshot()).toEqual(rng);
    bagPort.showBackpack.mockImplementation(()=>{ Chests.suspend(); H.UI.el.ovBody.innerHTML='<main>背包</main>'; });
    await acts.chestOpenBag(); H.game.ownedCards.splice(0,1); Chests.resume();
    H.UI.el.ovBody.querySelector('[data-act="chestTake1"][data-i="1"]').click(); await pendingAction; await acts.chestTake1({i:1});
    expect(count(apollo.id)).toBe(1); expect(count(bonus.id)).toBe(1); expect(Random.snapshot()).toEqual(rng);
    expect(disk().chestReward.current.taken).toEqual([0,1]); expect(Bag.usedSlots()).toBe(16);
  });

  it('普通JSON/真实RunStorage重载保留已掷附赠，卡库换池不重掷且本体不重发', async () => {
    await open(); await acts.chestTake1({i:0}); const rng=Random.snapshot();
    H.cards=[apollo,eventBonus]; await reload();
    expect(Chests.serialize(H.game).current.cards.map(card=>card.id)).toEqual([apollo.id,bonus.id]);
    await acts.chestTake1({i:0}); H.game.ownedCards.splice(0,1); await acts.chestTake1({i:1});
    expect(count(apollo.id)).toBe(1); expect(count(bonus.id)).toBe(1); expect(count(eventBonus.id)).toBe(0); expect(Random.snapshot()).toEqual(rng);
    await reload(); await acts.chestTake1({i:1}); expect(count(bonus.id)).toBe(1);
  });

  it.each([2,3])('附赠同名堆有%s张：按真实3张叠放上限处理，不要求两空格', async stackSize => {
    H.game.ownedCards=[...fill(14), ...Array.from({ length:stackSize },(_,i)=>({ uid:`bonus-${i}`, card:{...bonus} }))];
    expect(Bag.usedSlots()).toBe(15); await open(); await acts.chestTake1({i:0});
    expect(Bag.usedSlots()).toBe(16); await acts.chestTake1({i:1});
    expect(count(bonus.id)).toBe(3);
    expect(Chests.serialize(H.game).current.taken).toEqual(stackSize===2?[0,1]:[0]);
    if (stackSize===3) { H.game.ownedCards.splice(0,1); await acts.chestTake1({i:1}); expect(count(bonus.id)).toBe(4); }
  });

  it('三选一只永久放弃原候选，附赠独立待领且取后快照仍通过校验', async () => {
    await open({ kind:'medium', cards:[apollo,other,{...other,id:'other2',name:'未选卡牌二'}] });
    await acts.chestPick({i:0}); let saved=disk();
    expect(saved.chestReward.current).toMatchObject({ choiceCount:3, taken:[0], lost:[1,2] });
    expect(saved.chestReward.current.cards.at(-1).id).toBe(bonus.id); expect(restoreChestReward(H.game,saved.chestReward)).toBeTruthy();
    await reload(); H.game.ownedCards.splice(0,1); await acts.chestTake1({i:3});
    saved=disk(); expect(saved.chestReward.current.taken).toEqual([0,3]); expect(saved.chestReward.current.lost).toEqual([1,2]);
    expect(restoreChestReward(H.game,saved.chestReward)).toBeTruthy(); expect(count(apollo.id)).toBe(1); expect(count(bonus.id)).toBe(1);
  });

  it('浅池旧三选一只有1候选时，附赠不被误认为第二个候选', async () => {
    await open({ kind:'medium', cards:[apollo] }); await acts.chestPick({i:0}); H.game.ownedCards.splice(0,1); Chests.resume();
    expect(Chests.serialize(H.game).current.choiceCount).toBe(1);
    expect(H.UI.el.ovBody.querySelector('[data-act="chestTake1"][data-i="1"]')).toBeTruthy();
    await acts.chestTake1({i:1}); expect(count(bonus.id)).toBe(1); expect(disk().chestReward.current.lost).toEqual([]);
  });

  it('批量收下追加附赠，第二次才处理追加卡；不重复本体或消耗随机流', async () => {
    H.game.ownedCards=[]; await open({ cards:[apollo,other] }); await acts.chestTake(); const rng=Random.snapshot();
    expect(count(apollo.id)).toBe(1); expect(count(other.id)).toBe(1); expect(count(bonus.id)).toBe(0);
    expect(Chests.serialize(H.game).current.taken).toEqual([0,1]); await acts.chestTake();
    expect(count(bonus.id)).toBe(1); expect(count(apollo.id)).toBe(1); expect(Random.snapshot()).toEqual(rng);
  });

  it('完全满包本体不发、不抽附赠；腾位后只抽一次', async () => {
    H.game.ownedCards=fill(16); await open(); const rng=Random.snapshot(); await acts.chestTake1({i:0});
    expect(count(apollo.id)).toBe(0); expect(Random.snapshot()).toEqual(rng); expect(Chests.serialize(H.game).current.cards).toHaveLength(1);
    H.game.ownedCards.pop(); await acts.chestTake1({i:0}); expect(count(apollo.id)).toBe(1); expect(Chests.serialize(H.game).current.cards).toHaveLength(2);
  });

  it('主存档setItem失败遵守检查点契约：内存本体/附赠/taken一起推进，重试完整落盘', async () => {
    await open(); const originalRaw=localStorage.getItem(RunStorage.key(1)), original=Storage.prototype.setItem;
    const failure=vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(key,value){
      if (key===RunStorage.key(1)) throw new Error('isolated quota failure'); return original.call(this,key,value);
    });
    await acts.chestTake1({i:0}); const rng=Random.snapshot();
    expect(count(apollo.id)).toBe(1); expect(Chests.serialize(H.game).current).toMatchObject({ taken:[0], choiceCount:1 });
    expect(Chests.serialize(H.game).current.cards).toHaveLength(2); expect(localStorage.getItem(RunStorage.key(1))).toBe(originalRaw);
    await acts.chestTake1({i:0}); expect(count(apollo.id)).toBe(1); expect(Random.snapshot()).toEqual(rng);
    failure.mockRestore(); expect(await H.game.persistSave()).toBe(true); await reload();
    expect(count(apollo.id)).toBe(1); expect(Chests.serialize(H.game).current.cards[1].id).toBe(bonus.id);
    H.game.ownedCards.splice(0,1); await acts.chestTake1({i:1}); expect(count(bonus.id)).toBe(1);
  });

  it('成功领取附赠但存储失败时，内存不重领，恢复存储后可完整保存', async () => {
    await open(); await acts.chestTake1({i:0}); H.game.ownedCards.splice(0,1); expect(await H.game.persistSave()).toBe(true);
    const originalRaw=localStorage.getItem(RunStorage.key(1)), original=Storage.prototype.setItem;
    const failure=vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(key,value){
      if (key===RunStorage.key(1)) throw new Error('isolated quota failure'); return original.call(this,key,value);
    });
    await acts.chestTake1({i:1}); await acts.chestTake1({i:1}); expect(count(bonus.id)).toBe(1);
    expect(localStorage.getItem(RunStorage.key(1))).toBe(originalRaw); expect(Chests.serialize(H.game).current.taken).toEqual([0,1]);
    failure.mockRestore(); expect(await H.game.persistSave()).toBe(true); await reload(); await acts.chestTake1({i:1}); expect(count(bonus.id)).toBe(1);
  });

  it('附赠事件卡只追加/领取一次，池仅有阿猫时不递归也不制造附赠', async () => {
    H.cards=[apollo,eventBonus]; H.game.ownedCards=[]; await open(); await acts.chestTake1({i:0});
    expect(Chests.serialize(H.game).current.cards.map(card=>card.id)).toEqual([apollo.id,eventBonus.id]);
    await acts.chestTake1({i:1}); expect(count(eventBonus.id)).toBe(1); expect(Chests.serialize(H.game).current.cards).toHaveLength(2);
    H.cards=[apollo]; H.game.ownedCards=[]; await open(); await acts.chestTake1({i:0});
    expect(count(apollo.id)).toBe(1); expect(Chests.serialize(H.game)).toBeNull(); expect(H.game.state).toBe('idle');
  });

  it('明确确认放弃才会丢弃附赠，不能通过继续动作隐式吞奖', async () => {
    await open(); await acts.chestTake1({i:0}); await acts.chestContinue(); expect(Chests.isOpen()).toBe(true);
    await acts.chestSkip(); expect(Chests.serialize(H.game).current.lost).toEqual([]); await acts.chestLeave();
    expect(Chests.serialize(H.game).current).toMatchObject({ taken:[0], lost:[1] });
  });

  it('不提供延后端口的旧非宝箱调用保持原可容纳时即时附赠行为', async () => {
    H.game.ownedCards=[]; expect(scenes.grantEventCard(apollo)).toBe(true);
    expect(count(apollo.id)).toBe(1); expect(count(bonus.id)).toBe(1); expect(H.UI.showCardReward).toHaveBeenCalledTimes(2);
  });
});

describe('choiceCount兼容与边界', () => {
  it.each([-1,0,1.5,2,'1',null])('候选1张且choiceCount=%j拒绝异常快照，不修改输入', async choiceCount => {
    const saved=frozenReward({ choiceCount }), before=JSON.stringify(saved);
    expect(restoreChestReward(H.game,saved)).toBeNull(); expect(JSON.stringify(saved)).toBe(before);
  });
  it('缺choiceCount旧快照原样恢复；合法边界不丢候选', async () => {
    const old=frozenReward({ kind:'medium',cards:[apollo,other] }); expect(restoreChestReward(H.game,old).current.cards).toEqual([apollo,other]);
    await open({ kind:'medium',cards:[apollo,other] }); await acts.chestPick({i:1});
    expect(Chests.serialize(H.game).current).toMatchObject({ taken:[1], lost:[0] }); expect(count(other.id)).toBe(1);
    expect(restoreChestReward(H.game,frozenReward({ choiceCount:1 }))).toBeTruthy();
  });
});
