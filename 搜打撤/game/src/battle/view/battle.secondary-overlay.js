import '../../ui/feedback-theme.js';
import '../../../css/battle-secondary-overlay.css';

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
    if (!current || UI.el.ovBody !== body || scene.parentNode !== body || scene._battleToken !== token || UI._overlayRevision !== revision) return null;
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
export function mountCombatOverlay(UI, title, html, mode, scene) {
  const isCurrent = scene._battleRenderCurrent || (() => true);
  const body = UI.el.ovBody;
  if (!isCurrent() || scene.parentNode !== body) return false;
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
  const layer = UI.el.ovBody.querySelector('.battle-secondary-layer');
  layer.addEventListener('pointerdown', event => event.stopPropagation());
  layer.addEventListener('click', event => {
    if (event.target === layer) event.stopPropagation();
  });
  return true;
}

export function restoreCombatScene(UI, token, { isCurrent = () => true } = {}) {
  const body = UI.el.ovBody;
  const layer = UI.el.ovBody?.querySelector('.battle-secondary-layer');
  const scene = UI.el.ovBody?.querySelector('.battle-stage');
  if (!layer || !scene || scene._battleToken !== token) return false;
  const battleBody = retainedBody(UI, body, scene, isCurrent);
  UI.showOverlay('', '', 'battle', { battleBody });
  if (!battleBody()) return false;
  scene.removeAttribute('inert');
  scene.removeAttribute('aria-hidden');
  const target = scene._secondaryReturnFocus;
  delete scene._secondaryReturnFocus;
  if (target?.isConnected && scene.contains(target) && !target.matches(':disabled') && !target.closest('[hidden], [inert], [aria-hidden="true"]')) target.focus({ preventScroll:true });
  UI._hasBattleStage = true;
  return true;
}
