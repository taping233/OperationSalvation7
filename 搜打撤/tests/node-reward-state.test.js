import { describe, expect, it, vi } from 'vitest';
import { claimEntrySupply, claimResourceReward, createEntrySupply, entrySupplyAt, nodeActionBinding, resourceRewardAt } from '../game/src/run/node-reward-state.js';
import { validateRunSave } from '../game/src/hub/run-save-validation.js';

const cards = [{ id:'a', name:'职业甲' }, { id:'b', name:'职业乙' }];
const makeGame = () => ({ layerIdx:0, trackPos:4, ownedCards:[], classCard:null });

describe('入口补给与节点收益保存事务', () => {
  it('入口坐标固定，候选保存但不自动发卡；逐张检查容量，收到的首张绑定职业卡', () => {
    const game = makeGame();
    game.entrySupply = createEntrySupply(game, cards);
    expect(game.ownedCards).toEqual([]);
    const claim = index => claimEntrySupply(game, { findCard:id => cards.find(card => card.id === id), canReceive:() => game.ownedCards.length < 1, newUid:() => 'uid', index });
    expect(claim(1)).toEqual([cards[1]]);
    expect(game.ownedCards[0].brought).toBe(1);
    expect(game.classCard).toEqual(cards[1]);
    expect(claim(0)).toEqual([]);
    const loaded = JSON.parse(JSON.stringify(game));
    expect(validateRunSave(loaded).ok).toBe(true);
    expect(claimEntrySupply(loaded, { findCard:id => cards.find(card => card.id === id), canReceive:() => true, newUid:() => 'uid', index:1 })).toEqual([]);
    game.trackPos = 3;
    expect(entrySupplyAt(game)).toBeNull();
    expect(entrySupplyAt(makeGame())).toBeNull();
  });

  it('资源候选刷新/离开重入固定，领取失败可重试；成功后二选一只能领一次', () => {
    const game = makeGame(), draw = vi.fn(() => cards);
    const reward = resourceRewardAt(game, draw);
    const loaded = JSON.parse(JSON.stringify(game));
    expect(resourceRewardAt(loaded, draw)).toEqual(reward);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(claimResourceReward(reward, 0, () => false)).toBe(false);
    expect(reward.taken).toBeNull();
    expect(claimResourceReward(reward, 1, () => true)).toBe(true);
    const receive = vi.fn(() => true);
    expect(claimResourceReward(reward, 0, receive)).toBe(false);
    expect(receive).not.toHaveBeenCalled();
    expect(validateRunSave(game).ok).toBe(true);
  });

  it('同一节点重开使旧回调失效，换档/换位置也不能领取', () => {
    const game = { ...makeGame(), state:'modal', discoveredPairs:new Set(), layerData:[] };
    const old = nodeActionBinding(game, {}, 'claim');
    expect(old()).toBe(true);
    const current = nodeActionBinding(game, {}, 'claim');
    expect(old()).toBe(false);
    expect(current()).toBe(true);
    game.discoveredPairs = new Set();
    expect(current()).toBe(false);
    const moved = nodeActionBinding(game, {}, 'claim');
    game.trackPos++;
    expect(moved()).toBe(false);
  });

  it.each([{ version:1, layerIdx:0, trackPos:4, cardIds:['a'], taken:[1] }, { version:1, layerIdx:0, trackPos:4, cardIds:['a'], taken:[0,0] }])('坏补给结构保留原档并拒绝恢复', entrySupply => {
    expect(validateRunSave({ entrySupply })).toMatchObject({ ok:false, preserveRun:true });
  });
  it('坏节点收益结构拒绝恢复；历史档缺少新增字段仍有效', () => {
    expect(validateRunSave({ nodeRewards:{ '0,4':{ version:1, type:'resource', cardIds:['a'], taken:3 } } }).ok).toBe(false);
    expect(validateRunSave({ hp:20 }).ok).toBe(true);
  });
});
