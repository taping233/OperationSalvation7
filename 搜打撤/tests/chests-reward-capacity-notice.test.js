import { continueChestRewards } from './helpers/chest-actions.js';
// Real reward controller, grantEventCard, bag capacity/stacking and JSON storage.
// Backpack presentation is a port; removing wood below constructs the discard result.
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Random } from '../game/src/core/random.js';
import { canReceiveCardFromBag } from '../game/src/core/card-capacity.js';
import { RunStorage } from '../game/src/hub/game.storage.js';

const H = vi.hoisted(() => ({ game:{}, uid:0, UI:{} }));
vi.mock('../game/src/run/game.session.js', () => ({
  game:H.game, MAP:{ rules:{} }, bagCap:()=>H.game.bagCap(), usedSlots:()=>H.game.usedSlots(),
  newUid:()=>`notice-${++H.uid}`, pick:items=>items[0], scaledEnemy:item=>item,
  saveGame:()=>H.game.persistSave(),
}));
vi.mock('../game/src/run/game.session.kernel.js', () => ({ game:H.game, MAP:{ rules:{ fireHeal:10 } } }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen(){}, cardHTML:card=>`<span>${card.name}</span>` }));
const bagPort = vi.hoisted(() => ({ showBackpack:vi.fn() }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots:bagPort }));

const cards = [
  { id:'gear', name:'黑市装备', type:'装备', rarity:'稀有' },
  { id:'spell', name:'黑市招式', type:'法术', rarity:'古朴' },
  { id:'pierce', name:'致命穿刺', type:'法术', rarity:'古朴' },
];
const acts = {};
let Chests, Bag, scenes;
const fill = n => Array.from({ length:n }, (_,i)=>({ uid:`fill-${i}`, card:{ id:`fill-${i}`, name:`已有卡${i}`, type:'法术', rarity:'古朴' } }));
const visibleNotice = {"「致命穿刺」当前放不下，整理背包后可重试":"「致命穿刺」当前放不下","已入背包 1 张，2 张放不下，整理背包后可重试":"已入背包 1 张，2 张放不下","「黑市装备」已入本次远征背包":"「黑市装备」已入背包"};
const notice = () => H.UI.el.ovBody.querySelector('.reward-capacity-note, .reward-final')?.textContent || '';
const count = id => H.game.ownedCards.filter(owned=>owned.card.id===id).length;
const payload = () => ({ seed:H.game.seed, layerIdx:H.game.layerIdx, trackPos:H.game.trackPos,
  ownedCards:H.game.ownedCards, inventory:H.game.inventory, usedPocket:[], chestReward:Chests.serialize(H.game) });
function frozen({ kind='small', rewards=cards, taken=[], message='', source }={}) {
  return { version:1, screen:'cards', seed:7, layerIdx:0, trackPos:1, queue:[{ kind }], index:1, context:{ onCell:true },
    current:{ kind, cards:rewards, coins:0, coinsReceived:false, taken, lost:[], rewardStage:'cards', notice:message, source } };
}
function open(options) { expect(Chests.restore(H.game,frozen(options),()=>{})).toBe(true); }
function organizeWood() {
  acts.chestOpenBag();
  H.game.inventory.splice(H.game.inventory.findIndex(item=>item.name==='木材'),1);
  expect(H.game.persistSave()).toBe(true);
  Chests.resume();
}

