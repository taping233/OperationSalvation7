import { requestedCardPlayed, requestedInfusion, requestedTargetReason } from '../effects/requested-card-runtime.js';
import { foeFightTargets, validFoeFightTargets, withFoeFightTargets } from '../effects/battle.foe-fight.js';
/* battle.exec-play.js —— 出牌结算长流程（自 battle.engine.js 拆出）。
 * queueCardExecution 手牌支付校验与出牌动作入队；execPlay 扣费、注能燃料、结算重放与
 * 打出侧登记。状态读写经 battle.runtime.js（活绑定 + set$Xxx）直连；与 engine 互递归的
 * 规则核结算件由 createBattleExecPlay 注入，engine 侧保留一行转发 shim 维持具名导出面。 */
const SDT = window.SDT;
import { esc } from '../../core/shared.js';
import { removeUid } from '../bag/battle.piles.js';
import { targetSideFor } from '../effects/battle.target-rules.js';
import { throwIfActionCancelled } from '../runtime/battle.staged-playback.js';
import { rejectUnsupportedCard } from '../effects/battle.rule-guard.js';
import { inspectCardRuleCapability } from '../../cards/card-rules.capability.js';
import { isHandPaymentCandidate } from './battle.hand-selection.js';
import { hasInfusionWaiver, missingInfusionReason } from '../effects/battle.infusion.js';
import { G, foes, mode, hand, discard, played, consumed, grave, energy, delayed, cardAnims, freeCast, infuseFuels, recordHandInfusion, consumeFireballN, allSpellsInfused, growthNames, killAtkUp, playerCurseImmune, arrowRune, nextSpellTwice, poisonOnSpell, playedMovesThisTurn, playedMartialThisTurn, activeActionSignal, battleState, effectiveHandMax, set$hand, set$energy, set$infuseFuels, set$nextSpellTwice, set$killAtkUp, set$poisonOnSpell, set$poisonLegacy, set$playerCurseImmune, set$allSpellsInfused, set$consumeFireballN, set$stealthStrike, set$lastPlayedType, set$playedMovesThisTurn, set$playedMartialThisTurn, set$activeActionSignal, set$handSelecting, nextActionSeq } from '../runtime/battle.runtime.js';

const R = () => SDT.MAP.rules;
const alive = () => foes.filter(foe => !foe.dead);

