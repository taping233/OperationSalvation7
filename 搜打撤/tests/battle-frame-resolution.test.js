// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { frameResolutionFor, resizeFrameSurface } from '../game/src/battle/view/battle.frame-resolution.js';

// Match Pixi 7.4.3 ViewSystem's rounding and screen back-calculation.
function rendererStub() {
  const renderer = { resolution: 1, width: 1920, height: 1080, screen: { width: 1920, height: 1080 } };
  renderer.resize = vi.fn((width, height) => {
    renderer.width = Math.round(width * renderer.resolution);
    renderer.height = Math.round(height * renderer.resolution);
    renderer.screen = { width: renderer.width / renderer.resolution, height: renderer.height / renderer.resolution };
  });
  return renderer;
}

describe('frame output resolution', () => {
  it('matches small-window device pixels rather than enforcing logical 1x', () => {
    const renderer = rendererStub(), scale = 595 / 1080;
    expect(resizeFrameSurface(renderer, frameResolutionFor(1, scale, 1.5), 1920, 1080)).toBe(true);
    expect([renderer.width, renderer.height]).toEqual([1058, 595]);
    expect(frameResolutionFor(2, scale, 1.5)).toBeCloseTo(1.10185185185);
  });
  it.each([1, 1.5, 2])('preserves the %s quality cap without changing small-window sampling', cap => {
    expect(frameResolutionFor(3, 2, cap)).toBe(cap);
    expect(frameResolutionFor(1, .5, cap)).toBe(.5);
  });
  it('sanitizes invalid DPR, scale and cap without restoring the 1x floor', () => {
    for (const invalid of [0, -1, NaN, Infinity, undefined]) {
      expect(frameResolutionFor(invalid, .5, 1.5)).toBe(.5);
      expect(frameResolutionFor(1, invalid, 1.5)).toBe(1);
      expect(frameResolutionFor(2, 1, invalid)).toBe(1);
    }
  });
  it('resizes on DPR or logical-container changes, but leaves equal backing untouched', () => {
    const renderer = rendererStub();
    expect(resizeFrameSurface(renderer, 1, 1920, 1080)).toBe(false);
    expect(resizeFrameSurface(renderer, .5, 1920, 1080)).toBe(true);
    expect(resizeFrameSurface(renderer, .5, 1920, 1080)).toBe(false);
    expect(resizeFrameSurface(renderer, .5, 1800, 1000)).toBe(true);
    expect([renderer.width, renderer.height]).toEqual([900, 500]);
    expect(resizeFrameSurface(renderer, 1, 1800, 1000)).toBe(true);
    expect(renderer.resize).toHaveBeenCalledTimes(3);
  });
  it('uses original logical dimensions through repeated fractional-density changes', () => {
    const renderer = rendererStub();
    for (let i = 0; i < 20; i += 1) {
      resizeFrameSurface(renderer, 595 / 1080, 1920, 1080);
      expect(renderer.screen.width).not.toBe(1920);
      expect([renderer.width, renderer.height]).toEqual([1058, 595]);
      resizeFrameSurface(renderer, 1.5, 1920, 1080);
      expect([renderer.width, renderer.height]).toEqual([2880, 1620]);
    }
    expect(renderer.resize.mock.calls.every(([w, h]) => w === 1920 && h === 1080)).toBe(true);
  });
  it('does not clear a valid surface for hidden or invalid container dimensions', () => {
    const renderer = rendererStub();
    for (const invalid of [0, -1, NaN, Infinity, undefined]) {
      expect(resizeFrameSurface(renderer, .5, invalid, 1080)).toBe(false);
      expect(resizeFrameSurface(renderer, .5, 1920, invalid)).toBe(false);
      expect(resizeFrameSurface(renderer, invalid, 1920, 1080)).toBe(false);
    }
    expect(resizeFrameSurface(renderer, Number.MIN_VALUE, 1920, 1080)).toBe(false);
    expect(renderer.resize).not.toHaveBeenCalled();
    expect(renderer.resolution).toBe(1);
  });
});
