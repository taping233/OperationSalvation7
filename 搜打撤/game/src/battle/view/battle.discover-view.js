import { esc, escAttr } from '../../core/shared.js';
import '../../../css/battle-discover.css';

// Presentation only. Candidate identity, order and selection effects stay in the battle flow.
export function battleDiscoverBodyHTML({ candidates, cardHTML, action, remaining, source = '', note = '', modifiers = [], pageToken = '' }) {
  const options = candidates.map(({ card, sourceNote = '', equipmentNote = '', infusionNote = '' }, index) => `
    <div class="battle-discover-slot"><button type="button" class="bt-card battle-discover-card" data-act="btDiscover" data-i="${index}" data-discover-page="${escAttr(pageToken)}" data-cancel="false"
      aria-label="${escAttr([card.name, action, sourceNote, infusionNote, equipmentNote].filter(Boolean).join('，'))}">
      ${cardHTML(card, 'lg')}
    </button>${infusionNote ? `<span class="battle-discover-critical">${esc(infusionNote.startsWith('未注能') ? '未注能' : infusionNote)}</span>` : ''}<button type="button" class="battle-card-inspect" data-act="btDecisionInspect" data-i="${index}" data-cancel="false" aria-label="查看 ${escAttr(card.name)} 详情">⌕</button></div>`).join('');
  const context = [action, source, note, ...modifiers].filter(Boolean).join('，');
  return `<p class="ov-stats battle-discover-summary"><span class="battle-discover-progress" aria-label="还需发现 ${remaining} 次">${remaining}</span></p>
    <section class="battle-discover-panel" data-battle-discover data-discover-page="${escAttr(pageToken)}" aria-label="${escAttr(context)}">
      <div class="bt-hand battle-discover-options" role="group" aria-label="${escAttr(action)}">${options}</div>
    </section>`;
}