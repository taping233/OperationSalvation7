// Development-only Vite page probe. Enabled by ?perfProbe=1, never by normal play.
const DURATION_MS = 6000;

function p95(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

const round = value => value == null ? null : +value.toFixed(2);

export function summarizePerfSample({ mode, elapsed, gaps, draws, longTasks, viewport, loopTicks }) {
  return {
    mode,
    elapsedMs: round(elapsed),
    viewport,
    frameCallbacks: gaps.length,
    rafHz: round(gaps.length * 1000 / elapsed),
    frameP95Ms: round(p95(gaps)),
    over20msPercent: round(gaps.filter(gap => gap > 20).length * 100 / Math.max(1, gaps.length)),
    drawCalls: draws.length,
    drawHz: round(draws.length * 1000 / elapsed),
    drawP95Ms: round(p95(draws)),
    drawMaxMs: round(draws.length ? Math.max(...draws) : null),
    longTasks: longTasks.length,
    longTaskMaxMs: round(longTasks.length ? Math.max(...longTasks) : null),
    loopTicks,
    visible: document.visibilityState === 'visible',
  };
}

export function installPerfProbe({ SDT, game, canvas, renderScheduler }) {
  if (!SDT?.Renderer?.draw || !canvas || document.getElementById('vitePerfProbe')) return;
  const panel = document.createElement('aside');
  panel.id = 'vitePerfProbe';
  panel.style.cssText = 'position:fixed;right:10px;top:60px;z-index:99999;width:300px;max-width:90vw;padding:10px;background:#101820ee;color:#fff;border:1px solid #e0a458;font:12px/1.4 monospace';
  panel.innerHTML = '<b>Vite 地图性能探针</b><p>仅开发模式；每次 6 秒，前台当前窗口。</p>'
    + '<button type="button" data-perf="idle">测静止地图</button> '
    + '<button type="button" data-perf="pan">测受控平移</button> '
    + '<button type="button" data-perf="loads">读加载</button>'
    + '<pre id="vitePerfResult" data-state="idle" style="white-space:pre-wrap;max-height:240px;overflow:auto">先进入地图，再选择场景。</pre>';
  document.body.append(panel);
  const result = panel.querySelector('#vitePerfResult');
  let busy = false;
  const onIdleMap = () => game?.runActive && game.state === 'idle' && !game.battleActive
    && document.getElementById('overlay')?.hidden !== false;

  async function sample(mode) {
    if (busy) return;
    if (!game?.cam || !onIdleMap() || !document.getElementById('title')?.hidden) {
      result.textContent = '请先进入未被弹层遮挡的静止远征地图。';
      return;
    }
    if (document.visibilityState !== 'visible') {
      result.textContent = '窗口不可见，采样无效。';
      return;
    }
    busy = true;
    result.dataset.state = 'running';
    result.textContent = '采样中：' + mode;
    const camera = game.cam;
    const previousCamera = { cx: camera.cx, cy: camera.cy, zoom: camera.zoom, frameMode: camera.frameMode };
    const rect = canvas.getBoundingClientRect();
    const viewport = {
      cssWidth: round(rect.width), cssHeight: round(rect.height),
      bufferWidth: canvas.width, bufferHeight: canvas.height,
      dpr: window.devicePixelRatio || 1,
    };
    const loopStart = SDT.__frameStats?.loopTicks || 0;
    const started = performance.now();
    const gaps = [], draws = [], longTasks = [];
    let previousFrame = 0;
    const originalDraw = SDT.Renderer.draw;
    const measuredDraw = function (...args) {
      const before = performance.now();
      try { return originalDraw.apply(this, args); }
      finally { draws.push(performance.now() - before); }
    };
    SDT.Renderer.draw = measuredDraw;
    const observer = typeof PerformanceObserver === 'function'
      ? new PerformanceObserver(list => list.getEntries().forEach(entry => longTasks.push(entry.duration)))
      : null;
    try { observer?.observe({ type: 'longtask', buffered: false }); } catch { observer?.disconnect(); }

    let timeoutId, frameId = 0, stopped = false;
    try {
      const ended = await new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('rAF 停止或页面转入后台')), DURATION_MS + 3000);
        const tick = now => {
          if (stopped) return;
          try {
            if (document.visibilityState !== 'visible') throw new Error('页面采样期间不可见');
            if (!onIdleMap()) throw new Error('采样期间离开静止地图');
            if (previousFrame) gaps.push(now - previousFrame);
            previousFrame = now;
            if (mode === 'pan') {
              camera.cx = previousCamera.cx + Math.sin((now - started) / 450) * 36;
              camera.cy = previousCamera.cy + Math.cos((now - started) / 620) * 24;
              camera.frameMode = 'manual';
              renderScheduler.invalidate();
            }
            if (now - started < DURATION_MS) { frameId = requestAnimationFrame(tick); return; }
            resolve(now);
          } catch (error) { reject(error); }
        };
        frameId = requestAnimationFrame(tick);
      });
      const summary = summarizePerfSample({ mode, elapsed: ended - started, gaps, draws, longTasks,
        viewport, loopTicks: (SDT.__frameStats?.loopTicks || 0) - loopStart });
      result.textContent = JSON.stringify(summary, null, 2);
      result.dataset.state = 'done';
      console.info('[vite-perf]', JSON.stringify(summary));
    } finally {
      stopped = true;
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
      observer?.disconnect();
      if (SDT.Renderer.draw === measuredDraw) SDT.Renderer.draw = originalDraw;
      Object.assign(camera, previousCamera);
      renderScheduler.invalidate();
      busy = false;
    }
  }

  panel.addEventListener('click', event => {
    if (busy) return;
    const mode = event.target.closest('button[data-perf]')?.dataset.perf;
    if (mode === 'loads') {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const summary = {
        mode: 'loads',
        navigation: navigation ? {
          responseEndMs: round(navigation.responseEnd),
          domContentLoadedMs: round(navigation.domContentLoadedEventEnd),
          loadEventMs: round(navigation.loadEventEnd),
        } : null,
        paint: performance.getEntriesByType('paint').map(entry => [entry.name, round(entry.startTime)]),
        battleModuleLoadsMs: performance.getEntriesByName('sdt:battle-load', 'measure')
          .map(entry => round(entry.duration)),
        battleFrameLoads: performance.getEntriesByType('measure')
          .filter(entry => entry.name.startsWith('sdt:battle-frames-'))
          .map(entry => [entry.name.slice('sdt:battle-frames-'.length), round(entry.duration)]),
        resourceCount: resources.length,
        resourceTransferKiB: round(resources.reduce((sum, entry) => sum + entry.transferSize, 0) / 1024),
      };
      result.textContent = JSON.stringify(summary, null, 2);
      result.dataset.state = 'done';
      console.info('[vite-perf]', JSON.stringify(summary));
      return;
    }
    if (mode) sample(mode).catch(error => {
      result.textContent = '采样失败：' + error.message;
      result.dataset.state = 'error';
      busy = false;
    });
  });
}
