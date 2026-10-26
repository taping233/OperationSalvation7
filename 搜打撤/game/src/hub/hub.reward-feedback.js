import { esc } from '../core/shared.js';
import '../../css/base-reward-feedback.css';

const receipts = new WeakMap();
let activeReceipt;
let receiptEscBound = false;
const claimed = (meta, action, id) => action === 'claimAch' ? meta.isClaimed(id) : meta.isCollClaimed(id);

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

/** Read only at the command boundary, before running and after awaiting it. */
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

/** A changed claimed marker also confirms a commit if later log rendering throws. */
export function confirmedRewardReceipt(before, after, name) {
  if (before.slot !== after.slot || before.claimed || !after.claimed) return null;
  const items = [];
  for (const [key, label] of [['wood', '木材'], ['rations', '口粮'], ['keys', '钥匙']]) {
    const count = after.resources[key] - before.resources[key];
    if (count > 0) items.push({ name: label, count, destination: '基地资源' });
  }
  for (const [id, stack] of after.stash) {
    const count = stack.count - (before.stash.get(id)?.count || 0);
    if (count > 0) items.push({ name: stack.name, count, destination: '后勤 · 卡牌仓库', target: 'stash' });
  }
  for (const back of after.backs) {
    if (!before.backs.some(item => item.id === back.id)) items.push({ id: back.id, name: `卡背 · ${back.name}`, count: 1, destination: '收藏室 · 卡背', target: 'backs' });
  }
  return { slot: after.slot, name, items };
}

function paint(root, base) {
  if (!root?.isConnected) return;
  const receipt = receipts.get(base);
  if (root.querySelector('.reward-receipt')?._receipt === receipt) return;
  root.querySelector('.reward-receipt')?.remove();
  if (!receipt || receipt.slot !== base.slot) return;
  if (receipt.pending && receipt.root !== root) return;
  const panel = document.createElement('section');
  panel.className = 'reward-receipt';
  /** @type {HTMLElement & {_receipt?: unknown}} */ (panel)._receipt = receipt;
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-label', '奖励领取结果');
  panel.tabIndex = -1;
  panel.dataset.outcome = receipt.pending ? 'saving' : receipt.unknown ? 'unknown' : receipt.failed ? 'unclaimed' : 'claimed';
  const heading = receipt.pending ? '保存中' : receipt.unknown ? '领取结果待确认' : receipt.already ? '此前已领取' : receipt.failed ? '尚未领取' : '已领取';
  const items = receipt.items || [];
  const destinations = new Set(items.map(item => item.target));
  const navigation = `${destinations.has('stash') || receipt.capacity ? '<button type="button" class="mini-btn base-command" data-act="hubTab" data-tab="stash" data-view="cards">查看仓库</button>' : ''}${items.filter(item => item.target === 'backs').map(item => `<button type="button" class="mini-btn base-command" data-act="hubCollectionView" data-view="backs" data-id="${esc(item.id)}">查看卡背</button>`).join('')}${receipt.capacity ? '<button type="button" class="mini-btn base-command" data-act="hubTab" data-tab="upgrade" data-facility="stash">扩建仓库</button>' : ''}`;
  panel.innerHTML = `<header><span>${heading}</span><h3>${esc(receipt.name)}</h3></header>${receipt.pending ? '<p>正在保存领取结果，请稍候…</p>' : receipt.failed || receipt.unknown ? `<p>${esc(receipt.reason)}</p>` : `<ul>${items.map(item => `<li><b>${esc(item.name)} <em>×${item.count}</em></b><span>${esc(item.destination)}</span></li>`).join('')}</ul>${items.length ? '' : '<p>奖励已领取，明细见对应库存。</p>'}`}${navigation}${receipt.pending ? '' : '<button type="button" class="mini-btn base-command" data-reward-close aria-label="关闭领取结果">确认</button>'}`;
  const close = () => {
    if (receipts.get(base) === receipt) receipts.delete(base);
    panel.remove();
    if (activeReceipt?.deref() === panel) activeReceipt = undefined;
    root.querySelector('[data-act="archiveV12Record"].on, [data-act="archiveV3Medal"][aria-pressed="true"], .av12-directory [aria-pressed="true"]')?.focus({ preventScroll: true });
  };
  /** @type {HTMLElement & {_closeRewardReceipt?: () => void}} */ (panel)._closeRewardReceipt = close;
  panel.querySelector('[data-reward-close]')?.addEventListener('click', close);
  // Destinations use the existing navigation actions and dismiss this receipt.
  panel.querySelectorAll('[data-act]').forEach(button => button.addEventListener('click', () => receipts.delete(base)));
  root.querySelector('.av12-content')?.prepend(panel);
  if (!receipt.pending) bindReceiptEsc(panel);
  panel.focus({ preventScroll: true });
}

