import { transitionDiagnosticPlain } from '../ui/transition-diagnostic-policy.js';
import { framesDiagnosticStatic } from '../battle/view/battle.frames-diagnostic-policy.js';
import { installFlightRecorder } from './flight-recorder.local.js';
// Development-only Vite page probe. Enabled by ?perfProbe=1, never by normal play.
const DURATION_MS = 6000;

function p95(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function p50(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const round = value => value == null ? null : +value.toFixed(2);

export function summarizePerfSample({ mode, elapsed, gaps, draws, longTasks, viewport, loopTicks }) {
  return {
    mode,
    elapsedMs: round(elapsed),
    viewport,
    rendererScope: 'SDT.Renderer.draw calls only; does not include Pixi frame compositing or other browser painting.',
    frameCallbacks: gaps.length,
    rafHz: round(gaps.length * 1000 / elapsed),
    rafMetricLabel: 'rAF callback rate; not screen FPS',
    screenFps: null,
    frameMedianMs: round(p50(gaps)),
    frameP95Ms: round(p95(gaps)),
    over20msPercent: round(gaps.filter(gap => gap > 20).length * 100 / Math.max(1, gaps.length)),
    drawCalls: draws.length,
    drawHz: round(draws.length * 1000 / elapsed),
    drawMedianMs: round(p50(draws)),
    drawP95Ms: round(p95(draws)),
    drawMaxMs: round(draws.length ? Math.max(...draws) : null),
    longTasks: longTasks.length,
    longTaskMaxMs: round(longTasks.length ? Math.max(...longTasks) : null),
    loopTicks,
    visible: document.visibilityState === 'visible',
  };
}

function isVisible(element) {
  if (!element) return false;
  for (let current = element; current && current !== document.documentElement; current = current.parentElement) {
    if (current.hidden) return false;
    const style = getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

function currentPageMechanism() {
  const overlay = document.getElementById('overlay');
  if (overlay && isVisible(overlay)) {
    const body = document.getElementById('ovBody');
    const root = body?.firstElementChild || body;
    const card = body?.parentElement;
    const rootId = root?.id || '';
    const rootClasses = [...(root?.classList || [])]
      .filter(name => !/^(swap|page-in|closing|entering|active|on|selected|sel|anim-|fx-victory)/.test(name))
      .sort();
    const overlayModes = ['battle', 'bag-modal', 'bag-page', 'chest', 'discover', 'page', 'scene', 'doom', 'glass']
      .filter(name => card?.classList.contains(name));
    const hubTab = rootClasses.find(name => /^hub-(deploy|stash|shop|upgrade|classes|ach)$/.test(name));
    let label = hubTab || ({ depMain: 'prep', exMain: 'extract' }[rootId]) || '';
    if (!label && (rootId === 'hubMain' || rootClasses.includes('hub'))) label = 'hub';
    if (!label && (rootClasses.includes('battle-stage') || overlayModes.includes('battle'))) label = 'battle';
    if (!label && (rootClasses.includes('card-library-page') || rootClasses.includes('clib-main'))) label = 'collection';
    if (!label && (rootClasses.includes('cls2-page') || rootClasses.includes('cls2-stage'))) label = 'character-select';
    if (!label && overlayModes.includes('chest')) label = 'loot';
    if (!label && overlayModes.includes('discover')) label = 'discover';
    if (!label && overlayModes.includes('doom')) label = 'terminal';
    if (!label) label = `overlay:${rootId || rootClasses.join('.') || overlayModes.join('.') || 'unknown'}`;
    return {
      label,
      signature: JSON.stringify(['overlay', rootId, rootClasses, overlayModes]),
      rootId: rootId || null,
      semanticClasses: rootClasses,
      overlayModes,
    };
  }

  const title = document.getElementById('title');
  if (isVisible(title)) return { label: 'title', signature: 'title', rootId: 'title', semanticClasses: [], overlayModes: [] };
  const viewport = document.getElementById('viewport');
  if (isVisible(viewport) && isVisible(document.getElementById('game'))) {
    return { label: 'map', signature: 'map', rootId: 'viewport', semanticClasses: [], overlayModes: [] };
  }
  const root = document.body.firstElementChild;
  const classes = [...(root?.classList || [])]
    .filter(name => !/^(swap|page-in|closing|entering|active|on|selected|sel|anim-|fx-victory)/.test(name))
    .sort();
  const rootId = root?.id || '';
  return {
    label: `page:${rootId || classes.join('.') || 'unknown'}`,
    signature: JSON.stringify(['page', rootId, classes]),
    rootId: rootId || null,
    semanticClasses: classes,
    overlayModes: [],
  };
}

function pageDomSnapshot() {
  const images = [...document.images];
  const canvases = [...document.querySelectorAll('canvas')];
  const foreground = currentPageMechanism();
  return {
    mechanism: foreground.label,
    mechanismSignature: foreground.signature,
    foregroundRootId: foreground.rootId,
    foregroundSemanticClasses: foreground.semanticClasses,
    foregroundOverlayModes: foreground.overlayModes,
    domElements: document.querySelectorAll('*').length,
    images: images.length,
    imageComplete: images.filter(image => image.complete).length,
    imageDecoded: images.filter(image => image.complete && image.naturalWidth > 0).length,
    canvases: canvases.length,
    canvasSizes: canvases.map(canvas => ({ width: canvas.width, height: canvas.height })),
  };
}

export function installPerfProbe({ SDT, game, canvas, renderScheduler }) {
  if (!SDT?.Renderer?.draw || !canvas || document.getElementById('vitePerfProbe')) return;
  const flight = new URLSearchParams(location.search).get('flightRecord') === '1' ? installFlightRecorder({ SDT, game }) : null;
  const panel = document.createElement('aside');
  panel.id = 'vitePerfProbe';
  panel.style.cssText = 'position:fixed;left:0;top:50%;z-index:99999;box-sizing:border-box;width:24px;height:64px;padding:0;background:#101820ee;color:#fff;border:1px solid #e0a458;border-radius:0 6px 6px 0;font:12px/1.4 monospace;transform:translateY(-50%)';
  panel.dataset.collapsed = 'true';
  panel.innerHTML = '<button type="button" data-perf-toggle data-perf-handle aria-label="展开性能探针" aria-expanded="false" style="box-sizing:border-box;width:24px;height:64px;padding:2px;writing-mode:vertical-rl">性能</button>'
    + '<section data-perf-panel hidden><header><b>Vite 页面性能探针</b> '
    + '<button type="button" data-perf-toggle aria-expanded="true">收起</button></header>'
    + '<p>仅开发模式；每次 6 秒，前台当前窗口。rAF 回调率不等于屏幕 FPS；draw 只统计 SDT.Renderer，不含 Pixi 合成。</p>'
    + '<button type="button" data-perf="page">测当前页面</button> '
    + '<button type="button" data-perf="idle">测静止地图</button> '
    + '<button type="button" data-perf="pan">测受控平移</button> '
    + '<button type="button" data-perf="loads">读加载</button> '
    + '<button type="button" data-perf="music">读音乐</button>'
    + '<button type="button" data-perf="flight">读故障记录</button>'
    + '<button type="button" data-perf="frames">读角色帧</button>'
    + `<p id="vitePerfTransition" aria-label="入战切幕模式">入战切幕：${transitionDiagnosticPlain(import.meta.env.DEV, location.search) ? 'plain（DEV纯色对照，原时长）' : '默认（跟随减少动态偏好）'}</p>`
    + '<details open><summary>角色帧资源（只读）</summary><small>展开/读角色帧刷新；采样中每秒刷新。RGBA为去重纹理像素估算，非RSS/GPU驻留；liveApps/session仅计帧模块。</small><pre id="vitePerfFrames" aria-label="角色帧资源快照" style="white-space:pre-wrap;max-height:200px;overflow:auto">尚未读取</pre></details>'
    + '<details open><summary>音乐播放（只读）</summary><small>展开/读音乐刷新；采样中每秒刷新。进度不代表已听到声音。</small>'
    + '<pre id="vitePerfMusic" aria-label="音乐播放快照" style="white-space:pre-wrap;max-height:180px;overflow:auto">尚未读取</pre></details>'
    + '<pre id="vitePerfResult" data-state="idle" style="white-space:pre-wrap;max-height:240px;overflow:auto">先选择场景。</pre></section>';
  document.body.append(panel);
  const overlay = document.getElementById('overlay');
  const syncForegroundMount = () => {
    const foreground = overlay && !overlay.hidden ? overlay : document.body;
    if (panel.parentElement !== foreground) foreground.append(panel);
    panel.removeAttribute('inert');
    panel.inert = false;
  };
  syncForegroundMount();
  let overlayVisibilityObserver;
  if (overlay && typeof MutationObserver === 'function') {
    overlayVisibilityObserver = new MutationObserver(records => {
      if (records.some(record => record.attributeName === 'hidden')) syncForegroundMount();
    });
    overlayVisibilityObserver.observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
  }
  const content = /** @type {HTMLElement | null} */ (panel.querySelector('[data-perf-panel]'));
  const result = /** @type {HTMLElement | null} */ (panel.querySelector('#vitePerfResult'));
  let busy = false;
  let abortCurrentSample = null;
  let destroyed = false;
  let musicReadAt = -Infinity;
  const musicResult = /** @type {HTMLElement | null} */ (panel.querySelector('#vitePerfMusic'));
  function refreshMusic(now = performance.now(), force = false) {
    if (destroyed || !panel.isConnected || content.hidden || document.visibilityState !== 'visible') return;
    if (!force && now - musicReadAt < 1000) return;
    musicReadAt = now;
    const frameResult = /** @type {HTMLElement | null} */ (panel.querySelector('#vitePerfFrames'));
    let frames;
    try { frames = SDT.Battle?._perf?.frameCacheStats?.() ?? { available: false, phase: 'before-entry',
      staticDiagnostic: framesDiagnosticStatic(import.meta.env.DEV, location.search) }; }
    catch { frames = { available: false, error: 'FrameSummaryUnavailable' }; }
    const frameText = JSON.stringify(frames, null, 2);
    if (frameResult.textContent !== frameText) frameResult.textContent = frameText;
    let snapshot;
    try {
      snapshot = SDT.Sound?.musicPlayback ?? { available: false, reason: '音乐快照接口不可用' };
    } catch (error) {
      snapshot = { available: false, error: String(error?.message || error) };
    }
    // One existing text node is updated only when the public snapshot changes.
    const text = JSON.stringify(snapshot, null, 2);
    if (musicResult.textContent !== text) musicResult.textContent = text;
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    abortCurrentSample?.(new Error('性能探针已销毁'));
    overlayVisibilityObserver?.disconnect();
    flight?.stop();
    panel.removeEventListener('click', onClick);
    window.removeEventListener('pagehide', destroy);
    panel.remove();
  }
  window.addEventListener('pagehide', destroy);

  const onIdleMap = () => game?.runActive && game.state === 'idle' && !game.battleActive
    && document.getElementById('overlay')?.hidden !== false;

  async function sample(mode) {
    if (busy || destroyed) return;
    const isMapSample = mode === 'idle' || mode === 'pan';
    if (isMapSample && (!game?.cam || !onIdleMap() || !document.getElementById('title')?.hidden)) {
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
    const camera = isMapSample ? game.cam : null;
    const previousCamera = camera ? { cx: camera.cx, cy: camera.cy, zoom: camera.zoom, frameMode: camera.frameMode } : null;
    const rect = canvas.getBoundingClientRect();
    const viewport = {
      cssWidth: round(rect.width), cssHeight: round(rect.height),
      bufferWidth: canvas.width, bufferHeight: canvas.height,
      dpr: window.devicePixelRatio || 1,
    };
    const loopStart = SDT.__frameStats?.loopTicks || 0;
    const started = performance.now();
    const pageStart = mode === 'page' ? pageDomSnapshot() : null;
    const resourceEntriesStart = mode === 'page' ? /** @type {PerformanceResourceTiming[]} */ (performance.getEntriesByType('resource')).length : 0;
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
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') abortCurrentSample?.(new Error('窗口不可见，采样已中止'));
    };
    try {
      const ended = await new Promise((resolve, reject) => {
        abortCurrentSample = error => {
          if (stopped) return;
          stopped = true;
          cancelAnimationFrame(frameId);
          reject(error);
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        timeoutId = setTimeout(() => reject(new Error('rAF 停止或页面转入后台')), DURATION_MS + 3000);
        const tick = now => {
          if (stopped) return;
          try {
            if (document.visibilityState !== 'visible') throw new Error('页面采样期间不可见');
            if (isMapSample && !onIdleMap()) throw new Error('采样期间离开静止地图');
            if (mode === 'page' && currentPageMechanism().signature !== pageStart.mechanismSignature) {
              throw new Error('采样期间页面机制已变化');
            }
            refreshMusic(now);
            if (previousFrame) gaps.push(now - previousFrame);
            previousFrame = now;
            if (mode === 'pan' && camera) {
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
      if (mode === 'page') {
        const resources = /** @type {PerformanceResourceTiming[]} */ (performance.getEntriesByType('resource'));
        const sampleResources = resources.filter(entry => entry.startTime >= started && entry.startTime <= ended);
        const pageEnd = pageDomSnapshot();
        Object.assign(summary, {
          pageStart,
          pageEnd,
          resourceTiming: {
            entriesAvailableAtStart: resourceEntriesStart,
            entriesAvailableAtEnd: resources.length,
            entriesDuringSample: sampleResources.length,
            transferBytesDuringSample: sampleResources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
            possibleBufferTruncation: resources.length >= 250,
            note: 'Resource Timing entries are browser-buffered and may be truncated; this count is not a full asset inventory.',
          },
        });
      }
      result.textContent = JSON.stringify(summary, null, 2);
      result.dataset.state = 'done';
      console.info('[vite-perf]', JSON.stringify(summary));
    } finally {
      stopped = true;
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      abortCurrentSample = null;
      observer?.disconnect();
      if (SDT.Renderer.draw === measuredDraw) SDT.Renderer.draw = originalDraw;
      if (camera && previousCamera) {
        Object.assign(camera, previousCamera);
        renderScheduler.invalidate();
      }
      busy = false;
      refreshMusic(performance.now(), true);
    }
  }

  function onClick(event) {
    const toggle = event.target.closest('[data-perf-toggle]');
    if (toggle) {
      const collapsed = panel.dataset.collapsed !== 'true';
      panel.dataset.collapsed = String(collapsed);
      content.hidden = collapsed;
      panel.style.left = collapsed ? '0' : 'auto';
      panel.style.right = collapsed ? 'auto' : '10px';
      panel.style.top = collapsed ? '50%' : '10px';
      panel.style.bottom = collapsed ? 'auto' : 'auto';
      panel.style.width = collapsed ? '24px' : '330px';
      panel.style.height = collapsed ? '64px' : 'auto';
      panel.style.padding = collapsed ? '0' : '8px';
      panel.style.transform = collapsed ? 'translateY(-50%)' : 'none';
      panel.querySelectorAll('[data-perf-toggle]').forEach(button => button.setAttribute('aria-expanded', String(!collapsed)));
      const handle = /** @type {HTMLElement | null} */ (panel.querySelector('[data-perf-handle]'));
      handle.textContent = collapsed ? '性能' : '性能探针 ▾';
      handle.setAttribute('aria-label', collapsed ? '展开性能探针' : '折叠性能探针');
      handle.style.width = collapsed ? '24px' : 'auto';
      handle.style.height = collapsed ? '64px' : 'auto';
      handle.style.writingMode = collapsed ? 'vertical-rl' : 'horizontal-tb';
      handle.style.textAlign = collapsed ? 'center' : 'left';
      if (collapsed) abortCurrentSample?.(new Error('性能探针已折叠，采样已中止'));
      else refreshMusic(performance.now(), true);
      return;
    }
    const mode = event.target.closest('button[data-perf]')?.dataset.perf;
    if (mode === 'flight') { result.textContent = JSON.stringify(flight?.read() || { enabled: false, hint: '追加 flightRecord=1 后重载启用；仅记录白名单摘要。' }, null, 2); result.dataset.state = 'done'; return; }
    if (mode === 'music' || mode === 'frames') { refreshMusic(performance.now(), true); return; }
    if (busy) return;
    refreshMusic(performance.now(), true);
    if (mode === 'loads') {
      const navigation = /** @type {PerformanceNavigationTiming | undefined} */ (performance.getEntriesByType('navigation')[0]);
      const resources = /** @type {PerformanceResourceTiming[]} */ (performance.getEntriesByType('resource'));
      const summary = {
        mode: 'loads',
        rafMetricLabel: 'rAF callback rate; not screen FPS',
        screenFps: null,
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
        possibleBufferTruncation: resources.length >= 250,
        resourceTimingNote: 'Resource Timing entries are browser-buffered and may be truncated; this count is not a full asset inventory.',
      };
      result.textContent = JSON.stringify(summary, null, 2);
      result.dataset.state = 'done';
      console.info('[vite-perf]', JSON.stringify(summary));
      return;
    }
    if (mode) sample(mode).catch(error => {
      result.textContent = (mode === 'page' ? '采样未完成：' : '采样失败：') + error.message;
      result.dataset.state = mode === 'page' ? 'incomplete' : 'error';
      busy = false;
    });
  }
  panel.addEventListener('click', onClick);
  return { destroy };
}
