/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
import { isHandArrivalEvent } from '../core/battle.card-presentation.js';
import { createAcquisitionIcon } from '../../ui/lucide-acquisition-icon.js';
import { rect as uiRect } from '../../ui/ui-scale.js';
import { schedulePresentationMs } from '../runtime/battle.clock.js';

// These notices observe settled events. They never join the action/flight clock.
const states = new WeakMap(), liveStates = new Set();
const reducedMotion = () => !!window.SDT?.Motion?.reduceMotion?.();

function clearState(state) {
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
      if (!before && !reducedMotion()) continue; // New slots already have the original draw flight.
      const count = record.group.uids.filter(uid => incoming.has(uid) && !before?.has(uid)).length;
      if (!count) continue;
      const old = /** @type {BattleElement} */ (record.slot.querySelector('.bt-hand-acquired'));
      if (old) state.notices.get(old)?.();
      const label = document.createElement('span');
      label.className = 'bt-hand-acquired';
      label.dataset.reducedMotion = String(reducedMotion());
      const text = document.createElement('span');
      text.textContent = `入手 +${count}`;
      label.append(createAcquisitionIcon(), text);
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
    state.pageBadge = document.createElement('span');
    state.pageBadge.className = 'bt-hand-page-new';
    state.pageBadge.setAttribute('role', 'status');
    const text = document.createElement('span');
    text.className = 'bt-hand-page-new-text';
    state.pageBadge.append(createAcquisitionIcon(), text);
    button.appendChild(state.pageBadge);
  }
  const text = `新增 ${state.pending.size}`;
  const textNode = /** @type {BattleElement} */ (state.pageBadge.querySelector('.bt-hand-page-new-text'));
  if (textNode.textContent !== text) textNode.textContent = text;
  button.setAttribute('aria-label', `${baseLabel}，其他栏新增 ${state.pending.size} 张手牌`);
}

function placeRecast(stage, node, event, prev) {
  const stageRect = uiRect(stage), hostRect = uiRect(stage.closest('#overlay') || stage.parentElement);
  const current = [.../** @type {NodeListOf<BattleElement>} */ (stage.querySelectorAll('.bt-card[data-uid]'))].find(card => card.dataset.uid === String(event.uid));
  const old = prev?.cards?.[event.uid]?.rect;
  const anchor = current ? uiRect(current) : old
    ? { ...old, left: old.left + hostRect.left, top: old.top + hostRect.top }
    : uiRect(/** @type {BattleElement} */ (stage.querySelector('.sts-hand')) || stage);
  const x = anchor.left - stageRect.left + anchor.width / 2;
  const y = anchor.top - stageRect.top - 74;
  node.style.left = `${Math.max(116, Math.min(stageRect.width - 116, x))}px`;
  node.style.top = `${Math.max(stageRect.height * .61, Math.min(stageRect.height - 180, y))}px`;
}

function layoutRecasts(stage, notices) {
  if (notices.length < 2) return;
  const stageRect = uiRect(stage), handRect = uiRect(/** @type {BattleElement} */ (stage.querySelector('.sts-hand')) || stage);
  const center = handRect.left - stageRect.left + handRect.width / 2;
  const y = Math.max(stageRect.height * .61, Math.min(stageRect.height - 180, handRect.top - stageRect.top - 110));
  notices.forEach((node, index) => {
    node.style.left = `${Math.max(116, Math.min(stageRect.width - 116, center + (index - (notices.length - 1) / 2) * 236))}px`;
    node.style.top = `${y}px`;
  });
}

export function showBattleEffectFeedback(stage, events = [], prev, extraTurn) {
  const state = stateFor(stage);
  if (!state) return;
  for (const event of events) {
    if (!['extra-turn-start', 'recast'].includes(event.kind) || event.battleToken !== state.token) continue;
    if (Number.isSafeInteger(event.eventId) && event.eventId > 0) {
      if (event.eventId <= state.lastEventId) continue;
      state.lastEventId = event.eventId;
    } else {
      if (state.seen.has(event)) continue;
      state.seen.add(event);
    }
    if (event.kind === 'extra-turn-start') {
      dismissMatching(state, '.bt-extra-turn');
      extraTurn?.();
      continue;
    }
    const index = Math.max(1, Math.floor(Number(event.repeatIndex) || 1));
    const total = Math.max(index, Math.floor(Number(event.repeatTotal) || 1));
    // Refresh only the same execution source; distinct cards/sources keep up to
    // three short notices in the hand band, with no settlement-side waiting.
    const keyForSource = JSON.stringify([event.uid ?? event.name, event.source, event.scope]);
    let recasts = [...state.notices.keys()].filter(node => node.matches('.bt-recast-feedback'));
    for (const node of recasts) if (node.dataset.recastKey === keyForSource) state.notices.get(node)?.();
    recasts = recasts.filter(node => node.isConnected);
    if (recasts.length >= 3) state.notices.get(recasts.shift())?.();
    const notice = document.createElement('div');
    notice.className = 'bt-recast-feedback';
    notice.dataset.recastKey = keyForSource;
    notice.dataset.reducedMotion = String(reducedMotion());
    notice.setAttribute('role', 'status');
    const count = document.createElement('b'), name = document.createElement('span'), source = document.createElement('small');
    count.textContent = `${event.scope === 'damage' ? '追加伤害' : '追加施放'} ${index}/${total}`;
    name.textContent = event.name || event.card?.name || '卡牌效果';
    source.textContent = event.source || '追加效果';
    notice.append(count, name, source); stage.appendChild(notice);
    if (recasts.length === 0) placeRecast(stage, notice, event, prev);
    else layoutRecasts(stage, [...recasts, notice]);
    if (!reducedMotion() && notice.animate) {
      notice.animate([
        { opacity: 0, transform: 'translate(-50%,8px) scale(.96)' },
        { opacity: 1, transform: 'translate(-50%,0) scale(1)', offset: .16 },
        { opacity: 1, transform: 'translate(-50%,0) scale(1)', offset: .8 },
        { opacity: 0, transform: 'translate(-50%,-5px) scale(1)' },
      ], { duration: index > 1 ? 620 : 820, easing: 'ease-out', fill: 'both' });
    }
    retainBattleFeedback(stage, notice, 1000);
  }
}
