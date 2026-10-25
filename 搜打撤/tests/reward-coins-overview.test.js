import { afterEach, expect, it, vi } from 'vitest';
import { restoreChestReward } from '../game/src/run/chest-reward-save.js';

afterEach(() => { vi.useRealTimers(); delete window.SDT; document.body.innerHTML = ''; });

async function setup() {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  const body = document.getElementById('ovBody'), overlay = document.getElementById('overlay'), actions = {};
  let pendingAction;
  body.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled) pendingAction=actions[button.dataset.act]?.(button.dataset);
  });
  const card = { id:'supply', name:'补给卡', type:'法术', rarity:'古朴', cost:0, desc:'' };
  const draw = vi.fn(() => card);
  window.SDT = {
    UI:{ el:{ overlay, ovBody:body, ovTitle:document.getElementById('ovTitle') },
      showOverlay(title, html) { body.innerHTML = html; overlay.hidden = false; },
      hideOverlay() { overlay.hidden = true; }, act(name, fn) { actions[name] = fn; }, refresh:vi.fn(), log:vi.fn() },
    MAP:{ chestKinds:{ small:{ name:'小型物资箱', cards:1, coins:[2,2] } } },
    Cards:{ RARITIES:['古朴','稀有','史诗','传说'], all:() => [card], randomDropCard:draw,
      pickOfRarity:() => card, classPool:() => [], rarityOf:c => c.rarity, sellPrice:() => 1, cardHTML:c => `<div>${c.name}</div>` },
    Base:{ data:{}, slot:1, save:vi.fn(), petEggDropChance:() => 0, recordPetEggChestResult:vi.fn(), bagCap:() => 10, isSha:() => false },
    Sound:{ sfx:vi.fn() }, Icons:{ rich:html => html },
  };
  const game = { seed:17, layerIdx:0, trackPos:1, state:'idle', ownedCards:[], myClass:'',
    usedSlots:() => 0, bagCap:() => 10, canReceiveCard:() => true,
    grantCard:vi.fn(() => true), gainCoins:vi.fn(), persistSave:vi.fn() };
  await import('../game/src/run/chests.js');
  const chests = window.SDT.Chests;
  const click = async (act, index) => {
    const button = body.querySelector(`[data-act="${act}"]${index === undefined ? '' : `[data-i="${index}"]`}`);
    expect(button, act).not.toBeNull(); button.click(); await pendingAction;
  };
  const open = async () => { if(body.querySelector('[data-act="chestReveal"]')) await click('chestReveal'); };
  const save = () => JSON.parse(JSON.stringify(chests.serialize(game)));
  return { body, game, chests, draw, click, open, save, actions };
}

function fixedSnapshot({ screen='cards', source, taken=[] } = {}) {
  const card = { id:'a', name:'原奖励', type:'法术', rarity:'古朴' };
  const current = { kind:'small', cards:[card,{ ...card, id:'b', name:'另一奖励' }], coins:3,
    coinsReceived:false, rewardStage:'cards', taken, lost:[], ...(source ? { source } : {}) };
  return { version:1, seed:17, layerIdx:0, trackPos:1, queue:[{ kind:'small', reward:current }],
    index:1, context:{ onCell:true }, current, screen };
}


it('直接开箱收币，不自动领卡；暂停读档不重抽或重复收币',async()=>{
  const h=await setup(),done=vi.fn(); h.chests.open(h.game,[{kind:'small'}],done,{onCell:true});
  expect(h.game.gainCoins).toHaveBeenCalledExactlyOnceWith(2);
  expect(h.game.grantCard).not.toHaveBeenCalled(); expect(h.body.querySelector('.cqo-overview')).toBeNull();
  const saved=h.save(); expect(saved.current).toMatchObject({rewardStage:'cards',coinsReceived:true,taken:[]});
  expect(restoreChestReward(h.game,saved)).not.toBeNull();
  h.chests.restore(h.game,saved,done);await h.open();
  expect(h.draw).toHaveBeenCalledTimes(1);expect(h.game.gainCoins).toHaveBeenCalledTimes(1);
  await h.click('chestTake1');expect(done).toHaveBeenCalledTimes(1);expect(h.game.state).toBe('idle');
});

