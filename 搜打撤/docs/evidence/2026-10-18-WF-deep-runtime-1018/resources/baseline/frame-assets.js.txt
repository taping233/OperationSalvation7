// Local ownership for frame URLs only. Pending loads cannot block unrelated disposal.
export function createFrameAssets() {
  const entries = new Map();
  function dispose(entry) {
    if (entry.owners.size || !entry.settled || entry.unloading) return entry.unloading;
    entry.unloading = Promise.resolve().then(() => entry.Assets.unload(entry.url))
      .catch(() => {}).finally(() => {
        if (entries.get(entry.url) === entry) entries.delete(entry.url);
      });
    return entry.unloading;
  }
  async function load(url, owner, Assets) {
    let entry = entries.get(url);
    // An unloading texture cannot acquire a new owner. Only this URL waits.
    while (entry?.unloading) {
      await entry.unloading;
      entry = entries.get(url);
    }
    if (owner.cancelled) return null;
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
    return entry.promise;
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
