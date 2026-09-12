/* 战斗反馈节奏：纯函数，不操作 DOM，便于逻辑测试和后续替换为 VFX。 */

const FEEDBACK_DELTA_MS = 320;

function feedbackTier(feedback = {}) {
  if (feedback.warm || (feedback.cls || '').includes('stk')) return 'routine';
  if ((feedback.cls || '').includes('block')) return 'impact';
  const amount = Math.abs(Number.parseInt(String(feedback.text || '').replace(/[^\d-]/g, ''), 10) || 0);
  return feedback.finisher || feedback.critical || amount >= 10 ? 'finisher' : 'impact';
}

function feedbackClass(feedback = {}) {
  if (feedback.warm) return 'heal';
  const base = feedback.cls || (feedback.unit === 'self' ? 'hurt' : 'dmg');
  // 保留旧调用方只传 unit 时的精确返回值；带有事件元数据时才追加分级样式。
  if (!feedback.cls && !feedback.critical && !feedback.finisher) return base;
  const tier = feedbackTier(feedback);
  return [base, `fx-${tier}`, feedback.critical ? 'critical' : ''].filter(Boolean).join(' ');
}

function feedbackDelay(unitKey, counters, delta = FEEDBACK_DELTA_MS) {
  const key = unitKey == null ? 'self' : String(unitKey);
  const count = Object.prototype.hasOwnProperty.call(counters, key) ? counters[key] : 0;
  // 用 defineProperty 处理 `__proto__` 等合法但特殊的单位键，避免污染普通对象原型。
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    Object.defineProperty(counters, key, { value: count + 1, writable: true, enumerable: true, configurable: true });
  } else counters[key] = count + 1;
  return count * Math.max(0, Number(delta) || 0);
}

function actionFeedback(type, payload = {}) {
  return Object.freeze({ type, ...payload, timestamp: Date.now() });
}

export { FEEDBACK_DELTA_MS, actionFeedback, feedbackClass, feedbackDelay, feedbackTier };
