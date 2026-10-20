import { splitEffectClauses } from './battle.effect-clauses.js';
import { triggerExecutionPlan } from '../../cards/card-execution-plan.js';
export { BATTLE_TRIGGER_POINTS, REGISTERED_TRIGGER_POINTS, DIRECT_TRIGGER_POINTS,
  hasStructuredTrigger, hasStructuredEquipField, triggerDeclarations } from '../../cards/card-trigger-contract.js';

/** 旧文本消耗触发只提取当事卡的触发句，不执行普通打出效果。 */
export function consumeTriggerTexts(description) {
  const out = [];
  String(description || '').split(/[。；;\n]/).forEach(source => {
    const match = source.trim().match(/^消耗该牌时[：:，,]?\s*(.+)$/);
    if (match) out.push(match[1]);
  });
  return out;
}

/**
 * 抽到/消耗是针对当事卡直调的时点，共用结构化与旧文本的互斥入口。
 * 显式时点容器（含空数组）拥有该时点；其他时点的规则不抑制尚未迁移的文本。
 * 装备域保留既有消耗语义：已迁移装备不再回放描述中的消耗句。
 * @param {object} card
 * @param {'onDraw'|'onConsume'|'onAcquire'} point
 */
export function directTriggerSource(card, point) {
  const plan = triggerExecutionPlan(card, point);
  if (plan.kind === 'structured') return { ...plan, texts: [] };
  const texts = point === 'onDraw'
    ? splitEffectClauses(card?.desc).onDraw
    : point === 'onConsume' ? consumeTriggerTexts(card?.desc) : [];
  return { kind: 'text', ops: [], texts };
}
