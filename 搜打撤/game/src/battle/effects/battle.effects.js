import { createEffectPipeline, parsePoolNoun } from './effect-steps.js';

import { splitEffectClauses } from './battle.effect-clauses.js';

/**
 * 创建文本效果执行器。所有状态变化都通过显式端口进入，解析层不再依赖战斗模块内部变量。
 * 结算本体在 effect-steps.js 的有序步骤表里（2026-09-11 架构批次 7 重写），本文件只做
 * 分句与装配——改动词/加效果去 effect-steps.js，别在这里加 if。
 * @param {object} deps
 */
function createEffectExecutor(deps) {
  return createEffectPipeline(deps);
}

// 「消耗该牌时」触发句提取（沉船宝盒/百炼青虹剑/矿工炸药/奥术残卷）：
// 由 battle.core 在两类消耗时点（注能牺牲 / 手选消耗）调用，剥离前缀后走常规结算
function consumeTriggerTexts(description) {
  const out = [];
  String(description || '').split(/[。；;\n]/).forEach(s => {
    const m = s.trim().match(/^消耗该牌时[：:，,]?\s*(.+)$/);
    if (m) out.push(m[1]);
  });
  return out;
}

export { createEffectExecutor, splitEffectClauses, parsePoolNoun, consumeTriggerTexts };
