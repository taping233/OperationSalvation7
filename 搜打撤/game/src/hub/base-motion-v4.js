import '../../css/base-controls-v4.css';
import { linkedAnimate } from '../ui/home-linked-interactions.js';
import { motionReduced } from '../ui/motion-presets.js';
import { baseNavigationTiming, baseNavigationEasing } from '../ui/navigation-motion.js';

const bound = new WeakSet();
const current = new WeakMap();
const directions = new WeakMap();
/** @param {Element} target @param {Keyframe[]} frames @param {number} [duration] @param {number} [delay] */
function change(target, frames, duration = baseNavigationTiming.refresh, delay = 0) {
  if (!target?.isConnected || motionReduced()) return;
  current.get(target)?.cancel();
  const animation = linkedAnimate(target, frames, { duration, delay, easing:baseNavigationEasing, fill:'backwards' });
  if (animation) {
    current.set(target, animation);
    const release = () => { if (current.get(target) === animation) current.delete(target); };
    animation.finished.then(release, release);
  }
}

// 页级展开沿公共 surface-motion；这里仅反馈仍留在当前页的翻页、筛选和操作。
export function bindBaseMotion(root) {
  if (!root || bound.has(root)) return;
  bound.add(root);
  root.addEventListener('click', event => {
    const button = event.target.closest('button[aria-pressed]');
    if (!button || button.disabled || !root.contains(button)) return;
    const group = button.closest('nav') || button.parentElement;
    const controls = [...group.querySelectorAll('button[aria-pressed]')];
    const from = controls.findIndex(control => control.getAttribute('aria-pressed') === 'true');
    const to = controls.indexOf(button);
    if (from === to || to < 0) return;
    const intent = { direction: from < 0 ? 1 : Math.sign(to - from) };
    directions.set(root, intent);
    queueMicrotask(() => { if (directions.get(root) === intent) directions.delete(root); });
  }, true);
}

// 同页内容单向滑入；连续操作取消旧动画，不再上下抖动。
export function animateBaseRefresh(target, delay = 0, navigation = null) {
  const direction = directions.get(target?.closest?.('#hubMain'))?.direction || 1;
  const x = navigation?.x ?? (navigation?.y != null ? 0 : direction * 48);
  const y = navigation?.y ?? 0;
  change(target, [
    { transform: `translate(${x}px,${y}px)` },
    { transform:'none' },
  ], navigation?.duration ?? baseNavigationTiming.refresh, delay);
}

export function animateBaseSwitch(target, direction = 1, delay = 0) {
  animateBaseRefresh(target, delay, { x: (Math.sign(direction) || 1) * 64, duration: baseNavigationTiming.detail });
}
