/** Browser persistence yields to idle time for at most two seconds. */
export function deferBattlePersistence(write) {
  if (typeof requestIdleCallback === 'function' && typeof document !== 'undefined' && !document.hidden) {
    requestIdleCallback(write, { timeout: 2000 });
  } else write();
}
