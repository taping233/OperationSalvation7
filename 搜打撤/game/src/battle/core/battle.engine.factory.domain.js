import { claimPreparedDiscovery } from '../effects/battle.discover-preview.js';
import { currentCreatureName } from '../../core/creature-identity.js';
import { isStarterAttackIdentity, isStarterAttackTextName, isLegacyCatGift, hasLegacySealUnlock, hasLegacyImitateTransform } from '../../cards/card-legacy-battle-policy.js';
import { createBattleEffectAssembly } from './battle.effect-assembly.domain.js';
import { createSetupMechanics } from './battle.setup-mechanics.domain.js';
import { createDamageDomain } from './battle.damage.domain.js';
import { createCardPlayDomain } from './battle.card-play.domain.js';
import { createBattleTurnContinuation } from './battle.turn-continuation.js';
import { createBattleTurnEffects } from './battle.turn-effects.domain.js';
import { createRequestedDomain } from '../effects/requested-card-runtime.domain.js';
import { createM2Domain } from '../effects/effect-steps.m2.domain.js';
import { buildPouchDiscoverState } from '../effects/battle.discover-state.js';
import { esc, clone as cloneData } from '../../core/shared.js';
import { splitEffectClauses } from '../effects/battle.effects.js';
import { directTriggerSource, hasStructuredTrigger } from '../effects/battle.trigger-source.js';
import { createDeckOperations } from '../bag/battle.deck.factory.js';
import '../bag/battle.piles.js';
import { isAreaEffect } from '../effects/battle.target-rules.js';
import { createBattleExecutionSession } from '../runtime/battle.execution-session.js';
import { createBattleActionRunner } from '../runtime/battle.action-runner.js';
import { actionCancellationError, createStagedPlayback, throwIfActionCancelled } from '../runtime/battle.playback.js';
import {
  BATTLE_PHASES,
} from '../runtime/battle.state.js';
import { createInspectionDomain } from '../effects/battle.card-inspection.domain.js';
import { calculateEnemyIntent } from './battle.enemy-intent.js';
import { createSnapshotProjection } from './battle.snapshot-projection.domain.js';
import { createResolutionDomain } from './battle.resolution.domain.js';
import { createBattlePresentation } from './battle.presentation-events.js';
import { createFoeLifecycleDomain } from './battle.foe-lifecycle.domain.js';
import { createDrawDomain } from './battle.draw.domain.js';
import { createSelectionDomain } from './battle.selection-flow.domain.js';
import { matchesHandSelectKey as matchHandSelectKey } from './battle.hand-selection.js';
import { createEquipmentDomain } from '../bag/battle.equipment.domain.js';
import { createBagDomain } from '../bag/battle.bag.domain.js';
import { readConsumedPile, takeConsumedCard as takeFromConsumedPile } from '../bag/battle.consumed-pile.js';
import { createLifecycleDomain } from './battle.lifecycle.domain.js';
import { createExecPlayDomain } from './battle.exec-play.domain.js';
import { createTriggersDomain } from '../effects/battle.triggers.m2.domain.js';
import { createEquipmentSemanticOperations } from '../effects/equipment-semantic-operations.js';
import { createCardRuleExecution } from '../effects/battle.rule-guard.js';
import { registerBattleValueProvider } from '../../cards/battle-value-context.js';

