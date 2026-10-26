import { stackCapOf, stackTransferSlotDelta } from '../core/card-capacity.js';
import { completeRunCheckpoint } from '../core/run-checkpoint.js';
import { deriveBagRenderState } from '../core/bag-render-derivation.js';
import { createOperationNotice } from '../ui/operation-notice.js';
import { rewardSceneHTML } from '../ui/reward-scene-view.js';
import { discoveryActionsHTML, bindDiscoverySelection } from '../ui/discovery-selection.js';
import { esc, escAttr } from '../core/shared.js';

function safeEntryStacks(owned) {
  const groups = new Map();
  for (const entry of owned) {
    if (!entry.safe || entry.stored || entry.pouchOf) continue;
    const name = entry.card.name;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(entry);
  }
  const stacks = [];
  for (const group of groups.values()) {
    const cap = stackCapOf(group[0].card);
    for (let index = 0; index < group.length; index += cap) stacks.push(group.slice(index, index + cap));
  }
  return stacks;
}

// One visible safe slot goes out; the entire requested source stack goes in.
export function planSafeCardSwap(game, incoming, outgoing, baseCap, safeCap) {
  const owned = game.ownedCards;
    if (!incoming.length || new Set(incoming).size !== incoming.length || !incoming.every(entry => owned.includes(entry) && !entry.safe && !entry.stored && !entry.pouchOf && entry.card.name === incoming[0].card.name)
      || !outgoing.length || new Set(outgoing).size !== outgoing.length || !outgoing.every(entry => owned.includes(entry) && entry.safe && !entry.stored && !entry.pouchOf)) return null;
  if (!safeEntryStacks(owned).some(stack => stack.length === outgoing.length && outgoing.every(entry => stack.includes(entry)))) return null;
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
  let selection = null, pendingMove = null;
  const moving = () => {
    if (pendingMove && !pendingMove.current()) { pendingMove.release(); pendingMove = null; }
    return !!pendingMove;
  };
  const listFor = (name, uids = null) => game.ownedCards.filter(entry => !entry.safe && !entry.stored && !entry.pouchOf
    && entry.card.name === name && (!uids || uids.includes(entry.uid)));
  function direct(name, toSafe, uids = null) {
    const list = toSafe ? listFor(name, uids) : game.ownedCards.filter(entry => entry.safe && !entry.stored && !entry.pouchOf
      && entry.card.name === name && (!uids || uids.includes(entry.uid)));
    if (toSafe && name === shaName) return { list, reason:'初始牌「初始攻击」每局固定携带，不能移入安全格。' };
    if (!list.length) return { list, reason:'这些卡牌已不在原位置，请返回背包重新选择。' };
    const delta = stackTransferSlotDelta(game.ownedCards, name, toSafe, list.length, stackCapOf(list[0].card));
    const used = toSafe ? safeUsed() : usedSlots(), limit = toSafe ? safeCap() : bagCap();
    if (!toSafe && list[0].card.type !== '资源' && delta > 0 && used + delta > baseCap()) {
      return { list, reason:'背包基础格不足：资源扩展格只能存放资源，请先腾出基础格。' };
    }
    return { list, reason:used + delta > limit ? `${toSafe ? '安全格' : '背包'}放不下：移动整叠还需 ${delta} 格，当前 ${used}/${limit} 格。请先腾出空间。` : '' };
  }
  const swaps = incoming => safeEntryStacks(game.ownedCards).map(stack => planSafeCardSwap(game, incoming,
    stack, baseCap(), safeCap())).filter(Boolean);
  function button(name, toSafe, action) {
    const plan = direct(name, toSafe), choices = toSafe && name !== shaName && plan.reason ? swaps(plan.list) : [];
    const blocked = plan.reason && !choices.length;
    notice.set(blocked ? plan.reason : '', 'warn');
    return `<button class="ov-btn" data-act="${action}"${blocked ? ` disabled aria-disabled="true" title="${escAttr(plan.reason)}"` : ''}>${choices.length ? '换入安全格' : toSafe ? '移入安全格' : '移回背包'}</button>${notice.html({ keepEmpty:true })}`;
  }
  function moveCards(incoming, outgoing, toSafe) {
    if (outgoing) outgoing.forEach(entry => { entry.safe = false; });
    incoming.forEach(entry => { entry.safe = toSafe; });
  }
  function announce(incoming, outgoing, options) {
    notice.clear();
    sound(options.toSafe ? 'safeStore' : 'safeRetrieve');
    if (outgoing) {
      receipt(`已换入${incoming[0].card.name} ×${incoming.length}；${outgoing[0].card.name} ×${outgoing.length}已回背包。`);
    }
    UI.log(outgoing ? `已交换安全格：${esc(incoming[0].card.name)} ×${incoming.length}换入，${esc(outgoing[0].card.name)} ×${outgoing.length}回背包`
      : `【${esc(incoming[0].card.name)}】×${incoming.length}${options.toSafe ? '已存入安全格' : '已从安全格取出'}`, 'sys');
  }
  function persistMove(incoming, outgoing, options, { current, onSuccess = () => {}, onFinish = () => {} }) {
    const sameRun = captureContext(), cards = game.ownedCards;
    const operation = { current:() => sameRun() && game.ownedCards === cards, release:onFinish };
    const previous = [...incoming, ...(outgoing || [])].map(entry => ({ entry, safe:entry.safe,
      hadSafe:Object.hasOwn(entry,'safe'), appliedSafe:incoming.includes(entry) ? options.toSafe : false }));
    pendingMove = operation;
    moveCards(incoming, outgoing, options.toSafe);
    const complete = saved => {
      try {
        if (saved === false) {
          if (operation.current()) {
            previous.forEach(({entry,safe,hadSafe,appliedSafe}) => {
              if (!cards.includes(entry) || entry.safe !== appliedSafe) return;
              if (hadSafe) entry.safe = safe; else delete entry.safe;
            });
            if (current()) warn('保存未成功；卡牌已回到原位置，请重试。');
          }
          return false;
        }
        const showCurrent = operation.current() && current();
        onSuccess();
        if (showCurrent) {
          options.beforeMove?.();
          announce(incoming, outgoing, options);
          if (options.refresh) refresh(true);
        }
        return true;
      } finally {
        if (pendingMove === operation) pendingMove = null;
        onFinish();
      }
    };
    return completeRunCheckpoint(save, complete);
  }
  function finish(incoming, outgoing, options) {
    const sameRun = captureContext(), cards = game.ownedCards;
    const body = UI.el?.ovBody, root = body?.firstElementChild;
    const zoom = typeof document === 'object' ? document.getElementById('cardZoom') : null, view = zoom || root;
    const current = () => sameRun() && game.ownedCards === cards && game.runActive && !game.battleActive
      && (!body || (UI.el?.ovBody === body && body.firstElementChild === root && root?.isConnected
        && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing')))
      && (typeof document !== 'object' || document.getElementById('cardZoom') === zoom);
    const buttons = [...(view?.querySelectorAll('.camp-card-actions button[data-act], [data-act="zoomMoveToBag"], [data-act="zoomMoveToSafe"]') || [])]
      .filter(button => button instanceof HTMLButtonElement).map(button => ({button,disabled:button.disabled}));
    const previousBusy = view?.getAttribute('aria-busy');
    if (view) { view.setAttribute('aria-busy','true'); view.setAttribute('data-safe-transfer-busy','true'); }
    buttons.forEach(({button}) => {button.disabled=true;});
    let released = false;
    const onFinish = () => {
      if (released) return;
      released = true;
      if (view) {
        if (previousBusy == null) view.removeAttribute('aria-busy'); else view.setAttribute('aria-busy',previousBusy);
        view.removeAttribute('data-safe-transfer-busy');
      }
      buttons.forEach(({button,disabled}) => {button.disabled=disabled;});
    };
    return persistMove(incoming, outgoing, options, {current,onFinish});
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
      actions:discoveryActionsHTML({ cancelAct:'safeSwapCancel', confirmAct:'safeSwapConfirm', confirmLabel:'确认交换' }),
      footer:notice.html({ keepEmpty:true }), count:choices.length, className:'reward-v14 reward-standalone-picker',
    }), 'chest');
    const root = UI.el.ovBody.firstElementChild;
    const current = () => selection === token && sameRun() && game.ownedCards === cards && game.runActive
      && !game.battleActive && game.state === 'modal' && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing')
      && root?.isConnected && UI.el.ovBody.firstElementChild === root;
    const cancel = () => {
      if (!current()) return false;
      const finishCancel = result => {
        if (result === false) return false;
        if (selection !== token || !sameRun() || game.ownedCards !== cards) return true;
        selection = null;
        const notified = options.onCancel?.();
        return notified && typeof notified.then === 'function' ? Promise.resolve(notified).then(() => true) : true;
      };
      const result = refresh(true);
      return result && typeof result.then === 'function' ? Promise.resolve(result).then(finishCancel) : finishCancel(result);
    };
    const commit = data => {
      if (!current() || moving()) return false;
      const chosen = offered[Number(data.i)], live = listFor(name, options.uids);
      if (!chosen || live.length !== expected.length || !expected.every(({ entry, uid, card }) => live.includes(entry) && entry.uid === uid && entry.card === card)
          || !chosen.identity.every(({ entry, uid, card }) => entry.uid === uid && entry.card === card)) return warn('背包已变化，请返回重新选择；卡牌未移动。');
      const plan = planSafeCardSwap(game, expected.map(item => item.entry), chosen.outgoing, baseCap(), safeCap());
      if (!plan) return warn('卡牌或容量已变化，无法交换；卡牌未移动。');
      return persistMove(plan.incoming, plan.outgoing, { ...options, beforeMove:null }, {
        current, onSuccess:() => { if (selection === token) selection = null; },
      });
    };
    bindDiscoverySelection({ UI, root, optionSelector:'[data-act="safeSwapPick"]', selectAct:'safeSwapPick',
      confirmAct:'safeSwapConfirm', cancelAct:'safeSwapCancel', isCurrent:current,
      onConfirm:commit, onCancel:cancel });
    return false; // A selection was opened; no cards moved and no reward may be claimed.
  }
  function move(name, toSafe, { refresh:repaint = true, uids = null, beforeMove = null, onCancel = null } = {}) {
    if (!game.runActive || game.battleActive || !['idle', 'modal'].includes(game.state) || moving()) return false;
    const options = { refresh:repaint, uids, beforeMove, onCancel, toSafe };
    const plan = direct(name, toSafe, uids);
    if (!plan.reason) return finish(plan.list, null, options);
    if (!toSafe || name === shaName || repaint === false) return warn(plan.reason);
    const choices = swaps(plan.list);
    if (!choices.length) return warn(`${plan.reason}换出一格仍放不下，请先整理。`);
    return choose(name, plan.list, choices, options);
  }
  return { button, move };
}
