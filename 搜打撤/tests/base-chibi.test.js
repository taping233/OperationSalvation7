// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { baseChibiHTML, mountBaseChibi } from '../game/src/hub/base-chibi.js';

let callbacks, time, root, button, lane, dispose;
beforeEach(() => {
  time = 100; callbacks = new Map(); let serial = 0;
  vi.stubGlobal('requestAnimationFrame', fn => { callbacks.set(++serial, fn); return serial; });
  vi.stubGlobal('cancelAnimationFrame', id => callbacks.delete(id));
  vi.stubGlobal('matchMedia', () => ({ matches:false }));
  document.body.innerHTML = `<div id="overlay"><div id="hubMain">${baseChibiHTML()}</div></div>`;
  root = document.getElementById('hubMain'); lane = root.querySelector('.base-chibi-lane'); button = root.querySelector('button');
  Object.defineProperty(lane, 'clientWidth', { configurable:true, value:330 });
  Object.defineProperty(button, 'offsetWidth', { value:150 });
  Object.defineProperty(document, 'hidden', { configurable:true, value:false });
  dispose = mountBaseChibi(root);
});
afterEach(() => { dispose(); document.body.replaceChildren(); document.body.className = ''; vi.unstubAllGlobals(); });
function advance(ms) {
  for (let n = 0; n < ms; n += 32) {
    time += 32;
    const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(fn => fn(time));
  }
}
it('walks within the available lane and clamps when the lane shrinks', () => {
  advance(2500); expect(button.dataset.state).toBe('walk');
  advance(1900); expect(parseFloat(button.style.getPropertyValue('--chibi-x'))).toBeGreaterThan(0);
  Object.defineProperty(lane, 'clientWidth', { value:160 }); advance(32);
  expect(parseFloat(button.style.getPropertyValue('--chibi-x'))).toBeLessThanOrEqual(10);
  advance(6000); expect(parseFloat(button.style.getPropertyValue('--chibi-x'))).toBeGreaterThanOrEqual(0);
});
it('interrupts walking on greeting and recovers after repeated clicks', () => {
  advance(3000); button.click();
  const x = button.style.getPropertyValue('--chibi-x');
  expect(button.dataset.state).toBe('react'); advance(900); button.click(); advance(1000);
  expect(button.dataset.state).toBe('react'); expect(button.style.getPropertyValue('--chibi-x')).toBe(x);
  advance(900); expect(button.dataset.state).toBe('idle'); expect(root.querySelector('[role="status"]').textContent).toBe('');
});
it('pauses on hover and reduced motion while keeping greeting available', () => {
  button.dispatchEvent(new Event('pointerenter')); advance(8000); expect(button.dataset.state).toBe('idle');
  button.dispatchEvent(new Event('pointerleave')); document.body.classList.add('reduce-motion');
  advance(8000); expect(button.style.getPropertyValue('--chibi-x')).toBe('0px');
  button.click(); expect(button.dataset.state).toBe('react'); expect(root.querySelector('[role="status"]').textContent).not.toBe('');
});
it('releases animation and input when leaving or explicitly disposing', () => {
  root.remove(); advance(32); expect(callbacks.size).toBe(0);
  button.click(); expect(button.dataset.state).toBe('idle');
  dispose(); expect(callbacks.size).toBe(0);
});
it('pauses behind loading transitions and stops when the overlay closes', () => {
  const cover = document.createElement('div'); cover.className = 'page-loading'; document.body.append(cover);
  advance(8000); expect(button.dataset.paused).toBe('true'); expect(button.dataset.state).toBe('idle');
  cover.remove(); advance(2500); expect(button.dataset.state).toBe('walk');
  document.getElementById('overlay').hidden = true; advance(32); expect(callbacks.size).toBe(0);
});
