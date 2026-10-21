// Immediate, asynchronous acquisition for tests that do not exercise lock contention.
export function installImmediateWebLocks(target = navigator) {
  Object.defineProperty(target, 'locks', {
    configurable: true,
    value: { request: (_name, options, callback) => Promise.resolve().then(callback || options) },
  });
}
