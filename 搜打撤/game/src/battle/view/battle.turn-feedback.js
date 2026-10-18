import { FEEDBACK_TIMING, quietFeedback } from '../../ui/feedback-theme.js';
import { schedulePresentationMs } from '../runtime/battle.clock.js';

const states = new Map();
function clear(state) {
  state.cancel?.();
  state.node?.remove();
  for (const animation of state.animations) animation.cancel();
  state.animations.length = 0;
}
export function clearTurnFeedback() {
  for (const state of states.values()) { clear(state); state.observer.disconnect(); }
  states.clear();
}
function onMode(event) { if (event.detail !== 'battle') clearTurnFeedback(); }
document.addEventListener('sdt-overlay-close', clearTurnFeedback);
document.addEventListener('sdt-overlay-mode', onMode);
if (import.meta.hot) import.meta.hot.dispose(() => {
  clearTurnFeedback();
  document.removeEventListener('sdt-overlay-close', clearTurnFeedback);
  document.removeEventListener('sdt-overlay-mode', onMode);
});

// Consume real start events, never infer a turn from a render, restore or phase label.
export function showTurnFeedback(stage, events = []) {
  const host = stage?.closest('#overlay') || stage?.parentElement;
  if (!stage?.isConnected || !host || host.hidden) return;
  let state = states.get(host);
  if (state && state.token !== stage._battleToken) {
    clear(state); state.observer.disconnect(); states.delete(host); state = null;
  }
  if (!state) {
    state = { token: stage._battleToken, stage, lastEventId: 0, seen: new WeakSet(), animations: [], pending: [] };
    state.observer = new MutationObserver(() => {
      if (host.hidden || !state.stage.isConnected || !host.contains(state.stage)) {
        clear(state); state.observer.disconnect(); states.delete(host);
      } else if (state.pending.length && !['loading', 'waiting'].includes(state.stage.dataset.battleEntry)) {
        const pending = state.pending; state.pending = [];
        showTurnFeedback(state.stage, pending);
      }
    });
    state.observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-battle-entry'] });
    states.set(host, state);
  }
  state.stage = stage;
  if (['loading', 'waiting'].includes(stage.dataset.battleEntry)) {
    state.pending.push(...events);
    state.pending = state.pending.slice(-128);
    return;
  }
  for (const event of events) {
    if (event.battleToken !== state.token) continue;
    if (Number.isSafeInteger(event.eventId) && event.eventId > 0) {
      if (event.eventId <= state.lastEventId) continue;
      state.lastEventId = event.eventId;
    } else {
      if (state.seen.has(event)) continue;
      state.seen.add(event);
    }
    if (!['player-turn-start', 'enemy-turn-start', 'extra-turn-start'].includes(event.kind)) continue;
    clear(state);
    const enemy = event.kind === 'enemy-turn-start', extra = event.kind === 'extra-turn-start';
    const quiet = quietFeedback();
    const node = document.createElement('div');
    node.className = `bt-turnbanner bt-turn-title sdt-feedback-theme ${enemy ? 'foe' : 'self'}${extra ? ' bt-extra-turn' : ''}`;
    node.dataset.reducedMotion = String(quiet);
    node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite');
    const title = document.createElement('b'), count = document.createElement('small');
    title.textContent = enemy ? '敌方回合' : extra ? '额外回合' : '你的回合';
    if (Number.isInteger(event.turn) && event.turn > 0) count.textContent = `第 ${event.turn} 回合`;
    node.append(count, title); host.append(node); state.node = node;
    if (!extra) window.SDT?.Sound?.sfx('phase', { side: enemy ? 'foe' : 'self' });
    if (!quiet && node.animate) {
      state.animations.push(node.animate([
        { opacity: 0, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'translateY(0)', offset: .15 },
        { opacity: 1, transform: 'translateY(0)', offset: .76 },
        { opacity: 0, transform: 'translateY(-8px)' },
      ], { duration: FEEDBACK_TIMING.title, easing: FEEDBACK_TIMING.ease, fill: 'both' }));
    }
    if (!enemy && !quiet) {
      const incoming = new Set(events.filter(e => e.kind === 'draw' && (e.battleToken == null || e.battleToken === state.token)).map(e => String(e.uid)));
      const targets = [...stage.querySelectorAll('.sts-energy'), ...[...stage.querySelectorAll('.bt-card[data-uid]')].filter(card => incoming.has(card.dataset.uid))];
      for (const target of targets) if (target.animate) state.animations.push(target.animate([
        { outline: '2px solid transparent', outlineOffset: '4px' },
        { outline: '2px solid #b6cbd7', outlineOffset: '7px', offset: .3 },
        { outline: '2px solid transparent', outlineOffset: '9px' },
      ], { duration: FEEDBACK_TIMING.hold + FEEDBACK_TIMING.travel, easing: FEEDBACK_TIMING.ease }));
    }
    state.cancel = schedulePresentationMs(() => clear(state), FEEDBACK_TIMING.title);
  }
}
