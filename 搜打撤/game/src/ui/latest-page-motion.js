import { motionTiming, motionEasing, motionReduced } from './motion-presets.js';
import { linkedAnimate } from './home-linked-interactions.js';
import { createPageSurfaceLifetime } from './page-surface-lifetime.js';

// One departure clock, one pending destination. Additional clicks replace the
// destination without replaying the fade or extending the input deadline.
export function createLatestPageMotion({ getRoot, isCurrent = () => true }) {
  let operation = null;
  const cancel = () => {
    const previous = operation;
    operation = null;
    if (!previous) return;
    clearTimeout(previous.timer);
    previous.lifetime?.dispose();
    previous.animation?.cancel();
    delete previous.root.dataset.characterView;
    previous.commit = null;
  };
  const page = commit => {
    if (!isCurrent()) { cancel(); return false; }
    const root = getRoot();
    if (operation?.root === root && operation.lifetime?.current()) {
      operation.commit = commit;
      return true;
    }
    cancel();
    if (!root || motionReduced() || typeof root.animate !== 'function') { commit(); return true; }
    const next = { root, commit, animation:null, lifetime:null, timer:null };
    operation = next;
    next.lifetime = createPageSurfaceLifetime(root, { onInvalidate:cancel });
    const finish = () => {
      if (operation !== next) return;
      const valid = next.lifetime.current() && isCurrent();
      const destination = next.commit;
      cancel();
      if (valid) destination?.();
    };
    root.dataset.characterView = 'out';
    const start = getComputedStyle(root);
    try {
      next.animation = linkedAnimate(root, [
        { opacity:start.opacity, transform:start.transform },
        { opacity:0, transform:'translateY(-8px)' },
      ], { duration:motionTiming.exit, easing:motionEasing.exit, fill:'forwards' });
      next.animation?.finished.then(finish, () => {});
      next.timer = setTimeout(finish, motionTiming.exit + motionTiming.completionSlack);
    } catch { finish(); }
    return true;
  };
  return { page, cancel, get busy() { return !!operation; } };
}
