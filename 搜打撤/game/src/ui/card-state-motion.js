import { retargetVisual, clearVisual } from './target-motion.js';
import { motionReduced, motionTiming } from './motion-presets.js';
import '../../css/card-state-motion.css';

const selector = '.reward-replica .reward-card,.bag-tile.card-face[data-stack]';
const installations = new WeakMap();
const blocked = element => element.closest('.dragging,[aria-grabbed="true"],.reward-unit.got,.reward-unit.dropped,.bt-hand,.sts-hand')
  || element.disabled || element.closest('[hidden],[inert]');

// Delegation survives reward and bag reconciliation without adding per-page listeners.
export function installCardStateMotion(root = document.body) {
  if (installations.has(root)) return installations.get(root);
  const tracked = new Map();
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let pointerCard = null, focusCard = null;
  function update(element) {
    if (!element) return;
    if (blocked(element)) { release(element); return; }
    if (!tracked.has(element)) tracked.set(element, true);
    element.dataset.cardStateMotion = 'true';
    const active = pointerCard === element || focusCard === element
      || element.matches('[aria-selected="true"],[aria-pressed="true"]')
      || !!element.closest('.is-pending-target');
    const quiet = motionReduced();
    retargetVisual(element, {
      y: active && !quiet ? -6 : 0, scale: active && !quiet ? 1.02 : 1, rotate: 0,
    }, { duration: quiet ? 0 : active ? motionTiming.change : motionTiming.cardReturn });
  }
  function release(element) {
    clearVisual(element); delete element.dataset.cardStateMotion; tracked.delete(element);
    if (pointerCard === element) pointerCard = null;
    if (focusCard === element) focusCard = null;
  }
  const card = target => target?.closest?.(selector);
  function over(event) {
    if (event.pointerType === 'touch') return;
    const next = card(event.target);
    if (!next || next === pointerCard) return;
    const previous = pointerCard; pointerCard = next; update(previous); update(next);
  }
  function out(event) {
    const previous = card(event.target);
    if (!previous || previous !== pointerCard || previous.contains(event.relatedTarget)) return;
    pointerCard = null; update(previous);
  }
  function focus(event) { const previous = focusCard; focusCard = card(event.target); update(previous); update(focusCard); }
  function blur(event) {
    const previous = card(event.target);
    if (!previous || previous.contains(event.relatedTarget)) return;
    focusCard = null; update(previous);
  }
  function reset() { for (const element of [...tracked.keys()]) release(element); }
  function preferenceChanged() { for (const element of [...tracked.keys()]) update(element); }
  const observer = new MutationObserver(records => {
    for (const element of [...tracked.keys()]) {
      if (!root.contains(element) || blocked(element)) release(element);
      else if (records.some(record => record.type === 'attributes' && (record.target === element || record.target.contains(element)))) update(element);
    }
    syncSelected();
  });
  function syncSelected() {
    for (const element of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('.reward-replica .is-pending-target .reward-card,.reward-replica .reward-card[aria-selected="true"],.bag-tile.card-face[data-stack][aria-selected="true"]'))) {
      if (!tracked.has(element)) update(element);
    }
  }
  observer.observe(root, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['class','hidden','inert','disabled','aria-selected','aria-pressed','aria-grabbed'] });
  const handlers = { pointerover: over, pointerout: out, focusin: focus, focusout: blur };
  for (const [type, handler] of Object.entries(handlers)) root.addEventListener(type, handler);
  document.addEventListener('sdt-overlay-close', reset);
  document.addEventListener('sdt-overlay-mode', reset);
  media?.addEventListener?.('change', preferenceChanged);
  syncSelected();
  const dispose = () => {
    if (installations.get(root) !== dispose) return;
    installations.delete(root);
    observer.disconnect(); reset();
    for (const [type, handler] of Object.entries(handlers)) root.removeEventListener(type, handler);
    document.removeEventListener('sdt-overlay-close', reset);
    document.removeEventListener('sdt-overlay-mode', reset);
    media?.removeEventListener?.('change', preferenceChanged);
  };
  installations.set(root, dispose);
  return dispose;
}
