import { rect as uiRect } from '../../ui/ui-scale.js';
import { quietFeedback } from '../../ui/feedback-theme.js';
import { schedulePresentationMs } from '../runtime/battle.clock.js';
import { createBattleArt, emitBattleArt } from './battle.fx-art.js';
import '../../../css/battle-card-consumption-fx.css';

// Settled card events are the sole trigger. All coordinates and limits below
// belong to presentation; no card, pile, action or counter is written here.
const states = new Map();
const PILE = '.sts-hud-r button.bt-pile[data-act="btGrave"]';
const MAX_CARDS = 8, DISSOLVE_MS = 210, LEAD_MS = 140, FLOW_MS = 480;

function clearState(state) {
  for (const remove of [...state.jobs]) remove();
  state.observer.disconnect();
  if (states.get(state.host) === state) states.delete(state.host);
}
function clearAll() { for (const state of [...states.values()]) clearState(state); }
function onMode(event) { if (event.detail !== 'battle') clearAll(); }
document.addEventListener('sdt-overlay-close', clearAll);
document.addEventListener('sdt-overlay-mode', onMode);
if (import.meta.hot) import.meta.hot.dispose(() => {
  clearAll();
  document.removeEventListener('sdt-overlay-close', clearAll);
  document.removeEventListener('sdt-overlay-mode', onMode);
});

function stateFor(stage) {
  const host = stage?.closest('#overlay') || stage?.parentElement;
  for (const state of [...states.values()]) {
    if (state.host.hidden || !state.stage.isConnected || state.stage._battleToken !== state.token
      || state.host === host && state.stage !== stage) clearState(state);
  }
  if (!stage?.isConnected || !host || host.hidden) return null;
  let state = states.get(host);
  if (!state) {
    state = { host, stage, token: stage._battleToken, jobs: new Set(), seen: new WeakSet(), lastEventId: 0 };
    state.observer = new MutationObserver(() => {
      if (host.hidden || !stage.isConnected || !host.contains(stage) || stage._battleToken !== state.token) clearState(state);
    });
    state.observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    states.set(host, state);
  }
  return state;
}

function pileCenter(state) {
  const button = state.stage.querySelector(PILE);
  if (!button?.isConnected || button.closest('[hidden]')) return null;
  const r = uiRect(button), origin = uiRect(state.host);
  if (!(r.width > 0 && r.height > 0) || getComputedStyle(button).visibility === 'hidden') return null;
  return { x: r.left - origin.left + r.width / 2, y: r.top - origin.top + r.height / 2 };
}

// Finite WAAPI samples follow a quadratic curve and rotate each atlas streak
// along its tangent. The shared presentation clock pauses these animations too.
function streamFrames(from, to, lane) {
  const bend = { x: (from.x + to.x) / 2 + lane * 22,
    y: Math.min(from.y, to.y) - Math.min(150, Math.hypot(to.x - from.x, to.y - from.y) * .24) - lane * 17 };
  return Array.from({ length: 15 }, (_, i) => {
    const t = i / 14, s = 1 - t;
    const x = s * s * from.x + 2 * s * t * bend.x + t * t * to.x;
    const y = s * s * from.y + 2 * s * t * bend.y + t * t * to.y;
    const angle = Math.atan2(s * (bend.y - from.y) + t * (to.y - bend.y),
      s * (bend.x - from.x) + t * (to.x - bend.x)) * 180 / Math.PI;
    return { offset: t, opacity: i === 0 || i === 14 ? 0 : Math.min(1, i / 2),
      transform: `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${angle}deg) scale(${1 - t * .55},${1 - t * .35})` };
  });
}