/** Rendering never observes clicks or invokes a reward command. */
export function bindRewardFeedback(options) {
  paint(options.root, options.base);
}

/** The runtime's existing hubWrite lock owns duplicate prevention; run is called once. */
export async function runRewardClaim({ root, base, meta, cards, action, id, run, isCurrent = () => root?.isConnected }) {
  if (!isCurrent()) return { ok: false, why: 'stale' };
  const slot = base.slot;
  const achievement = action === 'claimAch' && meta.ACHIEVEMENTS.find(item => item.id === id);
  const milestone = action === 'claimColl' && meta.COLL_MILESTONES.find(item => item.id === id);
  const name = achievement?.name || (milestone ? `收藏 ${meta.collMsNeed(milestone)} 张` : id);
  const snapshot = () => { try { return rewardSnapshot(base, meta, cards, action, id); } catch { return null; } };
  const before = snapshot();
  const repaint = () => {
    // Feedback rendering cannot turn a completed command into a save failure.
    try { if (isCurrent()) paint(root.matches('.hub-archive-v3') ? root : root.querySelector('.hub-archive-v3'), base); } catch { /* Retain the receipt for the next archive render. */ }
  };
  const pending = { slot, name, pending: true, root: root.matches('.hub-archive-v3') ? root : root.querySelector('.hub-archive-v3') };
  receipts.set(base, pending);
  const buttons = [...root.querySelectorAll('[data-act="claimAch"], [data-act="claimColl"]')].map(element => ({
    button: /** @type {HTMLButtonElement} */ (element), disabled: element.hasAttribute('disabled'), label: element.innerHTML, busy: element.getAttribute('aria-busy'),
  }));
  for (const { button } of buttons) {
    button.disabled = true;
    if (button.dataset.act === action && button.dataset.id === id) { button.textContent = '保存中…'; button.setAttribute('aria-busy', 'true'); }
  }
  repaint();
  let result, rejected = false;
  try { result = await run(); }
  catch { rejected = true; }
  finally {
    for (const { button, disabled, label, busy } of buttons) {
      button.disabled = disabled; button.innerHTML = label;
      if (busy === null) button.removeAttribute('aria-busy'); else button.setAttribute('aria-busy', busy);
    }
  }
  if (base.slot !== slot) {
    if (receipts.get(base) === pending) receipts.delete(base);
    const panel = root.querySelector('.reward-receipt');
    if (panel?._receipt === pending) panel.remove();
    return result || { ok: false, why: 'stale' };
  }
  const after = snapshot();
  // Meta can throw while logging after grantReward already committed. Never retry it.
  const committed = !!before && !!after && !before.claimed && after.claimed;
  if (result?.ok || committed) {
    const fallback = { slot, name, items: [] };
    receipts.set(base, fallback);
    try { if (before && after) receipts.set(base, confirmedRewardReceipt(before, after, name) || fallback); } catch { /* The successful receipt remains available. */ }
    result = result?.ok ? result : { ok: true };
  } else if (rejected) {
    receipts.set(base, { slot, name, unknown: true, reason: '领取结果尚未确认，请重新进入收藏室核对领取状态。' });
    result = { ok: false, why: 'unknown' };
  } else {
    const already = before?.claimed || result?.why === 'claimed';
    const reason = result?.msg || result?.message || ({
      full: '仓库容量不足，请整理或扩建仓库后重试。',
      save: '基地存档未保存，请重新载入后重试。',
      claimed: '这项奖励已经领取，请查看对应库存。',
      unavailable: '奖励内容暂不可用，请稍后重试。',
    }[result?.why] || (already ? '这项奖励已经领取，请查看对应库存。' : '当前领取条件未满足或领取状态已变化，请重新查看这项目标。'));
    receipts.set(base, { slot, name, failed: true, already, reason, capacity: result?.why === 'full' });
    result = result || { ok: false };
  }
  repaint();
  return result;
}
