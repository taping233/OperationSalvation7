import '../../../css/battle-hand-selection.css';
import { isInteractiveBattlePage } from './battle.page-activity.js';

let cleanup = null;
if (import.meta.hot) import.meta.hot.dispose(() => cleanup?.());

export function renderHandSelection({ UI, snapshot, getSnapshot, selection }) {
  cleanup?.(); cleanup = null;
  const stage = UI.el.ovBody.querySelector('.battle-stage.sts');
  if (!stage) return;
  const previous = stage.querySelector('[data-hand-selection]');
  const focused = previous?.contains(document.activeElement) ? /** @type {HTMLElement} */ (document.activeElement).dataset.act : null;
  previous?.remove();
  stage.toggleAttribute('data-hand-selecting', !!selection);
  if (!selection) return;
  stage.querySelectorAll('.sts-arena, .sts-topbar, .bt-potions, .sts-tactics, .sts-hud-l, .sts-hud-r, .sts-energy-wrap, .sts-hand-tools')
    .forEach(node => { node.inert = true; });
  stage.querySelector('.sts-hand')?.setAttribute('aria-label', `${selection.label}，点击选中，再点撤选`);
  const controls = document.createElement('nav');
  controls.setAttribute('data-hand-selection', '');
  controls.setAttribute('aria-label', selection.label);
  controls.innerHTML = `<button class="ov-btn" data-act="btHandSelectCancel" ${selection.canCancel ? '' : 'disabled'}>取消</button>
    <span role="status" aria-live="polite">${selection.label} · ${selection.selection.picked.length}/${selection.selection.need}</span>
    <button class="ov-btn ok" data-act="btHandSelectConfirm" ${selection.canConfirm ? '' : 'disabled'}>确定</button>`;
  stage.append(controls);
  const current = () => getSnapshot().battleToken === snapshot.battleToken
    && isInteractiveBattlePage(UI, controls) && !!selection.current(getSnapshot());
  UI.act('btHandSelectCancel', () => { if (current()) selection.cancel(); });
  UI.act('btHandSelectConfirm', () => { if (current()) selection.confirm(); });
  if (focused) /** @type {HTMLButtonElement} */ (controls.querySelector(`[data-act="${focused}"]`))?.focus({ preventScroll:true });
  const key = event => {
    if (event.defaultPrevented || event.isComposing || event.repeat || !current()) return;
    if (event.key === 'Escape' && selection.canCancel) {
      event.preventDefault(); event.stopImmediatePropagation(); selection.cancel();
    } else if (event.key === 'Enter' && !event.target.closest('button,.hs-card,input,textarea,select')) {
      event.preventDefault(); event.stopImmediatePropagation(); selection.confirm();
    }
  };
  document.addEventListener('keydown', key, true);
  cleanup = () => document.removeEventListener('keydown', key, true);
}
