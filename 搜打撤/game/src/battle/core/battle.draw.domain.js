import { isStarterAttackPoolMember } from '../../cards/card-legacy-battle-policy.js';
import { retainsDrawnSwordInHand } from '../../cards/card-hand-combinations.js';
import { isQueuedCastSource } from './battle.card-presentation.js';
import { directTriggerSource } from '../effects/battle.trigger-source.js';
import { esc } from '../../core/shared.js';

/** Shared eligibility for a hand card released by its name key. */
export function matchesHandReleaseCard(card, key) {
  const re = key === '杀' ? /^(杀|初始攻击)$/ : new RegExp(key);
  return !!card && card.type !== '生物' && re.test(card.name || '');
}

/** Instance-owned state and host services are captured explicitly. */
export function createDrawDomain(context) {
const instanceRuntime = context.runtime;
const hostAudio = context.audio;
const cardCatalog = context.cards;

/* battle.draw.js —— 抽牌/发牌/自动出牌簇（自 battle.engine.js 逐字迁出，治理批次 3）。
 * 覆盖：drawCards（含抽到即施放/灰烬符文直释）、deckDraw、addTempCard/addDeckCard/grantSha、
 * releaseHandMatches/autoPlayHandType。牌堆与表现态经 runtime 活绑定直引；与引擎互递归的
 * 结算件（sweepDead/applyTextEffects/resolveCard/queueCardExecution 等）经端口注入，本模块
 * 不回环依赖 engine。
 */

/**
 * @param {import('./battle.core-ports.types.js').DrawPorts} ports engine 装配端口。resolveCard/applyTextEffects/triggersM2 在引擎中
 *   为晚定义常量，以惰性包装传入；其余为引擎既有一等件。
 * @returns {{ drawCards, deckDraw, addTempCard, addDeckCard, grantSha, releaseHandMatches, autoPlayHandType, resumeAutomaticCasts, hasPendingAutomaticCasts }}
 */
function createBattleDraw({
  R, alive, findCard, findEffectiveCard, sweepDead,
  applyTextEffects, resolveCard, fireDrawn, fireAcquire,
  checkSealTransformation, checkHandCombinations, queueCardExecution, requestBattleRender,
  session = null, settlePendingSelections = null,
}) {
  // Keep physical arrivals, not fresh hand snapshots: a child cast may draw or consume cards.
  // One submitted card owns its whole selection chain before the next UID is attempted.
  const automaticCastBatches = [];
  let advancingAutomaticCasts = false;
  const batchCurrent = batch => instanceRuntime.G?.battleActive &&
    instanceRuntime.battleState.token === batch.token && (session?.generation || 0) === batch.generation;
  function hasPendingAutomaticCasts() {
    for (let i = automaticCastBatches.length - 1; i >= 0; i--) {
      if (!batchCurrent(automaticCastBatches[i])) automaticCastBatches.splice(i, 1);
    }
    return automaticCastBatches.length > 0;
  }
  function automaticCastsReady() {
    return !session?.actionQueue?.running && !session?.actionQueue?.length && !session?.stagedResolutionDepth &&
      !instanceRuntime.infusing && !instanceRuntime.handSelecting && !instanceRuntime.choosing &&
      !instanceRuntime.discovering && !instanceRuntime.interaction && !instanceRuntime.discoverQueue.length &&
      !session?.handSelectQueue?.length && !session?.choiceQueue?.length;
  }
  function resumeAutomaticCasts() {
    if (advancingAutomaticCasts || !hasPendingAutomaticCasts() || !automaticCastsReady()) return;
    advancingAutomaticCasts = true;
    try {
      while (automaticCastBatches.length && automaticCastsReady()) {
        const batch = automaticCastBatches[0];
        if (!batchCurrent(batch)) { automaticCastBatches.shift(); continue; }
        if (batch.inFlight) return;
        if (batch.drawPending) {
          const draw = batch.drawPending;
          batch.drawPending = 0;
          drawCards(draw);
          requestBattleRender();
          if (!automaticCastsReady()) return;
        }
        if (!batch.uids.length || (batch.max && batch.played >= batch.max)) { automaticCastBatches.shift(); continue; }
        const uid = batch.uids.shift();
        const entry = findEffectiveCard?.(uid) || findCard(uid);
        if (!instanceRuntime.hand.includes(uid) || !entry || !batch.matches(entry.card)) continue;
        batch.inFlight = true;
        const queued = queueCardExecution(uid, entry.card, [], alive()[0] || null, true, false, [], () => {
          if (!batchCurrent(batch)) return;
          batch.played++;
          batch.drawPending += batch.drawEach || 0;
        }, null, true);
        if (queued === false) { batch.inFlight = false; continue; }
        // onIdle runs before the returned action promise finishes. Keep ownership until
        // that promise settles, including selections created asynchronously by the cast.
        const complete = () => {
          if (!batchCurrent(batch)) return;
          batch.inFlight = false;
          if (settlePendingSelections) settlePendingSelections();
          else resumeAutomaticCasts();
        };
        void Promise.resolve(queued).then(complete, complete);
        return;
      }
    } finally { advancingAutomaticCasts = false; }
  }
  function scheduleAutomaticCasts(uids, matches, drawEach = 0, max = 0) {
    if (!instanceRuntime.G?.battleActive || !alive().length) return 0;
    const candidates = [...new Set(uids)].filter(uid => {
      const entry = findEffectiveCard?.(uid) || findCard(uid);
      return instanceRuntime.hand.includes(uid) && entry && matches(entry.card);
    });
    if (!candidates.length) return 0;
    automaticCastBatches.push({ token: instanceRuntime.battleState.token, generation: session?.generation || 0,
      uids: candidates, matches, drawEach, max, played: 0, drawPending: 0, inFlight: false });
    resumeAutomaticCasts();
    return max ? Math.min(max, candidates.length) : candidates.length;
  }
  function withinDrawBatch(action) {
    const prior = instanceRuntime.lastDrawnUids;
    const token = instanceRuntime.battleState.token;
    try { return action(); }
    finally {
      // A nested draw owns its own immediate result; once its trigger completes,
      // restore the outer arrivals for effects that release this whole batch.
      if (instanceRuntime.G?.battleActive && instanceRuntime.battleState.token === token && prior !== instanceRuntime.lastDrawnUids)
        instanceRuntime.set$lastDrawnUids([...new Set([...prior, ...instanceRuntime.lastDrawnUids])]);
    }
  }
  const acquiring = new Set();
  function fireCardAcquire(card) {
    const source = directTriggerSource(card, 'onAcquire');
    const key = card.id || card;
    if (source.kind !== 'structured' || !source.ops?.length || acquiring.has(key)) return;
    acquiring.add(key);
    try { fireAcquire(card, alive()[0] || null); }
    finally { acquiring.delete(key); }
  }
function castDrawnCopy(uid, card, arriveInHand) {
    const queued = queueCardExecution(uid, card, [], alive()[0] || null, true);
    if (queued === false) {
      // 免费不等于免注能；失败保留实体供补足条件，不制造一次性免注能。
      // 反馈#5b 边界：「抽到时施放」不是「直接释放/直接施放」词条，不适用直释视为已注能口径。
      arriveInHand(uid, card);
      instanceRuntime.G.log(`[[icon:cards]] 【${esc(card.name)}】尚未满足施放条件，保留在手牌中`, 'warn');
    } else {
      instanceRuntime.G.log(`[[icon:flask]] <b>抽到时施放</b>：【${esc(card.name)}】免费排队施放`, 'sys');
    }
    return queued !== false;
  }
function drawCards(n, type = null) {
    const token = instanceRuntime.battleState.token;
    let got = 0;
    let drawnToHand = 0;   // 真正入手张数（抽到即施放/灰烬符文直接释放的不占手牌，不计入）
    const stillCurrent = () => instanceRuntime.G?.battleActive && instanceRuntime.battleState.token === token;
    const checkArrivals = () => { if (stillCurrent()) checkHandCombinations?.(); };
    const arriveInHand = (uid, card) => {
      if (!instanceRuntime.hand.includes(uid)) instanceRuntime.hand.push(uid);
      instanceRuntime.lastDrawnUids.push(uid);
      instanceRuntime.cardAnims.push({ kind: 'draw', uid, name: card?.name || '' });
      drawnToHand++;
      checkArrivals();
    };
    instanceRuntime.set$lastDrawnUids([]);
    while (n-- > 0) {
      if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token) break;
      // 空库停止；消耗牌仅由明确卡牌效果取回，不随抽牌自动洗回。
      if (!instanceRuntime.drawPile.length) break;
      let sourceIndex = instanceRuntime.drawPile.length - 1;
      // A filtered draw changes only which UID is taken. Arrival, onDraw,
      // overflow and automatic-cast handling stay in this same dispatcher.
      if (type !== null) {
        while (sourceIndex >= 0) {
          const candidateUid = instanceRuntime.drawPile[sourceIndex];
          const candidate = findEffectiveCard?.(candidateUid) || findCard(candidateUid);
          if (candidate && (type === '杀' || type === '初始攻击'
            ? isStarterAttackPoolMember(candidate.card, cardCatalog.SHA.id) : candidate.card.type === type)) break;
          sourceIndex--;
        }
        if (sourceIndex < 0) break;
      }
      const [uid] = instanceRuntime.drawPile.splice(sourceIndex, 1);
      const entry = findEffectiveCard?.(uid) || findCard(uid);
      if (entry?.card?._battleTransformMissing) {
        instanceRuntime.drawPile.splice(sourceIndex, 0, uid);
        instanceRuntime.G.log(`[[icon:cross]] 转换目标「${esc(entry.card._battleTransformMissing)}」缺失，本次未抽取或施放`, 'warn');
        break;
      }
      // 星辰占卜副本走正式出牌队列；不占手牌，也不受手牌上限阻挡。
      // 队列负责移动到已出/弃牌区并处理嵌套发现，不能在此提前弃置导致连抽回收同一张。
      if (entry?.card?._castOnDraw) {
        if (!castDrawnCopy(uid, entry.card, arriveInHand)) checkArrivals();
        got++;
        if (instanceRuntime.handSelecting) break; // 先完成本次支付选择，避免后续副本覆盖它。
        continue;
      }
      const drawTrigger = entry ? directTriggerSource(entry.card, 'onDraw') : null;
      // 手牌满：灰烬符文「放不下的招式直接释放」（2026-09-16 定版）——直释不占手牌，继续抽；
      // 其余情况把牌放回库顶并停止抽牌（与旧版 pop 前 break 等价：库序不变）。
      // 上限门必须在 pop 之后判——旧写法 pop 前 break 且直释阈值硬编码 9 与上限 8 差一张，
      // 两条路径互相打架：上限永远先触发，灰烬符文整条效果失效。
      // entry 可为 null（uid 无法解析，同函数 118/150 行口径）：2026-09-28 审计补漏
      if (instanceRuntime.mode === 'boss' && instanceRuntime.hand.length >= instanceRuntime.effectiveHandMax(R().battleHandMax)) {
        if (instanceRuntime.ashRune && entry && ['武术', '法术'].includes(entry.card.type)) {
          // 反馈#5b（2026-10-21 老板定版）：「直接释放」词条（灰烬满手直释）释放注能卡时视为已注能——
          // 允许释放、按已注能效果结算；不消耗注能材料，也不增加累计注能材料数，不因缺注能被拦。
          instanceRuntime.G.log('[[icon:fire]] <b>灰烬符文</b>：手牌已满，直接释放【' + esc(entry.card.name) + '】', 'sys');
          // 直释视同已打出：uid 必须留在牌堆簿记里，否则从所有牌区消失、无法洗回
          // （09-30 深审 BC-02；与 execPlay 普通打出的 discard.push 同口径）
          instanceRuntime.discard.push(uid);
          withinDrawBatch(() => resolveCard(entry.card, alive()[0] || null, true, 0));
          got++;
          continue;
        }
        instanceRuntime.drawPile.splice(sourceIndex, 0, uid);
        break;
      }
      // 双剑先入手再触发原抽到效果；组合只检查已到手实体，不重放抽到效果。
      const retainsInHand = retainsDrawnSwordInHand(entry?.card);
      // 其余结构化「抽到时」触发沿用直接结算、不占手牌的口径。
      if (drawTrigger?.kind === 'structured' && drawTrigger.ops?.length) {
        if (retainsInHand) arriveInHand(uid, entry.card);
        else instanceRuntime.discard.push(uid);
        instanceRuntime.G.log(`[[icon:flask]] <b>抽到时</b>：【${esc(entry.card.name)}】触发效果`, 'sys');
        withinDrawBatch(() => fireDrawn(entry.card, alive()[0] || null));
        got++;
        if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token) break;
        checkArrivals();
        if (!stillCurrent()) break;
        sweepDead();
        if (!alive().length) break;
        continue;
      }
      // 旧文本双剑同样先入手；其余「抽到时施放」衍生牌仍直接结算。
      if (drawTrigger?.texts.length) {
        if (retainsInHand) arriveInHand(uid, entry.card);
        else instanceRuntime.discard.push(uid);
        for (const text of drawTrigger.texts) {
          if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token || instanceRuntime.G.hp <= 0 || !alive().length) break;
          instanceRuntime.G.log(`[[icon:flask]] <b>抽到时施放</b>：【${esc(entry.card.name)}】${esc(text)}`, 'sys');
          withinDrawBatch(() => applyTextEffects(entry.card, text, alive()[0] || null, { triggered: true }));
        }
        got++;
        if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token) break;
        checkArrivals();
        if (!stillCurrent()) break;
        sweepDead();
        if (!alive().length) break;
        continue;
      }
      // 灰烬直释已并入上方手牌满判定（阈值与上限门同源）——此处仅剩正常入手
      arriveInHand(uid, entry?.card);
      got++;
      checkArrivals();
    }
    if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token) return got;
    // 抽牌反馈音（P1#5）：一批抽牌只播一声，连抽不叠音
    if (drawnToHand > 0 && hostAudio) hostAudio.sfx('draw');
    checkArrivals();
    if (!stillCurrent()) return got;
    checkSealTransformation();   // 受缚之残影：每批抽牌后检查手牌是否集齐 5 张封印之牌
    return got;
  }
