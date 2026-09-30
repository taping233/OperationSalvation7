/* battle.draw.js —— 抽牌/发牌/自动出牌簇（自 battle.engine.js 逐字迁出，治理批次 3）。
 * 覆盖：drawCards（含抽到即施放/灰烬符文直释）、deckDraw、addTempCard/addDeckCard/grantSha、
 * releaseHandMatches/autoPlayHandType。牌堆与表现态经 runtime 活绑定直引；与引擎互递归的
 * 结算件（sweepDead/applyTextEffects/resolveCard/queueCardExecution 等）经端口注入，本模块
 * 不回环依赖 engine。
 */
import { refillDrawPile } from '../bag/battle.deck.js';
import { G, mode, hand, granted, drawPile, discard, lastDrawnUids, cardAnims,
  ashRune, shaTransform, nextTmpSeq, effectiveHandMax,
  set$lastDrawnUids } from '../runtime/battle.runtime.js';
import { splitEffectClauses } from '../effects/battle.effects.js';
import { esc } from '../../core/shared.js';
import { Random } from '../../core/random.js';
import SDT from '../../core/sdt-facade.js';

/**
 * @param {object} ports engine 装配端口。resolveCard/applyTextEffects/triggersM2 在引擎中
 *   为晚定义常量，以惰性包装传入；其余为引擎既有一等件。
 * @returns {{ drawCards, deckDraw, addTempCard, addDeckCard, grantSha, releaseHandMatches, autoPlayHandType }}
 */
