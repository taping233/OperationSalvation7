// Opt-in development recorder. SIGKILL/discard cannot be caught: persist periodically.
export const FLIGHT_KEY = 'sdt-flight-v1';
export const FLIGHT_LIMIT = 120;
export const FLIGHT_BYTES = 49152;
const KINDS = new Set(['frame-stage', 'restore-stage', 'boot', 'pulse', 'click', 'escape', 'visibilitychange', 'freeze', 'resume', 'pagehide', 'pageshow', 'error', 'unhandledrejection', 'webglcontextlost', 'webglcontextrestored']);
const RESTORE_STAGES = new Set(['transition-mounted', 'battle-module-start', 'battle-module-complete', 'battle-module-failed', 'map-warm-start', 'map-warm-complete', 'map-warm-failed', 'load-game-start', 'load-game-complete', 'load-game-failed', 'battle-restore-start', 'battle-restore-complete', 'battle-restore-failed']);
const FRAME_PHASES = new Set(['before-entry', 'renderer-loading', 'app-init', 'app-ready', 'idle-loading', 'idle-ready', 'frame-batch', 'all-ready', 'released', 'failed', 'static']);
const FRAME_COUNTS = ['roles', 'textureCount', 'baseTextures', 'basePixels', 'rgbaEstimateBytes', 'liveApps', 'activeFrameSessions', 'pendingAttach', 'backingWidth', 'backingHeight', 'resolution'];
let restoreStageSink = null, frameStageSink = null;
function frameSummary(stats) {
  const summary = {};
  for (const key of FRAME_COUNTS) if (Number.isFinite(stats?.[key])) summary[key] = stats[key];
  if (['none', 'webgl', 'canvas', 'unknown'].includes(stats?.rendererBackend)) summary.rendererBackend = stats.rendererBackend;
  if (FRAME_PHASES.has(stats?.phase)) summary.framePhase = stats.phase;
  if (typeof stats?.staticDiagnostic === 'boolean') summary.staticDiagnostic = stats.staticDiagnostic;
  return summary;
}
export function recordFrameStage(phase, stats) {
  if (!frameStageSink || !FRAME_PHASES.has(phase)) return;
  try { frameStageSink({ ...frameSummary(stats), framePhase: phase }); } catch { /* Diagnostics never affect rendering. */ }
}
export function recordRestoreStage(stage) {
  if (!restoreStageSink || !RESTORE_STAGES.has(stage)) return;
  try { restoreStageSink(stage); } catch { /* Diagnostics never affect recovery. */ }
}
// Return the original promise/result; observe errors only on already-handled async paths.
export function traceRestoreStep(step, operation) {
  if (!restoreStageSink) return operation();
  recordRestoreStage(`${step}-start`);
  try {
    const result = operation();
    if (result && typeof result.then === 'function') {
      result.then(() => recordRestoreStage(`${step}-complete`), () => recordRestoreStage(`${step}-failed`));
    } else recordRestoreStage(`${step}-complete`);
    return result;
  } catch (error) { recordRestoreStage(`${step}-failed`); throw error; }
}
const SCENES = new Set(['title', 'board', 'battle', 'boss', 'victory', 'defeat', 'shop', 'camp', 'event', 'none']);
const ACTIONS = new Set(['button', 'card', 'input', 'other', 'bag', 'safe', 'consumed', 'detail', 'discard', 'cancel', 'confirm', 'filter', 'probe']);
const finite = n => Number.isFinite(n) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(n))) : null;
const scene = s => SCENES.has(s) ? s : 'none';
export function sanitizeFlight(entry) {
  const out = { at: finite(entry?.at), kind: KINDS.has(entry?.kind) ? entry.kind : 'pulse' };
  for (const key of [...FRAME_COUNTS, 'stageSequence', 'session', 'ageMs', 'gapMs', 'dom', 'images', 'imagePixels', 'canvases', 'canvasPixels', 'heapUsed', 'heapTotal', 'heapLimit', 'resources', 'tracks', 'musicPositionMs', 'musicVolumeMilli', 'rendererDraws', 'artCount', 'artBytes']) {
    if (key in (entry || {})) out[key] = finite(entry[key]);
  }
  if (Number.isFinite(entry?.resolution)) out.resolution = Math.max(0, Math.min(16, entry.resolution));
  for (const key of ['staticDiagnostic', 'visible', 'focused', 'discarded', 'playing', 'muted', 'enabled', 'persisted', 'overlay', 'battle', 'bgmOverride']) {
    if (typeof entry?.[key] === 'boolean') out[key] = entry[key];
  }
  if (['none', 'webgl', 'canvas', 'unknown'].includes(entry?.rendererBackend)) out.rendererBackend = entry.rendererBackend;
  if (FRAME_PHASES.has(entry?.framePhase)) out.framePhase = entry.framePhase;
  if (RESTORE_STAGES.has(entry?.stage)) out.stage = entry.stage;
  if (entry?.backend) out.backend = ['html5', 'webaudio'].includes(entry.backend) ? entry.backend : 'unknown';
  if (entry?.music) out.music = scene(entry.music);
  if (entry?.action) out.action = ACTIONS.has(entry.action) ? entry.action : 'other';
  if (entry?.errorName) out.errorName = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'AbortError', 'DOMException'].includes(entry.errorName) ? entry.errorName : 'Error';
  return out;
}
export function readFlight(storage) {
  try {
    const raw = storage?.getItem(FLIGHT_KEY);
    if (!raw || raw.length > FLIGHT_BYTES) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-FLIGHT_LIMIT).map(sanitizeFlight) : [];
  } catch { return []; }
}
export function createFlightRecorder({ storage, now = Date.now } = {}) {
  let rows = readFlight(storage);
  let persisted = true;
  return {
    record(entry) {
      rows.push(sanitizeFlight({ ...entry, at: now() }));
      rows = rows.slice(-FLIGHT_LIMIT);
      let raw = JSON.stringify(rows);
      while (raw.length > FLIGHT_BYTES && rows.length > 1) { rows.shift(); raw = JSON.stringify(rows); }
      try { storage?.setItem(FLIGHT_KEY, raw); persisted = !!storage; } catch { persisted = false; }
    },
    read: () => ({ schema: 1, revision: 'restore-stages-20261017-1', maxRecords: FLIGHT_LIMIT, maxStorageChars: FLIGHT_BYTES, intervalMs: 2000, persisted, records: rows.map(row => ({ ...row })) }),
  };
}

