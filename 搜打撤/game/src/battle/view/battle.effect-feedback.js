/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
import { isHandArrivalEvent } from '../core/battle.card-presentation.js';
import { createBattleArt, emitBattleArt, clearBattleArt } from './battle.fx-art.js';
import { schedulePresentationMs } from '../runtime/battle.clock.js';

// These notices observe settled events. They never join the action/flight clock.
const states = new WeakMap(), liveStates = new Set();
const reducedMotion = () => !!window.SDT?.Motion?.reduceMotion?.();

function clearState(state) {
  clearBattleArt();
  for (const remove of [...state.notices.values()]) remove();
  const button = state.pageBadge?.parentElement;
  if (button) button.setAttribute('aria-label', (button.getAttribute('aria-label') || '').replace(/，其他栏新增 \d+ 张手牌$/, ''));
  state.pageBadge?.remove();
  state.pending.clear();
  state.observer?.disconnect();
  states.delete(state.host);
  liveStates.delete(state);
}

function stateFor(stage, token = stage?._battleToken) {
  const host = stage?.closest('#overlay') || stage?.parentElement;
  if (!stage?.isConnected || !host || host.hidden) return null;
  let state = states.get(host);
  if (state && state.token !== token) { clearState(state); state = null; }
  if (!state) {
    state = { host, stage, token, notices: new Map(), pending: new Set(), seen: new WeakSet(), lastEventId: 0, pageBadge: null };
    state.observer = new MutationObserver(() => {
      if (host.hidden || !state.stage.isConnected || !host.contains(state.stage)) clearState(state);
    });
    state.observer.observe(host, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
    states.set(host, state); liveStates.add(state);
  }
  state.stage = stage;
  for (const [node, remove] of state.notices) if (!node.isConnected) remove();
  return state;
}

function clearAll() { for (const state of [...liveStates]) clearState(state); }
function onMode(event) { if (event.detail !== 'battle') clearAll(); }
document.addEventListener('sdt-overlay-close', clearAll);
document.addEventListener('sdt-overlay-mode', onMode);
if (import.meta.hot) import.meta.hot.dispose(() => {
  clearAll();
  document.removeEventListener('sdt-overlay-close', clearAll);
  document.removeEventListener('sdt-overlay-mode', onMode);
});

// Read-only boundary for the persistent page component; matching classes alone
// never authorize an external node to bypass structural repair.
export function ownsHandPageFeedback(button, node) {
  if (!node || node.parentElement !== button || button.tagName !== 'DIV' || !button.matches('.bt-hand-page[role="group"]')
      || !button.parentElement?.matches('.sts-resource-dock')) return false;
  const stage = button.closest('.battle-stage');
  const host = stage?.closest('#overlay') || stage?.parentElement, state = states.get(host);
  return !!state && stage.isConnected && !host.hidden && state.stage === stage
    && state.token === stage._battleToken && state.pageBadge === node;
}

export function retainBattleFeedback(stage, node, ms) {
  const state = stateFor(stage);
  if (!state) { node.remove(); return; }
  while (state.notices.size >= 12) state.notices.values().next().value();
  let cancel;
  const remove = () => {
    cancel?.();
    node.getAnimations?.().forEach(animation => animation.cancel());
    node.remove(); state.notices.delete(node);
  };
  state.notices.set(node, remove);
  cancel = schedulePresentationMs(remove, ms);
}

function dismissMatching(state, selector) {
  for (const [node, remove] of state.notices) if (node.matches(selector)) remove();
}

export function updateHandAcquisitionFeedback(stage, snapshot, records, previousUids, events = []) {
  const state = stateFor(stage, snapshot.battleToken);
  if (!state) return;
  // Pending off-page arrivals still reconcile on eventless page/hand changes.
  if (state.pending.size || events.some(isHandArrivalEvent)) {
    const held = new Set(snapshot.hand);
    const visible = new Set(records.flatMap(record => record.group.uids));
    const incoming = new Set(events.filter(event => isHandArrivalEvent(event) && held.has(event.uid)
      && (event.battleToken == null || event.battleToken === snapshot.battleToken)).map(event => event.uid));
    for (const uid of incoming) if (!visible.has(uid)) state.pending.add(uid);
    for (const uid of state.pending) if (!held.has(uid) || visible.has(uid)) state.pending.delete(uid);

    if (incoming.size) for (const record of records) {
      const before = previousUids.get(record.slot);
      const count = record.group.uids.filter(uid => incoming.has(uid) && !before?.has(uid)).length;
      if (!count) continue;
      const old = /** @type {BattleElement} */ (record.slot.querySelector('.bt-hand-acquired'));
      if (old) state.notices.get(old)?.();
      const label = createBattleArt('draw');
      label.classList.add('bt-hand-acquired');
      label.dataset.reducedMotion = String(reducedMotion());
      label.setAttribute('aria-label', `入手 ${count} 张`);
      label.setAttribute('role', 'status');
      record.slot.appendChild(label);
      retainBattleFeedback(stage, label, 1100);
    }
  }

  const button = /** @type {BattleElement} */ (stage.querySelector('.bt-hand-page'));
  if (state.pageBadge?.parentElement !== button) { state.pageBadge?.remove(); state.pageBadge = null; }
  if (!button) return;
  const baseLabel = (button.getAttribute('aria-label') || '').replace(/，其他栏新增 \d+ 张手牌$/, '');
  if (!state.pending.size) {
    state.pageBadge?.remove(); state.pageBadge = null;
    if (baseLabel) button.setAttribute('aria-label', baseLabel);
    return;
  }
  if (!state.pageBadge) {
    state.pageBadge = createBattleArt('draw');
    state.pageBadge.classList.add('bt-hand-page-new');
    state.pageBadge.setAttribute('role', 'status');
    button.appendChild(state.pageBadge);
  }
  const text = `新增 ${state.pending.size}`;
  state.pageBadge.setAttribute('aria-label', text);
  button.setAttribute('aria-label', `${baseLabel}，其他栏新增 ${state.pending.size} 张手牌`);
}

export function showBattleEffectFeedback(stage, events = [], prev, extraTurn) {
  const state = stateFor(stage);
  if (!state) return;
  for (const event of events) {
    if (!['extra-turn-start', 'recast', 'item-use'].includes(event.kind) || event.battleToken !== state.token) continue;
    if (Number.isSafeInteger(event.eventId) && event.eventId > 0) {
      if (event.eventId <= state.lastEventId) continue;
      state.lastEventId = event.eventId;
    } else {
      if (state.seen.has(event)) continue;
      state.seen.add(event);
    }
    if (event.kind === 'item-use') {
      for (const target of event.targets || ['self']) {
        const anchor = stage.querySelector(target === 'self' ? '#btSelf .sts-figure' : `.sts-foe[data-eidx="${target}"] .sts-figure`);
        if (!anchor) continue;
        const kind = target === 'self' ? /药|回复|恢复|治疗/.test(event.name || '') ? 'heal' : 'buff' : 'debuff';
        emitBattleArt(stage, kind, { anchor, size: 175, duration: 760 });
      }
      continue;
    }
    if (event.kind === 'extra-turn-start') {
      dismissMatching(state, '.bt-extra-turn');
      extraTurn?.();
      continue;
    }
    const card = [...stage.querySelectorAll('.bt-card[data-uid]')].find(node => node.getAttribute('data-uid') === String(event.uid));
    const anchor = card || stage.querySelector('.sts-hand');
    emitBattleArt(stage, event.scope === 'damage' ? 'pulse' : 'magic', { anchor, size: 180, duration: 560 });
  }
}
