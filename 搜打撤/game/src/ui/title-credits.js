import './home-fx.js';
import { enterHomeDialog, leaveHomeDialog } from './home-menu-motion.js';
import './home-layers.js';
import '../../css/title-credits.css';
import { linkedBackHTML } from './home-linked-interactions.js';

// Keep native dialog focus and return semantics while matching the home page choreography.
const creditsButton = /** @type {HTMLButtonElement} */ (document.getElementById('mCredits'));
const creditsDialog = /** @type {HTMLDialogElement} */ (document.getElementById('homeCredits'));
const creditsBack = /** @type {HTMLElement} */ (creditsDialog?.querySelector('.home-credits-back'));
if (creditsBack) creditsBack.outerHTML = linkedBackHTML('', '返回主页', 'home-credits-back', 'submit');

creditsButton?.addEventListener('click', () => {
  if (creditsDialog && !creditsDialog.open) {
    enterHomeDialog(creditsDialog);
    creditsDialog.showModal();
  }
});

const closeCredits = () => {
  if (creditsDialog?.open) leaveHomeDialog(creditsDialog, () => creditsDialog.close());
};
/** @type {HTMLElement} */ (creditsDialog?.querySelector('form'))?.addEventListener('submit', event => {
  event.preventDefault();
  closeCredits();
});
creditsDialog?.addEventListener('cancel', event => {
  event.preventDefault();
  closeCredits();
});

creditsDialog?.addEventListener('click', (event) => {
  if (event.target !== creditsDialog) return;
  const bounds = creditsDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    closeCredits();
  }
});
