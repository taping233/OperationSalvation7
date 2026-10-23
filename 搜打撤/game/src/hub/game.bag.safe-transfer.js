import { stackCapOf, stackTransferSlotDelta } from '../core/card-capacity.js';
import { cardStacksForZone, deriveBagRenderState } from '../core/bag-render-derivation.js';
import { createOperationNotice } from '../ui/operation-notice.js';
import { rewardSceneHTML } from '../ui/reward-scene-view.js';
import { esc, escAttr } from '../core/shared.js';

// One visible safe slot goes out; the entire requested source stack goes in.
export function planSafeCardSwap(game, incoming, outgoing, baseCap, safeCap) {
  const owned = game.ownedCards;
    if (!incoming.length || new Set(incoming).size !== incoming.length || !incoming.every(entry => owned.includes(entry) && !entry.safe && !entry.stored && !entry.pouchOf && entry.card.name === incoming[0].card.name)
      || !outgoing.length || new Set(outgoing).size !== outgoing.length || !outgoing.every(entry => owned.includes(entry) && entry.safe && !entry.stored && !entry.pouchOf)) return null;
  if (!cardStacksForZone(owned, true).some(stack => stack.uids.length === outgoing.length && outgoing.every(entry => stack.uids.includes(entry.uid)))) return null;
  const withoutIncoming = owned.map(entry => incoming.includes(entry) ? { ...entry, safe:true } : entry);
  const projected = withoutIncoming.map(entry => outgoing.includes(entry) ? { ...entry, safe:false } : entry);
  const beforeOut = deriveBagRenderState({ ...game, ownedCards:withoutIncoming }, baseCap);
  const after = deriveBagRenderState({ ...game, ownedCards:projected }, baseCap);
  if (after.safeStacks.length > safeCap || after.used > after.cap) return null;
  // Resource-only extension slots cannot receive a new non-resource stack.
  if (outgoing[0].card.type !== '资源' && after.used > beforeOut.used && after.used > baseCap) return null;
  return { incoming, outgoing, bagUsed:after.used, safeUsed:after.safeStacks.length };
}

