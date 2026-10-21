/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
import { showCardFeedback } from './battle.card-feedback.js';
import { esc } from '../../core/shared.js';

// Read the actual settlement events; drawing an existing deck card is not a new acquisition.
export function cardResultRows(events = []) {
  const rows = [];
  for (const event of events) {
    const kind = event.kind === 'surge' ? 'cast'
      : event.kind === 'shuffle' ? 'deck'
        : event.kind === 'draw' && event.acquired ? (event.source === 'pouch' ? 'pouch' : event.source === 'discover-cast' ? 'discoverCast' : event.source === 'effect-cast' ? 'effectCast' : 'hand') : null;
    if (!kind || !event.name) continue;
    const previous = rows.at(-1);
    if (kind !== 'cast' && previous?.kind === kind) {
      previous.cards.set(event.name, (previous.cards.get(event.name) || 0) + 1);
    } else {
      rows.push({ kind, cards: new Map([[event.name, 1]]), source: event.sourceName || '法力奔涌',
        target: event.targetName || '', shot: event.i, total: event.n });
    }
  }
  return rows;
}

const histories = new WeakMap();

export function showBattleCardResults(stage, events = []) {
  if (!stage) return;
  showCardFeedback(stage, events);
  const overlay = stage.closest('#overlay') || stage.parentElement;
  if (!overlay) return;
  let history = histories.get(overlay);
  if (!history || history.token !== stage._battleToken) {
    /** @type {BattleElement} */ (stage.querySelector('.bt-card-results'))?.remove();
    history = { token: stage._battleToken, rows: [] };
    histories.set(overlay, history);
  }
  const added = cardResultRows(events);
  history.rows.push(...added);
  history.rows = history.rows.slice(-6);
  if (!history.rows.length) return;
  let panel = /** @type {BattleElement} */ (stage.querySelector('.bt-card-results'));
  if (panel && !added.length) return;
  if (!panel) {
    panel = document.createElement('details');
    panel.className = 'bt-card-results';
    panel.setAttribute('role', 'log');
    panel.setAttribute('aria-label', '卡牌获得与释放结果');
    panel.setAttribute('aria-live', 'polite');
    stage.appendChild(panel);
  }
  panel.innerHTML = '<summary>卡牌动态 · ' + history.rows.reduce((n, row) => n + [...row.cards.values()].reduce((a, b) => a + b, 0), 0) + '</summary>' + history.rows.map(row => {
    const label = row.kind === 'cast'
      ? `${row.source} · 随机释放${row.total > 1 ? ` ${row.shot}/${row.total}` : ''}`
      : row.kind === 'pouch' ? '法师锦囊 · 取出施放'
        : row.kind === 'discoverCast' ? '发现卡牌 · 排队施放'
        : row.kind === 'effectCast' ? '效果生成 · 排队施放'
        : row.kind === 'deck' ? '获得卡牌 · 洗入牌库' : '获得卡牌 · 置入手牌';
    const names = [...row.cards].map(([name, count]) => `【${esc(name)}】${count > 1 ? `×${count}` : ''}`).join('、');
    return `<div class="bt-card-result"><b>${esc(label)}</b><span>${names}${row.target ? ` → ${esc(row.target)}` : ''}</span></div>`;
  }).join('');
  panel.scrollTop = panel.scrollHeight;
}
