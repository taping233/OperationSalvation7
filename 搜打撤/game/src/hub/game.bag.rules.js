import { esc } from '../core/shared.js';
import { stackCapOf, canReceiveCardFromBag, canAcceptCardAtCapacity } from '../core/card-capacity.js';

const isMapBagOperation = operation => operation &&
  (operation.op === 'heal' || operation.op === 'restoreConsumed' ||
    (['acquire', 'discover'].includes(operation.op) && ['classAbility', 'legendary'].includes(operation.pool?.kind)));

// 复用地图消费器支持的操作；未知/旧文本卡不推断用途，保留原执行回退。
export function bagUseLocation(card) {
  if (card?.type !== '道具') return null;
  if (card.id === 'tt3-mystery-potion') return 'battle'; // 既有地图禁用例外
  if (card.id === 'tt4-shine-token') return 'map'; // 同时覆盖尚无结构化bag规则的旧卡快照
  const operations = card.rules?.bag?.use;
  if (!Array.isArray(operations) || !operations.length) return null;
  return operations.some(isMapBagOperation) ? 'map' : 'battle';
}

// Match the existing restore loop's capacity rule without removing a real card during preview.
export function restorationCapacityReason(game, ownedIndex, { usedSlots, bagCap }) {
  const entry = game.ownedCards[ownedIndex];
  if (!entry) return '';
  const same = game.ownedCards.filter(o => !o.safe && !o.stored && o.card.name === entry.card.name).length;
  const freesSlot = !entry.safe && !entry.stored && same % stackCapOf(entry.card) === 1;
  return usedSlots() - Number(freesSlot) >= bagCap() ? '背包空间不足，先腾位再复原' : '';
}

export function bagUseStatus(card, uid, { game, usedSlots, bagCap }) {
  if (card.id === 'tt3-mystery-potion') return { label:'仅战斗中使用', badge:'战斗使用', reason:'神秘药水仅能在战斗中使用' };
  if (bagUseLocation(card) === 'battle') return { label:'仅战斗中使用', badge:'战斗使用', reason:'该道具的效果需要在战斗中使用' };
  const operations = card.rules?.bag?.use;
  const structured = Array.isArray(operations) && operations.length > 0;
  // Only pure effects can be ruled out here: mixed cards may still have another useful effect.
  const restoreOnly = structured && operations.every(op => op?.op === 'restoreConsumed');
  const legacyRestore = !structured && ['cmtn6bge52qt', 'tt-crystal'].includes(card.id);
  if (structured && operations.every(op => op?.op === 'heal') && game.hp >= game.maxHp) {
    return { label:'生命值已满，无需治疗', badge:'生命已满', reason:'生命值已满，暂时不需要使用；卡牌未消耗' };
  }
  const empty = (restoreOnly || legacyRestore) && !game.usedPocket.length;
  if (empty) return { label:'消耗区为空，无法复原', badge:'无可复原卡', reason:'消耗区是空的，无需复原' };
  const capacityReason = restoreOnly || legacyRestore
    ? restorationCapacityReason(game, game.ownedCards.findIndex(o => o.uid === uid), { usedSlots, bagCap }) : '';
  if (capacityReason) return { label:capacityReason, badge:'需腾位', reason:`${capacityReason}；卡牌未消耗` };
  return { label:'使用这张道具', badge:bagUseLocation(card) === 'map' ? '可用' : '查看用法', reason:'' };
}

// 使用同叠道具未必腾出一格；先预估移除源牌后的真实容量，再接收奖励。
export function canReplaceBagCard(game, ownedIndex, card, { usedSlots, bagCap, baseCap = bagCap }) {
  const entry = game.ownedCards[ownedIndex];
  if (!entry) return false;
  const same = game.ownedCards.filter(o => !o.safe && !o.stored && o.card.name === entry.card.name).length;
  const cap = stackCapOf(entry.card);
  const frees = !entry.safe && !entry.stored && Math.ceil(same / cap) > Math.ceil((same - 1) / cap);
  const projected = usedSlots() - Number(frees);
  return canReceiveCardFromBag(card, { ownedCards:game.ownedCards.filter((_, i) => i !== ownedIndex),
    canAcceptCard:target => canAcceptCardAtCapacity(target, {usedSlots:projected,baseCap:baseCap(),totalCap:bagCap()}) });
}


/**
 * 结构化背包用法的地图侧消费器。
 * 结算治疗、复原与直接获取；依赖由背包壳注入，避免规则片反向依赖壳。
 */
