import { esc } from '../core/shared.js';
import '../../css/base-reward-feedback.css';

const receipts = new WeakMap();
const bound = new WeakSet();
const delegates = new WeakSet();
const eventSnapshots = new WeakMap();
let activeReceipt;
let receiptEscBound = false;
const claimed = (meta, action, id) => action === 'claimAch' ? meta.isClaimed(id) : meta.isCollClaimed(id);

function currentCapacityFact(base, meta, cards, action, id) {
  const room = base.stashRoom?.();
  // A verified present card requires at least one slot. Do not reconstruct
  // random selection or infer a larger batch's exact demand.
  if (!Number.isFinite(room) || room !== 0) return '';
  const catalog = cards.all?.();
  if (!Array.isArray(catalog)) return '';
  let needsCard = false;
  if (action === 'claimAch') {
    const achievement = meta.ACHIEVEMENTS.find(item => item.id === id);
    if (achievement && meta.isUnlocked?.(achievement) === true) {
      needsCard = !!achievement.reward?.card && catalog.some(card => card.id === achievement.reward.card);
    }
  } else {
    const milestone = meta.COLL_MILESTONES.find(item => item.id === id);
    if (milestone && meta.collMsReached?.(milestone) === true) {
      needsCard = (!!milestone.reward?.legend && !!cards.isRandomObtainable && catalog.some(card => card.rarity === '传说' && cards.isRandomObtainable(card)))
        || (!!milestone.reward?.egg && catalog.some(card => card.id === (base.PET_EGG_ID || 'pet-egg')));
    }
  }
  return needsCard ? '仓库当前剩余 0 格；这项卡牌奖励需要入库，尚未入库。请整理后勤或扩建仓库后重试。' : '';
}

function bindReceiptEsc(panel) {
  activeReceipt = new WeakRef(panel);
  if (receiptEscBound) return;
  receiptEscBound = true;
  // Window capture precedes the existing overlay capture return handler.
  // Keep only a weak reference; leaving/replacing the room cannot retain its DOM.
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return;
    const current = activeReceipt?.deref();
    if (!current?.isConnected || current.closest('[hidden], [aria-hidden="true"], [inert]') || document.querySelector('#hubMain .reward-receipt') !== current) return;
    const zoom = document.getElementById('cardZoom');
    if (zoom && !zoom.hidden && zoom.getAttribute('aria-hidden') !== 'true') return;
    event.preventDefault(); event.stopImmediatePropagation();
    current._closeRewardReceipt?.();
  }, true);
}

/** Only captures confirmed state; it never calls, replaces or retries a reward command. */
export function rewardSnapshot(base, meta, cards, action, id) {
  const stash = new Map();
  for (const stack of base.data.stash || []) {
    if (!stack.card?.id) continue;
    const previous = stash.get(stack.card.id);
    stash.set(stack.card.id, { name: stack.card.name || stack.card.id, count: (previous?.count || 0) + (stack.count || 1) });
  }
  return { slot: base.slot, claimed: !!claimed(meta, action, id),
    resources: { wood: base.data.wood || 0, rations: base.data.rations || 0, keys: base.data.keys || 0 }, stash,
    backs: (cards.CARD_BACKS || []).filter(back => base.isBackUnlocked(back.id)).map(back => ({ id: back.id, name: back.name })) };
}

/** A changed claimed marker proves the original synchronous command committed. */
export function confirmedRewardReceipt(before, after, name) {
  if (before.slot !== after.slot || before.claimed || !after.claimed) return null;
  const items = [];
  for (const [key, label] of [['wood', '木材'], ['rations', '口粮'], ['keys', '钥匙']]) {
    const count = after.resources[key] - before.resources[key];
    if (count > 0) items.push({ name: label, count, destination: '基地资源' });
  }
  for (const [id, stack] of after.stash) {
    const count = stack.count - (before.stash.get(id)?.count || 0);
    if (count > 0) items.push({ name: stack.name, count, destination: '后勤 · 卡牌仓库' });
  }
  for (const back of after.backs) {
    if (!before.backs.some(item => item.id === back.id)) items.push({ name: `卡背 · ${back.name}`, count: 1, destination: '收藏室 · 卡背' });
  }
  return { slot: after.slot, name, items };
}

