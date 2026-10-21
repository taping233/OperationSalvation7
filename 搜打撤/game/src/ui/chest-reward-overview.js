import { esc, escAttr } from '../core/shared.js';
import '../../css/chest-reward-overview.css';

import { rewardBoxSummary } from './reward-state.js';
import { rewardReturnHTML } from './reward-scene-view.js';

// Art, summary, footer, and picker are rendered HTML supplied by the reward flow.
// This module owns presentation only; opening, claiming, and parking remain commands.
export function chestRewardOverviewHTML({ boxes = [], coins = null, source = '', title = '本次收获', summary = '', footer = '', complete = false, primaryAction = null, notice = '' } = {}) {
  const primaryBox = primaryAction && boxes.find(box => box.index === primaryAction.index);
  const nextButton = primaryAction && primaryBox
    ? `<button type="button" class="cqo-button cqo-button-primary" data-act="chestNext" data-i="${escAttr(String(primaryAction.index))}" aria-label="${escAttr(`${primaryAction.label}：${primaryBox.name || '宝箱'}`)}">${esc(primaryAction.label)} <span aria-hidden="true">→</span></button>` : '';
  const actions = complete
    ? '<button type="button" class="cqo-button cqo-button-primary" data-act="chestFinish">继续探索 <span aria-hidden="true">→</span></button>'
    : `<button type="button" class="cqo-button cqo-button-quiet" data-act="chestReturn">返回地图</button><button type="button" class="cqo-button" data-act="chestOverviewBag">整理背包</button>${nextButton}`;
  const boxHTML = boxes.map(box => {
    const name = box.name || `宝箱 ${box.index + 1}`;
    const rule = rewardBoxSummary(box);
    const status = box.completed ? '已结束' : (box.takenCount || box.lostCount) ? '领取中' : box.status || (box.completed ? '已收取' : box.opened ? '待领取' : '待开启');
    const action = box.completed ? status : box.actionLabel || (box.opened ? '继续领取' : '打开宝箱');
    return `<button type="button" class="cqo-box${box.completed ? ' cqo-box-complete' : ''}${box.active ? ' cqo-box-active' : ''}" data-act="chestOpen" data-i="${escAttr(String(box.index))}" data-claim-mode="${box.choice ? 'one' : 'all'}" aria-label="${escAttr(`${name}，${box.choice ? '只选一张' : '全部可领'}，${action}`)}" aria-pressed="${box.active ? 'true' : 'false'}"${box.completed ? ' disabled' : ''}>
      <span class="cqo-box-status">${esc(status)}</span>
      <span class="cqo-box-mode"><b aria-hidden="true">${!box.completed && box.choice ? '1' : '✓'}</b>${box.completed ? '已处理' : box.choice ? '只选一张' : '全部可领'}</span>
      <span class="cqo-box-art" aria-hidden="true">${box.art || ''}</span>
      <span class="cqo-box-name">${esc(name)}</span>
      ${rule ? `<span class="cqo-box-rule">${esc(rule)}</span>` : ''}
      ${box.completed || (boxes.length === 1 && nextButton) ? '' : `<span class="cqo-box-action">${esc(action)} <span aria-hidden="true">↗</span></span>`}
    </button>`;
  }).join('');
  return `<section class="cqo-overview" aria-label="奖励总览">
    <div class="cqo-intro"><header class="cqo-heading"><div class="cqo-heading-copy">${source ? `<p class="cqo-source">${esc(source)}</p>` : ''}<h3 class="cqo-title">${esc(title)}</h3></div>
    </header>
    <p class="cqo-notice" role="status" aria-live="polite">${esc(notice)}</p>
    ${summary ? `<div class="cqo-summary">${summary}</div>` : ''}</div>
    <div class="cqo-rewards">
      ${coins?.total ? `<section class="cqo-coins" aria-label="金币奖励"><span class="cqo-coin-art" aria-hidden="true">[[icon:coin]]</span><strong>金币</strong><b>${coins.pending ? `待领 ${esc(String(coins.pending))} · 已领 ${esc(String(coins.total - coins.pending))}` : `已收下 ${esc(String(coins.total))}`}</b>${coins.pending ? '<button type="button" class="cqo-button cqo-button-primary" data-act="chestOverviewCoins">收下金币</button>' : ''}</section>` : ''}
      <div class="cqo-boxes" aria-label="物资箱奖励">${boxHTML || '<p class="cqo-empty">本批没有待领取的宝箱</p>'}</div>
    </div>
    <footer class="cqo-footer">
      ${footer ? `<div class="cqo-footer-note">${footer}</div>` : ''}
      <nav class="cqo-actions" aria-label="奖励操作">${actions}</nav>
    </footer>
  </section>`;
}

export function chestRewardFrameHTML({ overview = '', picker = '', label = '宝箱收获' } = {}) {
  return `<div class="cqo-frame reward-replica ui-design-system${picker ? ' cqo-picker-open' : ''}">
    <div class="cqo-background"${picker ? ' inert aria-hidden="true"' : ''}>${overview}</div>
    ${picker ? `<div class="cqp-shade">
      <section class="cqp-dialog" role="dialog" aria-modal="true" aria-label="${escAttr(label)}" tabindex="-1">
        <header class="cqp-toolbar">${rewardReturnHTML({ action:"chestClosePicker", className:"cqp-close", arrow:true })}<span class="cqp-label">${esc(label)}</span></header>
        <div class="cqp-scroll">${picker}</div>
      </section>
    </div>` : ''}
  </div>`;
}
