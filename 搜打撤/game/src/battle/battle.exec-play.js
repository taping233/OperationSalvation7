/* battle.exec-play.js —— 出牌结算长流程（自 battle.engine.js 拆出）。
 * queueCardExecution 手牌支付校验与出牌动作入队；execPlay 扣费、注能燃料、结算重放与
 * 打出侧登记。状态读写经 battle.runtime.js（活绑定 + set$Xxx）直连；与 engine 互递归的
 * 规则核结算件由 createBattleExecPlay 注入，engine 侧保留一行转发 shim 维持具名导出面。 */
const SDT = window.SDT;
import { esc } from '../core/shared.js';
import { removeUid } from './battle.piles.js';
import { targetSideFor } from './battle.rules.js';
import { throwIfActionCancelled } from './battle.staged-playback.js';
import { G, foes, mode, hand, discard, played, consumed, grave, energy, delayed, cardAnims, freeCast, infuseFuels, consumeFireballN, allSpellsInfused, growthNames, killAtkUp, playerCurseImmune, arrowRune, nextSpellTwice, poisonOnSpell, playedMovesThisTurn, playedMartialThisTurn, activeActionSignal, battleState, set$hand, set$energy, set$infuseFuels, set$nextSpellTwice, set$killAtkUp, set$poisonOnSpell, set$poisonLegacy, set$playerCurseImmune, set$allSpellsInfused, set$lastPlayedType, set$playedMovesThisTurn, set$playedMartialThisTurn, set$activeActionSignal, set$handSelecting, nextActionSeq } from './battle.runtime.js';

const R = () => SDT.MAP.rules;
const alive = () => foes.filter(foe => !foe.dead);

