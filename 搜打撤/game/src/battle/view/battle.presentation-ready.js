/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
// 每个挂载的舞台等待真正的解码/首帧结果；简化显示选择按场次保留。
export function waitForBattleImages(root) {
  const cleanups = [];
  const promises = [.../** @type {NodeListOf<HTMLImageElement>} */ (root.querySelectorAll('.sts-figure img[src], .sts-hand .hsc-art img[src], .sts-hand .hsc-frame[src]'))].map(image => new Promise(resolve => {
    image.loading = 'eager';
    let currentSource = image.src, settled = false;
    const clean = () => { image.removeEventListener('load', loaded); image.removeEventListener('error', failed); };
    const done = success => {
      if (settled) return;
      settled = true; clean();
      image.dataset.battleAsset = success ? 'ready' : 'failed';
      resolve(success);
    };
    const loaded = () => {
      currentSource = image.src;
      const decodingSource = currentSource;
      if (!image.naturalWidth) { done(false); return; }
      try {
        if (typeof image.decode === 'function') image.decode().then(
          () => { if (image.src === decodingSource) done(true); },
          () => { if (image.src === decodingSource) done(false); },
        );
        else done(true);
      } catch { done(false); }
    };
    const failed = () => {
      // 预烘抠图的 onerror 可能已切回原图，继续等该兜底图，而非把旧请求算失败。
      if (image.src !== currentSource) { currentSource = image.src; return; }
      done(false);
    };
    cleanups.push(() => { settled = true; clean(); });
    image.addEventListener('load', loaded);
    image.addEventListener('error', failed);
    if (image.complete) loaded();
  }));
  return { promise: Promise.all(promises).then(results => results.every(Boolean)), cancel: () => cleanups.forEach(clean => clean()) };
}

