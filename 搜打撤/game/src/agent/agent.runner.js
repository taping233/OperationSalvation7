/* Agent command facade: act/stopRun stay synchronous; asynchronous driving loads on demand. */
import { act, commandContext, sameContext } from './agent.action-router.js';
import { observe } from './agent.state.js';
import { setDriver, getDriver, noteStopReason } from './agent.recorder.js';
import { runState, stopRun } from './agent.run-control.js';
import { isTurbo } from '../core/turbo.js';

const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

let runtime = null;
let runtimePromise = null;
function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = import('./agent.runner.runtime.js').then(module => {
      runtime = module;
      return module;
    }, error => {
      runtimePromise = null;
      const failure = Object.assign(new Error(`Agent 驱动加载失败，可重试：${String(error?.message || error)}`),
        { code: 'AGENT_RUNNER_LOAD_FAILED' });
      throw failure;
    });
  }
  return runtimePromise;
}
// Stop and the run deadline end this caller's cold wait, not the shared import.
// A late resolution may warm the cache, but it cannot restart an abandoned run.
async function waitForRuntime(run, deadline) {
  let timer;
  let onAbort;
  const interrupted = new Promise(resolve => {
    onAbort = () => resolve({ stopReason: 'cancelled' });
    run?.signal.addEventListener('abort', onAbort, { once: true });
    if (run?.signal.aborted) onAbort();
    if (Number.isFinite(deadline)) {
      const onDeadline = () => {
        const remaining = deadline - nowMs();
        if (remaining <= 0) resolve({ stopReason: 'run-timeout' });
        else timer = setTimeout(onDeadline, Math.min(remaining, 2147483647));
      };
      onDeadline();
    }
  });
  try { return await Promise.race([loadRuntime().then(module => ({ module })), interrupted]); }
  finally { clearTimeout(timer); run?.signal.removeEventListener('abort', onAbort); }
}
// Loading cannot introduce an unbounded wait before the existing finite settle loop.
function settleDeadline(options) {
  const fallback = isTurbo() ? 8000 : 20000;
  const timeout = options?.timeoutMs || fallback;
  return nowMs() + (Number.isFinite(timeout) ? Math.max(0, timeout) : fallback);
}
const stalledSettle = () => ({ ok: false, stalled: true, obs: observe() });
function timedOutStep() {
  return { obs: observe(), action: null,
    res: { ok: false, code: 'AGENT_RUNNER_LOAD_TIMEOUT', message: 'Agent 驱动加载超时，可重试；未执行决策' },
    done: true, settleStalled: true, stopReason: 'runner-load-timeout' };
}
function blockedStep(code) {
  const cancelled = code === 'RUN_CANCELLED';
  return { obs: observe(), action: null,
    res: { ok: false, code, message: cancelled ? '自动驱动已停止，未执行旧决策' : '驱动加载期间对局归属已改变，未执行旧动作' },
    done: cancelled, stopReason: cancelled ? 'cancelled' : 'context-changed' };
}
function step(decide, options = {}) {
  if (runtime) return runtime.step(decide, options);
  const run = runState.abort;
  const context = commandContext();
  const deadline = settleDeadline(options);
  return waitForRuntime(run, deadline).then(loaded => {
    if (run !== runState.abort || run?.signal.aborted) return blockedStep('RUN_CANCELLED');
    if (!sameContext(context)) return blockedStep('CONTEXT_CHANGED');
    if (loaded.stopReason || nowMs() >= deadline) return timedOutStep();
    return loaded.module.step(decide, options);
  });
}
function waitSettle(options) {
  if (runtime) return runtime.waitSettle(options);
  const deadline = settleDeadline(options);
  return waitForRuntime(null, deadline).then(loaded => {
    const remaining = deadline - nowMs();
    if (loaded.stopReason || remaining <= 0) return stalledSettle();
    // Deduct the download time instead of resetting the caller's timeout after loading.
    return loaded.module.waitSettle({ ...options, timeoutMs: remaining });
  });
}
function stoppedTrace(code) {
  /** @type {{step:number,id:string|null,ok:boolean|null,phase:string,spin:number,error?:string,code?:string,completed?:boolean,stalled?:boolean}[] & {stopReason?:string}} */
  const trace = [];
  trace.stopReason = code;
  noteStopReason({ code, steps: 0 });
  return trace;
}
/** @param {Parameters<typeof import('./agent.runner.runtime.js').autoRun>[0]} options */
async function autoRun(options) {
  if (runState.abort) return stoppedTrace('already-running');
  const { driver = 'auto', runTimeoutMs = Infinity } = options;
  const previousDriver = getDriver();
  const run = new AbortController();
  runState.abort = run;
  setDriver(driver);
  const context = commandContext();
  const deadline = Number.isFinite(runTimeoutMs) && runTimeoutMs > 0 ? nowMs() + runTimeoutMs : Infinity;
  try {
    const loaded = runtime ? { module: runtime } : await waitForRuntime(run, deadline);
    if (run.signal.aborted) return stoppedTrace('cancelled');
    if (loaded.stopReason) return stoppedTrace(loaded.stopReason);
    if (nowMs() >= deadline) return stoppedTrace('run-timeout');
    if (!sameContext(context)) return stoppedTrace('context-changed');
    return await loaded.module.autoRun(options, run, deadline);
  } catch (error) {
    if (error?.code === 'AGENT_RUNNER_LOAD_FAILED') noteStopReason({ code: 'runner-load-failed', steps: 0 });
    throw error;
  } finally {
    if (runState.abort === run) {
      setDriver(previousDriver);
      runState.abort = null;
    }
  }
}

export { act, step, autoRun, waitSettle, stopRun };
