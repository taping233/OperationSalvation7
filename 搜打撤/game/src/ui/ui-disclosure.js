import { esc, escAttr } from '../core/shared.js';
import '../../css/ui-design-system.css';

// Caller supplies trusted view markup only; costs, capacity and irreversible risks stay outside.
export function uiDisclosure({ label = '说明', content = '', className = '' } = {}) {
  return `<details class="ui-disclosure ${escAttr(className)}"><summary>${esc(label)}</summary><div class="ui-disclosure-body">${content}</div></details>`;
}