export function createSafeTransfer({ UI, game, shaName, bagCap, safeCap, usedSlots, safeUsed,
  baseCap, refresh, save, closeZoom, captureContext, beforeSelection, cardHTML, sound, receipt }) {
  const notice = createOperationNotice();
  let selection = null;
  const listFor = (name, uids = null) => game.ownedCards.filter(entry => !entry.safe && !entry.stored && !entry.pouchOf
    && entry.card.name === name && (!uids || uids.includes(entry.uid)));
  function direct(name, toSafe, uids = null) {
    const list = toSafe ? listFor(name, uids) : game.ownedCards.filter(entry => entry.safe && !entry.stored && !entry.pouchOf
      && entry.card.name === name && (!uids || uids.includes(entry.uid)));
    if (toSafe && name === shaName) return { list, reason:'初始牌「初始攻击」每局固定携带，不能移入安全格。' };
    if (!list.length) return { list, reason:'这些卡牌已不在原位置，请返回背包重新选择。' };
    const delta = stackTransferSlotDelta(game.ownedCards, name, toSafe, list.length, stackCapOf(list[0].card));
    const used = toSafe ? safeUsed() : usedSlots(), limit = toSafe ? safeCap() : bagCap();
    return { list, reason:used + delta > limit ? `${toSafe ? '安全格' : '背包'}放不下：移动整叠还需 ${delta} 格，当前 ${used}/${limit} 格。请先腾出空间。` : '' };
  }
  const swaps = incoming => cardStacksForZone(game.ownedCards, true).map(stack => planSafeCardSwap(game, incoming,
    stack.uids.map(uid => game.ownedCards.find(entry => entry.uid === uid)), baseCap(), safeCap())).filter(Boolean);
  function button(name, toSafe, action) {
    const plan = direct(name, toSafe), choices = toSafe && name !== shaName && plan.reason ? swaps(plan.list) : [];
    const blocked = plan.reason && !choices.length;
    notice.set(blocked ? plan.reason : '', 'warn');
    return `<button class="ov-btn" data-act="${action}"${blocked ? ` disabled aria-disabled="true" title="${escAttr(plan.reason)}"` : ''}>${toSafe ? '<span aria-hidden="true">[[icon:lock]]</span> ' : ''}${choices.length ? '换入安全格' : toSafe ? '移入安全格' : '移回背包'}</button>${notice.html({ keepEmpty:true })}`;
  }
  function finish(incoming, outgoing, options) {
    // No callbacks, awaits or saves between either side of the exchange.
    if (outgoing) outgoing.forEach(entry => { entry.safe = false; });
    incoming.forEach(entry => { entry.safe = options.toSafe; });
    options.beforeMove?.();
    notice.clear();
    sound(options.toSafe ? 'safeStore' : 'safeRetrieve');
    if (outgoing) {
      receipt(`已换入${incoming[0].card.name} ×${incoming.length}；${outgoing[0].card.name} ×${outgoing.length}已回背包。`);
      save();
    }
    UI.log(outgoing ? `已交换安全格：${esc(incoming[0].card.name)} ×${incoming.length}换入，${esc(outgoing[0].card.name)} ×${outgoing.length}回背包`
      : `【${esc(incoming[0].card.name)}】×${incoming.length}${options.toSafe ? '已存入安全格' : '已从安全格取出'}`, 'sys');
    if (options.refresh) refresh(true); else save();
    return true;
  }
  function warn(text) { notice.set(text, 'warn'); UI.log(text, 'warn'); return false; }
  function choose(name, incoming, choices, options) {
    const sameRun = captureContext(), cards = game.ownedCards;
    const expected = incoming.map(entry => ({ entry, uid:entry.uid, card:entry.card }));
    const offered = choices.map(plan => ({ ...plan, identity:plan.outgoing.map(entry => ({ entry, uid:entry.uid, card:entry.card })) }));
    notice.clear();
    beforeSelection(name); closeZoom();
    const token = {}; selection = token;
    UI.showOverlay('换入安全格', rewardSceneHTML({
      title:'选择换回背包的一叠', source:`换入：${name} ×${incoming.length}`,
      cards:choices.map((plan, i) => `<article class="reward-unit"><button type="button" class="reward-card" data-act="safeSwapPick" data-i="${i}" aria-label="换出${escAttr(plan.outgoing[0].card.name)} ×${plan.outgoing.length}并换入${escAttr(name)}">${cardHTML(plan.outgoing[0].card)}</button><span>${esc(plan.outgoing[0].card.name)} ×${plan.outgoing.length}</span></article>`).join(''),
      actions:'<button type="button" class="reward-bag" data-act="safeSwapCancel" data-cancel="true">返回</button>',
      footer:notice.html({ keepEmpty:true }), count:choices.length, className:'reward-v14 reward-standalone-picker',
    }), 'chest');
    const root = UI.el.ovBody.firstElementChild;
    const current = () => selection === token && sameRun() && game.ownedCards === cards && game.runActive
      && !game.battleActive && game.state === 'modal' && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing')
      && root?.isConnected && UI.el.ovBody.firstElementChild === root;
    UI.act('safeSwapCancel', () => { if (!current()) return false; selection = null; refresh(true); options.onCancel?.(); return false; });
    UI.act('safeSwapPick', data => {
      if (!current()) return false;
      const chosen = offered[Number(data.i)], live = listFor(name, options.uids);
      if (!chosen || live.length !== expected.length || !expected.every(({ entry, uid, card }) => live.includes(entry) && entry.uid === uid && entry.card === card)
          || !chosen.identity.every(({ entry, uid, card }) => entry.uid === uid && entry.card === card)) return warn('背包已变化，请返回重新选择；卡牌未移动。');
      const plan = planSafeCardSwap(game, expected.map(item => item.entry), chosen.outgoing, baseCap(), safeCap());
      if (!plan) return warn('卡牌或容量已变化，无法交换；卡牌未移动。');
      selection = null;
      return finish(plan.incoming, plan.outgoing, { ...options, beforeMove:null });
    });
    return false; // A selection was opened; no cards moved and no reward may be claimed.
  }
  function move(name, toSafe, { refresh:repaint = true, uids = null, beforeMove = null, onCancel = null } = {}) {
    if (!game.runActive || game.battleActive || !['idle', 'modal'].includes(game.state)) return false;
    const options = { refresh:repaint, uids, beforeMove, onCancel, toSafe };
    const plan = direct(name, toSafe, uids);
    if (!plan.reason) return finish(plan.list, null, options);
    // The reward organizer retains its synchronous, direct-transfer boolean contract.
    if (!repaint || !toSafe || name === shaName) return warn(plan.reason);
    const choices = swaps(plan.list);
    if (!choices.length) return warn(`${plan.reason}换出一格仍放不下，请先整理。`);
    if (choices.length === 1) return finish(choices[0].incoming, choices[0].outgoing, options);
    return choose(name, plan.list, choices, options);
  }
  return { button, move };
}