function paint(root, base) {
  if (!root?.isConnected) return;
  const receipt = receipts.get(base);
  if (root.querySelector('.reward-receipt')?._receipt === receipt) return;
  root.querySelector('.reward-receipt')?.remove();
  if (!receipt || receipt.slot !== base.slot) return;
  const panel = document.createElement('section');
  panel.className = 'reward-receipt';
  /** @type {HTMLElement & {_receipt?: unknown}} */ (panel)._receipt = receipt;
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-label', '奖励领取结果');
  panel.tabIndex = -1;
  panel.dataset.outcome = receipt.failed ? 'unclaimed' : 'claimed';
  panel.innerHTML = `<header><span>${receipt.failed ? '尚未领取' : '已领取'}</span><h3>${esc(receipt.name)}</h3></header>${receipt.failed ? `${receipt.reason ? `<p>${esc(receipt.reason)}</p>` : ''}` : `<ul>${receipt.items.map(item => `<li><b>${esc(item.name)} <em>×${item.count}</em></b><span>${esc(item.destination)}</span></li>`).join('')}</ul>${receipt.items.length ? '' : '<p>已领取，明细见对应库存。</p>'}`}<button type="button" class="mini-btn base-command" data-reward-close aria-label="关闭领取结果">确认</button>`;
  const close = () => {
    receipts.delete(base); panel.remove();
    if (activeReceipt?.deref() === panel) activeReceipt = undefined;
    root.querySelector('[data-act="archiveV12Record"].on, [data-act="archiveV3Medal"][aria-pressed="true"], .av12-directory [aria-pressed="true"]')?.focus({ preventScroll: true });
  };
  /** @type {HTMLElement & {_closeRewardReceipt?: () => void}} */ (panel)._closeRewardReceipt = close;
  panel.querySelector('[data-reward-close]').addEventListener('click', close);
  root.querySelector('.av12-content')?.prepend(panel);
  bindReceiptEsc(panel);
  panel.focus({ preventScroll: true });
}

/** Bind after archive rendering. Original data-act handlers keep full command ownership. */
export function bindRewardFeedback({ root, base, meta, cards, ui }) {
  paint(root, base);
  const delegate = ui?.el?.ovBody || root.closest('#ovBody');
  // UI.init owns the earlier ovBody bubble listener. Reading at this same
  // delegate after that listener avoids native inter-listener microtask checkpoints.
  if (!delegate) return;
  if (!delegates.has(delegate)) {
    delegates.add(delegate);
    delegate.addEventListener('click', event => {
      const frame = eventSnapshots.get(event);
      if (!frame) return;
      eventSnapshots.delete(event);
      const { before, base: sourceBase, meta: sourceMeta, cards: sourceCards, action, id, name, log, logEntries } = frame;
      const after = rewardSnapshot(sourceBase, sourceMeta, sourceCards, action, id);
      if (before.slot !== after.slot) return;
      const receipt = confirmedRewardReceipt(before, after, name);
      // UI.log prepends fresh log-line nodes; compare identity, not text, so an
      // identical new failure is kept and a previous failure is never copied.
      const loggedReason = !receipt && log ? [...log.children]
        .filter(entry => !logEntries.has(entry) && entry.classList.contains('warn'))
        .map(entry => entry.textContent.trim()).filter(Boolean).join('；') : '';
      const reason = loggedReason || (!receipt ? currentCapacityFact(sourceBase, sourceMeta, sourceCards, action, id) : '');
      receipts.set(sourceBase, receipt || { slot: after.slot, name, failed: true, reason });
      paint(delegate.querySelector('#hubMain .hub-archive-v3'), sourceBase);
    });
  }
  if (bound.has(root)) return;
  bound.add(root);
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-act="claimAch"], [data-act="claimColl"]');
    if (!button || button.disabled || !root.isConnected || !root.contains(button)) return;
    const { act: action, id } = button.dataset;
    const before = rewardSnapshot(base, meta, cards, action, id);
    if (before.claimed) return;
    const achievement = action === 'claimAch' && meta.ACHIEVEMENTS.find(item => item.id === id);
    const milestone = action === 'claimColl' && meta.COLL_MILESTONES.find(item => item.id === id);
    const name = achievement?.name || (milestone ? `收藏 ${meta.collMsNeed(milestone)} 张` : id);
    const log = ui?.el?.log;
    eventSnapshots.set(event, { before, base, meta, cards, action, id, name, log, logEntries: new Set(log?.children || []) });
  }, true);
}
