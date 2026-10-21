// @ts-check
/** @typedef {import('../battle.snapshot.types.js').SnapshotBattleCard} PileCard */
/** @typedef {{ readonly uid: string, readonly card: PileCard }} PileEntry */
/** @typedef {{ key: string, card: PileCard, count: number, uids: string[] }} PileStack */
import { escAttr } from '../../core/shared.js';
import '../../../css/battle-pile-view.css';

// Include effective data so instances with different costs, rules or upgrades stay separate.
/** @param {PileCard} card */
function pileCardKey(card) {
  return JSON.stringify(card, (_key, value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
  });
}

/** @param {readonly PileEntry[]} cards @returns {PileStack[]} */
export function buildPileStacks(cards) {
  /** @type {Map<string, PileStack>} */
  const grouped = new Map();
  for (const entry of cards) {
    const key = pileCardKey(entry.card);
    let stack = grouped.get(key);
    if (!stack) {
      stack = { key, card:entry.card, count:0, uids:[] };
      grouped.set(key, stack);
    }
    stack.count++;
    stack.uids.push(entry.uid);
  }
  // This copied display list never follows or mutates the hidden draw order.
  return [...grouped.values()].sort((a, b) =>
    (a.card.name || '').localeCompare(b.card.name || '', 'zh-CN') ||
    (a.card.type || '').localeCompare(b.card.type || '', 'zh-CN') ||
    (a.card.cost ?? 0) - (b.card.cost ?? 0) ||
    (a.card.id || '').localeCompare(b.card.id || '') || a.key.localeCompare(b.key));
}

/**
 * @param {{ cards: readonly PileEntry[], cardHTML: (card: PileCard, size: string) => string,
 * kind: string, isBoss?: boolean }} options
 */
export function battlePileBodyHTML({ cards, cardHTML, kind }) {
  const stacks = buildPileStacks(cards);
  const grave = kind === 'grave';
  const list = stacks.map((stack, i) => `<button type="button" class="battle-pile-card" data-act="btDecisionInspect" data-i="${i}" aria-label="查看 ${escAttr(stack.card.name || '卡牌')}，${stack.count} 张">${cardHTML(stack.card, 'lg')}${stack.count > 1 ? `<span class="battle-pile-count">×${stack.count}</span>` : ''}</button>`).join('');
  return { stacks, html:`<section data-decision-content="pile" data-battle-pile-view data-pile-total="${cards.length}">
    ${stacks.length ? `<div class="battle-pile-grid">${list}</div>` : `<div class="battle-pile-empty"><b>${grave ? '消耗牌堆为空' : '牌库已空'}</b></div>`}
    </section><div class="ov-btns"><button type="button" class="ov-btn ok battle-pile-back" data-act="${grave ? 'btGraveBack' : 'btDeckBack'}">返回战斗</button></div>` };
}
