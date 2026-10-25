export const BATTLE_CONSUMED_LABEL = '消耗牌堆';
import { readConsumedPile } from '../bag/battle.consumed-pile.js';
export const consumedPileUids = snapshot => snapshot.consumedPile || readConsumedPile(snapshot);

/* 牌堆视图适配：只负责牌堆徽标 HTML，不参与牌堆逻辑。 */

function renderPileBadge({ className = '', dataAct = '', title = '', count = 0, cardBackHTML = '', suffix = '', cap = '' }, escAttr) {
  const safeTitle = typeof escAttr === 'function' ? escAttr(title) : title;
  // 数量附带牌堆名称；旧动作名仅用于兼容现有点击入口。
  const tag = dataAct ? 'button' : 'span';
  return `<${tag}${dataAct ? ` type="button" data-act="${dataAct}" aria-label="${safeTitle}"` : ''} class="bt-pile${className ? ` ${className}` : ''}"><span class="bt-pilecard" aria-hidden="true">${cardBackHTML}</span>${suffix}<b>${count}</b>${cap ? `<i class="bt-pile-cap">${cap}</i>` : ''}</${tag}>`;
}

function renderCombatPiles({ mode, drawCount, graveCount, pileTip, cardBackHTML, escAttr }) {
  const draw = renderPileBadge({ className:'clickable', dataAct:'btDeck', title:mode === 'boss' ? `牌库：${pileTip(drawCount)}（点击查看）` : `牌库：${drawCount.length} 张（仅抽牌效果取牌，回合开始不抽牌；点击查看）`, count:drawCount.length, cardBackHTML }, escAttr);
  const grave = renderPileBadge({ className:'clickable', dataAct:'btGrave', title:`${BATTLE_CONSUMED_LABEL}：${pileTip(graveCount)}（不自动洗回，仅由卡牌效果取回；点击查看）`, count:graveCount.length, cardBackHTML:`<span class="down">${cardBackHTML}</span>`, suffix:'[[icon:consumed-pile]] ', cap:BATTLE_CONSUMED_LABEL }, escAttr);
  return { draw, rest:grave };
}

export { renderCombatPiles };
