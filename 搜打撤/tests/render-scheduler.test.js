import { describe, expect, it } from 'vitest';
import { RenderScheduler } from '../game/src/render-scheduler.js';

describe('RenderScheduler', () => {
  it('空闲只在失效时绘制，活动状态允许 120 FPS', () => {
    const scheduler = new RenderScheduler();
    expect(scheduler.shouldDraw(0)).toBe(true);
    expect(scheduler.shouldDraw(16)).toBe(false);
    expect(scheduler.shouldDraw(340)).toBe(false);
    scheduler.invalidate();
    expect(scheduler.shouldDraw(341)).toBe(true);
    expect(scheduler.shouldDraw(40, { active: true })).toBe(true);
    expect(scheduler.shouldDraw(47, { active: true })).toBe(false);
    expect(scheduler.shouldDraw(49, { active: true })).toBe(true);
    expect(scheduler.shouldDraw(50)).toBe(true); // 活动结束补最终静态帧
    expect(scheduler.shouldDraw(1000)).toBe(false);
  });

  it('被不透明页面覆盖时不绘制', () => {
    const scheduler = new RenderScheduler();
    expect(scheduler.shouldDraw(0, { covered: true })).toBe(false);
    expect(scheduler.shouldDraw(1)).toBe(true);
  });

  it('失效时唤醒外层主循环，解除回图与输入的巡检延迟', () => {
    const scheduler = new RenderScheduler();
    let wakes = 0;
    scheduler.setWake(() => { wakes++; });
    scheduler.invalidate();
    scheduler.invalidate();
    expect(wakes).toBe(2);
    scheduler.setWake(null);
    scheduler.invalidate();
    expect(wakes).toBe(2);
  });

  it('按绝对 deadline 推进，高刷新屏上不因晚到帧持续漂移', () => {
    const scheduler = new RenderScheduler({ activeFps: 120, idleFps: 30 });
    const draws = [];
    for (let now = 0; now < 1000; now += 1000 / 165) {
      if (scheduler.shouldDraw(now, { active: true })) draws.push(now);
    }
    expect(draws.length).toBeGreaterThanOrEqual(119);
    expect(draws.length).toBeLessThanOrEqual(121);
    const gaps = draws.slice(1).map((value, i) => value - draws[i]);
    expect(Math.min(...gaps)).toBeLessThan(7);
    expect(Math.max(...gaps)).toBeLessThan(13);
  });
});
