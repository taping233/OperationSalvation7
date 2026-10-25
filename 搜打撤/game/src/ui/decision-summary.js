import { esc } from '../core/shared.js';
import '../../css/decision-summary.css';

// Decision facts stay visible next to their action; rule explanations belong elsewhere.
export function decisionSummaryHTML({ status, facts = [], hints = [], actions = '', ready = false, className = '' }) {
  return `<div class="decision-summary ${ready ? 'ready' : 'blocked'} ${className}"><div class="decision-summary-facts"><strong>${esc(status)}</strong><span>${facts.map(esc).join(' · ')}</span>${hints.filter(Boolean).map(hint => `<small class="prep-qual-hint">${esc(hint)}</small>`).join('')}</div><div class="decision-summary-actions">${actions}</div></div>`;
}
