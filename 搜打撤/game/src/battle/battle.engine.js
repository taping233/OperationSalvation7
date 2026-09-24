/* battle.engine.js —— 战斗规则核与编排层（自 battle.core.js 拆出）。
 * 动作队列/逐拍播放/快照建模、装备、战斗背包与入口收尾已由独立模块承接；
 * 规则核（词条时点/出牌结算/命中/死亡）保留共享调用，属地模块经工厂注入解环。
 * 状态读写一律经 battle.runtime.js（活绑定 + set$Xxx）；本文件禁 import 壳（contracts 拒环）。 */
const SDT = window.SDT;
import { renderBattle, battleState, G, foes, opts, mode, drawPile, hand, discard, granted, played, consumed, grave, energy, maxEnergy, turn, pdef, pstat, busy, infusing, discovering, discoverQueue, handSelecting, choosing, stealthStrike, nextSpellTwice, interaction, pendingHint, delayed, viewingGrave, viewingDeck, viewingBag, floats, cardAnims, presentationActionSeq, dreadShown, spellCost1, meleeCost1, shaTransform, consumeFireballN, lastDrawnUids, lastPlayedType, playedMartialThisTurn, playedMovesThisTurn, selPool, selShaN, sel, lastDeckSel, selectingDeck, selDeckMax, allies, growthNames, growth, infuseFuels, sealUnlocked, deathSave, killAtkUp, poisonOnSpell, poisonLegacy, nestRunes, nestSyn, arrowRune, unyieldRune, ashRune, unlimitedRune, holyRune, freezeRuneOn, armorMul, sealDone, playerCurseImmune, allSpellsInfused, zeroFeeUntil, cardOverrides, equipped, freeCast, battleRestartCheckpoint, restoringRestartCheckpoint, tmpSeq, activeActionSignal, surgeWaiter, lastPersistAt, snapCache, snapSig, set$lastDrawnUids, set$tmpSeq, set$noDrawNext, set$stealthStrike, set$nextSpellTwice, set$drawPile, set$energy, set$maxEnergy, set$shaTransform, set$consumeFireballN, set$deathSave, set$hand, set$extraTurn, set$delayed, set$meleeCost1, set$spellCost1, set$surgeWaiter, set$sealUnlocked, set$discovering, set$G, set$battleRestartCheckpoint, set$opts, set$mode, set$battleState, set$foes, set$interaction, set$selPool, set$selShaN, set$sel, set$discard, set$granted, set$played, set$consumed, set$grave, set$turn, set$busy, set$pdef, set$pstat, set$infusing, set$discoverQueue, set$handSelecting, set$floats, set$cardAnims, set$presentationActionSeq, set$choosing, set$lastPlayedType, set$viewingGrave, set$viewingDeck, set$dreadShown, set$selectingDeck, set$viewingBag, set$allies, set$growthNames, set$growth, set$infuseFuels, set$killAtkUp, set$poisonOnSpell, set$poisonLegacy, set$zeroFeeUntil, set$cardOverrides, set$sealDone, set$playerCurseImmune, set$allSpellsInfused, set$nestRunes, set$nestSyn, set$timeRune, set$arrowRune, set$unyieldRune, set$ashRune, set$unlimitedRune, set$holyRune, set$fireballRuneOn, set$freezeRuneOn, set$swiftRune, set$timeSpaceRune, set$timeSpaceUsed, set$armorMul, set$freeCast, set$equipped, set$playedMartialThisTurn, set$playedMovesThisTurn, set$selDeckMax, set$lastDeckSel, set$pendingHint, set$lastPersistAt, set$activeActionSignal, set$restoringRestartCheckpoint, set$snapSig, set$snapCache, storeBattleSnapshot } from './battle.runtime.js';
import { esc } from '../core/shared.js';
import { createEffectExecutor, splitEffectClauses, consumeTriggerTexts } from './battle.effects.js';
import { refillDrawPile, shuffleCards } from './battle.deck.js';
import { removeUid } from './battle.piles.js';
import { isAreaEffect, targetSideFor, unplayableReasonFor, itemTargetSideFor } from './battle.rules.js';
import { COMBAT_HOOKS } from './combat.js';
import { createBattleExecutionSession } from './battle.execution-session.js';
import { createBattleActionRunner } from './battle.action-runner.js';
import { STAGED_BOSS_DEFEAT, actionCancellationError, createStagedPlayback, throwIfActionCancelled } from './battle.staged-playback.js';
import { BATTLE_PHASES, beginTargeting, cancelTargeting, createBattleState, transitionBattle } from './battle.state.js';
import { Random } from '../core/random.js';
import * as Combat from './combat.js';
import { emit as busEmit } from '../core/event-bus.js';
import { calculateEffectiveCardCost, decayEffectiveCardCost, pocketSpellDiscountFor } from './battle.card-cost.js';
import { calculateEnemyIntent } from './battle.intent.js';
import { createBattleSnapshot, createBattleSnapshotSignature } from './battle.snapshot.js';
import { createBattleResolution } from './battle.resolution.js';
import { clearFeedback } from './battle.feedback.js';
import { createBattleSelectionFlow } from './battle.selection-flow.js';
import { createBattleEquipment } from './battle.equipment.js';
import { createBattleBag } from './battle.bag.js';
import { createBattleLifecycle } from './battle.lifecycle.js';
import { createBattleExecPlay } from './battle.exec-play.js';

/* —— 自 battle.core 壳迁入的共享引擎件（原 head/tail，按原文件顺序）—— */
const executionSession = createBattleExecutionSession();
const { actionQueue, stagedDeathFx, handSelectQueue, choiceQueue } = executionSession;
const requestBattleRender = () => {
    if (!G || !G.battleActive) return;   // 战斗已收尾：残留重绘一律丢弃（胜利结算后不再盖写后续界面）
    try {
      renderBattle(getSnapshot());
    } catch (e) {
      // 渲染失败不得打断战斗逻辑（否则出牌动作入队前就中断，busy 永久卡死——2026-09-18 实测）
      console.error('[battle] 渲染异常已兜底：', e);
    }
  };
const interactionOf = (kind) => (interaction && interaction.kind === kind ? interaction : null);
const pendingTargetOf = () => { const i = interactionOf('card'); return i ? { uid: i.uid, card: i.card } : null; };
const pendingItemOf = () => { const i = interactionOf('item'); return i ? { uid: i.uid, card: i.card } : null; };
const KILL_CHEER = ['漂亮！', '好剑！', '干净利落！'];
const cloneData = value => value == null ? value : JSON.parse(JSON.stringify(value));
function cardIdentity(card) {
    if (card && card.id) return `id:${card.id}`;
    return `legacy:${card?.name || ''}|${card?.type || ''}|${card?.desc || ''}`;
  }
const isStarterAttack = card => !!card && (card.id === 'starter-attack' || (!card.id && card.name === '初始攻击'));
const R = () => SDT.MAP.rules;
const alive = () => foes.filter(f => !f.dead);
function intentFor(def, round) {
    return calculateEnemyIntent(def, round, pstat && pstat.status);
  }
