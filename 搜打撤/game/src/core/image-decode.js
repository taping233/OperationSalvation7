// Decode and repaint once per image/source. Repeated overlay refreshes must not
// register multiple load handlers or keep invalidating an already decoded image.
const states = new WeakMap();
const sourceKey = image => `${image.getAttribute('src')}|${image.getAttribute('srcset') || ''}`;

function decodeImage(image) {
  image.loading = 'eager';
  if (typeof image.decode !== 'function') return;
  const source = sourceKey(image);
  const previous = states.get(image);
  if (previous?.source === source) return;
  previous?.cleanup();
  const current = () => states.get(image) === state && sourceKey(image) === source;
  let restore;
  const cleanup = () => {
    image.removeEventListener('load', kick);
    image.removeEventListener('error', failed);
    restore?.();
  };
  const failed = () => {
    cleanup();
    if (states.get(image) === state) states.delete(image);
  };
  const shine = () => {
    if (!current() || !image.isConnected) { failed(); return; }
    const value = image.style.getPropertyValue('visibility');
    const priority = image.style.getPropertyPriority('visibility');
    restore = () => {
      if (value) image.style.setProperty('visibility', value, priority);
      else image.style.removeProperty('visibility');
      restore = null;
    };
    image.style.visibility = 'hidden';
    requestAnimationFrame(() => { restore?.(); });
  };
  const kick = () => {
    if (!current()) { failed(); return; }
    image.removeEventListener('load', kick);
    image.removeEventListener('error', failed);
    try { Promise.resolve(image.decode()).then(shine, failed); }
    catch { failed(); }
  };
  const state = { source, cleanup };
  states.set(image, state);
  if (image.complete && image.naturalWidth > 0) kick();
  else {
    image.addEventListener('load', kick, { once: true });
    image.addEventListener('error', failed, { once: true });
  }
}

export function decodeImagesIn(root = document) {
  root?.querySelectorAll?.('img[src]').forEach(decodeImage);
}
