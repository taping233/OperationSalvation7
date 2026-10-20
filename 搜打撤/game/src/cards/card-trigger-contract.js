import { ownsBuiltinExecutionDomain } from './builtin-card-execution.js';

// 规则声明层的时点词表。执行、校验和能力检查共同读取，不能反向依赖战斗运行态。
export const REGISTERED_TRIGGER_POINTS = Object.freeze(/** @type {const} */ ([
  'onTurnStart', 'onTurnEnd', 'onBattleStart', 'onKill', 'onDamaged', 'onPlayCard', 'onFreezeDealt',
]));
export const DIRECT_TRIGGER_POINTS = Object.freeze(['onAcquire', 'onDraw', 'onConsume']);
export const BATTLE_TRIGGER_POINTS = Object.freeze(['onPlay', ...REGISTERED_TRIGGER_POINTS, ...DIRECT_TRIGGER_POINTS]);

/** 出牌执行视图可剥离其他时点；预检仍读取保留下来的完整声明。
 * @param {import('./card-execution-plan.types').ExecutionCard | null | undefined} card */
export function triggerDeclarations(card) {
  return card?._registeredTriggers ?? card?.rules?.triggers;
}

/** 显式空容器同样拥有该时点，不能回退到卡面文本。
 * @param {import('./card-execution-plan.types').ExecutionCard | null | undefined} card
 * @param {import('./card-execution-plan.types').TriggerPoint} point */
export function hasStructuredTrigger(card, point) {
  const triggers = triggerDeclarations(card);
  return (triggers != null && Object.prototype.hasOwnProperty.call(triggers, point))
    || ownsBuiltinExecutionDomain(card);
}

/** @param {import('./card-execution-plan.types').ExecutionCard | null | undefined} card
 * @param {import('./card-execution-plan.types').EquipmentPoint} key */
export function hasStructuredEquipField(card, key) {
  const equip = card?.rules?.equip;
  return (equip != null && Object.prototype.hasOwnProperty.call(equip, key))
    || ownsBuiltinExecutionDomain(card);
}
