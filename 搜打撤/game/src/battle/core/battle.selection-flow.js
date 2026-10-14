/* battle.selection-flow.js —— 战斗内选牌、抉择与发现队列。
 * 弹层状态来自 battle.runtime.js；引擎只注入卡牌执行与战斗收尾操作。 */
import { G, foes, hand, drawPile, consumed, cardAnims, handSelecting, choosing, discovering, discoverQueue, zeroFeeUntil, turn, delayed, pdef, cardOverrides, set$handSelecting, set$choosing, set$discovering, set$hand } from '../runtime/battle.runtime.js';
import { esc } from '../../core/shared.js';
import { splitEffectClauses as splitClauses } from '../effects/battle.effects.js';
import { isHandPaymentCandidate, matchesHandSelectKey } from './battle.hand-selection.js';
import { createBattleDiscoverFlow } from '../effects/battle.discover-flow.js';

/** @typedef {import('../battle.snapshot.types.js').BattleCardInput & { rarity?: string, cls?: string, _pouch?: import('../battle.snapshot.types.js').BattleCardInput[] }} SelectionCard */
/** @typedef {{ all: () => SelectionCard[], isRandomObtainable: (card: SelectionCard) => boolean, sellPrice: (card: SelectionCard) => number }} SelectionCardsPort */

/**
 * @param {{ cards: SelectionCardsPort, deny: () => void, random01: () => number, throwIfActionCancelled: (signal: AbortSignal | undefined) => void, session: { handSelectQueue: unknown[], choiceQueue: unknown[], resumeTurnEnd?: () => boolean }, [key: string]: unknown }} ports
 */
