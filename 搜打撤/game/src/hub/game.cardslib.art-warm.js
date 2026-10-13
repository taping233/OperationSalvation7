/* 照相馆缩略图预解码预热。
   近视口才赋 src，异步解码；局部挂载可只扫描新增子树。 */

const MAX_LIB_ART_DECODE_CONCURRENCY = 4;
let libArtSession = null;
let libArtRoot = null;

function imageSource(image) {
  return image.dataset.libSrc || image.getAttribute('src') || '';
}

function isInGrid(image, grid) {
  return image.isConnected && (image === grid || grid.contains(image));
}

function makeLibArtSession(grid) {
  return {
    grid,
    observer: null,
    queue: [],
    active: 0,
    states: new WeakMap(),
  };
}

function enqueueLibImage(session, image, src, scope) {
  if (libArtSession !== session || !src) return;
  const previous = session.states.get(image);
  if (previous?.src === src && previous.status !== 'observed') return;
  session.states.set(image, { src, status: 'queued' });
  session.queue.push({ image, src, scope });
  pumpLibArtQueue(session);
}

function pumpLibArtQueue(session) {
  if (libArtSession !== session) return;
  while (session.active < MAX_LIB_ART_DECODE_CONCURRENCY && session.queue.length) {
    const item = session.queue.shift();
    const { image, src, scope } = item;
    const state = session.states.get(image);
    const currentScope = scope === session.grid || scope === document.getElementById('libPreview');
    if (state?.src !== src || !image.isConnected || !currentScope || !scope.contains(image)) continue;
    session.active += 1;
    state.status = 'decoding';
    image.loading = 'eager';
    if (image.dataset.libSrc === src) {
      image.src = src;
      delete image.dataset.libSrc;
    }
    let decoded;
    try { decoded = image.decode?.(); } catch { /* 解码失败或不支持时图片仍可显示 */ }
    Promise.resolve(decoded).catch(() => { /* 解码失败：忽略 */ }).finally(() => {
      session.active -= 1;
      if (libArtSession === session) pumpLibArtQueue(session);
    });
  }
}

function observeLibImage(session, image) {
  const src = imageSource(image);
  if (!src || !isInGrid(image, session.grid)) return;
  if (typeof IntersectionObserver !== 'function') {
    enqueueLibImage(session, image, src, session.grid);
    return;
  }
  const previous = session.states.get(image);
  if (previous?.src === src && previous.status !== 'observed') return;
  if (previous?.src !== src) session.states.set(image, { src, status: 'observed' });
  session.observer.observe(image);
}

function scanLibArtRoot(session, root, nearViewport = false) {
  if (!root || (root !== session.grid && !session.grid.contains(root))) return;
  const selector = '.studio-photo-art img[data-lib-src], .studio-photo-art img[src]';
  const images = [];
  if (root.matches?.(selector)) images.push(root);
  images.push(...root.querySelectorAll(selector));
  for (const image of images) {
    if (nearViewport) {
      session.observer?.unobserve(image);
      enqueueLibImage(session, image, imageSource(image), session.grid);
    } else observeLibImage(session, image);
  }
}

function ensureLibArtSession(grid) {
  if (libArtRoot !== grid || !libArtSession) {
    resetLibArtWarmup();
    libArtRoot = grid;
    const session = makeLibArtSession(grid);
    libArtSession = session;
    if (typeof IntersectionObserver === 'function') {
      session.observer = new IntersectionObserver(entries => {
        if (libArtSession !== session) return;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          session.observer.unobserve(entry.target);
          if (!isInGrid(entry.target, session.grid)) continue;
          const src = imageSource(entry.target);
          enqueueLibImage(session, entry.target, src, session.grid);
        }
      }, { root: grid, rootMargin: '100% 0px' });
    }
  }
  return libArtSession;
}

export function warmLibArt(options = {}) {
  const grid = document.getElementById('libGrid');
  if (!grid) return;
  const session = ensureLibArtSession(grid);
  const roots = Array.isArray(options.roots) ? options.roots : null;
  if (roots) {
    for (const root of roots) scanLibArtRoot(session, root, options.nearViewport === true);
  } else {
    scanLibArtRoot(session, grid);
  }

  if (options.preview !== false) {
    const preview = document.getElementById('libPreview');
    for (const image of document.querySelectorAll('#libPreview img[src]')) {
      const src = imageSource(image);
      if (preview && src && image.isConnected) enqueueLibImage(session, image, src, preview);
    }
  }
}

// 关页 / 筛选重绘时使旧 observer、队列与异步完成回调失效。
export function resetLibArtWarmup() {
  const oldSession = libArtSession;
  oldSession?.observer?.disconnect();
  if (oldSession) oldSession.queue.length = 0;
  libArtSession = null;
  libArtRoot = null;
}
