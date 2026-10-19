import { esc, escAttr } from '../core/shared.js';
import '../../css/chest-reward-overview.css';

import { rewardBoxSummary, REWARD_RECEIVED } from './reward-state.js';
import { rewardReturnHTML } from './reward-scene-view.js';

// Art, summary, footer, and picker are rendered HTML supplied by the reward flow.
// This module owns presentation only; opening, claiming, and parking remain commands.
export function chestRewardOverviewHTML({ boxes = [], claimedCards = [], coins = null, source = '', title = '本次收获', summary = '', footer = '', complete = false, primaryAction = null, progress = null, notice = '' } = {}) {
  const received = new Map();
  claimedCards.forEach(card => received.set(card.name, (received.get(card.name) || 0) + 1));
  const receipt = received.size ? `<section class="cqo-receipt" aria-label="本次已入背包"><header class="cqo-receipt-heading"><span class="cqo-receipt-icon" aria-hidden="true">[[icon:bag]]</span><b>${REWARD_RECEIVED} <span class="cqo-receipt-count">${claimedCards.length} 张</span></b><span class="cqo-receipt-destination">本次收获</span></header><ul>${[...received].map(([name, count]) => `<li>${esc(name)} <strong>×${count}</strong></li>`).join('')}</ul></section>` : '';
  const pending = progress?.pending ?? boxes.filter(box => !box.completed).length;
  const total = progress?.total ?? boxes.length;
  const primaryBox = primaryAction && boxes.find(box => box.index === primaryAction.index);
  const nextButton = primaryAction && primaryBox
    ? `<button type="button" class="cqo-button cqo-button-primary" data-act="chestNext" data-i="${escAttr(String(primaryAction.index))}" aria-label="${escAttr(`${primaryAction.label}：${primaryBox.name || '宝箱'}`)}">${esc(primaryAction.label)} <span aria-hidden="true">→</span></button>` : '';
  const actions = complete
    ? '<button type="button" class="cqo-button cqo-button-primary" data-act="chestFinish">继续探索 <span aria-hidden="true">→</span></button>'
    : `<button type="button" class="cqo-button cqo-button-quiet" data-act="chestReturn">返回地图 · 保留奖励</button><button type="button" class="cqo-button" data-act="chestOverviewBag">整理背包</button>${nextButton}`;
  const boxHTML = boxes.map(box => {
    const name = box.name || `宝箱 ${box.index + 1}`;
    const rule = rewardBoxSummary(box);
    const status = box.completed ? '已结束' : (box.takenCount || box.lostCount) ? '领取中' : box.status || (box.completed ? '已收取' : box.opened ? '待领取' : '待开启');
    const action = box.completed ? status : box.actionLabel || (box.opened ? '继续领取' : '打开宝箱');
    return `<button type="button" class="cqo-box${box.completed ? ' cqo-box-complete' : ''}${box.active ? ' cqo-box-active' : ''}" data-act="chestOpen" data-i="${escAttr(String(box.index))}" aria-label="${escAttr(`${name}，${action}`)}" aria-pressed="${box.active ? 'true' : 'false'}"${box.completed ? ' disabled' : ''}>
      <span class="cqo-box-status">${esc(status)}</span>
      <span class="cqo-box-art" aria-hidden="true">${box.art || ''}</span>
      <span class="cqo-box-name">${esc(name)}</span>
      ${rule ? `<span class="cqo-box-rule">${esc(rule)}</span>` : ''}
      ${box.completed ? '' : `<span class="cqo-box-action">${esc(action)} <span aria-hidden="true">↗</span></span>`}
    </button>`;
  }).join('');
  return `<section class="cqo-overview" aria-label="奖励总览">
    <header class="cqo-heading"><div class="cqo-heading-copy">${source ? `<p class="cqo-source">${esc(source)}</p>` : ''}<h3 class="cqo-title">${esc(title)}</h3></div>
      <div class="cqo-progress" aria-label="${escAttr(complete ? '本批奖励已处理完毕' : `${pending} 箱待领，共 ${total} 箱`)}"><b>${esc(String(complete ? total : pending))}</b><span>${complete ? '箱已完成' : '箱待领'}<small>共 ${esc(String(total))} 箱</small></span></div>
    </header>
    <p class="cqo-notice" role="status" aria-live="polite">${esc(notice)}</p>
    ${summary ? `<div class="cqo-summary">${summary}</div>` : ''}
    <div class="cqo-rewards">
      ${coins?.total ? `<section class="cqo-coins" aria-label="金币奖励"><span class="cqo-coin-art" aria-hidden="true">[[icon:coin]]</span><strong>金币</strong><b>待领 ${esc(String(coins.pending || 0))} · 已领 ${esc(String(coins.total - (coins.pending || 0)))}</b>${coins.pending ? '<button type="button" class="cqo-button cqo-button-primary" data-act="chestOverviewCoins">收下金币</button>' : ''}</section>` : ''}
      <div class="cqo-boxes" aria-label="物资箱奖励">${boxHTML || '<p class="cqo-empty">本批没有待领取的宝箱</p>'}</div>
    </div>
    ${receipt}
    <footer class="cqo-footer">
      ${footer ? `<div class="cqo-footer-note">${footer}</div>` : ''}
      <nav class="cqo-actions" aria-label="奖励操作">${actions}</nav>
    </footer>
  </section>`;
}

export function chestRewardFrameHTML({ overview = '', picker = '', label = '宝箱收获' } = {}) {
  return `<div class="cqo-frame reward-replica${picker ? ' cqo-picker-open' : ''}">
    <div class="cqo-background"${picker ? ' inert aria-hidden="true"' : ''}>${overview}</div>
    ${picker ? `<div class="cqp-shade">
      <section class="cqp-dialog" role="dialog" aria-modal="true" aria-label="${escAttr(label)}" tabindex="-1">
        <header class="cqp-toolbar">${rewardReturnHTML({ action:"chestClosePicker", className:"cqp-close", arrow:true })}<span class="cqp-label">${esc(label)}</span></header>
        <div class="cqp-scroll">${picker}</div>
      </section>
    </div>` : ''}
  </div>`;
}