export function createBattleSelectionFlow({
  cards, deny, random01, throwIfActionCancelled,
  session, requestBattleRender, findCard, addTempCard, queueBattleAction,
  runStagedSteps, applyTextEffects, queueCardExecution, fireConsumeTriggers,
  fireCatGift, swapCardCosts, sweepDead, finish,
}) {
  const { handSelectQueue, choiceQueue } = session;
  const alive = () => foes.filter(foe => !foe.dead);
  const discoverFlow = createBattleDiscoverFlow({
    cards: {
      all: () => cards.all(),
      isRandomObtainable: card => cards.isRandomObtainable(card),
      sellPrice: card => cards.sellPrice(card),
      findByUid: uid => findCard(uid),
      addTempCard,
      queueCardExecution,
      fireCatGift,
    },
    interaction: {
      getJobs: () => discoverQueue,
      get: () => discovering,
      set: set$discovering,
      requestRender: requestBattleRender,
    },
    random: { next: random01 },
    battle: {
      currentClass: () => G?.myClass,
      battleActive: () => !!G?.battleActive,   // D-4（2026-09-29 U7）：discover-flow 终局入口守卫接线
      firstAliveTarget: () => alive()[0] || null,
      hasAliveFoes: () => alive().length > 0,
      sweepDead,
      finishVictory: () => finish(true),
    },
    effects: {
      returnToDeckBottom: uids => drawPile.unshift(...uids),
      addArmor: amount => { pdef.armor += amount; return pdef.armor; },
      setCardOverride: (uid, card) => cardOverrides.set(uid, card),
      enqueueDelayed: effect => delayed.push(effect),
      swapCardCosts,
      removeOwnedCard: uid => {   // 09-29 锦囊双向同步：施放即消耗背包母本（存档收尾自然持久化）
        const list = G.ownedCards || [];
        const i = list.findIndex(o => o.uid === uid);
        if (i >= 0) {
          const gone = list.splice(i, 1)[0];
          G.log(`[[icon:flask]] <b>法师锦囊</b>：背包中的【${esc(gone?.card?.name || '?')}】母本已随之消耗`, 'sys');
        }
      },
    },
    output: { log: (message, kind) => G.log(message, kind) },
  });
  const randomDiscoverCard = (...args) => discoverFlow.randomDiscoverCard(...args);
  const processDiscoverQueue = () => {
    // 空池或不支持的发现任务会自行跳过；继续排队任务，不能留下无人处理的回合续接。
    do { discoverFlow.processDiscoverQueue(); }
    while (!discovering && discoverQueue.length);
  };
  const pickDiscover = index => {
    discoverFlow.pickDiscover(index);
    settleSelections();
  };

  function settleSelections() {
    if (!G?.battleActive) return;
    processHandSelect();
    processChoice();
    processDiscoverQueue();
    session.resumeTurnEnd?.();
  }

  // —— 手牌选卡（2026-09-06 #24/#25）：「选择 N 张手牌中的 X 施放/消耗」通用执行 ——
  function processHandSelect() {
    if (handSelecting || !handSelectQueue.length) return;
    const job = handSelectQueue.shift();
    // 空池预检：手牌中没有符合条件的卡时直接跳过（防「选择手牌」弹窗死锁，2026-09-09）
    const matched = hand.filter(uid => { const o = findCard(uid); return o && matchesHandSelectKey(o.card, job.type); }).length;
    if (!matched) {
      G.log(`[[icon:cards]] 手牌中没有${job.type ? `「${esc(job.type)}」` : ''}卡牌可选，该效果跳过`, 'warn');
      processHandSelect();
      return;
    }
    set$handSelecting({
      n: Math.min(job.n || 1, matched), type: job.type || null, act: job.act || 'play',
      thenText: job.thenText || '', target: job.target || null, srcCard: job.srcCard || null,
      mandatory: !!job.mandatory, onDone: job.onDone || null,
    });
    requestBattleRender();
  }
  function skipHandSelect() {
    if (!handSelecting) return;
    if (handSelecting.mandatory) { deny(); return; }
    set$handSelecting(null);
    G.log('[[icon:cards]] 跳过手牌选择，该效果未结算', 'warn');
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
    if (!G?.battleActive || !handSelecting) return;
    const entry = findCard(uid);
    if (!entry) return;
    if (handSelecting.act === 'payment') {
      const selectedUids = handSelecting.selectedUids || [];
      const excludedUids = handSelecting.excludedUids || [];
      const handUids = new Set(hand);
      const excludedUidSet = new Set(excludedUids);
      const selectedUidSet = new Set(selectedUids);
      if (!isHandPaymentCandidate({
        uid, handUids, card: entry.card, type: handSelecting.type,
        excludedUids: excludedUidSet, selectedUids: selectedUidSet,
      })) return;
      const nextSelected = [...selectedUids, uid];
      const remaining = Math.max(0, (+handSelecting.n || 1) - 1);
      if (remaining > 0) {
        set$handSelecting({ ...handSelecting, n: remaining, selectedUids: nextSelected });
        requestBattleRender();
        return;
      }
      const { uid: cardUid, card, fuelUids, target, freeCost, onResolved } = handSelecting.payment || {};
      const payment = nextSelected;
      const seenPaymentUids = new Set();
      const valid = card && handUids.has(cardUid) && payment.length ===
        card.rules?.battle?.requirements?.find(rule => rule.kind === 'handCards')?.count &&
        payment.every(paymentUid => {
          const current = findCard(paymentUid);
          const candidate = isHandPaymentCandidate({
            uid: paymentUid, handUids, card: current?.card,
            type: handSelecting.type, excludedUids: excludedUidSet,
            selectedUids: seenPaymentUids,
          });
          if (candidate) seenPaymentUids.add(paymentUid);
          return candidate;
        });
      set$handSelecting(null);
      if (!valid) {
        G.log(`[[icon:cross]] 【${esc(card?.name || '卡牌')}】手牌支付未凑齐，未消耗手牌或能量`, 'warn');
        settleSelections();
        requestBattleRender();
        return;
      }
      if (queueCardExecution(cardUid, card, fuelUids || [], target || null, !!freeCost, true, payment, onResolved) === false) settleSelections();
      return;
    }
    // 所有效果选牌都只接受当前手牌中的合格候选；旧按钮不能重复消耗已移出的 UID。
    if (!hand.includes(uid) || !matchesHandSelectKey(entry.card, handSelecting.type)) return;
    if (handSelecting.act === 'play') {
      set$handSelecting(null);
      if (queueCardExecution(uid, entry.card, [], alive()[0] || null, true) === false) settleSelections();   // 选卡施放：不扣费
      return;
    }
    if (handSelecting.act === 'copy') {
      // 深红丝袋：复制选中的手牌（原牌保留，复制件为战斗内临时卡）
      addTempCard({ ...entry.card });
      G.log(`[[icon:cards]] 复制了手牌中的【<b>${esc(entry.card.name)}</b>】（置入手牌，原牌保留）`, 'loot');
      handSelecting.n -= 1;
      if (handSelecting.n > 0) { requestBattleRender(); return; }
      const doneJob = handSelecting;
      set$handSelecting(null);
      finishHandSelectionEffect(entry.card, doneJob.thenText, null);
      return;
    }
    if (handSelecting.act === 'zero') {
      // 自然法杖：选中的卡下回合变为 0 费（2026-09-09 C10）
      zeroFeeUntil.set(uid, turn + 1);
      G.log(`[[icon:bolt]] 【${esc(entry.card.name)}】下回合打出时变为 <b>0</b> 费`, 'sys');
      set$handSelecting(null);
      settleSelections();
      requestBattleRender();
      return;
    }
    set$hand(hand.filter(h => h !== uid));
    consumed.push(uid);
    cardAnims.push({ kind: 'burn', uid, name: entry.card.name });
    G.log(`[[icon:flask]] 消耗了手牌中的【<b>${esc(entry.card.name)}</b>】`, 'sys');
    const job = handSelecting;
    job.n -= 1;
    // 先完成当前选牌，再触发它产生的新选牌，避免旧收尾清掉新弹层。
    if (job.n <= 0) set$handSelecting(null);
    // Q2 老板定向：手选消耗也算「消耗该牌时」触发
    fireConsumeTriggers(entry.card, null);
    if (!G?.battleActive) return;
    if (job.n > 0) { requestBattleRender(); return; }
    if (typeof job.onDone === 'function') job.onDone();
    if (!G?.battleActive) return;
    finishHandSelectionEffect(job.srcCard || entry.card, job.thenText, job.target || null);
  }
  // —— 抉择面板（2026-09-08 人工 N 选一）：复用发现面板的弹层交互 ——
  function processChoice() {
    if (choosing || !choiceQueue.length) return;
    const job = choiceQueue.shift();
    set$choosing({ cardName: job.cardName || '？', options: (job.options || []).slice(), secondDoor: !!job.secondDoor });
    requestBattleRender();
  }
  function pickChoice(i) {
    if (!G?.battleActive || !choosing || !Number.isInteger(+i) ||
        +i < 0 || +i >= choosing.options.length) return;
    const job = choosing;
    set$choosing(null);
    const text = job.options[+i] || '';
    G.log(`[[icon:question]] <b>抉择</b>（【${esc(job.cardName)}】）：你选择了「${esc(text)}」`, 'sys');
    // 选项若指名一张生物/门类卡（如 末日浩劫之门 / 天国之门）：
    // 把它的「回合开始时」效果注册为每回合重复的持续效果（门是场面物件）
    const quoted = text.match(/[‘“「]([^\s，。；‘’“”「」]+)[’”」]/);
    const ref = quoted && cards.all().find(c => c.name === quoted[1]);
    if (ref && ref.type === '生物') {
      const parts = splitClauses(String(ref.desc || ''));
      if (parts.turnStart.length) {
        parts.turnStart.forEach(it => {
          // 天国之门类「随机获取一项祝福」：把括号里的候选词池拼进注册文本，供回合结算识别
          let text = it.text;
          const paren = String(ref.desc || '').match(/（[^）]*从这些中随机[^）]*）/);
          if (paren && /随机获取一项祝福/.test(text)) text += paren[0];
          delayed.push({ text, cardName: ref.name, repeat: true });
        });
        G.log(`[[icon:hourglass]] <b>${esc(ref.name)}</b> 展开：${esc(parts.turnStart.map(it => it.text).join('；'))}（每回合开始生效）`, 'sys');
      } else {
        G.log(`[[icon:question]] 【${esc(ref.name)}】没有可展开的回合开始效果（占位）`, 'dim');
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
          parts2.turnStart.forEach(it => delayed.push({ text: it.text, cardName: ref2.name, repeat: true, notBeforeTurn: turn + 2 }));
          if (parts2.turnStart.length) G.log(`[[icon:hourglass]] <b>两回合后</b>：未选择的【${esc(ref2.name)}】也将展开`, 'sys');
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