function addTempCard(tpl, presentation = null) {
    const token = instanceRuntime.battleState.token;
    const uid = 'bts' + Date.now().toString(36) + instanceRuntime.nextTmpSeq();
    instanceRuntime.granted.push({ uid, card: { ...tpl } });
    // 临时道具由快捷栏读取；直接施放沿既有队列占位与表现来源，不另给一份可用道具。
    const entersHand = tpl.type !== '道具' || isQueuedCastSource(presentation?.source);
    if (entersHand) instanceRuntime.hand.push(uid);
    if (entersHand) instanceRuntime.cardAnims.push({ kind: 'draw', uid, name: tpl.name || '', card: { ...tpl }, acquired: true,
      ...(isQueuedCastSource(presentation?.source) ? { source: presentation.source } : {}) });
    // 置入手牌视同「抽到」（2026-09-11 英雄卡审计）：万剑归宗普通战分支走
    // grantStarterAttack→addTempCard，此前不进 lastDrawnUids，「直接释放其中武术」永远放 0 张
    if (entersHand) instanceRuntime.lastDrawnUids.push(uid);
    // 获取栈只约束本次事件，不能把临时保护写入实体卡，阻断之后的正常获取。
    fireCardAcquire(tpl);
    if (instanceRuntime.G?.battleActive && instanceRuntime.battleState.token === token) checkHandCombinations?.();
    return uid;
  }
