/* Replay capture/play keep their Promise contract and load trusted-fixture execution on demand. */
let runtimePromise = null;
function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = import('./agent.replay.runtime.js').catch(error => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}
async function run(method, args) {
  let runtime;
  try { runtime = await loadRuntime(); }
  catch (error) {
    return { ok: false, code: 'REPLAY_LOAD_FAILED', message: String(error?.message || error), ...(method === 'play' ? { executed: 0 } : {}) };
  }
  return runtime[method](...args);
}
function capture(...args) { return run('capture', args); }
function play(...args) { return run('play', args); }
export { capture, play };
