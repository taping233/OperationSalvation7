import { createEffectPipeline, parsePoolNoun } from './effect-steps.js';

import { splitEffectClauses } from './battle.effect-clauses.js';
export { consumeTriggerTexts } from './battle.trigger-source.js';

/**
 * 创建文本效果执行器。所有状态变化都通过显式端口进入，解析层不再依赖战斗模块内部变量。
 * 结算本体在 effect-steps.js 的有序步骤表里（2026-09-11 架构批次 7 重写），本文件只做
 * 分句与装配——改动词/加效果去 effect-steps.js，别在这里加 if。
 * @param {object} deps
 */
function createEffectExecutor(deps) {
  return createEffectPipeline(deps);
}

export { createEffectExecutor, splitEffectClauses, parsePoolNoun };
