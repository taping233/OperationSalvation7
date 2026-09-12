import { describe, expect, it } from 'vitest';
import { shouldPlaySfx } from '../game/src/sound.policy.js';

describe('音效高频事件策略', () => {
  it('限制点击、悬停和场景音效的重复触发，其他战斗音效不节流', () => {
    const last = new Map();
    expect(shouldPlaySfx('click', 100, last)).toBe(true);
    expect(shouldPlaySfx('click', 120, last)).toBe(false);
    expect(shouldPlaySfx('click', 128, last)).toBe(true);
    expect(shouldPlaySfx('hover', 200, last)).toBe(true);
    expect(shouldPlaySfx('hover', 254, last)).toBe(false);
    expect(shouldPlaySfx('hit', 255, last)).toBe(true);
  });

  it('时间倒退时不会让节流永久锁死', () => {
    const last = new Map();
    expect(shouldPlaySfx('scene', 500, last)).toBe(true);
    expect(shouldPlaySfx('scene', 0, last)).toBe(false);
    expect(shouldPlaySfx('scene', 111, last)).toBe(false);
    expect(shouldPlaySfx('scene', 611, last)).toBe(true);
  });
});
