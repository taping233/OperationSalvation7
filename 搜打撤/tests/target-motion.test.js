import { afterEach, expect, it, vi } from 'vitest';
import { createTargetMotion } from '../game/src/ui/target-motion.js';

afterEach(() => { document.body.replaceChildren(); });
function setup() {
  const element = document.createElement('div');
  document.body.append(element);
  const animations = [];
  let quiet = false;
  const run = vi.fn((node, target, options) => {
    let finish;
    const promise = new Promise(resolve => { finish = resolve; });
    const animation = {
      node, target, options, finish,
      stop:vi.fn(() => { node.style.opacity = '.4'; }),
      then:promise.then.bind(promise),
    };
    animations.push(animation);
    return animation;
  });
  const motion = createTargetMotion({ run, reduced:() => quiet });
  return { element, run, animations, motion, reduce:() => { quiet = true; } };
}

it('turns toward a new target from the committed visible state and ignores stale completion', async () => {
  const { element, run, animations, motion } = setup();
  const first = motion.retargetVisual(element, { opacity:1 }, { from:{ opacity:0 } });
  const second = motion.retargetVisual(element, { opacity:.8 }, { from:{ opacity:0 } });
  expect(element.style.opacity).toBe('0.4');
  expect(animations[0].stop).toHaveBeenCalledOnce();
  expect(run.mock.calls[1][1]).toEqual({ opacity:'0.8' });
  expect(await first.finished).toBe(false);
  animations[0].finish();
  await Promise.resolve(); await Promise.resolve();
  expect(element.style.opacity).toBe('0.4');
  animations[1].finish();
  expect(await second.finished).toBe(true);
  expect(element.style.opacity).toBe('0.8');
});

it('does not queue identical active targets, but resumes an explicitly stopped target', async () => {
  const { element, run, motion } = setup();
  const handle = motion.retargetVisual(element, { opacity:1 });
  expect(motion.retargetVisual(element, { opacity:1 })).toBe(handle);
  expect(run).toHaveBeenCalledOnce();
  handle.stop();
  expect(await handle.finished).toBe(false);
  expect(motion.hasVisualMotion(element)).toBe(false);
  motion.retargetVisual(element, { opacity:1 });
  expect(run).toHaveBeenCalledTimes(2);
});

it('an old handle cannot stop its replacement', () => {
  const { element, animations, motion } = setup();
  const old = motion.retargetVisual(element, { opacity:1 });
  motion.retargetVisual(element, { opacity:.2 });
  old.stop();
  expect(animations[1].stop).not.toHaveBeenCalled();
  expect(motion.hasVisualMotion(element)).toBe(true);
});

it('restores only owned inline properties including their priority', () => {
  const { element, motion } = setup();
  element.style.setProperty('opacity', '.7', 'important');
  element.style.color = 'red';
  motion.retargetVisual(element, { opacity:1, x:12, scale:1.02 }, { duration:0 });
  element.style.backgroundColor = 'blue';
  motion.clearVisual(element);
  expect(element.style.opacity).toBe('0.7');
  expect(element.style.getPropertyPriority('opacity')).toBe('important');
  expect(element.style.transform).toBe('');
  expect(element.style.color).toBe('red');
  expect(element.style.backgroundColor).toBe('blue');
  motion.clearVisual(element);
});

it('uses shared time-based settings and composes transform targets together', () => {
  const { element, animations, motion } = setup();
  motion.retargetVisual(element, { x:20, y:-6, rotate:2, scale:1.02, width:100, outlineColor:'red' }, { duration:160, delay:22 });
  expect(animations[0].options).toMatchObject({ duration:.16, delay:.022 });
  expect(animations[0].target).toMatchObject({ width:'100px', outlineColor:'red' });
  expect(animations[0].target.transform).toBe('translate3d(20px,-6px,0) rotate(2deg) scale(1.02)');
});