export function createBattleExecPlay({
  emitRecast = () => {},
  warnCardRuleRejection = message => G.log(message, 'warn'),
  requestBattleRender, findCard, findEffectiveCard, prepareExecutionCard, infusionFuelReason, fireConsumeTriggers, effCostOf,
  resolveInfusedFuel, runStagedSteps, consumeFireballSteps, resolveCardWithFeedback,
  takeSurge, registerEquip, summonAlly, applyKillRewards, poisonRandomFoe, applyImitate, checkElementSealProgress,
  beginDartStrike, sweepDead, finish, processChoice, processDiscoverQueue, queueBattleAction,
  triggersM2,
}) {
  function effectiveExecutionCard(uid, card) {
    const effective = prepareExecutionCard ? prepareExecutionCard(uid, card) : findEffectiveCard?.(uid, card)?.card || card;
    return foeFightTargets(card) ? withFoeFightTargets(effective, foeFightTargets(card)) : effective;
  }
  function rejectMissingTransform(card) {
    if (!card?._battleTransformMissing) return false;
    G.log(`[[icon:cross]] 转换目标「${esc(card._battleTransformMissing)}」缺失，本次未施放`, 'warn');
    requestBattleRender();
    return true;
  }
  function inspectExecution(uid, submittedCard, fuelUids, freeCost, requirementsPaid = false, paymentUids = []) {
    const card = effectiveExecutionCard(uid, submittedCard);
    const fail = (code, message) => ({ card, reason:{ code, message } });
    if (card?._battleTransformMissing) return fail('MISSING_TRANSFORM', `转换目标「${card._battleTransformMissing}」缺失，暂时无法使用`);
    const capability = inspectCardRuleCapability(card);
    if (!capability.ok) return fail(capability.kind === 'invalid' ? 'RULE_INVALID' : 'RULE_UNSUPPORTED', capability.kind === 'invalid' ? '规则格式非法' : '规则尚未支持');
    const handRequirement = card?.rules?.battle?.requirements?.find(rule => rule.kind === 'handCards');
    const infusionIssue = missingInfusionReason(card, (fuelUids || []).length, allSpellsInfused);
    if (infusionIssue) return fail('INFUSION_REQUIRED', infusionIssue);
    if (handRequirement && !requirementsPaid) {
      const excludedUids = [...new Set([uid, ...(fuelUids || [])])];
      const handUids = new Set(hand);
      const excludedUidSet = new Set(excludedUids);
      const selectedUids = new Set();
      const available = hand.filter(handUid => {
        const entry = findCard(handUid);
        return entry && isHandPaymentCandidate({
          uid: handUid, handUids, card: entry.card, type: handRequirement.type,
          excludedUids: excludedUidSet, selectedUids,
        });
      });
      if (available.length < handRequirement.count) {
        return fail('PAYMENT_INSUFFICIENT', `【${card.name}】无法打出：手牌支付不足，需要 ${handRequirement.count} 张${handRequirement.type ? `「${handRequirement.type}」` : ''}，现有 ${available.length} 张`);
      }
      return { card, handRequirement, excludedUids, paymentNeeded:true };
    }
    if (handRequirement && requirementsPaid && paymentUids.length !== handRequirement.count) return fail('PAYMENT_INVALID', '手牌支付数量无效，本次未打出');
    return { card, handRequirement, paymentNeeded:false };
  }
  function getExecutionAvailability(uid, card, fuelUids, freeCost) {
    return inspectExecution(uid, card, fuelUids, freeCost).reason || null;
  }
  function createSubmission(uid) {
    const battleToken = battleState.token;
    /** @type {import('../battle.play-submission.types.js').CardPlaySubmission|null} */
    let result = null;
    /** @type {import('../battle.play-submission.types.js').CardPlayReceipt|null} */
    let receipt = null;
    /** @type {((value:import('../battle.play-submission.types.js').CardPlayFinal)=>void)|null} */
    let resolveSettled = null;
    let completed = false;
    /** @param {'committed'|'rejected'|'cancelled'} status @param {import('../battle.play-submission.types.js').CardPlayReason} [reason] */
    const settle = (status, reason) => {
      if (!receipt || completed) return;
      completed = true;
      if (status === 'committed') resolveSettled?.(Object.freeze({ status, uid, battleToken, receipt }));
      else resolveSettled?.(Object.freeze({ status, uid, battleToken, receipt,
        reason:Object.freeze(reason || { code:'ACTION_CANCELLED', message:'本次出牌已取消' }) }));
    };
    return {
      get result() { return result; },
      reject(code, message) {
        const reason = { code, message };
        if (receipt) settle('rejected', reason);
        else result = Object.freeze({ status:'rejected', uid, battleToken, reason:Object.freeze(reason) });
      },
      needsInput() { result = Object.freeze({ status:'needs-input', kind:'payment', uid, battleToken }); },
      queued(value) {
        receipt = Object.freeze({ ...value, uid });
        const settled = new Promise(/** @param {(value:import('../battle.play-submission.types.js').CardPlayFinal)=>void} resolve */ resolve => { resolveSettled = resolve; });
        result = Object.freeze({ status:'queued', uid, battleToken, receipt, settled });
      },
      commit() { settle('committed'); },
      error(error) {
        const cancelled = error?.name === 'BattleActionCancelledError' || error?.name === 'AbortError';
        settle(cancelled ? 'cancelled' : 'rejected', { code:cancelled ? 'ACTION_CANCELLED' : 'EXECUTION_ERROR', message:cancelled ? '本次出牌已取消' : '本次打出未完成，请重试' });
      },
    };
  }
  /** @returns {import('../battle.play-submission.types.js').CardPlaySubmission} */
  function submitCardExecution(uid, card, fuelUids, target, freeCost) {
    const submission = createSubmission(uid);
    try { queueCardExecution(uid, card, fuelUids, target, freeCost, false, [], null, submission); }
    catch (error) {
      if (submission.result?.status === 'queued') submission.error(error);
      else submission.reject('SUBMISSION_ERROR', '本次出牌未接收，请重试');
      console.error('[battle] 出牌提交异常：', error);
    }
    return /** @type {import('../battle.play-submission.types.js').CardPlaySubmission} */ (submission.result);
  }
  function queueCardExecution(uid, card, fuelUids, target, freeCost, requirementsPaid = false, paymentUids = [], onResolved = null, submission = null) {
    const submittedCard = card;
    const check = inspectExecution(uid, card, fuelUids, freeCost, requirementsPaid, paymentUids);
    card = check.card;
    if (check.reason) {
      submission?.reject(check.reason.code, check.reason.message);
      if (check.reason.code === 'MISSING_TRANSFORM') rejectMissingTransform(card);
      else if (['RULE_INVALID','RULE_UNSUPPORTED'].includes(check.reason.code)) rejectUnsupportedCard(card, { warn:warnCardRuleRejection });
      else if (check.reason.code !== 'PAYMENT_INVALID') {
        G.log(`[[icon:cross]] ${esc(check.reason.message)}`, 'warn');
        if (check.reason.code === 'INFUSION_REQUIRED') requestBattleRender();
      }
      return false;
    }
    const { handRequirement } = check;
    if (check.paymentNeeded) {
      const excludedUids = check.excludedUids;
      set$handSelecting({
        act: 'payment', mandatory: true, n: handRequirement.count, type: handRequirement.type || null,
        excludedUids, selectedUids: [],
        payment: { uid, card, fuelUids: [...(fuelUids || [])], target, freeCost, onResolved },
      });
      submission?.needsInput();
      requestBattleRender();
      return false;
    }
    const battleToken = battleState.token;
    const receipt = Object.freeze({ battleToken, actionSeq: nextActionSeq() });
    submission?.queued(receipt);
    // 返回动作 promise：调用方（如极速符文回环）可 await 出牌完成
    return queueBattleAction(async signal => {
      const resolved = await execPlay(uid, submittedCard, fuelUids, target, freeCost, signal, receipt, paymentUids, submission);
      throwIfActionCancelled(signal);
      if (resolved && onResolved && G?.battleActive) onResolved();
    }, '出牌动作', submission ? error => submission.error(error) : null);
  }

  async function execPlay(uid, card, fuelUids, target, freeCost, signal, receipt, paymentUids = [], submission = null) {
    set$activeActionSignal(signal);
    try {
    throwIfActionCancelled(signal);
    // Every producer, including free selections and automatic releases, uses the
    // same effective face. Resolve again here before any payment or UID movement.
    card = effectiveExecutionCard(uid, card);
    if (foeFightTargets(card) && !validFoeFightTargets(foeFightTargets(card), alive())) {
      submission?.reject('TARGET_INVALID', '扰敌目标已失效，本次打出未扣费');
      G.log('[[icon:cross]] 扰敌目标已失效，本次打出未扣费', 'warn');
      requestBattleRender();
      return false;
    }
    if (rejectMissingTransform(card)) { submission?.reject('MISSING_TRANSFORM', '转换目标缺失，本次未施放'); return false; }
    // Recheck after queueing: rules may have changed before payment is committed.
    if (rejectUnsupportedCard(card, { warn: warnCardRuleRejection })) { submission?.reject('RULE_REJECTED', '规则格式非法或尚未支持'); return false; }
    const infusionIssue = missingInfusionReason(card, (fuelUids || []).length, allSpellsInfused);
    if (infusionIssue) {
      submission?.reject('INFUSION_REQUIRED', infusionIssue);
      G.log(`[[icon:cross]] ${esc(infusionIssue)}`, 'warn');
      requestBattleRender();
      return false;
    }
    // Revalidate before any payment: a queued transform can invalidate chosen fuel.
    if ((fuelUids || []).some(fuelUid => infusionFuelReason?.(fuelUid))) {
      submission?.reject('FUEL_INVALID', '注能材料已失效，本次打出未扣费');
      G.log('[[icon:cross]] 注能材料已失效，本次打出未扣费', 'warn');
      requestBattleRender();
      return false;
    }
    if (!freeCost && effCostOf(card, uid) > energy) {
      submission?.reject('INSUFFICIENT_ENERGY', `能量不足：【${card.name}】本次未扣费或消耗手牌`);
      G.log(`[[icon:bolt]] 能量不足：【${esc(card.name)}】本次未扣费或消耗手牌`, 'warn');
      requestBattleRender();
      return false;
    }
    const handRequirement = card?.rules?.battle?.requirements?.find(rule => rule.kind === 'handCards');
    if (handRequirement) {
      const handUids = new Set(hand);
      const excludedUids = new Set([uid, ...(fuelUids || [])]);
      const acceptedPaymentUids = new Set();
      const validPayment = paymentUids.length === handRequirement.count &&
        paymentUids.every(paymentUid => {
          const entry = findCard(paymentUid);
          const candidate = isHandPaymentCandidate({
            uid: paymentUid, handUids, card: entry?.card, type: handRequirement.type,
            excludedUids, selectedUids: acceptedPaymentUids,
          });
          if (candidate) acceptedPaymentUids.add(paymentUid);
          return candidate;
        });
      if (!validPayment) {
        submission?.reject('PAYMENT_INVALID', `【${card.name}】手牌支付未完成，本次打出已取消`);
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
    // M2：剥离时点容器供 resolver（resolver 守卫：非 onPlay 容器必须经 triggers 登记管线；
    // 登记在结算完成后以原卡进行——见下方 triggersM2.registerCard）。
    // 原卡无 onPlay 容器时剥离后不保留 onPlay 键（空 triggers 合法）。
    const resolverCard = (() => {
      const t = card.rules?.triggers;
      if (!t || !Object.keys(t).some(k => k !== 'onPlay' && k !== 'duration')) return card;
      const stripped = Object.prototype.hasOwnProperty.call(t, 'onPlay') ? { onPlay: t.onPlay } : {};
      // 保留已完成 preflight 所需的声明视图给 resolver 守卫；实际执行视图仍只带 onPlay，
      // 非 onPlay 时点已经由 runner 登记，不能在 resolver 内再次运行。
      return { ...card, _registeredTriggers: t, rules: { ...card.rules, triggers: stripped } };
    })();
    const effCost = effCostOf(card, uid);
    if (effCost !== card.cost) G.log(`[[icon:sparkles]] <b>费用变化</b>：【${esc(card.name)}】按 <b>${effCost}</b> 费打出（原 ${card.cost} 费）`, 'sys');
    if (!freeCost && effCost > energy) {
      submission?.reject('INSUFFICIENT_ENERGY', `能量不足：【${card.name}】未打出`);
      G.log(`[[icon:bolt]] 能量不足：【${esc(card.name)}】未打出`, 'warn');
      requestBattleRender();
      return false;
    }
    const requestedIssue = requestedTargetReason(card, target, alive());
    if (requestedIssue) {
      submission?.reject(requestedIssue.code, requestedIssue.message);
      G.log(requestedIssue.message, 'warn'); requestBattleRender(); return false;
    }
    if (!freeCost) set$energy(energy - effCost);
    played.push(uid);
    SDT.Sound.sfx('card');
    removeUid(hand, uid);
    submission?.commit();
    cardAnims.push({
      kind: 'play', uid, name: card.name, type: card.type,
      side: targetSideFor(card, SDT.Cards.DMG_TYPES),
      target: target && !target.dead ? foes.indexOf(target) : null,
      receipt,
    });
    fuelUids.forEach(f => removeUid(hand, f));
    for (const f of fuelUids) {
      consumed.push(f);
      recordHandInfusion(hand);
      requestedInfusion();
      // v0.25：被消耗的牌进入墓地——墓地不参与洗回，战胜 BOSS 后可在整理背包放回
      if (mode === 'boss') grave.push(f);
      const o = findCard(f);
      cardAnims.push({ kind: 'burn', uid: f, name: o ? o.card.name : '' });
      G.log(`[[icon:flask]] <b>${esc(card.name)}</b> 注能：消耗了【<b>${esc(o ? o.card.name : '?')}</b>】${mode === 'boss' ? '（进墓地，不参与洗回）' : '（战后进消耗区；道具、装备不可在火堆复原）'}`, 'sys');
      // 被牺牲的牌并没有被「使用」：不结算主效果，只结算它的「被注能时」条件效果
      if (o) resolveInfusedFuel(o.card, target);
      throwIfActionCancelled(signal);
      // Q2 老板定向：注能牺牲也算「消耗该牌时」触发（沉船宝盒/百炼青虹剑/矿工炸药/奥术残卷）
      if (o) fireConsumeTriggers(o.card, target);
      set$infuseFuels(infuseFuels + 1);   // 元素符印解锁计数
      checkElementSealProgress();
      // 深渊降焰（降临者英雄）：每消耗 1 张卡牌，自动施放 1 次火球
      if (consumeFireballN > 0) await runStagedSteps(consumeFireballSteps(consumeFireballN), signal);
    }
    if (mode === 'boss') discard.push(uid);
    const fuelCostSum = fuelUids.reduce((a, f) => {
      const o = findCard(f);
      return a + (o ? Math.max(0, +(SDT.Cards.sellPrice(o.card) || 0)) : 0);
    }, 0);
    // 免注能实例与「招式均已注能」均按已注能结算；材料消耗及累计计数仍只由实际燃料驱动。
    const infusedBase = fuelUids.length > 0 || hasInfusionWaiver(card, allSpellsInfused);
    const aliveBefore = alive().length;
    const controlledBefore = foes.filter(foe => foe.controlled).length;
    await resolveCardWithFeedback(resolverCard, target, infusedBase, fuelCostSum, uid, signal);
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
    const structuredLastHandRecast = card.rules?.triggers?.onPlay?.some(op =>
      op?.op === 'damage' && op.recast?.on === 'lastHand');
    const lastHandRecastMatch = String(card.desc || '').match(/最后一张手牌[^。；]*?触发\s*(\d+)?\s*次?/);
    if (!structuredLastHandRecast && lastHandRecastMatch && lastRealCard) {
      const recastTimes = lastHandRecastMatch[1] ? +lastHandRecastMatch[1] : 2;   // 未写次数（中文数字）按 2 次
      G.log(`[[icon:cards]] <b>${esc(card.name)}</b>：本牌是最后一张手牌，效果触发 ${recastTimes} 次`, 'sys');
      for (let r = 0; r < recastTimes - 1; r++) {   // 本卡主结算已跑 1 次，此处补足 N 次
        emitRecast({ card, uid, source: '末手重放', repeatIndex: r + 1, repeatTotal: recastTimes - 1 });
        await resolveCardWithFeedback(resolverCard, target, infusedBase, fuelCostSum, uid, signal);
        await takeSurge(signal);
      }
    }
    // 「下一张法术施放 N 次」（元素风暴，注能打出时注册）：法术效果再跑一遍
    if (nextSpellTwice > 0 && card.type === '法术') {
      set$nextSpellTwice(0);
      G.log(`[[icon:sparkles]] <b>元素风暴</b>：这张法术额外施放 1 次`, 'sys');
      emitRecast({ card, uid, source: '元素风暴', repeatIndex: 1, repeatTotal: 1 });
      await resolveCardWithFeedback(resolverCard, target, infusedBase, fuelCostSum, uid, signal);
      await takeSurge(signal);
    }
    // —— 2026-09-09 补实装：打出侧登记（成长/被动/击杀结算/手牌变形）——
    // M3 收编：卡已迁结构化规则（triggers/equip）时 desc 正则宿主一律抑制，runner/规则单路径
    const hasStructuredRules = !!(card.rules?.triggers || card.rules?.equip);
    const hosted = card.rules?.battle?.hosted || [];
    if (!hasStructuredRules && ((/回合开始时[，,]?\s*本牌伤害\s*\+/.test(String(card.desc || '')) && card.name) ||
        hosted.includes('charge-fireball'))) growthNames.add(card.name);
    if (!hasStructuredRules && /每消灭\s*1\s*个敌人[^。]*?\+\s*1\s*点?攻击力/.test(String(card.desc || ''))) set$killAtkUp(killAtkUp + 1);
    if (!hasStructuredRules && /每当你使用一张法术牌[^。]*中毒/.test(String(card.desc || ''))) set$poisonOnSpell(true);
    if (card.id !== 'cc-rot-seed' && !hasStructuredRules && /死亡时[^。；]*中毒层数转移/.test(String(card.desc || ''))) set$poisonLegacy(true);
    if (!hasStructuredRules && hosted.includes('venom-staff')) set$poisonOnSpell(true);
    if (!hasStructuredRules && hosted.includes('consume-fireball')) set$consumeFireballN(1);
    if (!hasStructuredRules && hosted.includes('assassin')) set$stealthStrike(true);
    // 旧日再临（深渊主宰·妲莉薇特，2026-09-16 定版）：免疫诅咒 + 招式均已注能 + 召唤 4 名无攻血封印肢体
    if (!hasStructuredRules && /免疫诅咒/.test(String(card.desc || ''))) {
      set$playerCurseImmune(true);
      // 永久来源在临时窗口内获得时，到期也必须保留。
      delayed.forEach(q => { if (q.special === 'curseImmuneOff') q.restore = true; });
      G.log('[[icon:shield]] <b>旧日再临</b>：诅咒无法侵染深渊主宰', 'ok');
    }
    // 第十二批·邪能护体（2026-09-23）：「本回合免疫所有伤害和诅咒效果」——注能打出才登记；
    // 诅咒部分走 playerCurseImmune，下回合开始由 curseImmuneOff 还原（restore 记原值：
    // 深渊主宰的永久免疫在场时原值为 true，还原后仍免疫，不受本卡影响）。
    // 伤害部分由文本侧祝福·免疫伤害（buff.immune，n=1 回合）承担。
    if (!hasStructuredRules && infusedBase && /免疫所有伤害和诅咒效果/.test(String(card.desc || ''))) {
      const prior = playerCurseImmune;
      set$playerCurseImmune(true);
      // 同一临时窗口只保留最早基值，重复使用不能把临时 true 记成永久来源。
      if (!delayed.some(q => q.special === 'curseImmuneOff')) {
        delayed.push({ special: 'curseImmuneOff', restore: !!prior });
      }
      G.log('[[icon:shield]] <b>邪能护体</b>：本回合免疫所有伤害与诅咒效果', 'ok');
    }
    if (!hasStructuredRules && /均视为已注能|均已注能/.test(String(card.desc || ''))) {
      set$allSpellsInfused(true);
      G.log('[[icon:sparkles]] <b>旧日再临</b>：所有可注能与必须注能的招式，均视为已注能', 'ok');
    }
    if (!hasStructuredRules && /召唤\s*4\s*名封印肢体/.test(String(card.desc || ''))) {
      summonAlly('封印肢体', 0, 0, 4, true);
      G.log('[[icon:paw]] 四条<b>封印肢体</b>重现世间——如天国之门般无攻无血的场面物件', 'sys');
    }
    // 箭矢符文：你的「箭」释放 2 次（第二段免费用）
    if (arrowRune && (card.name === '箭' || card.id === 'token-arrow')) {
      G.log('[[icon:runner]] <b>箭矢符文</b>：箭再度释放', 'sys');
      emitRecast({ card, uid, source: '箭矢符文', repeatIndex: 1, repeatTotal: 1 });
      await resolveCardWithFeedback(resolverCard, target, infusedBase, fuelCostSum, uid, signal);
      await takeSurge(signal);
    }
    applyKillRewards(card, Math.max(0, aliveBefore - alive().length - (foes.filter(foe => foe.controlled).length - controlledBefore)));
    if (poisonOnSpell && card.type === '法术') poisonRandomFoe();
    // Q8 老板定向：不变应万变——打出武术后，手中所有「不变应万变」变为该武术的 1 费复制
    if (card.type === '武术') applyImitate(card);
    // M3：triggers.replay 容器——整卡重跑 N 次（急行军/破釜沉舟「效果触发 2 次」规则化，
    // on='lastHand' 时按末手判定；既有 desc 正则保留给未迁卡）
    const replay = card.rules?.triggers?.replay;
    if (replay && Number.isInteger(replay.times) && replay.times > 0 &&
        (!replay.on || replay.on === 'lastHand') && lastRealCard) {
      G.log(`[[icon:cards]] <b>${esc(card.name)}</b>：本牌是最后一张手牌，效果再触发 ${replay.times} 次`, 'sys');
      for (let r = 0; r < replay.times; r++) {
        emitRecast({ card, uid, source: '末手重放', repeatIndex: r + 1, repeatTotal: replay.times });
        await resolveCardWithFeedback(resolverCard, target, infusedBase, fuelCostSum, uid, signal);
        await takeSurge(signal);
      }
    }
    // M3：pick:'new' 段级重新点选（血毒双镖双目标）——主结算已跳过 pick 段，此处进入点选后结算
    const pickOps = hasStructuredRules ? (card.rules?.triggers?.onPlay || []).filter(op => op && op.pick === 'new') : [];
    if (pickOps.length && alive().length) {
      beginDartStrike({ uid, card, ops: pickOps });
    }
    // 「永远被保留在手牌中」（不朽斩）：打出后回到手牌，不进弃牌堆
    // M3：rules.battle.keepInHand 结构化开关与 desc 正则单源
    if (card.rules?.battle?.keepInHand === true || /永远被保留在手牌中/.test(String(card.desc || ''))) {
      const di = discard.lastIndexOf(uid); if (di >= 0) discard.splice(di, 1);
      const pi = played.lastIndexOf(uid); if (pi >= 0) played.splice(pi, 1);
      if (hand.length < effectiveHandMax(R().battleHandMax)) {
        hand.push(uid);
        cardAnims.push({ kind: 'draw', uid, name: card.name });
        G.log(`[[icon:cards]] 【${esc(card.name)}】保留在手牌中（无法用于注能）`, 'sys');
      } else {
        // 手牌满不能弃置回手：uid 已从 discard/played 移除，不兜底会从所有牌区消失
        discard.push(uid);
        G.log(`[[icon:cards]] 手牌已满，【${esc(card.name)}】回到弃牌堆`, 'sys');
      }
    }
    sweepDead();
    set$lastPlayedType(card.type);   // 供「上一张牌是武术→0费」类条件费用判定
    requestedCardPlayed(card);
    // 打出侧计数（结算后自增——「其他招式/其他武术」不含正在打出的本牌）：
    // 招式＝武术+法术（设计者 2026-09-10 定版，2026-09-29 复核维持）连续射击；追斩只数武术
    if (card.type === '武术' || card.type === '法术') set$playedMovesThisTurn(playedMovesThisTurn + 1);
    if (card.type === '武术') set$playedMartialThisTurn(playedMartialThisTurn + 1);
    // M2：打出卡以原卡登记时点触发器（onTurnStart/onTurnEnd/onKill/onDamaged/onPlayCard…，
    // 容器级 duration 控制持续次数）；登记后向已登记卡广播「打出牌时」。
    // 本卡的时点容器已在结算前剥离（见 resolverCard），此后由 runner 按时点触发。
    if (triggersM2) {
      triggersM2.registerCard(card, uid, { battleStarted: true });
      triggersM2.firePlayCard();
    }
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

  return { queueCardExecution, submitCardExecution, getExecutionAvailability };
}
