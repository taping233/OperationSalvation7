import { bindDialogSurface } from './dialog-surface.js';
import { esc } from '../core/shared.js';
import { completeSurfaceMotion } from './motion-completion.js';
import { motionTiming } from './motion-presets.js';
import '../../css/interface-components.css';

// A separate top layer keeps the source page, action closures and reading position.
export function confirmAction({ title, message, confirmLabel = '确认', onConfirm }) {
  if (document.getElementById('actionConfirmation')) return Promise.resolve(false);
  document.querySelectorAll('.action-confirmation.confirmation-leaving').forEach(node => node.remove());
  return new Promise(resolve => {
    const source = document.activeElement;
    const root = document.createElement('div');
    root.id = 'actionConfirmation'; root.className = 'action-confirmation';
    root.setAttribute('role', 'alertdialog'); root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'actionConfirmationTitle');
    root.setAttribute('aria-describedby', 'actionConfirmationMessage');
    root.innerHTML = `<section class="confirmation-panel ui-dialog-panel"><h2 id="actionConfirmationTitle">${esc(title)}</h2><p id="actionConfirmationMessage">${esc(message)}</p><p class="confirmation-status" role="status"></p><div class="confirmation-actions"><button type="button" class="ui-control" data-ui-action="secondary" data-confirm-cancel><span class="ui-control-label">取消</span></button><button type="button" class="ui-control danger" data-ui-action="danger" data-confirm-submit><span class="ui-control-label">${esc(confirmLabel)}</span></button></div></section>`;
    let busy = false, done = false;
    let release = () => {};
    const finish = value => {
      if (done || busy) return;
      done = true; release();
      // Resolve the action and restore input immediately; only its inert visual
      // shell remains for the short exit. It cannot conflict with a new dialog.
      root.inert = true;
      root.removeAttribute('role'); root.removeAttribute('aria-modal');
      root.removeAttribute('aria-labelledby'); root.removeAttribute('aria-describedby');
      root.setAttribute('aria-hidden', 'true');
      root.removeAttribute('id');
      root.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      root.querySelectorAll('[data-confirm-cancel],[data-confirm-submit]').forEach(node => {
        node.removeAttribute('data-confirm-cancel'); node.removeAttribute('data-confirm-submit');
      });
      root.classList.add('confirmation-leaving');
      completeSurfaceMotion(root.querySelector('.confirmation-panel'), () => root.remove(), {
        name:'confirmationPanelOut', duration:motionTiming.panelExit,
      });
      resolve(value);
    };
    const cancel = /** @type {HTMLButtonElement} */ (root.querySelector('[data-confirm-cancel]'));
    const submit = /** @type {HTMLButtonElement} */ (root.querySelector('[data-confirm-submit]'));
    cancel.addEventListener('click', () => finish(false));
    submit.addEventListener('click', async () => {
      if (busy || done) return;
      busy = true; cancel.disabled = submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      root.querySelector('.confirmation-status').textContent = '正在处理…';
      try {
        const result = await onConfirm?.();
        if (result === false || result?.ok === false) throw new Error(result?.message || '操作未完成，请重试。');
        busy = false; finish(true);
      } catch (error) {
        busy = false; cancel.disabled = submit.disabled = false;
        submit.removeAttribute('aria-busy');
        root.querySelector('.confirmation-status').textContent = error instanceof Error ? error.message : '操作未完成，请重试。';
      }
    });
    document.body.append(root);
    release = bindDialogSurface(root, { initialFocus:cancel, returnFocus:source, priority:100, onBack:() => finish(false) });
  });
}
