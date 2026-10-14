// 每场只揭示一次；等待真正的解码/首帧结果，超时只开放明确的简化显示选择。
export function waitForBattleImages(root) {
  const cleanups = [];
  const promises = [...root.querySelectorAll('.sts-figure img[src], .sts-hand .hsc-art img[src]')].map(image => new Promise(resolve => {
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
    const host = stage.querySelector('.sts-topbar') || stage.querySelector('.sts-encounter');
    if (host && !stage.querySelector('.battle-entry-note')) {
      const note = document.createElement('span'); note.className = 'battle-entry-note'; note.textContent = '部分美术未就绪 · 简化显示';
      note.setAttribute('role', 'status'); host.insertBefore(note, host.querySelector(':scope > .sts-options'));
    }
    stage.querySelectorAll('.sts-figure img').forEach(image => {
      if (image.complete && image.naturalWidth) return;
      image.hidden = true;
      const figure = image.closest('.sts-figure'); figure.dataset.fallbackLabel = image.alt || '立绘暂不可用';
      figure.classList.add('battle-figure-fallback');
    });
  };
  const current = record => active === record && record.stage.isConnected && record.overlay.contains(record.stage)
    && !record.overlay.hidden && record.stage._battleToken === record.token;
  const dispose = record => {
    clearTimeout(record.timer); record.observer?.disconnect(); record.cancelImages?.();
    record.curtain.remove(); record.stage.inert = record.wasInert;
    record.stage.removeAttribute('aria-busy');
  };
  const cancel = () => {
    if (!active) return;
    const record = active; active = null; dispose(record);
    record.stage.removeAttribute('data-battle-entry');
  };
  function begin(stage, token, overlay) {
    if (active?.stage === stage && active.token === token) return;
    cancel();
    // 选择面板返回会重建舞台；同一场已揭示的结果按 token 保留，新战斗仍需重新就绪。
    if (completed?.token === token) {
      stage.dataset.battleEntry = completed.state;
      if (completed.state === 'degraded') simplified(stage);
      return;
    }
    completed = null;
    stage.querySelectorAll('.battle-entry-note').forEach(note => note.remove());
    const curtain = document.createElement('div');
    curtain.className = 'battle-entry-curtain';
    curtain.innerHTML = '<div class="battle-entry-copy" role="status"><span>接敌准备</span><h2>正在进入战场</h2><p>正在准备场景与参战单位…</p><button type="button" hidden>以简化画面继续</button></div>';
    const record = { stage, token, overlay, curtain, wasInert: !!stage.inert, started: false };
    active = record;
    stage.inert = true; stage.dataset.battleEntry = 'loading'; stage.setAttribute('aria-busy', 'true');
    overlay.appendChild(curtain);
    curtain.querySelector('button').addEventListener('click', () => {
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
    completed = { token: record.token, state };
    if (state === 'degraded') simplified(record.stage);
  }
  function failed(record, reason) {
    if (!current(record)) return;
    if (reason === 'error') clearTimeout(record.timer);
    record.stage.dataset.battleEntry = 'waiting';
    record.curtain.querySelector('h2').textContent = reason === 'timeout' ? '资源准备仍未完成' : '部分战场资源加载失败';
    record.curtain.querySelector('p').textContent = '可以继续等待，或使用简化画面进入战斗。';
    record.curtain.querySelector('button').hidden = false;
  }
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
    if (event.key === 'Tab') { event.preventDefault(); active.curtain.querySelector('button:not([hidden])')?.focus(); }
  }
  document.addEventListener('keydown', blockKeys, true);
  return { begin, wait, cancel, pending: stage => active?.stage === stage && !active.started,
    dispose() { cancel(); completed = null; document.removeEventListener('keydown', blockKeys, true); } };
}