beforeAll(async () => {
  Object.assign(H.UI, { el:{}, act:(name,fn)=>acts[name]=fn,
    showOverlay:(_title,html)=>{ H.UI.el.ovBody.innerHTML=html; H.UI.el.overlay.hidden=false; },
    hideOverlay:()=>H.UI.el.overlay.hidden=true, refresh(){}, log:vi.fn(), showCardReward:vi.fn(), _checkPageBg(){} });
  window.SDT ||= {}; Object.assign(window.SDT, { game:H.game, UI:H.UI, Icons:{ rich:html=>html }, Sound:{ sfx(){} }, Meta:{},
    Base:{ slot:1, bagCap:()=>18, safeCap:()=>3, isSha:()=>false, data:{} },
    MAP:{ chestKinds:{ small:{ name:'小宝箱' }, medium:{ name:'中宝箱', pickFrom:3 } } },
    Cards:{ all:()=>cards, cardHTML:card=>`<span>${card.name}</span>`, rarityOf:card=>card.rarity, sellPrice:()=>1 },
  });
  Bag=await import('../game/src/run/game.session.bag.js');
  scenes=await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js'); Chests=window.SDT.Chests;
});
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear(); RunStorage.readForLoad(1);
  document.body.innerHTML='<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  H.UI.el={ overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody'), ovTitle:document.getElementById('ovTitle') };
  H.UI.el.ovBody.addEventListener('click', event=>{ const button=event.target.closest('[data-act]'); if (button) acts[button.dataset.act]?.(button.dataset); });
  bagPort.showBackpack.mockImplementation(()=>{ Chests.suspend(); H.UI.showOverlay('背包','<main>整理背包</main>'); });
  H.uid=0; Random.reseed('reward-capacity-notice');
  Object.assign(H.game, { seed:7, layerIdx:0, trackPos:1, discoveredPairs:new Set(), ownedCards:fill(15),
    inventory:[{ name:'木材', count:1, tier:'C' }], state:'modal', coins:0,
    bagCap:Bag.bagCap, usedSlots:Bag.usedSlots, bagCapacityText:Bag.bagCapacityText,
    grantCard:vi.fn((card,opts)=>scenes.grantEventCard(card,opts)), gainCoins:vi.fn(),
    persistSave:vi.fn(()=>RunStorage.write(1,payload())),
  });
  // Use the production stack-aware capacity function with real bag ports.
  const source=readFileSync('game/src/run/game.session.js','utf8');
  const match=source.match(/function canReceiveCard\(card\)\s*\{([\s\S]*?)\n {2}\}/); expect(match).toBeTruthy();
  H.game.canReceiveCard=new Function('game','canReceiveCardFromBag','canAcceptCard',`return function(card){${match[1]}}`)(H.game,canReceiveCardFromBag,Bag.canAcceptCard);
});
afterEach(()=>{ vi.clearAllTimers(); vi.useRealTimers(); });

