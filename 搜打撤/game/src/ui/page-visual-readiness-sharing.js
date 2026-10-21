// Share resource work only while callers still own the same mounted destination.
// Each caller keeps its own background, deadline, abort signal and presentation frame.
const pending = new WeakMap();

function imageReady(image, signal) {
  return new Promise(resolve => {
    let settled = false;
    const finish = ready => {
      if (settled) return;
      settled = true;
      image.removeEventListener?.('load', loaded);
      image.removeEventListener?.('error', failed);
      signal.removeEventListener('abort', failed);
      resolve(ready);
    };
    const loaded = () => finish(image.naturalWidth > 0);
    const failed = () => finish(false);
    signal.addEventListener('abort', failed, { once: true });
    if (signal.aborted) { failed(); return; }
    // Deadlines belong to subscribers. A short wait must not settle a longer
    // subscriber's image promise, and an abandoned decode must not be reused.
    if (typeof image.decode === 'function') image.decode().then(loaded, failed);
    else if (image.complete) loaded();
    else {
      image.addEventListener?.('load', loaded, { once: true });
      image.addEventListener?.('error', failed, { once: true });
    }
  });
}

function representativeImages(root, extraRoots) {
  const images = [];
  for (const host of [root, ...extraRoots]) {
    for (const image of host.querySelectorAll('img')) {
      if (images.length >= 12) break;
      if (!image.src || image.loading === 'lazy' || image.closest('[hidden], .lib-grid, .pool-grid')) continue;
      const rect = image.getBoundingClientRect();
      if (rect.width && rect.height && rect.bottom > 0 && rect.right > 0
        && rect.top < window.innerHeight && rect.left < window.innerWidth) images.push(image);
    }
  }
  return images;
}

export function acquirePageVisualReadiness(root, { page, revisionOwner, revision, extraRoots }) {
  let entries = pending.get(root);
  if (!entries) { entries = new Set(); pending.set(root, entries); }
  let entry = [...entries].find(candidate => candidate.page === page
    && candidate.revisionOwner === revisionOwner && candidate.revision === revision
    && candidate.extraRoots.length === extraRoots.length
    && candidate.extraRoots.every((host, index) => host === extraRoots[index]));
  if (!entry) {
    const controller = new AbortController();
    entry = { page, revisionOwner, revision, extraRoots: [...extraRoots], controller, users: 0,
      ready: Promise.all(representativeImages(root, extraRoots).map(image => imageReady(image, controller.signal))) };
    entries.add(entry);
  }
  entry.users += 1;
  let released = false;
  return {
    ready: entry.ready,
    release() {
      if (released) return;
      released = true;
      if (--entry.users) return;
      entries.delete(entry);
      if (!entries.size) pending.delete(root);
      entry.controller.abort();
    },
  };
}
