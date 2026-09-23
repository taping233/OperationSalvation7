import { describe, expect, it } from 'vitest';
import {
  feedbackClass,
  feedbackDelay,
  feedbackTier,
} from '../game/src/battle/battle.feedback.js';
import { resolveReducedMotion } from '../game/src/core/motion.js';

describe('战斗反馈节奏', () => {
  it('按事件强度给出稳定的表现层级，不改变反馈文本', () => {
    expect(feedbackTier({ unit: 0, text: '-3', cls: 'dmg' })).toBe('impact');
    expect(feedbackTier({ unit: 0, text: '-12', cls: 'dmg' })).toBe('finisher');
    expect(feedbackClass({ unit: 0, text: '-12', cls: 'dmg', critical: true })).toContain('fx-finisher');
    expect(feedbackClass({ unit: 'self', text: '💚', cls: 'stk', warm: true })).toBe('heal');
  });

  it('连续多段反馈按单位错峰，特殊键名也不会污染计数器', () => {
    const counters = {};
    expect(feedbackDelay('__proto__', counters, 100)).toBe(0);
    expect(feedbackDelay('__proto__', counters, 100)).toBe(100);
    expect(feedbackDelay(null, counters, 100)).toBe(0);
    expect(feedbackDelay(null, counters, 100)).toBe(100);
  });

  it('存储读取异常时仍遵循系统减少动态效果偏好', () => {
    const throwingStorage = { getItem() { throw new Error('storage unavailable'); } };
    expect(resolveReducedMotion(throwingStorage, { matches: true })).toBe(true);
    expect(resolveReducedMotion(throwingStorage, { matches: false })).toBe(false);
    expect(resolveReducedMotion({ getItem: () => '1' }, { matches: false })).toBe(true);
  });
});