describe('整理背包返回时奖励容量 notice 与真实容量同步', () => {
  it.each(['普通宝箱','地下商场黑市'])('%s：18/18批量领2张，丢木材回17/18只保留领取成功事实', source => {
    if (source==='地下商场黑市') expect(scenes.openFixedRewardsOnCell(cards,source)).toBe(true);
    else open();
    acts.chestTake();
    expect(Bag.usedSlots()).toBe(18);
    expect(notice()).toBe('已入背包 2 张，1 张放不下');
    const rng=Random.snapshot(), grants=H.game.grantCard.mock.calls.length;
    const current=JSON.stringify(Chests.serialize(H.game)), saves=H.game.persistSave.mock.calls.length;
    organizeWood();
    expect(Bag.usedSlots()).toBe(17);
    expect(H.UI.el.ovBody.querySelector('.reward-capacity').textContent).toContain('17/18');
    expect(H.UI.el.ovBody.querySelector('[data-act="chestTake1"][data-i="2"]')?.textContent).toBe('收下');
    expect(H.UI.el.ovBody.querySelector('.chest-warn')).toBeNull();
    expect(notice()).toBe('已入背包 2 张');
    expect(Chests.serialize(H.game).current.taken).toEqual([0,1]);
    expect(JSON.stringify(Chests.serialize(H.game))).toBe(current);
    expect(H.game.persistSave).toHaveBeenCalledTimes(saves+1); // The constructed discard saves; resume does not.
    expect(H.game.grantCard).toHaveBeenCalledTimes(grants); expect(Random.snapshot()).toEqual(rng);
    expect(count('pierce')).toBe(0);
  });

  it('仅腾出部分容量，刷新放不下数量但不把仍待领取的卡计入已领取', () => {
    H.game.ownedCards=fill(16); open(); acts.chestTake();
    expect(notice()).toBe('已入背包 1 张，2 张放不下');
    organizeWood();
    expect(notice()).toBe('预计可收 1 张 · 1 张待整理，奖励保留。');
    expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')?.textContent).toContain('1 张待整理');
    expect(Chests.serialize(H.game).current.taken).toEqual([0]);
    expect(count('spell')).toBe(0); expect(count('pierce')).toBe(0);
  });

  it('未腾空间返回时仍保留容量失败，不因重绘清空', () => {
    open(); acts.chestTake(); const message=notice();
    acts.chestOpenBag(); Chests.resume();
    expect(notice()).toBe(visibleNotice[message] || message); expect(Bag.usedSlots()).toBe(18);
  });

  it.each(['small','medium'])('%s实际grant拒收优先于乐观容量端口，普通重绘/无变化返回不能擦除', kind => {
    open({ kind }); H.game.grantCard.mockReturnValue(false);
    expect(H.game.canReceiveCard(cards[2])).toBe(true);
    acts[kind==='medium'?'chestPick':'chestTake1']({ i:2 });
    const message='「致命穿刺」当前放不下，整理背包后可重试';
    expect(notice()).toBe(visibleNotice[message] || message);
    acts.chestCoins(); expect(notice()).toBe(visibleNotice[message] || message);
    acts.chestOpenBag(); Chests.resume(); expect(notice()).toBe(visibleNotice[message] || message);
    expect(count('pierce')).toBe(0);
  });

  it('批量真实拒收不被预测清空；实际整理后可校准，同样失败串再次发生须重新显示', () => {
    open();
    H.game.grantCard.mockImplementation((card,opts)=>card.id===cards[0].id&&scenes.grantEventCard(card,opts));
    acts.chestTake();
    const message='已入背包 1 张，2 张放不下，整理背包后可重试';
    expect(notice()).toBe(visibleNotice[message] || message); expect(Bag.usedSlots()).toBe(17);
    expect(H.game.canReceiveCard(cards[1])).toBe(true);
    acts.chestOpenBag(); Chests.resume(); expect(notice()).toBe(visibleNotice[message] || message);
    organizeWood(); expect(notice()).toBe('已入背包 1 张'); expect(Bag.usedSlots()).toBe(16);
    H.UI.el.ovBody.querySelector('[data-act="chestTake"]').click();
    expect(notice()).toBe(visibleNotice[message] || message);
    expect(Chests.serialize(H.game).current.taken).toEqual([0]);
  });

  it('restore清除旧实例拒收显示状态，旧容量串可校准但非容量错误不受影响', () => {
    open(); H.game.grantCard.mockReturnValue(false); acts.chestTake();
    expect(notice()).toContain('放不下');
    open({ message:'已入背包 0 张，3 张放不下，整理背包后可重试' });
    expect(notice()).toBe('预计可收 2 张 · 1 张待整理，奖励保留。');
    open({ message:'存档失败，请重试' }); expect(notice()).toBe('存档失败，请重试');
    expect(H.game.grantCard).toHaveBeenCalledTimes(3);
  });

  it('整理后按B关闭的第二次suspend不覆盖首次背包指纹', () => {
    open(); acts.chestTake(); expect(notice()).toContain('1 张放不下');
    acts.chestOpenBag(); H.game.inventory.pop();
    expect(Chests.suspend()).toBe(true); // Real showBackpack toggle suspends again before closing.
    Chests.resume(); expect(notice()).toBe('已入背包 2 张');
    expect(Bag.usedSlots()).toBe(17); expect(count('pierce')).toBe(0);
  });

  it('重新open及next换箱不会继承另一箱的实际拒收标记', () => {
    const SDT=window.SDT, oldBase=SDT.Base, oldCards=SDT.Cards, oldKind=SDT.MAP.chestKinds.small;
    try {
      SDT.Base={ ...oldBase, petEggDropChance:()=>0, recordPetEggChestResult(){} };
      SDT.Cards={ ...oldCards, RARITIES:['古朴','稀有','史诗','传说'], randomDropCard:()=>cards[0] };
      SDT.MAP.chestKinds.small={ name:'小宝箱', cards:1 };
      open({ rewards:[cards[0]] }); H.game.grantCard.mockReturnValue(false); acts.chestTake();
      expect(notice()).toBe('已入背包 0 张，1 张放不下');
      Chests.open(H.game,[{kind:'small'},{kind:'small'}],()=>{},{onCell:true});
      acts.chestNext(); acts.chestReveal(); expect(notice()).toBe('');
      acts.chestTake(); expect(notice()).toContain('1 张放不下');
      acts.chestSkip(); acts.chestLeave(); continueChestRewards(acts);
      acts.chestNext(); acts.chestReveal();
      expect(notice()).toBe(''); expect(H.UI.el.ovBody.querySelector('.chest-warn')).toBeNull();
    } finally { SDT.Base=oldBase; SDT.Cards=oldCards; SDT.MAP.chestKinds.small=oldKind; }
  });

  it.each(['small','medium'])('%s单卡失败：只清除现在确实可收的对应待领卡提示', kind => {
    H.game.ownedCards=fill(17); open({ kind });
    acts[kind==='medium'?'chestPick':'chestTake1']({ i:2 });
    expect(notice()).toBe('「致命穿刺」当前放不下');
    organizeWood();
    expect(notice()).toBe(kind === 'small' ? '预计可收 1 张 · 2 张待整理，奖励保留。' : ''); expect(count('pierce')).toBe(0);
    expect(H.UI.el.ovBody.querySelector(`[data-act="${kind==='medium'?'chestPick':'chestTake1'}"][data-i="2"]`)).toBeTruthy();
  });

  it('另有资源卡能收时，不能清除仍放不下的普通卡失败提示', () => {
    H.game.ownedCards=[...fill(16),{ uid:'pearl', card:{ id:'tt2-pearlbox', name:'珍珠盒', type:'装备', rarity:'史诗' } }];
    const resource={ id:'resource', name:'资源卡', type:'资源', rarity:'古朴' };
    open({ rewards:[cards[2],resource] }); acts.chestTake1({ i:0 });
    const message=notice(); expect(message).toContain('「致命穿刺」当前放不下');
    expect(H.game.canReceiveCard(resource)).toBe(true);
    acts.chestOpenBag(); Chests.resume();
    expect(notice()).toBe(visibleNotice[message] || message); expect(count('pierce')).toBe(0);
  });

  it('已满同名三张堆实际拒收时，不能因旧预检把同名当免费格而清掉失败', () => {
    H.game.ownedCards=[...fill(15),...Array.from({ length:3 },(_,i)=>({ uid:`pierce-${i}`, card:cards[2] }))];
    open({ rewards:[cards[0],cards[2]] }); H.UI.el.ovBody.querySelector('[data-act="chestTake"]').click();
    expect(H.game.canReceiveCard(cards[2])).toBe(false);
    expect(Bag.usedSlots()).toBe(18);
    expect(H.UI.el.ovBody.querySelector('[data-act="chestOpenBag"]')).toBeTruthy();
    expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')?.textContent).toContain('1 张放不下');
    expect(notice()).toBe('已入背包 1 张，1 张放不下');
    acts.chestOpenBag(); Chests.resume();
    expect(notice()).toBe('已入背包 1 张，1 张放不下');
    expect(count('pierce')).toBe(3);
  });

  it.each(['「黑市装备」已入本次远征背包','保存失败，请重试','已入背包 2 张，存档放不下，请检查存储空间'])('保留非容量状态：%s', message => {
    open({ message }); organizeWood(); expect(notice()).toBe(visibleNotice[message] || message);
    expect(Chests.serialize(H.game).current.notice).toBe(message);
  });

  it('保存旧容量串后普通JSON重载，按17/18校准，不重抽/不重发已领卡', () => {
    expect(scenes.openFixedRewardsOnCell(cards,'地下商场黑市')).toBe(true); acts.chestTake();
    organizeWood();
    const saved=RunStorage.readForLoad(1);
    expect(saved.chestReward.current.notice).toBe('已入背包 2 张，1 张放不下，整理背包后可重试');
    H.game.ownedCards=structuredClone(saved.ownedCards); H.game.inventory=structuredClone(saved.inventory);
    const rng=Random.snapshot(), grants=H.game.grantCard.mock.calls.length;
    expect(Chests.restore(H.game,JSON.parse(JSON.stringify(saved.chestReward)),()=>{})).toBe(true);
    expect(notice()).toBe('已入背包 2 张');
    acts.chestTake1({ i:0 }); acts.chestTake1({ i:1 });
    expect(H.game.grantCard).toHaveBeenCalledTimes(grants);
    acts.chestTake1({ i:2 }); acts.chestTake1({ i:2 });
    expect(count('gear')).toBe(1); expect(count('spell')).toBe(1); expect(count('pierce')).toBe(1);
    expect(RunStorage.read(1).chestReward.current.taken).toEqual([0,1,2]);
    expect(Random.snapshot()).toEqual(rng);
  });
});