function consumeOne(state, old, index, quiet) {
  const to = pileCenter(state);
  if (!to) return 0; // Never send a card to an invented/offscreen destination.
  while (state.jobs.size >= MAX_CARDS) state.jobs.values().next().value();
  const nodes = new Set(), animations = new Set(), timers = new Set();
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    for (const cancel of timers) cancel();
    for (const animation of animations) { animation.oncancel = null; animation.cancel(); }
    for (const node of nodes) { node.getAnimations?.().forEach(animation => animation.cancel()); node.remove(); }
    state.jobs.delete(remove);
  };
  state.jobs.add(remove);
  const later = (callback, ms) => timers.add(schedulePresentationMs(() => {
    if (!removed && state.stage.isConnected && !state.host.hidden && state.stage._battleToken === state.token) callback();
    else remove();
  }, ms));
  const animate = (node, frames, options) => {
    const animation = node.animate(frames, options);
    animations.add(animation); animation.oncancel = remove;
    return animation;
  };
  const clone = document.createElement('div');
  clone.className = 'bt-consumption-card';
  clone.dataset.reducedMotion = String(quiet);
  clone.setAttribute('aria-hidden', 'true'); clone.inert = true;
  clone.style.cssText = `left:${old.rect.left}px;top:${old.rect.top}px;width:${old.rect.width}px;height:${old.rect.height}px`;
  clone.innerHTML = old.html;
  // A captured card is visual only: duplicate identifiers and inputs cannot own UI.
  clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  state.host.append(clone); nodes.add(clone);
  const delay = quiet ? 0 : index * 70, dissolve = quiet ? 140 : DISSOLVE_MS;
  if (clone.animate) {
    animate(clone, quiet ? [{ opacity: .7 }, { opacity: 0 }] : [
      { opacity: 1, filter: 'brightness(1)', maskPosition: '0% 0%', transform: 'scale(1)' },
      { opacity: .8, filter: 'brightness(1.7)', maskPosition: '38% 0%', transform: 'scale(.99)', offset: .42 },
      { opacity: 0, filter: 'brightness(2) blur(3px)', maskPosition: '100% 0%', transform: 'scale(.96)' },
    ], { duration: dissolve, delay, easing: 'ease-in', fill: 'both' });
  }
  later(() => { clone.remove(); nodes.delete(clone); }, delay + dissolve);
  const from = { x: old.rect.left + old.rect.width / 2, y: old.rect.top + old.rect.height * .42 };
  const streams = quiet || !clone.animate ? 0 : 3;
  for (let lane = 0; lane < streams; lane++) {
    const node = createBattleArt('trail'); node.classList.add('bt-consumption-stream');
    state.host.append(node); nodes.add(node);
    animate(node, streamFrames({ x: from.x + (lane - 1) * 22, y: from.y + lane * 9 }, to, lane - 1),
      { duration: FLOW_MS, delay: delay + LEAD_MS + lane * 34, easing: 'cubic-bezier(.25,.1,.45,1)', fill: 'both' });
  }
  const arrival = streams ? delay + LEAD_MS + FLOW_MS + (streams - 1) * 34 : delay + dissolve;
  later(() => {
    // Re-read the current button after HUD updates; stale detached badges never pulse.
    const current = pileCenter(state);
    if (!current) return;
    const pulse = emitBattleArt(state.stage, 'pulse', { at: current, size: quiet ? 62 : 92, duration: 180 });
    if (pulse) nodes.add(pulse);
  }, arrival);
  const total = arrival + (quiet ? 280 : 180);
  later(remove, total + 80); // Frozen/cancelled timelines still release all owned nodes.
  return total;
}

export function animateCardConsumption(stage, entries = [], options = {}) {
  const state = stateFor(stage);
  if (!state || options.battleToken != null && options.battleToken !== state.token) return 0;
  const quiet = options.quiet ?? quietFeedback(), uids = new Set();
  let flightMs = 0, count = 0;
  for (const { ev, old } of entries) {
    if (!ev || !['play', 'dump', 'burn'].includes(ev.kind) || ev.battleToken != null && ev.battleToken !== state.token) continue;
    if (state.seen.has(ev)) continue;
    state.seen.add(ev);
    if (Number.isSafeInteger(ev.eventId) && ev.eventId > 0) {
      if (ev.eventId <= state.lastEventId) continue;
      state.lastEventId = ev.eventId;
    }
    if (!old?.rect || !old.html || ![old.rect.left, old.rect.top, old.rect.width, old.rect.height].every(Number.isFinite)
      || !(old.rect.width > 0 && old.rect.height > 0) || uids.has(ev.uid) || count >= (quiet ? 4 : MAX_CARDS)) continue;
    uids.add(ev.uid);
    flightMs = Math.max(flightMs, consumeOne(state, old, count++, quiet));
  }
  return flightMs;
}