export function createBattleEntryGate({ timeoutMs = 8000 } = {}) {
  let active = null, completed = null;
  const simplified = stage => {
    // 顶栏常驻，遭遇信息会随回合替换；提示跟随本场次，不能被该局部更新吞掉。
    const host = /** @type {BattleElement} */ (stage.querySelector('.sts-topbar')) || /** @type {BattleElement} */ (stage.querySelector('.sts-encounter'));
    if (host && !/** @type {BattleElement} */ (stage.querySelector('.battle-entry-note'))) {
      const note = document.createElement('span'); note.className = 'battle-entry-note'; note.textContent = '部分美术未就绪 · 简化显示';
      note.setAttribute('role', 'status'); host.insertBefore(note, /** @type {BattleElement} */ (host.querySelector(':scope > .sts-options')));
    }
    /** @type {NodeListOf<HTMLImageElement>} */ (stage.querySelectorAll('.sts-figure img')).forEach(image => {
      if (image.complete && image.naturalWidth) return;
      image.hidden = true;
      const figure = /** @type {BattleElement} */ (image.closest('.sts-figure')); figure.dataset.fallbackLabel = image.alt || '立绘暂不可用';
      figure.classList.add('battle-figure-fallback');
    });
  };
  const current = record => active === record && record.stage.isConnected && record.overlay.contains(record.stage)
    && !record.overlay.hidden && record.stage._battleToken === record.token;
  const dispose = record => {
    clearTimeout(record.timer); record.observer?.disconnect(); record.cancelImages?.();
    record.status.remove(); record.stage.inert = record.wasInert;
    record.stage.removeAttribute('aria-busy');
  };
  const cancel = () => {
    if (!active) return;
    const record = active; active = null; dispose(record);
    record.stage.removeAttribute('data-battle-entry');
    record.resolveReady(false);
  };
  function begin(stage, token, overlay) {
    if (active?.stage === stage && active.token === token) return;
    cancel();
    // 同场返回会重建场景与角色帧，旧舞台的 ready 不代表新资源已可见。
    // 明确选择的简化显示按场次保留；已就绪的同一舞台才无需再次等待。
    if (completed?.token === token && (completed.state === 'degraded' || completed.stage === stage)) {
      completed = { ...completed, stage, overlay };
      stage.dataset.battleEntry = completed.state;
      if (completed.state === 'degraded') simplified(stage);
      return;
    }
    completed = null;
    /** @type {NodeListOf<BattleElement>} */ (stage.querySelectorAll('.battle-entry-note')).forEach(note => note.remove());
    // 通用节点过场由 enterNode 播放；这里只保留资源失败/超时的操作提示。
    const status = document.createElement('div');
    status.className = 'battle-entry-status'; status.hidden = true;
    status.setAttribute('role', 'status');
    status.innerHTML = '<h2>正在准备战场</h2><p>正在准备场景与参战单位…</p><button type="button" hidden>以简化画面继续</button>';
    let resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });
    const record = { stage, token, overlay, status, wasInert: !!stage.inert, started: false, ready, resolveReady };
    active = record;
    stage.inert = true; stage.dataset.battleEntry = 'loading'; stage.setAttribute('aria-busy', 'true');
    overlay.appendChild(status);
    /** @type {HTMLButtonElement} */ (status.querySelector('button')).addEventListener('click', () => {
      if (!current(record)) return;
      record.onFallback?.();
      finish(record, 'degraded');
    });
    record.observer = new MutationObserver(() => { if (active === record && !current(record)) cancel(); });
    record.observer.observe(overlay, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  }
  function finish(record, state) {
    if (!current(record)) return;
    active = null; dispose(record); record.stage.dataset.battleEntry = state;
    completed = { token: record.token, state, stage: record.stage, overlay: record.overlay };
    if (state === 'degraded') simplified(record.stage);
    record.resolveReady(true);
  }
  function failed(record, reason) {
    if (!current(record)) return;
    if (reason === 'error') clearTimeout(record.timer);
    record.stage.dataset.battleEntry = 'waiting';
    record.status.hidden = false;
    /** @type {BattleElement} */ (record.status.querySelector('h2')).textContent = reason === 'timeout' ? '资源准备仍未完成' : '部分画面资源加载失败';
    /** @type {BattleElement} */ (record.status.querySelector('p')).textContent = '可以继续等待，或使用简化画面继续战斗。';
    /** @type {HTMLButtonElement} */ (record.status.querySelector('button')).hidden = false;
  }
  /** @param {HTMLElement} stage @param {number} token @param {Promise<unknown>[]} dependencies @param {{cancelImages?: () => void, onFallback?: () => void}} [options] */
  function wait(stage, token, dependencies, { cancelImages, onFallback } = {}) {
    const record = active;
    if (!record || record.stage !== stage || record.token !== token || record.started) { cancelImages?.(); return; }
    record.started = true; record.cancelImages = cancelImages; record.onFallback = onFallback;
    record.timer = setTimeout(() => failed(record, 'timeout'), timeoutMs);
    Promise.all(dependencies).then(results => {
      if (results.some(result => result === false)) failed(record, 'error');
      else finish(record, 'ready');
    }, () => failed(record, 'error'));
  }
  function blockKeys(event) {
    if (!active) return;
    if (!current(active)) { cancel(); return; }
    event.stopImmediatePropagation();
    if (event.key === 'Tab') { event.preventDefault(); /** @type {HTMLButtonElement} */ (active.status.querySelector('button:not([hidden])'))?.focus(); }
  }
  function ready(stage, token) {
    if (active?.stage === stage && active.token === token) return current(active) ? active.ready : Promise.resolve(false);
    return Promise.resolve(!!(completed?.token === token && stage?._battleToken === token
      && stage.isConnected && !completed.overlay.hidden && completed.overlay.contains(stage)
      && completed.stage === stage));
  }
  document.addEventListener('keydown', blockKeys, true);
  return { begin, wait, cancel, ready, pending: stage => active?.stage === stage && !active.started,
    dispose() { cancel(); completed = null; document.removeEventListener('keydown', blockKeys, true); } };
}