describe('满包保留目标的腾位入口', () => {
  it.each(['small','medium'])('%s 返回不锁定候选；腾位后仍走一次原 grant', async kind => {
    const {openRewardCapacityOrganizer}=await import('../game/src/ui/reward-capacity-organizer.js');
    bagPort.organizeReward=vi.fn(options=>openRewardCapacityOrganizer({...options,UI:H.UI,
      readStacks:()=>[],canReceive:()=>H.game.canReceiveCard(options.card),capacity:()=>H.game.bagCapacityText(),
      moveToSafe:()=>false,discardOne:()=>false}));
    H.game.ownedCards=fill(18); H.game.inventory=[]; open({kind});
    acts.chestMakeRoom({i:1});
    const oldClaim=H.UI.el.ovBody.querySelector('[data-organize="claim"]');
    expect(oldClaim.disabled).toBe(true);
    H.UI.el.ovBody.querySelector('[data-organize="return"]').click();
    expect(H.UI.el.ovBody.querySelector('.is-pending-target').textContent).toContain('待领取');
    expect(Chests.serialize(H.game).current.selected).toBe(1);
    expect(Chests.serialize(H.game).current.taken).toEqual([]);
    expect(Chests.serialize(H.game).current.lost).toEqual([]);
    acts.chestMakeRoom({i:1});
    // A full-backpack visit preserves the target and resumes the original picker.
    H.UI.el.ovBody.querySelector('[data-organize="bag"]').click();
    H.game.ownedCards.pop(); Chests.resume();
    expect(H.UI.el.ovBody.querySelector('.is-pending-target [data-act=chestSelect]').dataset.i).toBe('1');
    acts[kind==='medium'?'chestPick':'chestTake1']({i:1});
    expect(count('spell')).toBe(1);
    expect(H.game.grantCard).toHaveBeenCalledTimes(1);
    oldClaim.click(); expect(count('spell')).toBe(1);
  });
});

it('整理页容量乐观但原grant拒收时，原候选/金币仍保留且不锁定三选一', async () => {
  const {openRewardCapacityOrganizer}=await import('../game/src/ui/reward-capacity-organizer.js');
  bagPort.organizeReward=options=>openRewardCapacityOrganizer({...options,UI:H.UI,readStacks:()=>[],canReceive:()=>true,
    capacity:()=>'',moveToSafe:()=>false,discardOne:()=>false});
  open({kind:'medium'}); H.game.grantCard.mockReturnValue(false);
  acts.chestMakeRoom({i:1});
  H.UI.el.ovBody.querySelector('[data-organize="claim"]').click();
  const saved=Chests.serialize(H.game).current;
  expect(saved.taken).toEqual([]);expect(saved.lost).toEqual([]);expect(saved.selected).toBe(1);
  expect(H.game.gainCoins).not.toHaveBeenCalled();expect(count('spell')).toBe(0);
  expect(H.UI.el.ovBody.textContent).toContain('当前放不下');
});