/** Instance-owned state and host services are captured explicitly. */
export function createEngineDomain(context) {
const instanceRuntime = context.runtime;
const { createBattleDamage } = createDamageDomain(context);
const { createBattleCardPlay } = createCardPlayDomain(context);
const { recordRequestedDamage, requestedPlayerDamaged, requestedTargetReason, resolveRequestedCard, recordPlayerDamageFact } = createRequestedDomain(context);
const { executeTargetReason } = createM2Domain(context);
const { shuffleCards } = createDeckOperations(context.random);
const deferBattlePersistence = context.deferPersist;
const Random = context.random;
const Combat = context.combat;
const emitBattleEvent = context.emitEvent;
const { createBattleCardInspection } = createInspectionDomain(context);
const { createBattleResolution } = createResolutionDomain(context);
const { createBattleFoeLifecycle } = createFoeLifecycleDomain(context);
const { createBattleDraw } = createDrawDomain(context);
const { createBattleSelectionFlow } = createSelectionDomain(context);
const { createBattleEquipment } = createEquipmentDomain(context);
const { recordBattleDamage } = context.summary;
const { createBattleBag } = createBagDomain(context);
const getHostedExecutionCard = context.normalizeCard;
const { createBattleLifecycle } = createLifecycleDomain(context);
const { createBattleExecPlay } = createExecPlayDomain(context);
const { createTriggerRunner } = createTriggersDomain(context);
/** Assemble one engine over the existing runtime. Browser services belong to the caller. */
function createBattleEngine({ cards, readRules, sound, evaluateRunes }) {
  if (!cards || ['all', 'deriveDraw', 'deriveInfuse', 'isRandomObtainable', 'sellPrice', 'randomClassCard'].some(name => typeof cards[name] !== 'function')
      || typeof readRules !== 'function' || typeof sound !== 'function' || typeof evaluateRunes !== 'function') {
    throw new TypeError('Battle engine requires cards, readRules, sound and evaluateRunes ports');
  }
/* battle.engine.js —— 战斗域装配与兼容导出。
 * 出牌/目标/注能由 card-play 用例承接；回合续接、开始任务与敌方伤害各有独立端口模块。
 * 本入口连接 runtime 活绑定、卡牌与音效门面；独立用例不持有第二份战斗状态。
 * 牌效、触发与装备等模块经惰性端口装配，保持执行和取消时序。 */

/* —— 本场执行会话与用例装配 —— */
const executionSession = createBattleExecutionSession();
context.executionSession = executionSession;

const { actionQueue, stagedDeathFx, handSelectQueue, choiceQueue } = executionSession;
const { hasPendingEndTurn, deferEndTurn, awaitTriggeredActions } = createBattleTurnContinuation({
  executionSession,
  readState: () => ({ G: instanceRuntime.G, battleState: instanceRuntime.battleState, infusing: instanceRuntime.infusing, handSelecting: instanceRuntime.handSelecting, choosing: instanceRuntime.choosing, discovering: instanceRuntime.discovering, interaction: instanceRuntime.interaction, discoverQueue: instanceRuntime.discoverQueue }),
  settlePendingSelections, set$battleState: instanceRuntime.set$battleState, set$busy: instanceRuntime.set$busy,
  requestBattleRender: () => requestBattleRender(),
});

function warnCardRuleRejection(message) {
  const battleToken = instanceRuntime.battleState.token;
  instanceRuntime.G.log(message, 'warn');
  // The full escaped rule diagnostic stays in the log; the view gets player copy.
  const reason = message.startsWith('无法打出：规则格式非法') ? '规则格式非法' : '规则尚未支持';
  emitBattleEvent('battle:rule-rejected', { battleToken, message: `无法打出：${reason}` });
}
/* P1-b 09-25 体检批 L 项：渲染请求按 rAF 合帧——同一帧内多次请求只渲染一次，
   语义保持「数据变更后下一帧画面必然最新」：flush 时取 getSnapshot() 的最新状态。
   无 rAF 环境（裸 node 冒烟等）退回同步渲染，保持旧行为。 */
let renderFrameQueued = false;
const flushBattleRender = () => {
    if (!renderFrameQueued) return;      // 动作准备已同步呈现时，旧 rAF 不再重放或复活离开的舞台。
    renderFrameQueued = false;           // 先清排队标志：渲染过程中的新请求可另排下一帧，不丢更新
    if (!instanceRuntime.G || !instanceRuntime.G.battleActive) return;   // 排队期间战斗已收尾：残留重绘一律丢弃（口径同请求时守卫）
    try {
      return instanceRuntime.renderBattle(getSnapshot());
    } catch (e) {
      // 渲染失败不得打断战斗逻辑（否则出牌动作入队前就中断，busy 永久卡死——2026-09-18 实测）
      console.error('[battle] 渲染异常已兜底：', e);
    }
  };
const requestBattleRender = () => {
    if (!instanceRuntime.G || !instanceRuntime.G.battleActive) return;   // 战斗已收尾：残留重绘一律丢弃（胜利结算后不再盖写后续界面）
    if (renderFrameQueued) return;       // 本帧已排队：后续请求并入同一次渲染
    renderFrameQueued = true;
    if (context.scheduleFrame) {
      context.scheduleFrame(flushBattleRender);
    } else {
      flushBattleRender();
    }
  };
const interactionOf = (kind) => (instanceRuntime.interaction && instanceRuntime.interaction.kind === kind ? instanceRuntime.interaction : null);
function cardIdentity(card) {
    if (card && card.id) return `id:${card.id}`;
    return `legacy:${card?.name || ''}|${card?.type || ''}|${card?.desc || ''}`;
  }
const isStarterAttack = isStarterAttackIdentity;
const R = () => readRules();
const alive = () => instanceRuntime.foes.filter(f => !f.dead);
const { aegisBlocked, foeIdx, dealEffectDamage, hitFoe } = createBattleDamage({
  readState: () => ({ G: instanceRuntime.G, foes: instanceRuntime.foes, turn: instanceRuntime.turn, pstat: instanceRuntime.pstat, stealthStrike: instanceRuntime.stealthStrike, equipped: instanceRuntime.equipped, nestSyn: instanceRuntime.nestSyn, floats: instanceRuntime.floats }),
  sound: name => sound(name), alive, recordRequestedDamage,
  resolveFoeDefeat: (...args) => resolveFoeDefeat(...args),
});
const { emitBattlePresentation, emitRecast } = createBattlePresentation({
  readState: () => ({ game: instanceRuntime.G, foes: instanceRuntime.foes, signal: instanceRuntime.activeActionSignal, battleToken: instanceRuntime.battleState.token }),
  emitEvent: event => instanceRuntime.cardAnims.push(event),
});
const cardInspection = createBattleCardInspection({
    cards: cards,
    curseMeta: Combat.CURSE_META,
    readState: () => ({
      game: instanceRuntime.G, granted: instanceRuntime.granted, hand: instanceRuntime.hand, consumed: instanceRuntime.consumed, getConsumedPile, discoverQueue: instanceRuntime.discoverQueue, cardOverrides: instanceRuntime.cardOverrides,
      unlimitedRune: instanceRuntime.unlimitedRune, zeroFeeUntil: instanceRuntime.zeroFeeUntil, turn: instanceRuntime.turn, pstat: instanceRuntime.pstat, spellCost1: instanceRuntime.spellCost1, meleeCost1: instanceRuntime.meleeCost1,
      lastPlayedType: instanceRuntime.lastPlayedType, playedMartialThisTurn: instanceRuntime.playedMartialThisTurn, playedMovesThisTurn: instanceRuntime.playedMovesThisTurn, pdef: instanceRuntime.pdef, shaTransform: instanceRuntime.shaTransform, allSpellsInfused: instanceRuntime.allSpellsInfused,
    }),
  });
const { findCard, findEffectiveCard, infusionFuelReason, drawOf, infuseOf, effCostOf, handCurseSpecs, queueSwapCostDiscover, swapCardCosts } = cardInspection;
/* 治理批次 3：敌方生命周期簇与抽牌/发牌/自动出牌簇迁至 battle.foe-lifecycle.js / battle.draw.js。
 * 此处装配端口；resolveCard/applyTextEffects/triggersM2 为下方晚定义常量，以惰性包装传入。 */
const { resolveFoeDefeat, sweepDead, nestPhase } = createBattleFoeLifecycle({
  alive, foeIdx, finish, executionSession, stagedDeathFx,
  hitFoe: (...args) => hitFoe(...args),
  onFoeDefeated: foe => awardSharedDefeatRewards([foe]),
});
const { drawCards, deckDraw, addTempCard, addDeckCard, grantSha, releaseHandMatches, autoPlayHandType } = createBattleDraw({
  R, alive, findCard, findEffectiveCard, sweepDead,
  applyTextEffects: (...args) => applyTextEffects(...args),
  resolveCard: (...args) => resolveCard(...args),
  fireDrawn: (...args) => triggersM2.fireDrawn(...args),
  fireAcquire: (...args) => triggersM2.fireAcquire(...args),
  checkSealTransformation: (...args) => checkSealTransformation(...args), queueCardExecution, requestBattleRender,
});
const equipmentSemantics = createEquipmentSemanticOperations({ runtime: instanceRuntime, combat: Combat,
  random: (purpose = 'generation') => Random.random('battle', purpose), alive, hitFoe, drawCards });
context.equipmentSemantics = equipmentSemantics;
function intentFor(def, round) {
    return calculateEnemyIntent(def, round, instanceRuntime.pstat && instanceRuntime.pstat.status);
  }
const shuffle = shuffleCards;
const { injectSealCards, checkSealTransformation, applyNestRunes, applyVoidRune } = createSetupMechanics({
  runtime: instanceRuntime, cards, combat: Combat, random: Random, evaluateRunes, esc, shuffle,
  findCard: (...args) => findCard(...args), addTempCard: (...args) => addTempCard(...args),
  sweepDead: (...args) => sweepDead(...args), choiceQueue, processChoice });
  // 玩家自伤/受伤入口（文本路径 dmg.negHp 与结构化 heal.selfDamage 共用；黑暗吊坠死亡保险在此生效）
  // U18（2026-09-30 老板拍板 PENDING #15，对齐 STS2 IsAlive=hp>0）：受伤不再钳 0（hp 可为负）；
  // 伤害致 hp<=0 即时死亡判定——免死钩 deathSave 先拦（一次致死拦一次，逻辑逐字保留），
  // 未获救则走 finish(false) 战败流程（自己回合自伤致死同样触发）；敌方回合既有 finish(false) 路径保留不动。
  function damagePlayer(n) {
    const token = instanceRuntime.battleState.token;
    // 黑暗吊坠死亡保险：致死伤害被挡下，该回合无敌（C11）
    if (n > 0 && instanceRuntime.G.hp - n <= 0 && instanceRuntime.deathSave > 0) {
      instanceRuntime.set$deathSave(instanceRuntime.deathSave - 1);
      Combat.addBlessing(instanceRuntime.pstat, 'immune', 1);
      instanceRuntime.G.log(`[[icon:sparkles]] <b>致命一击被挡下！</b>（死亡保险剩余 ${instanceRuntime.deathSave} 次，本回合无敌）`, 'ok');
      return;
    }
    instanceRuntime.G.hp = instanceRuntime.G.hp - n;
    // 自伤入口的 U18 即死约束保留，致死时不新开治疗反应窗口。
    notifyPlayerDamaged(n, { structured: instanceRuntime.G.hp > 0 });
    if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token) return;
    instanceRuntime.floats.push({ unit: 'self', text: '-' + n, cls: 'hurt' });
    instanceRuntime.G.log(`[[icon:blood]] 受到 <b>${n}</b> 点伤害（${Math.max(0, instanceRuntime.G.hp)}/${instanceRuntime.G.maxHp}）`, 'warn');
    if (n > 0 && instanceRuntime.G.hp <= 0) finish(false);   // U18：即时死亡（死了即死，无治疗复活）
  }
  // 所有实际伤害来源共用宿主；结构化监听保持先于现有装备受伤钩的顺序。
  function notifyPlayerDamaged(amount, { structured = true } = {}) {
    if (!(amount > 0) || !instanceRuntime.G?.battleActive) return;
    const token = instanceRuntime.battleState.token;
    recordPlayerDamageFact(amount);
    if (structured && instanceRuntime.G.hp > 0) triggersM2.fireDamaged();
    if (instanceRuntime.G?.battleActive && instanceRuntime.battleState.token === token) requestedPlayerDamaged(amount, { alive, hitFoe, drawCards });
    if (instanceRuntime.G?.battleActive && instanceRuntime.battleState.token === token && instanceRuntime.G.hp > 0 && instanceRuntime.unyieldRune) {
      const drawn = drawCards(1);
      instanceRuntime.G.log('[[icon:draw-card]] <b>不屈符文</b>：受到伤害，抽 ' + drawn + ' 张牌', 'sys');
    }
  }
const { applyTextEffects, createResolution } = createBattleEffectAssembly({
  runtime: instanceRuntime, cards, combat: Combat, random: Random, executionSession, createBattleResolution, sound,
  commands: {
    recordRequestedDamage: (...args) => recordRequestedDamage(...args),
    alive: (...args) => alive(...args),
    hitFoe: (...args) => hitFoe(...args),
    foeIdx: (...args) => foeIdx(...args),
    dealEffectDamage: (...args) => dealEffectDamage(...args),
    drawCards: (...args) => drawCards(...args),
    grantSha: (...args) => grantSha(...args),
    addTempCard: (...args) => addTempCard(...args),
    queueCardExecution: (...args) => queueCardExecution(...args),
    findCard: (...args) => findCard(...args),
    randomDiscoverCard: (...args) => randomDiscoverCard(...args),
    addDeckCard: (...args) => addDeckCard(...args),
    processHandSelect: (...args) => processHandSelect(...args),
    restoreConsumed: (...args) => restoreConsumed(...args),
    processChoice: (...args) => processChoice(...args),
    shuffle: (...args) => shuffle(...args),
    deckDraw: (...args) => deckDraw(...args),
    flee: (...args) => flee(...args),
    sweepDead: (...args) => sweepDead(...args),
    releaseHandMatches: (...args) => releaseHandMatches(...args),
    autoPlayHandType: (...args) => autoPlayHandType(...args),
    damagePlayer: (...args) => damagePlayer(...args),
    fireConsumeTriggers: (...args) => fireConsumeTriggers(...args),
    replaceShaInDeck: (...args) => replaceShaInDeck(...args),
    summonAlly: (...args) => summonAlly(...args),
    queuePouchCast: (...args) => queuePouchCast(...args),
    tryUnlockSeal: (...args) => tryUnlockSeal(...args),
    checkElementSealProgress: (...args) => checkElementSealProgress(...args),
    fireCatGift: (...args) => fireCatGift(...args),
    handCurseSpecs: (...args) => handCurseSpecs(...args),
    queueSwapCostDiscover: (...args) => queueSwapCostDiscover(...args),
    resolveRequestedCard: (...args) => resolveRequestedCard(...args),
    emitRecast: (...args) => emitRecast(...args),
    getConsumedPile: (...args) => getConsumedPile(...args),
    onHandConsumed: (...args) => onHandConsumed(...args),
    splitClauses: (...args) => splitClauses(...args),
    registerTurnStart: (...args) => registerTurnStart(...args),
    registerBattle: (...args) => registerBattle(...args),
    castRandomSpells: (...args) => castRandomSpells(...args),
    drawOf: (...args) => drawOf(...args),
    isAOE: (...args) => isAOE(...args),
    addPlayerCurse: (...args) => addPlayerCurse(...args),
    resolveBagOperations: (...args) => bag.resolveBagOperations(...args),
    restoreHeroSkill: () => bag.restoreHeroSkill(),
  },
});
const isAOE = isAreaEffect;
const { getSnapshot, snapshotSignature } = createSnapshotProjection({ runtime: instanceRuntime, executionSession, interactionOf,
  battleBagItems, itemUsability, getConsumedPile, R, isBattleStartEquip: card => equipment.isBattleStartEquip(card), equipCap, equipSkillText });
  // 瞄准会话的存活判定专用轻查询（09-30 性能审计 F1 最终形态）：完整快照的组装+签名
  // 每次要付全量遍历，而会话存活只依赖 token/phase 两个标量。同步链内变异必须即时
  // 重投影（battle-snapshot-integration 契约），快照缓存不能做链级复用——热路径改走这里。
  function getBattleLiveness() {
    return { battleToken: instanceRuntime.battleState.token, phase: instanceRuntime.battleState.phase };
  }
const cardPlayFlow = createBattleCardPlay({
  requestedTargetReason, executeTargetReason,
  readState: () => ({ G: instanceRuntime.G, battleState: instanceRuntime.battleState, hand: instanceRuntime.hand, foes: instanceRuntime.foes, mode: instanceRuntime.mode, equipped: instanceRuntime.equipped, busy: instanceRuntime.busy, infusing: instanceRuntime.infusing, discovering: instanceRuntime.discovering,
    choosing: instanceRuntime.choosing, handSelecting: instanceRuntime.handSelecting, viewingGrave: instanceRuntime.viewingGrave, viewingDeck: instanceRuntime.viewingDeck, energy: instanceRuntime.energy, allSpellsInfused: instanceRuntime.allSpellsInfused, freeCast: instanceRuntime.freeCast, interaction: instanceRuntime.interaction }),
  damageTypes: () => cards.DMG_TYPES, sound: name => sound(name),
  alive, findCard, findEffectiveCard, infusionFuelReason, infuseOf, effCostOf, equipCap,
  hasPendingEndTurn, interactionOf, cardIdentity, warnCardRuleRejection, requestBattleRender,
  queueCardExecution,
  executionAvailability: (...args) => execPlayFlow.getExecutionAvailability(...args),
  submitExecution: (...args) => execPlayFlow.submitCardExecution(...args),
  resumeTurnEnd: () => executionSession.resumeTurnEnd(),
  set$interaction: instanceRuntime.set$interaction, set$pendingHint: instanceRuntime.set$pendingHint, set$battleState: instanceRuntime.set$battleState, set$infusing: instanceRuntime.set$infusing, clearTargetHint: instanceRuntime.clearTargetHint, cancelTargetingState: instanceRuntime.cancelTargetingState,
});
const { clearTargetSession, cancelInteraction, beginSpecialTargeting, targetSide, unplayableReason, handUnplayableReason, getCardPlayAvailability, play, submitCardPlay, toggleInfusePick, cancelInfuse, beginInfuse, confirmInfuse } = cardPlayFlow;

// —— 属地模块转发面：装备/战斗背包/入口收尾已拆出，具名导出保持对 core/enemy-phase 兼容 ——
function flee() { return battleLifecycle.flee(); }
function restore(nextGame, data) {
  const result = battleLifecycle.restore(nextGame, data);
  // Existing corpses in a loaded snapshot have already completed their kill event.
  for (const foe of instanceRuntime.foes) if (foe.dead) rewardedDefeats.add(foe);
  return result;
}
function finish(win) { return battleLifecycle.finish(win); }
function start(game, enemyDefs, options) { return battleLifecycle.start(game, enemyDefs, options); }
function toggleDeckCard(uid) { return battleLifecycle.toggleDeckCard(uid); }
function cancelDeckSelection() { return battleLifecycle.cancelDeckSelection(); }
function beginBoss() { return battleLifecycle.beginBoss(); }
function equipSkillText(card) { return equipment.equipSkillText(card); }
  function registerEquip(uid, card) { return equipment.registerEquip(uid, getHostedExecutionCard(card)); }
function equipCap() { return equipment.equipCap(); }
function syncCurseCondEquips() { return equipment.syncCurseCondEquips(); }
function useEquipSkill(uid) { if (!hasPendingEndTurn()) return equipment.useEquipSkill(uid); }
function battleBagItems() { return bag.battleBagItems(); }
const resolvingCards = new Map();
function consumedState() { return { hand: instanceRuntime.hand, drawPile: instanceRuntime.drawPile, played: instanceRuntime.played, consumed: instanceRuntime.consumed, discard: instanceRuntime.discard, grave: instanceRuntime.grave }; }
function resolvingUids() { return [...resolvingCards].filter(([, value]) => value.token === instanceRuntime.battleState.token).map(([uid]) => uid); }
function getConsumedPile() { return readConsumedPile(consumedState(), resolvingUids()); }
function takeConsumedCard(uid) { return takeFromConsumedPile(consumedState(), uid, 'hand', resolvingUids()); }
function markCardResolving(uid, signal, active) {
  if (active) resolvingCards.set(uid, { signal, token: instanceRuntime.battleState.token });
  else if (resolvingCards.get(uid)?.signal === signal) resolvingCards.delete(uid);
}
function restoreConsumed(n) { return bag.restoreConsumed(n); }
function itemUsability(card) { return bag.itemUsability(card); }
function useItem(uid, side) { if (!hasPendingEndTurn()) return bag.useItem(uid, side); }
function bagSlam() { if (!hasPendingEndTurn()) return bag.bagSlam(); }
function beginDartStrike(extra) { return bag.beginDartStrike(extra); }
function resolveDart(side) { return bag.resolveDart(side); }
function resolveSlam(side) { return bag.resolveSlam(side); }
function slamSkill() { return bag.slamSkill(); }   // 2026-10-02 老板：砸击换五职业分化技能，视图读当前口径
function usePotion(uid) { if (!hasPendingEndTurn()) return bag.usePotion(uid); }
function openBag() { return bag.openBag(); }
function closeBag() { return bag.closeBag(); }

  // ---------- 生效时刻 / 持续时间 / 生效条件（设计者 2026-09-02 定版） ----------
  // 卡牌描述按句切分（。；；换行），每句归入一种生效方式：
  //   「回合开始时：X / 下回合开始：X」 → 生效时刻词条：X 延迟到下个回合开始结算
  //     （装备卡是战斗内持续物件，其延迟段每回合开始重复触发；其余一次性）
  //   「本局对战内 / 本场战斗(中)…」   → 持续时间词条：整场战斗有效，离开战斗失效
  //   「被注能时：X」                  → 生效条件词条：只有作为注能牺牲品被消耗时
  //     才结算 X（打出时跳过——牺牲品没有被「使用」，主效果不触发）；未来会有更多条件
  //   其余句子 → 立即生效
  const splitClauses = splitEffectClauses;

  const { registerTurnStart, processDelayed, accrueGrowth, registerBattle } = createBattleTurnEffects({
    throwIfActionCancelled,
    readState: () => ({ G: instanceRuntime.G, battleState: instanceRuntime.battleState, activeActionSignal: instanceRuntime.activeActionSignal, delayed: instanceRuntime.delayed, foes: instanceRuntime.foes, turn: instanceRuntime.turn, cardOverrides: instanceRuntime.cardOverrides,
      hand: instanceRuntime.hand, drawPile: instanceRuntime.drawPile, discard: instanceRuntime.discard, grave: instanceRuntime.grave, growth: instanceRuntime.growth,
      consumed: instanceRuntime.consumed, granted: instanceRuntime.granted, mode: instanceRuntime.mode, cardAnims: instanceRuntime.cardAnims, consumeFireballN: instanceRuntime.consumeFireballN }),
    alive, foeIdx, findCard, findEffectiveCard,
    fireTurnStart: () => { selectionFlow.refreshPreviewCache(); triggersM2.fireTurnStart(); },
    battleBagItems, onHandConsumed, consumeFireballSteps, resolveCardWithFeedback, applyTextEffects, runStagedSteps: (...args) => runStagedSteps(...args),
    set$playerCurseImmune: instanceRuntime.set$playerCurseImmune, set$delayed: instanceRuntime.set$delayed,
    set$meleeCost1: instanceRuntime.set$meleeCost1, set$spellCost1: instanceRuntime.set$spellCost1,
  });

  // 「被注能时」条件效果：作为注能牺牲品被消耗时触发（未被使用，主效果不结算）
  function resolveInfusedFuel(card, target) {
    card = getHostedExecutionCard(card);
    const parts = splitClauses(card.desc);
    if (!parts.onInfused.length) return false;
    parts.onInfused.forEach(text => {
      instanceRuntime.G.log(`[[icon:flask]] <b>被注能时</b>：【${esc(card.name)}】${esc(text)}`, 'sys');
      applyTextEffects(card, text, target, { triggered: true });
    });
    return true;
  }

  // 出牌结算（目标：单点卡 = target；群体卡 = 所有存活敌人；infused = 作为注能主卡打出；
  // fuelCost = 注能牺牲品费用合计，供「N 倍于被注能卡牌价格」类效果折算；uid = 成长/容器定位）
  const resolveCard = createResolution();

  const runStagedSteps = createStagedPlayback({ presentation: context.presentation,
    session: executionSession,
    getBattleToken: () => instanceRuntime.battleState.token,
    getFloats: () => instanceRuntime.floats,
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
          atk: instanceRuntime.G.atk,
          spellPower: instanceRuntime.G.spellPower || 0,   // spellUp 由 status 传入只算一次
          status: instanceRuntime.pstat.status,
        }, t, 4, Combat.TYPES.SPELL);
        recordRequestedDamage(t, r.dealt, { name:'深渊降焰' }, { alive, hitFoe });
        if (r.dealt > 0) instanceRuntime.floats.push({ unit: foeIdx(t), text: '-' + r.dealt,
          cls: 'dmg', hpBefore, hpAfter: t.hp, maxHp: t.maxHp });
        instanceRuntime.G.log(`[[icon:fire]] 深渊降焰：施放 1 次火球 → ${esc(t.name)}：造成 <b>${r.dealt}</b> 点法术伤害`, 'sys');
        sweepDead();
      });
    }
  }
  function resolveCardWithFeedback(card, target, infused, fuelCost, uid, signal = instanceRuntime.activeActionSignal) {
    return runStagedSteps(resolveCard.steps(getHostedExecutionCard(card), target, infused, fuelCost, uid), signal);
  }

  // M2（2026-09-27）：结构化时点触发器 runner（七时点 + 容器级 duration）。
  // ops 执行复用 resolveCard 合成卡全链路（schema/capability 门天然生效）；
  // 登记点：execPlay 打出卡 / registerEquip 穿戴装备；触发点：回合管线/抽牌/受击/击杀/消耗。
  const triggersM2 = createTriggerRunner({
    resolveCard,
    log: (...a) => instanceRuntime.G.log(...a),
    esc,
    getAliveFoes: alive,
    isBattleActive: () => !!instanceRuntime.G?.battleActive && ![BATTLE_PHASES.VICTORY, BATTLE_PHASES.DEFEAT].includes(instanceRuntime.battleState.phase),
    getBattleToken: () => instanceRuntime.battleState.token,
    getActionSignal: () => instanceRuntime.activeActionSignal,
    throwIfCancelled: throwIfActionCancelled,
    hasPlayerCurse: () => Combat.hasCurse(instanceRuntime.pstat),
    addEnergy: amount => { instanceRuntime.set$energy(instanceRuntime.energy + (amount)); return instanceRuntime.energy; },
  });
  // M3：onFreezeDealt 宿主——我方攻击冰冻敌人后（combat.addCurse freeze 钩），装备/登记卡触发
  Combat.COMBAT_HOOKS.onFreeze = target => {
    if (!instanceRuntime.G?.battleActive || !instanceRuntime.foes.includes(target) || target.dead) return;
    triggersM2.fireFreezeDealt(target);
    if (instanceRuntime.G?.battleActive && instanceRuntime.freezeRuneOn) {
      const got = drawCards(2);
      instanceRuntime.G.log('[[icon:status-freeze]] <b>冰冻符文</b>：冰冻 1 名角色，抽 ' + got + ' 张牌', 'ok');
    }
  };

  // 法力奔涌的随机法术释放（2026-09-10 需求）：
  // 池子与「发现/随机获取」同口径（isRandomObtainable：排除 初始/职业/衍生/棱彩与 unrandom），
  // 并排除本牌自身，避免「释放随机法术」抽到自己无限递归。
  // 每发对随机存活敌人以 infused=true 直接结算——随机法术的「注能(N)：…」加成句照常生效，
  // 且无需消耗手牌燃料（＝"默认已注能"）。
  // 慢动作节拍（2026-09-16 留言「法力奔涌应当慢动作打出4张卡牌」）：逐发等待给视图时间
  // 演出每一发；vitest 环境置 0 保持回归测试节奏。动作在 execPlay 内被 await，
  // 演出期间 busy 保持、玩家无法插手。
  const SURGE_WAVE_MS = (typeof process !== 'undefined' && process.env && process.env.VITEST) ? 0 : 850;
  
  const surgeSleep = (ms, signal) => new Promise((/** @type {(value?: void) => void} */ resolve, reject) => {
    throwIfActionCancelled(signal);
    const timer = setTimeout(done, ms);
    function cleanup() { signal?.removeEventListener('abort', cancel); }
    function done() { cleanup(); resolve(); }
    function cancel() { clearTimeout(timer); cleanup(); reject(actionCancellationError(signal)); }
    signal?.addEventListener('abort', cancel, { once: true });
  });
            // 正在进行的奔涌演出（execPlay 在结算后 await 它）
  const takeSurge = async (signal) => {
    const p = instanceRuntime.surgeWaiter;
    instanceRuntime.set$surgeWaiter(null);
    if (p) await p;
    throwIfActionCancelled(signal);
  };
  async function castRandomSpells(n, sourceId, signal = instanceRuntime.activeActionSignal) {
    try {
    const pool = cards.all().filter(c =>
      c.type === '法术' && c.id !== sourceId && cards.isRandomObtainable(c));
    if (!pool.length) {
      instanceRuntime.G.log('[[icon:cross]] <b>法力奔涌</b>：卡牌库中没有可释放的随机法术', 'warn');
      return;
    }
    for (let i = 0; i < n; i++) {
      throwIfActionCancelled(signal);
      sweepDead();
      const targets = alive();
      if (!targets.length) break;   // 敌人全灭则停止余下的释放
      const spell = pool[Math.floor(Random.random('battle', 'generation') * pool.length)];
      const t = targets[Math.floor(Random.random('battle', 'target') * targets.length)];
      instanceRuntime.cardAnims.push({ kind: 'surge', i: i + 1, n, name: spell.name, target: instanceRuntime.foes.indexOf(t), targetName: t.name, card: { ...spell } });   // 慢动作演出事件
      instanceRuntime.G.log(`[[icon:sparkles]] <b>法力奔涌</b>（第 ${i + 1}/${n} 发）：对 <b>${esc(t.name)}</b> 释放随机法术【<b>${esc(spell.name)}</b>】（默认已注能）`, 'loot');
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
    let done = 0;
    const rest = [];
    for (const uid of instanceRuntime.drawPile) {
      const o = findCard(uid);
      const isSha = o && isStarterAttackTextName(o.card);
      if (isSha && done < n) { done++; continue; }
      rest.push(uid);
    }
    instanceRuntime.set$drawPile(rest);
    for (let i = 0; i < done; i++) {
      const pool = cards.all().filter(c => cards.isRandomObtainable(c));
      if (pool.length) addDeckCard(pool[Math.floor(Random.random('battle', 'generation') * pool.length)]);
    }
    return done;
  }
  // 随从优先替玩家承伤、每回合自动攻击；兼容旧版征召规则中的名称。
  function summonAlly(name, atk, hp, n, statless) {
    name = currentCreatureName(name);
    for (let i = 0; i < (n || 1); i++) {
      // statless：无攻击力与血量的场面物件（封印肢体，同天国之门口径）——
      // 不自动攻击、不替主人承伤、不参与hp结算
      instanceRuntime.allies.push({ name, atk: statless ? 0 : atk, hp: statless ? null : hp, maxHp: statless ? null : hp, dead: false, statless: !!statless, status: {}, defense: { shield: 0, armor: 0, guard: false } });
    }
  }
  function poisonRandomFoe() {
    const ts = alive();
    if (!ts.length) return;
    const t = ts[Math.floor(Random.random('battle', 'target') * ts.length)];
    Combat.addCurse(t, 'poison', 1);
    instanceRuntime.G.log(`[[icon:status-poison]] <b>毒杖</b>：${esc(t.name)} 附加 1 层中毒`, 'sys');
  }
  // 阿猫的礼物（tt2-apollo，2026-09-12 实装）：「发现或随机获取该牌时，回复1点能量并获取另1张随机卡牌」
  // 战斗内触发：+1 能量 + 随机卡置入手牌（临时卡）；地图侧触发见 grantEventCard（地图无能量概念，只发额外卡）
  const CAT_GIFT_ID = 'tt2-apollo';
  function fireCatGift(card) {
    if (!isLegacyCatGift(card) || hasStructuredTrigger(card, 'onAcquire') || !instanceRuntime.G?.battleActive) return;
    instanceRuntime.set$energy(instanceRuntime.energy + (1));
    instanceRuntime.G.log(`[[icon:bolt]] <b>阿猫的礼物</b>：回复 1 点能量（当前 ${instanceRuntime.energy}/${instanceRuntime.maxEnergy}）`, 'ok');
    const pool = cards.all().filter(c => cards.isRandomObtainable(c) && c.id !== CAT_GIFT_ID);
    if (!pool.length) return;
    const uid = addTempCard(pool[Math.floor(Random.random('battle', 'generation') * pool.length)]);
    const o = findCard(uid);
    instanceRuntime.G.log(`[[icon:cards]] <b>阿猫的礼物</b>：获得【<b>${esc(o ? o.card.name : '?')}</b>】置入手牌（战斗内临时卡，战后消散）`, 'loot');
  }
  // 「消耗该牌时」触发（Q2 老板定向：注能牺牲与手选消耗都算「消耗」）
  function fireConsumeTriggers(card, target) {
    if (!instanceRuntime.G?.battleActive) return;
    const token = instanceRuntime.battleState.token;
    card = getHostedExecutionCard(card);
    // M3 收编：结构化 triggers.onConsume（或 rules.equip 域卡）单路径——不再回放 desc 消耗句
    const consumeTrigger = directTriggerSource(card, 'onConsume');
    if (consumeTrigger.kind === 'structured') {
      triggersM2.fireConsume(card, target || (alive()[0] || null));
      return;
    }
    for (const text of consumeTrigger.texts) {
      if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token) break;
      instanceRuntime.G.log(`[[icon:flask]] <b>消耗该牌时</b>：【${esc(card.name)}】${esc(text)}`, 'sys');
      applyTextEffects(card, text, target || (alive()[0] || null), { triggered: true });
    }
  }
  async function consumeBattleCard(uid, zone) {
    const pile = instanceRuntime[zone];
    if (!Array.isArray(pile) || !pile.includes(uid)) return false;
    pile.splice(pile.indexOf(uid), 1);
    if (!instanceRuntime.consumed.includes(uid)) instanceRuntime.consumed.push(uid);
    if (!instanceRuntime.grave.includes(uid)) instanceRuntime.grave.push(uid);
    const entry = findCard(uid);
    if (entry) await runStagedSteps(onHandConsumed(entry.card, uid), instanceRuntime.activeActionSignal);
    else if (instanceRuntime.consumeFireballN > 0) await runStagedSteps(consumeFireballSteps(instanceRuntime.consumeFireballN), instanceRuntime.activeActionSignal);
    await awaitTriggeredActions();
    return true;
  }
  // 元素符印「累计注能 3 张后解锁：法伤+2，抽2张」——单点结算，防被动与主动双发
  function tryUnlockSeal(name) {
    if (instanceRuntime.sealUnlocked) { instanceRuntime.G.log(`[[icon:crystal]] 【${esc(name)}】已处于解锁状态（跳过重复结算）`, 'dim'); return; }
    instanceRuntime.set$sealUnlocked(true);
    Combat.addBlessing(instanceRuntime.pstat, 'spellUp', 2);
    const got = drawCards(2);
    instanceRuntime.G.log(`[[icon:crystal]] <b>元素符印解锁</b>：法伤 +2，抽了 ${got} 张牌`, 'ok');
  }
  function checkElementSealProgress() {
    if (equipmentSemantics.checkInfusionUnlock()) return;
    const active = instanceRuntime.equipped.some(entry => hasLegacySealUnlock(entry?.card));
    if (active && instanceRuntime.infuseFuels >= 3 && !instanceRuntime.sealUnlocked) tryUnlockSeal('元素符印');
  }
  // Corpse identities belong to this engine. Reserve before firing reactions so
  // nested damage and an outer card's completion cannot claim the same death twice.
  const rewardedDefeats = new WeakSet();
  function awardSharedDefeatRewards(candidates) {
    if (!instanceRuntime.G?.battleActive) return;
    const fresh = candidates.filter(foe => foe.dead && foe.hp <= 0 && !foe.controlled && !rewardedDefeats.has(foe));
    if (!fresh.length) return;
    fresh.forEach(foe => rewardedDefeats.add(foe));
    const kills = fresh.length;
    const token = instanceRuntime.battleState.token;
    if (instanceRuntime.killAtkUp > 0) {
      Combat.addBlessing(instanceRuntime.pstat, 'atkUp', instanceRuntime.killAtkUp * kills);
      instanceRuntime.G.log(`[[icon:swords]] <b>饮血剑</b>：消灭 ${kills} 个敌人，攻击力 +${instanceRuntime.killAtkUp * kills}（当前加成 ${instanceRuntime.pstat.status.atkUp}）`, 'ok');
    }
    // M2：结构化 triggers.onKill（「击杀时」登记卡）——按实际击杀数逐次触发，且非卡牌来源
    // （砸击/毒杀/随从等 null source）同样计数；此前 null 提前返回 + 单次触发，AOE 双杀只 +1、
    // 非卡击杀完全不触发（09-30 深审 BC-10）
    for (let i = 0; i < kills && instanceRuntime.G?.battleActive && instanceRuntime.battleState.token === token; i++) triggersM2.fireKill();
  }
  // Card-specific riders keep their own source count. The scan also adopts
  // completed legacy text kills that set dead directly instead of sweeping HP.
  function applyKillRewards(card, kills) {
    if (kills <= 0 || !instanceRuntime.G?.battleActive) return;
    const token = instanceRuntime.battleState.token;
    awardSharedDefeatRewards(instanceRuntime.foes);
    if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token) return;
    if (!card) return;
    const d = String(card.desc || '');
    const armorM = d.match(/击杀(?:敌人)?(?:时|则)?[^。；]*?\+\s*(\d+)\s*甲/);
    if (armorM) {
      instanceRuntime.pdef.armor += +armorM[1] * kills;
      instanceRuntime.G.log(`[[icon:plate]] <b>${esc(card.name)}</b>：击杀敌人，+${+armorM[1] * kills} 甲（当前 ${instanceRuntime.pdef.armor}）`, 'ok');
    }
    const coinM = d.match(/若击杀敌人[，,]?\s*\+\s*(\d+)\s*币/);
    if (coinM) {
      instanceRuntime.G.coins = (instanceRuntime.G.coins || 0) + +coinM[1] * kills;
      instanceRuntime.G.log(`[[icon:coin]] <b>${esc(card.name)}</b>：击杀敌人，+${+coinM[1] * kills} 币`, 'loot');
    }
  }
  function* onHandConsumed(card, uid = undefined) {
    void uid; // Compatibility hook receives the source UID even when this implementation does not inspect it.
    if (!card) return;
    fireConsumeTriggers(card, alive()[0] || null);
    if (instanceRuntime.consumeFireballN > 0) yield* consumeFireballSteps(instanceRuntime.consumeFireballN);
  }
  // 法师锦囊容器（Q5 老板定向）：自带 1×3 空间——打出时选 1 张直接施放
  let pouchDiscoverRound = 0;
  function queuePouchCast(uid, executionCard = null) {
    const entry = findCard(uid);
    if (!entry) return;
    // 2026-09-16 定版：锦囊里的法术由玩家在背包中提前存入（pouchOf 标记）。
    // 09-29 老板拍板双向同步：每次打出都按背包 pouchOf 现状重建镜像（不再仅空时一次性载入）；
    // 战斗中施放会删背包母本（discover-flow），战斗中背包变动（拆包/用道具）也反映到下次施放。
    if (!Array.isArray(entry.card._pouch)) entry.card._pouch = [];
    entry.card._pouch = (instanceRuntime.G.ownedCards || [])
      .filter(o => o.pouchOf === 'tt7-stratagem' && o.card && o.card.type === '法术')
      .map(o => ({ ...o.card, pouchUid: o.uid }));
    if (entry.card._pouch.length) {
      instanceRuntime.G.log(`[[icon:spell-pouch]] <b>法师锦囊</b>：从背包 pouch 载入 ${entry.card._pouch.length} 张法术`, 'sys');
      const prepared = claimPreparedDiscovery(executionCard || entry.card, { n: 1, act: 'pouch', pouchUid: uid });
      if ('fixedOptions' in prepared && prepared.fixedOptions) {
        // Selection is committed at the source action's normal queue drain,
        // after last-hand checks and play triggers, matching ordinary discoveries.
        instanceRuntime.discoverQueue.push(prepared);
      } else {
        instanceRuntime.set$discovering({ ...buildPouchDiscoverState(entry.card._pouch.slice(), uid), roundId: `pouch-${++pouchDiscoverRound}`, canCancel: true, cancelLabel: '结束发现', sourceCommit: 'committed' });
      }
      requestBattleRender();
    } else {
      entry.card._pouch.length = 0;
      instanceRuntime.G.log('[[icon:spell-pouch]] 锦囊是空的——背包中存入法术后才能生效', 'dim');
    }
  }
  // 不变应万变（Q8 老板定向）：「在手牌中时，本牌变为打出的上一张武术牌的1费复制」——
  // 战斗内替身（findCard 优先读 overrides），不污染背包原卡；战斗结束随 reset 清空
  function applyImitate(playedMartial) {
    if (!playedMartial) return;
    instanceRuntime.hand.forEach(h => {
      const o = findCard(h);
      const original = instanceRuntime.G.ownedCards.find(entry => entry.uid === h)?.card || instanceRuntime.granted.find(entry => entry.uid === h)?.card || o?.card;
      const transform = original?.rules?.battle?.handTransform;
      const mimic = transform ? transform.afterType === playedMartial.type
        : hasLegacyImitateTransform(original, hasStructuredTrigger(original, 'onPlay'));
      if (o && mimic) {
        instanceRuntime.cardOverrides.set(h, { ...playedMartial, cost: transform?.cost ?? 1 });
        instanceRuntime.G.log(`[[icon:recycle]] <b>${esc(o.card.name)}</b>：变为【${esc(playedMartial.name)}】的 1 费复制`, 'sys');
      }
    });
  }

  // 出牌稳定点节流落盘：全量 JSON.stringify + 同步 localStorage 写在 Defender
  // 实时扫描下可能到几十 ms，逐次写会造成出牌后的掉帧尖刺。回合开始仍无条件
  // 落盘，窗口内闪退最多回退数秒内的出牌（正常关窗走 beforeunload 全量保存）。
  
  // 出牌结算和新回合共用同一交互队列入口；各选择器保留自己的防重守卫。
  function settlePendingSelections() {
    if (!instanceRuntime.G?.battleActive) return;
    processHandSelect();
    processChoice();
    processDiscoverQueue();
    executionSession.resumeTurnEnd();
  }

  function recoverBattleFailure(error, action) {
      const game = instanceRuntime.G;
      const checkpoint = instanceRuntime.battleRestartCheckpoint && cloneData(instanceRuntime.battleRestartCheckpoint);
      game.battleActionFailure = { ...action, message: String(error?.message || error), recovery: checkpoint ? 'battle-start' : 'reload-required' };
      if (checkpoint) restore(game, checkpoint);
      else { executionSession.reset('action failed without checkpoint'); instanceRuntime.set$busy(true); }
      const message = checkpoint ? '本次动作结算失败，已恢复到本场战斗开始处；本场费用、受伤和消耗已撤销。' : '本次动作结算失败，请退出后读取上一检查点。';
      game.log(`[[icon:cross]] ${message}`, 'warn');
      emitBattleEvent('battle:rule-rejected', { battleToken: instanceRuntime.battleState.token, message });
      requestBattleRender();
  }

  const queueBattleAction = createBattleActionRunner({
    deferPersist: deferBattlePersistence,
    session: executionSession,
    getBattleState: () => instanceRuntime.battleState,
    setBattleState: instanceRuntime.set$battleState,
    getGame: () => instanceRuntime.G,
    setBusy: instanceRuntime.set$busy,
    getActiveActionSignal: () => instanceRuntime.activeActionSignal,
    setActiveActionSignal: instanceRuntime.set$activeActionSignal,
    getLastPersistAt: () => instanceRuntime.lastPersistAt,
    setLastPersistAt: instanceRuntime.set$lastPersistAt,
    render: requestBattleRender,
    preparePresentation: () => { renderFrameQueued = false; return instanceRuntime.renderBattle(getSnapshot()); },
    actionCancellationError,
    throwIfActionCancelled,
    onIdle: settlePendingSelections,
    onFailure: recoverBattleFailure,
  });
  const equipment = createBattleEquipment({
    cards,
    resolveCardSteps: (card, target) => resolveCard.steps(card, target, false, 0, 'equip-skill'),
    requestBattleRender, clearTargetSession, queueBattleAction, runStagedSteps,
    applyTextEffects, sweepDead, alive, finish, throwIfActionCancelled,
    processChoice, processDiscoverQueue, processHandSelect, randomDiscoverCard,
    addTempCard, fireCatGift, handSelectQueue,
    // M2：结构化装备域（onEquip/battleStart/passive/skill ops）经 triggers runner 的合成卡执行
    triggersM2,
  });
  const bag = createBattleBag({
    resolveCardSteps: (/** @type {Parameters<typeof resolveCard.steps>} */ ...args) => resolveCard.steps(...args),
    requestBattleRender, clearTargetSession, cancelInteraction, beginSpecialTargeting, interactionOf,
    queueBattleAction, runStagedSteps, singleTargetHitSteps, applyTextEffects, hitFoe,
    sweepDead, finish, alive, addTempCard, addDeckCard, fireCatGift, applyKillRewards,
    throwIfActionCancelled, findCard, triggersM2,
    addEnergy: amount => { instanceRuntime.set$energy(instanceRuntime.energy + (amount)); return instanceRuntime.energy; },
    drawCards, queueDiscover: value => instanceRuntime.discoverQueue.push(value), getTurn: () => instanceRuntime.turn,
    // BC-09（09-30 深审）：通行证类道具战斗内使用——发现面板立即消费 + 传说/职业池直授
    processDiscoverQueue, randomDiscoverCard, getConsumedPile, takeConsumedCard, markCardResolving,
    previewDiscovery: (...args) => selectionFlow.previewDiscovery(...args),
  });
  const battleLifecycle = createBattleLifecycle({
    session: executionSession, intentFor, cloneData, injectSealCards, applyNestRunes, applyVoidRune,
    drawCards, applyBattleStartPassives: equipment.applyBattleStartPassives,
    isBattleStartEquip: equipment.isBattleStartEquip, equipCap, isStarterAttack,
    requestBattleRender, alive, R, emitBattlePresentation,
    // M2：战斗开始/重开时清空触发器登记（旧战卡对象不得跨战斗泄漏）
    resetTriggers: () => { triggersM2.reset(); selectionFlow.refreshPreviewCache(true); },
    runBattleStartTriggers: () => triggersM2.fireBattleStart(),
  });
  const selectionFlow = createBattleSelectionFlow({
    stepsForOperations: (card, operations, target) => resolveCard.steps(createCardRuleExecution(card, operations), target, false, 0, 'choice'),
    cards: {
      all: () => cards.all(),
      isRandomObtainable: card => cards.isRandomObtainable(card),
      sellPrice: card => cards.sellPrice(card),
    },
    deny: () => sound('deny'),
    random01: (purpose = 'generation') => Random.random('battle', purpose),
    throwIfActionCancelled,
    session: executionSession,
    requestBattleRender, findCard, addTempCard, addDeckCard,
    shuffleDeck: () => instanceRuntime.set$drawPile(shuffle(instanceRuntime.drawPile)), queueBattleAction,
    runStagedSteps, applyTextEffects, queueCardExecution, fireConsumeTriggers,
    fireCatGift, swapCardCosts, sweepDead, finish,
  });

  // —— 出牌结算长流程（queueCardExecution + execPlay）已拆出 battle.exec-play.js：工厂注入 + 一行转发 shim（具名导出面不变）——
  const execPlayFlow = createBattleExecPlay({
    emitRecast,
    markCardResolving,
    warnCardRuleRejection,
    requestBattleRender, findCard, findEffectiveCard, infusionFuelReason, fireConsumeTriggers, effCostOf,
    prepareExecutionCard: (uid, card) => findEffectiveCard(uid, card, getHostedExecutionCard)?.card || getHostedExecutionCard(card),
    resolveInfusedFuel, runStagedSteps, consumeFireballSteps, resolveCardWithFeedback,
    takeSurge, registerEquip, summonAlly, applyKillRewards, poisonRandomFoe, applyImitate, checkElementSealProgress,
    beginDartStrike, sweepDead, finish, processChoice, processDiscoverQueue, queueBattleAction,
    // M2：打出卡登记 triggers + onPlayCard 触发
    triggersM2, previewDiscovery: (...args) => selectionFlow.previewDiscovery(...args),
  });
  function queueCardExecution(uid, card, fuelUids, target, freeCost, requirementsPaid = false, paymentUids = [], onResolved = null, submission = null, directRelease = false) {
    return execPlayFlow.queueCardExecution(uid, card, fuelUids, target, freeCost, requirementsPaid, paymentUids, onResolved, submission, directRelease);
  }

  // M2：onTurnEnd 触发转发（enemy-phase 回合结束管线调用；triggersM2 为模块闭包件）
  function fireTurnEndTriggers() { triggersM2.fireTurnEnd(); }

  function randomDiscoverCard(pred, rarity, otherCls) { return selectionFlow.randomDiscoverCard(pred, rarity, otherCls); }
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
  // 玩家侧诅咒统一入口：旧日再临后免疫诅咒
  function addPlayerCurse(key, n, source = undefined) {
    void source; // Preserve the combat source argument at compatibility ports.
    if (instanceRuntime.playerCurseImmune) {
      // 第十二批（2026-09-23）：邪能护体的本回合临时免疫在场时用中性措辞（深渊主宰的
      // 永久免疫无本条 pending 时维持原口吻；两免疫同场的极端组合按临时措辞展示，仅文案差异）
      const pending = instanceRuntime.delayed.some(q => q.special === 'curseImmuneOff');
      instanceRuntime.G.log(pending
        ? `[[icon:shield]] 本回合免疫：诅咒「${Combat.CURSE_META[key] ? Combat.CURSE_META[key].name : key}」被抵抗`
        : `[[icon:shield]] 深渊主宰的威压：诅咒「${Combat.CURSE_META[key] ? Combat.CURSE_META[key].name : key}」被免疫`, 'ok');
      return 0;
    }
    if (instanceRuntime.holyRune && instanceRuntime.turn <= 3) {
      instanceRuntime.G.log(`[[icon:shield]] 圣洁符文：前 3 回合免疫诅咒（「${Combat.CURSE_META[key] ? Combat.CURSE_META[key].name : key}」被抵抗）`, 'ok');
      return 0;
    }
    return Combat.addCurse(instanceRuntime.pstat, key, n);
  }

  function processChoice() { return selectionFlow.processChoice(); }
  function pickChoice(i) { return selectionFlow.pickChoice(i); }
  function processDiscoverQueue() { return selectionFlow.processDiscoverQueue(); }
  function pickDiscover(i) { return selectionFlow.pickDiscover(i); }
  function cancelDiscover(roundId) { return selectionFlow.cancelDiscover(roundId); }
  // 玩家受到一次攻击（含流血加成 / 格挡 / 死亡保险），返回实际伤害
  function playerTakeHit(foe) {
    const playerRef = { hp: instanceRuntime.G.hp, defense: instanceRuntime.pdef, status: instanceRuntime.pstat.status };
    const r = Combat.dealDamage({ atk: foe.atk }, playerRef, 0, Combat.TYPES.ATTACK);
    // 闪避（09-20 老板定版：免疫下一次攻击，非减伤）——演出对齐元素庇幕免伤（parry+浮字）
    if (r.dodged) {
      sound('parry');
      instanceRuntime.floats.push({ unit: 'self', text: '闪避', cls: 'block' });
      instanceRuntime.G.log(`[[icon:status-dodge]] <b>闪避！</b><b>${esc(foe.name)}</b> 的攻击被完全避开（剩余 ${Math.max(0, instanceRuntime.pstat.status.dodge || 0)} 层）`, 'ok');
      return 0;
    }
    // 黑暗吊坠：免疫 1 次致命伤害，并在该回合内无敌（2026-09-09 C11）
    if (r.dealt > 0 && instanceRuntime.G.hp - r.dealt <= 0 && instanceRuntime.deathSave > 0) {
      instanceRuntime.set$deathSave(instanceRuntime.deathSave - 1);
      Combat.addBlessing(instanceRuntime.pstat, 'immune', 1);
      instanceRuntime.G.log(`[[icon:sparkles]] <b>致命一击被挡下！</b>（死亡保险剩余 ${instanceRuntime.deathSave} 次，本回合无敌）`, 'ok');
      return 0;
    }
    // U18：去钳位，负血保留真实值；死亡判定由敌方回合既有 G.hp<=0 检查收口（finish(false) 路径保留不动）。
    // dealDamage 内部把 target.hp 钳 0 并把超出量记入 r.overkill（combat.js 属地不动）——此处还原真实负血。
    instanceRuntime.G.hp = playerRef.hp - (r.overkill || 0);
    recordBattleDamage(foe.name, r.dealt, instanceRuntime.turn);
    sound(r.dealt > 0 ? 'hurt' : 'parry');
    // 敌方阶段已在命中前等待前摇，受击数字与实际扣血同拍出现。
    instanceRuntime.floats.push({ unit: 'self', text: r.dealt > 0 ? '-' + r.dealt : r.immune ? '免疫' : '防御', cls: r.dealt > 0 ? 'hurt' : 'block' });
    if (r.dealt > 0) instanceRuntime.floats.push({ unit: 'self', text: '', cls: 'stk stk-late sticker-hurt' });
    instanceRuntime.G.log(`[[icon:demon]] <b>${esc(foe.name)}</b> 攻击：你受到 <b>${r.dealt}</b> 点攻击伤害（${Math.max(0, instanceRuntime.G.hp)}/${instanceRuntime.G.maxHp}）`, 'warn');
    // M2：结构化 onDamaged 触发（登记卡「受到伤害时」）
    notifyPlayerDamaged(r.dealt);
    return r.dealt;
  }

  // 附加 1 层流血或中毒（变异巢母狂乱用）
  function frenzyCurse(foe) {
    const key = Random.random('status', 'generation') < 0.5 ? 'bleed' : 'poison';
    addPlayerCurse(key, 1, foe);
    sound('curse');
    instanceRuntime.G.log(`[[icon:bolt]] <b>${esc(foe.name)}</b> 的攻击附加了 <b>1</b> 层${Combat.CURSE_META[key].name}`, 'warn');
  }

  // 附加 1 层随机诅咒（滋生异变体「攻击并施加诅咒」用）
  function elCurse(foe) {
    const keys = ['bleed', 'poison'];
    const key = keys[Math.floor(Random.random('status', 'generation') * keys.length)];
    addPlayerCurse(key, 1, foe);
    sound('curse');
    instanceRuntime.G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> 的攻击附加了 <b>1</b> 层${Combat.CURSE_META[key].name}`, 'warn');
  }

  // 反馈#11（2026-10-21）：战斗内卡牌描述数值按当前实际加成计算。
  // 引擎装配即注册；battleActive=false 时提供器返回 active:false，
  // displayCardDescription 自动回落静态文案（地图/图鉴/文档生成不受影响）。
  registerBattleValueProvider(() => {
    const status = instanceRuntime.pstat && instanceRuntime.pstat.status;
    return {
      active: !!instanceRuntime.G && !!instanceRuntime.G.battleActive,
      atk: (Number(instanceRuntime.G && instanceRuntime.G.atk) || 0) + (Number(status && status.atkUp) || 0),
      spellPower: (Number(instanceRuntime.G && instanceRuntime.G.spellPower) || 0) + (Number(status && status.spellUp) || 0),
    };
  });

  return Object.freeze({
    getCardPlayAvailability, submitCardPlay, awaitTriggeredActions, emitBattlePresentation, emitRecast, settlePendingSelections, requestBattleRender, interactionOf, cloneData, cardIdentity, R, alive, intentFor, drawCards, resolveFoeDefeat, sweepDead, nestPhase, grantSha, findCard, findEffectiveCard, infusionFuelReason, infuseOf, effCostOf, swapCardCosts, restore, finish, cancelInteraction, flee, handCurseSpecs, getSnapshot, snapshotSignature, getBattleLiveness, processDelayed, accrueGrowth, resolveCard, resolveCardWithFeedback, syncCurseCondEquips, useEquipSkill, applyKillRewards, start, fireTurnEndTriggers, addTempCard, fireConsumeTriggers, toggleDeckCard, cancelDeckSelection, beginBoss, targetSide, unplayableReason, handUnplayableReason, play, toggleInfusePick, cancelInfuse, beginInfuse, confirmInfuse, queueCardExecution, aegisBlocked, foeIdx, hitFoe, matchHandSelectKey, skipHandSelect, pickHandSelect, useItem, bagSlam, resolveDart, resolveSlam, slamSkill, addPlayerCurse, usePotion, openBag, closeBag, pickChoice, pickDiscover, cancelDiscover, playerTakeHit, notifyPlayerDamaged, frenzyCurse, elCurse, deferEndTurn, hasPendingEndTurn,
    dealEffectDamage, consumeBattleCard, recoverBattleFailure, getTriggerSnapshot: () => triggersM2.snapshot(),
    canReconfigure: () => !instanceRuntime.G?.battleActive && !actionQueue.running && !actionQueue.length && !executionSession.stagedResolutionDepth,
  });
}
return { createBattleEngine };
}
