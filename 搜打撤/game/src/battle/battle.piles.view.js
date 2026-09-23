/* 牌堆视图适配：只负责牌堆徽标 HTML，不参与牌堆逻辑。 */

function renderPileBadge({ className = '', dataAct = '', title = '', count = 0, cardBackHTML = '', suffix = '' }, escAttr) {
  const safeTitle = typeof escAttr === 'function' ? escAttr(title) : title;
  return `<span${dataAct ? ` data-act="${dataAct}"` : ''} class="bt-pile${className ? ` ${className}` : ''}" title="${safeTitle}"><span class="bt-pilecard">${cardBackHTML}</span>${suffix}<b>${count}</b></span>`;
}

function renderCombatPiles({ mode, drawCount, discardCount, graveCount, pileTip, cardBackHTML, escAttr }) {
  if (mode !== 'boss') return { draw: '', rest: '' };
  // 牌库徽标可点击查看（2026-09-13 留言：点击应该能看牌库和墓地中的卡牌）
  const draw = renderPileBadge({ className: 'clickable', dataAct: 'btDeck', title: `牌库：${pileTip(drawCount)}（点击查看）`, count: drawCount.length, cardBackHTML }, escAttr);
  const discard = renderPileBadge({ className: '', title: `弃牌堆：${pileTip(discardCount)}（牌库抽空后自动洗回）`, count: discardCount.length, cardBackHTML: `<span class="down">${cardBackHTML}</span>` }, escAttr);
  const grave = renderPileBadge({ className: 'clickable', dataAct: 'btGrave', title: `墓地：${pileTip(graveCount)}（被消耗的牌 · 不参与洗回 · 点击查看）`, count: graveCount.length, cardBackHTML: `<span class="down">${cardBackHTML}</span>`, suffix: '[[icon:skull]] ' }, escAttr);
  return { draw, rest: `${discard}${grave}` };
}

export { renderCombatPiles, renderPileBadge };
