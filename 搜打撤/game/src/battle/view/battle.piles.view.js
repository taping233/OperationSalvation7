export const BATTLE_CONSUMED_LABEL = '本场消耗牌堆';
export const consumedPileUids = snapshot => snapshot.mode === 'boss' ? snapshot.grave : (snapshot.consumed || []);

/* 牌堆视图适配：只负责牌堆徽标 HTML，不参与牌堆逻辑。 */

function renderPileBadge({ className = '', dataAct = '', title = '', count = 0, cardBackHTML = '', suffix = '', cap = '' }, escAttr) {
  const safeTitle = typeof escAttr === 'function' ? escAttr(title) : title;
  // 09-25 二波美术：数值后补小字归属标签（牌库/弃牌/消耗），让三徽章不再靠猜
  const tag = dataAct ? 'button' : 'span';
  return `<${tag}${dataAct ? ` type="button" data-act="${dataAct}" aria-label="${safeTitle}"` : ''} class="bt-pile${className ? ` ${className}` : ''}" title="${safeTitle}"><span class="bt-pilecard">${cardBackHTML}</span>${suffix}<b>${count}</b>${cap ? `<i class="bt-pile-cap">${cap}</i>` : ''}</${tag}>`;
}

function renderCombatPiles({ mode, drawCount, discardCount, graveCount, pileTip, cardBackHTML, escAttr }) {
  // Ordinary battles expose the real per-battle consumed ledger without inventing
  // a cycling deck/grave rule. The empty pile remains inspectable from turn one.
  if (mode !== 'boss') {
    const grave = renderPileBadge({ className:'clickable', dataAct:'btGrave', title:`${BATTLE_CONSUMED_LABEL}：${pileTip(graveCount)}（点击查看；战后进入消耗区，道具、装备不可在火堆复原）`, count:graveCount.length, cardBackHTML:`<span class="down">${cardBackHTML}</span>`, suffix:'[[icon:skull]] ', cap:'本场消耗' }, escAttr);
    return { draw:'', rest:grave };
  }
  // 牌库徽标可点击查看（2026-09-13 留言：点击应该能看牌库和墓地中的卡牌）
  const draw = renderPileBadge({ className: 'clickable', dataAct: 'btDeck', title: `牌库：${pileTip(drawCount)}（点击查看）`, count: drawCount.length, cardBackHTML, cap: '牌库' }, escAttr);
  const discard = renderPileBadge({ className: '', title: `弃牌堆：${pileTip(discardCount)}（牌库抽空后自动洗回）`, count: discardCount.length, cardBackHTML: `<span class="down">${cardBackHTML}</span>`, cap: '弃牌' }, escAttr);
  const grave = renderPileBadge({ className: 'clickable', dataAct: 'btGrave', title: `${BATTLE_CONSUMED_LABEL}：${pileTip(graveCount)}（被消耗的牌 · 不参与洗回 · 点击查看）`, count: graveCount.length, cardBackHTML: `<span class="down">${cardBackHTML}</span>`, suffix: '[[icon:skull]] ', cap: '本场消耗' }, escAttr);
  return { draw, rest: `${discard}${grave}` };
}

export { renderCombatPiles };