export function createBattleDraw({
  R, alive, findCard, sweepDead,
  applyTextEffects, resolveCard, fireDrawn, fireAcquire,
  checkSealTransformation, queueCardExecution, requestBattleRender,
}) {
function drawCards(n) {
    let got = 0;
    let drawnToHand = 0;   // 真正入手张数（抽到即施放/灰烬符文直接释放的不占手牌，不计入）
    set$lastDrawnUids([]);
    while (n-- > 0) {
      if (!drawPile.length && discard.length) {
        const recycled = refillDrawPile(drawPile, discard);
        SDT.Sound.sfx('shuffle');   // 洗牌音（P1#5）：弃牌堆洗回牌库
        G.log(`[[icon:recycle]] 弃牌堆 ${recycled} 张洗回牌库（墓地不参与洗回）`, 'dim');
      }
      if (!drawPile.length) break;
      const uid = drawPile.pop();
      const entry = findCard(uid);
      const parts = entry ? splitEffectClauses(String(entry.card.desc || '')) : null;
      // 手牌满：灰烬符文「放不下的招式直接释放」（2026-09-16 定版）——直释不占手牌，继续抽；
      // 其余情况把牌放回库顶并停止抽牌（与旧版 pop 前 break 等价：库序不变）。
      // 上限门必须在 pop 之后判——旧写法 pop 前 break 且直释阈值硬编码 9 与上限 8 差一张，
      // 两条路径互相打架：上限永远先触发，灰烬符文整条效果失效。
      // entry 可为 null（uid 无法解析，同函数 118/150 行口径）：2026-09-28 审计补漏
      if (hand.length >= effectiveHandMax(R().battleHandMax)) {
        if (ashRune && entry && ['武术', '法术'].includes(entry.card.type)) {
          G.log('[[icon:fire]] <b>灰烬符文</b>：手牌已满，直接释放【' + esc(entry.card.name) + '】', 'sys');
          // 直释视同已打出：uid 必须留在牌堆簿记里，否则从所有牌区消失、无法洗回
          // （09-30 深审 BC-02；与 execPlay 普通打出的 discard.push 同口径）
          discard.push(uid);
          resolveCard(entry.card, alive()[0] || null, false, 0);
          got++;
          continue;
        }
        drawPile.push(uid);
        break;
      }
      // M2：结构化「抽到时」触发（rules.triggers.onDraw）——与文本抽到即施放同门：直接结算，不占手牌
      if (entry?.card?.rules?.triggers?.onDraw?.length) {
        discard.push(uid);
        G.log(`[[icon:flask]] <b>抽到时</b>：【${esc(entry.card.name)}】触发效果`, 'sys');
        fireDrawn(entry.card, alive()[0] || null);
        got++;
        sweepDead();
        if (!alive().length) break;
        continue;
      }
      // 「抽到时施放」衍生牌（禁咒/天启剑系）：抽到即结算，不占手牌
      if (parts && parts.onDraw.length) {
        discard.push(uid);
        parts.onDraw.forEach(text => {
          G.log(`[[icon:flask]] <b>抽到时施放</b>：【${esc(entry.card.name)}】${esc(text)}`, 'sys');
          applyTextEffects(entry.card, text, alive()[0] || null);
        });
        got++;
        sweepDead();
        if (!alive().length) break;
        continue;
      }
      // 灰烬直释已并入上方手牌满判定（阈值与上限门同源）——此处仅剩正常入手
      hand.push(uid);
      lastDrawnUids.push(uid);
      cardAnims.push({ kind: 'draw', uid, name: entry ? entry.card.name : '' });
      got++;
      drawnToHand++;
    }
    // 抽牌反馈音（P1#5）：一批抽牌只播一声，连抽不叠音
    if (drawnToHand > 0 && SDT.Sound) SDT.Sound.sfx('draw');
    checkSealTransformation();   // 受缚之残影：每批抽牌后检查手牌是否集齐 5 张封印之牌
    return got;
  }
function addTempCard(tpl) {
    const uid = 'bts' + Date.now().toString(36) + nextTmpSeq();
    granted.push({ uid, card: { ...tpl } });
    hand.push(uid);
    cardAnims.push({ kind: 'draw', uid, name: tpl.name || '' });
    // 置入手牌视同「抽到」（2026-09-11 英雄卡审计）：万剑归宗普通战分支走
    // grantStarterAttack→addTempCard，此前不进 lastDrawnUids，「直接释放其中武术」永远放 0 张
    lastDrawnUids.push(uid);
    // M3：onAcquire 触发器（阿猫的礼物「发现或随机获取该牌时」）——获取即结算，防自递归
    if (tpl?.rules?.triggers?.onAcquire?.length && !tpl._m2Acquiring) {
      const acquiring = { ...tpl, _m2Acquiring: true };
      granted[granted.length - 1].card = acquiring;
      fireAcquire(acquiring, alive()[0] || null);
    }
    return uid;
  }
function addDeckCard(tpl) {
    const uid = 'btd' + Date.now().toString(36) + nextTmpSeq();
    granted.push({ uid, card: { ...tpl } });
    drawPile.push(uid);
    cardAnims.push({ kind: 'shuffle', name: tpl.name || '' });   // 洗入牌动画事件（2026-09-11 需求）
    return uid;
  }
function grantSha(n) {
    // 普通战的抽牌替代也必须开始新的一批，不能把开场砸击或上次获得的牌算入「其中」。
    set$lastDrawnUids([]);
    const lib = (typeof SDT.Cards.all === 'function' ? SDT.Cards.all() : []);
    // 「杀化为X」战斗规则生效时，发放的初始攻击同样以目标卡形态出现
    const base = (shaTransform && lib.find(c => c.name === shaTransform)) ||
      lib.find(c => c.id === SDT.Cards.SHA.id) || SDT.Cards.SHA;
    for (let i = 0; i < n; i++) addTempCard(base);
  }
function deckDraw({ n, type }) {
    let moved = 0;
    if (mode === 'boss') {
      const rest = [];
      while (drawPile.length && moved < n) {
        const uid = drawPile.pop();
        const o = findCard(uid);
        if (o && o.card.type === type && hand.length < effectiveHandMax(R().battleHandMax)) {
          hand.push(uid);
          moved++;
          lastDrawnUids.push(uid);
          cardAnims.push({ kind: 'draw', uid, name: o.card.name });
        }
        else rest.push(uid);
      }
      // rest 按 pop 序（顶→底）累积，直接 push 会把相对顺序翻转（原顶牌沉底）；reverse 归位
      drawPile.push(...rest.reverse());
      // BOSS 模式只实抽牌库：搜完仍不足就少抽，不再从全卡池凭空生成套牌外的牌
      // （09-30 深审 BC-03——武装「从牌库中抽取 2 张装备」牌库没有装备时不得随机补足）
      if (moved) G.log(`[[icon:cards]] 从牌库抽取 ${moved} 张【${esc(type)}】牌`, 'sys');
      return moved;
    }
    const pool = SDT.Cards.all().filter(c => c.type === type && c.rarity !== '衍生' && !['生物', '事件'].includes(c.type));
    while (moved < n) {
      if (!pool.length) break;
      addTempCard(pool[Math.floor(Random.random('battle') * pool.length)]);
      moved++;
    }
    if (moved) G.log(`[[icon:cards]] （普通战斗无牌库，改为直接获得）抽取 ${moved} 张【${esc(type)}】牌`, 'sys');
    return moved;
  }
function releaseHandMatches(key, drawEach, max) {
    const re = key === '杀' ? /^(杀|初始攻击)$/ : new RegExp(key);
    let released = 0;
    for (const uid of hand.slice()) {
      if (!alive().length) break;
      if (max && released >= max) break;
      const o = findCard(uid);
      if (!o || o.card.type === '生物' || !re.test(o.card.name || '')) continue;
      queueCardExecution(uid, o.card, [], alive()[0] || null, true, false, [],
        drawEach ? () => { drawCards(drawEach); requestBattleRender(); } : null);
      released++;
    }
    return released;
  }
function autoPlayHandType(type) {
    let played = 0;
    for (const uid of lastDrawnUids.slice()) {
      if (!alive().length) break;
      if (!hand.includes(uid)) continue;
      const o = findCard(uid);
      if (!o || o.card.type !== type) continue;
      queueCardExecution(uid, o.card, [], alive()[0] || null, true);
      played++;
    }
    return played;
  }
  return { drawCards, deckDraw, addTempCard, addDeckCard, grantSha, releaseHandMatches, autoPlayHandType };
}
