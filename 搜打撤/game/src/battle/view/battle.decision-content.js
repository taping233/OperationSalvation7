import { esc, escAttr } from '../../core/shared.js';
import { displayCardDescription } from '../../cards/card-description-text.js';
import { battleStartExplanation } from '../../cards/card-battle-start-explanation.js';

export const cardIdentityKey = card => card?.id ? `id:${card.id}` : `legacy:${card?.name || ''}|${card?.type || ''}|${card?.desc || ''}`;

export function pileDetailHTML(stack) {
  if (!stack) return '';
  return `<aside class="battle-decision-inspect" aria-live="polite">
    <span class="battle-decision-inspect-kicker">卡牌规则</span><h4>${esc(stack.card.name)}</h4>
    <p class="battle-decision-inspect-meta">${esc(stack.card.type || '卡牌')} · ${stack.card.cost ?? 0} 费 · ${stack.count} 张</p>
    <p class="battle-decision-inspect-rules">${esc(displayCardDescription(stack.card.desc || '暂无规则描述', stack.card.id))}</p>
    ${battleStartExplanation(stack.card) ? `<p class="ov-note">${esc(battleStartExplanation(stack.card))}</p>` : ''}</aside>`;
}

export function battlePileBodyHTML({ cards, cardHTML, kind, isBoss }) {
  const byName = new Map(), byType = {};
  cards.forEach(entry => {
    const key = cardIdentityKey(entry.card);
    if (!byName.has(key)) byName.set(key, { card:entry.card, count:0 });
    byName.get(key).count++;
    byType[entry.card.type] = (byType[entry.card.type] || 0) + 1;
  });
  const stacks = [...byName.values()];
  const types = Object.entries(byType).sort((a,b) => b[1]-a[1]).map(([type,count]) => `<span>${esc(type)} <b>${count}</b></span>`).join('');
  const grave = kind === 'grave';
  const list = stacks.map((stack, i) => `<button type="button" class="bt-gy-row battle-pile-card${i === 0 ? ' is-inspected' : ''}" data-act="btInspectPile" data-i="${i}" aria-pressed="${i === 0}" aria-label="查看 ${escAttr(stack.card.name)} 的完整规则，${stack.count} 张">${cardHTML(stack.card, 'sm')}${stack.count > 1 ? `<span class="bt-count">×${stack.count}</span>` : ''}</button>`).join('');
  const note = grave ? '打出、弃置或消耗的牌统一进入消耗牌堆；不自动洗回，仅由卡牌效果取回。'
    : isBoss ? '按首脑战规则抽牌；牌库空后不自动洗回消耗牌堆。' : '开局牌库含 99 张初始攻击；开局及回合开始不自动抽牌，仅抽牌效果取牌，库空不补牌。';
  return { stacks, html:`<div class="ov-stats battle-pile-summary"><span>${grave ? '消耗牌堆' : '剩余'} <b>${cards.length}</b> 张</span><div class="battle-pile-types">${types}</div></div>
    <div data-decision-content="pile" class="battle-pile-context"><span>${isBoss ? '首脑战' : '遭遇战'} · 按同一卡牌合并展示</span><span>点击卡牌查看完整规则</span></div>
    ${stacks.length ? `<div class="battle-pile-layout"><div class="bt-gy-list">${list}</div>${pileDetailHTML(stacks[0])}</div>` : `<div class="battle-decision-empty"><b>${grave ? '消耗牌堆为空' : '牌库已空'}</b><p>${grave ? '本场打出、弃置或消耗的牌会显示在这里。' : '本场牌库已抽空，不会自动补牌。'}</p></div>`}
    <div class="ov-btns"><p class="battle-pile-note">${note}</p><button class="ov-btn ok" data-act="${grave ? 'btGraveBack' : 'btDeckBack'}">返回战斗</button></div>` };
}

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
  return `<p class="ov-stats battle-task-summary"><span>还需选择 <b>${handSelecting.n}</b> 张${handSelecting.type ? ` ${esc(handSelecting.type)}` : ''}</span><span class="battle-task-progress">${payment ? `已选 ${selected} 张` : action}</span></p>
    <section data-decision-content="hand-select">${source ? `<p class="battle-decision-source">来自 <b>${esc(source)}</b>${payment ? ` · ${action}` : ''}</p>` : `<p class="battle-decision-source">从当前手牌中选择${payment ? ` · ${action}` : ''}</p>`}
    <div class="bt-hand battle-select-grid">${pool.map((entry,i) => `<div class="battle-select-slot"><button type="button" class="bt-card" data-act="btPickHand" data-uid="${escAttr(entry.uid)}" data-cancel="false" aria-label="选择 ${escAttr(entry.card.name)}">${cardHTML(entry.card,'lg')}<span class="battle-card-action">选择此牌</span></button><button type="button" class="battle-card-inspect" data-act="btDecisionInspect" data-i="${i}" data-cancel="false" aria-label="查看 ${escAttr(entry.card.name)} 详情">查看详情</button></div>`).join('') || '<p class="ov-empty">手牌中没有符合条件的卡牌</p>'}</div>
    <p class="battle-decision-guidance">${payment ? '已选手牌与本次打出的牌不再显示；选满后支付代价。' : '点击选择，选满指定数量后继续结算。'}</p></section>
    ${canCancel ? '<p class="ov-note"><button class="ov-btn ghost" data-act="btPickHandSkip">跳过该效果</button></p>' : ''}`;
}

export function battleDiscoverLifecycleNote({ act, fromDeckBottom }) {
  if (act === 'pouch') return '取出后立即施放，无需另付该法术费用 · 背包原牌随之消耗';
  const origin = fromDeckBottom ? '来自当前牌库底 · 选中牌以本场副本入手' : '本场生成';
  return `${origin}。使用或消耗后进入消耗牌堆，不自动洗回，仅由卡牌效果取回；战后按临时牌规则处理，未用则战后消散。`;
}
