import { afterEach, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ calls: [], animations: [] }));
vi.mock('motion/mini', () => ({ animate: (element, keyframes, options) => {
  const animation = { effect: { target: element } };
  native.animations.push(animation);
  native.calls.push({ keyframes, options });
  return { animations: [{ animation }], stop() {}, then() {} };
} }));
import { createTargetMotion } from '../game/src/ui/target-motion.js';

afterEach(() => { document.body.replaceChildren(); native.calls.length = 0; native.animations.length = 0; });

it('starts native entrances with explicit poses without enumerating element animations', () => {
  const element = document.createElement('div');
  document.body.append(element);
  element.getAnimations = vi.fn(() => { throw Error('Forced animation enumeration'); });
  const motion = createTargetMotion({ reduced: () => false });
  motion.retargetVisual(element, { opacity: 1, y: 0 }, { from: { opacity: 0, y: 12 } });
  expect(element.getAnimations).not.toHaveBeenCalled();
  expect(native.calls).toHaveLength(1);
  expect(native.calls[0].keyframes).toEqual({
    opacity: ['0', '1'],
    transform: ['translate3d(0px,12px,0) rotate(0deg) scale(1)', 'translate3d(0px,0px,0) rotate(0deg) scale(1)'],
  });
  expect(motion.ownsVisualAnimation(element, native.animations[0])).toBe(true);
  expect(motion.ownsVisualAnimation(element, {})).toBe(false);
});

it('keeps interruption sampling for an already active native target', () => {
  const element = document.createElement('div');
  document.body.append(element);
  const motion = createTargetMotion({ reduced: () => false });
  motion.retargetVisual(element, { opacity: 1 }, { from: { opacity: 0 } });
  motion.retargetVisual(element, { opacity: .5 }, { from: { opacity: 0 } });
  expect(native.calls[1].keyframes).toEqual({ opacity: '0.5' });
});
