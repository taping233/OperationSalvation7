import { esc } from '../core/shared.js';
import { completeRunCheckpoint } from '../core/run-checkpoint.js';
import { afterOutcomeFeedback } from '../ui/outcome-feedback.js';
import { executeBagItemEffects } from './bag-item-effects.js';

const owners = new WeakMap(), plans = new WeakMap(), surfaces = new WeakMap();
export const isBagItemUsePending = game => !!owners.get(game)?.current();

// One source owns its mutations, checkpoint and presentation. Failed attempts
// retain their random plan without attaching transient work to the save data.
export function useBagItemOperations(card, ownedIndex, operations, {
  UI, SDT, game, Random, newUid, saveGame, showBackpack, usedSlots, bagCap,
  canReplace, canReceive, items = {}, current = () => true,
  beforePresent = /** @type {null | (() => (() => boolean))} */ (null),
  captureContext = () => () => true,
  setReceipt = /** @type {(text:string, tone?:string) => void} */ (() => {}),
}) {
  if (isBagItemUsePending(game) || !current() || game.battleActive) return false;
  const entries = game.ownedCards, source = entries[ownedIndex], pocket = game.usedPocket;
  if (!source || source.card !== card || source.safe || source.stored || source.pouchOf) return false;
  const inventory = game.inventory, sameRun = captureContext();
  const ownsState = () => sameRun() && game.ownedCards === entries && game.usedPocket === pocket
    && game.inventory === inventory;
  const body = UI.el?.ovBody, root = body?.firstElementChild, overlay = UI.el?.overlay;
  let viewCurrent = current;
  const ownsView = () => ownsState() && !game.battleActive && viewCurrent()
    && (!body || (UI.el.ovBody === body && body.firstElementChild === root))
    && (!overlay || (!overlay.hidden && !overlay.classList?.contains('closing')));
  const key = JSON.stringify(operations);
  let plan = plans.get(source);
  if (!plan || plan.card !== card || plan.key !== key) {
    plan = { card, key, choices:new Map() }; plans.set(source, plan);
  }
  const owner = { current:ownsState, wasInert:root ? surfaces.get(root)?.wasInert ?? !!root.inert : false };
  owners.set(game, owner);
  if (root) { surfaces.set(root, owner); root.inert = true; }
  const notices = [], receipts = [], added = [], restored = [], touched = new Map();
  const originalPocket = pocket?.slice() || [], inventoryChanges = new Map(), newItems = new Set();
  let consumed = false, healed = 0, coins = 0;
  const hpBefore = game.hp;
  const notify = (message, tone) => notices.push(() => UI.log(message, tone));
  const transaction = {
    report(message, tone) { notify(message, tone); receipts.push(message.replace(/<[^>]*>|\[\[icon:[^\]]+\]\]/g, '')); },
    notifyLegend(got) { notices.push(() => UI.showLegendGet?.(got)); },
    get consumed() { return consumed; },
    consume() {
      if (consumed) return;
      const index = entries.indexOf(source);
      if (index < 0 || !ownsState()) throw new Error('bag item source changed');
      entries.splice(index, 1); consumed = true;
      notify(`使用道具卡【<b>${esc(card.name)}</b>】`, 'sys');
    },
    heal(amount) {
      const before = game.hp;
      try { game.heal(amount, { deferFeedback:feedback => notices.push(feedback) }); }
      finally { healed += game.hp - before; }
    },
    addCard(got, isRestored = false) {
      const output = { uid:newUid(), card:{ ...got } };
      entries.push(output); added.push(output);
      if (isRestored) restored.push(got);
    },
    restore(entry) {
      this.addCard(entry.card, true);
      touched.set(entry, (touched.get(entry) || 0) + 1);
      entry.count--;
      if (entry.count <= 0) pocket.splice(pocket.indexOf(entry), 1);
    },
    addCoins(amount) { game.coins += amount; coins += amount; },
    addItem(template, amount) {
      const counts = new Map((inventory || []).map(entry => [entry, entry.count]));
      let receipt;
      try { receipt = game.addItem(template, amount, { deferFeedback:feedback => notices.push(feedback) }); }
      finally {
        for (const entry of inventory || []) {
          const delta = entry.count - (counts.get(entry) || 0);
          if (delta) inventoryChanges.set(entry, (inventoryChanges.get(entry) || 0) + delta);
          if (!counts.has(entry)) newItems.add(entry);
        }
      }
      return receipt !== null && receipt !== false;
    },
    choose(name, select) {
      if (!plan.choices.has(name)) {
        const choice = select();
        if (choice !== null && choice !== undefined) plan.choices.set(name, choice);
        return choice;
      }
      return plan.choices.get(name);
    },
  };
  const release = () => {
    if (root && surfaces.get(root) === owner) {
      if (root.isConnected) root.inert = owner.wasInert;
      surfaces.delete(root);
    }
    if (owners.get(game) === owner) owners.delete(game);
  };
  const rollback = () => {
    if (!ownsState()) return;
    for (const entry of added) { const index = entries.indexOf(entry); if (index >= 0) entries.splice(index, 1); }
    if (consumed && !entries.includes(source)) entries.splice(Math.min(ownedIndex, entries.length), 0, source);
    for (const [entry, count] of touched) {
      entry.count += count;
      if (!pocket.includes(entry)) pocket.splice(Math.min(originalPocket.indexOf(entry), pocket.length), 0, entry);
    }
    if (healed) game.hp -= healed;
    if (coins) game.coins -= coins;
    if (inventory) {
      for (const [entry, count] of inventoryChanges) {
        entry.count -= count;
        if (newItems.has(entry) && entry.count <= 0 && inventory.includes(entry)) inventory.splice(inventory.indexOf(entry), 1);
      }
    }
  };
  const fail = (message = '使用未能保存；本次道具与效果已恢复，请重试。') => {
    rollback();
    if (ownsView()) {
      try { setReceipt(message, 'warn'); } catch { /* The original source remains available. */ }
      try { UI.log(message, 'warn'); } catch { /* Feedback cannot change the failed result. */ }
    }
    release();
    return false;
  };
  const finishPresentation = () => {
    if (!ownsView()) return true;
    for (const notice of notices) { if (!ownsView()) break; try { notice(); } catch { /* Committed effects remain committed. */ } }
    if (!ownsView()) return true;
    try { setReceipt(receipts.join('；')); } catch { /* Receipt failure cannot undo a checkpoint. */ }
    if (consumed && ownsView()) { try { showBackpack(true); } catch { /* Keep the committed state available. */ } }
    return true;
  };
  const complete = saved => {
    if (!saved) return fail();
    plans.delete(source);
    let result;
    try {
      if (ownsView() && beforePresent) {
        const nextCurrent = beforePresent();
        if (typeof nextCurrent === 'function') viewCurrent = nextCurrent;
      }
      result = consumed && ownsView() && body?.firstElementChild && (healed > 0 || restored.length)
        ? afterOutcomeFeedback(body, { kind:healed > 0 ? 'heal' : 'restore', hpBefore,
          hpAfter:hpBefore + healed, maxHp:game.maxHp, cards:restored, source:card.name, sourceCard:card,
          extra:healed > 0 && restored.length ? `同时复原 ${restored.length} 张卡牌` : '',
          cardHTML:entry => SDT.Cards.cardHTML?.(entry, 'sm') || esc(entry.name), isCurrent:ownsView }, finishPresentation)
        : finishPresentation();
    } catch { release(); return true; }
    if (result && typeof result.then === 'function') return Promise.resolve(result).then(() => true, () => true).finally(release);
    release(); return true;
  };
  try {
    if (executeBagItemEffects(card, operations, { game, SDT, Random, usedSlots, bagCap, canReplace, canReceive, items }, transaction) === false) {
      return fail('物资放不下，本次道具与效果已恢复；整理背包后可再使用。');
    }
  } catch { return fail('本次使用未完成，道具与效果已恢复；可重试。'); }
  if (!ownsState()) { release(); return false; }
  if (!consumed) {
    if (!receipts.length) transaction.report(`道具卡【${card.name}】的结构化背包用法无效；卡牌未消耗。`, 'warn');
    try { finishPresentation(); } finally { release(); }
    return false;
  }
  return completeRunCheckpoint(saveGame, complete);
}
