import { isQueuedCastSource } from './battle.card-presentation.js';
import { directTriggerSource } from '../effects/battle.trigger-source.js';
import { esc } from '../../core/shared.js';

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
 * @returns {{ drawCards, deckDraw, addTempCard, addDeckCard, grantSha, releaseHandMatches, autoPlayHandType }}
 */
function createBattleDraw({
  R, alive, findCard, findEffectiveCard, sweepDead,
  applyTextEffects, resolveCard, fireDrawn, fireAcquire,
  checkSealTransformation, queueCardExecution, requestBattleRender,
}) {
  const acquiring = new Set();
  function fireCardAcquire(card) {
    const source = directTriggerSource(card, 'onAcquire');
    const key = card.id || card;
    if (source.kind !== 'structured' || !source.ops?.length || acquiring.has(key)) return;
    acquiring.add(key);
    try { fireAcquire(card, alive()[0] || null); }
    finally { acquiring.delete(key); }
  }
function castDrawnCopy(uid, card) {
    const queued = queueCardExecution(uid, card, [], alive()[0] || null, true);
    if (queued === false) {
      // 免费不等于免注能；失败保留实体供补足条件，不制造一次性免注能。
      // 反馈#5b 边界：「抽到时施放」不是「直接释放/直接施放」词条，不适用直释视为已注能口径。
      if (!instanceRuntime.hand.includes(uid)) instanceRuntime.hand.push(uid);
      instanceRuntime.lastDrawnUids.push(uid);
      instanceRuntime.cardAnims.push({ kind: 'draw', uid, name: card.name });
      instanceRuntime.G.log(`[[icon:cards]] 【${esc(card.name)}】尚未满足施放条件，保留在手牌中`, 'warn');
    } else {
      instanceRuntime.G.log(`[[icon:flask]] <b>抽到时施放</b>：【${esc(card.name)}】免费排队施放`, 'sys');
    }
    return queued !== false;
  }
function drawCards(n) {
    const token = instanceRuntime.battleState.token;
    let got = 0;
    let drawnToHand = 0;   // 真正入手张数（抽到即施放/灰烬符文直接释放的不占手牌，不计入）
    instanceRuntime.set$lastDrawnUids([]);
    while (n-- > 0) {
      if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token) break;
      // 空库停止；消耗牌仅由明确卡牌效果取回，不随抽牌自动洗回。
      if (!instanceRuntime.drawPile.length) break;
      const uid = instanceRuntime.drawPile.pop();
      const entry = findEffectiveCard?.(uid) || findCard(uid);
      if (entry?.card?._battleTransformMissing) {
        instanceRuntime.drawPile.push(uid);
        instanceRuntime.G.log(`[[icon:cross]] 转换目标「${esc(entry.card._battleTransformMissing)}」缺失，本次未抽取或施放`, 'warn');
        break;
      }
      // 星辰占卜副本走正式出牌队列；不占手牌，也不受手牌上限阻挡。
      // 队列负责移动到已出/弃牌区并处理嵌套发现，不能在此提前弃置导致连抽回收同一张。
      if (entry?.card?._castOnDraw) {
        if (!castDrawnCopy(uid, entry.card)) drawnToHand++;
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
          resolveCard(entry.card, alive()[0] || null, true, 0);
          got++;
          continue;
        }
        instanceRuntime.drawPile.push(uid);
        break;
      }
      // M2：结构化「抽到时」触发（rules.triggers.onDraw）——与文本抽到即施放同门：直接结算，不占手牌
      if (drawTrigger?.kind === 'structured' && drawTrigger.ops?.length) {
        instanceRuntime.discard.push(uid);
        instanceRuntime.G.log(`[[icon:flask]] <b>抽到时</b>：【${esc(entry.card.name)}】触发效果`, 'sys');
        fireDrawn(entry.card, alive()[0] || null);
        got++;
        if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token) break;
        sweepDead();
        if (!alive().length) break;
        continue;
      }
      // 「抽到时施放」衍生牌（禁咒/天启剑系）：抽到即结算，不占手牌
      if (drawTrigger?.texts.length) {
        instanceRuntime.discard.push(uid);
        for (const text of drawTrigger.texts) {
          if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token || instanceRuntime.G.hp <= 0 || !alive().length) break;
          instanceRuntime.G.log(`[[icon:flask]] <b>抽到时施放</b>：【${esc(entry.card.name)}】${esc(text)}`, 'sys');
          applyTextEffects(entry.card, text, alive()[0] || null, { triggered: true });
        }
        got++;
        if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token) break;
        sweepDead();
        if (!alive().length) break;
        continue;
      }
      // 灰烬直释已并入上方手牌满判定（阈值与上限门同源）——此处仅剩正常入手
      instanceRuntime.hand.push(uid);
      instanceRuntime.lastDrawnUids.push(uid);
      instanceRuntime.cardAnims.push({ kind: 'draw', uid, name: entry ? entry.card.name : '' });
      got++;
      drawnToHand++;
    }
    if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token) return got;
    // 抽牌反馈音（P1#5）：一批抽牌只播一声，连抽不叠音
    if (drawnToHand > 0 && hostAudio) hostAudio.sfx('draw');
    checkSealTransformation();   // 受缚之残影：每批抽牌后检查手牌是否集齐 5 张封印之牌
    return got;
  }
