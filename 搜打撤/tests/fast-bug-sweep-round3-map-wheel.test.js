import { afterEach, expect, it, vi } from 'vitest';
import { createGameBootInput } from '../game/src/core/game-boot-input.js';

afterEach(() => document.body.replaceChildren());
function setup() {
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  const zoomAt = vi.fn(), invalidate = vi.fn();
  canvas.getBoundingClientRect = () => ({ left:10, top:20, right:810, bottom:620, width:800, height:600, x:10, y:20, toJSON() {} });
  createGameBootInput({ readState:() => ({ canvas, cam:{zoomAt}, game:{} }), window:new EventTarget(), document,
    UI:{}, renderScheduler:{invalidate} }).bindInput();
  return { canvas, zoomAt, invalidate };
}

it('a horizontal-only trackpad wheel does not unexpectedly zoom the map out', () => {
  const h = setup();
  h.canvas.dispatchEvent(new WheelEvent('wheel', { deltaX:120, deltaY:0, clientX:210, clientY:120, cancelable:true }));
  expect(h.zoomAt).not.toHaveBeenCalled();
  expect(h.invalidate).not.toHaveBeenCalled();
});

it.each([[120, 1 / 1.12], [-120, 1.12]])('vertical wheel delta %s retains anchored zoom', (deltaY, factor) => {
  const h = setup();
  const event = new WheelEvent('wheel', { deltaX:0, deltaY, clientX:210, clientY:120, cancelable:true });
  h.canvas.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(h.zoomAt).toHaveBeenCalledExactlyOnceWith(200, 100, factor);
  expect(h.invalidate).toHaveBeenCalledOnce();
});
