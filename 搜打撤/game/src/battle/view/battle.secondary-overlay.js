import '../../ui/feedback-theme.js';
import '../../../css/battle-secondary-overlay.css';

// Keep the live battlefield, including its hand/unit/scenery mounts. The
// transparent input shield belongs to the secondary page, never the engine.
export function mountCombatOverlay(UI, title, html, mode, scene) {
  if (scene.contains(document.activeElement)) scene._secondaryReturnFocus = document.activeElement;
  scene.remove();
  UI.showOverlay(title, `<div class="battle-secondary-layer">${html}</div>`, mode);
  scene.setAttribute('inert', '');
  scene.setAttribute('aria-hidden', 'true');
  UI.el.ovBody.prepend(scene);
  UI.el.ovBody.parentElement.classList.add('battle');
  UI._hasBattleStage = true;
  // Capture also blocks direct pointer listeners and global shortcuts. Tab and
  // Escape continue through the existing modal/cancellation implementation.
  const layer = UI.el.ovBody.querySelector('.battle-secondary-layer');
  layer.addEventListener('pointerdown', event => event.stopPropagation());
  layer.addEventListener('click', event => {
    if (event.target === layer) event.stopPropagation();
  });
}

export function restoreCombatScene(UI, token) {
  const layer = UI.el.ovBody?.querySelector('.battle-secondary-layer');
  const scene = UI.el.ovBody?.querySelector('.battle-stage');
  if (!layer || !scene || scene._battleToken !== token) return false;
  scene.remove();
  UI.showOverlay('', '', 'battle');
  scene.removeAttribute('inert');
  scene.removeAttribute('aria-hidden');
  UI.el.ovBody.append(scene);
  const target = scene._secondaryReturnFocus;
  delete scene._secondaryReturnFocus;
  if (target?.isConnected && scene.contains(target) && !target.matches(':disabled') && !target.closest('[hidden], [inert], [aria-hidden="true"]')) target.focus({ preventScroll:true });
  UI._hasBattleStage = true;
  return true;
}