export function useStructuredBagRule(card, ownedIndex, {
  UI, SDT, game, Random, newUid, saveGame, showBackpack, usedSlots, bagCap, setReceipt = () => {},
}) {
  const bagRules = card.rules?.bag;
  if (!bagRules || !Object.hasOwn(bagRules, 'use')) return false;
  const operations = Array.isArray(bagRules.use) ? bagRules.use : [];
  if (!operations.length) return false;
  const mapSide = operations.filter(isMapBagOperation);
  const receipts = [];
  const report = (message, tone) => { UI.log(message, tone); receipts.push(message.replace(/<[^>]*>|\[\[icon:[^\]]+\]\]/g, '')); };
  if (!mapSide.length) {
    setReceipt(`道具卡【${card.name}】的效果需要在战斗中使用；卡牌未消耗。`);
    UI.log(`道具卡【${esc(card.name)}】的效果需要在战斗中使用`, 'warn');
    showBackpack(true);
    return true;
  }
  let consumedCard = false;
  const consume = () => {
    if (consumedCard) return;
    game.ownedCards.splice(ownedIndex, 1);
    UI.log(`使用道具卡【<b>${esc(card.name)}</b>】`, 'sys');
    consumedCard = true;
  };
  for (const operation of mapSide) {
    if (operation.op === 'heal') {
      const heal = operation.amountField === 'heal' ? card.heal : operation.amount;
      if (typeof heal !== 'number' || !Number.isFinite(heal) || heal <= 0) {
        UI.log(`道具卡【${esc(card.name)}】的结构化治疗数值无效`, 'warn');
        continue;
      }
      if (game.hp >= game.maxHp) { report('生命值已满，暂时不需要使用；卡牌未消耗', 'warn'); continue; }
      consume();
      game.heal(heal);
      report(`使用【${esc(card.name)}】后生命 ${game.hp}/${game.maxHp}`, 'ok');
    }
    if (operation.op === 'restoreConsumed' && Number.isInteger(operation.amount) && operation.amount > 0) {
      if (!game.usedPocket.length) { report('消耗区是空的，无需复原；卡牌未消耗', 'warn'); continue; }
      const capacityReason = consumedCard ? (usedSlots() >= bagCap() ? '背包空间不足，先腾位再复原' : '')
        : restorationCapacityReason(game, ownedIndex, { usedSlots, bagCap });
      if (capacityReason) { report(`${capacityReason}${consumedCard ? '' : '；卡牌未消耗'}`, 'warn'); continue; }
      consume();
      let count = 0;
      const restored = [];
      while (game.usedPocket.length && count < operation.amount && usedSlots() < bagCap()) {
        const pocketEntry = game.usedPocket[0];
        game.ownedCards.push({ uid: newUid(), card: { ...pocketEntry.card } });
        restored.push(pocketEntry.card.name);
        pocketEntry.count--;
        if (pocketEntry.count <= 0) game.usedPocket.shift();
        count++;
      }
      const leftCount = game.usedPocket.reduce((total, entry) => total + entry.count, 0);
      report(`[[icon:gem]] 复原了消耗区中的 <b>${count}</b> 张卡牌${restored.length ? `：${restored.map(esc).join('、')}` : ''}` +
        (leftCount && usedSlots() >= bagCap() ? `（背包已满，剩 ${leftCount} 张留在消耗区）` : ''), 'ok');
    }
    if (operation.op === 'acquire' || operation.op === 'discover') {
      const legendary = operation.pool?.kind === 'legendary';
      const pool = legendary ? SDT.Cards.all().filter(candidate => candidate.rarity === '传说' && SDT.Cards.isRandomObtainable(candidate))
        : SDT.Cards.classPool(game.myClass).filter(candidate => candidate.type === '能力卡');
      if (!pool.length) { report(legendary ? '卡牌库中没有可获得的传说卡；卡牌未消耗' : '该职业没有可觉醒的能力卡；卡牌未消耗', 'warn'); continue; }
      const got = pool[Math.floor(Random.random('loot') * pool.length)];
      if (!consumedCard && !canReplaceBagCard(game, ownedIndex, got, {usedSlots,bagCap,baseCap:SDT.Base?.bagCap || bagCap})) {
        report('背包空间不足，先腾位再使用；卡牌未消耗', 'warn'); continue;
      }
      consume();
      game.ownedCards.push({ uid: newUid(), card: { ...got } });
      report(`[[icon:sparkles]] 使用【<b>${esc(card.name)}</b>】：获得${legendary ? '传说卡' : '本职业能力卡'}【<b>${esc(got.name)}</b>】`, 'loot');
    }
  }
  if (consumedCard) {
    saveGame();
    setReceipt(receipts.join('；'));
    showBackpack(true);
    return true;
  }
  setReceipt(receipts.join('；') || `道具卡【${card.name}】的结构化背包用法无效；卡牌未消耗。`);
  showBackpack(true);
  return true;
}
