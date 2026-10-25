/* 照相馆缩略图预解码预热。
   近视口才赋 src，异步解码；局部挂载可只扫描新增子树。 */
import { createListImageRecovery } from '../ui/list-image-recovery.js';

const MAX_LIB_ART_DECODE_CONCURRENCY = 4;
const LIB_ART_DECODE_TIMEOUT = 2500;
const MAX_LIB_ART_ATTEMPTS = 2;
let libArtSession = null;
let libArtRoot = null;

function imageSource(image) {
  return image.dataset.libSrc || image.getAttribute('src') || '';
}

function isInGrid(image, grid) {
  return image.isConnected && (image === grid || grid.contains(image));
}

function makeLibArtSession(grid) {
  const session = {
    grid,
    observer: null,
    queue: [],
    active: 0,
    states: new WeakMap(), tasks:new Set(), retryTimers:new Set(), pumpQueued:false,
  };
  session.recovery = createListImageRecovery({ root:grid, selector:'.studio-photo-art img',
    host:grid.parentElement || grid, listen:false, source:imageSource,
    current:() => libArtSession === session,
    onRecovered:(image, src) => {
      delete image.dataset.libSrc;
      const state = session.states.get(image);
      if (state?.src === src) state.status = 'ready';
      image.dataset.libArtState = 'ready';
    },
  });
  return session;
}

function enqueueLibImage(session, image, src, scope) {
  if (libArtSession !== session || !src) return;
  const previous = session.states.get(image);
  if (previous?.src === src && (['queued','decoding','ready'].includes(previous.status)
    || previous.attempts >= MAX_LIB_ART_ATTEMPTS)) return;
  const state = previous?.src === src ? previous : { src, status:'observed', attempts:0 };
  state.status = 'queued';
  session.states.set(image, state);
  session.queue.push({ image, src, scope });
  pumpLibArtQueue(session);
}

function currentScope(session, image, scope, src) {
  return libArtSession === session && image.isConnected && scope.contains(image)
    && (scope === session.grid || scope === document.getElementById('libPreview')) && imageSource(image) === src;
}

function finishLibArtTask(task, reason) {
  if (task.done) return;
  task.done = true;
  const { session, image, scope, src, state } = task;
  clearTimeout(task.timer);
  image.removeEventListener('load', task.loaded);
  image.removeEventListener('error', task.failed);
  session.tasks.delete(task);
  session.active = Math.max(0, session.active - 1);
  if (reason !== 'cancelled' && currentScope(session, image, scope, src) && session.states.get(image) === state) {
    if (reason === 'timeout' && !image.complete) {
      image.dataset.libSrc = src;
      image.removeAttribute('src');
    }
    const ready = image.complete && image.naturalWidth > 0;
    state.status = ready ? 'ready' : reason === 'timeout' ? 'timed-out' : 'failed';
    image.dataset.libArtState = state.status;
    image.dataset.visualState = ready ? 'ready' : 'unavailable';
    if (!ready && state.attempts >= MAX_LIB_ART_ATTEMPTS && scope === session.grid) session.recovery.fail(image, src);
    if (!ready && state.attempts < MAX_LIB_ART_ATTEMPTS) {
      const retry = setTimeout(() => {
        session.retryTimers.delete(retry);
        if (currentScope(session, image, scope, src) && session.states.get(image) === state
          && ['failed','timed-out'].includes(state.status) && !scope.closest('[hidden],.closing')) enqueueLibImage(session, image, src, scope);
      }, 350);
      session.retryTimers.add(retry);
    }
  }
  // Decode has no abort API. Its bound completion record releases DOM references now.
  task.image = task.scope = task.session = task.state = null;
  if (libArtSession === session && !session.pumpQueued) {
    session.pumpQueued = true;
    queueMicrotask(() => { session.pumpQueued = false; pumpLibArtQueue(session); });
  }
}

function pumpLibArtQueue(session) {
  if (libArtSession !== session) return;
  while (session.active < MAX_LIB_ART_DECODE_CONCURRENCY && session.queue.length) {
    const { image, src, scope } = session.queue.shift();
    const state = session.states.get(image);
    if (state?.src !== src || !image.isConnected || !scope.contains(image)
      || !(scope === session.grid || scope === document.getElementById('libPreview'))) {
      if (state?.src === src && state.status === 'queued') state.status = 'observed';
      continue;
    }
    session.active += 1;
    state.status = 'decoding'; state.attempts += 1;
    image.dataset.libArtState = 'decoding';
    image.loading = 'eager';
    const task = { session, image, scope, src, state, done:false, decoding:false, timer:null, loaded:null, failed:null };
    task.loaded = () => { if (!task.decoding) finishLibArtTask(task, 'loaded'); };
    task.failed = finishLibArtTask.bind(null, task, 'failed');
    session.tasks.add(task);
    image.addEventListener('load', task.loaded, { once:true });
    image.addEventListener('error', task.failed, { once:true });
    task.timer = setTimeout(finishLibArtTask, LIB_ART_DECODE_TIMEOUT, task, 'timeout');
    if (image.dataset.libSrc === src || state.attempts > 1) {
      image.src = src;
      delete image.dataset.libSrc;
    }
    try {
      const decoded = image.decode?.();
      if (decoded) {
        task.decoding = true;
        Promise.resolve(decoded).then(finishLibArtTask.bind(null, task, 'decoded'), task.failed);
      }
      else if (image.complete) finishLibArtTask(task, image.naturalWidth > 0 ? 'loaded' : 'failed');
    } catch {
      if (image.complete) finishLibArtTask(task, image.naturalWidth > 0 ? 'loaded' : 'failed');
    }
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
  if (previous?.src === src && (['queued','decoding','ready'].includes(previous.status)
    || previous.attempts >= MAX_LIB_ART_ATTEMPTS)) return;
  if (previous?.src !== src) session.states.set(image, { src, status: 'observed', attempts:0 });
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
  libArtSession = null;
  libArtRoot = null;
  if (oldSession) {
    oldSession.recovery.dispose();
    oldSession.queue.length = 0;
    for (const timer of oldSession.retryTimers) clearTimeout(timer);
    oldSession.retryTimers.clear();
    for (const task of [...oldSession.tasks]) finishLibArtTask(task, 'cancelled');
  }
}
