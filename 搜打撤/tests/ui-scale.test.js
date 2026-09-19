import { describe, expect, it } from 'vitest';
import { apply, BASE_H, BASE_W, MIN_ZOOM, scale, scaleForViewport } from '../game/src/ui-scale.js';

describe('全局 UI 缩放策略', () => {
  it.each([
    [1158, 986],
    [1280, 720],
    [1366, 768],
  ])('小窗 %sx%s 不低于可读性下限', (width, height) => {
    expect(scaleForViewport(width, height)).toBe(MIN_ZOOM);
  });

  it('基准尺寸保持 1，避免改动 1920x1080 的既有效果', () => {
    expect(scaleForViewport(BASE_W, BASE_H)).toBe(1);
  });

  it('大于基准时仍按原策略放大，额外宽高由布局展开', () => {
    expect(scaleForViewport(2560, 1440)).toBeCloseTo(4 / 3);
    expect(scaleForViewport(3440, 1080)).toBe(1);
  });

  it('无效视口尺寸回退到 1，避免写入 NaN/Infinity', () => {
    expect(scaleForViewport(0, 720)).toBe(1);
    expect(scaleForViewport(Number.NaN, 720)).toBe(1);
  });

  it('只在触发缩放下限时挂小窗可读性护栏', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1158 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 986 });
    apply();
    expect(scale()).toBe(MIN_ZOOM);
    expect(document.documentElement.hasAttribute('data-ui-scale-floor')).toBe(true);

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: BASE_W });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: BASE_H });
    apply();
    expect(scale()).toBe(1);
    expect(document.documentElement.hasAttribute('data-ui-scale-floor')).toBe(false);
  });
});
