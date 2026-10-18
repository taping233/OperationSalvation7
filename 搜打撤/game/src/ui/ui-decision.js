import { esc, escAttr } from '../core/shared.js';
import '../../css/ui-design-system.css';

export function uiDecisionFacts(facts) {
  return `<dl class="ui-facts">${facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}

// Keep the existing action contract and readable disabled reason. No delegated state or commands.
export function uiDecisionChoice({ action, label, detail = '', disabled = false }) {
  return `<button type="button" class="evt-opt ui-choice" data-act="${escAttr(action)}"${disabled ? ' disabled aria-disabled="true"' : ''}><b>${esc(label)}</b>${detail ? `<span>${esc(detail)}</span>` : ''}</button>`;
}
