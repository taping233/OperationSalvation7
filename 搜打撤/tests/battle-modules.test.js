import { describe, expect, it } from 'vitest';
import { refillDrawPile } from '../game/src/battle.deck.js';
import { isAreaEffect, targetSideFor, unplayableReasonFor } from '../game/src/battle.rules.js';

describe('战斗牌堆与出牌规则模块', () => {
  it('只在抽牌堆为空时回收弃牌堆', () => {
    const deck = [];
    const discard = ['a', 'b', 'c'];
    expect(refillDrawPile(deck, discard)).toBe(3);
    expect(new Set(deck)).toEqual(new Set(['a', 'b', 'c']));
    expect(discard).toEqual([]);

    const occupied = ['ready'];
    const waiting = ['later'];
    expect(refillDrawPile(occupied, waiting)).toBe(0);
    expect(occupied).toEqual(['ready']);
    expect(waiting).toEqual(['later']);
  });

  it('把群体、伤害和自疗卡分配到正确目标侧', () => {
    const damageTypes = ['武术'];
    expect(isAreaEffect({ desc: '对所有敌人造成 3 点伤害' })).toBe(true);
    expect(targetSideFor({ type: '武术', desc: '攻击 2' }, damageTypes)).toBe('enemy');
    expect(targetSideFor({ type: '法术', desc: '回复 3 点生命' }, damageTypes)).toBe('self');
    expect(targetSideFor({ type: '法术', desc: '抽 1 张牌' }, damageTypes)).toBe(null);
  });

  it('按普通战斗与 BOSS 战限制卡牌', () => {
    expect(unplayableReasonFor({ type: '资源' }, 'normal')).toContain('资源卡');
    expect(unplayableReasonFor({ type: '道具' }, 'boss')).toContain('BOSS');
    expect(unplayableReasonFor({ type: '法术', desc: '将其洗入牌库' }, 'normal')).toContain('牌库');
    expect(unplayableReasonFor({ type: '法术', desc: '抽 1 张牌' }, 'boss')).toBe(null);
  });
});
