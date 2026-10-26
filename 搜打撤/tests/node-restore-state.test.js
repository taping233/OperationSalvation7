// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { beginNodeRestore, claimNodeRestore, finishNodeRestore, nodeRestoreAt, validNodeRestore } from '../game/src/run/node-restore-state.js';

const card = { id:'move-a', name:'招式甲', type:'武术' };
function makeGame() {
  return { layerIdx:3, trackPos:4, hp:12, maxHp:30, nodeRewards:{}, ownedCards:[],
    usedPocket:[{ card, count:4 }], heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); } };
}
const claim = (game, record, canReceive = () => true) => claimNodeRestore(game, record, {
  name:card.name, isRestorable:c => c.type === '武术', canReceive, newUid:() => `u${game.ownedCards.length}`,
});

describe('祭坛待复原收益沿现有节点快照恢复', () => {
  it('回血只结算一次；退出/JSON读档保留剩余次数与已选择卡牌', () => {
    const game = makeGame();
    const record = beginNodeRestore(game, { source:'altar-reward', picks:3 });
    expect(game.hp).toBe(22);
    expect(claim(game, record)).toBe(true);
    const loaded = Object.assign(makeGame(), JSON.parse(JSON.stringify(game)));
    const resumed = beginNodeRestore(loaded, { source:'altar-reward', picks:3 });
    expect(resumed).toEqual(record);
    expect(loaded.hp).toBe(22);
    expect(resumed).toMatchObject({ left:2, restoredIds:[card.id], hpBefore:12, hpAfter:22, hpGain:10 });
    expect(claim(loaded, resumed)).toBe(true);
    expect(claim(loaded, resumed)).toBe(true);
    expect(nodeRestoreAt(loaded)).toBeNull();
    expect(claim(loaded, resumed)).toBe(false);
    expect(loaded.ownedCards).toHaveLength(3);
    expect(loaded.usedPocket[0].count).toBe(1);
    expect(beginNodeRestore(loaded, { source:'altar-reward', picks:3 })).toBe(resumed);
    expect(loaded.hp).toBe(22);
  });

  it('满包拒领不扣次数或消耗卡；换节点不能使用旧页回调', () => {
    const game = makeGame(), record = beginNodeRestore(game, { source:'altar-offering', picks:2 });
    const before = JSON.stringify(game);
    expect(claim(game, record, () => false)).toBe(false);
    expect(JSON.stringify(game)).toBe(before);
    game.trackPos++;
    expect(nodeRestoreAt(game)).toBeNull();
    expect(claim(game, record)).toBe(false);
    expect(finishNodeRestore(game, record)).toBe(false);
    game.trackPos--;
    expect(nodeRestoreAt(game)).toBe(record);
    expect(claim(game, record)).toBe(true);
    expect(game.hp).toBe(12);
  });

  it('道具献祭未结束不能被主奖励覆盖；结束后可接受另一项且不重开已完成收益', () => {
    const game = makeGame(), record = beginNodeRestore(game, { source:'altar-offering', picks:2 });
    expect(beginNodeRestore(game, { source:'altar-reward', picks:3 })).toBeNull();
    expect(finishNodeRestore(game, record)).toBe(true);
    expect(nodeRestoreAt(game)).toBeNull();
    const next = beginNodeRestore(game, { source:'altar-reward', picks:3 });
    expect(next).not.toBe(record);
    expect(next.source).toBe('altar-reward');
    expect(game.hp).toBe(22);
  });

  it('拒绝次数、收益记录或来源损坏；已满生命的回血记录仍可恢复', () => {
    const game = makeGame(); game.hp = game.maxHp;
    const record = beginNodeRestore(game, { source:'altar-reward', picks:3 });
    expect(validNodeRestore(record)).toBe(true);
    for (const patch of [{ left:-1 }, { left:0 }, { restoredIds:['a'] }, { hpGain:11 }, { source:'fire' }, { finished:'yes' }]) {
      expect(validNodeRestore({ ...record, ...patch })).toBe(false);
    }
    expect(beginNodeRestore(game, { source:'altar-offering', picks:3 })).toBeNull();
    const grant = vi.fn(() => true);
    expect(claim(game, { ...record }, grant)).toBe(false);
    expect(grant).not.toHaveBeenCalled();
  });
});