const shuffle = shuffleCards;
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
      if (hand.length >= R().battleHandMax) break;
      const uid = drawPile.pop();
      const entry = findCard(uid);
      const parts = entry ? splitClauses(String(entry.card.desc || '')) : null;
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
      // 灰烬符文：手牌满 9 张时，放不下的招式直接释放（2026-09-16 Item 定版）
      if (ashRune && hand.length >= 9 && ['武术', '法术'].includes(entry.card.type)) {
        G.log('[[icon:fire]] <b>灰烬符文</b>：手牌已满，直接释放【' + esc(entry.card.name) + '】', 'sys');
        resolveCard(entry.card, alive()[0] || null, false, 0);
        got++;
        continue;
      }
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
function resolveFoeDefeat(foe, cause = '被击倒') {
    if (!foe || foe.dead || foe.hp > 0) return false;
    foe.dead = true;
    G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> ${cause}！（剩 ${alive().length} 个敌人）`, 'ok');
    floats.push({ unit: foeIdx(foe), text: '', cls: 'stk sticker-boom' });
    floats.push({ unit: 'self', text: KILL_CHEER[Math.floor(Random.random('battle') * KILL_CHEER.length)], cls: 'stk stk-late stk-cheer' });
    // 固定死亡触发顺序：复活替代死亡 → 遗产转移 → 同回合复活击杀 → 首脑胜利。
    if (nestRevive(foe)) return false;
    transferPoisonLegacy(foe);
    nestKillCheck(foe);
    if (executionSession.stagedResolutionDepth > 0) stagedDeathFx.add(foe);
    if (foe.boss) {
      // 立刻截断本卡余句，但保留致命一击的反馈，待演出后再清场胜利。
      if (executionSession.stagedResolutionDepth > 0) throw STAGED_BOSS_DEFEAT;
      const signal = activeActionSignal;
      finish(true);
      // 首脑死亡会清空动作队列；立即打断当前同步结算，避免胜利后仍继续执行卡牌余句。
      throwIfActionCancelled(signal);
    }
    return true;
  }
function sweepDead() {
    foes.forEach(f => resolveFoeDefeat(f));
  }
function transferPoisonLegacy(deadFoe) {
    if (!poisonLegacy || !deadFoe.status || !(deadFoe.status.poison > 0)) return;
    const next = alive().filter(f => f !== deadFoe)[0];
    const stacks = deadFoe.status.poison;
    if (!next) return;
    deadFoe.status.poison = 0;
    Combat.addCurse(next, 'poison', stacks);
    G.log(`[[icon:skull]] <b>腐化之种</b>：<b>${esc(deadFoe.name)}</b> 的 ${stacks} 层中毒转移给 <b>${esc(next.name)}</b>（当前 ${next.status.poison} 层）`, 'sys');
  }
function nestRevive(foe) {
    if (!foe.revive || foe.revived) return false;
    foe.revived = true;
    foe.dead = false;
    foe.maxHp = foe.revive.hearts;
    foe.hp = foe.revive.hearts;
    foe.atk = foe.revive.atk;
    foe.status = {};
    foe.reviveTurn = turn;
    G.log('[[icon:fire]] <b>完全形态·元素领主</b>：死亡不是终结——以 8 攻 8 心复活（诅咒尽散）。借过！', 'warn');
    return true;
  }
function nestKillCheck(foe) {
    if (foe.revived && foe.reviveTurn === turn && SDT.Meta) {
      SDT.Meta.track('reviveKill', {});
      G.log('[[icon:trophy]] <b>借过</b>——复活体被当场送走！', 'ok');
    }
  }
function nestPhase(foe) {
    const frac = foe.hp / foe.maxHp;
    const ph = frac <= 1 / 3 ? 3 : frac <= 2 / 3 ? 2 : 1;
    if (ph === (foe.phase || 1)) return;
    foe.phase = ph;
    if (ph === 3) {
      const dumped = hand.splice(0, hand.length);
      dumped.forEach(u => discard.push(u));
      foe.stunned = true;
      G.log('[[icon:fire]] <b>远古龙尊</b> 狂怒：你的手牌全部被震落！且下个回合蓄力', 'warn');
    } else {
      G.log(`[[icon:fire]] <b>远古龙尊</b> 进入第 ${ph} 阶段`, 'warn');
    }
  }
function addTempCard(tpl) {
    const uid = 'bts' + Date.now().toString(36) + ((set$tmpSeq(tmpSeq + 1), tmpSeq - 1));
    granted.push({ uid, card: { ...tpl } });
    hand.push(uid);
    cardAnims.push({ kind: 'draw', uid, name: tpl.name || '' });
    // 置入手牌视同「抽到」（2026-09-11 英雄卡审计）：万剑归宗普通战分支走
    // grantStarterAttack→addTempCard，此前不进 lastDrawnUids，「直接释放其中武术」永远放 0 张
    lastDrawnUids.push(uid);
    return uid;
  }
function addDeckCard(tpl) {
    const uid = 'btd' + Date.now().toString(36) + ((set$tmpSeq(tmpSeq + 1), tmpSeq - 1));
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
        if (o && o.card.type === type && hand.length < R().battleHandMax) {
          hand.push(uid);
          moved++;
          lastDrawnUids.push(uid);
          cardAnims.push({ kind: 'draw', uid, name: o.card.name });
        }
        else rest.push(uid);
      }
      drawPile.push(...rest);
    }
    while (moved < n) {
      const pool = SDT.Cards.all().filter(c => c.type === type && c.rarity !== '衍生' && !['生物', '事件'].includes(c.type));
      if (!pool.length) break;
      addTempCard(pool[Math.floor(Random.random('battle') * pool.length)]);
      moved++;
    }
    if (moved) G.log(`[[icon:cards]] ${mode === 'boss' ? '从牌库' : '（普通战斗无牌库，改为直接获得）'}抽取 ${moved} 张【${esc(type)}】牌`, 'sys');
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
const applyTextEffects = createEffectExecutor({
    // 诅咒施加视觉差分（P1）：包装 addCurse——卡牌文本路径对敌方施加诅咒时推 cursefx 彩闪
    //（玩家自身中诅咒不闪，仍走日志+角标）。Combat 是模块命名空间（属性 only-getter，
    // 不能 Object.create 委托），展开为快照普通对象再覆盖——combat.js 导出全是函数/常量，快照安全。
    combat: {
      ...Combat,
      addCurse(t, key, n) {
        Combat.addCurse(t, key, n);
        if (t && !t.dead && t !== pstat) {
          floats.push({ unit: foeIdx(t), text: '', cls: `cursefx curse-${key}` });
        }
      },
    },
    getAlive: alive,
    getPlayerStatus: () => pstat,
    getPlayerDefense: () => pdef,
    getMode: () => mode,
    log: (message, kind) => G.log(message, kind),
    escapeHtml: esc,
    heal: amount => G.heal(amount),
    pushFloat: value => floats.push(value),
    drawCards,
    grantStarterAttack: grantSha,
    markNoDrawNext: () => { set$noDrawNext(true); },
    queueDiscover: value => discoverQueue.push(value),
    randomDiscoverCard,
    addTempCard,
    addDeckCard,
    queueHandSelect: job => { handSelectQueue.push(job); processHandSelect(); },
    restoreConsumed: n => restoreConsumed(n),
    random01: () => Random.random('battle'),
    allCards: () => SDT.Cards.all(),
    // —— 抉择面板（2026-09-08 人工 N 选一）：选项入队并弹出面板 ——
    queueChoice: job => { choiceQueue.push(job); processChoice(); },
    // —— 装备嵌入句「回合开始 -N 血」注册为每回合开始的延迟段（留言 #10 通用机制；灭魔之剑已退役）——
    registerTurnStartText: (text, cardName) => { delayed.push({ text, cardName, repeat: true }); },
    setStealthStrike: v => { set$stealthStrike(!!v); },
    setNextSpellTwice: n => { set$nextSpellTwice(n || 0); },
    shuffleDeck: () => { set$drawPile(shuffle(drawPile)); return drawPile.length; },
    addEnergy: amount => { set$energy(energy + (amount)); return energy; },
    addEnergyCap: amount => { set$maxEnergy(maxEnergy + (amount)); set$energy(energy + (amount)); return maxEnergy; },
    // 第十二批（2026-09-23）：后备能源「回复所有费用」= 能量回满；招式池谓词复用卡库判定
    refillEnergy: () => { set$energy(maxEnergy); return maxEnergy; },
    isRandomObtainable: c => SDT.Cards.isRandomObtainable(c),
    // —— 2026-09-08 补线：以下端口此前从未传入，相关描述一打就崩 ——
    getPlayerHp: () => G.hp,
    getHandSize: () => hand.length,
    getHandCards: () => hand.map(findCard).filter(Boolean),
    burstPoison: t => Combat.tickPoison(t),
    deckDraw,
    fleeBattle: () => flee(),
    sweepDead,
    armorMul: () => armorMul,
    getPlayerClass: () => G.myClass || null,
    getPlayerCaster: () => ({
      atk: G.atk,
      // spellUp 不预加：status 里带着，combat.dealDamage 只加一次（2026-09-09 修复双重计数）
      spellPower: G.spellPower || 0,
      status: pstat ? pstat.status : undefined,
    }),
    foeIndexOf: t => foes.indexOf(t),
    releaseHandMatches,
    autoPlayHandType,
    setShaTransform: name => { set$shaTransform(name || null); },
    setConsumeFireball: n => { set$consumeFireballN(n || 0); },
    damagePlayer: n => {
      // 黑暗吊坠死亡保险：致死伤害被挡下，该回合无敌（C11）
      if (n > 0 && G.hp - n <= 0 && deathSave > 0) {
        set$deathSave(deathSave - 1);
        Combat.addBlessing(pstat, 'immune', 1);
        G.log(`[[icon:sparkles]] <b>致命一击被挡下！</b>（死亡保险剩余 ${deathSave} 次，本回合无敌）`, 'ok');
        return;
      }
      G.hp = Math.max(0, G.hp - n);
      if (n > 0 && unyieldRune) { const g = drawCards(1); G.log('[[icon:cards]] <b>不屈符文</b>：受到伤害，抽 ' + g + ' 张牌', 'sys'); }
      floats.push({ unit: 'self', text: '-' + n, cls: 'hurt' });
      G.log(`[[icon:blood]] 受到 <b>${n}</b> 点伤害（${G.hp}/${G.maxHp}）`, 'warn');
    },
    addPlayerMaxHp: n => {
      G.maxHp += n;
      G.heal(n);
      G.log(`[[icon:heart]] 血量上限 +${n}（当前上限 ${G.maxHp}，并回复 ${n} 点）`, 'ok');
    },
    dumpHand: () => {
      const uids = hand.slice();
      set$hand([]);
      uids.forEach(u => {
        consumed.push(u);
        if (mode === 'boss') grave.push(u);
        const o = findCard(u);
        cardAnims.push({ kind: 'dump', uid: u, name: o ? o.card.name : '' });
      });
      return uids.length;
    },
    // —— 2026-09-09 机制审计补实装端口（Q1-Q8 老板定向批次）——
    getInfuseFuels: () => infuseFuels,
    getPriceOfLastDrawn: () => {
      const uid = lastDrawnUids[lastDrawnUids.length - 1];
      const o = uid && findCard(uid);
      return o ? SDT.Cards.sellPrice(o.card) : 0;
    },
    dealAoeFixed: n => {
      alive().slice().forEach(t => {   // 本模块函数名是 alive（此前误写 getAlive，气功波价格伤害一触发即崩）
        const r = Combat.dealDamage({ atk: G.atk }, t, n, Combat.TYPES.FIXED);
        if (r.dealt > 0) floats.push({ unit: foeIdx(t), text: '-' + r.dealt, cls: 'dmg' });
      });
      sweepDead();
    },
    replaceShaInDeck,
    summonAlly,
    setExtraTurn: v => { set$extraTurn(!!v); },
    setDeathSave: n => { set$deathSave(n || 0); },
    queuePouchCast,
    registerGrowthCard: card => { if (card && card.name) growthNames.add(card.name); },
    unlockSeal: name => tryUnlockSeal(name),
    randomAcquired: card => fireCatGift(card),
    handCurseSpecs,
    queueSwapCostDiscover,
  });
function repairLegacyTT7Card(card) {
    if (!card || !['tt7-thundergrudge', 'tt7-meteorrain'].includes(card.id)) return card;
    // Active battle snapshots may retain old card clones. The canonical card catalog
    // remains the sole source for their gameplay fields and structured rule contract.
    const definition = SDT.Cards.TABLETOP10?.find(entry => entry.id === card.id);
    if (!definition?.rules) return card;
    card.dmg = definition.dmg;
    card.dmgType = definition.dmgType;
    if (JSON.stringify(card.rules) !== JSON.stringify(definition.rules))
      card.rules = JSON.parse(JSON.stringify(definition.rules));
    return card;
  }
const findCard = (uid) => {
    const ov = cardOverrides.get(uid);
    if (ov) return { uid, card: repairLegacyTT7Card(ov) };
    const entry = G.ownedCards.find(o => o.uid === uid) || granted.find(o => o.uid === uid) || null;
    if (entry) repairLegacyTT7Card(entry.card);
    return entry;
  };
const drawOf = (card) => +(card.draw || 0) || SDT.Cards.deriveDraw(card) || 0;
const infuseOf = (card) => card._noInfuse ? 0 : (+(card.infuse || 0) || SDT.Cards.deriveInfuse(card) || 0);
const effCostOf = (card, uid) => {
    // 仅后备能源类描述需要读取消耗口袋；常规求费不扫描消耗区。
    const pocketDiscount = pocketSpellDiscountFor(card);
    const consumedSpellCount = pocketDiscount
      ? consumed.filter(u => { const o = findCard(u); return o && o.card.type === '法术'; }).length
      : 0;
    return calculateEffectiveCardCost(card, uid, {
      unlimitedRune,
      zeroFeeTurn: uid ? zeroFeeUntil.get(uid) : undefined,
      turn,
      cosmosForm: pstat && pstat.status && pstat.status.cosmosForm,
      spellCost1,
      meleeCost1,
      lastPlayedType,
      playedMartialThisTurn,
      armor: pdef ? (pdef.armor || 0) : null,
      pocketDiscount,
      consumedSpellCount,
    });
  };
const isAOE = isAreaEffect;
const CURSE_SCAN = [
    { key: 'bleed',   re: /(?:附加|施加)\s*(?:(\d+)\s*层?)?\s*流血/, def: 1 },
    { key: 'poison',  re: /(?:附加|施加)\s*(?:(\d+)\s*层)?\s*中毒/, def: 1 },
    { key: 'burn',    re: /(?:附加|施加|攻击并)\s*(?:\d+\s*层?\s*)?灼烧/, def: 1 },
    { key: 'freeze',  re: /附加冰冻|冰冻所有|冰冻\s*(?:\d+|[一两二三四五])?\s*名|冻结/, def: 1 },
    { key: 'silence', re: /沉默/, def: 1 },
    { key: 'abreak',  re: /破甲/, def: 2 },
    { key: 'healban', re: /禁疗/, def: 2 },
  ];
function curseSpecsOfDesc(desc) {
    desc = String(desc || '');
    const out = [];
    CURSE_SCAN.forEach(({ key, re, def }) => {
      const m = desc.match(re);
      if (m) out.push({ key, n: Math.max(1, +(m[1] || def) || def) });
    });
    return out;
  }
function handCurseSpecs() {
    const merged = new Map();
    hand.forEach(u => {
      const o = findCard(u);
      const c = o && o.card;
      if (!c || !['武术', '法术'].includes(c.type)) return;
      curseSpecsOfDesc(c.desc).forEach(s => {
        const stack = Combat.CURSE_META[s.key] && Combat.CURSE_META[s.key].stack;
        merged.set(s.key, stack ? (merged.get(s.key) || 0) + s.n : Math.max(merged.get(s.key) || 0, s.n));
      });
    });
    return [...merged.entries()].map(([key, n]) => ({ key, n }));
  }
function queueSwapCostDiscover() {
    const pool = SDT.Cards.all().filter(c => ['武术', '法术'].includes(c.type) && SDT.Cards.isRandomObtainable(c));
    if (pool.length < 2) {
      G.log('[[icon:cross]] <b>迷之匣</b>：卡牌库中没有足够的随机招式可供发现', 'warn');
      return;
    }
    const pair = [];
    const pred = c => ['武术', '法术'].includes(c.type);
    discoverQueue.push({ n: 1, pred, act: 'swapCost', swapPair: pair });
    discoverQueue.push({ n: 1, pred, act: 'swapCost', swapPair: pair });
    G.log('[[icon:question]] <b>迷之匣</b>：发现两张随机招式——它们打出前会交换费用', 'sys');
  }
function swapCardCosts(uidA, uidB) {
    const a = findCard(uidA), b = findCard(uidB);
    if (!a || !b) return;
    const costA = Math.max(0, +(b.card.cost || 0));
    const costB = Math.max(0, +(a.card.cost || 0));
    cardOverrides.set(uidA, { ...a.card, cost: costA });
    cardOverrides.set(uidB, { ...b.card, cost: costB });
    G.log(`[[icon:sparkles]] <b>交换费用</b>：【${esc(a.card.name)}】费用变为 <b>${costA}</b>，【${esc(b.card.name)}】费用变为 <b>${costB}</b>`, 'sys');
  }
function captureSnapshotInput() {
    const pTgt = pendingTargetOf();
    const pItem = pendingItemOf();
    const potionBar = G && !selectingDeck ? battleBagItems().reduce((acc, o) => {
        const g = acc.find(p => p.name === o.card.name);
        if (g) g.count++;
        else {
          const u = itemUsability(o.card);
          acc.push({ uid: o.uid, name: o.card.name, count: 1, desc: String(o.card.desc || ''), aim: itemTargetSideFor(o.card), usable: u.usable, why: u.why });
        }
        return acc;
      }, []) : null;
    return {
      battleToken: battleState.token, mode, turn, energy, maxEnergy, busy, phase: battleState.phase,
      actionQueueLength: actionQueue.length,
      opts,
      player: G ? { hp: G.hp, maxHp: G.maxHp, atk: G.atk, spellPower: G.spellPower || 0, myClass: G.myClass || null, characterId: G.characterId || null } : null,
      pdef, pstat, foes, deathFxPending: foes.map(foe => stagedDeathFx.has(foe)), allies, hand, drawPile, discard, grave, infusing, discovering,
      handSelecting, choosing, pendingTarget: pTgt, pendingHint, viewingGrave, viewingDeck, viewingBag,
      dreadShown, selectingDeck, deckNeed: R().bossDeckSize, selDeckMax, selShaN, sel, selPool,
      potionBar, pendingItem: pItem, slamPending: !!interactionOf('slam'), dartPending: !!interactionOf('dart'),
      equipped: equipped.map(e => ({
        uid: e.uid, card: e.card, name: e.card.name, desc: String(e.card.desc || ''),
        skill: equipSkillText(e.card), used: e.used,
      })),
    };
  }
function snapshotSignature(input = captureSnapshotInput()) {
    // The view also reads these rules through battle.core when rendering hand cards.
    return createBattleSnapshotSignature(input, {
      handSelectQueueLength: handSelectQueue.length, choiceQueueLength: choiceQueue.length,
      spellCost1, meleeCost1, shaTransform, consumeFireballN, lastPlayedType,
      stealthStrike, freeCast, cardOverrides, zeroFeeUntil, growth,
    });
  }
function getSnapshot() {
    const input = captureSnapshotInput();
    const sig = snapshotSignature(input);
    if (snapCache && sig === snapSig) return snapCache;
    storeBattleSnapshot(sig, createBattleSnapshot(input));
    return snapCache;
  }
function clearTargetSession(preserveCardUid = null) {
    if (!interaction && battleState.phase !== BATTLE_PHASES.TARGETING) return false;
    const i = interaction;
    set$interaction(null);
    if (i && i.kind === 'card' && i.uid !== preserveCardUid && freeCast.has(i.uid)) freeCast.delete(i.uid);
    set$pendingHint('');
    if (battleState.phase === BATTLE_PHASES.TARGETING) set$battleState(cancelTargeting(battleState));
    return true;
  }
function cancelInteraction() {
    if (!clearTargetSession()) return;
    requestBattleRender();
  }
function beginSpecialTargeting(kind, uid = null, card = null) {
    clearTargetSession();
    set$interaction({ kind, uid, card, hint: '' });
    requestBattleRender();
  }
function beginCardTargeting(uid, card, targetIds, hint, fuelUids = []) {
    const previous = interactionOf('card');
    if (previous?.uid === uid && !fuelUids.length) fuelUids = previous.fuelUids || [];
    clearTargetSession(uid);
    set$interaction({ kind: 'card', uid, card, hint: hint || '', fuelUids });
    set$battleState(beginTargeting(battleState, uid, targetIds));
    set$pendingHint(hint || '');
    requestBattleRender();
  }

// —— 属地模块转发面：装备/战斗背包/入口收尾已拆出，具名导出保持对 core/enemy-phase 兼容 ——
function flee() { return battleLifecycle.flee(); }
function restore(nextGame, data) { return battleLifecycle.restore(nextGame, data); }
function finish(win) { return battleLifecycle.finish(win); }
function start(game, enemyDefs, options) { return battleLifecycle.start(game, enemyDefs, options); }
function toggleDeckCard(uid) { return battleLifecycle.toggleDeckCard(uid); }
function cancelDeckSelection() { return battleLifecycle.cancelDeckSelection(); }
function beginBoss() { return battleLifecycle.beginBoss(); }
function equipSkillText(card) { return equipment.equipSkillText(card); }
function registerEquip(uid, card) { return equipment.registerEquip(uid, card); }
function equipCap() { return equipment.equipCap(); }
function syncCurseCondEquips() { return equipment.syncCurseCondEquips(); }
function useEquipSkill(uid) { return equipment.useEquipSkill(uid); }
function battleBagItems() { return bag.battleBagItems(); }
function restoreConsumed(n) { return bag.restoreConsumed(n); }
function itemUsability(card) { return bag.itemUsability(card); }
function useItem(uid, side) { return bag.useItem(uid, side); }
function bagSlam() { return bag.bagSlam(); }
function beginDartStrike() { return bag.beginDartStrike(); }
function resolveDart(side) { return bag.resolveDart(side); }
function resolveSlam(side) { return bag.resolveSlam(side); }
function usePotion(uid) { return bag.usePotion(uid); }
function openBag() { return bag.openBag(); }
function closeBag() { return bag.closeBag(); }

export { requestBattleRender, interactionOf, cloneData, cardIdentity, R, alive, intentFor, drawCards, resolveFoeDefeat, sweepDead, nestPhase, grantSha, findCard, infuseOf, effCostOf, swapCardCosts, restore, finish, cancelInteraction, flee, handCurseSpecs, getSnapshot, snapshotSignature, processDelayed, accrueGrowth, resolveCard, resolveCardWithFeedback, syncCurseCondEquips, useEquipSkill, applyKillRewards, start, toggleDeckCard, cancelDeckSelection, beginBoss, targetSide, unplayableReason, play, toggleInfusePick, cancelInfuse, beginInfuse, confirmInfuse, queueCardExecution, aegisBlocked, foeIdx, hitFoe, matchHandSelectKey, skipHandSelect, pickHandSelect, useItem, bagSlam, resolveDart, resolveSlam, addPlayerCurse, usePotion, openBag, closeBag, pickChoice, pickDiscover, playerTakeHit, frenzyCurse, elCurse };

/* —— 六段正文（原行 606-2479，逐字）—— */
  // ---------- 生效时刻 / 持续时间 / 生效条件（设计者 2026-09-02 定版） ----------
  // 卡牌描述按句切分（。；；换行），每句归入一种生效方式：
  //   「回合开始时：X / 下回合开始：X」 → 生效时刻词条：X 延迟到下个回合开始结算
  //     （装备卡是战斗内持续物件，其延迟段每回合开始重复触发；其余一次性）
  //   「本局对战内 / 本场战斗(中)…」   → 持续时间词条：整场战斗有效，离开战斗失效
  //   「被注能时：X」                  → 生效条件词条：只有作为注能牺牲品被消耗时
  //     才结算 X（打出时跳过——牺牲品没有被「使用」，主效果不触发）；未来会有更多条件
  //   其余句子 → 立即生效
  const splitClauses = splitEffectClauses;

  // 注册「回合开始时」延迟段（2026-09-09 老板定向 Q3）：
  //   repeat = 装备卡 /「每回合开始时」/ 能力卡或形态卡（形态=每回合）→ 每回合开始触发；
  //   「持续 N 回合」= 重复 N 次（left 计数递减）；其余一次性
  function registerTurnStart(card, items) {
    const descDur = +(((String(card.desc || '').match(/持续\s*(\d+)\s*回合/)) || [])[1] || 0);
    const formLike = card.type === '能力卡' || /形态/.test(String(card.name || ''));
    items.forEach(it => {
      const dur = +(((String(it.text).match(/持续\s*(\d+)\s*回合/)) || [])[1] || 0) || descDur;
      let repeat = card.type === '装备' || it.each || formLike;
      let left = null;
      if (!repeat && dur > 0) { repeat = true; left = dur; }   // 持续 N 回合 = 重复 N 次
      delayed.push({ text: it.text, cardName: card.name, repeat, left });
      G.log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】${esc(it.text)}（下个回合开始${repeat ? (left ? `起共 ${left} 次` : '起每回合') : ''}生效）`, 'sys');
    });
  }

  // 回合开始：结算延迟段（沉默中技能无效——一次性段被吞掉，重复段保留到下回合；
  // notBeforeTurn = 花开两面未选之门「两回合后」的定时刻；special = 江湖救急临时卡消耗）
  async function processDelayed(signal = activeActionSignal) {
    if (!delayed.length) return;
    const silenced = (pstat.status.silence || 0) > 0;
    const keep = [];
    for (const q of delayed) {
      if (q.notBeforeTurn && turn < q.notBeforeTurn) { keep.push(q); continue; }
      if (q.special === 'consumeTemps') {
        await consumeHandUids(q.uids || [], q.cardName, signal);
        continue;   // 一次性，不保留
      }
      // 第十二批（2026-09-23）两个一次性 special：均不走沉默门（状态还原/费用记账非技能句）
      if (q.special === 'curseImmuneOff') {
        set$playerCurseImmune(!!q.restore);
        continue;   // 一次性，不保留
      }
      if (q.special === 'costDecay' || q.special === 'ruleCostDecay') {
        // Legacy text jobs and structured rule jobs both bind decay to the discovered card uid.
        const o = q.uid ? findCard(q.uid) : null;
        if (o) {
          const cur = +(o.card.cost || 0);
          const decayed = decayEffectiveCardCost(o.card, q.special === 'costDecay' ? 1 : q.amount);
          const nc = +(decayed.cost || 0);
          if (nc !== cur) {
            cardOverrides.set(q.uid, decayed);
            G.log(`[[icon:bolt]] <b>回合开始时</b>：【${esc(o.card.name)}】费用 -${cur - nc}（现 ${nc} 费）`, 'sys');
          }
          if (nc > 0) keep.push(q);
        }
        continue;   // 保留与否自行管理
      }
      if (silenced) {
        G.log(`[[icon:cross]] 沉默中：【${esc(q.cardName)}】的回合开始效果无法生效`, 'warn');
      } else {
        G.log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(q.cardName)}】${esc(q.text)}`, 'sys');
        if (applyTextEffects.steps) {
          await runStagedSteps(applyTextEffects.steps({ name: q.cardName }, q.text, alive()[0] || null, {}), signal);
        } else {
          applyTextEffects({ name: q.cardName }, q.text, alive()[0] || null);
        }
      }
      if (q.repeat) {
        if (typeof q.left === 'number') { q.left -= 1; if (q.left > 0) keep.push(q); }
        else keep.push(q);
      }
    }
    set$delayed(keep);
  }

  // 「回合开始时，本牌伤害+N」成长：所有在场/在库副本按 uid 累积（充能火球）
  function accrueGrowth() {
    if (!growthNames.size) return;
    [...hand, ...drawPile, ...discard, ...grave].forEach(uid => {
      const o = findCard(uid);
      if (o && growthNames.has(o.card.name)) growth[uid] = (growth[uid] || 0) + 1;
    });
  }

  // 「本局对战内」持续效果：注册并结算其中已支持的部分（增益本身即战斗内长期有效）
  function registerBattle(card, clause, target) {
    G.log(`[[icon:question]] <b>本局对战内</b>：${esc(clause)}（整场战斗有效，离开战斗失效）`, 'ok');
    const inner = clause.replace(/^(本局对战内|本场对战|本场战斗)[中内]?[：:，,]?\s*/, '');
    // 银河之旅（迭代评审 09-20 终裁）：desc 已定稿「你的所有武术均为 1 费」——
    // 触发正则补「武术」分支；实装只降武术（:530），「所有卡牌」是宇宙形态的口径，不得混同
    if (/所有(?:法术|招式|武术)[^。]*?1\s*费/.test(inner)) {
      if (/所有招式|所有武术/.test(inner)) {
        set$meleeCost1(true);
        G.log('[[icon:sparkles]] 持续规则：你的所有武术均按 <b>1</b> 费打出', 'ok');
      } else {
        set$spellCost1(true);
        G.log('[[icon:sparkles]] 持续规则：你的所有法术均按 <b>1</b> 费打出', 'ok');
      }
    }
    return applyTextEffects(card, inner, target).did;
  }

  // 「被注能时」条件效果：作为注能牺牲品被消耗时触发（未被使用，主效果不结算）
  function resolveInfusedFuel(card, target) {
    const parts = splitClauses(card.desc);
    if (!parts.onInfused.length) return false;
    if ((pstat.status.silence || 0) > 0) {
      G.log(`[[icon:cross]] 沉默中：【${esc(card.name)}】的被注能效果无法生效`, 'warn');
      return true;
    }
    parts.onInfused.forEach(text => {
      G.log(`[[icon:flask]] <b>被注能时</b>：【${esc(card.name)}】${esc(text)}`, 'sys');
      applyTextEffects(card, text, target);
    });
    return true;
  }

  // 出牌结算（目标：单点卡 = target；群体卡 = 所有存活敌人；infused = 作为注能主卡打出；
  // fuelCost = 注能牺牲品费用合计，供「N 倍于被注能卡牌价格」类效果折算；uid = 成长/容器定位）
  const resolveCard = createBattleResolution({
    readState: () => ({ mode, playedMovesThisTurn, infuseFuels, grave }),
    getPlayerStatus: () => pstat,
    esc,
    log: (...args) => G.log(...args),
    heal: amount => G.heal(amount),
    addFloat: value => floats.push(value),
    addDelayed: value => delayed.push(value),
    takeDeckBottom: count => drawPile.splice(0, count),
    deckBottomCount: () => drawPile.length,
    startSurge: promise => set$surgeWaiter(promise),
    getAllCards: () => SDT.Cards.all(),
    isRandomObtainable: card => SDT.Cards.isRandomObtainable(card),
    randomBattle: () => Random.random('battle'),
    getDamageTypes: () => SDT.Cards.DMG_TYPES,
    getDamageTypeMeta: () => SDT.Cards.DMG_TYPE_META,
    fixedDamageType: Combat.TYPES.FIXED,
    hasCurse: foe => Combat.hasCurse(foe),
    getAliveFoes: alive,
    getGrowth: uid => growth[uid],
    applyStatus: (foe, status, duration) => {
      const applied = Combat.addCurse(foe, status, duration);
      if (applied > 0 && foe && !foe.dead) {
        floats.push({ unit: foeIdx(foe), text: '', cls: `cursefx curse-${status}` });
        if (status === 'abreak') SDT.Sound.sfx('armorBreak');
      }
      return applied;
    },
    findCard, addTempCard, queueDiscover: value => discoverQueue.push(value), splitClauses, applyTextEffects,
    registerTurnStart, registerBattle, castRandomSpells, drawCards, grantSha, hitFoe,
    drawOf, isAOE,
    addArmor: amount => { pdef.armor += amount; },
  });

  const runStagedSteps = createStagedPlayback({
    session: executionSession,
    getBattleToken: () => battleState.token,
    getFloats: () => floats,
    foeIdx,
    render: requestBattleRender,
    finish,
  });
  function* singleTargetHitSteps(target, hit) {
    yield { kind: 'windup', targets: [target] };
    if (target.dead) return false;
    if (hit() === false) return false;
    yield { kind: 'hit' };
    return true;
  }
  function* consumeFireballSteps(count) {
    for (let k = 0; k < count; k++) {
      const t = alive()[0];
      if (!t) break;
      yield* singleTargetHitSteps(t, () => {
        const hpBefore = t.hp;
        const r = Combat.dealDamage({
          atk: G.atk,
          spellPower: G.spellPower || 0,   // spellUp 由 status 传入只算一次
          status: pstat.status,
        }, t, 4, Combat.TYPES.SPELL);
        if (r.dealt > 0) floats.push({ unit: foeIdx(t), text: '-' + r.dealt,
          cls: 'dmg', hpBefore, hpAfter: t.hp, maxHp: t.maxHp });
        G.log(`[[icon:fire]] 深渊降焰：施放 1 次火球 → ${esc(t.name)}：造成 <b>${r.dealt}</b> 点法术伤害`, 'sys');
        sweepDead();
      });
    }
  }
  function resolveCardWithFeedback(card, target, infused, fuelCost, uid, signal = activeActionSignal) {
    return runStagedSteps(resolveCard.steps(card, target, infused, fuelCost, uid), signal);
  }

  // 法力奔涌的随机法术释放（2026-09-10 需求）：
  // 池子与「发现/随机获取」同口径（isRandomObtainable：排除 初始/职业/衍生/棱彩与 unrandom），
  // 并排除本牌自身，避免「释放随机法术」抽到自己无限递归。
  // 每发对随机存活敌人以 infused=true 直接结算——随机法术的「注能(N)：…」加成句照常生效，
  // 且无需消耗手牌燃料（＝"默认已注能"）。
  // 慢动作节拍（2026-09-16 留言「法力奔涌应当慢动作打出4张卡牌」）：逐发等待给视图时间
  // 演出每一发；vitest 环境置 0 保持回归测试节奏。动作在 execPlay 内被 await，
  // 演出期间 busy 保持、玩家无法插手。
  const SURGE_WAVE_MS = (typeof process !== 'undefined' && process.env && process.env.VITEST) ? 0 : 850;
  
  const surgeSleep = (ms, signal) => new Promise((resolve, reject) => {
    throwIfActionCancelled(signal);
    const timer = setTimeout(done, ms);
    function cleanup() { signal?.removeEventListener('abort', cancel); }
    function done() { cleanup(); resolve(); }
    function cancel() { clearTimeout(timer); cleanup(); reject(actionCancellationError(signal)); }
    signal?.addEventListener('abort', cancel, { once: true });
  });
            // 正在进行的奔涌演出（execPlay 在结算后 await 它）
  const takeSurge = async (signal) => {
    const p = surgeWaiter;
    set$surgeWaiter(null);
    if (p) await p;
    throwIfActionCancelled(signal);
  };
  async function castRandomSpells(n, sourceId, signal = activeActionSignal) {
    try {
    const pool = SDT.Cards.all().filter(c =>
      c.type === '法术' && c.id !== sourceId && SDT.Cards.isRandomObtainable(c));
    if (!pool.length) {
      G.log('[[icon:cross]] <b>法力奔涌</b>：卡牌库中没有可释放的随机法术', 'warn');
      return;
    }
    for (let i = 0; i < n; i++) {
      throwIfActionCancelled(signal);
      sweepDead();
      const targets = alive();
      if (!targets.length) break;   // 敌人全灭则停止余下的释放
      const spell = pool[Math.floor(Random.random('battle') * pool.length)];
      const t = targets[Math.floor(Random.random('battle') * targets.length)];
      cardAnims.push({ kind: 'surge', i: i + 1, n, name: spell.name, target: foes.indexOf(t), targetName: t.name, card: { ...spell } });   // 慢动作演出事件
      G.log(`[[icon:sparkles]] <b>法力奔涌</b>（第 ${i + 1}/${n} 发）：对 <b>${esc(t.name)}</b> 释放随机法术【<b>${esc(spell.name)}</b>】（默认已注能）`, 'loot');
      await resolveCardWithFeedback(spell, t, true, 0, null, signal);
      if (SURGE_WAVE_MS > 0) { requestBattleRender(); await surgeSleep(SURGE_WAVE_MS, signal); }
    }
    throwIfActionCancelled(signal);
    sweepDead();
    } catch (err) {
      if (err?.name === 'BattleActionCancelledError') throw err;
      console.error('[surge] 奔涌演出异常已兜底：', err);
    }
  }

  // 迷之匣「对战开始时，将 2 张杀替换为随机卡牌」
  function replaceShaInDeck(n) {
    if (mode !== 'boss') return 0;
    let done = 0;
    const rest = [];
    for (const uid of drawPile) {
      const o = findCard(uid);
      const isSha = o && (o.card.name === '初始攻击' || o.card.name === '杀');
      if (isSha && done < n) { done++; continue; }
      rest.push(uid);
    }
    set$drawPile(rest);
    for (let i = 0; i < done; i++) {
      const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c));
      if (pool.length) addDeckCard(pool[Math.floor(Random.random('battle') * pool.length)]);
    }
    return done;
  }
  // —— 随从位（2026-09-09 老板定向 Q4）：征召步兵等——优先替玩家承伤、每回合自动攻击 ——
  function summonAlly(name, atk, hp, n, statless) {
    for (let i = 0; i < (n || 1); i++) {
      // statless：无攻击力与血量的场面物件（封印肢体，同天国之门口径）——
      // 不自动攻击、不替主人承伤、不参与hp结算
      allies.push({ name, atk: statless ? 0 : atk, hp: statless ? null : hp, maxHp: statless ? null : hp, dead: false, statless: !!statless, status: {}, defense: { shield: 0, armor: 0, guard: false } });
    }
  }
  function poisonRandomFoe() {
    const ts = alive();
    if (!ts.length) return;
    const t = ts[Math.floor(Random.random('battle') * ts.length)];
    Combat.addCurse(t, 'poison', 1);
    G.log(`[[icon:skull]] <b>毒杖</b>：${esc(t.name)} 附加 1 层中毒`, 'sys');
  }
  // 阿猫的礼物（tt2-apollo，2026-09-12 实装）：「发现或随机获取该牌时，回复1点能量并获取另1张随机卡牌」
  // 战斗内触发：+1 能量 + 随机卡置入手牌（临时卡）；地图侧触发见 grantEventCard（地图无能量概念，只发额外卡）
  const CAT_GIFT_ID = 'tt2-apollo';
  function fireCatGift(card) {
    if (!card || card.id !== CAT_GIFT_ID) return;
    set$energy(energy + (1));
    G.log(`[[icon:bolt]] <b>阿猫的礼物</b>：回复 1 点能量（当前 ${energy}/${maxEnergy}）`, 'ok');
    const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c) && c.id !== CAT_GIFT_ID);
    if (!pool.length) return;
    const uid = addTempCard(pool[Math.floor(Random.random('battle') * pool.length)]);
    const o = findCard(uid);
    G.log(`[[icon:cards]] <b>阿猫的礼物</b>：获得【<b>${esc(o ? o.card.name : '?')}</b>】置入手牌（战斗内临时卡，战后消散）`, 'loot');
  }
  // 「消耗该牌时」触发（Q2 老板定向：注能牺牲与手选消耗都算「消耗」）
  function fireConsumeTriggers(card, target) {
    (consumeTriggerTexts(card && card.desc)).forEach(text => {
      G.log(`[[icon:flask]] <b>消耗该牌时</b>：【${esc(card.name)}】${esc(text)}`, 'sys');
      applyTextEffects(card, text, target || (alive()[0] || null), {});
    });
  }
  // 元素符印「累计注能 3 张后解锁：法伤+2，抽2张」——单点结算，防被动与主动双发
  function tryUnlockSeal(name) {
    if (sealUnlocked) { G.log(`[[icon:crystal]] 【${esc(name)}】已处于解锁状态（跳过重复结算）`, 'dim'); return; }
    set$sealUnlocked(true);
    Combat.addBlessing(pstat, 'spellUp', 2);
    const got = mode === 'boss' ? drawCards(2) : (grantSha(2), 2);
    G.log(`[[icon:crystal]] <b>元素符印解锁</b>：法伤 +2${mode === 'boss' ? `，抽了 ${got} 张牌` : '，获得 2 张【初始攻击】'}`, 'ok');
  }
  // 击杀钩子（C1）：饮血剑 = 本局被动每杀 +1 攻；破甲重斩/闪金之锤 = 该卡自身击杀触发
  function applyKillRewards(card, kills) {
    if (kills <= 0) return;
    if (killAtkUp > 0) {
      Combat.addBlessing(pstat, 'atkUp', killAtkUp * kills);
      G.log(`[[icon:swords]] <b>饮血剑</b>：消灭 ${kills} 个敌人，攻击力 +${killAtkUp * kills}（当前加成 ${pstat.status.atkUp}）`, 'ok');
    }
    if (!card) return;
    const d = String(card.desc || '');
    const armorM = d.match(/击杀(?:敌人)?(?:时|则)?[^。；]*?\+\s*(\d+)\s*甲/);
    if (armorM) {
      pdef.armor += +armorM[1] * kills;
      G.log(`[[icon:plate]] <b>${esc(card.name)}</b>：击杀敌人，+${+armorM[1] * kills} 甲（当前 ${pdef.armor}）`, 'ok');
    }
    const coinM = d.match(/若击杀敌人[，,]?\s*\+\s*(\d+)\s*币/);
    if (coinM) {
      G.coins = (G.coins || 0) + +coinM[1] * kills;
      G.log(`[[icon:coin]] <b>${esc(card.name)}</b>：击杀敌人，+${+coinM[1] * kills} 币`, 'loot');
    }
  }
  // 江湖救急：回合开始将其置入的临时卡消耗（会正确触发「每消耗 1 张」联动）
  async function consumeHandUids(uids, cardName, signal = activeActionSignal) {
    let n = 0;
    for (const u of (uids || [])) {
      const idx = hand.indexOf(u);
      if (idx < 0) continue;
      hand.splice(idx, 1);
      consumed.push(u);
      if (mode === 'boss') grave.push(u);
      const o = findCard(u);
      cardAnims.push({ kind: 'burn', uid: u, name: o ? o.card.name : '' });
      if (o) resolveInfusedFuel(o.card, alive()[0] || null);
      if (consumeFireballN > 0) await runStagedSteps(consumeFireballSteps(consumeFireballN), signal);
      n++;
    }
    if (n) G.log(`[[icon:flask]] <b>${esc(cardName || '临时卡')}</b>：回合开始，消耗了 ${n} 张临时卡`, 'sys');
    return n;
  }
  // 法师锦囊容器（Q5 老板定向）：自带 1×3 空间——空时自动置入 3 张随机法术，打出时选 1 张直接施放
  function queuePouchCast(uid) {
    const entry = findCard(uid);
    if (!entry) return;
    // 2026-09-16 定版：锦囊里的法术由玩家在背包中提前存入（pouchOf 标记），
    // 开战时读入 _pouch；锦囊为空则无效果（不再自动填充随机法术）
    if (!Array.isArray(entry.card._pouch)) entry.card._pouch = [];
    if (!entry.card._pouch.length) {
      (G.ownedCards || []).forEach(o => {
        if (o.pouchOf === 'tt7-stratagem' && o.card && o.card.type === '法术') {
          entry.card._pouch.push({ ...o.card });
        }
      });
      if (entry.card._pouch.length) {
        G.log(`[[icon:cards]] <b>法师锦囊</b>：从背包 pouch 载入 ${entry.card._pouch.length} 张法术`, 'sys');
      }
    }
    if (!entry.card._pouch.length) { G.log('[[icon:question]] 锦囊是空的——背包中存入法术后才能生效', 'dim'); return; }
    set$discovering({ options: entry.card._pouch.slice(), n: 1, act: 'pouch', pouchUid: uid, pred: null });
    requestBattleRender();
  }
  // 不变应万变（Q8 老板定向）：「在手牌中时，本牌变为打出的上一张武术牌的1费复制」——
  // 战斗内替身（findCard 优先读 overrides），不污染背包原卡；战斗结束随 reset 清空
  function applyImitate(playedMartial) {
    if (!playedMartial) return;
    hand.forEach(h => {
      const o = findCard(h);
      if (o && o.card.id === 'tt7-imitate' && !cardOverrides.has(h)) {
        cardOverrides.set(h, { ...playedMartial, cost: 1 });
        G.log(`[[icon:recycle]] <b>${esc(o.card.name)}</b>：变为【${esc(playedMartial.name)}】的 1 费复制`, 'sys');
      }
    });
  }

  // ---------- 目标规则（v0.22 设计者定版：指向性卡必须拖到目标身上） ----------
  // 'enemy' = 伤害类 → 拖到敌人身上打出
  // 'self'  = 治疗/净化/护甲/护盾/格挡类 → 拖到自己（立绘）身上
  // null    = 群体卡与无指向效果（抽牌/发现/能量…）→ 直接点击打出
  function targetSide(card) {
    return targetSideFor(card, SDT.Cards.DMG_TYPES);
  }

  // ---------- 不可打出判定（v0.24：无法使用的卡在手中虚化、无法触发并提示原因） ----------
  // 资源/事件卡任何战斗都打不出；牌库/墓地类词条只有对战 BOSS 才生效
  // （普通战斗没有牌库与墓地概念）；道具卡只能在普通战斗中使用。
  // 2026-09-09 老板 #14：手牌代价（消耗 N 张 X / 选择 N 张手牌）不足时同样不可打出。
  function unplayableReason(card) {
    const handCards = hand.map(u => { const o = findCard(u); return o ? { uid: u, card: o.card } : null; }).filter(Boolean);
    return unplayableReasonFor(card, mode, { handCards, selfCard: card });
  }

  function play(uid, side, forceDirect) {
    // 迟到/非法 uid 必须在任何交互状态变更前拒绝；否则会顺带取消当前药水点选。
    if (!hand.includes(uid)) return;
    if (busy || infusing || discovering || choosing || handSelecting || viewingGrave || viewingDeck) return;
    // 玩家命令只能提交当前手牌。内部直接释放继续直接走 queueCardExecution，
    // 保留牌与弃牌洗回重抽后 uid 会重新位于 hand，因此仍可再次合法使用。
    const entry = findCard(uid);
    if (!entry) return;
    const card = entry.card;
    const why = unplayableReason(card);
    if (why) { G.log(`[[icon:cross]] 【${esc(card.name)}】无法打出：${why}`, 'warn'); return; }
    const effCost = effCostOf(card, uid);
    if (effCost > energy) { G.log(`[[icon:bolt]] 能量不足：【${esc(card.name)}】需要 ${effCost} 点能量`, 'warn'); return; }
    // 需求 #18：装备最多同时装配 2 件（圣剑化身「装备上限 +1」生效），超编拒打
    if (card.type === '装备') {
      const cap = equipCap();
      const worn = equipped.filter(e => !e.passive).length;
      if (worn >= cap) {
        G.log(`[[icon:tools]] 最多同时装配 <b>${cap}</b> 件装备（已装配 ${worn} 件）——本场无法再穿戴`, 'warn');
        return;
      }
    }
    // 只清「上一张卡」的指向槽；背包砸击/血毒双镖/道具点选等非卡牌点选态有自己的生命周期
    // （R3-0：待选期间打出别的卡不吞砸击选择态），一并清会把它们顺带取消。
    const staleCard = interactionOf('card');
    if (staleCard && staleCard.uid !== uid) clearTargetSession();
    // 09-20 老板定版（取代需求 #15 的「点卡直打」）：注能卡点卡先进注能态——
    // 注能条内提供「不注能直接打出」；拖拽到目标（side 非空）与该直打钮（forceDirect）仍直接打出
    if (!forceDirect && side == null && infuseOf(card) > 0) { beginInfuse(uid); return; }
    // 目标校验：指向性卡必须拖到对应目标（点卡只是锁定提示，不会打出）
    const need = targetSide(card);
    let target = null;
    const isFree = freeCast.has(uid);
    const pendingCard = interactionOf('card');
    if (need === 'enemy') {
      if (side == null || side === 'self') { beginCardTargeting(uid, card, alive().map(foe => foe.id)); return; }
      target = foes[+side];
      if (!target || target.dead) { beginCardTargeting(uid, card, alive().map(foe => foe.id)); return; }
    } else if (need === 'self') {
      if (side !== 'self') { beginCardTargeting(uid, card, ['self']); return; }
    } else {
      target = alive()[0] || null;
    }
    if (pendingCard) set$interaction(null);   // 交互正常结算：清卡牌槽（不 cancelTargeting，RESOLVING 迁移接管阶段）
    set$pendingHint('');
    // 「杀化为X」战斗规则：打出的初始攻击以目标卡形态结算（uid 沿用，弃牌簿记不变）
    let playCard = card;
    if (shaTransform && (card.name === '初始攻击' || card.name === '杀')) {
      const tpl = SDT.Cards.all().find(c => c.name === shaTransform);
      if (tpl) playCard = { ...tpl };
    }
    queueCardExecution(uid, playCard, pendingCard?.fuelUids || [], target, isFree);
  }
  // v0.32 堆叠手牌：点击的是一叠同名卡的代表性 uid——选中/取消该叠中的一张
  function toggleInfusePick(uid) {
    if (!infusing || uid === infusing.uid) return;
    const entry = findCard(uid);
    if (!entry) return;
    // 「无法用于注能」（不朽斩等）不能被选作注能牺牲品
    if (/无法用于注能/.test(String(entry.card.desc || ''))) return;
    const groupUids = hand.filter(h => {
      if (h === infusing.uid) return false;
      const o = findCard(h);
      return o && cardIdentity(o.card) === cardIdentity(entry.card);
    });
    const pickedInGroup = groupUids.filter(u => infusing.picked.has(u));
    if (pickedInGroup.length) {
      infusing.picked.delete(pickedInGroup[pickedInGroup.length - 1]);
    } else {
      const free = groupUids.find(u => !infusing.picked.has(u));
      if (free && infusing.picked.size < infusing.need) infusing.picked.add(free);
    }
    requestBattleRender();
  }
  function cancelInfuse() { set$infusing(null); requestBattleRender(); }
  // 需求 #15：注能入口——卡面上的「注能」角标触发（打出本体不再强制注能）
  function beginInfuse(uid) {
    if (busy || infusing || discovering || choosing || viewingGrave || viewingDeck) return;
    if (!hand.includes(uid)) return;
    const entry = findCard(uid);
    if (!entry) return;
    const card = entry.card;
    const infN = infuseOf(card);
    if (infN <= 0) return;
    const effCost = effCostOf(card, uid);
    if (effCost > energy) { G.log(`[[icon:bolt]] 能量不足：【${esc(card.name)}】注能打出需要 ${effCost} 点能量`, 'warn'); return; }
    const others = hand.filter(h => h !== uid);
    if (others.length < infN) {
      G.log(`[[icon:flask]] 手牌不足：【${esc(card.name)}】注能(${infN}) 需要消耗 ${infN} 张手牌，当前只有 ${others.length} 张可选`, 'warn');
      return;
    }
    clearTargetSession(uid);
    set$infusing({ uid, card, need: infN, picked: new Set() });
    requestBattleRender();
  }
  function confirmInfuse() {
    // 迭代评审 09-20：特色机制全程接音——成功=confirm 生效感，校验不过=deny（按钮路径会被
    // deny 反向抑制吞掉、仅保留视觉，程序化路径正常出声，见 sound.js DENY_SUPPRESS_MS）
    if (!infusing || infusing.picked.size !== infusing.need) { SDT.Sound.sfx('deny'); return; }
    const { uid, card } = infusing;
    const fuel = [...infusing.picked];
    set$infusing(null);
    SDT.Sound.sfx('confirm');
    if (targetSide(card) === 'enemy' && alive().length > 1) {
      beginCardTargeting(uid, card, alive().map(foe => foe.id), `注能完成：选择【${card.name}】的目标`, fuel);
      return;
    }
    queueCardExecution(uid, card, fuel, alive()[0] || null);
  }

  // 出牌稳定点节流落盘：全量 JSON.stringify + 同步 localStorage 写在 Defender
  // 实时扫描下可能到几十 ms，逐次写会造成出牌后的掉帧尖刺。回合开始仍无条件
  // 落盘，窗口内闪退最多回退数秒内的出牌（正常关窗走 beforeunload 全量保存）。
  
  const queueBattleAction = createBattleActionRunner({
    session: executionSession,
    getBattleState: () => battleState,
    setBattleState: set$battleState,
    getGame: () => G,
    setBusy: set$busy,
    getActiveActionSignal: () => activeActionSignal,
    setActiveActionSignal: set$activeActionSignal,
    getLastPersistAt: () => lastPersistAt,
    setLastPersistAt: set$lastPersistAt,
    render: requestBattleRender,
    actionCancellationError,
    throwIfActionCancelled,
  });
  const equipment = createBattleEquipment({
    requestBattleRender, clearTargetSession, queueBattleAction, runStagedSteps,
    applyTextEffects, sweepDead, alive, finish, throwIfActionCancelled,
    processChoice, processDiscoverQueue, processHandSelect, randomDiscoverCard,
    addTempCard, fireCatGift, handSelectQueue,
  });
  const bag = createBattleBag({
    requestBattleRender, clearTargetSession, cancelInteraction, beginSpecialTargeting, interactionOf,
    queueBattleAction, runStagedSteps, singleTargetHitSteps, applyTextEffects, hitFoe,
    sweepDead, finish, alive, addTempCard, addDeckCard, fireCatGift, applyKillRewards,
    throwIfActionCancelled, findCard,
  });
  const battleLifecycle = createBattleLifecycle({
    session: executionSession, intentFor, cloneData, injectSealCards, applyNestRunes, applyVoidRune,
    drawCards, applyBattleStartPassives: equipment.applyBattleStartPassives,
    isBattleStartEquip: equipment.isBattleStartEquip, isStarterAttack,
    requestBattleRender, alive, R,
  });
  const selectionFlow = createBattleSelectionFlow({
    session: executionSession,
    requestBattleRender, findCard, addTempCard, queueBattleAction,
    runStagedSteps, applyTextEffects, queueCardExecution, fireConsumeTriggers,
    fireCatGift, swapCardCosts, sweepDead, finish,
  });

  // —— 出牌结算长流程（queueCardExecution + execPlay）已拆出 battle.exec-play.js：工厂注入 + 一行转发 shim（具名导出面不变）——
  const execPlayFlow = createBattleExecPlay({
    requestBattleRender, findCard, matchHandSelectKey, fireConsumeTriggers, effCostOf,
    resolveInfusedFuel, runStagedSteps, consumeFireballSteps, resolveCardWithFeedback,
    takeSurge, registerEquip, summonAlly, applyKillRewards, poisonRandomFoe, applyImitate,
    beginDartStrike, sweepDead, finish, processChoice, processDiscoverQueue, queueBattleAction,
  });
  function queueCardExecution(uid, card, fuelUids, target, freeCost, requirementsPaid = false, paymentUids = [], onResolved = null) {
    return execPlayFlow.queueCardExecution(uid, card, fuelUids, target, freeCost, requirementsPaid, paymentUids, onResolved);
  }

  // 敌人免伤判定（异能领主：偶数回合全免伤，破甲克制）
  function aegisBlocked(foe) {
    return foe.affix === 'aegis' && turn % 2 === 0 && (foe.status.abreak || 0) <= 0;
  }

  // 敌人数组下标（飘字特效用）：按对象引用找 idx
  function foeIdx(foe) { return foes.indexOf(foe); }

  // 对单个敌人结算一次伤害（含潜行/免伤/死亡处理），返回实际伤害
  function hitFoe(foe, card, amount, type, seg) {
    if (foe.dead) return 0;
    // 龙巢：风暴之手存活时，元素领主不可被招式指定（全场命中统一拦截）
    if (foe.protected && foes.some(p => !p.dead && p.protects)) {
      if (card && card.name && card.name !== '?') {
        floats.push({ unit: foeIdx(foe), text: '庇护', cls: 'block' });
        G.log(`[[icon:shield]] <b>风暴之手</b>庇护着 <b>${esc(foe.name)}</b>——伤害被完全偏转`, 'warn');
      }
      return 0;
    }
    if (aegisBlocked(foe)) {
      SDT.Sound.sfx('parry');
      floats.push({ unit: foeIdx(foe), text: '免伤', cls: 'block' });
      G.log(`[[icon:crystal]] ${seg || ''}<b>${esc(foe.name)}</b> 的元素庇幕展开：伤害被完全减免！（破甲可击碎）`, 'warn');
      return 0;
    }
    // 破隐一击（白梅落影·妄）：自己处于潜行中发动的攻击伤害 ×2
    const stealthedBefore = Combat.isStealthed(pstat);
    let amt = amount;
    if (stealthStrike && stealthedBefore && amount > 0) {
      amt *= 2;
      G.log(`[[icon:runner]] <b>破隐一击</b>：从潜行中发动，伤害翻倍（${amount} → ${amt}）`, 'ok');
    }
    // 法伤加成（含祝福）；「受法伤加成翻倍」（爆燃火球）在此翻倍。
    // 2026-09-09 修复：spellUp 不再预加进 spellPower——dealDamage 会从 status 再加一次，
    // 此前法术强化被双重计数；现在 bonus 一次性算清并置空 status.spellUp，卡面显示口径一致
    let sp = (G.spellPower || 0) + ((pstat && pstat.status.spellUp) || 0);
    if (card && /受法伤加成翻倍/.test(String(card.desc || ''))) sp *= 2;
    const statusForHit = (pstat && pstat.status)
      ? Object.assign({}, pstat.status, { spellUp: 0 })
      : { spellUp: 0 };
    // 「对冰冻角色伤害 +N」（寒冰剑）：目标被冰冻时追加
    const frzM = card && String(card.desc || '').match(/对冰冻[^。]*?伤害\s*\+\s*(\d+)/);
    if (frzM && (foe.status.freeze || 0) > 0) amt += +frzM[1];
    // 「触发的流血伤害翻倍」（飞身劈）：流血加成部分再叠一次
    if (card && /流血伤害翻倍/.test(String(card.desc || '')) && (foe.status.bleed || 0) > 0) {
      amt += foe.status.bleed;
      G.log(`[[icon:blood]] <b>流血伤害翻倍</b>：流血加成 ${foe.status.bleed} → ${foe.status.bleed * 2}`, 'sys');
    }
    // 攻击强化祝福（atkUp）经 status 传入结算（此前 hitFoe 未带 status，攻击 blessings 未生效）；
    // spellUp 已并入 sp，传 statusForHit 防止二次叠加
    // 龙巢·暗羁绊：暗3 对敌人伤害 +1；暗1 对半血敌伤害 +1
    if (amt > 0) {
      if (nestSyn.dark3) amt += 1;
      else if (nestSyn.dark1 && foe.maxHp && foe.hp <= foe.maxHp / 2) amt += 1;
    }
    // 龙巢·心（heartsMode）：1-7 点伤害 -1 心、8+ 点 -2 心；破甲时心视作血量（1:1）；
    // 真实伤害 N 点直接 -N 心。
    // 2026-09-18 第1局实测修复：心数此前按卡面基础伤害值折算——「初始攻击」等 0 伤卡
    // 永远击碎 0 心，龙巢战斗根本打不死敌人。改为先用影子目标试算最终伤害
    // （含攻击力/法伤加成与护甲减免），再按上述规则折算心数。
    if (foe.heartsMode) {
      const hpBefore = foe.hp;
      const isTrue = type === Combat.TYPES.TRUE;
      const abreakOn = (foe.status.abreak || 0) > 0;
      let loss;
      if (isTrue) {
        loss = Math.max(0, amt);
      } else {
        const shadow = { id: foe.id, status: Object.assign({}, foe.status),
          defense: JSON.parse(JSON.stringify(foe.defense || { shield: 0, armor: 0, guard: false })) };
        const probe = Combat.dealDamage({ atk: G.atk, spellPower: sp, status: statusForHit }, shadow, amt, type);
        loss = abreakOn ? Math.max(0, probe.dealt) : (probe.dealt >= 8 ? 2 : (probe.dealt >= 1 ? 1 : 0));
      }
      foe.hp -= loss;
      if (loss > 0) floats.push({ unit: foeIdx(foe), text: '-' + loss + '♥', cls: 'dmg', type,
        hpBefore, hpAfter: foe.hp, maxHp: foe.maxHp });
      G.log(`[[icon:play]] <b>${esc(card.name)}</b> → ${esc(foe.name)}：${isTrue || abreakOn ? '真伤/破甲，' : ''}击碎 <b>${loss}</b> 颗心（余 ${Math.max(0, foe.hp)} 心）`, 'sys');
      resolveFoeDefeat(foe);
      return loss;
    }
    const hpBefore = foe.hp;
    const shieldBefore = foe.defense?.shield || 0;
    const r = Combat.dealDamage({ atk: G.atk, spellPower: sp, status: statusForHit }, foe, amt, type);
    if (r.stealthed) {
      SDT.Sound.sfx('parry');
      floats.push({ unit: foeIdx(foe), text: '未命中', cls: 'block' });
      G.log(`[[icon:runner]] ${seg || ''}<b>${esc(foe.name)}</b> 处于<b>潜行</b>中：无法成为被攻击对象！`, 'warn');
      return 0;
    }
    const shieldBreak = shieldBefore > 0 && !(foe.defense?.shield || 0);
    if (r.dealt > 0 || shieldBreak) floats.push({
      unit: foeIdx(foe), text: r.dealt > 0 ? '-' + r.dealt : '护盾破碎',
      cls: r.dealt > 0 ? 'dmg' : 'block', type, shieldBreak,
      ...(r.dealt > 0 ? { hpBefore, hpAfter: foe.hp, maxHp: foe.maxHp } : {}),
    });
    G.log(`[[icon:play]] <b>${esc(card.name)}</b>${seg || ''} → ${esc(foe.name)}：造成 <b>${r.dealt}</b> 点${Combat.TYPE_NAME[type]}` +
      (r.log.length ? `（${r.log.join('，')}）` : ''), 'sys');
    // 造成伤害会破除自己的潜行（不造成伤害便不会破除）
    if (r.dealt > 0 && Combat.breakStealth(pstat)) {
      G.log('[[icon:runner]] 你造成了伤害，<b>潜行</b>被破除', 'dim');
    }
    resolveFoeDefeat(foe);
    return r.dealt;
  }

  function randomDiscoverCard(pred, rarity, otherCls) { return selectionFlow.randomDiscoverCard(pred, rarity, otherCls); }
  function matchHandSelectKey(card, key) { return selectionFlow.matchHandSelectKey(card, key); }
  function processHandSelect() { return selectionFlow.processHandSelect(); }
  function skipHandSelect() { return selectionFlow.skipHandSelect(); }
  function pickHandSelect(uid) { return selectionFlow.pickHandSelect(uid); }
  // 战斗内复原：从消耗堆拿回 n 张到手牌（2026-09-06 #16）
  // —— 受缚之残影（tt8-hero-sealer，2026-09-16 老板定版重做）——
  // 深海封印：对战开始时把本牌与「封印肢体1-4」洗入牌库（BOSS 编组带着才洗；普通战没有
  // 牌库，4 张肢体直接入手）。5 张封印单卡抽到手上无效果、无法打出（battle.rules 按
  // 「无法打出」词条拦截）；手牌集齐 5 张 → 化为「深渊主宰·妲莉薇特」：旧日再临——
  // 抽牌直到手牌 6 张、免疫诅咒、能量上限 +1、法伤 +1、本场法术均已注能；
  // 5 张封印单卡自动消耗，并召唤她的四个衍生物：封印肢体 ×4（4-4）。
  const SEALED_HERO_ID = 'tt8-hero-sealer';
  const SEAL_LIMB_IDS = ['tt8-curseimmune', 'tt8-energycap', 'tt8-nofocus', 'tt8-healplus'];
  const SOVEREIGN_ID = 'tt8-abyss-sovereign';

  function sealCardById(id) { return SDT.Cards.all().find(c => c.id === id) || null; }

  function isSealHeroSelected() {
    return [...sel].some(uid => {
      const o = (G.ownedCards || []).find(x => x.uid === uid);
      return !!(o && o.card && o.card.id === SEALED_HERO_ID);
    });
  }

  function injectSealCards() {
    // 普通战无法使用能力卡（2026-09-16 老板定版）：受缚之残影不会进普通战手牌，封印只在对 BOSS 时发动
    if (mode !== 'boss') return;
    if (!(G.ownedCards || []).some(o => o.card && o.card.id === SEALED_HERO_ID)) return;
    if (!isSealHeroSelected()) return;   // 编组没带受缚之残影：封印不发动
    SEAL_LIMB_IDS.forEach(id => {
      const tpl = sealCardById(id);
      if (!tpl) return;
      const uid = 'bts' + Date.now().toString(36) + ((set$tmpSeq(tmpSeq + 1), tmpSeq - 1));
      granted.push({ uid, card: { ...tpl } });
      drawPile.push(uid);
    });
    set$drawPile(shuffle(drawPile));
    G.log('[[icon:skull]] <b>深海封印</b>：「受缚之残影」与四张「封印肢体」沉入牌库——集齐 5 张封印之牌，破除封印！', 'sys');
  }

  function checkSealTransformation() {
    if (sealDone) return;
    const ids = new Set();
    const sealedInHand = hand.filter(u => {
      const o = findCard(u);
      if (o && o.card && (o.card.id === SEALED_HERO_ID || SEAL_LIMB_IDS.includes(o.card.id))) {
        ids.add(o.card.id);
        return true;
      }
      return false;
    });
    if (!ids.has(SEALED_HERO_ID) || SEAL_LIMB_IDS.some(id => !ids.has(id))) return;
    set$sealDone(true);
    // ① 5 张封印单卡自动消耗（进消耗口袋/墓地，不再可用）
    sealedInHand.forEach(u => {
      const o = findCard(u);
      const i = hand.indexOf(u);
      if (i >= 0) hand.splice(i, 1);
      consumed.push(u);
      if (mode === 'boss') grave.push(u);
      cardAnims.push({ kind: 'burn', uid: u, name: o ? o.card.name : '' });
    });
    G.log('[[icon:flask]] 5 张封印之牌在深海的辉光中燃尽……', 'sys');
    // ② 化为深渊主宰·妲莉薇特（2 费能力卡，由玩家打出引爆「旧日再临」）
    const tpl = sealCardById(SOVEREIGN_ID);
    if (tpl) addTempCard({ ...tpl });
    G.log('[[icon:helmet]] <b>封印破除——化为深渊主宰·妲莉薇特！打出她，旧日再临。</b>', 'ok');
    sweepDead();
  }

  // 玩家侧诅咒统一入口：旧日再临后免疫诅咒（灼烧也是诅咒，2026-09-09 留言口径）
  function addPlayerCurse(key, n) {
    if (playerCurseImmune) {
      // 第十二批（2026-09-23）：邪能护体的本回合临时免疫在场时用中性措辞（深渊主宰的
      // 永久免疫无本条 pending 时维持原口吻；两免疫同场的极端组合按临时措辞展示，仅文案差异）
      const pending = delayed.some(q => q.special === 'curseImmuneOff');
      G.log(pending
        ? `[[icon:shield]] 本回合免疫：诅咒「${Combat.CURSE_META[key] ? Combat.CURSE_META[key].name : key}」被抵抗`
        : `[[icon:shield]] 深渊主宰的威压：诅咒「${Combat.CURSE_META[key] ? Combat.CURSE_META[key].name : key}」被免疫`, 'ok');
      return;
    }
    if (holyRune && turn <= 3) {
      G.log(`[[icon:shield]] 圣洁符文：前 3 回合免疫诅咒（「${Combat.CURSE_META[key] ? Combat.CURSE_META[key].name : key}」被抵抗）`, 'ok');
      return;
    }
    Combat.addCurse(pstat, key, n);
  }

  // —— 龙巢符文开战结算（羁绊 + 符文效果，2026-09-16 Item 定版）——
  function applyNestRunes() {
    set$nestRunes((opts && opts.nest && opts.nest.runes) || []);
    if (!nestRunes.length) return;
    set$nestSyn((SDT.Runes && SDT.Runes.evaluateSlots) ? SDT.Runes.evaluateSlots(nestRunes) : {});
    G.log('[[icon:gem]] <b>研究所符文</b>生效：' + nestRunes.map(r => esc(r.name + '（' + r.attrs.join('') + '）')).join('、'), 'ok');
    nestRunes.forEach(r => {
      if (r.kind === 'attack') Combat.addBlessing(pstat, 'atkUp', 1);
      if (r.kind === 'mana') Combat.addBlessing(pstat, 'spellUp', 1);
      if (r.kind === 'time') set$timeRune(true);
      if (r.kind === 'arrow') set$arrowRune(true);
      if (r.kind === 'unyield') set$unyieldRune(true);
      if (r.kind === 'ash') set$ashRune(true);
      if (r.kind === 'infinite') set$unlimitedRune(true);
      if (r.kind === 'holy') set$holyRune(true);
      if (r.kind === 'shield') set$armorMul(2);
      if (r.kind === 'swift') set$swiftRune(true);
      if (r.kind === 'fireball') set$fireballRuneOn(true);
      if (r.kind === 'spacetime') set$timeSpaceRune(true);
      if (r.kind === 'bleed') foes.forEach(f => { if (!f.dead) Combat.addCurse(f, 'bleed', 1); });
      if (r.kind === 'poison') delayed.push({ text: '对所有敌人附加 1 层中毒', cardName: '中毒符文', repeat: true });
    });
    if (nestSyn.water1) {
      const cc = SDT.Cards.randomClassCard(G.myClass);
      if (cc) { addTempCard({ ...cc }); G.log('[[icon:medal]] <b>水 1</b>：获得 1 张本职业卡牌', 'ok'); }
    }
    if (nestSyn.water3) delayed.push({ text: '发现 1 张本职业卡牌', cardName: '水 3 羁绊', repeat: true });
    if (nestSyn.fire1 || nestSyn.fire3) {
      set$energy(energy + (1));
      G.log('[[icon:fire]] <b>火 1</b>：首回合额外 1 点能量' + (nestSyn.fire3 ? '（火 3 每回合开始也会 +1）' : ''), 'ok');
      if (nestSyn.fire3) delayed.push({ text: '获得 1 点能量', cardName: '火 3 羁绊', repeat: true });
    }
    if (nestSyn.grass1 || nestSyn.grass3) G.log('[[icon:wood]] <b>草' + (nestSyn.grass3 ? 3 : 1) + '</b>：装备栏' + (nestSyn.grass3 ? '无上限' : '上限 +1'), 'ok');
    if (nestSyn.light1 || nestSyn.light3) {
      const n = nestSyn.light3 ? 3 : 1;
      const pool = SDT.Cards.all().filter(c => c.rarity === '传说' && ['武术', '法术'].includes(c.type));
      const picked = [];
      for (let k = 0; k < n && pool.length; k++) {
        const c = pool.splice(Math.floor(Random.random('battle') * pool.length), 1)[0];
        const zero = { ...c, cost: 0 };
        const uid0 = 'bts' + Date.now().toString(36) + ((set$tmpSeq(tmpSeq + 1), tmpSeq - 1));
        granted.push({ uid: uid0, card: zero });
        drawPile.push(uid0);
        picked.push(c.name);
      }
      set$drawPile(shuffle(drawPile));
      if (picked.length) G.log('[[icon:sparkles]] <b>光 ' + n + '</b>：洗入传说招式 ' + picked.join('、') + '（均为 0 费）', 'ok');
    }
    if (nestSyn.dark1 || nestSyn.dark3) G.log('[[icon:skull]] <b>暗' + (nestSyn.dark3 ? 3 : 1) + '</b>：你的伤害' + (nestSyn.dark3 ? '' : '对半血敌人') + ' +1', 'ok');
    if (nestRunes.some(r => r.kind === 'morph')) {
      const forms = SDT.Cards.all().filter(c => /形态/.test(String(c.name || '')) && ['武术', '法术'].includes(c.type));
      const picks = [];
      for (let k = 0; k < 2 && forms.length; k++) picks.push(forms.splice(Math.floor(Random.random('battle') * forms.length), 1)[0]);
      if (picks.length === 2) {
        choiceQueue.push({ cardName: '变身符文', options: picks.map(c => c.desc || c.name) }); processChoice();
        G.log('[[icon:sparkles]] <b>变身符文</b>：从 2 种随机形态中选择 1 张释放', 'sys');
      }
    }
    if (nestRunes.some(r => r.kind === 'holy')) G.log('[[icon:shield]] <b>圣洁符文</b>：前 3 回合免疫诅咒，回合结束 +4 甲', 'ok');
  }

  // 虚空符文：开局抽牌后，复制手牌与牌库中的 0 费招式各 1 张
  function applyVoidRune() {
    if (!nestRunes.some(r => r.kind === 'void')) return;
    let n = 0;
    hand.forEach(u => {
      const o = findCard(u);
      if (o && (o.card.cost || 0) === 0 && ['武术', '法术'].includes(o.card.type)) {
        addTempCard({ ...o.card }); n++;
      }
    });
    drawPile.forEach(u => {
      const o = findCard(u);
      if (o && (o.card.cost || 0) === 0 && ['武术', '法术'].includes(o.card.type)) {
        const uid1 = 'bts' + Date.now().toString(36) + ((set$tmpSeq(tmpSeq + 1), tmpSeq - 1));
        granted.push({ uid: uid1, card: { ...o.card } });
        drawPile.push(uid1);
        n++;
      }
    });
    if (n) G.log('[[icon:skull]] <b>虚空符文</b>：复制了 ' + n + ' 张 0 费招式', 'ok');
  }

  function processChoice() { return selectionFlow.processChoice(); }
  function pickChoice(i) { return selectionFlow.pickChoice(i); }
  function processDiscoverQueue() { return selectionFlow.processDiscoverQueue(); }
  function pickDiscover(i) { return selectionFlow.pickDiscover(i); }
  // 玩家受到一次攻击（含流血加成 / 格挡 / 死亡保险），返回实际伤害
  function playerTakeHit(foe) {
    const playerRef = { hp: G.hp, defense: pdef, status: pstat.status };
    const r = Combat.dealDamage({ atk: foe.atk }, playerRef, 0, Combat.TYPES.ATTACK);
    // 闪避（09-20 老板定版：免疫下一次攻击，非减伤）——演出对齐元素庇幕免伤（parry+浮字）
    if (r.dodged) {
      SDT.Sound.sfx('parry');
      floats.push({ unit: 'self', text: '闪避', cls: 'block' });
      G.log(`[[icon:runner]] <b>闪避！</b><b>${esc(foe.name)}</b> 的攻击被完全避开（剩余 ${Math.max(0, pstat.status.dodge || 0)} 层）`, 'ok');
      return 0;
    }
    // 黑暗吊坠：免疫 1 次致命伤害，并在该回合内无敌（2026-09-09 C11）
    if (r.dealt > 0 && G.hp - r.dealt <= 0 && deathSave > 0) {
      set$deathSave(deathSave - 1);
      Combat.addBlessing(pstat, 'immune', 1);
      G.log(`[[icon:sparkles]] <b>致命一击被挡下！</b>（死亡保险剩余 ${deathSave} 次，本回合无敌）`, 'ok');
      return 0;
    }
    G.hp = Math.max(0, playerRef.hp);
    SDT.Sound.sfx('hurt');
    // 敌方阶段已在命中前等待前摇，受击数字与实际扣血同拍出现。
    floats.push({ unit: 'self', text: '-' + r.dealt, cls: 'hurt' });
    if (r.dealt > 0) floats.push({ unit: 'self', text: '', cls: 'stk stk-late sticker-hurt' });
    G.log(`[[icon:demon]] <b>${esc(foe.name)}</b> 攻击：你受到 <b>${r.dealt}</b> 点攻击伤害（${G.hp}/${G.maxHp}）`, 'warn');
    return r.dealt;
  }

  // 附加 1 层流血或中毒（变异巢母狂乱用）
  function frenzyCurse(foe) {
    const key = Random.random('status') < 0.5 ? 'bleed' : 'poison';
    addPlayerCurse(key, 1, foe);
    SDT.Sound.sfx('curse');
    G.log(`[[icon:bolt]] <b>${esc(foe.name)}</b> 的攻击附加了 <b>1</b> 层${Combat.CURSE_META[key].name}`, 'warn');
  }

  // 附加 1 层随机诅咒（滋生异变体「攻击并施加诅咒」用；灼烧已入池，2026-09-08）
  function elCurse(foe) {
    const keys = ['bleed', 'poison', 'burn'];
    const key = keys[Math.floor(Random.random('status') * keys.length)];
    addPlayerCurse(key, 1, foe);
    SDT.Sound.sfx('curse');
    G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> 的攻击附加了 <b>1</b> 层${Combat.CURSE_META[key].name}`, 'warn');
  }
