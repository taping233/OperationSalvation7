import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const motion = vi.hoisted(() => ({ retargetVisual: vi.fn(() => ({ finished: new Promise(() => {}), stop: vi.fn() })), clearVisual: vi.fn() }));
vi.mock('../game/src/ui/target-motion.js', () => motion);
import { installCardStateMotion } from '../game/src/ui/card-state-motion.js';
let dispose, reward, bag;
beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div class="reward-replica"><article class="reward-unit"><button class="reward-card"><b>奖励</b></button></article></div><div class="bag-tile card-face" data-stack="牌" style="--tint:#57a8f01c" tabindex="0"></div>';
  reward = document.querySelector('.reward-card'); bag = document.querySelector('.bag-tile');
  dispose = installCardStateMotion();
});
afterEach(() => { dispose(); document.body.replaceChildren(); document.body.className = ''; vi.unstubAllGlobals(); });
const pointer = (node, type, relatedTarget = null) => node.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget }));
it('retargets quick pointer reversal and keeps keyboard focus active with fixed geometry after pointer leaves', () => {
  pointer(reward, 'pointerover'); pointer(reward, 'pointerout'); pointer(reward, 'pointerover');
  expect(motion.retargetVisual.mock.calls.map(call => call[1].y)).toEqual([0, 0, 0]);
  expect(motion.retargetVisual.mock.calls.map(call => call[2].duration)).toEqual([160, 120, 160]);
  reward.focus(); pointer(reward, 'pointerout');
  expect(motion.retargetVisual.mock.lastCall[1].y).toBe(0);
  bag.focus(); expect(motion.retargetVisual.mock.lastCall[0]).toBe(bag);
});
it('releases a card as soon as dragging starts and never targets battle hand cards', async () => {
  pointer(bag, 'pointerover'); bag.classList.add('dragging'); await Promise.resolve();
  expect(motion.clearVisual).toHaveBeenCalledWith(bag);
  expect(bag.dataset.cardStateMotion).toBeUndefined();
  document.body.insertAdjacentHTML('beforeend', '<div class="sts-hand"><button class="bt-card">手牌</button></div>');
  motion.retargetVisual.mockClear(); pointer(document.querySelector('.bt-card'), 'pointerover');
  expect(motion.retargetVisual).not.toHaveBeenCalled();
});
it('releases claimed rewards and never raises claimed or dropped cards for reading', async () => {
  pointer(reward, 'pointerover'); reward.closest('article').classList.add('got'); await Promise.resolve();
  expect(motion.clearVisual).toHaveBeenCalledWith(reward);
  expect(reward.dataset.cardStateMotion).toBeUndefined();
  motion.retargetVisual.mockClear(); reward.focus(); pointer(reward, 'pointerover');
  expect(motion.retargetVisual).not.toHaveBeenCalled();
  reward.closest('article').classList.replace('got', 'dropped');
  pointer(reward, 'pointerout'); pointer(reward, 'pointerover');
  expect(motion.retargetVisual).not.toHaveBeenCalled();
});
it('keeps the selected reward stable after blur and clears removed cards and uninstall', async () => {
  reward.focus(); reward.closest('article').classList.add('is-pending-target'); bag.focus(); await Promise.resolve();
  const rewardCalls = motion.retargetVisual.mock.calls.filter(call => call[0] === reward);
  expect(rewardCalls.at(-1)[1].y).toBe(0);
  reward.remove(); await Promise.resolve(); expect(motion.clearVisual).toHaveBeenCalledWith(reward);
  dispose(); expect(bag.dataset.cardStateMotion).toBeUndefined();
  motion.retargetVisual.mockClear(); pointer(bag, 'pointerover'); expect(motion.retargetVisual).not.toHaveBeenCalled();
});
it('keeps neutral geometry and no outline for reduced motion', () => {
  document.body.classList.add('reduce-motion'); pointer(bag, 'pointerover');
  expect(motion.retargetVisual.mock.lastCall[1]).toMatchObject({ y: 0, scale: 1, rotate: 0 });
  expect(motion.retargetVisual.mock.lastCall[2]).toEqual({ duration: 0 });
});
it('installs once per root and can install again after disposal', () => {
  expect(installCardStateMotion()).toBe(dispose);
  pointer(bag, 'pointerover'); expect(motion.retargetVisual).toHaveBeenCalledTimes(1);
  dispose(); const next = installCardStateMotion(); expect(next).not.toBe(dispose); dispose = next;
});
it('returns a raised card to neutral geometry when the system enables reduced motion', () => {
  dispose(); let changed;
  const media = { matches: false, addEventListener: vi.fn((_type, handler) => { changed = handler; }), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => media)); dispose = installCardStateMotion();
  pointer(bag, 'pointerover'); media.matches = true; changed();
  expect(motion.retargetVisual.mock.lastCall[1]).toMatchObject({ y: 0, scale: 1, rotate: 0 });
  expect(motion.retargetVisual.mock.lastCall[2]).toEqual({ duration: 0 });
  dispose(); expect(media.removeEventListener).toHaveBeenCalledWith('change', changed);
});
it('preserves face material without creating an outline on hover or reversal', () => {
  bag.innerHTML = '<div class="hs-card" style="--paper-wash:#c79824"></div>';
  pointer(bag, 'pointerover');
  expect(motion.retargetVisual.mock.lastCall[1]).toEqual({y:0,scale:1,rotate:0});
  expect(bag.querySelector('.hs-card').style.getPropertyValue('--paper-wash')).toBe('#c79824');
  pointer(bag, 'pointerout');
  expect(motion.retargetVisual.mock.lastCall[1]).toEqual({y:0,scale:1,rotate:0});
});
