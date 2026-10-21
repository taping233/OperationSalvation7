// A single cancellation owner is shared by the eager facade and lazy execution module.
// Reserve it before loading so duplicate starts and Stop work during a cold first run.
const runState = { abort: null };
function stopRun() {
  try { runState.abort?.abort(); } catch { /* 控制器已关闭 */ }
}
export { runState, stopRun };