function addDeckCard(tpl) {
    if (tpl.type === '道具') return addTempCard(tpl);
    const uid = 'btd' + Date.now().toString(36) + instanceRuntime.nextTmpSeq();
    instanceRuntime.granted.push({ uid, card: { ...tpl } });
    instanceRuntime.drawPile.push(uid);
    instanceRuntime.cardAnims.push({ kind: 'shuffle', uid, name: tpl.name || '', card: { ...tpl } });   // 洗入牌动画事件（2026-09-11 需求）
    fireCardAcquire(tpl);
    return uid;
  }
function grantSha(n) {
    // 明确获得初始攻击时开始新的一批；抽牌效果统一由 drawCards 消费真实牌库。
    instanceRuntime.set$lastDrawnUids([]);
    const lib = (typeof cardCatalog.all === 'function' ? cardCatalog.all() : []);
    // 「杀化为X」战斗规则生效时，发放的初始攻击同样以目标卡形态出现
    const base = (instanceRuntime.shaTransform && lib.find(c => c.name === instanceRuntime.shaTransform)) ||
      lib.find(c => c.id === cardCatalog.SHA.id) || cardCatalog.SHA;
    for (let i = 0; i < n; i++) addTempCard(base);
  }
function deckDraw({ n, type }) {
    const moved = drawCards(n, type);
    if (moved && instanceRuntime.G?.battleActive) instanceRuntime.G.log(`[[icon:draw-card]] 从牌库抽取 ${moved} 张【${esc(type)}】牌`, 'sys');
    return moved;
  }
function releaseHandMatches(key, drawEach, max) {
    return scheduleAutomaticCasts(instanceRuntime.hand.slice(), card => matchesHandReleaseCard(card, key), drawEach, max);
  }
function autoPlayHandType(type) {
    return scheduleAutomaticCasts(instanceRuntime.lastDrawnUids.slice(), card => card.type === type);
  }
  return { drawCards, deckDraw, addTempCard, addDeckCard, grantSha, releaseHandMatches, autoPlayHandType,
    resumeAutomaticCasts, hasPendingAutomaticCasts };
}
return { createBattleDraw };
}
