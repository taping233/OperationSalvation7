import { bagUseCompatibility, isBattleOnlyBagCard } from './bag-use-compatibility.js';
import { bagUseStatus, useStructuredBagRule, useOrdinaryBagRule, openBagLegendaryDiscovery } from './game.bag.rules.js';
import { isBagItemUsePending } from './bag-item-use.js';

// Compatibility selects operations; the ordinary owner executes and saves them.
export function createLegacyBagUse({ UI, game, readCards, baseCap, items, Random, newUid,
  saveGame, showBackpack, usedSlots, bagCap, captureContext, setBagReceipt,
  beforePresent = /** @type {null | (() => (() => boolean))} */ (null) }) {
  const SDT = { get Cards() { return readCards(); }, Base:{ bagCap:baseCap } };
  function useOwnedCard(uid, current = () => true) {
    if (!current() || game.battleActive || isBagItemUsePending(game)) return false;
    const matches = game.ownedCards.filter(entry => entry.uid === uid && !entry.safe && !entry.stored && !entry.pouchOf);
    if (matches.length !== 1) return false;
    const index = game.ownedCards.indexOf(matches[0]), card = matches[0].card;
    if (card.type === '事件') { UI.log('[[icon:dice]] 事件卡只能在事件格中触发，无法在背包中使用（背包只记录触发历史）', 'warn'); return false; }
    if (card.type !== '道具') { UI.log('只有道具卡可以直接使用', 'warn'); return false; }
    if (isBattleOnlyBagCard(card)) { UI.log('神秘药水仅能在战斗中使用；卡牌未消耗', 'warn'); return false; }
    const status = bagUseStatus(card, uid, { game, usedSlots, bagCap, baseCap });
    if (status.reason) {
      setBagReceipt?.(status.reason, 'warn'); UI.log(status.reason, 'warn');
      const operations = card.rules?.bag?.use;
      const restoreOnly = Array.isArray(operations) && operations.length
        ? operations.every(operation => operation?.op === 'restoreConsumed')
        : ['crystal', 'restore'].includes(bagUseCompatibility(card).kind);
      return restoreOnly ? Promise.resolve(false) : false;
    }
    const ports = { UI, SDT, game, Random, newUid, saveGame, showBackpack, usedSlots, bagCap,
      captureContext, setReceipt:setBagReceipt, items, current, beforePresent };
    /** @type {boolean | Promise<boolean>} */
    let completion = true;
    if (useStructuredBagRule(card, index, { ...ports, onComplete:result => { completion = result; } })) {
      // The old restore entry was asynchronous even for synchronous saves.
      return card.rules.bag.use.every(operation => operation?.op === 'restoreConsumed') ? Promise.resolve(completion) : completion;
    }
    const compatibility = bagUseCompatibility(card);
    let operations;
    if (compatibility.kind === 'crystal' || compatibility.kind === 'restore') {
      operations = [{ op:'restoreConsumed', amount:compatibility.amount }];
    } else if (compatibility.kind === 'rations' || compatibility.kind === 'wood') {
      operations = [{ op:'resource', kind:compatibility.kind, amount:compatibility.amount }];
    } else if (compatibility.kind === 'gold' || compatibility.kind === 'awaken') {
      operations = [{ op:'acquire', pool:{ kind:compatibility.kind === 'gold' ? 'legendary' : 'classAbility' },
        legendNotice:compatibility.kind === 'gold' }];
    } else if (compatibility.kind === 'discover') {
      if (!current()) return false;
      const nextCurrent = beforePresent?.();
      if (nextCurrent && !nextCurrent()) return false;
      return openBagLegendaryDiscovery(card, index, ports);
    } else if (compatibility.kind === 'mystery') {
      operations = [{ op:'legacyMystery' }];
    } else {
      if (compatibility.amount <= 0) { UI.log(`道具卡【${card.name}】当前没有可在背包中使用的效果；卡牌未消耗`, 'warn'); return false; }
      operations = [{ op:'heal', amount:compatibility.amount }];
    }
    const result = useOrdinaryBagRule(card, index, operations, ports);
    return compatibility.kind === 'crystal' || compatibility.kind === 'restore' ? Promise.resolve(result) : result;
  }
  return { useOwnedCard };
}
