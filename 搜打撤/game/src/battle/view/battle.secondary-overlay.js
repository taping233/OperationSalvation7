/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
import '../../ui/feedback-theme.js';
import { beginRuntimeStage } from '../../core/runtime-trace-stages.local.js';
import { syncCommittedRunTopBar } from '../../ui/run-top-bar.js';
import { bindDialogSurface } from '../../ui/dialog-surface.js';
import { clearTurnFeedback } from './battle.turn-feedback.js';
import '../../../css/battle-secondary-overlay.css';

const localSettings = new WeakMap();

// Settings is a local dialog, not a navigation of the retained battle overlay.
function mountLocalSettings(UI, html, scene) {
  const body = UI.el.ovBody, overlay = UI.el.overlay, token = scene._battleToken;
  const oldInert = scene.hasAttribute('inert'), oldHidden = scene.getAttribute('aria-hidden');
  const layer = document.createElement('div');
  layer.className = 'battle-secondary-layer';
  layer.dataset.localBattleSettings = '';
  layer.innerHTML = window.SDT?.Icons?.rich?.(html) || html;
  const panel = /** @type {BattleElement} */ (layer.querySelector('.battle-secondary-panel'));
  if (!panel) return false;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', panel.querySelector('h3')?.textContent || '战斗设置');
  scene.setAttribute('inert', '');
  scene.setAttribute('aria-hidden', 'true');
  clearTurnFeedback();
  body.append(layer);
  let disposed = false;
  /** @type {ReturnType<typeof bindDialogSurface>} */
  let releaseDialog = () => {};
  const dispose = (restoreFocus = false) => {
    if (disposed) return;
    disposed = true;
    observer.disconnect(); localSettings.delete(layer);
    layer.remove();
    if (scene.parentNode === body && scene._battleToken === token) {
      scene.toggleAttribute('inert', oldInert);
      if (oldHidden === null) scene.removeAttribute('aria-hidden');
      else scene.setAttribute('aria-hidden', oldHidden);
    }
    releaseDialog({ restoreFocus });
    syncCommittedRunTopBar(UI);
  };
  const observer = new MutationObserver(() => {
    if (!layer.isConnected || !scene.isConnected || scene._battleToken !== token
        || UI.el.ovBody !== body || overlay.hidden || overlay.classList.contains('closing')) dispose();
  });
  localSettings.set(layer, dispose);
  observer.observe(body, { childList:true });
  observer.observe(overlay, { attributes:true, attributeFilter:['hidden','class'] });
  releaseDialog = bindDialogSurface(layer, {
    initialFocus:/** @type {HTMLElement} */ (panel.querySelector('[data-act="btSettingsBack"]')),
    onBack:() => UI._acts?.btSettingsBack?.({}),
  });
  layer.addEventListener('pointerdown', event => event.stopPropagation());
  layer.addEventListener('click', event => { if (event.target === layer) event.stopPropagation(); });
  syncCommittedRunTopBar(UI);
  document.dispatchEvent(new CustomEvent('sdt-battle-settings-open', {detail:{stage:scene}}));
  return true;
}

// The callback runs at the normal overlay body-write boundary, after its hooks.
// Detached parsing preserves the scene connection and existing animation nodes.
function retainedBody(UI, body, scene, isCurrent) {
  const token = scene._battleToken, revision = (UI._overlayRevision || 0) + 1, owner = scene._battleRenderCurrent;
  return html => {
    const current = isCurrent();
    // A queued replacement battle may not have painted yet. Discard only this
    // departed scene, never a same-node scene already claimed by a newer render.
    if (!current && UI._overlayRevision === revision && UI.el.ovBody === body && scene.parentNode === body && scene._battleToken === token && scene._battleRenderCurrent === owner) {
      scene.remove(); UI._hasBattleStage = !!body.querySelector('.battle-stage');
    }
    if (!current || UI.el.ovBody !== body || scene.parentNode !== body || scene._battleToken !== token || scene._battleRenderCurrent !== owner || UI._overlayRevision !== revision) return null;
    // With no HTML the overlay asks whether synchronous hooks retained ownership.
    if (html === undefined) return true;
    const template = document.createElement('template');
    template.innerHTML = html;
    const content = template.content.firstElementChild || template.content;
    for (const child of [...body.childNodes]) if (child !== scene) child.remove();
    body.append(template.content);
    return content;
  };
}

