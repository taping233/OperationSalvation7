import { discoveryActionsHTML } from '../../ui/discovery-selection.js';
import { esc, escAttr } from '../../core/shared.js';
import '../../../css/battle-discover.css';

// Presentation only. Candidate identity, order and selection effects stay in the battle flow.
export function battleDiscoverBodyHTML({ candidates, cardHTML, action, remaining, source = '', note = '', modifiers = [], pageToken = '' }) {
  const options = candidates.map(({ card, sourceNote = '', equipmentNote = '', infusionNote = '' }, index) => `
    <div class="battle-discover-slot"><button type="button" class="bt-card battle-discover-card" data-act="btDiscover" data-i="${index}" data-discover-page="${escAttr(pageToken)}" data-cancel="false"
      aria-label="${escAttr([card.name, action, sourceNote, infusionNote, equipmentNote].filter(Boolean).join('，'))}">
      ${cardHTML(card, 'lg')}
    </button>${infusionNote ? `<span class="battle-discover-critical">${esc(infusionNote.startsWith('未注能') ? '未注能' : infusionNote)}</span>` : ''}</div>`).join('');
  const context = [action, source, note, ...modifiers].filter(Boolean).join('，');
  return `<p class="ov-stats battle-discover-summary"><strong class="battle-discover-action">${esc(action)}</strong></p>
    <section class="battle-discover-panel" data-battle-discover data-discover-page="${escAttr(pageToken)}" aria-label="${escAttr(context)}，还需发现 ${remaining} 次">
      <div class="bt-hand battle-discover-options" data-selection-scroll role="group" aria-label="${escAttr(action)}">${options}</div>
    </section>${discoveryActionsHTML({ confirmAct:'btDiscoverConfirm', cancelAct:'btDiscoverCancel' })}`;
}
