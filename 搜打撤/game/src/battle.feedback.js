/* 战斗反馈节奏：纯函数，不操作 DOM，便于逻辑测试和后续替换为 VFX。 */

const FEEDBACK_DELTA_MS = 320;

function feedbackClass(feedback = {}) {
  if (feedback.warm) return 'heal';
  if (feedback.cls) return feedback.cls;
  return feedback.unit === 'self' ? 'hurt' : 'dmg';
}

function feedbackDelay(unitKey, counters, delta = FEEDBACK_DELTA_MS) {
  const key = unitKey == null ? 'self' : String(unitKey);
  const count = counters[key] || 0;
  counters[key] = count + 1;
  return count * delta;
}

function actionFeedback(type, payload = {}) {
  return Object.freeze({ type, ...payload, timestamp: Date.now() });
}

export { FEEDBACK_DELTA_MS, actionFeedback, feedbackClass, feedbackDelay };
