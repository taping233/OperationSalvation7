import { storeGet } from '../core/storage.js';
const installed = new WeakSet();
export function bindEndTurnHold(button, run) {
  if (!button || installed.has(button)) return;
  installed.add(button);
  let timer = null;
  const enabled = () => storeGet('sdt-end-turn-hold') === '1';
  const cancel = () => {
    clearTimeout(timer); timer = null; button.classList.remove('is-holding');
    ['blur', 'pointerup', 'pointercancel'].forEach(name => window.removeEventListener(name, cancel));
    window.removeEventListener('keyup', keyReleased);
    document.removeEventListener('visibilitychange', cancel);
  };
  const keyReleased = event => { if ([' ', 'Enter'].includes(event.key)) cancel(); };
  const available = () => button.isConnected && !button.disabled && !document.hidden
    && !button.closest('[hidden], [inert], .closing, [data-ui-closing]');
  const begin = () => {
    if (!enabled() || !available() || timer !== null) return;
    button.classList.add('is-holding');
    ['blur', 'pointerup', 'pointercancel'].forEach(name => window.addEventListener(name, cancel));
    window.addEventListener('keyup', keyReleased);
    document.addEventListener('visibilitychange', cancel);
    timer = setTimeout(() => { cancel(); if (available() && enabled()) run(); }, 650);
  };
  button.addEventListener('pointerdown', event => { if (event.button === 0 && !event.ctrlKey && !event.altKey && !event.metaKey) begin(); });
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(name => button.addEventListener(name, cancel));
  button.addEventListener('click', event => { if (enabled()) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  button.addEventListener('keydown', event => {
    if (!enabled() || ![' ', 'Enter'].includes(event.key) || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.altKey || event.metaKey) { cancel(); return; }
    event.preventDefault(); event.stopPropagation(); if (!event.repeat) begin();
  });
  button.addEventListener('keyup', event => { if (enabled() && [' ', 'Enter'].includes(event.key)) { event.preventDefault(); cancel(); } });
}
