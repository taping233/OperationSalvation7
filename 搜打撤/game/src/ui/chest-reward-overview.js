import { esc, escAttr } from '../core/shared.js';
import '../../css/chest-reward-overview.css';
import { illustratedChoiceContent, illustratedNodeLayout } from './illustrated-node.js';

import { rewardBoxSummary } from './reward-state.js';
import { rewardReturnHTML } from './reward-scene-view.js';
import { roomFooterHTML } from './room-footer.js';

// Art, summary, footer, and picker are rendered HTML supplied by the reward flow.
// This module owns presentation only; opening, claiming, and parking remain commands.
export function chestRewardOverviewHTML({ boxes = [], coins = null, source = '', title = '本次收获', footer = '', complete = false, primaryAction = null, notice = '' } = {}) {
  const primaryBox = primaryAction && boxes.find(box => box.index === primaryAction.index);
  const nextButton = primaryAction && primaryBox
    ? `<button type="button" class="cqo-button cqo-button-primary" data-act="chestNext" data-i="${escAttr(String(primaryAction.index))}" aria-label="${escAttr(`${primaryAction.label}：${primaryBox.name || '宝箱'}`)}">${esc(primaryAction.label)} <span aria-hidden="true">→</span></button>` : '';
  const actions = complete
    ? '<button type="button" class="cqo-button cqo-button-primary" data-act="chestFinish">继续探索 <span aria-hidden="true">→</span></button>'
    : `<button type="button" class="cqo-button cqo-button-quiet" data-act="chestReturn" aria-description="未领取的奖励将暂存">返回地图</button><button type="button" class="cqo-button" data-act="chestOverviewBag">整理背包</button>${boxes.length === 1 ? '' : nextButton}`;
  const pending = boxes.filter(box => !box.completed).length;
  const boxHTML = boxes.map(box => {
    const name = box.name || `宝箱 ${box.index + 1}`;
    const rule = rewardBoxSummary(box);
    const status = box.completed ? '已结束' : (box.takenCount || box.lostCount) ? '领取中' : box.status || (box.completed ? '已收取' : box.opened ? '待领取' : '待开启');
    const action = box.completed ? status : box.actionLabel || (box.opened ? '继续领取' : '打开宝箱');
    return `<button type="button" class="illustrated-choice cqo-box${box.completed ? ' cqo-box-complete' : ''}${box.active ? ' cqo-box-active' : ''}" data-act="chestOpen" data-i="${escAttr(String(box.index))}" data-claim-mode="${box.choice ? 'one' : 'all'}" aria-label="${escAttr(`${name}，${box.choice ? '只选一张' : '全部可领'}，${action}`)}" aria-pressed="${box.active ? 'true' : 'false'}"${box.completed ? ' disabled' : ''}>
      ${illustratedChoiceContent({label:name,labelClass:'cqo-box-name',detailClass:'cqo-box-rule',art:box.choice ? 'cards' : 'chest',detail:`${esc(rule)}<span class="cqo-box-action">${esc(action)}</span>`})}
    </button>`;
  }).join('');
  const story = `<div class="cqo-intro"><header class="cqo-heading" aria-label="${escAttr(`${title}，${pending} 个宝箱待领取`)}"><div class="cqo-heading-copy"><h3 class="cqo-title">${esc(title)}</h3>${source ? `<p class="cqo-source">${esc(source)}</p>` : ''}</div>
    </header>
    <p class="cqo-notice" role="status" aria-live="polite">${esc(notice)}</p>
    </div>`;
  const content = `<div class="cqo-rewards">
      ${coins?.total ? `<section class="cqo-coins" aria-label="金币奖励"><span class="cqo-coin-art" aria-hidden="true">[[icon:coin]]</span><b>×${esc(String(coins.pending || coins.total))}</b>${coins.pending ? '<button type="button" class="cqo-button" data-act="chestOverviewCoins">收下</button>' : '<span>✓</span>'}</section>` : ''}
      <div class="cqo-boxes" aria-label="物资箱奖励">${boxHTML || '<p class="cqo-empty">本批没有待领取的宝箱</p>'}</div>
    </div>`;
  const foot = `${roomFooterHTML({ className:'cqo-footer', info:footer ? `<div class="cqo-footer-note">${footer}</div>` : '', actions:`<nav class="cqo-actions" aria-label="奖励操作">${actions}</nav>` })}`;
  return `<section class="cqo-overview illustrated-node" aria-label="奖励总览">${illustratedNodeLayout({story,content,footer:foot})}</section>`;
}

