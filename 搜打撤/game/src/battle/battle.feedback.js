/* 战斗反馈节奏：纯函数，不操作 DOM，便于逻辑测试和后续替换为 VFX。 */

import { demoMs } from './battle.pace.js';
import { waitPresentationMs } from './battle.clock.js';

const FEEDBACK_DELTA_MS = 320;

let feedbackTail = Promise.resolve();
let feedbackGeneration = 0;
let feedbackController = new AbortController();

function isTestRuntime() {
  return typeof process !== 'undefined' && process.env && process.env.VITEST === 'true';
}

function waitMs(ms, signal) {
  if (isTestRuntime()) return Promise.resolve();
  return waitPresentationMs(ms, signal);
}

function enqueueFeedback(run, delayMs = 0) {
  const generation = feedbackGeneration;
  const signal = feedbackController.signal;
  const task = feedbackTail.then(async () => {
    if (generation !== feedbackGeneration || signal.aborted) return;
    await waitMs(delayMs, signal);
    if (generation !== feedbackGeneration || signal.aborted) return;
    await run(signal);
  });
  feedbackTail = task.catch(() => {});
  return feedbackTail;
}

function waitForFeedback(signal) {
  const pending = feedbackTail;
  if (!signal) return pending;
  if (signal.aborted) return Promise.reject(signal.reason || new Error('Battle feedback cancelled'));
  return new Promise((resolve, reject) => {
    function cleanup() { signal.removeEventListener('abort', cancel); }
    function done() { cleanup(); resolve(); }
    function cancel() { cleanup(); reject(signal.reason || new Error('Battle feedback cancelled')); }
    signal.addEventListener('abort', cancel, { once: true });
    pending.then(done, error => { cleanup(); reject(error); });
  });
}

function clearFeedback() {
  feedbackGeneration++;
  feedbackController.abort(new Error('Battle feedback cleared'));
  feedbackController = new AbortController();
  feedbackTail = Promise.resolve();
}

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

function feedbackDelay(unitKey, counters, delta = demoMs(FEEDBACK_DELTA_MS)) {
  const key = unitKey == null ? 'self' : String(unitKey);
  const count = Object.prototype.hasOwnProperty.call(counters, key) ? counters[key] : 0;
  // 用 defineProperty 处理 `__proto__` 等合法但特殊的单位键，避免污染普通对象原型。
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    Object.defineProperty(counters, key, { value: count + 1, writable: true, enumerable: true, configurable: true });
  } else counters[key] = count + 1;
  return count * Math.max(0, Number(delta) || 0);
}

function feedbackShakeDuration(beatCount = 1) {
  const base = demoMs(1000);
  if (beatCount <= 1) return base;
  // 连击的震屏不能长过下一拍，否则多条 Web Animations 会争夺同一个 transform。
  return Math.max(80, Math.min(base, Math.round(demoMs(FEEDBACK_DELTA_MS) * 0.8)));
}

function actionFeedback(type, payload = {}) {
  return Object.freeze({ type, ...payload, timestamp: Date.now() });
}

export { FEEDBACK_DELTA_MS, actionFeedback, clearFeedback, enqueueFeedback, feedbackClass, feedbackDelay, feedbackShakeDuration, feedbackTier, waitForFeedback, waitMs };
