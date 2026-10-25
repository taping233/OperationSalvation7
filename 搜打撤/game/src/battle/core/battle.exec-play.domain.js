import { withPreparedDiscovery } from '../effects/battle.discover-preview.js';
import { isLegacyRotSeed, isArrowRuneCard, isLegacyBloodpoison } from '../../cards/card-legacy-battle-policy.js';
import { BATTLE_PHASES } from '../runtime/battle.state.js';
import { createRequestedDomain } from '../effects/requested-card-runtime.domain.js';
import { foeFightTargets, validFoeFightTargets, withFoeFightTargets } from '../effects/battle.foe-fight.js';
import { esc } from '../../core/shared.js';
import { removeUid } from '../bag/battle.piles.js';
import { targetSideFor } from '../effects/battle.target-rules.js';
import { throwIfActionCancelled } from '../runtime/battle.playback.js';
import { rejectUnsupportedCard } from '../effects/battle.rule-guard.js';
import { inspectCardRuleCapability } from '../../cards/card-rules.capability.js';
import { hasStructuredTrigger, hasStructuredEquipField, triggerDeclarations } from '../../cards/card-trigger-contract.js';
import { isHandPaymentCandidate, nextHandSelectionId } from './battle.hand-selection.js';
import { createInfusionDomain } from '../effects/battle.infusion.domain.js';

