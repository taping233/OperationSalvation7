import { registeredExecutionPlan, triggerExecutionPlan } from '../../cards/card-execution-plan.js';
import { createCardRuleExecution } from './battle.rule-guard.js';

/** Instance-owned state and host services are captured explicitly. */
export function createTriggersDomain(context) {
const instanceRuntime = context.runtime;

/* ============================================================
 * battle.triggers.m2.js —— 结构化时点触发器 runner（M2，2026-09-27）
 *
 * 承接 rules.triggers 的时点容器与容器级 duration（持续 N 次）。
 * 登记型时点与直调时点读取 card-trigger-contract，获取/抽到/消耗不登记。
 *
 * 设计（对齐文本路径既有宿主）：
 *   - 打出卡 / 穿戴装备时 registerCard 登记（exec-play / battle.equipment.js 挂点）；
 *   - 抽到（onDraw）与消耗（onConsume）不依赖登记——事件发生时对当事卡直接结算；
 *   - ops 执行 = 合成卡（desc 清空、triggers.onPlay 替换）走既有 resolveCard 全链路，
 *     schema/capability 门天然复用；
 *   - 容器级 duration = 每次触发扣 1，归零移除该卡登记（花瓣法阵「持续 3 回合」）。
 * ============================================================ */

function createTriggerRunner({
  resolveCard, log, esc, getAliveFoes, addEnergy,
  isBattleActive = () => true, getBattleToken = () => null,
  getActionSignal = () => null, throwIfCancelled = () => {}, hasPlayerCurse = () => false,
}) {
  /** uid -> { card, points, left }；points: 时点名 -> ops 数组；left: duration 剩余次数 */
  const registry = new Map();

  function isCurrent(token) {
    throwIfCancelled(getActionSignal());
    return isBattleActive() && getBattleToken() === token;
  }

  function resolveOps(card, ops, target, point) {
    const token = getBattleToken();
    if (!Array.isArray(ops) || !ops.length || !isCurrent(token)) return;
    // pick:'new' 段在此上下文已完成点选（runner 执行=点选后），剥除 pick 键避免 resolver 二次跳过
    const resolvedOps = ops.map(op => {
      if (!op || op.pick === undefined) return op;
      const clone = { ...op };
      delete clone.pick;
      return clone;
    });
    try {
      const synthetic = createCardRuleExecution(card, resolvedOps);
      if (point === 'onKill') synthetic._triggerPoint = point;
      const selected = target && !target.dead && !(target.hp <= 0) ? target : getAliveFoes()[0] ?? null;
      resolveCard(synthetic, selected, false, 0, 'm2-trigger');
    } catch (error) {
      if (error?.name === 'BattleActionCancelledError' || getActionSignal()?.aborted) throw error;
      log(`[[icon:cross]] 触发效果结算失败：${esc(String(error && error.message || error))}`, 'warn');
    }
  }

  /** 打出卡 / 穿戴装备时登记。battleStarted=true 时 onBattleStart 立即补发（战斗中穿戴口径）。 */
  function registerCard(card, uid, { battleStarted = false } = {}) {
    const token = getBattleToken();
    if (!isCurrent(token)) return false;
    const { points, left } = registeredExecutionPlan(card);
    if (!points.size) return false;
    const entry = { card, points, left, uid, executing: new Set() };
    registry.set(uid, entry);
    if (points.has('onTurnStart')) log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】持续效果已登记`, 'sys');
    if (points.has('onBattleStart') && battleStarted) {
      fireEntry(entry, 'onBattleStart');
    }
    return true;
  }

  function consumeUse(entry) {
    if (entry.left !== null) {
      entry.left -= 1;
      if (entry.left <= 0 && registry.get(entry.uid) === entry) registry.delete(entry.uid);
    }
  }

  function fireEntry(entry, point, target) {
    const ops = entry.points.get(point);
    if (!ops || entry.executing.has(point)) return;
    // 先预留本次次数，嵌套事件不能再次领取最后一次；执行顺序仍保持同步。
    consumeUse(entry);
    entry.executing.add(point);
    try { resolveOps(entry.card, ops, target, point); }
    finally { entry.executing.delete(point); }
  }

  function firePoint(point, getContext) {
    const token = getBattleToken();
    for (const [uid, entry] of [...registry.entries()]) {
      if (!isCurrent(token)) break;
      // 同一事件固定登记快照，前一个监听重置/替换的登记不再以旧对象执行。
      if (registry.get(uid) !== entry) continue;
      fireEntry(entry, point, getContext ? getContext(entry) : undefined);
    }
  }

  function fireTurnStart() {
    const token = getBattleToken();
    firePoint('onTurnStart');
    // 装备静态光环 focus：每回合开始额外能量（长剑 +攻 / 法杖 +法伤在穿戴时一次性结算，不在此列）
    for (const e of [...instanceRuntime.equipped]) {
      if (!isCurrent(token)) break;
      if (e?.card?.rules?.equip?.passive?.cond?.hasCurse && !hasPlayerCurse()) continue;
      const focus = e?.card?.rules?.equip?.passive?.aura?.focus;
      if (Number.isInteger(focus) && focus > 0) {
        addEnergy(focus);
        log(`[[icon:bolt]] 【${esc(e.card.name)}】专注：能量 +${focus}`, 'sys');
      }
    }
  }

  function fireTurnEnd() { firePoint('onTurnEnd'); }
  function fireDamaged() { firePoint('onDamaged'); }
  // 对战开始：start 流程（lifecycle）在开战被动结算后调用——登记卡（能力卡/迎战装备）的 onBattleStart
  function fireBattleStart() { firePoint('onBattleStart'); }
  // 打出牌时：当前契约不区分打出的牌类型（毒杖「每使用法术牌」式过滤由后续批次的
  // onPlayCardFilter 键细化）；duration/独立持续卡表达优先
  function firePlayCard() { firePoint('onPlayCard'); }
  function fireKill() { firePoint('onKill'); }
  // M3：我方攻击冰冻敌人后（engine 挂 COMBAT_HOOKS.onFreeze）/ 该卡被发现或随机获取时（addTempCard 钩）
  function fireFreezeDealt(target) { firePoint('onFreezeDealt', () => target); }
  function fireAcquire(card, target) {
    const { ops } = triggerExecutionPlan(card, 'onAcquire');
    if (Array.isArray(ops) && ops.length) resolveOps(card, ops, target);
  }

  /** 抽到时（onDraw）：不登记即触发——drawCards 抽到该卡时直接结算并保持离手。 */
  function fireDrawn(card, target) {
    const { ops } = triggerExecutionPlan(card, 'onDraw');
    if (Array.isArray(ops) && ops.length) resolveOps(card, ops, target);
  }

  /** 消耗时（onConsume）：该卡被消耗/注能牺牲时结算（engine fireConsumeTriggers 挂点）。 */
  function fireConsume(card, target) {
    const { ops } = triggerExecutionPlan(card, 'onConsume');
    if (Array.isArray(ops) && ops.length) resolveOps(card, ops, target);
  }

  function reset() { registry.clear(); }

  // 装备域结构化 ops 直接执行（onEquip/battleStart/skill）——不经登记，一次性合成结算
  function resolveEquipOps(card, ops, target) { resolveOps(card, ops, target); }

  return {
    registerCard, fireTurnStart, fireTurnEnd, fireBattleStart, fireDamaged, firePlayCard,
    fireKill, fireDrawn, fireConsume, reset, resolveEquipOps, fireFreezeDealt, fireAcquire,
  };
}
return { createTriggerRunner };
}
