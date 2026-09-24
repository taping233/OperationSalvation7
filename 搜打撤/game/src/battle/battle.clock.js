/* 战斗表现时钟：同一节奏下等待、清理和顿帧暂停共享生命周期。 */
import { demoMs } from './battle.pace.js';
import { setPaused as setUnitFramesPaused } from './battle.frames.js';

let pauseDepth = 0;
let pausedAnimations = [];
const waits = new Set();

function isTestRuntime() {
  return typeof process !== 'undefined' && process.env?.VITEST === 'true';
}

function waitPresentationMs(ms, signal) {
  if (isTestRuntime() || !(ms > 0)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason || new Error('Battle presentation cancelled')); return; }
    const waiter = { remaining: ms, started: 0, timer: 0, done: false };
    const cleanup = () => {
      clearTimeout(waiter.timer);
      waits.delete(waiter);
      signal?.removeEventListener('abort', cancel);
    };
    const finish = () => { waiter.done = true; cleanup(); resolve(); };
    const cancel = () => { waiter.done = true; cleanup(); reject(signal.reason || new Error('Battle presentation cancelled')); };
    const resume = () => {
      if (pauseDepth || waiter.done) return;
      waiter.started = performance.now();
      waiter.timer = setTimeout(finish, waiter.remaining);
    };
    waiter.pause = () => {
      if (waiter.done || !waiter.timer) return;
      clearTimeout(waiter.timer);
      waiter.timer = 0;
      waiter.remaining = Math.max(0, waiter.remaining - (performance.now() - waiter.started));
    };
    waiter.resume = resume;
    waits.add(waiter);
    signal?.addEventListener('abort', cancel, { once: true });
    resume();
  });
}

function waitPresentation(ms, signal) { return waitPresentationMs(demoMs(ms), signal); }

function waitHitStop(ms, signal) {
  if (isTestRuntime() || !(ms > 0)) return Promise.resolve();
  const release = pausePresentation();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { release(); reject(signal.reason || new Error('Battle presentation cancelled')); return; }
    const timer = setTimeout(done, demoMs(ms));
    function cleanup() { clearTimeout(timer); signal?.removeEventListener('abort', cancel); release(); }
    function done() { cleanup(); resolve(); }
    function cancel() { cleanup(); reject(signal.reason || new Error('Battle presentation cancelled')); }
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

function schedulePresentation(callback, ms) {
  return schedulePresentationMs(callback, demoMs(ms));
}

function schedulePresentationMs(callback, ms) {
  const controller = new AbortController();
  waitPresentationMs(ms, controller.signal).then(callback).catch(() => {});
  return () => controller.abort(new Error('Presentation cleanup cancelled'));
}

function pausePresentation() {
  if (pauseDepth++ === 0) {
    for (const waiter of waits) waiter.pause();
    pausedAnimations = typeof document.getAnimations === 'function'
      ? document.getAnimations().filter(animation => animation.playState === 'running') : [];
    pausedAnimations.forEach(animation => { try { animation.pause(); } catch { /* 已结束的动画无需暂停 */ } });
    setUnitFramesPaused(true);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--pauseDepth > 0) return;
    pauseDepth = 0;
    setUnitFramesPaused(false);
    pausedAnimations.forEach(animation => {
      if (animation.playState === 'paused') { try { animation.play(); } catch { /* 已移除节点上的动画无需恢复 */ } }
    });
    pausedAnimations = [];
    for (const waiter of waits) waiter.resume();
  };
}

export { pausePresentation, schedulePresentation, schedulePresentationMs, waitHitStop, waitPresentation, waitPresentationMs };
