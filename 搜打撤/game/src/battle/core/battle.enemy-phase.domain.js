import { createRequestedDomain } from '../effects/requested-card-runtime.domain.js';
import { esc } from '../../core/shared.js';
import { BATTLE_PHASES } from '../runtime/battle.state.js';
import { buildEnemyActionPlan, findEnemyAttackGuard } from './battle.enemy-plan.js';
import { createM2Domain } from '../effects/effect-steps.m2.domain.js';
import { dealMeasuredDamage } from './battle.measured-damage.js';
import { applyBossTurnStart, cleanseBlockerAfterAttack } from './battle.boss-mechanics.js';

/** Instance-owned state and host services are captured explicitly. */
export function createEnemyPhaseDomain(context) {
const instanceRuntime = context.runtime;
const hostAudio = context.audio;
const cardCatalog = context.cards;
const { recordRequestedDamage } = createRequestedDomain(context);
const Random = context.random;
const Combat = context.combat;
const { waitForFeedback, waitMs } = context.presentation;
const { demoMs } = context.presentation;
const { recordBattleDamage } = context.summary;
const { restoreAtkDown, restoreStolenAttack } = createM2Domain(context);
/* battle.enemy-phase.js —— 敌方阶段与回合结束（2026-09-22 六文件重构批6-C 自 battle.core.js 拆出，原行 2480-2797）。
 * 逐字搬迁（flee 因被引擎侧 finish 环调随迁 engine）；状态经 battle.runtime.js；禁 import 壳。 */

  // 敌方步进演出节拍在 vitest 环境归零（比照 battle.engine.js 的 SURGE_WAVE_MS 先例）：
  // 回归测试的等待辅助用固定次数 setTimeout(0) tick 当预算，其真实间隔平台相关
  // （Windows ≈15.6ms / Linux ≈1ms），跨不过 420ms×N 的真实节拍会导致 CI 确定性红。
  // 仅测速环境生效；运行时 demoMs 照常逐次求值（2× 档倍率不受影响）。
  const ENEMY_STEP_ZERO = (typeof process !== 'undefined' && process.env && process.env.VITEST);

  // ---------- 回合结束 ----------
  function endTurn() {
    if (context.track) context.track('turnMoves', { n: instanceRuntime.playedMovesThisTurn });
    if (instanceRuntime.busy || instanceRuntime.infusing || instanceRuntime.discovering || instanceRuntime.choosing || instanceRuntime.handSelecting || context.engine.hasPendingEndTurn()) return;
    if (instanceRuntime.battleState.phase === BATTLE_PHASES.VICTORY || instanceRuntime.battleState.phase === BATTLE_PHASES.DEFEAT) return;   // 终局后点击无效（2026-09-16 实测 defeat 后连点报错）
    if (instanceRuntime.interaction && instanceRuntime.interaction.kind !== 'card') instanceRuntime.set$interaction(null);   // 结束回合取消药水点选/砸击（卡牌指向在转入敌方阶段时清）
    // 批次C：指向性卡牌的 targeting 阶段若还挂着（直接释放未选目标 / 拖到死目标），
    // 必须先清掉——否则 targeting→enemy 是非法迁移，endTurn 直接抛错卡死。
    // 这里硬清槽位、不走 cancelInteraction：freeCast 簿记保留（「直接释放」卡跨回合仍免费）
    if (instanceRuntime.battleState.phase === BATTLE_PHASES.TARGETING) {
      instanceRuntime.clearTargetHint();
      instanceRuntime.cancelTargetingState();
    }
    instanceRuntime.set$busy(true);
    // —— 额外回合（命运钟表 C7）：跳过敌方阶段，直接刷新为你的下一个回合 ——
    if (instanceRuntime.extraTurn) {
      const extraTurnToken = instanceRuntime.battleState.token;
      void resolveExtraTurn(extraTurnToken).catch(error => recoverAutoPhaseError(error, extraTurnToken, BATTLE_PHASES.PLAYER));
      return;
    }
    if (instanceRuntime.swiftRune && instanceRuntime.hand.length) {
      const u0 = instanceRuntime.hand[0];
      const o = context.engine.findEffectiveCard(u0);
      if (o && !context.engine.unplayableReason(o.card) && context.engine.effCostOf(o.card, u0) <= instanceRuntime.energy) {
        instanceRuntime.G.log('[[icon:bolt]] <b>极速符文</b>：回合结束，打出最左侧的手牌', 'sys');
        // 打出及其后续选牌/抉择/发现完成后才移交敌方阶段；不能在首张牌收尾时跨过弹层。
        const endTurnToken = instanceRuntime.battleState.token;
        const queued = context.engine.queueCardExecution(u0, o.card, [], context.engine.alive()[0] || null, false, false, [], () => context.engine.deferEndTurn(() => {
          if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== endTurnToken ||
              instanceRuntime.battleState.phase === BATTLE_PHASES.VICTORY || instanceRuntime.battleState.phase === BATTLE_PHASES.DEFEAT) return;
          instanceRuntime.transitionTo(BATTLE_PHASES.ENEMY);
          context.engine.emitBattlePresentation({ kind: 'enemy-turn-start', turn: instanceRuntime.turn });
          instanceRuntime.set$busy(true);
          instanceRuntime.clearTargetHint();
          const enemyToken = instanceRuntime.battleState.token;
          const stillEnemyPhase = () => instanceRuntime.G?.battleActive && instanceRuntime.battleState.token === enemyToken && instanceRuntime.battleState.phase === BATTLE_PHASES.ENEMY;
          void resolvePlayerEndTurn(enemyToken, stillEnemyPhase).catch(error => recoverAutoPhaseError(error, enemyToken, BATTLE_PHASES.ENEMY));
        }));
        context.engine.requestBattleRender();
        // 出牌预检拒绝且没有支付弹层时，照常结束回合，不留下 busy 锁。
        if (queued !== false || instanceRuntime.handSelecting) return;
      }
    }
    instanceRuntime.transitionTo(BATTLE_PHASES.ENEMY);
    context.engine.emitBattlePresentation({ kind: 'enemy-turn-start', turn: instanceRuntime.turn });
    instanceRuntime.clearTargetHint();
    const enemyToken = instanceRuntime.battleState.token;
    const stillEnemyPhase = () => instanceRuntime.G?.battleActive && instanceRuntime.battleState.token === enemyToken && instanceRuntime.battleState.phase === BATTLE_PHASES.ENEMY;
    void resolvePlayerEndTurn(enemyToken, stillEnemyPhase).catch(error => recoverAutoPhaseError(error, enemyToken, BATTLE_PHASES.ENEMY));
  }

  function recoverAutoPhaseError(error, token, phase) {
    if (!instanceRuntime.G?.battleActive || instanceRuntime.battleState.token !== token || instanceRuntime.battleState.phase !== phase || phase === BATTLE_PHASES.VICTORY || phase === BATTLE_PHASES.DEFEAT) return;
    if (error?.name === 'BattleActionCancelledError' || error?.name === 'AbortError') return;
    console.error('Battle turn auto-effect sequence failed; restoring checkpoint.', error);
    context.engine.recoverBattleFailure(error, { label: '回合自动效果', battleToken: token });
  }

  async function resolveExtraTurn(extraTurnToken) {
    const stillPlayerPhase = () => instanceRuntime.G?.battleActive && instanceRuntime.battleState.token === extraTurnToken && instanceRuntime.battleState.phase === BATTLE_PHASES.PLAYER;
    instanceRuntime.set$extraTurn(false);
    context.engine.fireTurnEndTriggers();
    await context.engine.awaitTriggeredActions(BATTLE_PHASES.PLAYER);
    if (!stillPlayerPhase()) return;
    if (instanceRuntime.G.hp <= 0) { context.engine.finish(false); return; }
    context.engine.sweepDead();
    if (!stillPlayerPhase()) return;
    if (!context.engine.alive().length) { context.engine.finish(true); return; }
    instanceRuntime.set$turn(instanceRuntime.turn + 1);
    applyBossTurnStart(context);
    instanceRuntime.pdef.guard = false;   // 格挡只覆盖施放当回合，额外回合同样到期。
    instanceRuntime.foes.forEach(foe => { if (!foe.dead) foe.intent = context.engine.intentFor(foe, instanceRuntime.turn); });
    instanceRuntime.set$energy(instanceRuntime.maxEnergy);
    // 额外回合=新回合：打出计数清零（对齐 afterEnemies 新回合口径，追斩/连续射击按本回合计）；
    // 回合成长同步累积（老板 2026-09-29 拍板：额外回合吃回合成长——充能火球等「回合开始时本牌伤害+1」照常 +1）
    instanceRuntime.set$playedMartialThisTurn(0);
    instanceRuntime.set$playedMovesThisTurn(0);
    context.engine.accrueGrowth();
    if ((instanceRuntime.pstat.status.natureForm || 0) > 0) instanceRuntime.set$energy(instanceRuntime.energy + 1);
    if ((instanceRuntime.pstat.status.swordForm || 0) > 0) {
      const got = context.engine.drawCards(1); instanceRuntime.G.log(`[[icon:sword]] <b>剑仙形态</b>：额外抽了 ${got} 张牌`, 'ok');
    }
    await runTurnStartRunes(stillPlayerPhase);
    if (!stillPlayerPhase()) return;
    try {
      await context.engine.processDelayed();
    } catch (error) {
      if (!stillPlayerPhase()) return;
      throw error;
    }
    if (!stillPlayerPhase()) return;
    if (instanceRuntime.G.hp <= 0) { context.engine.finish(false); return; }
    context.engine.sweepDead();
    if (!stillPlayerPhase()) return;
    if (!context.engine.alive().length) { context.engine.finish(true); return; }
    // 与普通回合一致：先兑现开始时点，再消费禁抽标记与常规抽牌。
    if (instanceRuntime.noDrawNext) { instanceRuntime.set$noDrawNext(false); instanceRuntime.G.log('[[icon:cross]] <b>下回合无法抽牌</b>生效：本回合开始不抽牌', 'warn'); }
    else if (instanceRuntime.mode === 'boss') context.engine.drawCards(context.engine.R().battleTurnDraw);
    await context.engine.awaitTriggeredActions(BATTLE_PHASES.PLAYER);
    if (!stillPlayerPhase()) return;
    context.engine.emitBattlePresentation({ kind: 'extra-turn-start', turn: instanceRuntime.turn });
    instanceRuntime.G.log(`[[icon:hourglass]] <b>额外回合</b>：敌人被钉在原地，你再次行动！（第 ${instanceRuntime.turn} 回合）`, 'ok');
    instanceRuntime.transitionTo(BATTLE_PHASES.PLAYER);
    instanceRuntime.set$busy(false);
    context.engine.settlePendingSelections();
    context.engine.requestBattleRender();
  }

  async function runTurnStartRunes(stillCurrent) {
    // —— 龙巢：远古龙尊阶段检定 / 时空符文 / 火球符文 ——
    instanceRuntime.foes.forEach(f => { if (!f.dead && f.phases) context.engine.nestPhase(f); });
    instanceRuntime.foes.forEach(f => {
      // 只重掷活着的轮换免疫单位（写反会让免疫永不生效、尸体反被赋键）
      if (f.dead || !f.rotateImmune) return;
      const keys = ['bleed', 'poison', 'silence', 'abreak', 'healban'];   // 09-29 老板拍板：冰冻除外（与 lifecycle 注释对齐，原含 freeze）
      const picked = [];
      while (picked.length < 2) {
        const k = keys[Math.floor(Random.random('battle', 'enemy') * keys.length)];
        if (!picked.includes(k)) picked.push(k);
      }
      f.noCurseKeys = picked;
      instanceRuntime.G.log(`[[icon:shield]] <b>${esc(f.name)}</b> 切换免疫：${picked.join('、')}`, 'warn');
    });
    if (instanceRuntime.timeSpaceRune && !instanceRuntime.timeSpaceUsed && instanceRuntime.drawPile.length === 0) {
      instanceRuntime.set$timeSpaceUsed(true);
      instanceRuntime.set$extraTurn(true);
      instanceRuntime.G.log('[[icon:hourglass]] <b>时空符文</b>：牌库已空——额外回合！（本局限一次）', 'ok');
    }
    if (instanceRuntime.fireballRuneOn && instanceRuntime.drawPile.length) {
      const bottom = instanceRuntime.drawPile[0];
      const o = context.engine.findCard(bottom);
      await context.engine.consumeBattleCard(bottom, 'drawPile');
      if (!stillCurrent()) return;
      instanceRuntime.G.log(`[[icon:fire]] <b>火球符文</b>：消耗牌库底的【${esc(o ? o.card.name : '?')}】`, 'sys');
      const fbPool = cardCatalog.all().filter(c => String(c.name || '').includes('火球') && c.type === '法术');
      if (fbPool.length) {
        const fb = fbPool[Math.floor(Random.random('battle', 'enemy') * fbPool.length)];
        const target = context.engine.alive()[0] || null;
        if (target) {
          instanceRuntime.cardAnims.push({ kind: 'surge', i: 1, n: 1, sourceName: '火球符文', name: fb.name, target: instanceRuntime.foes.indexOf(target), targetName: target.name, card: { ...fb } });
          instanceRuntime.G.log(`[[icon:fire]] <b>火球符文</b>：随机释放【${esc(fb.name)}】→ <b>${esc(target.name)}</b>`, 'loot');
        }
        try {
          await context.engine.resolveCardWithFeedback(fb, target, false, 0, null);
        } catch (error) {
          if (!stillCurrent()) return;
          throw error;
        }
        if (!stillCurrent()) return;
      }
      if (!await awaitBattleFeedback(stillCurrent)) return;
    }
    if (!stillCurrent()) return;
  }

  async function awaitBattleFeedback(stillEnemyPhase) {
    context.engine.requestBattleRender();
    await waitForFeedback();
    await context.engine.awaitTriggeredActions();
    return stillEnemyPhase();
  }

  async function resolvePlayerEndTurn(enemyToken, stillEnemyPhase) {
    // —— 玩家回合结束：中毒结算 ——
    // U18：去钳位，负血保留真实值——tickPoison 内部把 hp 钳 0 并把超出量记入
    // r.overkill（combat.js 属地不动），此处逐次还原；死亡仍由下方既有 hp<=0 检查收口。
    const pref = { hp: instanceRuntime.G.hp, defense: instanceRuntime.pdef, status: instanceRuntime.pstat.status };
    // 时光符文：回合结束效果触发 2 次（中毒结算双倍）
    const tickPasses = instanceRuntime.timeRune ? 2 : 1;
    for (let pass = 0; pass < tickPasses; pass++) {
      pref.hp = instanceRuntime.G.hp; // A reactive cast may heal or damage the player between poison ticks.
      const p1 = Combat.tickPoison(pref);
      if (p1?.dealt > 0) {
        recordBattleDamage('中毒', p1.dealt, instanceRuntime.turn);
        instanceRuntime.G.hp = pref.hp - (p1.overkill || 0);
        context.engine.notifyPlayerDamaged(p1.dealt);
        instanceRuntime.floats.push({ unit: 'self', text: '-' + p1.dealt, cls: 'hurt' });
        instanceRuntime.G.log(`[[icon:skull]] 中毒结算：你受到 <b>${p1.dealt}</b> 点固定伤害（${Math.max(0, instanceRuntime.G.hp)}/${instanceRuntime.G.maxHp}）`, 'warn');
        if (!await awaitBattleFeedback(stillEnemyPhase)) return;
      }
    }
    // 计时状态不在玩家阶段递减——共享回合钟统一在每回合结束（afterEnemies 末尾）递减
    // G.hp was committed per tick; never overwrite reactive healing with the old proxy.
    context.engine.requestBattleRender();
    if (instanceRuntime.G.hp <= 0) { instanceRuntime.set$busy(false); context.engine.finish(false); return; }
    // —— 随从自动攻击（Q4 老板定向：步兵等为你自动战斗；无攻血场面物件不参与）——
    for (const a of instanceRuntime.allies.filter(a => !a.dead && !a.statless)) {
      if (!Combat.canAct(a)) {
        instanceRuntime.G.log(`[[icon:crystal]] <b>${esc(a.name)}</b> 被冰冻，无法行动`, 'sys');
        continue;
      }
      const beforeHit = context.engine.alive().length;
      const t = context.engine.alive()[0];
      if (!t) break;
      const r = context.engine.dealEffectDamage({ caster: a, target: t, amount: 0, type: Combat.TYPES.ATTACK, card: { name:a.name }, source: 'ally' });
      if (r.dealt > 0) Combat.breakStealth(a);
      context.engine.sweepDead();
      context.engine.applyKillRewards(null, beforeHit - context.engine.alive().length);
      if (r.dealt > 0) instanceRuntime.floats.push({ unit: context.engine.foeIdx(t), text: '-' + r.dealt, cls: 'dmg' });
      instanceRuntime.G.log(`[[icon:swords]] <b>${esc(a.name)}</b> 自动攻击 ${esc(t.name)}：造成 <b>${r.dealt}</b> 点攻击伤害`, 'sys');
      if (!await awaitBattleFeedback(stillEnemyPhase)) return;
    }
    if (!stillEnemyPhase()) return;
    context.engine.sweepDead();
    if (!stillEnemyPhase()) return;
    if (!context.engine.alive().length) { instanceRuntime.set$busy(false); context.engine.finish(true); return; }
    // —— 敌人回合：逐个行动 ——
    const acting = context.engine.alive();
    let i = 0;
    const scheduleStep = delay => {
      const next = () => {
        if (!stillEnemyPhase()) return;
        void step().catch(error => recoverAutoPhaseError(error, enemyToken, BATTLE_PHASES.ENEMY));
      };
      if (ENEMY_STEP_ZERO) { setTimeout(next, 0); return; }
      void waitMs(delay).then(next).catch(error => recoverAutoPhaseError(error, enemyToken, BATTLE_PHASES.ENEMY));
    };
    const step = async () => {
      if (!stillEnemyPhase()) return;
      if (instanceRuntime.G.hp <= 0) { instanceRuntime.set$busy(false); context.engine.finish(false); return; }
      if (i >= acting.length) { await afterEnemies(enemyToken); return; }
      const foe = acting[i++];
      const plan = buildEnemyActionPlan(foe, instanceRuntime.turn);
      if (plan.skip === 'dead') return step();
      if (plan.skip === 'stunned') {
        foe.stunned = false;
        instanceRuntime.G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 蓄力完毕，下回合行动`, 'sys');
        return step();
      }
      if (plan.skip === 'oddRound') {
        instanceRuntime.G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 蓄力（偶数回合才会攻击）`, 'sys');
        return step();
      }
      if (plan.skip === 'firstRound') {
        instanceRuntime.G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 第一回合蓄力，不会攻击`, 'sys');
        return step();
      }
      if (plan.skip === 'frozen') {
        instanceRuntime.G.log(`[[icon:crystal]] <b>${esc(foe.name)}</b> 被冰冻，无法行动！`, 'sys');
      } else {
        const hits = plan.hits;
        for (let h = 0; h < hits && instanceRuntime.G.hp > 0 && Combat.canAct(foe); h++) {
          // 潜行：无法成为被攻击对象（冰冻/潜行的敌人在自己行动后照常递减计时）
          if (Combat.isStealthed(instanceRuntime.pstat)) {
            instanceRuntime.G.log(`[[icon:runner]] 你在<b>潜行</b>中，<b>${esc(foe.name)}</b> 无法将你作为攻击对象`, 'sys');
            break;
          }
          instanceRuntime.floats.push({ unit: instanceRuntime.foes.indexOf(foe), text: '', cls: 'lungefx' });
          context.engine.requestBattleRender();
          await waitForFeedback();
          await context.engine.awaitTriggeredActions();
          if (!stillEnemyPhase()) return;
          await waitMs(demoMs(130));
          if (!stillEnemyPhase()) return;
          if (foe.dead || !Combat.canAct(foe) || instanceRuntime.G.hp <= 0) break;
          // 随从优先替主人承受伤害（Q4 老板定向：步兵「优先为主人承受伤害」；无攻血物件除外）
          const guard = findEnemyAttackGuard(instanceRuntime.allies);
          if (guard) {
            const shieldBefore = guard.defense?.shield || 0;
            const ar = dealMeasuredDamage(Combat, { atk: foe.atk }, guard, 0, Combat.TYPES.ATTACK);
            const cleansed = cleanseBlockerAfterAttack(foe, Combat, Random, restoreAtkDown);
            if (cleansed) instanceRuntime.G.log(`[[icon:skull]] <b>${esc(foe.name)}</b>攻击后清除 1 层${cleansed}`, 'sys');
            if (shieldBefore > 0 && !(guard.defense?.shield || 0)) hostAudio.sfx('shieldBreak');
            hostAudio.sfx(ar.dealt > 0 ? 'hurt' : 'parry');
            instanceRuntime.floats.push({ unit: 'ally:' + instanceRuntime.allies.indexOf(guard), text: ar.dealt > 0 ? '-' + ar.dealt : ar.immune ? '免疫' : ar.dodged ? '闪避' : '防御', cls: ar.dealt > 0 ? 'hurt' : 'block' });
            instanceRuntime.G.log(`[[icon:runner]] <b>${esc(guard.name)}</b> 替你承受了 <b>${ar.dealt}</b> 点攻击伤害（${Math.max(0, guard.hp)}/${guard.maxHp}）`, 'sys');
            if (guard.hp <= 0 && !guard.dead) {
              guard.dead = true;
              instanceRuntime.G.log(`[[icon:skull]] <b>${esc(guard.name)}</b> 阵亡`, 'warn');
            }
            context.engine.requestBattleRender();
            await waitForFeedback();
            await context.engine.awaitTriggeredActions();
            if (!stillEnemyPhase()) return;
            continue;
          }
          const shieldBefore = instanceRuntime.pdef.shield || 0;
          const dealt = context.engine.playerTakeHit(foe);
          const cleansed = cleanseBlockerAfterAttack(foe, Combat, Random, restoreAtkDown);
          if (cleansed) instanceRuntime.G.log(`[[icon:skull]] <b>${esc(foe.name)}</b>攻击后清除 1 层${cleansed}`, 'sys');
          if (shieldBefore > 0 && !(instanceRuntime.pdef.shield || 0)) hostAudio.sfx('shieldBreak');
          // 敌人造成伤害也会破除它自己的潜行
          if (dealt > 0 && Combat.breakStealth(foe)) {
            instanceRuntime.G.log(`[[icon:runner]] <b>${esc(foe.name)}</b> 发动了攻击，<b>潜行</b>被破除`, 'dim');
          }
          if (dealt > 0 && foe.affix === 'frenzy') context.engine.frenzyCurse(foe);
          // 龙巢：黑暗使者攻击后消耗对方 1 张手牌；远古龙尊按阶段附加诅咒/回血
          if (dealt > 0 && foe.handConsume && instanceRuntime.hand.length) {
            const vi = Math.floor(Random.random('battle', 'enemy') * instanceRuntime.hand.length);
            const vu = instanceRuntime.hand.splice(vi, 1)[0];
            const vo = context.engine.findCard(vu);
            instanceRuntime.consumed.push(vu);
            instanceRuntime.grave.push(vu);
            instanceRuntime.G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> 消耗了你手牌中的【${esc(vo ? vo.card.name : '?')}】`, 'warn');
            if (vo) context.engine.fireConsumeTriggers(vo.card, null);   // 09-29 老板拍板：被敌方消耗也算「消耗该牌时」
          }
          if (dealt > 0 && foe.phases) {
            const ph = foe.phase || 1;
            if (ph === 1) {
              const keys = ['bleed', 'poison', 'silence', 'abreak', 'healban'];
              hostAudio.sfx('danger');
              context.engine.addPlayerCurse(keys[Math.floor(Random.random('battle', 'enemy') * keys.length)], 1, foe);
              instanceRuntime.G.log('[[icon:fire]] 远古龙尊的吐息附加了一层随机诅咒（冰冻除外）', 'warn');
            } else if (ph === 2) {
              foe.hp = Math.min(foe.maxHp, foe.hp + 10);
              instanceRuntime.G.log('[[icon:fire]] 远古龙尊回复了 10 点生命', 'warn');
            }
          }
          // 行为型附加：囊生畸变体（攻击并施加诅咒）
          if (dealt > 0 && foe.behavior === 'curse') {
            context.engine.elCurse(foe);
          }
          context.engine.requestBattleRender();
          await waitForFeedback();
          await context.engine.awaitTriggeredActions();
          if (!stillEnemyPhase()) return;
        }
      }
      context.engine.requestBattleRender();
      if (instanceRuntime.G.hp <= 0) { instanceRuntime.set$busy(false); context.engine.finish(false); return; }
      scheduleStep(ENEMY_STEP_ZERO ? 0 : demoMs(420));   // 敌方步进：2× 档经 demoMs 单一倍率缩放（battle.pace.js）；vitest 归零（见文件头 ENEMY_STEP_ZERO）
    };
    scheduleStep(ENEMY_STEP_ZERO ? 0 : demoMs(420));
  }

  async function afterEnemies(enemyToken = instanceRuntime.battleState.token) {
    const stillEnemyPhase = () => instanceRuntime.G?.battleActive && instanceRuntime.battleState.token === enemyToken && instanceRuntime.battleState.phase === BATTLE_PHASES.ENEMY;
    if (!stillEnemyPhase()) return;
    const aliveBeforeTick = context.engine.alive().length;
    if (instanceRuntime.holyRune && instanceRuntime.turn <= 3) {
      const n = instanceRuntime.timeRune ? 8 : 4;   // 时光符文：回合结束效果触发 2 次
      instanceRuntime.pdef.armor += n;
      hostAudio.sfx('shieldUp');
      instanceRuntime.G.log('[[icon:shield]] <b>圣洁符文</b>：回合结束获得 ' + n + ' 点护甲（' + instanceRuntime.pdef.armor + '）', 'sys');
    }
    // —— 敌人回合结束：中毒结算 + 词缀 ——
    for (const foe of instanceRuntime.foes) {
      if (foe.dead) continue;
      const tickPasses = instanceRuntime.timeRune ? 2 : 1;   // 时光符文：回合结束效果触发 2 次
      for (let tp = 0; tp < tickPasses; tp++) {
        const er = Combat.tickPoison(foe);
        if (er?.dealt > 0) {
          recordRequestedDamage(foe, er.dealt, { name:'中毒' }, { alive: context.engine.alive, hitFoe: context.engine.hitFoe });
          instanceRuntime.floats.push({ unit: instanceRuntime.foes.indexOf(foe), text: '-' + er.dealt, cls: 'dmg', tintKey: 'poison' });
          instanceRuntime.G.log(`[[icon:skull]] 中毒结算：<b>${esc(foe.name)}</b> 受到 <b>${er.dealt}</b> 点固定伤害（${Math.max(0, foe.hp)}/${foe.maxHp}）${instanceRuntime.timeRune ? '（时光×2）' : ''}`, 'sys');
        }
        if (context.engine.resolveFoeDefeat(foe, '毒发倒地')) hostAudio.sfx('kill');
        if (er?.dealt > 0 && !await awaitBattleFeedback(stillEnemyPhase)) return;
        if (foe.dead) break;
      }
    }
    if (!stillEnemyPhase()) return;
    context.engine.applyKillRewards(null, aliveBeforeTick - context.engine.alive().length);   // 毒杀计入饮血剑击杀层数
    if (!stillEnemyPhase()) return;
    if (!context.engine.alive().length) { instanceRuntime.set$busy(false); context.engine.finish(true); return; }
    // 军威（封控指挥官）：回合结束时攻击力 +2
    instanceRuntime.foes.forEach(foe => {
      if (!foe.dead && foe.affix === 'grow') {
        foe.atk += 2;
        instanceRuntime.G.log(`[[icon:arrow]] <b>军威</b>：<b>${esc(foe.name)}</b> 攻击力增至 <b>${foe.atk}</b>`, 'warn');
      }
    });
    for (const ally of instanceRuntime.allies.filter(a => !a.dead && !a.statless)) {
      for (let pass = 0; pass < (instanceRuntime.timeRune ? 2 : 1) && ally.hp > 0; pass++) {
        const result = Combat.tickPoison(ally);
        if (result?.dealt > 0) {
          instanceRuntime.floats.push({ unit: 'ally:' + instanceRuntime.allies.indexOf(ally), text: '-' + result.dealt, cls: 'hurt', tintKey: 'poison' });
          instanceRuntime.G.log(`[[icon:skull]] 中毒结算：<b>${esc(ally.name)}</b> 受到 ${result.dealt} 点固定伤害`, 'warn');
          if (!await awaitBattleFeedback(stillEnemyPhase)) return;
        }
      }
      if (ally.hp <= 0) { ally.dead = true; instanceRuntime.G.log(`[[icon:skull]] <b>${esc(ally.name)}</b> 毒发阵亡`, 'warn'); }
    }
    // —— 共享回合钟：所有计时状态在本回合结束统一递减 1 ——
    // 持续 1 回合 = 本回合结束前生效；持续 n 回合 = 从触发当回合起覆盖 n 个完整回合
    if (instanceRuntime.timeRune) instanceRuntime.G.log('[[icon:hourglass]] <b>时光符文</b>：你的增益状态在时光中凝固（不递减）', 'sys');
    tickDurationsLog(instanceRuntime.pstat, '你', instanceRuntime.timeRune);
    instanceRuntime.foes.forEach(foe => { if (!foe.dead) tickDurationsLog(foe, foe.name); });
    // 时光符文只保留玩家祝福；活随从沿共享回合钟到期。
    instanceRuntime.allies.forEach(ally => { if (!ally.dead && !ally.statless) tickDurationsLog(ally, ally.name); });
    // Each theft expires independently; dead foes release every remaining entry.
    // The shared helper also reads the aggregate fields from older snapshots.
    const attackRestorationUnits = [...instanceRuntime.foes, ...instanceRuntime.allies.filter(ally => !ally.statless)];
    attackRestorationUnits.forEach(foe => {
      const amount = restoreStolenAttack(foe, instanceRuntime.turn);
      if (amount) instanceRuntime.G.log(`[[icon:arrow]] <b>${esc(foe.name)}</b> 的攻击力恢复 ${amount} 点（现 ${foe.atk}）`, foe.dead ? 'dim' : 'sys');
    });
    // M2：atkDown（攻击降低诅咒）到期归还——tickDurations 计时归零后按扣减量还原
    attackRestorationUnits.forEach(foe => { restoreAtkDown(foe); });
    // M2：结构化 onTurnEnd 触发（登记卡「回合结束时」）
    context.engine.fireTurnEndTriggers();
    if (!await awaitBattleFeedback(stillEnemyPhase)) return;
    if (instanceRuntime.G.hp <= 0) { context.engine.finish(false); return; }
    context.engine.sweepDead();
    if (!stillEnemyPhase()) return;
    if (!context.engine.alive().length) { context.engine.finish(true); return; }
    context.engine.syncCurseCondEquips();   // 条件装备（深海印记类）随诅咒状态变化重新核算
    instanceRuntime.set$turn(instanceRuntime.turn + 1);
    applyBossTurnStart(context);
    instanceRuntime.pdef.guard = false;   // 敌方本回合所有伤害结算后，在新玩家回合清除。
    instanceRuntime.foes.forEach(foe => { if (!foe.dead) foe.intent = context.engine.intentFor(foe, instanceRuntime.turn); });
    instanceRuntime.set$energy(instanceRuntime.maxEnergy);
    instanceRuntime.set$playedMartialThisTurn(0);   // 追斩/连续射击：本回合打出计数随新回合清零
    instanceRuntime.set$playedMovesThisTurn(0);
    context.engine.accrueGrowth();   // 充能火球等「回合开始时本牌伤害+1」按 uid 成长
    // —— 新回合开始：玩家形态祝福 ——
    if ((instanceRuntime.pstat.status.natureForm || 0) > 0) {
      instanceRuntime.set$energy(instanceRuntime.energy + 1);
      instanceRuntime.G.log(`[[icon:wood]] <b>满月形态</b>：额外获得 1 点能量（当前 ${instanceRuntime.energy}/${instanceRuntime.maxEnergy}）`, 'ok');
    }
    if ((instanceRuntime.pstat.status.swordForm || 0) > 0) {
      const got = context.engine.drawCards(1);
      instanceRuntime.G.log(`[[icon:sword]] <b>剑仙形态</b>：额外抽了 ${got} 张牌`, 'ok');
    }
    await runTurnStartRunes(stillEnemyPhase);
    if (!stillEnemyPhase()) return;
    if (instanceRuntime.G.hp <= 0) { context.engine.finish(false); return; }
    context.engine.sweepDead();
    if (!stillEnemyPhase()) return;
    if (!context.engine.alive().length) { context.engine.finish(true); return; }
    // —— 新回合开始：「回合开始时」延迟段结算 ——
    try {
      await context.engine.processDelayed();
    } catch (error) {
      if (!stillEnemyPhase()) return;
      throw error;
    }
    if (!stillEnemyPhase()) return;
    if (instanceRuntime.G.hp <= 0) { context.engine.finish(false); return; }
    context.engine.sweepDead();
    if (!stillEnemyPhase()) return;
    if (!context.engine.alive().length) { context.engine.finish(true); return; }
    // —— 常规抽牌（「下回合无法抽牌」标记在本回合开始消耗掉） ——
    if (instanceRuntime.noDrawNext) {
      instanceRuntime.set$noDrawNext(false);
      instanceRuntime.G.log('[[icon:cross]] <b>下回合无法抽牌</b>生效：本回合开始不抽牌', 'warn');
    } else if (instanceRuntime.mode === 'boss') {
      context.engine.drawCards(context.engine.R().battleTurnDraw);
    }
    await context.engine.awaitTriggeredActions();
    if (!stillEnemyPhase()) return;
    // 敌人回合结束必须转回玩家阶段：此前 phase 卡在 enemy，
    // 视图的 data-phase="enemy" 规则（手牌下沉/禁点）会吞掉之后每个玩家回合
    instanceRuntime.transitionTo(BATTLE_PHASES.PLAYER);
    context.engine.emitBattlePresentation({ kind: 'player-turn-start', turn: instanceRuntime.turn });
    instanceRuntime.set$busy(false);
    context.engine.settlePendingSelections();
    if (instanceRuntime.G.persistSave && instanceRuntime.G.battleActive) { instanceRuntime.set$lastPersistAt(performance.now()); await instanceRuntime.G.persistSave(); }   // 回合开始落盘（无条件，同步节流时钟）
    if (typeof hostAudio?.setBattlePressure === 'function') {
      const hpRatio = instanceRuntime.G.maxHp > 0 ? instanceRuntime.G.hp / instanceRuntime.G.maxHp : 1;
      hostAudio.setBattlePressure(Math.max(0, Math.min(1, 1 - hpRatio)));
    }
    context.engine.requestBattleRender();
  }

  function tickDurationsLog(target, who, preserveBlessings = false) {
    const meta = (k) => Combat.CURSE_META[k] || Combat.BUFF_META[k];
    const expired = Combat.tickDurations(target, { preserveBlessings });
    expired.forEach(k => instanceRuntime.G.log(`[[icon:sparkles]] ${esc(who)} 的<b>${meta(k).name}</b>效果结束了`, 'dim'));
    if (expired.some(k => Combat.BUFF_META[k])) hostAudio.sfx('buffDown');   // 增益到期=轻碎裂提示（音频 P2#6，与挂上音成对）
    if (expired.some(k => Combat.CURSE_META[k])) hostAudio.sfx('curseEnd');
  }

  // 主动撤离（2026-09-09 玩法定版）：战斗中的「撤退」一律视为本局失败——
  // 仅烟雾弹的逃跑（fleeBattle → flee）豁免。走战败结算（安全格抢运、对局结束）。
  function surrender() {
    if (instanceRuntime.busy || instanceRuntime.infusing || instanceRuntime.discovering || instanceRuntime.choosing || instanceRuntime.handSelecting) return;
    instanceRuntime.G.surrenderedRun = true;
    hostAudio.sfx('flee');
    instanceRuntime.G.log('[[icon:cross]] 你选择了撤离——<b>本局视为失败</b>，安全格中的卡牌将被抢运回基地', 'warn');
    context.engine.finish(false);
  }
return { endTurn, surrender };
}
