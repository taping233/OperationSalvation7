import { esc } from '../../core/shared.js';
import { BATTLE_PHASES, beginTargeting } from '../runtime/battle.state.js';
import { targetSideFor, unplayableReasonFor } from '../effects/battle.target-rules.js';
import { isFoeFightCard, withFoeFightTargets } from '../effects/battle.foe-fight.js';
import { rejectUnsupportedCard } from '../effects/battle.rule-guard.js';
import { inspectCardRuleCapability } from '../../cards/card-rules.capability.js';
import { createInfusionDomain } from '../effects/battle.infusion.domain.js';

/** Instance-owned state and host services are captured explicitly. */
export function createCardPlayDomain(context) {

const { missingInfusionReason } = createInfusionDomain(context);
/** Player command boundary: inspect, collect fuel/targets, then submit one execution.
 * readState returns current runtime bindings; no battle state is owned by this module.
 */
function createBattleCardPlay({
  readState, damageTypes, sound, alive, findCard, findEffectiveCard, infusionFuelReason,
  infuseOf, effCostOf, equipCap, hasPendingEndTurn, interactionOf, cardIdentity,
  requestedTargetReason, executeTargetReason, warnCardRuleRejection, requestBattleRender,
  queueCardExecution, executionAvailability, submitExecution, resumeTurnEnd,
  set$interaction, set$pendingHint, set$battleState, set$infusing,
  clearTargetHint, cancelTargetingState,
}) {
  let selectionSeq = 0;
  // Pointer intent is tied to this material step, never copied into snapshots.
  const infusionTargets = new WeakMap();
  const battleInputCurrent = () => !!readState().G?.battleActive
    && [BATTLE_PHASES.PLAYER, BATTLE_PHASES.TARGETING].includes(readState().battleState.phase);
  const infusionCurrent = () => {
    const selection = readState().infusing;
    return !!selection && battleInputCurrent() && !readState().busy
      && selection.battleToken === readState().battleState.token
      && readState().hand.includes(selection.uid);
  };
function clearTargetSession(preserveCardUid = null) {
    if (!readState().interaction && readState().battleState.phase !== BATTLE_PHASES.TARGETING) return false;
    const i = readState().interaction;
    clearTargetHint();   // 清卡牌槽位与暂存提示（成对清理聚合；freeCast 簿记不读二者，次序独立）
    if (i && i.kind === 'card' && i.uid !== preserveCardUid && readState().freeCast.has(i.uid)) readState().freeCast.delete(i.uid);
    if (readState().battleState.phase === BATTLE_PHASES.TARGETING) cancelTargetingState();
    return true;
  }
function cancelInteraction() {
    if (!clearTargetSession()) return;
    resumeTurnEnd();
    requestBattleRender();
  }
function beginSpecialTargeting(kind, uid = null, card = null, extra = null) {
    clearTargetSession();
    set$interaction({ kind, uid, card, hint: '', ...(extra ? { extra } : {}) });
    requestBattleRender();
  }
function beginCardTargeting(uid, card, targetIds, hint, fuelUids = [], foeFightFirst = null) {
    const previous = interactionOf('card');
    if (previous?.uid === uid && !fuelUids.length) fuelUids = previous.fuelUids || [];
    clearTargetSession(uid);
    set$interaction({ kind: 'card', uid, card, hint: hint || '', fuelUids: [...fuelUids], foeFightFirst,
      battleToken: readState().battleState.token, selectionId: ++selectionSeq });
    set$battleState(beginTargeting(readState().battleState, uid, targetIds));
    set$pendingHint(hint || '');
    requestBattleRender();
  }

  // ---------- 目标规则（v0.22 设计者定版：指向性卡必须拖到目标身上） ----------
  // 'enemy' = 伤害类 → 拖到敌人身上打出
  // 'self'  = 治疗/净化/护甲/护盾/格挡类 → 拖到自己（立绘）身上
  // null    = 群体卡与无指向效果（抽牌/发现/能量…）→ 直接点击打出
  function targetSide(card) {
    return targetSideFor(card, damageTypes());
  }

  // ---------- 不可打出判定（v0.24：无法使用的卡在手中虚化、无法触发并提示原因） ----------
  // 资源/事件卡任何战斗都打不出；牌库/墓地类词条只有对战 BOSS 才生效
  // （普通战斗没有牌库与墓地概念）；道具卡只能在普通战斗中使用。
  // 2026-09-09 老板 #14：手牌代价（消耗 N 张 X / 选择 N 张手牌）不足时同样不可打出。
  function unplayableReason(card, renderContext = null) {
    if (card?._battleTransformMissing) return `转换目标「${card._battleTransformMissing}」缺失，暂时无法使用`;
    if (isFoeFightCard(card) && alive().length < 2) return '场上敌人不足两名，无法互相攻击';
    // Only a single synchronous render or hover batch shares this raw-hand projection.
    // Standalone queries and submissions omit it and resolve the current live hand.
    // Keep raw card identity and findCard's legacy repairs, not effective faces.
    const handCards = renderContext?.handCards || readState().hand.map(u => { const o = findCard(u); return o ? { uid: u, card: o.card } : null; }).filter(Boolean);
    if (renderContext) renderContext.handCards = handCards;
    return unplayableReasonFor(card, readState().mode, { handCards, selfCard: card });
  }

  function equipmentPlayLimit(card) {
    if (card?.type !== '装备') return null;
    const cap = equipCap();
    const worn = readState().equipped.length;
    return worn >= cap ? { card, cap, worn, reason: { code:'EQUIPMENT_FULL', message:`最多同时装配 ${cap} 件装备（已装配 ${worn} 件）——本场无法再穿戴` } } : null;
  }
  function handUnplayableReason(card, renderContext = null) {
    return unplayableReason(card, renderContext) || equipmentPlayLimit(card)?.reason.message || null;
  }

  function inspectCardPlay(uid, allowInfusing = false, handRuleContext = null) {
    const fail = (code, message, card = null) => ({ card, reason:{ code, message } });
    if (!battleInputCurrent()) return fail('NO_ACTIVE_BATTLE', '当前不是可出牌的战斗阶段');
    const pending = interactionOf('card');
    if (pending?.uid === uid && pending.battleToken != null && pending.battleToken !== readState().battleState.token) return fail('STALE_SELECTION', '这次施放已失效，请重新选牌');
    if (!readState().hand.includes(uid)) return fail('NOT_IN_HAND', '这张牌已不在当前手牌中');
    if (readState().busy || readState().infusing && !allowInfusing || readState().discovering || readState().choosing || readState().handSelecting || readState().viewingGrave || readState().viewingDeck) return fail('INPUT_BUSY', '当前动作或选择尚未结束');
    if (hasPendingEndTurn() && interactionOf('card')?.uid !== uid) return fail('TURN_END_PENDING', '回合结束流程正在等待原目标');
    const entry = findEffectiveCard(uid);
    if (!entry) return fail('CARD_MISSING', '当前卡牌暂不可用');
    const card = entry.card;
    const capability = inspectCardRuleCapability(card);
    if (!capability.ok) return fail(capability.kind === 'invalid' ? 'RULE_INVALID' : 'RULE_UNSUPPORTED', capability.kind === 'invalid' ? '规则格式非法' : '规则尚未支持', card);
    const why = unplayableReason(card, handRuleContext);
    if (why) return fail('CARD_UNPLAYABLE', `【${card.name}】无法打出：${why}`, card);
    const effCost = effCostOf(card, uid);
    if (effCost > readState().energy) return fail('INSUFFICIENT_ENERGY', `能量不足：【${card.name}】需要 ${effCost} 点能量`, card);
    const equipmentLimit = equipmentPlayLimit(card);
    if (equipmentLimit) return equipmentLimit;
    return { card, reason:null };
  }
  function infusionChoiceReason(uid, card) {
    if (hasPendingEndTurn()) return { code:'TURN_END_PENDING', message:'回合结束流程中不能开始新的注能选择' };
    const need = infuseOf(card);
    const others = readState().hand.filter(handUid => handUid !== uid && !infusionFuelReason(handUid));
    return others.length < need ? { code:'INFUSION_MATERIALS', message:`手牌不足：【${card.name}】注能(${need}) 需要消耗 ${need} 张手牌，当前只有 ${others.length} 张可选` } : null;
  }
  function needsInfusionChoice(uid, card, forceDirect) {
    if (forceDirect || infuseOf(card) <= 0 || interactionOf('card')?.uid === uid) return false;
    // Optional infusion still has its base play when a full payment is unavailable.
    return !infusionChoiceReason(uid, card) || !!missingInfusionReason(card, 0, readState().allSpellsInfused);
  }
  function selectedFuelReason(uid, card, fuel) {
    if (!fuel.length) return null;
    const need = infuseOf(card);
    return fuel.length !== need || new Set(fuel).size !== fuel.length
      || fuel.some(fuelUid => fuelUid === uid || infusionFuelReason(fuelUid))
      ? { code:'FUEL_INVALID', message:'注能材料已失效，请返回选材后重新确认' } : null;
  }
  /** @returns {import('../battle.play-submission.types.js').CardPlayRejected} */
  const cardPlayRejected = (uid, reason) => Object.freeze({ status:'rejected', uid, battleToken:readState().battleState.token, reason:Object.freeze(reason) });
  const cardPlayNeedsInput = (uid, kind) => Object.freeze({ status:'needs-input', kind, uid, battleToken:readState().battleState.token });
  /**
   * @param {import('../battle.play-submission.types.js').CardPlayUid} uid
   * @param {string|number|null} [side]
   * @param {boolean} [forceDirect]
   * @param {{handCards?: Array<{uid: string|number, card: object}>}|null} [handRuleContext] One synchronous query batch only.
   * @returns {import('../battle.play-submission.types.js').CardPlayAvailability}
   */
  function getCardPlayAvailability(uid, side = undefined, forceDirect = false, handRuleContext = null) {
    if (!readState().G?.battleActive) return cardPlayRejected(uid, { code:'NO_ACTIVE_BATTLE', message:'当前战斗已经结束' });
    const check = inspectCardPlay(uid, false, handRuleContext);
    if (check.reason) return cardPlayRejected(uid, check.reason);
    const card = check.card;
    if (needsInfusionChoice(uid, card, forceDirect)) {
      const reason = infusionChoiceReason(uid, card);
      return reason ? cardPlayRejected(uid, reason) : Object.freeze({ status:'ready', uid, battleToken:readState().battleState.token });
    }
    const need = targetSide(card);
    const pending = interactionOf('card');
    const fuel = pending?.uid === uid ? pending.fuelUids || [] : [];
    const needsTarget = need === 'enemy' && (side == null || side === 'self' || !readState().foes[+side] || readState().foes[+side].dead)
      || need === 'self' && side !== 'self';
    const infusionIssue = missingInfusionReason(card, fuel.length, readState().allSpellsInfused);
    const executeIssue = requestedTargetReason(card, side == null || side === 'self' ? null : readState().foes[+side], alive()) || executeTargetReason(card, side == null || side === 'self' ? null : readState().foes[+side], alive());
    const reason = selectedFuelReason(uid, card, fuel) || executeIssue || (infusionIssue ? { code:'INFUSION_REQUIRED', message:infusionIssue }
      : needsTarget ? null : executionAvailability(uid, card, fuel, readState().freeCast.has(uid)));
    return reason ? cardPlayRejected(uid, reason) : Object.freeze({ status:'ready', uid, battleToken:readState().battleState.token });
  }
  function performCardPlay(uid, side, forceDirect, submission = false) {
    if (submission && !readState().G?.battleActive) return cardPlayRejected(uid, { code:'NO_ACTIVE_BATTLE', message:'当前战斗已经结束' });
    const check = inspectCardPlay(uid);
    if (check.reason) {
      const ruleRejected = ['RULE_INVALID','RULE_UNSUPPORTED'].includes(check.reason.code);
      if (ruleRejected) rejectUnsupportedCard(check.card, { warn:warnCardRuleRejection });
      else if (check.reason.code === 'EQUIPMENT_FULL') readState().G.log(`[[icon:tools]] 最多同时装配 <b>${check.cap}</b> 件装备（已装配 ${check.worn} 件）——本场无法再穿戴`, 'warn');
      else if (!['NO_ACTIVE_BATTLE','NOT_IN_HAND','INPUT_BUSY','TURN_END_PENDING','CARD_MISSING'].includes(check.reason.code)) readState().G.log(`${check.reason.code === 'INSUFFICIENT_ENERGY' ? '[[icon:bolt]]' : '[[icon:cross]]'} ${esc(check.reason.message)}`, 'warn');
      return submission ? cardPlayRejected(uid, check.reason) : ruleRejected ? false : undefined;
    }
    let card = check.card;
    // 只清「上一张卡」的指向槽；背包砸击/血毒双镖/道具点选等非卡牌点选态有自己的生命周期
    // （R3-0：待选期间打出别的卡不吞砸击选择态），一并清会把它们顺带取消。
    const staleCard = interactionOf('card');
    if (staleCard && staleCard.uid !== uid) clearTargetSession();
    // Mouse and keyboard share the material step; explicit direct play stays available.
    if (needsInfusionChoice(uid, card, forceDirect)) {
      beginInfuse(uid, side);
      if (!submission) return;
      return readState().infusing?.uid === uid ? cardPlayNeedsInput(uid, 'infusion')
        : cardPlayRejected(uid, infusionChoiceReason(uid, card) || { code:'INFUSION_UNAVAILABLE', message:'当前无法进入注能选择' });
    }
    // 目标校验：指向性卡必须拖到对应目标（点卡只是锁定提示，不会打出）
    const need = targetSide(card);
    let target = null;
    const isFree = readState().freeCast.has(uid);
    const pendingCard = interactionOf('card');
    const fuel = pendingCard?.uid === uid ? pendingCard.fuelUids || [] : [];
    const fuelIssue = selectedFuelReason(uid, card, fuel);
    if (fuelIssue) {
      readState().G.log(`[[icon:cross]] ${esc(fuelIssue.message)}`, 'warn');
      requestBattleRender();
      return submission ? cardPlayRejected(uid, fuelIssue) : undefined;
    }
    const infusionIssue = missingInfusionReason(card, fuel.length, readState().allSpellsInfused);
    if (infusionIssue) {
      readState().G.log(`[[icon:cross]] ${esc(infusionIssue)}`, 'warn');
      return submission ? cardPlayRejected(uid, { code:'INFUSION_REQUIRED', message:infusionIssue }) : undefined;
    }
    const executeIssue = requestedTargetReason(card, side == null || side === 'self' ? null : readState().foes[+side], alive()) || executeTargetReason(card, side == null || side === 'self' ? null : readState().foes[+side], alive());
    if (executeIssue) {
      readState().G.log(`[[icon:cross]] ${esc(executeIssue.message)}`, 'warn');
      return submission ? cardPlayRejected(uid, executeIssue) : undefined;
    }
    if (need === 'enemy') {
      if (side == null || side === 'self') { beginCardTargeting(uid, card, alive().map(foe => foe.id)); return submission ? cardPlayNeedsInput(uid, 'target') : undefined; }
      target = readState().foes[+side];
      if (!target || target.dead) { beginCardTargeting(uid, card, alive().map(foe => foe.id)); return submission ? cardPlayNeedsInput(uid, 'target') : undefined; }
    } else if (need === 'self') {
      if (side !== 'self') { beginCardTargeting(uid, card, ['self']); return submission ? cardPlayNeedsInput(uid, 'target') : undefined; }
    } else {
      target = alive()[0] || null;
    }
    if (isFoeFightCard(card)) {
      const first = pendingCard?.uid === uid ? pendingCard.foeFightFirst : null;
      if (!first || first.dead || !readState().foes.includes(first)) {
        beginCardTargeting(uid, card, alive().filter(foe => foe !== target).map(foe => foe.id),
          `已选 ${target.name} 先攻击；再选另一名敌人（存活才反击）· Esc 取消`, fuel, target);
        return submission ? cardPlayNeedsInput(uid, 'target') : undefined;
      }
      if (first === target) {
        readState().G.log('[[icon:cross]] 扰敌：请选择另一名存活敌人', 'warn');
        requestBattleRender();
        return submission ? cardPlayNeedsInput(uid, 'target') : undefined;
      }
      card = withFoeFightTargets(card, [first, target]);
      target = first;
    }
    const availabilityIssue = executionAvailability(uid, card, fuel, isFree);
    if (availabilityIssue) {
      readState().G.log(`[[icon:cross]] ${esc(availabilityIssue.message)}`, 'warn');
      requestBattleRender();
      return submission ? cardPlayRejected(uid, availabilityIssue) : undefined;
    }
    if (pendingCard) set$interaction(null);   // 交互正常结算：清卡牌槽（不 cancelTargeting，RESOLVING 迁移接管阶段）
    set$pendingHint('');
    // 「杀化为X」战斗规则：打出的初始攻击以目标卡形态结算（uid 沿用，弃牌簿记不变）
    if (submission) return submitExecution(uid, card, fuel, target, isFree);
    queueCardExecution(uid, card, fuel, target, isFree);
  }
  function play(uid, side, forceDirect) { return performCardPlay(uid, side, forceDirect); }
  /**
   * @param {import('../battle.play-submission.types.js').CardPlayUid} uid
   * @param {string|number|null} [side]
   * @param {boolean} [forceDirect]
   * @returns {import('../battle.play-submission.types.js').CardPlaySubmission}
   */
  function submitCardPlay(uid, side = undefined, forceDirect = false) {
    return /** @type {import('../battle.play-submission.types.js').CardPlaySubmission} */ (performCardPlay(uid, side, forceDirect, true));
  }
  // v0.32 堆叠手牌：点击传入手牌 uid——按 uid 精确 toggle（N1 修复，2026-09-25 老板定版）：
  // 点已选中的那张=取消它（per-uid delete，同叠/别叠的其他已选张不受影响）；
  // 点未选中的=尝试选中这张本身（组级校验保留：uid 必须是手牌里与本卡同名的真手牌，
  // 容量仍按 need 封顶）。旧实现是「组级 toggle」（组内有已选即 delete 最后一张），
  // 同名堆叠 ×need≥2 时点第二张会顶掉第一张，燃料永远选不满（tt12 走查 N1）。
  function toggleInfusePick(uid) {
    if (!infusionCurrent() || uid === readState().infusing.uid) return;
    const entry = findCard(uid);
    if (!entry) return;
    // Allow removing a previously picked card even if a transform made it illegal.
    if (readState().infusing.picked.has(uid)) {
      readState().infusing.picked.delete(uid);
    } else {
      if (infusionFuelReason(uid)) return;
      const groupUids = readState().hand.filter(h => {
        if (h === readState().infusing.uid) return false;
        const o = findCard(h);
        return o && cardIdentity(o.card) === cardIdentity(entry.card);
      });
      if (groupUids.includes(uid) && readState().infusing.picked.size < readState().infusing.need) readState().infusing.picked.add(uid);
    }
    requestBattleRender();
  }
  function cancelInfuse() {
    if (!readState().infusing) return;
    set$infusing(null);
    resumeTurnEnd();
    requestBattleRender();
  }
  // The same entry also returns from targeting without replacing selected UIDs.
  function beginInfuse(uid, side = undefined) {
    const check = inspectCardPlay(uid);
    if (check.reason) {
      if (['RULE_INVALID','RULE_UNSUPPORTED'].includes(check.reason.code)) {
        rejectUnsupportedCard(check.card, { warn:warnCardRuleRejection });
        return false;
      }
      return;
    }
    if (hasPendingEndTurn()) return;
    const card = check.card;
    const infN = infuseOf(card);
    if (infN <= 0) return;
    const previous = interactionOf('card');
    if (previous?.battleToken != null && previous.battleToken !== readState().battleState.token) return;
    const previousFuel = previous?.uid === uid ? previous.fuelUids || [] : [];
    const choiceIssue = infusionChoiceReason(uid, card);
    if (choiceIssue && !previousFuel.length) {
      readState().G.log(`[[icon:flask]] ${esc(choiceIssue.message)}`, 'warn');
      return;
    }
    clearTargetSession(uid);
    const picked = new Set(previousFuel.filter(fuelUid => fuelUid !== uid && !infusionFuelReason(fuelUid)).slice(0, infN));
    const selection = { uid, card, need: infN, picked, targetIndex:null,
      battleToken: readState().battleState.token, selectionId: ++selectionSeq };
    if (side === 'self' || side != null && readState().foes[+side] && !readState().foes[+side].dead) {
      infusionTargets.set(selection, { side, target: side === 'self' ? null : readState().foes[+side] });
      if (side !== 'self') selection.targetIndex = +side;
    }
    set$infusing(selection);
    requestBattleRender();
  }
  function confirmInfuse() {
    // 迭代评审 09-20：特色机制全程接音——成功=confirm 生效感，校验不过=deny（按钮路径会被
    // deny 反向抑制吞掉、仅保留视觉，程序化路径正常出声，见 sound.js DENY_SUPPRESS_MS）
    if (!infusionCurrent()) return;
    const selection = readState().infusing;
    const { uid } = selection;
    const check = inspectCardPlay(uid, true);
    if (check.reason) {
      readState().G.log(`[[icon:cross]] ${esc(check.reason.message)}`, 'warn');
      requestBattleRender(); return;
    }
    const card = check.card;
    const need = infuseOf(card);
    selection.card = card;
    selection.need = need;
    const fuel = [...selection.picked].slice(0, need);
    const invalid = fuel.filter(fuelUid => infusionFuelReason(fuelUid));
    if (invalid.length) {
      invalid.forEach(fuelUid => readState().infusing.picked.delete(fuelUid));
      readState().G.log('[[icon:cross]] 注能材料已失效，请重新选择可用手牌', 'warn');
      requestBattleRender();
      return;
    }
    if (fuel.length !== need) { sound('deny'); requestBattleRender(); return; }
    const intended = infusionTargets.get(selection);
    set$infusing(null);
    sound('confirm');
    const side = targetSide(card);
    /** @type {string|number|undefined} */
    let chosenSide = side === 'self' ? 'self' : undefined;
    if (side === 'enemy') {
      const intendedIndex = intended?.side !== 'self' ? readState().foes.indexOf(intended?.target) : -1;
      if (intendedIndex >= 0 && !readState().foes[intendedIndex].dead) chosenSide = intendedIndex;
      else if (!intended && alive().length === 1) chosenSide = readState().foes.indexOf(alive()[0]);
    }
    set$interaction({ kind:'card', uid, card, hint:`已选 ${fuel.length} 张材料：选择【${card.name}】的目标`, fuelUids:fuel,
      battleToken:readState().battleState.token, selectionId:++selectionSeq });
    return submitCardPlay(uid, chosenSide, true);
  }

  return { clearTargetSession, cancelInteraction, beginSpecialTargeting, beginCardTargeting, targetSide, unplayableReason, handUnplayableReason, getCardPlayAvailability, play, submitCardPlay, toggleInfusePick, cancelInfuse, beginInfuse, confirmInfuse };
}
return { createBattleCardPlay };
}
