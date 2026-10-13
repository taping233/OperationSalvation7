import '../../css/base-controls-v4.css';
import { linkedAnimate } from '../ui/home-linked-interactions.js';
import { motionReduced, motionTiming, motionEasing } from '../ui/motion-presets.js';
import { navigationTiming } from '../ui/navigation-motion.js';

const bound = new WeakSet();
const current = new WeakMap();
function change(target, frames, duration = motionTiming.change, delay = 0) {
  if (!target?.isConnected || motionReduced()) return;
  current.get(target)?.cancel();
  const animation = linkedAnimate(target, frames, { duration, delay, easing:motionEasing.enter, fill:'backwards' });
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
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || button.disabled) return;
    const arrow = button.querySelector('.base-command-arrow');
    if (arrow) change(arrow, [{ transform:'translateX(0)' }, { transform:'translateX(6px)', offset:.35 }, { transform:'translateX(0)' }], motionTiming.feedback);
  });
  root.addEventListener('toggle', event => {
    if (event.target.matches('.warehouse-more-filters') && event.target.open) {
      animateBaseRefresh(event.target.querySelector(':scope > div'));
    }
  }, true);
}

// 同页反馈只移动当前区域，连续刷新取消旧动画。
export function animateBaseRefresh(target, delay = 0, navigation = null) {
  change(target, [
    { transform: navigation ? `translateX(${navigation.x}px)` : 'translateY(6px)' },
    { transform:'none' },
  ], navigation?.duration ?? navigationTiming.refresh, delay);
}
