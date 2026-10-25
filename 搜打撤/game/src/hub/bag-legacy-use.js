import { esc } from '../core/shared.js';
import { playOutcomeFeedback } from '../ui/outcome-feedback.js';
import { bagUseCompatibility, grantsApolloBonus, isBattleOnlyBagCard } from './bag-use-compatibility.js';
import { restorationCapacityReason, useStructuredBagRule, canReplaceBagCard, canReceiveBagCard, openBagLegendaryDiscovery } from './game.bag.rules.js';

// Owns item execution; page actions and the run validity port are supplied by the shell.
export function createLegacyBagUse({ UI, game, readCards, baseCap, items, Random, newUid,
  saveGame, showBackpack, usedSlots, bagCap, captureContext, setBagReceipt }) {
  const SDT = { get Cards() { return readCards(); }, Base:{ bagCap:baseCap } };
  /** @type {null|(()=>boolean)} */
  let restorationOwner = null;
  async function restoreLegacy(index, card, kind, current, limit = kind === 'crystal' ? 3 : 2) {
    if (!game.usedPocket.length) { UI.log('消耗区是空的，无需复原', 'warn'); return false; }
    const capacity = { usedSlots, bagCap, baseCap };
    const blocked = restorationCapacityReason(game, index, capacity);
    if (blocked) { UI.log(`${blocked}；卡牌未消耗`, 'warn'); return false; }
    const entries = game.ownedCards, pocket = game.usedPocket, source = entries[index];
    const sameRun = captureContext();
    const ownsState = () => sameRun() && game.ownedCards === entries && game.usedPocket === pocket;
    const body = UI.el?.ovBody, root = body?.firstElementChild;
    const wasInert = !!root?.inert;
    if (root) root.inert = true;
    const ownsView = () => ownsState() && current() && (!body || (UI.el.ovBody === body && body.firstElementChild === root));
    const touched = new Map(), added = [], originalPocket = pocket.slice();
    const rollback = () => {
      if (!ownsState()) return;
      for (const entry of added) { const at = entries.indexOf(entry); if (at >= 0) entries.splice(at, 1); }
      if (!entries.includes(source)) entries.splice(Math.min(index, entries.length), 0, source);
      for (const [entry, count] of touched) {
        entry.count += count;
        if (!pocket.includes(entry)) pocket.splice(Math.min(originalPocket.indexOf(entry), pocket.length), 0, entry);
      }
    };
    restorationOwner = ownsState;
    let count = 0, capacityWarning = false, committed = false;
    try {
      entries.splice(index, 1);
      while (pocket.length && count < limit) {
        const pocketIndex = pocket.findIndex(entry => entry?.card && entry.count > 0 && canReceiveBagCard(game, entry.card, capacity));
        if (pocketIndex < 0) { capacityWarning = true; break; }
        const entry = pocket[pocketIndex], output = { uid:newUid(), card:{ ...entry.card } };
        entries.push(output); added.push(output);
        touched.set(entry, (touched.get(entry) || 0) + 1);
        entry.count--; if (entry.count <= 0) pocket.splice(pocketIndex, 1);
        count++;
      }
      const saved = await saveGame();
      if (saved === false || (kind !== 'structured' && saved !== true)) throw new Error('restore save failed');
      committed = true;
      if (!ownsView()) return true;
      await playOutcomeFeedback(body,{kind:'restore',cards:added.map(entry=>entry.card),source:card.name,sourceCard:card,
        cardHTML:entry=>readCards().cardHTML?.(entry,'sm') || esc(entry.name),isCurrent:ownsView});
      if (!ownsView()) return true;
      if (capacityWarning) UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()}），无法复原`, 'warn');
      const remaining = pocket.reduce((total, entry) => total + entry.count, 0);
      const message = kind === 'crystal' || kind === 'structured'
        ? `[[icon:gem]] 使用【<b>${esc(card.name)}</b>】：复原了消耗区中的 <b>${count}</b> 张卡牌${added.length ? `：${added.map(entry=>esc(entry.card.name)).join('、')}` : ''}` + (remaining ? `（${capacityWarning ? '背包已满，' : ''}剩 ${remaining} 张留在消耗区）` : '')
        : `[[icon:gem]] 使用【<b>${esc(card.name)}</b>】：复原了消耗区中的至多 <b>2</b> 张卡牌`;
      setBagReceipt(message.replace(/<[^>]*>|\[\[icon:[^\]]+\]\]/g, ''));
      UI.log(message, 'ok'); showBackpack(true); return true;
    } catch {
      // Presentation failures cannot undo a checkpoint already committed.
      if (committed) return true;
      rollback();
      if (ownsView()) { UI.log('复原未能保存；卡牌与消耗区已恢复，请重试。', 'warn'); showBackpack(true); }
      return false;
    } finally {
      if (root?.isConnected) root.inert = wasInert;
      if (restorationOwner === ownsState) restorationOwner = null;
    }
  }
  function useOwnedCard(uid, current = () => true) {
    if (!current() || game.battleActive || restorationOwner?.()) return false;
    const matches = game.ownedCards.filter(o => o.uid === uid && !o.safe && !o.stored && !o.pouchOf);
    if (matches.length !== 1) return false;
    const i = game.ownedCards.indexOf(matches[0]);
    if (i < 0) return;
    const card = game.ownedCards[i].card;
    const hpBefore = game.hp, currentRun = captureContext();
    if (card.type === '事件') { UI.log('[[icon:dice]] 事件卡只能在事件格中触发，无法在背包中使用（背包只记录触发历史）', 'warn'); return; }
    if (card.type !== '道具') { UI.log('只有道具卡可以直接使用', 'warn'); return; }
    if (isBattleOnlyBagCard(card)) { UI.log('神秘药水仅能在战斗中使用；卡牌未消耗', 'warn'); return; }
    const operations = card.rules?.bag?.use;
    if (Array.isArray(operations) && operations.length && operations.every(operation =>
      operation?.op === 'restoreConsumed' && Number.isInteger(operation.amount) && operation.amount > 0)) {
      return restoreLegacy(i, card, 'structured', current, operations.reduce((sum, operation) => sum + operation.amount, 0));
    }
    if (useStructuredBagRule(card, i, { UI, SDT, game, Random, newUid, saveGame, showBackpack, usedSlots, bagCap, captureContext, setReceipt: setBagReceipt })) return;
    const compatibility = bagUseCompatibility(card);
    if (compatibility.kind === 'crystal' || compatibility.kind === 'restore') {
      return restoreLegacy(i, card, compatibility.kind, current);
    }
    // 资源卡：口粮 / 木材（直接转化为背包物资，可用于基地升级）
    if (compatibility.kind === 'rations') {
      game.ownedCards.splice(i, 1);
      UI.log(`使用资源卡【<b>${esc(card.name)}</b>】`, 'sys');
      game.addItem(items.rations, compatibility.amount);
      showBackpack(true);
      return;
    }
    if (compatibility.kind === 'wood') {
      game.ownedCards.splice(i, 1);
      UI.log(`使用资源卡【<b>${esc(card.name)}</b>】`, 'sys');
      game.addItem(items.wood, compatibility.amount);
      showBackpack(true);
      return;
    }
    // 员工通行证B：直接随机获得，不进入「发现」候选页；棱彩牌明确排除。
    if (compatibility.kind === 'gold') {
      const pool = readCards().all().filter(c => c.rarity === '传说' && c.rarity !== '棱彩' && readCards().isRandomObtainable(c));
      if (!pool.length) { UI.log('卡牌库中没有可获得的传说卡', 'warn'); return; }
      const got = pool[Math.floor(Random.random('loot', 'reward') * pool.length)];
      if (!canReplaceBagCard(game, i, got, {usedSlots,bagCap,baseCap})) {
        UI.log('背包空间不足，先腾位再使用；卡牌未消耗', 'warn'); return;
      }
      game.ownedCards.splice(i, 1);
      game.ownedCards.push({ uid: newUid(), card: { ...got } });
      UI.log(`[[icon:sparkles]] 使用【<b>${esc(card.name)}</b>】：获得传说卡【<b>${esc(got.name)}</b>】`, 'loot');
      UI.showLegendGet(got);   // 2026-09-07 留言：传说获得要有提示界面
      saveGame();
      showBackpack(true);
      return;
    }
    // 2026-09-06 #10：员工通行证A（觉醒）→ 获得本职业能力卡
    if (compatibility.kind === 'awaken') {
      const pool = readCards().classPool(game.myClass).filter(c => c.type === '能力卡');
      if (!pool.length) { UI.log('该职业没有可觉醒的能力卡', 'warn'); return; }
      const got = pool[Math.floor(Random.random('loot', 'reward') * pool.length)];
      if (!canReplaceBagCard(game, i, got, {usedSlots,bagCap,baseCap})) {
        UI.log('背包空间不足，先腾位再使用；卡牌未消耗', 'warn'); return;
      }
      game.ownedCards.splice(i, 1);
      game.ownedCards.push({ uid: newUid(), card: { ...got } });
      UI.log(`[[icon:sparkles]] 使用【<b>${esc(card.name)}</b>】觉醒：获得本职业能力卡【<b>${esc(got.name)}</b>】`, 'loot');
      saveGame();
      showBackpack(true);
      return;
    }
    // 未带结构化规则的旧卡快照也走同一发现选择入口。
    if (compatibility.kind === 'discover') {
      openBagLegendaryDiscovery(card, i, { UI, SDT, game, Random, newUid, saveGame, showBackpack,
        usedSlots, bagCap, captureContext,
        setReceipt:setBagReceipt });
      return;
    }
    // 2026-09-06 #15：神秘药水（随机神秘效果）→ 背包中随机三选一
    if (compatibility.kind === 'mystery') {
      game.ownedCards.splice(i, 1);
      const r = Random.random('loot', 'reward');
      if (r < 1 / 3) {
        game.heal(8);
        UI.log('[[icon:flask]] 神秘药水：回复 <b>8</b> 点生命', 'ok');
      } else if (r < 2 / 3) {
        game.coins += 3;
        UI.log('[[icon:flask]] 神秘药水：获得 <b>3</b> 币', 'coin');
      } else {
        const canTake = (c) => (game.canReceiveCard ? game.canReceiveCard(c) : game.canAcceptCard(c));
        const pool = readCards().all().filter(c => readCards().isRandomObtainable(c));
        const got = pool.length ? pool[Math.floor(Random.random('loot', 'reward') * pool.length)] : null;
        const took = !!got && canTake(got);
        if (took) {
          game.ownedCards.push({ uid: newUid(), card: { ...got } });
          // 阿猫的礼物（2026-09-12 实装）：随机获取该牌时附赠另 1 张随机卡牌
          if (grantsApolloBonus(got)) {
            const pool2 = readCards().all().filter(c => readCards().isRandomObtainable(c) && !grantsApolloBonus(c));
            const got2 = pool2.length ? pool2[Math.floor(Random.random('loot', 'reward') * pool2.length)] : null;
            if (got2 && canTake(got2)) {
              game.ownedCards.push({ uid: newUid(), card: { ...got2 } });
              UI.log(`[[icon:bolt]] <b>阿猫的礼物</b>：随机获取触发，附赠【<b>${esc(got2.name)}</b>】`, 'loot');
            } else if (got2) {
              UI.log(`[[icon:bolt]] <b>阿猫的礼物</b>：背包已满，附赠的【${esc(got2.name)}】没能放进背包`, 'warn');
            }
          }
        }
        UI.log(`[[icon:flask]] 神秘药水：${took ? `随机获得【<b>${esc(got.name)}</b>】` : got ? `背包已满，【${esc(got.name)}】没能放进背包` : '没有可获得卡牌'}`, took ? 'loot' : 'warn');
      }
      saveGame();
      showBackpack(true);
      return;
    }
    const heal = compatibility.amount;
    if (heal <= 0) { UI.log(`道具卡【${card.name}】的效果将在 M1 战斗中实装`, 'warn'); return; }
    if (game.hp >= game.maxHp) { UI.log('生命值已满，暂时不需要使用', 'warn'); return; }
    game.ownedCards.splice(i, 1);
    UI.log(`使用道具卡【<b>${esc(card.name)}</b>】`, 'sys');
    game.heal(heal);
    saveGame();
    showBackpack(true); // 刷新背包
    playOutcomeFeedback(UI.el?.ovBody,{kind:'heal',hpBefore,hpAfter:game.hp,maxHp:game.maxHp,
      source:card.name,sourceCard:card,cardHTML:entry=>readCards().cardHTML?.(entry,'sm') || esc(entry.name),isCurrent:currentRun});
  }

  return { useOwnedCard };
}
