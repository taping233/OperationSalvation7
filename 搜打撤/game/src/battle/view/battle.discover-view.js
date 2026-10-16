import { esc, escAttr } from '../../core/shared.js';
import '../../../css/battle-discover.css';

// Presentation only. Candidate identity, order and selection effects stay in the battle flow.
export function battleDiscoverBodyHTML({ candidates, cardHTML, action, remaining, source = '', note = '', modifiers = [], pageToken = '' }) {
  const options = candidates.map(({ card, sourceNote = '', equipmentNote = '' }, index) => `
    <button type="button" class="bt-card battle-discover-card" data-act="btDiscover" data-i="${index}" data-discover-page="${escAttr(pageToken)}" data-cancel="false"
      aria-label="${escAttr(`${card.name}，${action}${sourceNote ? `，${sourceNote}` : ''}`)}">
      ${cardHTML(card, 'lg')}
      <span class="battle-discover-card-caption"><span class="battle-discover-index">${String(index + 1).padStart(2, '0')}</span>${sourceNote ? `<span class="battle-discover-card-source">${esc(sourceNote)}</span>` : ''}<span class="battle-discover-pick-mark" aria-hidden="true">↗</span></span>
      ${equipmentNote ? `<span class="battle-discover-equipment-note">${esc(equipmentNote)}</span>` : ''}
    </button>`).join('');
  const rules = [note, ...modifiers].filter(Boolean).join(' · ');
  return `<p class="ov-stats battle-discover-summary"><span>${esc(action)}</span><span class="battle-discover-progress" aria-label="还需发现 ${remaining} 次">剩余 <b>${remaining}</b> 次</span></p>
    <section class="battle-discover-panel" data-battle-discover data-discover-page="${escAttr(pageToken)}">
      <div class="battle-discover-meta">${source ? `<span class="battle-discover-source">来自 ${esc(source)}</span>` : ''}<span class="battle-discover-count">${candidates.length} 张候选</span></div>
      <div class="bt-hand battle-discover-options" role="group" aria-label="${escAttr(action)}">${options}</div>
      ${rules ? `<p class="battle-discover-rules">${esc(rules)}</p>` : ''}
    </section>`;
}
