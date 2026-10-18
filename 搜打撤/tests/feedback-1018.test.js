import { describe, expect, it, vi } from 'vitest';
import { stackCapOf, previewCardRewards } from '../game/src/core/card-capacity.js';
import { bagUseLocation, bagUseStatus, useStructuredBagRule, canReplaceBagCard } from '../game/src/hub/game.bag.rules.js';
import { groupHandCards, orderHandGroups, createStableHandSlots } from '../game/src/battle/core/battle.hand.js';

describe('10-18 留言规则回归', () => {
  it('装备逐张占格，其余牌包括初始攻击和火球每格三张', () => {
    for (const card of [{type:'装备'}, {name:'初始攻击'}, {name:'火球'}, {type:'道具'}, {type:'资源'}]) {
      expect(stackCapOf(card)).toBe(card.type === '装备' ? 1 : 3);
    }
    const card = {name:'盔甲',type:'装备'};
    expect(previewCardRewards([card], {ownedCards:[{card}],usedSlots:18,baseCap:18,totalCap:18}).blockedIndices).toEqual([0]);
    expect(previewCardRewards([card,card], {ownedCards:[],usedSlots:17,baseCap:18,totalCap:18}).acceptedIndices).toEqual([0]);
  });
  it('通行证C在地图可用，消耗一张并获得可随机获取的传说卡', () => {
    const card = {id:'tt4-shine-token',name:'员工通行证C',type:'道具',rules:{bag:{use:[{op:'discover',count:1,pool:{kind:'legendary'}}]}}};
    const got = {id:'legend',name:'传说招式',type:'法术',rarity:'传说'};
    const game = {ownedCards:[{uid:'token',card}],usedPocket:[],myClass:'侠客'};
    const saveGame = vi.fn(), showBackpack = vi.fn();
    expect(bagUseLocation(card)).toBe('map');
    expect(bagUseStatus(card,'token',{game,usedSlots:()=>1,bagCap:()=>18}).reason).toBe('');
    expect(useStructuredBagRule(card,0,{game,UI:{log:vi.fn()},SDT:{Cards:{all:()=>[got,{...got,id:'blocked',unrandom:true}],isRandomObtainable:c=>!c.unrandom}},Random:{random:()=>0},newUid:()=> 'reward',saveGame,showBackpack,usedSlots:()=>1,bagCap:()=>18})).toBe(true);
    expect(game.ownedCards).toEqual([{uid:'reward',card:got}]);
    expect(saveGame).toHaveBeenCalledOnce();
    expect(showBackpack).toHaveBeenCalledWith(true);
  });
  it('传说池为空时保留通行证', () => {
    const card = {name:'通行证C',rules:{bag:{use:[{op:'discover',pool:{kind:'legendary'}}]}}};
    const game = {ownedCards:[{uid:'token',card}]}, saveGame=vi.fn();
    useStructuredBagRule(card,0,{game,UI:{log:vi.fn()},SDT:{Cards:{all:()=>[]}},Random:{},newUid:vi.fn(),saveGame,showBackpack:vi.fn(),usedSlots:()=>1,bagCap:()=>18});
    expect(game.ownedCards).toHaveLength(1); expect(saveGame).not.toHaveBeenCalled();
  });
  it('新招式仍排装备之前，同类槽位在出牌后保持', () => {
    const equip={uid:'e',card:{id:'equip',type:'装备'}}, move={uid:'m',card:{id:'move',type:'法术'}};
    const slots=createStableHandSlots();
    const arrange=entries=>slots(orderHandGroups(groupHandCards(entries)),'battle',1);
    expect(arrange([equip,move]).groups.map(g=>g.card.id)).toEqual(['move','equip']);
    const next=arrange([equip,move,{uid:'n',card:{id:'new',type:'武术'}}]);
    expect(next.groups.map(g=>g.card.id)).toEqual(['move','new','equip']);
    expect(arrange([equip,{uid:'n',card:{id:'new',type:'武术'}}]).groups.find(g=>g.card.id==='new').displaySlot).toBe(1);
  });
});

it('满包使用同叠通行证不会凭空多放一张装备，独立一张通行证可腾位', () => {
  const token={name:'通行证C',type:'道具'}, equip={name:'装备',type:'装备'};
  const game={ownedCards:[{uid:'a',card:token},{uid:'b',card:token}]};
  const ports={usedSlots:()=>18,bagCap:()=>18};
  expect(canReplaceBagCard(game,0,equip,ports)).toBe(false);
  game.ownedCards.pop();expect(canReplaceBagCard(game,0,equip,ports)).toBe(true);
});