export function chestRewardFrameHTML({ overview = '', picker = '', label = '宝箱收获' } = {}) {
  return `<div class="cqo-frame reward-replica ui-design-system${picker ? ' cqo-picker-open' : ''}">
    <div class="cqo-background"${picker ? ' inert aria-hidden="true"' : ''}>${overview}</div>
    ${picker ? `<div class="cqp-shade">
      <section class="cqp-dialog" role="dialog" aria-modal="true" aria-label="${escAttr(label)}" tabindex="-1">
        <header class="cqp-toolbar">${rewardReturnHTML({ action:"chestClosePicker", className:"cqp-close", arrow:true })}</header>
        <div class="cqp-scroll">${picker}</div>
      </section>
    </div>` : ''}
  </div>`;
}

// Update the current overview without replacing its frame, scrollport or box art.
// Opening/closing a picker remains a full surface transition owned by the caller.
export function patchChestRewardOverview(host, html) {
  const frame = host?.querySelector(':scope > .cqo-frame:not(.cqo-picker-open)');
  const current = frame?.querySelector('.cqo-overview');
  if (!current) return false;
  const template = document.createElement('template');
  template.innerHTML = html;
  const next = template.content.querySelector('.cqo-frame:not(.cqo-picker-open) .cqo-overview');
  const boxes = current.querySelector('.cqo-boxes'), freshBoxes = next?.querySelector('.cqo-boxes');
  const rewards = current.querySelector('.cqo-rewards'), freshRewards = next?.querySelector('.cqo-rewards');
  if (!next || !boxes || !freshBoxes || !rewards || !freshRewards) return false;
  const existing = new Map([...boxes.children].map(box => [box.getAttribute('data-i'), box]));
  const incoming = [...freshBoxes.children];
  const ordered = incoming.map(fresh => {
    const key = fresh.getAttribute('data-i');
    const box = key === null ? null : existing.get(key);
    if (!box) return fresh;
    for (const name of ['class', 'aria-label', 'aria-pressed', 'disabled', 'data-claim-mode']) {
      const value = fresh.getAttribute(name);
      if (value === null) box.removeAttribute(name);
      else if (box.getAttribute(name) !== value) box.setAttribute(name, value);
    }
    const parts = new Map([...box.children].map(part => [part.className, part]));
    const kept = [...fresh.children].map(part => {
      const live = parts.get(part.className);
      if (!live) return part;
      if (live.innerHTML !== part.innerHTML) live.innerHTML = part.innerHTML;
      return live;
    });
    const keep = new Set(kept);
    [...box.children].forEach(part => { if (!keep.has(part)) part.remove(); });
    kept.forEach((part, index) => {
      if (box.children[index] !== part) box.insertBefore(part, box.children[index] || null);
    });
    return box;
  });
  const keep = new Set(ordered);
  [...boxes.children].forEach(box => { if (!keep.has(box)) box.remove(); });
  ordered.forEach((box, index) => {
    if (boxes.children[index] !== box) boxes.insertBefore(box, boxes.children[index] || null);
  });
  const coins = rewards.querySelector('.cqo-coins'), freshCoins = freshRewards.querySelector('.cqo-coins');
  if (coins && freshCoins) {
    if (coins.innerHTML !== freshCoins.innerHTML) coins.innerHTML = freshCoins.innerHTML;
  } else if (coins) coins.remove();
  else if (freshCoins) rewards.insertBefore(freshCoins, boxes);
  for (const selector of ['.cqo-intro', '.cqo-footer']) {
    const live = current.querySelector(selector), fresh = next.querySelector(selector);
    if (live && fresh) {
      if (live.innerHTML !== fresh.innerHTML) live.innerHTML = fresh.innerHTML;
    } else if (live) live.remove();
    else if (fresh) (current.querySelector(selector === '.cqo-intro' ? '.event-story' : '.node-foot') || current).append(fresh);
  }
  return true;
}