export function createBattleExecPlay({
  requestBattleRender, findCard, matchHandSelectKey, fireConsumeTriggers, effCostOf,
  resolveInfusedFuel, runStagedSteps, consumeFireballSteps, resolveCardWithFeedback,
  takeSurge, registerEquip, summonAlly, applyKillRewards, poisonRandomFoe, applyImitate,
  beginDartStrike, sweepDead, finish, processChoice, processDiscoverQueue, queueBattleAction,
}) {
  function queueCardExecution(uid, card, fuelUids, target, freeCost, requirementsPaid = false, paymentUids = [], onResolved = null) {
    const handRequirement = card?.rules?.battle?.requirements?.find(rule => rule.kind === 'handCards');
    if (handRequirement && !requirementsPaid) {
      const excludedUids = [...new Set([uid, ...(fuelUids || [])])];
      const available = hand.filter(handUid => {
        if (excludedUids.includes(handUid)) return false;
        const entry = findCard(handUid);
        return entry && matchHandSelectKey(entry.card, handRequirement.type);
      });
      if (available.length < handRequirement.count) {
        G.log(`[[icon:cross]] 【${esc(card.name)}】无法打出：手牌支付不足，需要 ${handRequirement.count} 张${handRequirement.type ? `「${esc(handRequirement.type)}」` : ''}，现有 ${available.length} 张`, 'warn');
        return false;
      }
      set$handSelecting({
        act: 'payment', mandatory: true, n: handRequirement.count, type: handRequirement.type || null,
        excludedUids, selectedUids: [],
        payment: { uid, card, fuelUids: [...(fuelUids || [])], target, freeCost, onResolved },
      });
      requestBattleRender();
      return false;
    }
    if (handRequirement && requirementsPaid && paymentUids.length !== handRequirement.count) return false;
    const battleToken = battleState.token;
    const receipt = Object.freeze({ battleToken, actionSeq: nextActionSeq() });
    queueBattleAction(async signal => {
      const resolved = await execPlay(uid, card, fuelUids, target, freeCost, signal, receipt, paymentUids);
      throwIfActionCancelled(signal);
      if (resolved && onResolved && G?.battleActive) onResolved();
    }, '出牌动作');
  }

  async function execPlay(uid, card, fuelUids, target, freeCost, signal, receipt, paymentUids = []) {
    set$activeActionSignal(signal);
    try {
    throwIfActionCancelled(signal);
    const handRequirement = card?.rules?.battle?.requirements?.find(rule => rule.kind === 'handCards');
    if (handRequirement) {
      const excludedUids = new Set([uid, ...(fuelUids || [])]);
      const validPayment = paymentUids.length === handRequirement.count &&
        new Set(paymentUids).size === paymentUids.length &&
        paymentUids.every(paymentUid => {
          if (excludedUids.has(paymentUid) || !hand.includes(paymentUid)) return false;
          const entry = findCard(paymentUid);
          return entry && matchHandSelectKey(entry.card, handRequirement.type);
        });
      if (!validPayment) {
        G.log(`[[icon:cross]] 【${esc(card.name)}】手牌支付未完成，本次打出已取消`, 'warn');
        return false;
      }
      // Commit all selected payment cards together before charging or playing the source card.
      const paid = new Set(paymentUids);
      const entries = paymentUids.map(paymentUid => findCard(paymentUid));
      set$hand(hand.filter(handUid => !paid.has(handUid)));
      for (let i = 0; i < paymentUids.length; i++) {
        const paymentUid = paymentUids[i];
        const entry = entries[i];
        consumed.push(paymentUid);
        cardAnims.push({ kind: 'burn', uid: paymentUid, name: entry.card.name });
        G.log(`[[icon:flask]] 消耗了手牌中的【<b>${esc(entry.card.name)}</b>】作为出牌代价`, 'sys');
      }
      entries.forEach(entry => fireConsumeTriggers(entry.card, null));
      throwIfActionCancelled(signal);
    }
    freeCast.delete(uid);
    const effCost = effCostOf(card, uid);
    if (effCost !== card.cost) G.log(`[[icon:sparkles]] <b>费用变化</b>：【${esc(card.name)}】按 <b>${effCost}</b> 费打出（原 ${card.cost} 费）`, 'sys');
    if (!freeCost) set$energy(energy - (effCost));
    played.push(uid);
    SDT.Sound.sfx('card');
    removeUid(hand, uid);
    cardAnims.push({
      kind: 'play', uid, name: card.name, type: card.type,
      side: targetSideFor(card, SDT.Cards.DMG_TYPES),
      target: target && !target.dead ? foes.indexOf(target) : null,
      receipt,
    });
    fuelUids.forEach(f => removeUid(hand, f));
    for (const f of fuelUids) {
      consumed.push(f);
      // v0.25：被消耗的牌进入墓地——墓地不参与洗回，战胜 BOSS 后可在整理背包放回
      if (mode === 'boss') grave.push(f);
      const o = findCard(f);
      cardAnims.push({ kind: 'burn', uid: f, name: o ? o.card.name : '' });
      G.log(`[[icon:flask]] <b>${esc(card.name)}</b> 注能：消耗了【<b>${esc(o ? o.card.name : '?')}</b>】${mode === 'boss' ? '（进墓地，不参与洗回）' : '（战后进消耗口袋，可在火堆复原）'}`, 'sys');
      // 被牺牲的牌并没有被「使用」：不结算主效果，只结算它的「被注能时」条件效果
      if (o) resolveInfusedFuel(o.card, target);
      throwIfActionCancelled(signal);
      // Q2 老板定向：注能牺牲也算「消耗该牌时」触发（沉船宝盒/百炼青虹剑/矿工炸药/奥术残卷）
      if (o) fireConsumeTriggers(o.card, target);
      set$infuseFuels(infuseFuels + 1);   // 元素符印解锁计数
      // 深渊降焰（降临者英雄）：每消耗 1 张卡牌，自动施放 1 次火球
      if (consumeFireballN > 0) await runStagedSteps(consumeFireballSteps(consumeFireballN), signal);
    }
    if (mode === 'boss') discard.push(uid);
    const fuelCostSum = fuelUids.reduce((a, f) => {
      const o = findCard(f);
      return a + (o ? Math.max(0, +(o.card.cost || 0)) : 0);
    }, 0);
    // 深渊主宰·妲莉薇特「招式均已注能」（旧日再临）：可注能/必须注能的招式无需选燃料，直接按已注能结算
    const infusedBase = fuelUids.length > 0 || (allSpellsInfused && (card.type === '武术' || card.type === '法术'));
    const aliveBefore = alive().length;
    await resolveCardWithFeedback(card, target, infusedBase, fuelCostSum, uid, signal);
    await takeSurge(signal);   // 法力奔涌：演出未完不结束本次出牌动作；终局会中止余下结算
    // 2026-09-09 老板 #9：装备卡打出即穿戴（角色信息区显示装备与限定技能按钮）
    if (card.type === '装备') registerEquip(uid, card);
    // 「若本牌为最后一张手牌，效果触发 N 次」（急行军/破釜沉舟）：整卡效果再跑一遍。
    // 「永远被保留在手牌中」类卡（不朽斩）不计入手牌数——背包砸击已改按钮形态，
    // 不再向手牌置入常驻令牌，手牌检测天然不含砸击
    const lastRealCard = hand.every(u => {
      const o = findCard(u);
      return o && /永远被保留在手牌中/.test(String(o.card.desc || ''));
    });
    if (/最后一张手牌[^。；]*?触发\s*(\d+)?\s*次?/.test(String(card.desc || '')) && lastRealCard) {
      G.log(`[[icon:cards]] <b>${esc(card.name)}</b>：本牌是最后一张手牌，效果触发 2 次`, 'sys');
      await resolveCardWithFeedback(card, target, infusedBase, fuelCostSum, uid, signal);
      await takeSurge(signal);
    }
    // 「下一张法术施放 N 次」（元素风暴，注能打出时注册）：法术效果再跑一遍
    if (nextSpellTwice > 0 && card.type === '法术') {
      set$nextSpellTwice(0);
      G.log(`[[icon:sparkles]] <b>元素风暴</b>：这张法术额外施放 1 次`, 'sys');
      await resolveCardWithFeedback(card, target, infusedBase, fuelCostSum, uid, signal);
      await takeSurge(signal);
    }
    // —— 2026-09-09 补实装：打出侧登记（成长/被动/击杀结算/手牌变形）——
    if (/回合开始时[，,]?\s*本牌伤害\s*\+/.test(String(card.desc || '')) && card.name) growthNames.add(card.name);
    if (/每消灭\s*1\s*个敌人[^。]*?\+\s*1\s*点?攻击力/.test(String(card.desc || ''))) set$killAtkUp(killAtkUp + 1);
    if (/每当你使用一张法术牌[^。]*中毒/.test(String(card.desc || ''))) set$poisonOnSpell(true);
    if (/死亡时[^。；]*中毒层数转移/.test(String(card.desc || ''))) set$poisonLegacy(true);
    // 旧日再临（深渊主宰·妲莉薇特，2026-09-16 定版）：免疫诅咒 + 招式均已注能 + 召唤 4 名无攻血封印肢体
    if (/免疫诅咒/.test(String(card.desc || ''))) {
      set$playerCurseImmune(true);
      G.log('[[icon:shield]] <b>旧日再临</b>：诅咒无法侵染深渊主宰', 'ok');
    }
    // 第十二批·邪能护体（2026-09-23）：「本回合免疫所有伤害和诅咒效果」——注能打出才登记；
    // 诅咒部分走 playerCurseImmune，下回合开始由 curseImmuneOff 还原（restore 记原值：
    // 深渊主宰的永久免疫在场时原值为 true，还原后仍免疫，不受本卡影响）。
    // 伤害部分由文本侧祝福·免疫伤害（buff.immune，n=1 回合）承担。
    if (infusedBase && /免疫所有伤害和诅咒效果/.test(String(card.desc || ''))) {
      const prior = playerCurseImmune;
      set$playerCurseImmune(true);
      delayed.push({ special: 'curseImmuneOff', restore: !!prior });
      G.log('[[icon:shield]] <b>邪能护体</b>：本回合免疫所有伤害与诅咒效果', 'ok');
    }
    if (/均视为已注能|均已注能/.test(String(card.desc || ''))) {
      set$allSpellsInfused(true);
      G.log('[[icon:sparkles]] <b>旧日再临</b>：所有可注能与必须注能的招式，均视为已注能', 'ok');
    }
    if (/召唤\s*4\s*名封印肢体/.test(String(card.desc || ''))) {
      summonAlly('封印肢体', 0, 0, 4, true);
      G.log('[[icon:paw]] 四条<b>封印肢体</b>重现世间——如天国之门般无攻无血的场面物件', 'sys');
    }
    // 箭矢符文：你的「箭」释放 2 次（第二段免费用）
    if (arrowRune && (card.name === '箭' || card.id === 'token-arrow')) {
      G.log('[[icon:runner]] <b>箭矢符文</b>：箭再度释放', 'sys');
      await resolveCardWithFeedback(card, target, infusedBase, fuelCostSum, uid, signal);
      await takeSurge(signal);
    }
    applyKillRewards(card, aliveBefore - alive().length);
    if (poisonOnSpell && card.type === '法术') poisonRandomFoe();
    // Q8 老板定向：不变应万变——打出武术后，手中所有「不变应万变」变为该武术的 1 费复制
    if (card.type === '武术') applyImitate(card);
    // 「永远被保留在手牌中」（不朽斩）：打出后回到手牌，不进弃牌堆
    if (/永远被保留在手牌中/.test(String(card.desc || ''))) {
      const di = discard.lastIndexOf(uid); if (di >= 0) discard.splice(di, 1);
      const pi = played.lastIndexOf(uid); if (pi >= 0) played.splice(pi, 1);
      if (hand.length < R().battleHandMax) {
        hand.push(uid);
        cardAnims.push({ kind: 'draw', uid, name: card.name });
        G.log(`[[icon:cards]] 【${esc(card.name)}】保留在手牌中（无法用于注能）`, 'sys');
      }
    }
    sweepDead();
    set$lastPlayedType(card.type);   // 供「上一张牌是武术→0费」类条件费用判定
    // 打出侧计数（结算后自增——「其他招式/其他武术」不含正在打出的本牌）：
    // 招式＝武术+法术（设计者 2026-09-10 定版）连续射击；追斩只数武术
    if (card.type === '武术' || card.type === '法术') set$playedMovesThisTurn(playedMovesThisTurn + 1);
    if (card.type === '武术') set$playedMartialThisTurn(playedMartialThisTurn + 1);
    if (card.id === 'tt7-bloodpoison') beginDartStrike();   // 二段点选（2026-09-16 留言「选择两次目标」）
    if (!alive().length) { finish(true); return false; }
    processChoice();
    processDiscoverQueue();
    requestBattleRender();
    return true;
    } finally {
      if (activeActionSignal === signal) set$activeActionSignal(null);
    }
  }

  return { queueCardExecution };
}
