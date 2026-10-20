import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const motion = vi.hoisted(() => ({ retargetVisual: vi.fn(), clearVisual: vi.fn() }));
vi.mock('../game/src/ui/target-motion.js', () => motion);
import { showRewardCardFeedback } from '../game/src/ui/reward-card-feedback.js';
import { clearCardFeedback } from '../game/src/ui/card-result-feedback.js';
import { motionTiming, motionEasing } from '../game/src/ui/motion-presets.js';
let stage, source, target, completions;
const card = { id: 'a', name: '圣光治愈' };
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); completions = [];
  motion.retargetVisual.mockImplementation(() => ({ finished: new Promise(resolve => completions.push(resolve)), stop: vi.fn() }));
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><section class="reward-replica"><article class="reward-unit got" data-reward-card="a"><button class="reward-card"><div class="hs-card" id="source-card"><b>圣光治愈</b></div></button></article><span data-card-receive-anchor="bag">背包</span></section></div></div>';
  stage = document.querySelector('#ovBody'); source = stage.querySelector('.reward-card'); target = stage.querySelector('span');
  source.getBoundingClientRect = () => rect(20, 40, 180, 270); target.getBoundingClientRect = () => rect(400, 30, 100, 30);
  window.SDT ||= {}; window.SDT.Motion = { reduceMotion: () => false };
  delete window.SDT.UiScale;
  window.SDT.Cards = { cardHTML: c => `<b>${c.name}</b>` };
});
afterEach(() => { clearCardFeedback(); document.body.replaceChildren(); document.body.className = ''; delete window.SDT.UiScale; vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('flies the successful source identity to the bag then shows a receipt only after completion', async () => {
  showRewardCardFeedback(stage, [card]);
  const clone = document.querySelector('.reward-acquisition-card');
  expect(clone.textContent).toBe(card.name); expect(clone.querySelector('[id]')).toBeNull();
  expect(document.querySelector('.bt-card-reveal')).toBeNull();
  // Endpoint travel is separate from the face's lift and staged shrink.
  expect(motion.retargetVisual.mock.lastCall[1]).toMatchObject({ x: 340, y: -130, scale: 1, opacity: 1 });
  expect(clone.querySelector('.reward-acquisition-body > .hs-card')).not.toBeNull();
  expect(motion.retargetVisual.mock.lastCall[2]).toMatchObject({ easing: motionEasing.travel });
  expect(motion.retargetVisual.mock.lastCall[2].duration).toBeLessThanOrEqual(motionTiming.acquire);
  completions[0](true); await Promise.resolve();
  expect(document.querySelector('.reward-acquisition-card')).toBeNull();
  expect(document.querySelector('.reward-acquisition-arrival')).not.toBeNull();
  expect(motion.retargetVisual.mock.lastCall.slice(1)).toEqual([
    { opacity: 0, scale: 1.035 }, { from: { opacity: .65, scale: 1 }, duration: motionTiming.change },
  ]);
  completions[1](true); await Promise.resolve(); expect(document.querySelector('.reward-acquisition-arrival')).toBeNull();
});
it('keeps consecutive successful claims independent and clears both when leaving the mode', async () => {
  showRewardCardFeedback(stage, [card]); showRewardCardFeedback(stage, [card]);
  expect(document.querySelectorAll('.reward-acquisition-card')).toHaveLength(2);
  document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'page' }));
  expect(document.querySelector('.reward-acquisition-card')).toBeNull();
  completions[0](true); await Promise.resolve(); expect(document.querySelector('.reward-acquisition-arrival')).toBeNull();
});
it('merges consecutive arrivals into one dim receipt and transfers cleanup ownership', async () => {
  showRewardCardFeedback(stage, [card]); showRewardCardFeedback(stage, [card]);
  completions[0](true); await Promise.resolve();
  const arrival = document.querySelector('.reward-acquisition-arrival');
  completions[1](true); await Promise.resolve();
  expect(document.querySelectorAll('.reward-acquisition-arrival')).toHaveLength(1);
  expect(document.querySelector('.reward-acquisition-arrival')).toBe(arrival);
  completions[2](false); await Promise.resolve(); expect(arrival.isConnected).toBe(true);
  completions[3](true); await Promise.resolve(); expect(arrival.isConnected).toBe(false);
});
it('coalesces scroll and resize endpoint changes into one frame and keeps the original deadline', async () => {
  const frames = [], canceled = vi.fn();
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.push(callback); return frames.length; }));
  vi.stubGlobal('cancelAnimationFrame', canceled);
  const remove = vi.spyOn(window, 'removeEventListener');
  const now = vi.spyOn(performance, 'now').mockReturnValue(0);
  showRewardCardFeedback(stage, [card]);
  const body = document.querySelector('.reward-acquisition-body');
  expect(body.style.getPropertyValue('--reward-flight-duration')).toBe(`${motionTiming.acquire}ms`);
  now.mockReturnValue(100); target.getBoundingClientRect = () => rect(520, 80, 100, 30);
  target.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('scroll'));
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1); expect(motion.retargetVisual).toHaveBeenCalledTimes(1);
  frames[0]();
  expect(document.querySelector('.reward-acquisition-body')).toBe(body);
  expect(motion.retargetVisual).toHaveBeenCalledTimes(2);
  expect(motion.retargetVisual.mock.lastCall[1]).toMatchObject({ x: 460, y: -80 });
  expect(motion.retargetVisual.mock.lastCall[2].duration).toBe(motionTiming.acquire - 100);
  completions[0](false); await Promise.resolve(); expect(document.querySelector('.reward-acquisition-card')).not.toBeNull();
  window.dispatchEvent(new Event('resize')); expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  clearCardFeedback(); expect(canceled).toHaveBeenCalledWith(2);
  expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true);
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  const calls = motion.retargetVisual.mock.calls.length;
  frames[1](); window.dispatchEvent(new Event('resize')); expect(motion.retargetVisual).toHaveBeenCalledTimes(calls);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
});
it('retargets the same source clone to a refreshed bag footer and ignores the canceled old leg', async () => {
  showRewardCardFeedback(stage, [card]);
  const clone = document.querySelector('.reward-acquisition-card'), replacement = target.cloneNode(true);
  replacement.getBoundingClientRect = () => rect(500, 50, 100, 30); target.replaceWith(replacement);
  await Promise.resolve();
  expect(document.querySelector('.reward-acquisition-card')).toBe(clone);
  expect(motion.retargetVisual.mock.lastCall[0]).toBe(clone);
  expect(motion.retargetVisual.mock.lastCall[1]).toMatchObject({ x: 440, y: -110 });
  completions[0](false); await Promise.resolve(); expect(clone.isConnected).toBe(true);
  completions[1](true); await Promise.resolve();
  expect(document.querySelector('.reward-acquisition-arrival').style.left).toBe('496px');
  document.dispatchEvent(new Event('sdt-overlay-close'));
  expect(document.querySelector('.reward-acquisition-arrival')).toBeNull();
});
it('uses layout coordinates for source, flight and arrival when html zoom is not one', async () => {
  window.SDT.UiScale = { rect: element => Object.fromEntries(Object.entries(element.getBoundingClientRect()).map(([key, value]) => [key, value / .5])) };
  showRewardCardFeedback(stage, [card]);
  const clone = document.querySelector('.reward-acquisition-card');
  expect(clone.style.left).toBe('40px'); expect(clone.style.top).toBe('80px'); expect(clone.style.width).toBe('360px');
  expect(motion.retargetVisual.mock.lastCall[1]).toMatchObject({ x: 680, y: -260 });
  completions[0](true); await Promise.resolve();
  const arrival = document.querySelector('.reward-acquisition-arrival');
  expect(arrival.style.left).toBe('796px'); expect(arrival.style.top).toBe('56px'); expect(arrival.style.width).toBe('208px');
});
it('does not launch for empty grants, missing source, hidden bag or reduced motion', () => {
  showRewardCardFeedback(stage, []); expect(motion.retargetVisual).not.toHaveBeenCalled();
  source.remove(); showRewardCardFeedback(stage, [card]); expect(document.querySelector('.bt-card-reveal')).not.toBeNull(); clearCardFeedback();
  stage.querySelector('article').append(source); target.hidden = true; showRewardCardFeedback(stage, [card]);
  expect(document.querySelector('.reward-acquisition-card')).toBeNull(); clearCardFeedback();
  target.hidden = false; document.body.classList.add('reduce-motion'); showRewardCardFeedback(stage, [card]);
  expect(document.querySelector('.bt-card-reveal')).not.toBeNull(); expect(motion.retargetVisual).not.toHaveBeenCalled();
});
it('cleans source clones on scene removal or cancellation without an arrival', async () => {
  showRewardCardFeedback(stage, [card]); completions[0](false); await Promise.resolve();
  expect(document.querySelector('.reward-acquisition-card')).toBeNull(); expect(document.querySelector('.reward-acquisition-arrival')).toBeNull();
  showRewardCardFeedback(stage, [card]); stage.replaceChildren(); await Promise.resolve();
  expect(document.querySelector('.reward-acquisition-card')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});
it('keeps repeated cards in one counted flight while independent claims can finish separately', async () => {
  showRewardCardFeedback(stage, [card, card, card]);
  expect(document.querySelectorAll('.reward-acquisition-card')).toHaveLength(1);
  expect(document.querySelector('.reward-acquisition-body .reward-acquisition-count').textContent).toBe('×3');
  showRewardCardFeedback(stage, [card]);
  expect(document.querySelectorAll('.reward-acquisition-card')).toHaveLength(2);
  completions[1](true); await Promise.resolve();
  expect(document.querySelectorAll('.reward-acquisition-card')).toHaveLength(1);
  completions[0](true); await Promise.resolve();
  expect(document.querySelectorAll('.reward-acquisition-card')).toHaveLength(0);
  expect(document.querySelectorAll('.reward-acquisition-arrival')).toHaveLength(1);
});
it('clears an active flight immediately when reduced motion is enabled and ignores late completion', async () => {
  showRewardCardFeedback(stage, [card]);
  document.body.classList.add('reduce-motion'); await Promise.resolve();
  expect(document.querySelector('.reward-acquisition-card')).toBeNull();
  completions[0](true); await Promise.resolve();
  expect(document.querySelector('.reward-acquisition-arrival')).toBeNull();
});
it('clears an arrival on system reduced motion and releases its media listener', async () => {
  const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  showRewardCardFeedback(stage, [card]);
  completions[0](true); await Promise.resolve();
  expect(document.querySelector('.reward-acquisition-arrival')).not.toBeNull();
  media.matches = true; media.addEventListener.mock.calls[0][1]();
  expect(document.querySelector('.reward-acquisition-arrival')).toBeNull();
  expect(media.removeEventListener).toHaveBeenCalledWith('change', media.addEventListener.mock.calls[0][1]);
  completions[1](true); await Promise.resolve();
  expect(document.querySelector('.reward-acquisition-arrival')).toBeNull();
});
