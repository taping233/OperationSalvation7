/* ============================================================
 * battle.triggers.m2.js —— 结构化时点触发器 runner（M2，2026-09-27）
 *
 * 承接 rules.triggers 的七个时点容器（onTurnStart/onTurnEnd/onBattleStart/
 * onConsume/onDraw/onKill/onDamaged/onPlayCard）与容器级 duration（持续 N 次）。
 *
 * 设计（对齐文本路径既有宿主）：
 *   - 打出卡 / 穿戴装备时 registerCard 登记（exec-play / battle.equipment.js 挂点）；
 *   - 抽到（onDraw）与消耗（onConsume）不依赖登记——事件发生时对当事卡直接结算；
 *   - ops 执行 = 合成卡（desc 清空、triggers.onPlay 替换）走既有 resolveCard 全链路，
 *     schema/capability 门天然复用；
 *   - 容器级 duration = 每次触发扣 1，归零移除该卡登记（花瓣法阵「持续 3 回合」）。
 * ============================================================ */
import { equipped } from './battle.runtime.piles.js';

const TRIGGER_POINTS = ['onTurnStart', 'onTurnEnd', 'onBattleStart', 'onKill', 'onDamaged', 'onPlayCard', 'onFreezeDealt', 'onAcquire'];

export function createTriggerRunner({
  resolveCard, log, esc, getAliveFoes, addEnergy,
}) {
  /** uid -> { card, points, left }；points: 时点名 -> ops 数组；left: duration 剩余次数 */
  const registry = new Map();

  function resolveOps(card, ops, target) {
    if (!Array.isArray(ops) || !ops.length) return;
    // 合成卡只保留 onPlay 容器（resolver 守卫：非 onPlay 时点容器必须经 runner 登记管线）。
    // battle.target 按 ops 推导（敌方域存在→enemy / 否则 self；allEnemies→area），
    // 自身域字面量 op 走 schema 混合放行；damage 缺卡面类型时兜底 法术/fixed（仅口径占位）。
    const hasEnemy = ops.some(o => o && (
      o.op === 'damage' || o.op === 'stealAtk' ||
      (o.op === 'curse' && o.target !== 'self') ||
      ['chosenEnemy', 'allEnemies', 'randomEnemy'].includes(o.target)));
    const hasArea = ops.some(o => o && o.target === 'allEnemies');
    const hasDamage = ops.some(o => o && o.op === 'damage');
    const battle = { target: { side: hasEnemy ? 'enemy' : 'self', area: hasArea } };
    // pick:'new' 段在此上下文已完成点选（runner 执行=点选后），剥除 pick 键避免 resolver 二次跳过
    const resolvedOps = ops.map(op => {
      if (!op || op.pick === undefined) return op;
      const clone = { ...op };
      delete clone.pick;
      return clone;
    });
    const synthetic = {
      ...card, desc: '', infuse: 0,
      type: hasDamage && !['武术', '法术'].includes(card.type) ? '法术' : card.type,
      dmgType: hasDamage && !card.dmgType ? 'fixed' : card.dmgType,
      rules: { ...card.rules, battle, triggers: { onPlay: resolvedOps } },
    };
    try {
      resolveCard(synthetic, target ?? (getAliveFoes()[0] ?? null), false, 0, 'm2-trigger');
    } catch (error) {
      log(`[[icon:cross]] 触发效果结算失败：${esc(String(error && error.message || error))}`, 'warn');
    }
  }

  /** 打出卡 / 穿戴装备时登记。battleStarted=true 时 onBattleStart 立即补发（战斗中穿戴口径）。 */
  function registerCard(card, uid, { battleStarted = false } = {}) {
    const triggers = card && card.rules && card.rules.triggers;
    if (!triggers || typeof triggers !== 'object') return false;
    const points = new Map();
    for (const point of TRIGGER_POINTS) {
      if (Array.isArray(triggers[point]) && triggers[point].length) points.set(point, triggers[point]);
    }
    if (!points.size) return false;
    const left = Number.isInteger(triggers.duration) ? triggers.duration : null;
    registry.set(uid, { card, points, left, uid });
    if (points.has('onBattleStart') && battleStarted) {
      resolveOps(card, points.get('onBattleStart'));
      consumeUse(uid);
    }
    return true;
  }

  function consumeUse(uid) {
    const entry = registry.get(uid);
    if (!entry) return;
    if (entry.left !== null) {
      entry.left -= 1;
      if (entry.left <= 0) registry.delete(uid);
    }
  }

  function firePoint(point, getContext) {
    for (const [uid, entry] of [...registry.entries()]) {
      const ops = entry.points.get(point);
      if (!ops) continue;
      resolveOps(entry.card, ops, getContext ? getContext(entry) : undefined);
      consumeUse(uid);
    }
  }

  function fireTurnStart() {
    firePoint('onTurnStart');
    // 装备静态光环 focus：每回合开始额外能量（长剑 +攻 / 法杖 +法伤在穿戴时一次性结算，不在此列）
    for (const e of equipped) {
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
    const ops = card?.rules?.triggers?.onAcquire;
    if (Array.isArray(ops) && ops.length) resolveOps(card, ops, target);
  }

  /** 抽到时（onDraw）：不登记即触发——drawCards 抽到该卡时直接结算并保持离手。 */
  function fireDrawn(card, target) {
    const ops = card?.rules?.triggers?.onDraw;
    if (Array.isArray(ops) && ops.length) resolveOps(card, ops, target);
  }

  /** 消耗时（onConsume）：该卡被消耗/注能牺牲时结算（engine fireConsumeTriggers 挂点）。 */
  function fireConsume(card, target) {
    const ops = card?.rules?.triggers?.onConsume;
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