/** Instance-owned state and host services are captured explicitly. */
export function createExecPlayDomain(context) {
const instanceRuntime = context.runtime;
const hostAudio = context.audio;
const cardCatalog = context.cards;
const { requestedCardPlayed, requestedInfusion, requestedTargetReason, recordCompletedBattleCard } = createRequestedDomain(context);
const { hasInfusionWaiver, missingInfusionReason } = createInfusionDomain(context);
/* battle.exec-play.js —— 出牌结算长流程（自 battle.engine.js 拆出）。
 * queueCardExecution 手牌支付校验与出牌动作入队；execPlay 扣费、注能燃料、结算重放与
 * 打出侧登记。状态读写经 battle.runtime.js（活绑定 + set$Xxx）直连；与 engine 互递归的
 * 规则核结算件由 createBattleExecPlay 注入，engine 侧保留一行转发 shim 维持具名导出面。 */

const R = () => context.readRules();
const alive = () => instanceRuntime.foes.filter(foe => !foe.dead);
const keepsCardInHand = card => Object.hasOwn(card?.rules?.battle || {}, 'keepInHand')
  ? card.rules.battle.keepInHand === true : !hasStructuredTrigger(card, 'onPlay') && /永远被保留在手牌中/.test(String(card?.desc || ''));

function createBattleExecPlay({
  emitRecast = /** @type {(event: Parameters<import('./battle.core-ports.types.js').EffectCommands['emitRecast']>[0]) => boolean | void} */ (() => {}),
  markCardResolving = /** @type {(uid: string, marker: object, active: boolean) => void} */ (() => {}),
  warnCardRuleRejection = message => instanceRuntime.G.log(message, 'warn'),
  requestBattleRender, findCard, findEffectiveCard, prepareExecutionCard, infusionFuelReason, fireConsumeTriggers, effCostOf,
  resolveInfusedFuel, runStagedSteps, consumeFireballSteps, resolveCardWithFeedback,
  takeSurge, registerEquip, summonAlly, applyKillRewards, poisonRandomFoe, applyImitate, checkElementSealProgress,
  beginDartStrike, sweepDead, finish, processChoice, processDiscoverQueue, queueBattleAction,
  triggersM2, previewDiscovery = (...args) => { void args; return null; },
}) {
  function effectiveExecutionCard(uid, card) {
    const effective = prepareExecutionCard ? prepareExecutionCard(uid, card) : findEffectiveCard?.(uid, card)?.card || card;
    return foeFightTargets(card) ? withFoeFightTargets(effective, foeFightTargets(card)) : effective;
  }
  function rejectMissingTransform(card) {
    if (!card?._battleTransformMissing) return false;
    instanceRuntime.G.log(`[[icon:cross]] 转换目标「${esc(card._battleTransformMissing)}」缺失，本次未施放`, 'warn');
    requestBattleRender();
    return true;
  }
  function inspectExecution(uid, submittedCard, fuelUids, freeCost, requirementsPaid = false, paymentUids = [], directRelease = false) {
    const card = effectiveExecutionCard(uid, submittedCard);
    const fail = (code, message) => ({ card, reason:{ code, message } });
    if (card?._battleTransformMissing) return fail('MISSING_TRANSFORM', `转换目标「${card._battleTransformMissing}」缺失，暂时无法使用`);
    const capability = inspectCardRuleCapability(card);
    if (!capability.ok) return fail(capability.kind === 'invalid' ? 'RULE_INVALID' : 'RULE_UNSUPPORTED', capability.kind === 'invalid' ? '规则格式非法' : '规则尚未支持');
    const handRequirement = card?.rules?.battle?.requirements?.find(rule => rule.kind === 'handCards');
    // 反馈#5b（2026-10-21 老板定版）：「直接释放/直接施放」词条释放注能卡时视为已注能——
    // 不因缺注能材料被拦（rules.md「直接释放视为已注能」条目）；普通出牌与「抽到时施放」仍走注能门。
    const infusionIssue = directRelease ? '' : missingInfusionReason(card, (fuelUids || []).length, instanceRuntime.allSpellsInfused);
    if (infusionIssue) return fail('INFUSION_REQUIRED', infusionIssue);
    if (handRequirement && !requirementsPaid) {
      const excludedUids = [...new Set([uid, ...(fuelUids || [])])];
      const handUids = new Set(instanceRuntime.hand);
      const excludedUidSet = new Set(excludedUids);
      const selectedUids = new Set();
      const available = instanceRuntime.hand.filter(handUid => {
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
    const battleToken = instanceRuntime.battleState.token;
    /** @type {import('../battle.play-submission.types.js').CardPlaySubmission|null} */
    let result = null;
    /** @type {import('../battle.play-submission.types.js').CardPlayReceipt|null} */
    let receipt = null;
    /** @type {((value:import('../battle.play-submission.types.js').CardPlayFinal)=>void)|null} */
    let resolveSettled = null;
    let completed = false;
    let paid = false;
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
      paid() { paid = true; },
      commit() { settle('committed'); },
      cancel() { settle('cancelled', { code: 'DISCOVERY_CANCELLED', message: '发现预览已取消，本次未扣费或消耗卡牌' }); },
      error(error) {
        const cancelled = error?.name === 'BattleActionCancelledError' || error?.name === 'AbortError';
        if (cancelled && paid) { settle('committed'); return; }
        settle(cancelled ? 'cancelled' : 'rejected', { code:cancelled ? 'ACTION_CANCELLED' : 'EXECUTION_ERROR', message:cancelled ? '本次出牌已取消' : '本次打出未完成，已回到战斗开始检查点' });
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
  function queueCardExecution(uid, card, fuelUids, target, freeCost, requirementsPaid = false, paymentUids = [], onResolved = null, submission = null, directRelease = false) {
    const submittedCard = card;
    const check = inspectExecution(uid, card, fuelUids, freeCost, requirementsPaid, paymentUids, directRelease);
    card = check.card;
    if (check.reason) {
      submission?.reject(check.reason.code, check.reason.message);
      if (check.reason.code === 'MISSING_TRANSFORM') rejectMissingTransform(card);
      else if (['RULE_INVALID','RULE_UNSUPPORTED'].includes(check.reason.code)) rejectUnsupportedCard(card, { warn:warnCardRuleRejection });
      else if (check.reason.code !== 'PAYMENT_INVALID') {
        instanceRuntime.G.log(`[[icon:cross]] ${esc(check.reason.message)}`, 'warn');
        if (check.reason.code === 'INFUSION_REQUIRED') requestBattleRender();
      }
      return false;
    }
    const { handRequirement } = check;
    if (check.paymentNeeded) {
      const excludedUids = check.excludedUids;
      instanceRuntime.set$handSelecting({
        selectionId: nextHandSelectionId(),
        act: 'payment', mandatory: true, n: handRequirement.count, type: handRequirement.type || null,
        excludedUids, selectedUids: [],
        payment: { uid, card, fuelUids: [...(fuelUids || [])], target, freeCost, onResolved, directRelease },
      });
      submission?.needsInput();
      requestBattleRender();
      return false;
    }
    const battleToken = instanceRuntime.battleState.token;
    const receipt = Object.freeze({ battleToken, actionSeq: instanceRuntime.nextActionSeq() });
    submission?.queued(receipt);
    // 返回动作 promise：调用方（如极速符文回环）可 await 出牌完成
    return queueBattleAction(async signal => {
      const resolved = await execPlay(uid, submittedCard, fuelUids, target, freeCost, signal, receipt, paymentUids, submission, directRelease);
      submission?.commit();
      throwIfActionCancelled(signal);
      if (resolved && onResolved && instanceRuntime.G?.battleActive) onResolved();
    }, '出牌动作', submission ? error => {
      if (error?.name === 'BattleActionCancelledError' && [BATTLE_PHASES.VICTORY, BATTLE_PHASES.DEFEAT].includes(instanceRuntime.battleState.phase)) submission.commit();
      else submission.error(error);
    } : null);
  }

  async function execPlay(uid, card, fuelUids, target, freeCost, signal, receipt, paymentUids = [], submission = null, directRelease = false, preparedDiscovery = null) {
    instanceRuntime.set$activeActionSignal(signal);
    markCardResolving(uid, signal, true);
    try {
    throwIfActionCancelled(signal);
    // Every producer, including free selections and automatic releases, uses the
    // same effective face. Resolve again here before any payment or UID movement.
    card = effectiveExecutionCard(uid, card);
    if (foeFightTargets(card) && !validFoeFightTargets(foeFightTargets(card), alive())) {
      submission?.reject('TARGET_INVALID', '扰敌目标已失效，本次打出未扣费');
      instanceRuntime.G.log('[[icon:cross]] 扰敌目标已失效，本次打出未扣费', 'warn');
      requestBattleRender();
      return false;
    }
    if (rejectMissingTransform(card)) { submission?.reject('MISSING_TRANSFORM', '转换目标缺失，本次未施放'); return false; }
    // Recheck after queueing: rules may have changed before payment is committed.
    if (rejectUnsupportedCard(card, { warn: warnCardRuleRejection })) { submission?.reject('RULE_REJECTED', '规则格式非法或尚未支持'); return false; }
    const infusionIssue = directRelease ? '' : missingInfusionReason(card, (fuelUids || []).length, instanceRuntime.allSpellsInfused);
    if (infusionIssue) {
      submission?.reject('INFUSION_REQUIRED', infusionIssue);
      instanceRuntime.G.log(`[[icon:cross]] ${esc(infusionIssue)}`, 'warn');
      requestBattleRender();
      return false;
    }
    // Revalidate before any payment: a queued transform can invalidate chosen fuel.
    if ((fuelUids || []).some(fuelUid => infusionFuelReason?.(fuelUid))) {
      submission?.reject('FUEL_INVALID', '注能材料已失效，本次打出未扣费');
      instanceRuntime.G.log('[[icon:cross]] 注能材料已失效，本次打出未扣费', 'warn');
      requestBattleRender();
      return false;
    }
    const effCost = effCostOf(card, uid);
    if (!freeCost && effCost > instanceRuntime.energy) {
      submission?.reject('INSUFFICIENT_ENERGY', `能量不足：【${card.name}】本次未扣费或消耗手牌`);
      instanceRuntime.G.log(`[[icon:bolt]] 能量不足：【${esc(card.name)}】本次未扣费或消耗手牌`, 'warn');
      requestBattleRender();
      return false;
    }
    const requestedIssue = requestedTargetReason(card, target, alive());
    if (requestedIssue) {
      submission?.reject(requestedIssue.code, requestedIssue.message);
      instanceRuntime.G.log(requestedIssue.message, 'warn'); requestBattleRender(); return false;
    }
    if (!preparedDiscovery && !directRelease && instanceRuntime.hand.includes(uid)) {
      const preview = previewDiscovery(card, uid, signal, () => effectiveExecutionCard(uid, card));
      if (preview) {
        const prepared = await preview;
        throwIfActionCancelled(signal);
        if (prepared === false) { submission?.cancel?.(); return false; }
        // Revalidate all costs, material/source identities and target after the user's wait.
        if (prepared) return await execPlay(uid, card, fuelUids, target, freeCost, signal, receipt, paymentUids, submission, directRelease, prepared);
      }
    }
    const handRequirement = card?.rules?.battle?.requirements?.find(rule => rule.kind === 'handCards');
    if (handRequirement) {
      const handUids = new Set(instanceRuntime.hand);
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
        instanceRuntime.G.log(`[[icon:cross]] 【${esc(card.name)}】手牌支付未完成，本次打出已取消`, 'warn');
        return false;
      }
      // Commit all selected payment cards together before charging or playing the source card.
      const paid = new Set(paymentUids);
      const entries = paymentUids.map(paymentUid => findCard(paymentUid));
      instanceRuntime.set$hand(instanceRuntime.hand.filter(handUid => !paid.has(handUid)));
      for (let i = 0; i < paymentUids.length; i++) {
        const paymentUid = paymentUids[i];
        const entry = entries[i];
        instanceRuntime.consumed.push(paymentUid);
        instanceRuntime.cardAnims.push({ kind: 'burn', uid: paymentUid, name: entry.card.name });
        instanceRuntime.G.log(`[[icon:flask]] 消耗了手牌中的【<b>${esc(entry.card.name)}</b>】作为出牌代价`, 'sys');
      }
      entries.forEach(entry => fireConsumeTriggers(entry.card, null));
      throwIfActionCancelled(signal);
    }
    instanceRuntime.freeCast.delete(uid);
    // M2：剥离时点容器供 resolver（resolver 守卫：非 onPlay 容器必须经 triggers 登记管线；
    // 登记在结算完成后以原卡进行——见下方 triggersM2.registerCard）。
    // 原卡无 onPlay 容器时剥离后不保留 onPlay 键（空 triggers 合法）。
    const resolverCard = withPreparedDiscovery((() => {
      const t = triggerDeclarations(card);
      if (!t || !Object.keys(t).some(k => k !== 'onPlay' && k !== 'duration')) return card;
      const stripped = Object.prototype.hasOwnProperty.call(t, 'onPlay') ? { onPlay: t.onPlay } : {};
      // 保留已完成 preflight 所需的声明视图给 resolver 守卫；实际执行视图仍只带 onPlay，
      // 非 onPlay 时点已经由 runner 登记，不能在 resolver 内再次运行。
      return { ...card, _registeredTriggers: t, rules: { ...card.rules, triggers: stripped } };
    })(), preparedDiscovery);
    if (effCost !== card.cost) instanceRuntime.G.log(`[[icon:sparkles]] <b>费用变化</b>：【${esc(card.name)}】按 <b>${effCost}</b> 费打出（原 ${card.cost} 费）`, 'sys');
    if (!freeCost) instanceRuntime.set$energy(instanceRuntime.energy - effCost);
    instanceRuntime.played.push(uid);
    hostAudio.sfx('card');
    removeUid(instanceRuntime.hand, uid);
    submission?.paid?.();
    instanceRuntime.cardAnims.push({
      kind: 'play', uid, name: card.name, type: card.type,
      side: targetSideFor(card, cardCatalog.DMG_TYPES),
      target: target && !target.dead ? instanceRuntime.foes.indexOf(target) : null,
      receipt,
    });
    // Price effects use the current fuel face's printed cost, not its sale value.
    // Capture it before consumption callbacks can transform or replace a card.
    const fuelCostSum = fuelUids.reduce((total, fuelUid) => {
      const entry = findEffectiveCard(fuelUid) || findCard(fuelUid);
      return total + Math.max(0, +(entry?.card?.cost || 0));
    }, 0);
    fuelUids.forEach(f => removeUid(instanceRuntime.hand, f));
    const fuelEntries = fuelUids.map(fuelUid => ({ uid: fuelUid, entry: findCard(fuelUid) }));
    // All selected fuel is one payment. Final-boss defeat in the first card's
    // consumption trigger must not leave later fuel absent from settlement.
    for (const { uid: f, entry: o } of fuelEntries) {
      instanceRuntime.consumed.push(f);
      // v0.25：被消耗的牌进入墓地——墓地不参与洗回，战胜 BOSS 后可在整理背包放回
      if (instanceRuntime.mode === 'boss') instanceRuntime.grave.push(f);
      instanceRuntime.cardAnims.push({ kind: 'burn', uid: f, name: o ? o.card.name : '' });
      instanceRuntime.G.log(`[[icon:flask]] <b>${esc(card.name)}</b> 注能：消耗了【<b>${esc(o ? o.card.name : '?')}</b>】${instanceRuntime.mode === 'boss' ? '（进墓地，不参与洗回）' : '（战后进消耗区；道具、装备不可在火堆复原）'}`, 'sys');
    }
    for (const { entry: o } of fuelEntries) {
      instanceRuntime.recordHandInfusion(instanceRuntime.hand);
      requestedInfusion();
      // 被牺牲的牌并没有被「使用」：不结算主效果，只结算它的「被注能时」条件效果
      if (o) resolveInfusedFuel(o.card, target);
      throwIfActionCancelled(signal);
      // Q2 老板定向：注能牺牲也算「消耗该牌时」触发（沉船宝盒/百炼青虹剑/矿工炸药/奥术残卷）
      if (o) fireConsumeTriggers(o.card, target);
      instanceRuntime.set$infuseFuels(instanceRuntime.infuseFuels + 1);   // 元素符印解锁计数
      checkElementSealProgress();
      // 深渊降焰（降临者英雄）：每消耗 1 张卡牌，自动施放 1 次火球
      if (instanceRuntime.consumeFireballN > 0) await runStagedSteps(consumeFireballSteps(instanceRuntime.consumeFireballN), signal);
    }
    if (instanceRuntime.mode === 'boss') instanceRuntime.discard.push(uid);
    // 免注能实例、「招式均已注能」与「直接释放/直接施放」词条均按已注能结算（反馈#5b 老板定版：
    // 直释注能卡视为已注能——允许释放、按已注能效果结算）；材料消耗及累计计数仍只由实际燃料驱动，
    // 直释不消耗注能材料、不增加累计注能计数。
    const infusedBase = fuelUids.length > 0 || hasInfusionWaiver(card, instanceRuntime.allSpellsInfused) || directRelease;
    const aliveBefore = alive().length;
    const controlledBefore = instanceRuntime.foes.filter(foe => foe.controlled).length;
    const repeatNextSpell = instanceRuntime.nextSpellTwice > 0 && card.type === '法术';
    if (repeatNextSpell) instanceRuntime.set$nextSpellTwice(0);
    await resolveCardWithFeedback(resolverCard, target, infusedBase, fuelCostSum, uid, signal);
    await takeSurge(signal);   // 法力奔涌：演出未完不结束本次出牌动作；终局会中止余下结算
    // 2026-09-09 老板 #9：装备卡打出即穿戴（角色信息区显示装备与限定技能按钮）
    if (card.type === '装备') registerEquip(uid, card);
    // 「若本牌为最后一张手牌，效果触发 N 次」（急行军/破釜沉舟）：整卡效果再跑一遍。
    // 「永远被保留在手牌中」类卡（不朽斩）不计入手牌数——背包砸击已改按钮形态，
    // 不再向手牌置入常驻令牌，手牌检测天然不含砸击
    const lastRealCard = instanceRuntime.hand.every(u => {
      const o = findCard(u);
      return o && keepsCardInHand(o.card);
    });
    const structuredLastHandRecast = card.rules?.triggers?.onPlay?.some(op =>
      op?.op === 'damage' && op.recast?.on === 'lastHand');
    const lastHandRecastMatch = String(card.desc || '').match(/最后一张手牌[^。；]*?触发\s*(\d+)?\s*次?/);
    if (!hasStructuredTrigger(card, 'onPlay') && !hasStructuredTrigger(card, 'replay') &&
        !structuredLastHandRecast && lastHandRecastMatch && lastRealCard) {
      const recastTimes = lastHandRecastMatch[1] ? +lastHandRecastMatch[1] : 2;   // 未写次数（中文数字）按 2 次
      instanceRuntime.G.log(`[[icon:cards]] <b>${esc(card.name)}</b>：本牌是最后一张手牌，效果触发 ${recastTimes} 次`, 'sys');
      for (let r = 0; r < recastTimes - 1; r++) {   // 本卡主结算已跑 1 次，此处补足 N 次
        emitRecast({ card, uid, source: '末手重放', repeatIndex: r + 1, repeatTotal: recastTimes - 1 });
        await resolveCardWithFeedback(resolverCard, target, infusedBase, fuelCostSum, uid, signal);
        await takeSurge(signal);
      }
    }
    const replay = triggerDeclarations(card)?.replay;
    if (replay && replay.on === 'lastHand' && lastRealCard) {
      instanceRuntime.G.log(`[[icon:cards]] <b>${esc(card.name)}</b>：本牌是最后一张手牌，效果再触发 ${replay.times} 次`, 'sys');
      for (let r = 0; r < replay.times && alive().length; r++) {
        emitRecast({ card, uid, source: '末手重放', repeatIndex: r + 1, repeatTotal: replay.times });
        await resolveCardWithFeedback(resolverCard, target, infusedBase, fuelCostSum, uid, signal);
        await takeSurge(signal);
      }
    }
    // 只消费本牌结算前已有的次数；本牌新登记的「下一张」留给后续法术。
    if (repeatNextSpell) {
      instanceRuntime.G.log(`[[icon:sparkles]] <b>元素风暴</b>：这张法术额外施放 1 次`, 'sys');
      emitRecast({ card, uid, source: '元素风暴', repeatIndex: 1, repeatTotal: 1 });
      await resolveCardWithFeedback(resolverCard, target, infusedBase, fuelCostSum, uid, signal);
      await takeSurge(signal);
    }
    // —— 2026-09-09 补实装：打出侧登记（成长/被动/击杀结算/手牌变形）——
    // 只由本效果所属域决定旧文本兼容，其他时点的规则不吞掉尚未迁移的登记。
    const legacyPlayEffects = !hasStructuredTrigger(card, 'onPlay') && !hasStructuredEquipField(card, 'onEquip');
    const hosted = card.rules?.battle?.hosted || [];
    if (legacyPlayEffects && !hasStructuredTrigger(card, 'onTurnStart') && ((/回合开始时[，,]?\s*本牌伤害\s*\+/.test(String(card.desc || '')) && card.name) ||
        hosted.includes('charge-fireball'))) instanceRuntime.growthNames.add(card.name);
    if (legacyPlayEffects && !hasStructuredTrigger(card, 'onKill') && /每消灭\s*1\s*个敌人[^。]*?\+\s*1\s*点?攻击力/.test(String(card.desc || ''))) instanceRuntime.set$killAtkUp(instanceRuntime.killAtkUp + 1);
    if (legacyPlayEffects && !hasStructuredTrigger(card, 'onPlayCard') && /每当你使用一张法术牌[^。]*中毒/.test(String(card.desc || ''))) instanceRuntime.set$poisonOnSpell(true);
    if (!isLegacyRotSeed(card) && legacyPlayEffects && /死亡时[^。；]*中毒层数转移/.test(String(card.desc || ''))) instanceRuntime.set$poisonLegacy(true);
    if (legacyPlayEffects && !hasStructuredTrigger(card, 'onPlayCard') && hosted.includes('venom-staff')) instanceRuntime.set$poisonOnSpell(true);
    if (legacyPlayEffects && !hasStructuredTrigger(card, 'onConsume') && hosted.includes('consume-fireball')) instanceRuntime.set$consumeFireballN(1);
    if (legacyPlayEffects && hosted.includes('assassin')) instanceRuntime.set$stealthStrike(true);
    // 旧日再临（深渊主宰·妲莉薇特，2026-09-16 定版）：免疫诅咒 + 招式均已注能 + 召唤 4 名无攻血封印肢体
    if (legacyPlayEffects && /免疫诅咒/.test(String(card.desc || ''))) {
      instanceRuntime.set$playerCurseImmune(true);
      // 永久来源在临时窗口内获得时，到期也必须保留。
      instanceRuntime.delayed.forEach(q => { if (q.special === 'curseImmuneOff') q.restore = true; });
      instanceRuntime.G.log('[[icon:shield]] <b>旧日再临</b>：诅咒无法侵染深渊主宰', 'ok');
    }
    // 第十二批·邪能护体（2026-09-23）：「本回合免疫所有伤害和诅咒效果」——注能打出才登记；
    // 诅咒部分走 playerCurseImmune，下回合开始由 curseImmuneOff 还原（restore 记原值：
    // 深渊主宰的永久免疫在场时原值为 true，还原后仍免疫，不受本卡影响）。
    // 伤害部分由文本侧祝福·免疫伤害（buff.immune，n=1 回合）承担。
    if (legacyPlayEffects && infusedBase && /免疫所有伤害和诅咒效果/.test(String(card.desc || ''))) {
      const prior = instanceRuntime.playerCurseImmune;
      instanceRuntime.set$playerCurseImmune(true);
      // 同一临时窗口只保留最早基值，重复使用不能把临时 true 记成永久来源。
      if (!instanceRuntime.delayed.some(q => q.special === 'curseImmuneOff')) {
        instanceRuntime.delayed.push({ special: 'curseImmuneOff', restore: !!prior });
      }
      instanceRuntime.G.log('[[icon:shield]] <b>邪能护体</b>：本回合免疫所有伤害与诅咒效果', 'ok');
    }
    if (legacyPlayEffects && /均视为已注能|均已注能/.test(String(card.desc || ''))) {
      instanceRuntime.set$allSpellsInfused(true);
      instanceRuntime.G.log('[[icon:sparkles]] <b>旧日再临</b>：所有可注能与必须注能的招式，均视为已注能', 'ok');
    }
    if (legacyPlayEffects && /召唤\s*4\s*名封印肢体/.test(String(card.desc || ''))) {
      summonAlly('封印肢体', 0, 0, 4, true);
      instanceRuntime.G.log('[[icon:paw]] 四条<b>封印肢体</b>重现世间——如天国之门般无攻无血的场面物件', 'sys');
    }
    // 箭矢符文：你的「箭」释放 2 次（第二段免费用）
    if (instanceRuntime.arrowRune && isArrowRuneCard(card)) {
      instanceRuntime.G.log('[[icon:runner]] <b>箭矢符文</b>：箭再度释放', 'sys');
      emitRecast({ card, uid, source: '箭矢符文', repeatIndex: 1, repeatTotal: 1 });
      await resolveCardWithFeedback(resolverCard, target, infusedBase, fuelCostSum, uid, signal);
      await takeSurge(signal);
    }
    applyKillRewards(card, Math.max(0, aliveBefore - alive().length - (instanceRuntime.foes.filter(foe => foe.controlled).length - controlledBefore)));
    if (instanceRuntime.poisonOnSpell && card.type === '法术') poisonRandomFoe();
    // Q8 老板定向：不变应万变——打出武术后，手中所有「不变应万变」变为该武术的 1 费复制
    if (card.type === '武术') applyImitate(card);
    // M3：pick:'new' 段级重新点选（血毒双镖双目标）——主结算已跳过 pick 段，此处进入点选后结算
    const pickOps = (card.rules?.triggers?.onPlay || []).filter(op => op && op.pick === 'new');
    if (pickOps.length && alive().length) {
      beginDartStrike({ uid, card, ops: pickOps });
    }
    // 「永远被保留在手牌中」（不朽斩）：打出后回到手牌，不进弃牌堆
    // M3：rules.battle.keepInHand 结构化开关与 desc 正则单源
    if (keepsCardInHand(card)) {
      const di = instanceRuntime.discard.lastIndexOf(uid); if (di >= 0) instanceRuntime.discard.splice(di, 1);
      const pi = instanceRuntime.played.lastIndexOf(uid); if (pi >= 0) instanceRuntime.played.splice(pi, 1);
      if (instanceRuntime.hand.length < instanceRuntime.effectiveHandMax(R().battleHandMax)) {
        instanceRuntime.hand.push(uid);
        instanceRuntime.cardAnims.push({ kind: 'draw', uid, name: card.name });
        instanceRuntime.G.log(`[[icon:cards]] 【${esc(card.name)}】保留在手牌中（无法用于注能）`, 'sys');
      } else {
        // 手牌满不能弃置回手：uid 已从 discard/played 移除，不兜底会从所有牌区消失
        instanceRuntime.discard.push(uid);
        instanceRuntime.G.log(`[[icon:cards]] 手牌已满，【${esc(card.name)}】回到弃牌堆`, 'sys');
      }
    }
    sweepDead();
    instanceRuntime.set$lastPlayedType(card.type);   // 供「上一张牌是武术→0费」类条件费用判定
    requestedCardPlayed(card);
    // 打出侧计数（结算后自增——「其他招式/其他武术」不含正在打出的本牌）：
    // 招式＝武术+法术（设计者 2026-09-10 定版，2026-09-29 复核维持）连续射击；追斩只数武术
    const completed = recordCompletedBattleCard(card, uid);
    instanceRuntime.set$playedMovesThisTurn(completed.movesAfter);
    instanceRuntime.set$playedMartialThisTurn(completed.martialAfter);
    // M2：打出卡以原卡登记时点触发器（onTurnStart/onTurnEnd/onKill/onDamaged/onPlayCard…，
    // 容器级 duration 控制持续次数）；登记后向已登记卡广播「打出牌时」。
    // 本卡的时点容器已在结算前剥离（见 resolverCard），此后由 runner 按时点触发。
    if (triggersM2) {
      triggersM2.registerCard(card, uid, { battleStarted: true });
      triggersM2.firePlayCard();
    }
    if (isLegacyBloodpoison(card) && !pickOps.length) beginDartStrike();   // 旧双镖二段点选
    if (!alive().length) { finish(true); return false; }
    processChoice();
    processDiscoverQueue();
    requestBattleRender();
    return true;
    } finally {
      markCardResolving(uid, signal, false);
      if (instanceRuntime.activeActionSignal === signal) instanceRuntime.set$activeActionSignal(null);
    }
  }

  return { queueCardExecution, submitCardExecution, getExecutionAvailability };
}
return { createBattleExecPlay };
}
