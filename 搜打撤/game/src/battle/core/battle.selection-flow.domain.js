import { createTargetTurnCostModifier } from '../effects/battle.cost-modifiers.js';
import { createInfusionDomain } from '../effects/battle.infusion.domain.js';
import { esc } from '../../core/shared.js';
import { splitEffectClauses as splitClauses } from '../effects/battle.effects.js';
import { isHandPaymentCandidate, matchesHandSelectKey } from './battle.hand-selection.js';
import { createBattleDiscoverFlow } from '../effects/battle.discover-flow.js';
import { withBlessingChoices } from '../effects/random-blessings.js';
import { createChoiceSemanticOperations } from '../effects/choice-semantic-operations.js';

/** Instance-owned state and host services are captured explicitly. */
export function createSelectionDomain(context) {
const instanceRuntime = context.runtime;
const { missingInfusionReason } = createInfusionDomain(context);
const choiceSemantics = createChoiceSemanticOperations(context);
/* battle.selection-flow.js —— 战斗内选牌、抉择与发现队列。
 * 弹层状态来自 battle.runtime.js；引擎只注入卡牌执行与战斗收尾操作。 */

/** @typedef {import('../battle.snapshot.types.js').BattleCardInput & { rarity?: string, cls?: string, _pouch?: import('../battle.snapshot.types.js').BattleCardInput[] }} SelectionCard */
/** @typedef {{ all: () => SelectionCard[], isRandomObtainable: (card: SelectionCard) => boolean, sellPrice: (card: SelectionCard) => number }} SelectionCardsPort */

/**
 * @param {{ cards: SelectionCardsPort, deny: () => void, random01: () => number, throwIfActionCancelled: (signal: AbortSignal | undefined) => void, session: { handSelectQueue: unknown[], choiceQueue: unknown[], resumeTurnEnd?: () => boolean }, [key: string]: unknown }} ports
 */
function createBattleSelectionFlow({
  cards, deny, random01, throwIfActionCancelled,
  session, requestBattleRender, findCard, addTempCard, addDeckCard, shuffleDeck, queueBattleAction,
  runStagedSteps, applyTextEffects, queueCardExecution, fireConsumeTriggers, stepsForOperations,
  fireCatGift, swapCardCosts, sweepDead, finish,
}) {
  const { handSelectQueue, choiceQueue } = session;
  const alive = () => instanceRuntime.foes.filter(foe => !foe.dead);
  const discoverFlow = createBattleDiscoverFlow({
    cards: {
      all: () => cards.all(),
      isRandomObtainable: card => cards.isRandomObtainable(card),
      sellPrice: card => cards.sellPrice(card),
      findByUid: uid => findCard(uid),
      addTempCard,
      addDeckCard,
      moveDeckCardToHand: uid => {
        const entry = findCard(uid);
        if (!entry || instanceRuntime.hand.includes(uid) || instanceRuntime.drawPile.includes(uid)) return false;
        instanceRuntime.hand.push(uid);
        instanceRuntime.lastDrawnUids.push(uid);
        instanceRuntime.cardAnims.push({ kind: 'draw', uid, name: entry.card.name, card: { ...entry.card } });
        return true;
      },
      queueCardExecution,
      fireCatGift,
      directPlayReason: card => missingInfusionReason(card, 0, instanceRuntime.allSpellsInfused),
    },
    interaction: {
      getJobs: () => instanceRuntime.discoverQueue,
      get: () => instanceRuntime.discovering,
      set: instanceRuntime.set$discovering,
      requestRender: requestBattleRender,
    },
    random: { next: random01 },
    battle: {
      currentClass: () => instanceRuntime.G?.myClass,
      battleActive: () => !!instanceRuntime.G?.battleActive,   // D-4（2026-09-29 U7）：discover-flow 终局入口守卫接线
      firstAliveTarget: () => alive()[0] || null,
      hasAliveFoes: () => alive().length > 0,
      sweepDead,
      finishVictory: () => finish(true),
    },
    effects: {
      shuffleDeck,
      returnToDeckBottom: uids => instanceRuntime.drawPile.unshift(...uids),
      addArmor: amount => { instanceRuntime.pdef.armor += amount; return instanceRuntime.pdef.armor; },
      setCardOverride: (uid, card) => instanceRuntime.cardOverrides.set(uid, card),
      enqueueDelayed: effect => instanceRuntime.delayed.push(effect),
      swapCardCosts,
      removeOwnedCard: uid => {   // 09-29 锦囊双向同步：施放即消耗背包母本（存档收尾自然持久化）
        const list = instanceRuntime.G.ownedCards || [];
        const i = list.findIndex(o => o.uid === uid);
        if (i >= 0) {
          const gone = list.splice(i, 1)[0];
          instanceRuntime.G.log(`[[icon:flask]] <b>法师锦囊</b>：背包中的【${esc(gone?.card?.name || '?')}】母本已随之消耗`, 'sys');
        }
      },
    },
    output: { log: (message, kind) => instanceRuntime.G.log(message, kind) },
  });
  const randomDiscoverCard = (...args) => discoverFlow.randomDiscoverCard(...args);
  const processDiscoverQueue = () => {
    // 空池或不支持的发现任务会自行跳过；继续排队任务，不能留下无人处理的回合续接。
    do { discoverFlow.processDiscoverQueue(); }
    while (!instanceRuntime.discovering && instanceRuntime.discoverQueue.length);
  };
  const pickDiscover = index => {
    discoverFlow.pickDiscover(index);
    settleSelections();
  };

  function settleSelections() {
    if (!instanceRuntime.G?.battleActive) return;
    processHandSelect();
    processChoice();
    processDiscoverQueue();
    session.resumeTurnEnd?.();
  }

  // —— 手牌选卡（2026-09-06 #24/#25）：「选择 N 张手牌中的 X 施放/消耗」通用执行 ——
  function processHandSelect() {
    if (instanceRuntime.handSelecting || !handSelectQueue.length) return;
    const job = handSelectQueue.shift();
    // 空池预检：手牌中没有符合条件的卡时直接跳过（防「选择手牌」弹窗死锁，2026-09-09）
    const matched = instanceRuntime.hand.filter(uid => { const o = findCard(uid); return o && matchesHandSelectKey(o.card, job.type); }).length;
    if (!matched) {
      instanceRuntime.G.log(`[[icon:cards]] 手牌中没有${job.type ? `「${esc(job.type)}」` : ''}卡牌可选，该效果跳过`, 'warn');
      processHandSelect();
      return;
    }
    instanceRuntime.set$handSelecting({
      n: Math.min(job.n || 1, matched), type: job.type || null, act: job.act || 'play',
      thenText: job.thenText || '', target: job.target || null, srcCard: job.srcCard || null,
      mandatory: !!job.mandatory, onDone: job.onDone || null,
    });
    requestBattleRender();
  }
  function skipHandSelect() {
    if (!instanceRuntime.handSelecting) return;
    if (instanceRuntime.handSelecting.mandatory) { deny(); return; }
    instanceRuntime.set$handSelecting(null);
    instanceRuntime.G.log('[[icon:cards]] 跳过手牌选择，该效果未结算', 'warn');
    settleSelections();
    requestBattleRender();
  }
  function finishHandSelectionEffect(card, text, target) {
    if (text) {
      queueBattleAction(async signal => {
        await runStagedSteps(applyTextEffects.steps(card, text, target, {}), signal);
        throwIfActionCancelled(signal);
        sweepDead();
        if (!alive().length) { finish(true); return; }
        processHandSelect();
        requestBattleRender();
      }, '选牌后续效果');
      return;
    }
    if (!alive().length) { finish(true); return; }
    settleSelections();
    requestBattleRender();
  }
  function pickHandSelect(uid) {
    if (!instanceRuntime.G?.battleActive || !instanceRuntime.handSelecting) return;
    const entry = findCard(uid);
    if (!entry) return;
    if (instanceRuntime.handSelecting.act === 'payment') {
      const selectedUids = instanceRuntime.handSelecting.selectedUids || [];
      const excludedUids = instanceRuntime.handSelecting.excludedUids || [];
      const handUids = new Set(instanceRuntime.hand);
      const excludedUidSet = new Set(excludedUids);
      const selectedUidSet = new Set(selectedUids);
      if (!isHandPaymentCandidate({
        uid, handUids, card: entry.card, type: instanceRuntime.handSelecting.type,
        excludedUids: excludedUidSet, selectedUids: selectedUidSet,
      })) return;
      const nextSelected = [...selectedUids, uid];
      const remaining = Math.max(0, (+instanceRuntime.handSelecting.n || 1) - 1);
      if (remaining > 0) {
        instanceRuntime.set$handSelecting({ ...instanceRuntime.handSelecting, n: remaining, selectedUids: nextSelected });
        requestBattleRender();
        return;
      }
      const { uid: cardUid, card, fuelUids, target, freeCost, onResolved } = instanceRuntime.handSelecting.payment || {};
      const payment = nextSelected;
      const seenPaymentUids = new Set();
      const valid = card && handUids.has(cardUid) && payment.length ===
        card.rules?.battle?.requirements?.find(rule => rule.kind === 'handCards')?.count &&
        payment.every(paymentUid => {
          const current = findCard(paymentUid);
          const candidate = isHandPaymentCandidate({
            uid: paymentUid, handUids, card: current?.card,
            type: instanceRuntime.handSelecting.type, excludedUids: excludedUidSet,
            selectedUids: seenPaymentUids,
          });
          if (candidate) seenPaymentUids.add(paymentUid);
          return candidate;
        });
      instanceRuntime.set$handSelecting(null);
      if (!valid) {
        instanceRuntime.G.log(`[[icon:cross]] 【${esc(card?.name || '卡牌')}】手牌支付未凑齐，未消耗手牌或能量`, 'warn');
        settleSelections();
        requestBattleRender();
        return;
      }
      if (queueCardExecution(cardUid, card, fuelUids || [], target || null, !!freeCost, true, payment, onResolved) === false) settleSelections();
      return;
    }
    // 所有效果选牌都只接受当前手牌中的合格候选；旧按钮不能重复消耗已移出的 UID。
    if (!instanceRuntime.hand.includes(uid) || !matchesHandSelectKey(entry.card, instanceRuntime.handSelecting.type)) return;
    if (instanceRuntime.handSelecting.act === 'play') {
      instanceRuntime.set$handSelecting(null);
      if (queueCardExecution(uid, entry.card, [], alive()[0] || null, true) === false) settleSelections();   // 选卡施放：不扣费
      return;
    }
    if (instanceRuntime.handSelecting.act === 'copy') {
      // 深红丝袋：复制选中的手牌（原牌保留，复制件为战斗内临时卡）
      addTempCard({ ...entry.card });
      instanceRuntime.G.log(`[[icon:cards]] 复制了手牌中的【<b>${esc(entry.card.name)}</b>】（置入手牌，原牌保留）`, 'loot');
      instanceRuntime.handSelecting.n -= 1;
      if (instanceRuntime.handSelecting.n > 0) { requestBattleRender(); return; }
      const doneJob = instanceRuntime.handSelecting;
      instanceRuntime.set$handSelecting(null);
      finishHandSelectionEffect(entry.card, doneJob.thenText, null);
      return;
    }
    if (instanceRuntime.handSelecting.act === 'zero') {
      // 自然法杖：选中的卡下回合变为 0 费（2026-09-09 C10）
      instanceRuntime.zeroFeeUntil.set(uid, createTargetTurnCostModifier(0, instanceRuntime.turn + 1));
      instanceRuntime.G.log(`[[icon:bolt]] 【${esc(entry.card.name)}】下回合打出时变为 <b>0</b> 费`, 'sys');
      instanceRuntime.set$handSelecting(null);
      settleSelections();
      requestBattleRender();
      return;
    }
    instanceRuntime.set$hand(instanceRuntime.hand.filter(h => h !== uid));
    instanceRuntime.consumed.push(uid);
    instanceRuntime.cardAnims.push({ kind: 'burn', uid, name: entry.card.name });
    instanceRuntime.G.log(`[[icon:flask]] 消耗了手牌中的【<b>${esc(entry.card.name)}</b>】`, 'sys');
    const job = instanceRuntime.handSelecting;
    job.n -= 1;
    // 先完成当前选牌，再触发它产生的新选牌，避免旧收尾清掉新弹层。
    if (job.n <= 0) instanceRuntime.set$handSelecting(null);
    // Q2 老板定向：手选消耗也算「消耗该牌时」触发
    fireConsumeTriggers(entry.card, null);
    if (!instanceRuntime.G?.battleActive) return;
    if (job.n > 0) { requestBattleRender(); return; }
    if (typeof job.onDone === 'function') job.onDone();
    if (!instanceRuntime.G?.battleActive) return;
    finishHandSelectionEffect(job.srcCard || entry.card, job.thenText, job.target || null);
  }
  // —— 抉择面板（2026-09-08 人工 N 选一）：复用发现面板的弹层交互 ——
  function processChoice() {
    if (instanceRuntime.choosing || !choiceQueue.length) return;
    const job = choiceQueue.shift();
    instanceRuntime.set$choosing({ cardName: job.cardName || '？', options: (job.options || []).slice(), secondDoor: !!job.secondDoor,
      ...(job.plans ? { plans: job.plans, srcCard: job.srcCard, otherAfterTurns: job.otherAfterTurns } : {}) });
    requestBattleRender();
  }
  function pickChoice(i) {
    if (!instanceRuntime.G?.battleActive || !instanceRuntime.choosing || !Number.isInteger(+i) ||
        +i < 0 || +i >= instanceRuntime.choosing.options.length) return;
    const job = instanceRuntime.choosing;
    instanceRuntime.set$choosing(null);
    const text = job.options[+i] || '';
    instanceRuntime.G.log(`[[icon:question]] <b>抉择</b>（【${esc(job.cardName)}】）：你选择了「${esc(text)}」`, 'sys');
    if (job.plans) {
      queueBattleAction(async signal => {
        await runStagedSteps(choiceSemantics.selectChoice(job, +i, { stepsForOperations, getAliveFoes: alive }), signal);
        throwIfActionCancelled(signal);
        completeChoice();
      }, '抉择效果');
      return;
    }
    // 选项若指名一张生物/门类卡（如 末日浩劫之门 / 天国之门）：
    // 把它的「回合开始时」效果注册为每回合重复的持续效果（门是场面物件）
    const quoted = text.match(/[‘“「]([^\s，。；‘’“”「」]+)[’”」]/);
    const ref = quoted && cards.all().find(c => c.name === quoted[1]);
    if (ref && ref.type === '生物') {
      const parts = splitClauses(String(ref.desc || ''));
      if (parts.turnStart.length) {
        parts.turnStart.forEach(it => {
          const text = withBlessingChoices(it.text, ref.desc);
          instanceRuntime.delayed.push({ text, cardName: ref.name, repeat: true });
        });
        instanceRuntime.G.log(`[[icon:hourglass]] <b>${esc(ref.name)}</b> 展开：${esc(parts.turnStart.map(it => it.text).join('；'))}（每回合开始生效）`, 'sys');
      } else {
        instanceRuntime.G.log(`[[icon:question]] 【${esc(ref.name)}】没有可展开的回合开始效果（占位）`, 'dim');
      }
      completeChoice();
      return;
    }
    queueBattleAction(async signal => {
      await runStagedSteps(applyTextEffects.steps({ name: job.cardName }, text, alive()[0] || null, {}), signal);
      throwIfActionCancelled(signal);
      completeChoice();
    }, '抉择效果');

    function completeChoice() {
      // 花开两面：「两回合后，开启未选择的那扇门」（2026-09-09 C8 补实装）
      if (job.secondDoor && job.options.length === 2) {
        const otherText = job.options[+i === 0 ? 1 : 0];
        const q2 = otherText.match(/[‘“「]([^\s，。；‘’“”「」]+)[’”」]/);
        const ref2 = q2 && cards.all().find(c => c.name === q2[1]);
        if (ref2 && ref2.type === '生物') {
          const parts2 = splitClauses(String(ref2.desc || ''));
          parts2.turnStart.forEach(it => instanceRuntime.delayed.push({ text: withBlessingChoices(it.text, ref2.desc), cardName: ref2.name, repeat: true, notBeforeTurn: instanceRuntime.turn + 2 }));
          if (parts2.turnStart.length) instanceRuntime.G.log(`[[icon:hourglass]] <b>两回合后</b>：未选择的【${esc(ref2.name)}】也将展开`, 'sys');
        }
      }
      sweepDead();
      if (!alive().length) { finish(true); return; }
      settleSelections();
      requestBattleRender();
    }
  }
  return {
    randomDiscoverCard, matchHandSelectKey: matchesHandSelectKey, processHandSelect, skipHandSelect, pickHandSelect,
    processChoice, pickChoice, processDiscoverQueue, pickDiscover,
  };
}
return { createBattleSelectionFlow };
}
