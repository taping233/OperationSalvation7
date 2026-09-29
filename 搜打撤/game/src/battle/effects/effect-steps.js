/* ============================================================
 * effect-steps.js —— 牌效动词执行器（2026-09-11 架构批次 7：dispatch 彻底重写）
 *
 * 旧实现是 createEffectExecutor 里 ~1100 行的顺序 if 链：每个效果动词一段
 * 「正则匹配 + 结算」，识别门控（!did）、无条件段、提前 return 全部内联在
 * 控制流里，只有作者能读。本文件把这条链改写成**有序步骤表**：
 *
 *   每一步 = { id, label, gate, when(ctx) -> match|null, run(ctx, m) }
 *     gate 'fresh'  —— ctx.did 已置位时整步跳过（＝旧代码里的 `xxx && !did`）
 *     gate 'always' —— 无论 did 与否都评估（＝旧代码里没有 !did 的分支）
 *     when 纯函数：只读 ctx 返回匹配结果；命中才执行 run
 *     run 返回 { halt, result } 时整个执行器立即返回 result（提前 return 类）
 *
 * 铁律：**顺序即语义**。旧链对顺序与 did 门控敏感（伤害先于诅咒、洗入先于
 * 「然后抽」、抉择拦截在其它动词之前……都是修过的回归），重排顺序=改行为。
 * 新增效果 = 在正确位置插入一个步骤条目；改数值 = 只改该条目的 run。
 *
 * 行为等价已用录制式差分验证：新旧执行器在同一套假战斗端口上跑全卡库
 * 全部子句 × structuredHit/infused/mode 矩阵，调用轨迹、日志、终态逐字一致。
 *
 * 与 effect-verbs.js 的分工：那边是「识别」注册表（覆盖度断言 + 哨兵），
 * 本文件是「结算」本体；ELSEWHERE 命中仍只标记 did，不在此重复结算。
 * 2026-09-22 拆分（六文件重构批1）：9 个分节条目数组按原分节注释逐字拆至
 * effect-steps.<slice>.js，共享端口经 shared 注入，壳按原序 concat——分节文件的
 * concat 顺序即语义序，新增效果仍按旧链位置插入对应分节。
 * ============================================================ */
import { matchElsewhere, noteUnknownEffect } from './effect-verbs.js';
import { HAND_COST_CONSUME_RE, HAND_COST_SELECT_RE } from './hand-cost-patterns.js';
import { ARROW_TOKEN, POOL_NUM_MAP, parsePoolNoun, CN_NUM, num, HALT, FRESH_RESULT, makeHitFoe } from './effect-steps.ctx.js';
import { gatesSteps } from './effect-steps.gates.js';
import { curseSteps } from './effect-steps.curse.js';
import { damageSteps } from './effect-steps.damage.js';
import { recoverySteps } from './effect-steps.recovery.js';
import { killsSteps } from './effect-steps.kills.js';
import { deckSteps } from './effect-steps.deck.js';
import { rulesSteps } from './effect-steps.rules.js';
import { auditSteps } from './effect-steps.audit.js';
import { tailSteps } from './effect-steps.tail.js';
export { POOL_NUM_MAP, parsePoolNoun };
/**
 * 创建有序步骤表。deps 是战斗侧显式端口（与旧 createEffectExecutor 同一套）。
 * 顺序 = 旧 if 链的物理顺序，不得重排。
 */
export function createEffectSteps(deps) {
  const shared = {
    ...deps,
    esc: deps.escapeHtml,
    hitFoe: makeHitFoe(deps),
    deps,
    matchElsewhere, noteUnknownEffect,
    HAND_COST_CONSUME_RE, HAND_COST_SELECT_RE,
    ARROW_TOKEN, POOL_NUM_MAP, parsePoolNoun, CN_NUM, num, HALT, FRESH_RESULT,
  };
  return [
    ...gatesSteps(shared),
    ...curseSteps(shared),
    ...damageSteps(shared),
    ...recoverySteps(shared),
    ...killsSteps(shared),
    ...deckSteps(shared),
    ...rulesSteps(shared),
    ...auditSteps(shared),
    ...tailSteps(shared),
  ];
}

/**
 * 创建文本效果执行器（与旧 createEffectExecutor 返回值同签名）。
 * 遍历有序步骤表；哨兵在自然走完时才评估（提前 return 的分支不记哨兵，与旧实现一致）。
 * @param {object} deps 战斗侧显式端口
 */
export function createEffectPipeline(deps) {
  const steps = createEffectSteps(deps);
  function* applyTextEffectsSteps(card, text, target, flags) {
    const ctx = {
      card, target, flags: flags || {},
      desc: String(text || ''),
      did: false, drawn: false, healed: false, armored: false,
      infLead: null, bleedGateFail: false,
      // 以下与旧实现同源同序：顶部取一次，链中共用
      pstat: deps.getPlayerStatus(),
      pdef: deps.getPlayerDefense(),
      myClass: deps.getPlayerClass ? deps.getPlayerClass() : null,
      durOv: (String(text || '').match(/持续\s*(\d+)\s*回合/) || [])[1],
      curseTarget: (target && !target.dead) ? target : deps.getAlive()[0] || null,
    };
    for (const step of steps) {
      if (step.gate !== 'always' && ctx.did) continue;
      const m = step.when(ctx);
      if (!m) continue;
      const out = step.run.steps ? yield* step.run.steps(ctx, m) : step.run(ctx, m);
      if (out && out.halt) return out.result;
    }
    // —— 未识别子句哨兵（批次 3）：牌面像有效果、却既没结算也没被任何层认领 ——
    const result = { did: ctx.did, drawn: ctx.drawn, healed: ctx.healed, armored: ctx.armored };
    if (!ctx.did && !ctx.drawn && !ctx.healed && !ctx.armored) noteUnknownEffect(card, ctx.desc);
    return result;
  }
  // 回合触发等旧调用仍同步结算；玩家出牌可在每次命中间等待反馈。
  function applyTextEffects(...args) {
    const iterator = applyTextEffectsSteps(...args);
    let next = iterator.next();
    while (!next.done) next = iterator.next();
    return next.value;
  }
  applyTextEffects.steps = applyTextEffectsSteps;
  return applyTextEffects;
}

