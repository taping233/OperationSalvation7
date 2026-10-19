import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { linkedAnimate, trackLinkedAnimation } from '../game/src/ui/home-linked-interactions.js';

let hidden;
const animations = [];
const visibility = value => { hidden.mockReturnValue(value); document.dispatchEvent(new Event('visibilitychange')); };
function animation(playState = 'running', pending = false) {
  const target = document.createElement('div'); document.body.append(target);
  let resolve, reject;
  const value = {
    effect: { target }, playState, pending, currentTime: 75,
    finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
    pause: vi.fn(() => { value.playState = 'paused'; value.pending = true; }),
    play: vi.fn(() => { value.playState = 'running'; value.pending = true; }),
    cancel: vi.fn(() => { value.playState = 'idle'; value.pending = false; reject(new Error('cancelled')); }),
    finish: () => { value.playState = 'finished'; value.pending = false; resolve(); },
  };
  animations.push(value);
  return value;
}
beforeEach(() => { hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); visibility(false); });
afterEach(async () => {
  for (const value of animations.splice(0)) value.finish();
  await Promise.resolve(); visibility(false); document.body.replaceChildren(); vi.restoreAllMocks();
});

it.each([false, true])('preserves explicit paused animation ownership, including pending pause (%s)', pending => {
  const value = animation('paused', pending); trackLinkedAnimation(value);
  visibility(true); visibility(false);
  expect(value.pause).not.toHaveBeenCalled(); expect(value.play).not.toHaveBeenCalled();
});
it('does not claim a pending manual pause registered while already backgrounded', () => {
  visibility(true);
  const value = animation('paused', true); trackLinkedAnimation(value); visibility(false);
  expect(value.pause).not.toHaveBeenCalled(); expect(value.play).not.toHaveBeenCalled();
});
it.each([false, true])('resumes its own paused running animation once without resetting time (%s)', pending => {
  const value = animation('running', pending); trackLinkedAnimation(value);
  visibility(true); visibility(true); visibility(false); visibility(false);
  expect(value.pause).toHaveBeenCalledTimes(1); expect(value.play).toHaveBeenCalledTimes(1);
  expect(value.currentTime).toBe(75);
});
it('tracks native animation creation while hidden and preserves the caller result', () => {
  visibility(true); const value = animation();
  value.effect.target.animate = vi.fn(() => value);
  expect(linkedAnimate(value.effect.target, [{ opacity: 0 }, { opacity: 1 }], { duration: 100 })).toBe(value);
  expect(value.pause).toHaveBeenCalledOnce(); visibility(false); expect(value.play).toHaveBeenCalledOnce();
});
it('cancels a removed page animation instead of replaying it on resume', async () => {
  const value = animation(); trackLinkedAnimation(value); visibility(true);
  value.effect.target.remove(); visibility(false); await Promise.resolve();
  expect(value.cancel).toHaveBeenCalledOnce(); expect(value.play).not.toHaveBeenCalled();
  visibility(true); visibility(false); expect(value.cancel).toHaveBeenCalledOnce();
});
it('drops an already detached target when entering the background', () => {
  const value = animation(); trackLinkedAnimation(value); value.effect.target.remove();
  visibility(true); expect(value.cancel).toHaveBeenCalledOnce(); expect(value.pause).not.toHaveBeenCalled();
});
it('does not restart caller-cancelled or completed animations', async () => {
  const cancelled = animation(), completed = animation(); trackLinkedAnimation(cancelled); trackLinkedAnimation(completed);
  visibility(true); cancelled.cancel(); completed.finish(); await Promise.resolve(); visibility(false);
  expect(cancelled.play).not.toHaveBeenCalled(); expect(completed.play).not.toHaveBeenCalled();
});

it('leaves caller-paused detached animation ownership untouched', () => {
  const value = animation('paused', true); trackLinkedAnimation(value); value.effect.target.remove();
  visibility(true); visibility(false);
  expect(value.cancel).not.toHaveBeenCalled(); expect(value.play).not.toHaveBeenCalled();
});
