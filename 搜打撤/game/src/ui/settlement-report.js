import { esc, escAttr } from '../core/shared.js';
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