function addTempCard(tpl, presentation = null) {
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
    let moved = 0;
    instanceRuntime.set$lastDrawnUids([]);
      const rest = [];
      while (instanceRuntime.drawPile.length && moved < n) {
        const uid = instanceRuntime.drawPile.pop();
        const o = findCard(uid);
        const matches = o && (type === '杀' || type === '初始攻击'
          ? o.card.id === cardCatalog.SHA.id || ['杀', '初始攻击'].includes(o.card.name)
          : o.card.type === type);
        if (matches && o.card._castOnDraw) {
          castDrawnCopy(uid, o.card);
          moved++;
          if (instanceRuntime.handSelecting) break;
        } else if (matches && (instanceRuntime.mode !== 'boss' || instanceRuntime.hand.length < instanceRuntime.effectiveHandMax(R().battleHandMax))) {
          instanceRuntime.hand.push(uid);
          moved++;
          instanceRuntime.lastDrawnUids.push(uid);
          instanceRuntime.cardAnims.push({ kind: 'draw', uid, name: o.card.name });
        }
        else rest.push(uid);
      }
      // rest 按 pop 序（顶→底）累积，直接 push 会把相对顺序翻转（原顶牌沉底）；reverse 归位
      instanceRuntime.drawPile.push(...rest.reverse());
      // 所有模式只实抽牌库：搜完仍不足就少抽，不从全卡池生成替代牌。
      // （09-30 深审 BC-03——武装「从牌库中抽取 2 张装备」牌库没有装备时不得随机补足）
      if (moved) instanceRuntime.G.log(`[[icon:cards]] 从牌库抽取 ${moved} 张【${esc(type)}】牌`, 'sys');
      return moved;
  }
function releaseHandMatches(key, drawEach, max) {
    const re = key === '杀' ? /^(杀|初始攻击)$/ : new RegExp(key);
    let released = 0;
    for (const uid of instanceRuntime.hand.slice()) {
      if (!alive().length) break;
      if (max && released >= max) break;
      const o = findCard(uid);
      if (!o || o.card.type === '生物' || !re.test(o.card.name || '')) continue;
      // 反馈#5b：「直接释放」词条（连弩/逆弓）——注能卡视为已注能释放
      const queued = queueCardExecution(uid, o.card, [], alive()[0] || null, true, false, [],
        drawEach ? () => { drawCards(drawEach); requestBattleRender(); } : null, null, true);
      if (queued !== false) released++;
    }
    return released;
  }
function autoPlayHandType(type) {
    let played = 0;
    for (const uid of instanceRuntime.lastDrawnUids.slice()) {
      if (!alive().length) break;
      if (!instanceRuntime.hand.includes(uid)) continue;
      const o = findCard(uid);
      if (!o || o.card.type !== type) continue;
      // 反馈#5b：「直接释放」词条（万剑归宗）——注能卡视为已注能释放
      if (queueCardExecution(uid, o.card, [], alive()[0] || null, true, false, [], null, null, true) !== false) played++;
    }
    return played;
  }
  return { drawCards, deckDraw, addTempCard, addDeckCard, grantSha, releaseHandMatches, autoPlayHandType };
}
return { createBattleDraw };
}
