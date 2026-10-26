import { esc } from '../core/shared.js';
import { grantsApolloBonus } from './bag-use-compatibility.js';

export const isRestorableBagEntry = entry => !!entry?.card && entry.count > 0;

// Preview and execution share deterministic recovery checks; receipt capacity
// remains a caller port so execution can recheck after earlier effects consume.
export function bagRecoveryStatus(card, operation, game, capacityReason = () => '') {
  if (operation.op === 'heal') {
    const amount = operation.amountField === 'heal' ? card.heal : operation.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return { label:'治疗数值无效，无法使用', badge:'效果无效', reason:'道具卡的结构化治疗数值无效；卡牌未消耗' };
    }
    if (game.hp >= game.maxHp) return { label:'生命值已满，无需治疗', badge:'生命已满', reason:'生命值已满，暂时不需要使用；卡牌未消耗' };
  }
  if (operation.op === 'restoreConsumed') {
    if (!Number.isInteger(operation.amount) || operation.amount <= 0) {
      return { label:'复原数量无效，无法使用', badge:'效果无效', reason:'道具卡的结构化复原数量无效；卡牌未消耗' };
    }
    if (!game.usedPocket.some(isRestorableBagEntry)) {
      return { label:game.usedPocket.length ? '消耗区无可复原卡，无法复原' : '消耗区为空，无法复原', badge:'无可复原卡',
        reason:game.usedPocket.length ? '消耗区没有可复原的卡牌；卡牌未消耗' : '消耗区是空的，无需复原' };
    }
    const reason = capacityReason();
    if (reason) return { label:reason, badge:'需腾位', reason:`${reason}；卡牌未消耗` };
  }
  return null;
}

// The ordinary and compatibility entrances provide operations to this one
// executor; all mutations and delayed feedback belong to the use transaction.
export function executeBagItemEffects(card, operations, {
  game, SDT, Random, usedSlots, bagCap, canReplace, canReceive, items,
}, tx) {
  const pick = pool => pool.length ? pool[Math.floor(Random.random('loot', 'reward') * pool.length)] : null;
  const canTake = got => tx.consumed ? canReceive(got) : canReplace(got);
  for (const [step, operation] of operations.entries()) {
    const status = bagRecoveryStatus(card, operation, game, () =>
      game.usedPocket.some(entry => isRestorableBagEntry(entry) && canTake(entry.card)) ? '' : '背包空间不足，先腾位再复原');
    if (status) { tx.report(tx.consumed ? status.reason.replace('；卡牌未消耗', '') : status.reason, 'warn'); continue; }
    if (operation.op === 'heal') {
      const amount = operation.amountField === 'heal' ? card.heal : operation.amount;
      tx.consume(); tx.heal(amount);
      tx.report(`使用【${esc(card.name)}】后生命 ${game.hp}/${game.maxHp}`, 'ok');
    }
    if (operation.op === 'restoreConsumed') {
      tx.consume();
      const restored = [];
      while (game.usedPocket.length && restored.length < operation.amount) {
        const entry = game.usedPocket.find(candidate => isRestorableBagEntry(candidate) && canReceive(candidate.card));
        if (!entry) break;
        tx.restore(entry); restored.push(entry.card.name);
      }
      const remaining = game.usedPocket.reduce((total, entry) => total + entry.count, 0);
      tx.report(`[[icon:gem]] 复原了消耗区中的 <b>${restored.length}</b> 张卡牌${restored.length ? `：${restored.map(esc).join('、')}` : ''}`
        + (remaining && usedSlots() >= bagCap() ? `（背包已满，剩 ${remaining} 张留在消耗区）` : ''), 'ok');
    }
    if (operation.op === 'acquire') {
      const legendary = operation.pool?.kind === 'legendary';
      const got = tx.choose(`acquire:${step}`, () => pick(legendary
        ? SDT.Cards.all().filter(candidate => candidate.rarity === '传说' && SDT.Cards.isRandomObtainable(candidate))
        : SDT.Cards.classPool(game.myClass).filter(candidate => candidate.type === '能力卡')));
      if (!got) { tx.report(legendary ? '卡牌库中没有可获得的传说卡；卡牌未消耗' : '该职业没有可觉醒的能力卡；卡牌未消耗', 'warn'); continue; }
      if (!canTake(got)) { tx.report('背包空间不足，先腾位再使用；卡牌未消耗', 'warn'); continue; }
      tx.consume(); tx.addCard(got);
      tx.report(`[[icon:sparkles]] 使用【<b>${esc(card.name)}</b>】：获得${legendary ? '传说卡' : '本职业能力卡'}【<b>${esc(got.name)}</b>】`, 'loot');
      if (legendary && operation.legendNotice) tx.notifyLegend(got);
    }
    if (operation.op === 'resource') {
      tx.consume(); tx.addItem(items[operation.kind], operation.amount);
      tx.report(`使用资源卡【<b>${esc(card.name)}</b>】`, 'sys');
    }
    if (operation.op === 'legacyMystery') {
      tx.consume();
      const roll = tx.choose(`mystery:${step}`, () => Random.random('loot', 'reward'));
      if (roll < 1 / 3) { tx.heal(8); tx.report('[[icon:flask]] 神秘药水：回复 <b>8</b> 点生命', 'ok'); }
      else if (roll < 2 / 3) { tx.addCoins(3); tx.report('[[icon:flask]] 神秘药水：获得 <b>3</b> 币', 'coin'); }
      else {
        const canReceiveMystery = got => game.canReceiveCard ? game.canReceiveCard(got) : game.canAcceptCard(got);
        const got = tx.choose(`mystery-card:${step}`, () => pick(SDT.Cards.all().filter(candidate => SDT.Cards.isRandomObtainable(candidate))));
        const took = !!got && canReceiveMystery(got);
        if (took) {
          tx.addCard(got);
          if (grantsApolloBonus(got)) {
            const bonus = tx.choose(`mystery-bonus:${step}`, () => pick(SDT.Cards.all().filter(candidate => SDT.Cards.isRandomObtainable(candidate) && !grantsApolloBonus(candidate))));
            if (bonus && canReceiveMystery(bonus)) {
              tx.addCard(bonus); tx.report(`[[icon:bolt]] <b>阿猫的礼物</b>：随机获取触发，附赠【<b>${esc(bonus.name)}</b>】`, 'loot');
            } else if (bonus) tx.report(`[[icon:bolt]] <b>阿猫的礼物</b>：背包已满，附赠的【${esc(bonus.name)}】没能放进背包`, 'warn');
          }
        }
        tx.report(`[[icon:flask]] 神秘药水：${took ? `随机获得【<b>${esc(got.name)}</b>】` : got ? `背包已满，【${esc(got.name)}】没能放进背包` : '没有可获得卡牌'}`, took ? 'loot' : 'warn');
      }
    }
  }
}
