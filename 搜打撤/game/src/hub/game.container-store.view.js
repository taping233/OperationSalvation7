import '../../css/battle-decision.css';
import '../../css/container-store.css';
import { esc, escAttr } from '../core/shared.js';

// Shared presentation for the two actual backpack containers. Transfers remain caller-owned.
export function containerStoreHTML({ title, icon, prefix, count, cap, stored, available, type, cardHTML, reason, help }) {
  let index = 0;
  const cards = (stacks, take) => stacks.map(st => {
    const i = index++, action = take ? '整叠取出' : '整叠存入';
    const blocked = reason(st, take, count, cap);
    return `<div class="container-store-slot">
      <button type="button" class="bt-card pearl-store-card" data-act="${prefix}${take ? 'Take' : 'Put'}" data-name="${escAttr(st.card.name)}" ${blocked ? 'disabled' : ''}
        aria-label="${escAttr(`${st.card.name}，${st.count} 张，${action}${take ? '回背包' : title}${blocked ? `，${blocked}` : ''}`)}">
        <span class="pearl-store-art" aria-hidden="true">${cardHTML(st.card, 'sm')}</span>
        <span class="pearl-store-caption"><span>${action} · ${st.count} 张</span></span></button>
      ${blocked ? `<p class="container-store-blocked">${esc(blocked)}</p>` : ''}
      <button type="button" class="battle-card-inspect" data-act="${prefix}Inspect" data-i="${i}" data-name="${escAttr(st.card.name)}" aria-label="查看${escAttr(st.card.name)}详情">查看详情</button>
    </div>`;
  }).join('') || `<p class="ov-empty">${take ? `${title}是空的` : `背包里没有${type}卡`}</p>`;
  return `<section class="battle-decision battle-decision-unified pearl-store container-store" data-decision-kind="${prefix}-store">
    <header class="battle-decision-head"><div class="container-store-title"><h3>[[icon:${icon}]] ${title}</h3></div><span class="container-store-capacity" role="status" aria-live="polite"><b>${count}</b><span>/ ${cap}</span><i aria-hidden="true" style="--store-fill:${Math.min(100, count / Math.max(1, cap) * 100)}%"></i></span></header>
    <div class="battle-decision-summary"><p class="ov-note">整叠存取 · 存入后不占背包格</p></div>
    <div class="battle-decision-content pearl-store-columns">
      <section><header class="container-column-head"><h4>${title}中</h4></header><div class="pearl-store-list">${cards(stored, true)}</div></section>
      <section><header class="container-column-head"><h4>随身背包</h4></header><div class="pearl-store-list">${cards(available, false)}</div></section>
    </div>
    <footer class="battle-decision-actions"><details class="container-store-help"><summary>收纳说明</summary><p>${esc(help)}</p></details>
      <div class="ov-btns"><button type="button" class="ov-btn ok" data-act="${prefix}Back" data-cancel="true" aria-label="收好${title}，返回背包">[[icon:arrow]] 返回背包</button></div></footer>
  </section>`;
}

export function captureContainerView(root) {
  if (!root) return null;
  const active = root.contains(document.activeElement) ? document.activeElement : null;
  return {
    focused: active ? { .../** @type {HTMLElement} */ (active).dataset, summary: active.tagName === 'SUMMARY' } : null,
    helpOpen: !!root.querySelector('details')?.open,
    scroll: [root.parentElement, ...root.querySelectorAll('.battle-decision-content, .pearl-store-list')]
      .map(el => ({ top: el.scrollTop, left: el.scrollLeft })),
  };
}

export function restoreContainerFocus(root, state, back) {
  root?.querySelectorAll('.pearl-store-art [tabindex]').forEach(el => el.removeAttribute('tabindex'));
  if (!state || !root) return;
  const help = root.querySelector('details');
  if (help) help.open = state.helpOpen;
  [root.parentElement, ...root.querySelectorAll('.battle-decision-content, .pearl-store-list')].forEach((el, i) => {
    if (state.scroll[i]) { el.scrollTop = state.scroll[i].top; el.scrollLeft = state.scroll[i].left; }
  });
  const focused = state.focused;
  if (!focused) return;
  if (focused.summary) { help?.querySelector('summary')?.focus({ preventScroll:true }); return; }
  const buttons = [...root.querySelectorAll('button[data-act]:not(:disabled)')];
  (buttons.find(b => b.dataset.act === focused.act && b.dataset.name === focused.name)
    || buttons.find(b => b.dataset.act === focused.act) || buttons.find(b => b.dataset.act === back))?.focus({ preventScroll: true });
}
