import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { completeSurfaceMotion } from '../game/src/ui/motion-completion.js';

beforeEach(() => { vi.useFakeTimers(); document.body.className = ''; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); document.body.replaceChildren(); document.body.className = ''; });
const end = (target, name = 'exit') => {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: name });
  target.dispatchEvent(event);
};

it.each(['event', 'timeout'])('settles once when %s wins the completion race', winner => {
  const target = document.createElement('div'), child = document.createElement('span'); target.append(child);
  const finish = vi.fn();
  completeSurfaceMotion(target, finish, { duration: 100, name: 'exit' });
  end(child); end(target, 'enter'); expect(finish).not.toHaveBeenCalled();
  if (winner === 'event') end(target);
  vi.advanceTimersByTime(160); end(target);
  expect(finish).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('cancellation releases the completion event and timeout without finishing', () => {
  const target = document.createElement('div'), finish = vi.fn();
  const cancel = completeSurfaceMotion(target, finish, { duration: 100 });
  cancel(); cancel(); end(target); vi.advanceTimersByTime(160);
  expect(finish).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});

it('reads reduced motion from the surface document', () => {
  const doc = document.implementation.createHTMLDocument(); doc.body.classList.add('reduce-motion');
  const finish = vi.fn();
  completeSurfaceMotion(doc.createElement('div'), finish);
  expect(finish).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});
