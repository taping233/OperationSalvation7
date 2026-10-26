import { esc, escAttr } from '../../core/shared.js';
export { battlePileBodyHTML } from './battle.pile-view.js';

export const cardIdentityKey = card => card?.id ? `id:${card.id}` : `legacy:${card?.name || ''}|${card?.type || ''}|${card?.desc || ''}`;

export function battleChoiceBodyHTML(choosing) {
  return `<p class="ov-stats battle-task-summary"><span>选择 <b>1</b> 项效果</span><span class="battle-task-progress">${choosing.options.length} 项可选</span></p>
    <section data-decision-content="choice"><p class="battle-decision-source">来自 <b>${esc(choosing.cardName)}</b></p>
    <div class="ov-btns choice-list">${choosing.options.map((text,i) => `<button type="button" class="ov-btn choice-opt" data-act="btChoicePick" data-i="${i}" data-cancel="false"><span class="battle-option-index">${String(i+1).padStart(2,'0')}</span><span class="battle-option-text">${esc(text)}</span><span class="battle-option-action">选择此项 <span aria-hidden="true">→</span></span></button>`).join('')}</div>
    <p class="battle-decision-guidance">选中后立即结算该项效果。</p></section>`;
}

export function battleHandSelectBodyHTML({ pool, handSelecting, cardHTML }) {
  const payment = handSelecting.act === 'payment';
  const canCancel = handSelecting.canCancel ?? !handSelecting.mandatory;
  const action = {play:'免费打出', copy:'复制，原牌保留', zero:'下回合零费，原牌保留', payment:'作为支付代价消耗'}[handSelecting.act] || '消耗';
  const selected = handSelecting.selectedUids?.length || 0;
  const source = payment ? handSelecting.payment?.card?.name : handSelecting.sourceCardName;
  // 2026-10-21 老板反馈 #7：同名候选合并为一张展示（尾挂 ×N），每次点击仍消耗
  // 一个实际 UID；重渲染后剩余同名副本以 ×(N-1) 继续显示。查看详情沿用组内
  // 首张在原 pool 中的下标，检查器的 cards 映射（pool.map(card)）保持不变。
  const groups = new Map();
  pool.forEach((entry, index) => {
    const key = cardIdentityKey(entry.card);
    const hit = groups.get(key);
    if (hit) hit.count += 1;
    else groups.set(key, { entry, index, count: 1 });
  });
  const grid = [...groups.entries()].map(([key, { entry, index, count }]) =>
    `<div class="battle-select-slot"><button type="button" class="bt-card" data-act="btPickHand" data-uid="${escAttr(entry.uid)}" data-card-key="${escAttr(key)}" data-cancel="false" aria-label="选择 ${escAttr(entry.card.name)}${count > 1 ? `，同名 ${count} 张` : ''}">${cardHTML(entry.card,'lg')}${count > 1 ? `<span class="bt-count">×${count}</span>` : ''}<span class="battle-card-action">选择此牌</span></button><button type="button" class="battle-card-inspect" data-act="btDecisionInspect" data-i="${index}" data-card-key="${escAttr(key)}" data-cancel="false" aria-label="查看 ${escAttr(entry.card.name)} 详情">查看详情</button></div>`).join('');
  return `<p class="ov-stats battle-task-summary"><span>还需选择 <b>${handSelecting.n}</b> 张${handSelecting.type ? ` ${esc(handSelecting.type)}` : ''}</span><span class="battle-task-progress">${payment ? `已选 ${selected} 张` : action}</span></p>
    <section data-decision-content="hand-select">${source ? `<p class="battle-decision-source">来自 <b>${esc(source)}</b>${payment ? ` · ${action}` : ''}</p>` : `<p class="battle-decision-source">从当前手牌中选择${payment ? ` · ${action}` : ''}</p>`}
    <div class="bt-hand battle-select-grid" data-selection-scroll>${grid || '<p class="ov-empty">手牌中没有符合条件的卡牌</p>'}</div>
    <p class="battle-decision-guidance">${payment ? '已选手牌与本次打出的牌不再显示；选满后支付代价。' : '点击选择，选满指定数量后继续结算。'}</p></section>
    ${canCancel ? '<p class="ov-note"><button class="ov-btn ghost" data-act="btPickHandSkip">跳过该效果</button></p>' : ''}`;
}

/** @param {{act?: unknown, fromDeckBottom?: unknown, isBoss?: boolean}} options */
export function battleDiscoverLifecycleNote({ act, fromDeckBottom }) {
  if (act === 'pouch') return '取出后立即施放，无需另付该法术费用 · 背包原牌随之消耗';
  const origin = fromDeckBottom ? '来自当前牌库底 · 选中牌以本场副本入手' : '本场生成';
  return `${origin}。使用或消耗后进入消耗牌堆，不自动洗回，仅由卡牌效果取回；战后按临时牌规则处理，未用则战后消散。`;
}
