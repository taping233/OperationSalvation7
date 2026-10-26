import { overlayElements } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimResourceReward } from '../game/src/run/node-reward-state.js';

let Chests, game, UI, actions;
const card = { id:'checkpoint-card', name:'检查点卡牌', type:'法术', rarity:'古朴' };
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  actions = {};
  UI = { el:{ ...overlayElements() },
    act:(name, fn) => actions[name] = fn, refresh() {}, log() {},
    showOverlay(_title, html) { this.el.ovBody.innerHTML = html; this.el.overlay.hidden = false; },
    hideOverlay() { this.el.overlay.hidden = true; },
  };
  game = { seed:7, layerIdx:0, trackPos:1, discoveredPairs:new Set(), state:'idle', coins:0, visited:{}, ownedCards:[],
    usedSlots:() => game.ownedCards.length, bagCap:() => 16, canReceiveCard:() => true,
    grantCard:vi.fn(value => { game.ownedCards.push({ uid:`r${game.ownedCards.length}`, card:value }); return true; }),
    gainCoins:vi.fn(amount => { game.coins += amount; }), persistSave:vi.fn(() => true),
  };
  window.SDT = { game, UI, Icons:{ rich:String }, Sound:{ sfx() {} },
    Base:{ slot:1, data:{}, bagCap:() => 16, isSha:() => false, petEggDropChance:() => 0, recordPetEggChestResult() {} },
    MAP:{ chestKinds:{ small:{ name:'小型物资箱', cards:1 } } },
    Cards:{ all:() => [card], randomDropCard:() => card, rarityOf:value => value.rarity, sellPrice:() => 1, cardHTML:value => `<span>${value.name}</span>` },
  };
  await import('../game/src/run/chests.js'); Chests = window.SDT.Chests;
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); delete window.SDT; });

async function openFixed({ coins = 0, context = { onCell:true }, options = {}, done = vi.fn() } = {}) {
  const snapshot = { version:1, seed:7, layerIdx:0, trackPos:1, queue:[{ kind:'small' }], index:1, context,
    current:{ kind:'small', cards:[card], coins, coinsReceived:false, taken:[], lost:[], source:'固定奖励', title:'领取奖励' } };
  expect(Chests.restore(game, snapshot, done, options)).toBe(true);
  await actions.chestRetrySave();
  return done;
}
function failSaves(kind) {
  game.persistSave.mockImplementation(() => { if (kind === 'throw') throw new Error('checkpoint unavailable'); return false; });
}