export function installFlightRecorder({ SDT, game, host = window, doc = document } = {}) {
  let storage;
  try { storage = host.localStorage; } catch { /* denied storage keeps bounded memory */ }
  const recorder = createFlightRecorder({ storage });
  const started = Date.now();
  let last = started;
  let stopped = false;
  const listeners = [];
  const listen = (target, name, fn) => { target.addEventListener(name, fn, true); listeners.push(() => target.removeEventListener(name, fn, true)); };
  function record(kind, extra = {}) {
    if (stopped) return;
    try {
      const now = Date.now();
      const music = SDT?.Sound?.musicPlayback;
      const memory = host.performance?.memory;
      const art = SDT?.Art?.warmStats?.();
      const frames = frameSummary(SDT?.Battle?._perf?.frameCacheStats?.());
      recorder.record({ kind, session: started, ageMs: now - started, visible: doc.visibilityState === 'visible', focused: doc.hasFocus(),
        overlay: !!doc.getElementById('overlay') && !doc.getElementById('overlay').hidden,
        battle: !!game?.battleActive,
        bgmOverride: music?.diagnosticOverride === 'bgm-off',
        backend: music?.backend, music: music?.current, playing: music?.playing, muted: music?.muted, enabled: music?.enabled,
        tracks: music?.tracks?.length, musicPositionMs: music?.positionSeconds * 1000, musicVolumeMilli: music?.volume * 1000,
        artCount: art?.count, artBytes: art?.bytes,
        heapUsed: memory?.usedJSHeapSize, heapTotal: memory?.totalJSHeapSize, heapLimit: memory?.jsHeapSizeLimit,
        ...frames, ...extra });
    } catch { /* diagnosis must never break play */ }
  }
  function pulse() {
    const now = Date.now();
    try {
      const images = doc.images;
      const canvases = doc.querySelectorAll('canvas');
      record('pulse', { gapMs: now - last, dom: doc.getElementsByTagName('*').length, images: images.length,
        imagePixels: Array.from(images).reduce((n, im) => n + im.naturalWidth * im.naturalHeight, 0),
        canvases: canvases.length, canvasPixels: Array.from(canvases).reduce((n, c) => n + c.width * c.height, 0),
        resources: host.performance?.getEntriesByType('resource').length });
    } catch { /* read failures are isolated */ }
    last = now;
  }
  let lastClick = -Infinity;
  listen(doc, 'click', event => {
    if (Date.now() - lastClick < 100) return;
    lastClick = Date.now();
    const el = event.target?.closest?.('button,[role="button"],input,[role="checkbox"]');
    if (!el) return;
    // Exact UI vocabulary only; no text, IDs, selectors, form values or card titles persisted.
    const label = el.textContent?.trim();
    const stableAction = ({ cancelDragDiscard: 'cancel', confirmDragDiscard: 'confirm', detailDiscard: 'discard', inspectStack: 'detail', bagFilter: 'filter', bagZone: 'bag', closeBag: 'cancel' })[el.dataset?.act];
    const action = el.closest('#vitePerfProbe') ? 'probe'
      : stableAction
      || ({ '取消': 'cancel', '返回战斗': 'cancel', '确认': 'confirm', '丢弃': 'discard', '详情': 'detail', '显示全部': 'filter', '背包': 'bag', '安全格': 'safe', '消耗区': 'consumed' }[label])
      || (el.tagName === 'INPUT' ? 'input' : 'button');
    record('click', { action });
  });
  listen(doc, 'keydown', event => { if (event.key === 'Escape') record('escape'); });
  for (const name of ['visibilitychange', 'freeze', 'resume']) listen(doc, name, () => record(name));
  for (const name of ['pagehide', 'pageshow']) listen(host, name, event => record(name, { persisted: !!event.persisted }));
  for (const name of ['error', 'unhandledrejection']) listen(host, name, event => {
    let errorName = 'Error';
    try { errorName = (event.error || event.reason)?.name || 'Error'; } catch { /* hostile getter */ }
    record(name, { errorName });
  });
  for (const name of ['webglcontextlost', 'webglcontextrestored']) listen(doc, name, () => record(name));
  let stageSequence = 0;
  const stageSink = stage => record('restore-stage', { stage, stageSequence: ++stageSequence });
  const frameSink = summary => record('frame-stage', summary);
  if (import.meta.env.DEV && new URLSearchParams(host.location?.search || '').get('flightRecord') === '1') {
    restoreStageSink = stageSink; frameStageSink = frameSink;
  }
  record('boot', { discarded: !!doc.wasDiscarded });
  pulse();
  const timer = host.setInterval(pulse, 2000);
  return { read: recorder.read, stop() { if (restoreStageSink === stageSink) restoreStageSink = null; if (frameStageSink === frameSink) frameStageSink = null; stopped = true; host.clearInterval(timer); listeners.forEach(remove => remove()); } };
}