it('applies reduced motion immediately and settles a live transition on preference change', async () => {
  const { element, run, motion, reduce } = setup();
  const old = motion.retargetVisual(element, { opacity:1 });
  reduce(); motion.flush();
  expect(await old.finished).toBe(false);
  expect(element.style.opacity).toBe('1');
  const next = motion.retargetVisual(element, { opacity:.8, y:0 });
  expect(await next.finished).toBe(true);
  expect(element.style.opacity).toBe('0.8');
  expect(run).toHaveBeenCalledOnce();
  expect(motion.hasVisualMotion(element)).toBe(false);
});

it('cleans running animation on hidden ancestors or disconnected nodes', async () => {
  const { element, motion } = setup();
  const parent = document.createElement('section');
  document.body.append(parent); parent.append(element);
  const handle = motion.retargetVisual(element, { opacity:1 });
  parent.hidden = true; motion.flush();
  expect(await handle.finished).toBe(false);
  expect(element.style.opacity).toBe('');
  parent.hidden = false;
  motion.retargetVisual(element, { opacity:1 });
  element.remove(); motion.flush();
  expect(element.style.opacity).toBe('');
  expect(motion.hasVisualMotion(element)).toBe(false);
});

it('falls back to final state if native animation is unavailable', async () => {
  const element = document.createElement('div');
  const motion = createTargetMotion({ run:() => { throw new Error('unsupported'); }, reduced:() => false });
  const result = motion.retargetVisual(element, { opacity:1, color:'red' });
  expect(await result.finished).toBe(true);
  expect(element.style.opacity).toBe('1');
  expect(motion.hasVisualMotion(element)).toBe(false);
});

it('cancels hidden native animations without trying to commit unrendered styles', async () => {
  const element = document.createElement('div');
  document.body.append(element);
  const native = { stop:vi.fn(() => { throw new DOMException('not rendered', 'InvalidStateError'); }), cancel:vi.fn(), then() {} };
  const motion = createTargetMotion({ run:() => native, reduced:() => false });
  const handle = motion.retargetVisual(element, { opacity:1 }, { from:{ opacity:0 } });
  element.hidden = true;
  expect(() => motion.flush()).not.toThrow();
  expect(native.stop).not.toHaveBeenCalled();
  expect(native.cancel).toHaveBeenCalledOnce();
  expect(await handle.finished).toBe(false);
  expect(element.style.opacity).toBe('');
});

it('contains a native render-state race and still restores owned styles', async () => {
  const element = document.createElement('div');
  document.body.append(element);
  const native = { stop:vi.fn(() => { throw new DOMException('not rendered', 'InvalidStateError'); }), cancel:vi.fn(), then() {} };
  const motion = createTargetMotion({ run:() => native, reduced:() => false });
  const handle = motion.retargetVisual(element, { opacity:1 });
  expect(() => motion.clearVisual(element)).not.toThrow();
  expect(native.cancel).toHaveBeenCalledOnce();
  expect(await handle.finished).toBe(false);
  expect(motion.hasVisualMotion(element)).toBe(false);
});

it('identifies its native animations without claiming an older component tween', () => {
  const element = document.createElement('div');
  document.body.append(element);
  const legacy = {}, owned = {};
  const natives = [legacy];
  element.getAnimations = () => [...natives];
  const motion = createTargetMotion({ run:() => {
    natives.push(owned);
    return { stop() {}, then() {} };
  }, reduced:() => false });
  motion.retargetVisual(element, { opacity:1 });
  expect(motion.ownsVisualAnimation(element, legacy)).toBe(false);
  expect(motion.ownsVisualAnimation(element, owned)).toBe(true);
  motion.clearVisual(element);
  expect(motion.ownsVisualAnimation(element, owned)).toBe(false);
});
it('keeps the injected runner easing and timing arguments unchanged', () => {
  const { element, run, motion } = setup();
  motion.retargetVisual(element, { opacity:1 }, { duration:245, delay:12, easing:'linear' });
  expect(run).toHaveBeenCalledOnce();
  expect(run.mock.calls[0][2]).toEqual({ duration:0.245, delay:0.012, ease:'linear' });
});
