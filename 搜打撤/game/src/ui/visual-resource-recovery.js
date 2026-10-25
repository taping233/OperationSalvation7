import '../../css/visual-resource-recovery.css';

// Shared local recovery markup; the caller owns validity, work and disposal.
export function createVisualRecoveryNotice({ host, label, onRetry, floating = false }) {
  const panel = document.createElement('div');
  panel.className = `visual-resource-recovery${floating ? ' is-floating' : ''}`;
  const message = document.createElement('span');
  message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  message.textContent = label;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'ui-control';
  const text = document.createElement('span'); text.className = 'ui-control-label'; text.textContent = '重新加载';
  button.append(text);
  button.addEventListener('click', event => { event.stopPropagation(); onRetry(); });
  panel.addEventListener('click', event => event.stopPropagation());
  panel.append(message, button); host.append(panel);
  return { panel, message, button };
}

// Only the clearable record is retained by an unabortable decode promise.
function finishProbe(task, ready, cancelled = false) {
  if (task.done) return;
  task.done = true;
  clearTimeout(task.timer);
  const image = task.image, done = task.onDone;
  image.onload = image.onerror = null;
  task.image = task.onDone = null;
  if (cancelled || !ready) image.removeAttribute('src');
  if (!cancelled) done?.(ready && image.naturalWidth > 0, image);
}

/** Recover one visual resource in its current mounted surface; no page reload or cache busting. */
export function createVisualResourceRecovery({ host, source, apply, label = '图片未能加载',
  isCurrent = () => true, floating = false, timeout = 6000, observe = host, onDispose = () => {},
  notice = true, onStatus = /** @type {(status: 'unavailable' | 'loading' | 'ready' | 'cancelled') => void} */ (() => {}) }) {
  let disposed = false, request = null, panel = null, message = null, button = null;
  const current = () => !disposed && host.isConnected && isCurrent()
    && !host.closest('.closing,[data-ui-closing]') && !host.closest('#overlay[hidden]');
  const removePanel = () => {
    if (!panel) return;
    // A successful retry must not leave focus on a removed button.
    const focused = panel.contains(document.activeElement);
    panel.remove(); panel = message = button = null;
    if (focused && current()) {
      const next = host.querySelector('button:not(:disabled),[tabindex="0"]');
      if (next) next.focus({ preventScroll:true });
      else { const old = host.getAttribute('tabindex'); host.tabIndex = -1; host.focus({ preventScroll:true });
        if (old === null) host.removeAttribute('tabindex'); else host.setAttribute('tabindex', old); }
    }
  };
  const showFailure = () => {
    if (!current()) { dispose(); return; }
    if (request) return;
    onStatus('unavailable');
    if (!notice) return;
    if (!panel) {
      ({ panel, message, button } = createVisualRecoveryNotice({ host, label, floating, onRetry:load }));
    }
    message.textContent = label; button.disabled = false; button.removeAttribute('aria-busy');
  };
  const load = () => {
    if (!current()) { dispose(); return; }
    if (request) return;
    const src = typeof source === 'function' ? source() : source;
    if (!src) { showFailure(); return; }
    onStatus('loading');
    if (panel) { message.textContent = '正在重新加载…'; button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    const image = new Image(); image.decoding = 'async';
    const task = { image, done:false, decoding:false, timer:null, onDone:(ready, loaded) => {
      if (request !== task) return;
      request = null;
      if (!current() || src !== (typeof source === 'function' ? source() : source)) { dispose(); return; }
      if (!ready) { showFailure(); return; }
      try { apply(loaded); removePanel(); onStatus('ready'); }
      catch { showFailure(); }
    } };
    request = task;
    image.onload = () => { if (!task.decoding) finishProbe(task, true); };
    image.onerror = finishProbe.bind(null, task, false, false);
    task.timer = setTimeout(finishProbe, timeout, task, false);
    image.src = src;
    try {
      const decoded = image.decode?.();
      if (decoded) { task.decoding = true; decoded.then(finishProbe.bind(null, task, true, false), finishProbe.bind(null, task, false, false)); }
      else if (image.complete) finishProbe(task, image.naturalWidth > 0);
    } catch {
      if (image.complete) finishProbe(task, image.naturalWidth > 0);
    }
  };
  function dispose() {
    if (disposed) return;
    disposed = true; observer.disconnect();
    if (request) finishProbe(request, false, true);
    request = null; removePanel();
    onStatus('cancelled');
    onDispose();
  }
  const observer = new MutationObserver(() => { if (!current()) dispose(); });
  for (let node = host; node; node = node.parentElement) observer.observe(node, {
    childList:true, attributes:true, attributeFilter:['hidden','class','data-ui-closing'],
  });
  if (observe !== host) observer.observe(observe, { attributes:true, attributeFilter:['src','srcset'] });
  return { load, fail:showFailure, dispose, ready:() => {
    if (request) finishProbe(request, false, true);
    request = null; removePanel();
  } };
}

const criticalRecoveries = new WeakMap();
export function watchCriticalImageRecovery(image) {
  if (!image.hasAttribute('data-visual-critical') || !image.isConnected) return;
  const src = image.currentSrc || image.src;
  if (!src) return;
  const previous = criticalRecoveries.get(image);
  if (previous?.src === src) return previous.recovery;
  previous?.recovery.dispose();
  const host = image.closest('figure') || image.parentElement?.querySelector('.se-text') || image.parentElement;
  if (!host) return;
  const sourceAttribute = image.getAttribute('src'), sourceSet = image.getAttribute('srcset');
  const imageCurrent = () => image.isConnected && image.getAttribute('src') === sourceAttribute
    && image.getAttribute('srcset') === sourceSet;
  const entry = { src, recovery:null, timer:null };
  const loaded = () => {
    if (!imageCurrent()) { entry.recovery.dispose(); return; }
    clearTimeout(entry.timer);
    if (image.naturalWidth > 0) { image.dataset.visualState = 'ready'; entry.recovery.ready(); }
    else failed();
  };
  const failed = () => {
    if (!imageCurrent()) { entry.recovery.dispose(); return; }
    clearTimeout(entry.timer);
    image.dataset.visualState = 'unavailable'; entry.recovery.fail();
  };
  const recovery = createVisualResourceRecovery({ host, source:src, observe:image,
    label: `${image.alt || '图片'}暂未加载`,
    isCurrent:imageCurrent,
    apply:loaded => { image.src = loaded.src; image.dataset.visualState = 'ready'; },
    onDispose:() => {
      clearTimeout(entry.timer); image.removeEventListener('load', loaded); image.removeEventListener('error', failed);
      if (criticalRecoveries.get(image) === entry) criticalRecoveries.delete(image);
    },
  });
  entry.recovery = recovery; criticalRecoveries.set(image, entry);
  image.addEventListener('load', loaded); image.addEventListener('error', failed);
  // Page-entry cancellation ends its own wait, not this mounted image's recovery.
  if (image.complete) loaded();
  else entry.timer = setTimeout(failed, 6000);
  return recovery;
}

export function offerCriticalImageRecovery(image) {
  watchCriticalImageRecovery(image)?.fail();
}
