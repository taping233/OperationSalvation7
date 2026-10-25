import { motionTiming } from './motion-presets.js';
const owners = new WeakMap();
const submit = '.reward-claim, [data-act="chestTake"], [data-act="chestLeave"], [data-act="chestOverviewCoins"]';

// DOM input protection only: business commands retain their own live-source guards.
export function initRewardInteraction(root, { delay = motionTiming.fastEnter } = {}) {
  if (!root) return;
  const previous = owners.get(root);
  if (previous) return;
  const state = { until:performance.now() + delay };
  owners.set(root, state);
  root.addEventListener('click', event => {
    const button = event.target.closest?.(submit);
    // detail=0 programmatic clicks are not a carried pointer press. Keyboard is
    // guarded below, before the browser synthesises its click.
    if (button && (event.isTrusted || event.detail > 0) && performance.now() < state.until) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  root.addEventListener('keydown', event => {
    if (event.isComposing || event.target.matches?.('input,textarea,select,[contenteditable="true"]')) return;
    if (event.key === 'Enter' && event.target.closest?.(submit) && (event.repeat || performance.now() < state.until)) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    const unit = event.target.closest?.('.reward-unit');
    if (!unit) return;
    const units = [...root.querySelectorAll('.reward-unit')].filter(item => item.querySelector('.reward-card'));
    const index = units.indexOf(unit);
    if (index < 0) return;
    const next = units[(index + (event.key === 'ArrowRight' ? 1 : units.length - 1)) % units.length];
    const claim = event.target.matches?.('.reward-claim');
    (claim ? next.querySelector('.reward-claim:not(:disabled)') || next.querySelector('.reward-card') : next.querySelector('.reward-card'))?.focus({ preventScroll:true });
    next.scrollIntoView?.({ block:'nearest', inline:'nearest' });
    event.preventDefault(); event.stopPropagation();
  });
}
