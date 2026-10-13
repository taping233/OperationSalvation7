import { afterEach, describe, expect, it } from 'vitest';
import { apply, BASE_H, BASE_W, rect, scale, scaleForViewport, viewport } from '../game/src/ui/ui-scale.js';

const initialWidth = window.innerWidth, initialHeight = window.innerHeight;
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: initialWidth });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: initialHeight });
  apply();
});

describe('全局 UI 缩放策略', () => {
  it.each([
    [1158, 986, 1158 / 1920],
    [1280, 720, 2 / 3],
    [1366, 768, 768 / 1080],
    [1440, 1080, 0.75],
    [606, 958, 606 / 1920],
    [1920, 600, 600 / 1080],
  ])('窗口 %sx%s 全部元素共用缩放 %s', (width, height, expected) => {
    expect(scaleForViewport(width, height)).toBeCloseTo(expected);
  });

  it('基准尺寸保持 1，避免改动 1920x1080 的既有效果', () => {
    expect(scaleForViewport(BASE_W, BASE_H)).toBe(1);
  });

  it('大于基准时等比放大，超宽窗口保留横屏画面之外的留边', () => {
    expect(scaleForViewport(2560, 1440)).toBeCloseTo(4 / 3);
    expect(scaleForViewport(3440, 1080)).toBe(1);
  });

  it('无效视口尺寸回退到 1，避免写入 NaN/Infinity', () => {
    expect(scaleForViewport(0, 720)).toBe(1);
    expect(scaleForViewport(Number.NaN, 720)).toBe(1);
  });

  it('窗口变化后更新全局zoom，不挂局部放大标记', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1158 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 986 });
    apply();
    expect(scale()).toBeCloseTo(1158 / 1920);
    expect(Number(document.documentElement.style.zoom)).toBeCloseTo(scale());
    expect(document.documentElement.dataset.gameLayout).toBe('landscape');
    expect(document.documentElement.style.getPropertyValue('--game-layout-width')).toBe('1920px');
    expect(document.documentElement.style.getPropertyValue('--game-layout-height')).toBe('1080px');
    expect(viewport().width / viewport().height).toBeCloseTo(16 / 9);
    expect(viewport().height).toBeCloseTo(651.375);
    expect(document.documentElement.hasAttribute('data-ui-scale-floor')).toBe(false);

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: BASE_W });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: BASE_H });
    window.dispatchEvent(new Event('resize'));
    expect(scale()).toBe(1);
    expect(document.documentElement.style.zoom).toBe('');
    expect(document.documentElement.hasAttribute('data-ui-scale-floor')).toBe(false);
  });

  it('缩至一半后仍将显示位置换算回布局坐标', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 960 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 540 });
    apply();
    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({ left: 50, top: 20, width: 100, height: 40,
      right: 150, bottom: 60, x: 50, y: 20, toJSON() {} });
    expect(rect(element)).toEqual({ left: 100, top: 40, width: 200, height: 80, right: 300, bottom: 120 });
  });
});