it('连续两箱只在抵达各箱时收币；不重复领取，不返回总览',async()=>{
  const h=await setup(),done=vi.fn();h.chests.open(h.game,[{kind:'small'},{kind:'small'}],done,{onCell:true});
  expect(h.draw).toHaveBeenCalledTimes(1);expect(h.game.gainCoins.mock.calls.flat()).toEqual([2]);
  await h.open();const stale=h.actions.chestTake1;await h.click('chestTake1');stale({i:0});
  expect(h.draw).toHaveBeenCalledTimes(2);expect(h.game.grantCard).toHaveBeenCalledTimes(1);
  expect(h.game.gainCoins.mock.calls.flat()).toEqual([2,2]);expect(h.body.querySelector('.cqo-overview')).toBeNull();
  await h.open();await h.click('chestTake1');await h.click('chestContinue');
  expect(h.game.grantCard).toHaveBeenCalledTimes(2);expect(done).toHaveBeenCalledTimes(1);
});

it.each(['cards','overview'])('旧%s快照未领金币在恢复当前箱时收取一次，原卡原骰保留',async screen=>{
  const h=await setup(),done=vi.fn();expect(h.chests.restore(h.game,fixedSnapshot({screen}),done)).toBe(true);
  expect(h.game.gainCoins).toHaveBeenCalledExactlyOnceWith(3);expect(h.draw).not.toHaveBeenCalled();
  h.chests.restore(h.game,h.save(),done);expect(h.game.gainCoins).toHaveBeenCalledTimes(1);
  const stale=h.actions.chestTake1;await h.click('chestTake1',0);await stale({i:0});
  expect(h.save().current.taken).toEqual([0]);expect(h.game.grantCard).toHaveBeenCalledTimes(1);
  await h.click('chestTake1',1);await h.click('chestContinue');expect(done).toHaveBeenCalledTimes(1);
});

it.each(['chestTake','chestLeave'])('旧奖励%s后无需再领金币；原领取与放弃索引不变',async action=>{
  const h=await setup(),done=vi.fn();h.chests.restore(h.game,fixedSnapshot(),done);
  if(action==='chestLeave')await h.click('chestSkip');const stale=h.actions[action];await h.click(action);await stale();
  expect(h.game.gainCoins).toHaveBeenCalledExactlyOnceWith(3);
  expect(h.save().current[action==='chestTake'?'taken':'lost']).toEqual([0,1]);
  await h.click('chestContinue');expect(done).toHaveBeenCalledTimes(1);
});

it('已生成多箱快照沿顺序衔接；已领币跳过，未领币不遗失，不重新抽卡',async()=>{
  const h=await setup(),saved=fixedSnapshot({screen:'overview'}),done=vi.fn();
  saved.queue.push({kind:'small',reward:{...structuredClone(saved.current),coins:5,coinsReceived:true}});
  saved.queue.push({kind:'small',reward:{...structuredClone(saved.current),coins:7}});
  h.chests.restore(h.game,saved,done);expect(h.game.gainCoins.mock.calls.flat()).toEqual([3]);
  await h.click('chestTake');expect(h.game.gainCoins.mock.calls.flat()).toEqual([3]);
  await h.click('chestTake');expect(h.game.gainCoins.mock.calls.flat()).toEqual([3,7]);
  await h.click('chestTake');await h.click('chestContinue');
  expect(h.draw).not.toHaveBeenCalled();expect(done).toHaveBeenCalledTimes(1);
});

it.each(['chestTake','chestLeave','chestContinue'])('固定来源奖励沿用%s的既有收币时机，重复回调不重复发币',async action=>{
  const h=await setup(),done=vi.fn();h.chests.restore(h.game,fixedSnapshot({source:'固定奖励',taken:action==='chestContinue'?[0,1]:[]}),done);
  if(action==='chestLeave')await h.click('chestSkip');const stale=h.actions[action];await h.click(action);await stale();
  expect(h.game.gainCoins).toHaveBeenCalledExactlyOnceWith(3);
  if(action!=='chestContinue')await h.click('chestContinue');expect(done).toHaveBeenCalledTimes(1);
});
