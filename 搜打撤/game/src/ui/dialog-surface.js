import { registerScreenOwner, currentScreenOwner } from './screen-owner.js';
import { claimInputIsolation } from './input-isolation.js';

// Rich forms and confirmations share input ownership without replacing the source page.
/** @param {HTMLElement} root
 * @param {{initialFocus?: HTMLElement, returnFocus?: Element, onBack?: () => void, priority?: number}} [options] */
export function bindDialogSurface(root, { initialFocus, returnFocus = document.activeElement,
  onBack, priority = 90 } = {}) {
  if (!root.hasAttribute('tabindex')) root.tabIndex = -1;
  const isolated = new Set();
  for (let branch = root; branch?.parentElement; branch = branch.parentElement) {
    for (const peer of branch.parentElement.children) {
      if (peer === branch || !(peer instanceof HTMLElement) || peer.matches('script,style,link')) continue;
      isolated.add(claimInputIsolation(peer));
    }
    if (branch.parentElement === document.body) break;
  }
  root.dataset.dialogSurface = '';
  const releaseOwner = registerScreenOwner({ root, priority, onBack,
    isCurrent:() => !root.hidden });
  const trap = event => {
    if (event.key !== 'Tab') return;
    const items = [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(
      'button,input,textarea,select,a[href],[tabindex]:not([tabindex="-1"])',
    ))].filter(node => !node.matches(':disabled,[aria-disabled="true"]')
      && !node.closest('[hidden],[inert]') && node.getClientRects().length);
    if (!items.length) { event.preventDefault(); root.focus({ preventScroll:true }); return; }
    const first = items[0], last = items.at(-1);
    if (!items.includes(/** @type {HTMLElement} */ (document.activeElement)) || event.shiftKey && document.activeElement === first) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  root.addEventListener('keydown', trap);
  initialFocus?.focus({ preventScroll:true });
  let released = false;
  return ({ restoreFocus = true } = {}) => {
    if (released) return;
    released = true;
    releaseOwner(); root.removeEventListener('keydown', trap);
    delete root.dataset.dialogSurface;
    for (const release of isolated) release();
    isolated.clear();
    const owner = currentScreenOwner();
    if (restoreFocus && returnFocus instanceof HTMLElement && returnFocus.isConnected
      && (!owner || owner.root.contains(returnFocus))
      && !returnFocus.matches(':disabled') && !returnFocus.closest('[hidden],[inert],[aria-hidden="true"]')) {
      returnFocus.focus({ preventScroll:true });
    }
  };
}
