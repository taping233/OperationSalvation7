// Local ownership for frame URLs only. Pending loads cannot block unrelated disposal.
export function createFrameAssets() {
  const entries = new Map();
  const waits = new WeakMap();
  function waitFor(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.resolve(null);
    let waiters = waits.get(promise);
    if (!waiters) {
      waiters = new Set();
      waits.set(promise, waiters);
      const finish = (failed, value) => {
        waits.delete(promise);
        for (const waiter of waiters) {
          waiter.signal.removeEventListener('abort', waiter.abort);
          (failed ? waiter.reject : waiter.resolve)(value);
        }
        waiters.clear();
      };
      // One continuation per operation: cancelled sessions leave no waiter behind.
      promise.then(value => finish(false, value), error => finish(true, error));
    }
    return new Promise((resolve, reject) => {
      const waiter = { signal, resolve, reject, abort: null };
      waiter.abort = () => {
        waiters.delete(waiter);
        signal.removeEventListener('abort', waiter.abort);
        resolve(null);
      };
      waiters.add(waiter);
      signal.addEventListener('abort', waiter.abort, { once: true });
    });
  }
  function dispose(entry) {
    if (entry.owners.size || !entry.settled || entry.unloading) return entry.unloading;
    entry.unloading = Promise.resolve().then(() => entry.Assets.unload(entry.url))
      .catch(() => {}).finally(() => {
        if (entries.get(entry.url) === entry) entries.delete(entry.url);
      });
    return entry.unloading;
  }
  async function load(url, owner, Assets) {
    const signal = owner.controller?.signal;
    let entry = entries.get(url);
    // An unloading texture cannot acquire a new owner. Only this URL waits.
    while (entry?.unloading) {
      await waitFor(entry.unloading, signal);
      if (owner.cancelled || signal?.aborted) return null;
      entry = entries.get(url);
    }
    if (owner.cancelled || signal?.aborted) return null;
    if (!entry) {
      entry = { url, Assets, owners: new Set(), settled: false, unloading: null, promise: null };
      entries.set(url, entry);
      entry.promise = Promise.resolve().then(() => Assets.load(url)).then(texture => {
        entry.settled = true;
        dispose(entry); // A cancelled owner's late completion has no live consumer.
        return texture;
      }, error => {
        if (entries.get(url) === entry) entries.delete(url);
        throw error;
      });
    }
    entry.owners.add(owner);
    (owner.frameAssets ||= new Set()).add(entry);
    return waitFor(entry.promise, signal);
  }
  function release(owner) {
    const disposing = [];
    for (const entry of owner.frameAssets || []) {
      entry.owners.delete(owner);
      const pending = dispose(entry);
      if (pending) disposing.push(pending);
    }
    owner.frameAssets?.clear();
    return Promise.all(disposing);
  }
  return { load, release };
}
