/* 牌堆视图适配：只负责牌堆徽标 HTML，不参与牌堆逻辑。 */

function renderPileBadge({ className = '', dataAct = '', title = '', count = 0, cardBackHTML = '', suffix = '', cap = '' }, escAttr) {
  const safeTitle = typeof escAttr === 'function' ? escAttr(title) : title;
  // 09-25 二波美术：数值后补小字归属标签（牌库/弃牌/消耗），让三徽章不再靠猜
  return `<span${dataAct ? ` data-act="${dataAct}"` : ''} class="bt-pile${className ? ` ${className}` : ''}" title="${safeTitle}"><span class="bt-pilecard">${cardBackHTML}</span>${suffix}<b>${count}</b>${cap ? `<i class="bt-pile-cap">${cap}</i>` : ''}</span>`;
}

function renderCombatPiles({ mode, drawCount, discardCount, graveCount, pileTip, cardBackHTML, escAttr }) {
  // 09-25 P1：普通战斗此前返回空串，牌库/弃牌/墓地入口整体不渲染——改为渲染只读计数徽章，
  // 复用 boss 版结构但去掉 clickable/data-act（牌库与墓地查看仅 boss 牌库制开放），样式类保持一致
  if (mode !== 'boss') {
    const draw = renderPileBadge({ title: `牌库：普通战斗不使用牌库（「抽 N 张牌」改为获得初始攻击）`, count: drawCount.length, cardBackHTML, cap: '牌库' }, escAttr);
    const discard = renderPileBadge({ title: `弃牌堆：${pileTip(discardCount)}`, count: discardCount.length, cardBackHTML: `<span class="down">${cardBackHTML}</span>`, cap: '弃牌' }, escAttr);
    const grave = renderPileBadge({ title: `墓地：被消耗的牌战后进消耗口袋，可在火堆复原`, count: graveCount.length, cardBackHTML: `<span class="down">${cardBackHTML}</span>`, suffix: '[[icon:skull]] ', cap: '消耗' }, escAttr);
    return { draw, rest: `${discard}${grave}` };
  }
  // 牌库徽标可点击查看（2026-09-13 留言：点击应该能看牌库和墓地中的卡牌）
  const draw = renderPileBadge({ className: 'clickable', dataAct: 'btDeck', title: `牌库：${pileTip(drawCount)}（点击查看）`, count: drawCount.length, cardBackHTML, cap: '牌库' }, escAttr);
  const discard = renderPileBadge({ className: '', title: `弃牌堆：${pileTip(discardCount)}（牌库抽空后自动洗回）`, count: discardCount.length, cardBackHTML: `<span class="down">${cardBackHTML}</span>`, cap: '弃牌' }, escAttr);
  const grave = renderPileBadge({ className: 'clickable', dataAct: 'btGrave', title: `墓地：${pileTip(graveCount)}（被消耗的牌 · 不参与洗回 · 点击查看）`, count: graveCount.length, cardBackHTML: `<span class="down">${cardBackHTML}</span>`, suffix: '[[icon:skull]] ', cap: '消耗' }, escAttr);
  return { draw, rest: `${discard}${grave}` };
}

export { renderCombatPiles, renderPileBadge };
