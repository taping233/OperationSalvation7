import frames from '../../data/card-frame-layout.json';
import { assetUrl } from './asset-url.js';

// Keep every original preload URL. Main figures and the frames actually used by
// cardHTML get a place before the complete thumbnail catalogue, without eagerly
// decoding the catalogue or promoting all portrait animation frames.
export function planStartupArtPreload({ sceneUrls = [], figureUrls = [], thumbnailUrls = [], manifestUrls = [], protocol = globalThis.location?.protocol } = {}) {
  const frameUrls = Object.values(frames).map(frame => assetUrl(`assets/${frame.path}`));
  // Desktop artwork already lives on disk. Reading the complete catalogue at
  // boot competes with foreground decoding without providing an HTTP cache.
  if (protocol === 'app:') return [...new Set([...sceneUrls, ...frameUrls].filter(Boolean))];
  return [...new Set([...sceneUrls, ...figureUrls, ...frameUrls, ...thumbnailUrls, ...manifestUrls].filter(Boolean))];
}

// A per-prefetch-run, bounded courtesy window for the current foreground page.
// Cache the page's images until its content is replaced; don't scan the whole
// document or force layout for already-loaded images on every background batch.
export function createForegroundImageYield(doc = document, now = () => performance.now(), maxWait = 1500) {
  let page = null, firstChild = null, images = [], deadline = null;
  return () => {
    const zoom = doc.getElementById('cardZoom');
    const overlay = doc.getElementById('overlay');
    const root = zoom || (overlay && !overlay.hidden ? doc.getElementById('ovBody') : null);
    const nextPage = root?.querySelector('.hub-page') || root;
    if (nextPage !== page || nextPage?.firstElementChild !== firstChild) {
      page = nextPage;
      firstChild = page?.firstElementChild;
      images = [...(page?.querySelectorAll('img[src]') || [])];
      deadline = null;
    }
    // One broken/stalled image must not prevent the complete preload catalogue
    // from progressing. A new foreground page gets its own courtesy window.
    if (deadline !== null && now() >= deadline) return false;
    const width = doc.documentElement.clientWidth || globalThis.innerWidth || 0;
    const height = doc.documentElement.clientHeight || globalThis.innerHeight || 0;
    const pending = images.some(image => {
      if (image.complete || !image.isConnected || !image.getClientRects().length) return false;
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < width && rect.top < height;
    });
    if (!pending) return false;
    if (deadline === null) deadline = now() + maxWait;
    return now() < deadline;
  };
}