describe('领奖进度、失败回执与最终节点检查点', () => {
  it.each(['false', 'throw'])('单卡领取后保存%s，保留已领事实且可以原位重试保存', async kind => {
    await openFixed(); failSaves(kind);
    await expect(actions.chestTake1({ i:'0' })).resolves.toBeUndefined();
    expect(game.ownedCards).toHaveLength(1);
    expect(Chests.serialize(game).current.taken).toEqual([0]);
    expect(UI.el.ovBody.textContent).toContain('尚未保存成功');
    expect(UI.el.ovBody.querySelector('[data-act="chestRetrySave"]')).not.toBeNull();
    game.persistSave.mockReturnValue(true); await actions.chestRetrySave();
    expect(UI.el.ovBody.textContent).not.toContain('尚未保存成功');
    expect(game.grantCard).toHaveBeenCalledTimes(1);
  });

  it.each(['false', 'throw'])('最终完成保存%s时保留原页和续流，成功重试才清理待领奖', async kind => {
    const done = await openFixed({ options:{ beforeComplete:() => { game.visited['0,1'] = 1; } } });
    await actions.chestTake1({ i:'0' });
    const before = structuredClone(game.nodeChestRewards['0,1']);
    failSaves(kind);
    await expect(actions.chestContinue()).resolves.toBe(false);
    expect(done).not.toHaveBeenCalled();
    expect(game.state).toBe('modal'); expect(UI.el.overlay.hidden).toBe(false);
    expect(Chests.serialize(game).current.taken).toEqual([0]);
    expect(game.nodeChestRewards['0,1']).toMatchObject({
      context:before.context, current:{ cards:before.current.cards, taken:[0], lost:[] },
    });
    expect(UI.el.ovBody.textContent).toContain('尚未保存成功');
    let committed;
    game.persistSave.mockImplementation(() => {
      committed = { state:game.state, current:Chests.serialize(game), nodes:{ ...game.nodeChestRewards }, visited:{ ...game.visited } };
      return true;
    });
    await actions.chestContinue(); actions.chestContinue();
    expect(done).toHaveBeenCalledTimes(1); expect(game.grantCard).toHaveBeenCalledTimes(1);
    expect(committed).toEqual({ state:'idle', current:null, nodes:{}, visited:{ '0,1':1 } });
    expect(Chests.serialize(game)).toBeNull();
  });

  it('总览同样显示保存错误和重试入口，旧保存按钮不能覆盖替换页面', async () => {
    Chests.open(game, [{ kind:'small' }], vi.fn(), { onCell:true });
    failSaves('throw'); await Promise.resolve();
    await actions.chestTake1({ i:'0' });
    const retry = actions.chestRetrySave;
    expect(UI.el.ovBody.textContent).toContain('尚未保存成功');
    expect(UI.el.ovBody.querySelector('[data-act="chestRetrySave"]')).not.toBeNull();
    UI.showOverlay('', '<main>替换页面</main>'); const saves = game.persistSave.mock.calls.length;
    retry(); expect(game.persistSave).toHaveBeenCalledTimes(saves);
    expect(UI.el.ovBody.textContent).toBe('替换页面');
  });

  it('授予卡牌期间旧单领和批量动作重入不重复授予', async () => {
    await openFixed(); const take = actions.chestTake1, all = actions.chestTake;
    game.grantCard.mockImplementation(value => {
      take({ i:'0' }); all(); game.ownedCards.push({ uid:'once', card:value }); return true;
    });
    await take({ i:'0' });
    expect(game.grantCard).toHaveBeenCalledTimes(1); expect(game.ownedCards).toHaveLength(1);
  });

  it('金币入账通知期间的重入不再领取同一份金币', async () => {
    await openFixed({ coins:2 });
    const collect = actions.chestCoins;
    game.gainCoins.mockImplementation(amount => { game.coins += amount; collect(); });
    collect(); expect(game.coins).toBe(2); expect(game.gainCoins).toHaveBeenCalledTimes(1);
  });

  it('最终保存替换对局后不清理新页、不执行旧节点续流', async () => {
    const done = await openFixed(); await actions.chestTake1({ i:'0' });
    game.persistSave.mockImplementation(() => {
      game.discoveredPairs = new Set(); UI.showOverlay('', '<main>新对局页面</main>'); return true;
    });
    actions.chestContinue();
    expect(done).not.toHaveBeenCalled(); expect(UI.el.ovBody.textContent).toBe('新对局页面');
  });
});

describe('资源二选一共用领取边界', () => {
  it('授予回调同步重入时只结算一次，失败仍可另选', async () => {
    const record = { cardIds:['a','b'], taken:null };
    const nested = vi.fn();
    expect(claimResourceReward(record, 0, () => {
      expect(claimResourceReward(record, 1, nested)).toBe(false); return false;
    })).toBe(false);
    expect(record.taken).toBeNull(); expect(nested).not.toHaveBeenCalled();
    expect(claimResourceReward(record, 1, () => true)).toBe(true); expect(record.taken).toBe(1);
  });
  it('授予异常释放本次调用占用，不把临时锁写入存档', async () => {
    const record = { cardIds:['a'], taken:null };
    expect(() => claimResourceReward(record, 0, () => { throw new Error('receive failed'); })).toThrow('receive failed');
    expect(JSON.parse(JSON.stringify(record))).toEqual({ cardIds:['a'], taken:null });
    expect(claimResourceReward(record, 0, () => true)).toBe(true);
  });
});
