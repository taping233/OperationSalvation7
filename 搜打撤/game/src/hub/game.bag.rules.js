import { esc } from '../core/shared.js';

/**
 * 结构化背包用法的地图侧消费器。
 * 只结算 heal / restoreConsumed / classAbility acquire；依赖由背包壳注入，避免规则片反向依赖壳。
 */
export function useStructuredBagRule(card, ownedIndex, {
  UI, SDT, game, Random, newUid, saveGame, showBackpack, usedSlots, bagCap,
}) {
  const bagRules = card.rules?.bag;
  if (!bagRules || !Object.hasOwn(bagRules, 'use')) return false;
  const operations = Array.isArray(bagRules.use) ? bagRules.use : [];
  if (!operations.length) return false;
  const mapSide = operations.filter(operation => operation &&
    (operation.op === 'heal' || operation.op === 'restoreConsumed' ||
      (operation.op === 'acquire' && operation.pool?.kind === 'classAbility')));
  if (!mapSide.length) {
    UI.log(`道具卡【${esc(card.name)}】的效果需要在战斗中使用`, 'warn');
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
      if (game.hp >= game.maxHp) { UI.log('生命值已满，暂时不需要使用', 'warn'); continue; }
      consume();
      game.heal(heal);
    }
    if (operation.op === 'restoreConsumed' && Number.isInteger(operation.amount) && operation.amount > 0) {
      if (!game.usedPocket.length) { UI.log('消耗口袋是空的，无需复原', 'warn'); continue; }
      consume();
      let count = 0;
      while (game.usedPocket.length && count < operation.amount && usedSlots() < bagCap()) {
        const pocketEntry = game.usedPocket[0];
        game.ownedCards.push({ uid: newUid(), card: { ...pocketEntry.card } });
        pocketEntry.count--;
        if (pocketEntry.count <= 0) game.usedPocket.shift();
        count++;
      }
      const leftCount = game.usedPocket.reduce((total, entry) => total + entry.count, 0);
      UI.log(`[[icon:gem]] 复原了消耗口袋中的 <b>${count}</b> 张卡牌` +
        (leftCount && usedSlots() >= bagCap() ? `（背包已满，剩 ${leftCount} 张留在口袋）` : ''), 'ok');
    }
    if (operation.op === 'acquire' && operation.pool?.kind === 'classAbility') {
      const pool = SDT.Cards.classPool(game.myClass).filter(candidate => candidate.type === '能力卡');
      if (!pool.length) { UI.log('该职业没有可觉醒的能力卡', 'warn'); continue; }
      consume();
      const got = pool[Math.floor(Random.random('loot') * pool.length)];
      game.ownedCards.push({ uid: newUid(), card: { ...got } });
      UI.log(`[[icon:sparkles]] 使用【<b>${esc(card.name)}</b>】觉醒：获得本职业能力卡【<b>${esc(got.name)}</b>】`, 'loot');
    }
  }
  if (consumedCard) {
    saveGame();
    showBackpack(true);
    return true;
  }
  UI.log(`道具卡【${esc(card.name)}】的结构化背包用法无效`, 'warn');
  return true;
}
