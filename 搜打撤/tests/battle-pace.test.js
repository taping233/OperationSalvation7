/* 战斗演示倍率契约（迭代评审 09-20 敌方阶段 2× 档）：
 * 单一倍率同步缩放四处演出时长；80ms 下限定时器密度；非法档位拒绝；localStorage 持久化。 */
import { beforeEach, describe, expect, it } from 'vitest';
import { demoMs, getPace, setPace } from '../game/src/battle.pace.js';

describe('battle.pace 演示倍率', () => {
  beforeEach(() => {
    localStorage.removeItem('sdt-battle-pace');
    setPace(1);
  });

  it('默认 1×：时长原样透传', () => {
    expect(getPace()).toBe(1);
    expect(demoMs(420)).toBe(420);
    expect(demoMs(320)).toBe(320);
  });

  it('2×：时长减半，敌方步进 420→210', () => {
    setPace(2);
    expect(getPace()).toBe(2);
    expect(demoMs(420)).toBe(210);
    expect(demoMs(600)).toBe(300);
    expect(demoMs(320)).toBe(160);
  });

  it('80ms 下限：防定时器过密与动画闪跳', () => {
    setPace(2);
    expect(demoMs(100)).toBe(80);
    expect(demoMs(90)).toBe(80);
  });

  it('非法档位拒绝（不破坏当前倍率）', () => {
    setPace(3);
    expect(getPace()).toBe(1);
    setPace(0);
    expect(getPace()).toBe(1);
  });

  it('倍率持久化到 localStorage，重读生效', () => {
    setPace(2);
    expect(localStorage.getItem('sdt-battle-pace')).toBe('2');
  });
});
