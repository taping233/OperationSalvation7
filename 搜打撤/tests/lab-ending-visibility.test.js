import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { playLabEnding } from '../game/src/run/lab.ending.js';
import { setTurbo } from '../game/src/core/turbo.js';
let hidden;
beforeEach(() => {
  setTurbo(false); vi.useFakeTimers();
  hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  document.body.replaceChildren();
});
afterEach(() => {
  document.querySelector('.lab-end-skip')?.click();
  document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks();
});
function visibility(value) { hidden.mockReturnValue(value); document.dispatchEvent(new Event('visibilitychange')); }
it('pauses presentation text in the background and resumes once at the same character', () => {
  const done = vi.fn(); playLabEnding(done);
  vi.advanceTimersByTime(90);
  const text = document.querySelector('.lab-end-typed');
  expect(text.textContent).toHaveLength(3);
  visibility(true);
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(9000); expect(text.textContent).toHaveLength(3);
  visibility(false); visibility(false);
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(30); expect(text.textContent).toHaveLength(4);
  expect(done).not.toHaveBeenCalled();
  const skip = document.querySelector('.lab-end-skip'); skip.click(); skip.click();
  visibility(false); expect(vi.getTimerCount()).toBe(0); expect(done).toHaveBeenCalledOnce();
});
it('starts hidden without a typing timer, and completed text does not restart', () => {
  visibility(true); playLabEnding(vi.fn()); vi.advanceTimersByTime(100);
  const text = document.querySelector('.lab-end-typed'); expect(text.textContent).toBe('');
  expect(vi.getTimerCount()).toBe(0);
  visibility(false); vi.advanceTimersByTime(30); expect(text.textContent).toHaveLength(1);
  document.querySelector('.lab-end-page').click(); const full = text.textContent;
  expect(full.length).toBeGreaterThan(1);
  visibility(true); visibility(false); expect(vi.getTimerCount()).toBe(0);
  expect(text.textContent).toBe(full);
});
