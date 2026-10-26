import { esc, escAttr } from '../core/shared.js';
import { createOperationNotice } from './operation-notice.js';
import { isActionTargetAvailable } from './action-dispatch.js';
import '../../css/interface-components.css';
import '../../css/ui-design-system.css';
import '../../css/settlement-report.css';

// Presentation only; callers own settlement, persistence and action handlers.
export function settlementReportHTML({ title, subtitle, banner, content, actions }) {
  return `<section class="settlement-report glass-panel ui-dialog-panel ui-design-system" aria-label="${escAttr(title)}">
    <header class="settlement-heading">${banner ? `<img class="settlement-banner" src="${escAttr(banner)}" alt="" draggable="false">` : ''}<div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div></header>
    <div class="settlement-content">${content}</div>
    <footer class="settlement-actions confirmation-actions">${actions.map(({ action, label, primary }) => `<button type="button" class="ui-action${primary ? ' ui-action-primary' : ''}" data-act="${escAttr(action)}">${esc(label)}</button>`).join('')}</footer>
  </section>`;
}

// A rendered result owns its exits, including async failure feedback.
export function bindSettlementActions({ UI, isCurrent, actions }) {
  const body = UI.el?.ovBody || document.getElementById('ovBody');
  const panel = body?.querySelector('.settlement-report, [data-leave-step="complete"], #exDone') || body;
  const notice = createOperationNotice();
  panel?.insertAdjacentHTML('beforeend', notice.html({ keepEmpty:true }));
  let busy = false;
  const current = () => {
    const overlay = panel?.closest('#overlay');
    return isCurrent() && panel?.isConnected && body?.contains(panel) &&
      (!overlay || (!overlay.hidden && !overlay.classList.contains('closing')));
  };
  for (const [name, action] of Object.entries(actions)) UI.act(name, async () => {
    const button = [...(panel?.querySelectorAll('button') || [])].find(node => node.dataset.act === name);
    if (!current() || busy || !isActionTargetAvailable(button, UI)) return false;
    busy = true;
    const focused = button.ownerDocument.activeElement === button;
    let failed = false;
    const controls = [...panel.querySelectorAll('button')].map(control => ({ control, disabled:control.disabled }));
    controls.forEach(({ control }) => { control.disabled = true; });
    panel.setAttribute('aria-busy', 'true');
    notice.clear();
    try {
      const result = await action();
      failed = result === false;
      if (failed && current()) notice.set('结算已完成，暂时无法打开该页面，请重试。', 'warn');
      return result;
    } catch (error) {
      failed = true;
      console.error('[settlement] 结算页面跳转失败：', error);
      if (current()) notice.set('结算已完成，暂时无法打开该页面，请重试。', 'warn');
      return false;
    } finally {
      busy = false;
      if (current()) {
        controls.forEach(({ control, disabled }) => { control.disabled = disabled; });
        panel.removeAttribute('aria-busy');
        const doc = button.ownerDocument;
        if (failed && focused && (!doc.activeElement || doc.activeElement === doc.body) &&
            isActionTargetAvailable(button, UI)) button.focus({ preventScroll:true });
      }
    }
  });
}