// Keep the live battlefield, including its hand/unit/scenery mounts. The
// transparent input shield belongs to the secondary page, never the engine.
export function mountCombatOverlay(UI, title, html, mode, scene, { localSettings:local = false } = {}) {
  const isCurrent = scene._battleRenderCurrent || (() => true);
  const body = UI.el.ovBody;
  if (!isCurrent() || scene.parentNode !== body) return false;
  if (local) return mountLocalSettings(UI, html, scene);
  if (scene.contains(document.activeElement)) scene._secondaryReturnFocus = document.activeElement;
  scene.setAttribute('inert', '');
  scene.setAttribute('aria-hidden', 'true');
  const battleBody = retainedBody(UI, body, scene, isCurrent);
  UI.showOverlay(title, `<div class="battle-secondary-layer">${html}</div>`, mode, { battleBody });
  if (!battleBody()) return false;
  UI.el.ovBody.parentElement.classList.add('battle');
  UI._hasBattleStage = true;
  // Capture also blocks direct pointer listeners and global shortcuts. Tab and
  // Escape continue through the existing modal/cancellation implementation.
  const layer = /** @type {BattleElement} */ (UI.el.ovBody.querySelector('.battle-secondary-layer'));
  layer.addEventListener('pointerdown', event => event.stopPropagation());
  layer.addEventListener('click', event => {
    if (event.target === layer) event.stopPropagation();
  });
  return true;
}

/**
 * The trace context is an opaque opt-in token, forwarded without inspecting it.
 * @param {{ isCurrent?: () => boolean, traceContext?: object | null }} [options]
 * @returns {boolean}
 */
export function restoreCombatScene(UI, token, options = {}) {
  const { isCurrent = () => true, traceContext } = options;
  const body = UI.el.ovBody;
  const layer = /** @type {BattleElement} */ (UI.el.ovBody?.querySelector('.battle-secondary-layer'));
  const scene = /** @type {BattleElement} */ (UI.el.ovBody?.querySelector('.battle-stage'));
  if (!layer || !scene || scene._battleToken !== token) return false;
  const releaseSettings = localSettings.get(layer);
  if (releaseSettings) {
    if (!isCurrent()) return false;
    layer.remove();
    releaseSettings(true);
    return isCurrent() && scene.parentNode === body && scene._battleToken === token;
  }
  const battleBody = retainedBody(UI, body, scene, isCurrent);
  const finishShow = traceContext && beginRuntimeStage('battle-restore-show-sync', traceContext);
  try { UI.showOverlay('', '', 'battle', { battleBody }); }
  finally { if (finishShow) finishShow(); }
  if (!battleBody()) return false;
  const finishFocus = traceContext && beginRuntimeStage('battle-restore-focus-sync', traceContext);
  try {
    scene.removeAttribute('inert');
    scene.removeAttribute('aria-hidden');
    syncCommittedRunTopBar(UI);
    const target = scene._secondaryReturnFocus;
    delete scene._secondaryReturnFocus;
    if (target?.isConnected && scene.contains(target) && !target.matches(':disabled') && !target.closest('[hidden], [inert], [aria-hidden="true"]')) target.focus({ preventScroll:true });
  } finally { if (finishFocus) finishFocus(); }
  // Focusing the old trigger can synchronously navigate or start a newer render.
  if (!battleBody()) return false;
  UI._hasBattleStage = true;
  return true;
}
