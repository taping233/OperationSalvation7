import { demoMs } from '../runtime/battle.pace.js';
import '../../../css/battle-attack-profiles.css';

// One enemy sample using its existing illustration. Other enemy families retain their motion.
const active = new WeakMap();
export function playEnemyMotion(figure, action) {
  const image = /** @type {HTMLImageElement} */ (figure?.querySelector('img'));
  if (!image?.getAttribute('src')?.includes('/bandit.webp') || !image.animate
    || window.SDT?.Motion?.reduceMotion?.()) return false;
  const frames = action === 'attack' ? [
    { transform: 'translateX(0) rotate(0deg)' },
    { transform: 'translateX(7px) rotate(3deg)', offset: .24 },
    { transform: 'translateX(-26px) rotate(-5deg)', offset: .48 },
    { transform: 'translateX(-8px) rotate(-2deg)', offset: .66 },
    { transform: 'translateX(0) rotate(0deg)' },
  ] : action === 'hurt' ? [
    { transform: 'translateX(0) rotate(0deg)', filter: 'brightness(1)' },
    { transform: 'translateX(12px) rotate(6deg)', filter: 'brightness(1.6)', offset: .18 },
    { transform: 'translateX(4px) rotate(2deg)', filter: 'brightness(1.12)', offset: .55 },
    { transform: 'translateX(0) rotate(0deg)', filter: 'brightness(1)' },
  ] : null;
  if (!frames) return false;
  active.get(image)?.dispose(true);
  const animation = image.animate(frames, {
    duration: demoMs(action === 'attack' ? 360 : 300), easing: 'ease-out',
  });
  const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const record = { dispose(cancel = false) {
    observer.disconnect();
    preference?.removeEventListener?.('change', reconcile);
    document.removeEventListener('sdt-overlay-close', abort);
    if (active.get(image) === record) active.delete(image);
    if (cancel) animation.cancel();
  } };
  function abort() { record.dispose(true); }
  function reconcile() {
    if (!image.isConnected || figure.closest('.dead') || document.body.classList.contains('reduce-motion')
      || preference?.matches || window.SDT?.Motion?.reduceMotion?.()) abort();
  }
  const observer = new MutationObserver(reconcile);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  active.set(image, record);
  preference?.addEventListener?.('change', reconcile);
  document.addEventListener('sdt-overlay-close', abort, { once: true });
  animation.finished?.then(() => record.dispose(), () => record.dispose());
  return true;
}
