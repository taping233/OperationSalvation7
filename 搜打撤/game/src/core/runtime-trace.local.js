import { connectRuntimeStages, RUNTIME_STAGES } from './runtime-trace-stages.local.js';
// Explicit opt-in, local-only evidence. No game state, text, URLs or identifiers collected.
export const TRACE_LIMIT = 400;
export const TRACE_REVISION = 'runtime-interactions-20261020-2';
const KINDS = new Set(['start', 'input', 'dom-update', 'frame-opportunity', 'longtask', 'sync', 'visibility', 'stop', 'stage']);
const ACTIONS = new Set(['card', 'button', 'escape', 'other']);
const PAGES = new Set(['battle', 'hub', 'departure', 'overlay', 'base']);
export function sanitizeTraceRow(row) {
  const result = { kind: KINDS.has(row?.kind) ? row.kind : 'input' };
  for (const key of ['tMs', 'durationMs', 'interaction', 'marker']) {
    if (Number.isFinite(row?.[key]) && row[key] >= 0) result[key] = Math.round(Math.min(Number.MAX_SAFE_INTEGER, row[key]) * 100) / 100;
  }
  if (['click', 'pointerdown', 'pointerup', 'escape'].includes(row?.trigger)) result.trigger = row.trigger;
  if (result.kind === 'stage' && RUNTIME_STAGES.includes(row?.stage)) result.stage = row.stage;
  if (ACTIONS.has(row?.action)) result.action = row.action;
  if (PAGES.has(row?.page)) result.page = row.page;
  if (typeof row?.visible === 'boolean') result.visible = row.visible;
  return result;
}
export function createTraceBuffer() {
  let records = [], dropped = 0;
  return {
    push(row) { if (records.length === TRACE_LIMIT) { records.shift(); dropped++; } records.push(sanitizeTraceRow(row)); },
    clear() { records = []; dropped = 0; },
    read: () => ({ dropped, records: records.map(row => ({ ...row })) }),
  };
}
export function installRuntimeTrace({ host = window, doc = document } = {}) {
  if (new URLSearchParams(host.location?.search || '').get('runtimeTrace') !== '1' || doc.getElementById('sdtRuntimeTrace')) return null;
  const perf = host.performance, buffer = createTraceBuffer(), pending = new Set();
  const traceStartMs = perf.now();
  let active = true, interaction = 0, marker = 0, lastInput = null, observer = null, cardGesture = false;
  let collectedAfter = traceStartMs;
  let stageGeneration = 0;
  const disconnectStages = connectRuntimeStages({
    capture: () => active && lastInput ? { owner: buffer, generation: stageGeneration, interaction: lastInput.id } : null,
    begin(stage, context) {
      if (!active || doc.visibilityState !== 'visible' || !context || context.owner !== buffer || context.generation !== stageGeneration) return;
      const start = perf.now(), generation = stageGeneration;
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        if (!active || generation !== stageGeneration || doc.visibilityState !== 'visible') return;
        record('stage', { stage, tMs: start, durationMs: perf.now() - start, interaction: context.interaction });
      };
    },
  });
  let longTaskSupport = 'unsupported';
  const page = () => {
    const overlay = doc.getElementById('overlay');
    if (!overlay || overlay.hidden) return 'base';
    if (overlay.querySelector('.battle-stage,.sts-hud')) return 'battle';
    if (overlay.querySelector('#hubMain')) return 'hub';
    if (overlay.querySelector('#depMain')) return 'departure';
    return 'overlay';
  };
  function record(kind, extra = {}) { if (active) buffer.push({ kind, tMs: perf.now(), visible: doc.visibilityState === 'visible', ...extra }); }
  const panel = doc.createElement('aside');
  panel.id = 'sdtRuntimeTrace';
  panel.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:100000;background:#111;color:white;padding:8px;font:12px monospace;max-width:300px';
  panel.innerHTML = '<strong>本地交互诊断</strong><div>未记录文字/存档；帧回调不是FPS或实际呈现。</div><output aria-live="polite">记录中</output><div><button data-trace="sync">视频对时</button> <button data-trace="export">下载JSON</button> <button data-trace="stop">停止</button> <button data-trace="clear">清空</button></div>';
  doc.body.append(panel);
  const status = panel.querySelector('output');
  function input(event) {
    if (!active || doc.visibilityState !== 'visible' || panel.contains(event.target)) return;
    if (event.type === 'keydown' && (event.key !== 'Escape' || event.repeat)) return;
    const target = event.target?.closest?.('.sts-hand [data-uid],.bt-hand [data-uid],button,[role="button"]');
    const cardTarget = !!target?.closest('.sts-hand,.bt-hand');
    if (event.type === 'pointerdown') { if (!cardTarget) return; cardGesture = true; }
    if (event.type === 'pointerup') { if (!cardGesture) return; cardGesture = false; }
    if (event.type === 'click' && cardTarget && event.detail > 0) return;
    if (event.type !== 'keydown' && event.type !== 'pointerup' && !target) return;
    const action = event.type === 'keydown' ? 'escape' : (cardTarget || event.type === 'pointerup') ? 'card' : 'button';
    const id = ++interaction, start = perf.now();
    lastInput = { id, start };
    record('input', { interaction: id, action, trigger: event.type === 'keydown' ? 'escape' : event.type, page: page() });
    // Two animation callbacks bound an opportunity to render; they do not prove a paint or settle.
    if (pending.size >= 32) return;
    const frame = callback => {
      const token = host.requestAnimationFrame(() => { pending.delete(token); if (active) callback(); });
      pending.add(token);
    };
    frame(() => frame(() => record('frame-opportunity', { interaction: id, durationMs: perf.now() - start, page: page() })));
  }
  doc.addEventListener('click', input, true);
  doc.addEventListener('keydown', input, true);
  doc.addEventListener('pointerdown', input, true);
  doc.addEventListener('pointerup', input, true);
  const cancelGesture = () => { cardGesture = false; };
  doc.addEventListener('pointercancel', cancelGesture, true);
  const cancelFrames = () => { pending.forEach(token => host.cancelAnimationFrame(token)); pending.clear(); };
  const visibility = () => { stageGeneration++; lastInput = null; cardGesture = false; cancelFrames(); record('visibility'); };
  doc.addEventListener('visibilitychange', visibility);
  host.addEventListener('pagehide', stop);
  // Only gameplay overlay changes. The panel is outside this subtree.
  const overlay = doc.getElementById('overlay');
  const mutations = overlay && new host.MutationObserver(() => {
    if (active && lastInput && perf.now() - lastInput.start <= 10000) {
      record('dom-update', { interaction: lastInput.id, durationMs: perf.now() - lastInput.start, page: page() });
    }
  });
  mutations?.observe(overlay, { childList: true, subtree: true });
  function receive(entries) {
    for (const entry of entries) if (entry.startTime >= collectedAfter) record('longtask', { tMs: entry.startTime, durationMs: entry.duration });
  }
  try {
    if (host.PerformanceObserver?.supportedEntryTypes?.includes('longtask')) {
      observer = new host.PerformanceObserver(list => receive(list.getEntries()));
      observer.observe({ type: 'longtask', buffered: false });
      longTaskSupport = 'supported';
    }
  } catch { observer?.disconnect(); observer = null; longTaskSupport = 'unavailable'; }
  const read = () => ({ schema: 'sdt-runtime-trace-v1', revision: TRACE_REVISION,
    buildVersion: typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : 'dev',
    timeOriginMs: perf.timeOrigin, traceStartMs, clock: 'performance.now milliseconds since timeOrigin',
    longTaskSupport, active, limit: TRACE_LIMIT,
    interpretation: 'DOM changes and frame opportunities are correlated with recent input, not proof of action success, paint, FPS, or a causal bottleneck.', ...buffer.read() });
  function stop() {
    if (!active) return;
    if (observer) receive(observer.takeRecords());
    record('stop'); active = false; stageGeneration++; disconnectStages();
    observer?.disconnect(); mutations?.disconnect();
    cancelFrames();
    doc.removeEventListener('click', input, true); doc.removeEventListener('keydown', input, true);
    doc.removeEventListener('pointerdown', input, true); doc.removeEventListener('pointerup', input, true);
    doc.removeEventListener('pointercancel', cancelGesture, true);
    doc.removeEventListener('visibilitychange', visibility);
    host.removeEventListener('pagehide', stop);
    status.textContent = '已停止；可下载或清空';
  }
  function controls(event) {
    const mode = event.target?.closest?.('[data-trace]')?.dataset.trace;
    if (mode === 'sync' && active) { record('sync', { marker: ++marker }); status.textContent = `对时标记 ${marker}`; }
    if (mode === 'stop') stop();
    if (mode === 'clear') { stageGeneration++; buffer.clear(); collectedAfter = perf.now(); lastInput = null; cardGesture = false; cancelFrames(); status.textContent = active ? '已清空；继续记录中' : '已清空；已停止'; }
    if (mode === 'export') {
      if (observer && active) receive(observer.takeRecords());
      const url = host.URL.createObjectURL(new Blob([JSON.stringify(read(), null, 2)], { type: 'application/json' }));
      const anchor = doc.createElement('a'); anchor.href = url; anchor.download = 'sdt-runtime-trace.json';
      anchor.click(); host.setTimeout(() => host.URL.revokeObjectURL(url), 1000);
    }
  }
  panel.addEventListener('click', controls);
  record('start', { page: page() });
  status.textContent = `记录中；长任务${longTaskSupport === 'supported' ? '可用' : '不可用（降级）'}`;
  return { read, stop, destroy() { stop(); panel.removeEventListener('click', controls); panel.remove(); } };
}
