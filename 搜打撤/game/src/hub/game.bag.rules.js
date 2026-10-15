import { esc } from '../core/shared.js';

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
  const mapSide = operations.filter(operation => operation &&
    (operation.op === 'heal' || operation.op === 'restoreConsumed' ||
      (operation.op === 'acquire' && ['classAbility', 'legendary'].includes(operation.pool?.kind))));
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
    if (operation.op === 'acquire') {
      const legendary = operation.pool?.kind === 'legendary';
      const pool = legendary ? SDT.Cards.all().filter(candidate => candidate.rarity === '传说' && SDT.Cards.isRandomObtainable(candidate))
        : SDT.Cards.classPool(game.myClass).filter(candidate => candidate.type === '能力卡');
      if (!pool.length) { report(legendary ? '卡牌库中没有可获得的传说卡；卡牌未消耗' : '该职业没有可觉醒的能力卡；卡牌未消耗', 'warn'); continue; }
      consume();
      const got = pool[Math.floor(Random.random('loot') * pool.length)];
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
