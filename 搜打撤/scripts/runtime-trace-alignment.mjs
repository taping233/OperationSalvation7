import { sanitizeTraceRow, TRACE_LIMIT } from '../game/src/core/runtime-trace.local.js';
// Explicit human-observed sync marker. Never infer video start from wall-clock timestamps.
export function alignRuntimeTrace(trace, { marker, videoSeconds }) {
  if (trace?.schema !== 'sdt-runtime-trace-v1' || !Array.isArray(trace.records) || trace.records.length > TRACE_LIMIT) throw new Error('Invalid or oversized runtime trace');
  if (!Number.isInteger(marker) || marker < 1 || !Number.isFinite(videoSeconds) || videoSeconds < 0) throw new Error('Trace requires an explicit positive marker and nonnegative video time');
  const records = trace.records.map(sanitizeTraceRow);
  const matches = records.filter(row => row.kind === 'sync' && row.marker === marker && Number.isFinite(row.tMs));
  if (matches.length !== 1) throw new Error('Sync marker must exist exactly once in trace; it may have been cleared or evicted');
  const anchorMs = matches[0].tMs;
  return { schema: 'sdt-runtime-alignment-v1', alignment: 'manual sync marker; primary video only; timing correlation is not causation',
    marker, videoSeconds, anchorMs,
    dropped: Number.isSafeInteger(trace.dropped) && trace.dropped >= 0 ? trace.dropped : null,
    longTaskSupport: ['supported', 'unsupported', 'unavailable'].includes(trace.longTaskSupport) ? trace.longTaskSupport : 'unknown',
    eventTiming: summarizeEventTiming(trace, records),
    records: records.filter(row => Number.isFinite(row.tMs)).map(row => ({ ...row, videoSeconds: videoSeconds + (row.tMs - anchorMs) / 1000 })) };
}

const stats = values => {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return { n, medianMs: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : null,
    minMs: n ? sorted[0] : null, maxMs: n ? sorted[n - 1] : null };
};
export function summarizeEventTiming(trace, rows = trace.records.map(sanitizeTraceRow)) {
  const events = rows.filter(row => row.kind === 'event-timing' && row.visible === true
    && ['tMs', 'durationMs', 'inputDelayMs', 'processingMs'].every(key => Number.isFinite(row[key]))
    && Number.isSafeInteger(row.interaction) && row.interaction > 0);
  return {
    support: ['supported', 'unsupported', 'unavailable'].includes(trace.eventTimingSupport) ? trace.eventTimingSupport : 'unknown',
    requestedDurationThresholdMs: trace.eventDurationThresholdMs === 16 ? 16 : null,
    duration: stats(events.map(row => row.durationMs)),
    inputDelay: stats(events.map(row => row.inputDelayMs)),
    processing: stats(events.map(row => row.processingMs)),
    anonymousGroups: new Set(events.map(row => row.browserInteraction).filter(id => Number.isSafeInteger(id) && id > 0)).size,
    ungroupedRecords: events.filter(row => !Number.isSafeInteger(row.browserInteraction) || row.browserInteraction < 1).length,
    limitations: 'Only uniquely matched visible eligible inputs above the browser reporting threshold; missing entries are not zero latency. Duration is browser-reported and quantized (8ms), not exact paint, complete async response, FPS or page INP. Browser groups are local to this trace; do not sum grouped durations or compare IDs across sessions.',
  };
}
export function summarizeRuntimeStages(trace) {
  if (trace?.schema !== 'sdt-runtime-trace-v1' || !Array.isArray(trace.records) || trace.records.length > TRACE_LIMIT) throw new Error('Invalid or oversized runtime trace');
  const rows = trace.records.map(sanitizeTraceRow);
  const stages = rows.filter(row => row.kind === 'stage' && row.stage && row.visible === true
    && Number.isFinite(row.tMs) && Number.isFinite(row.durationMs) && Number.isInteger(row.interaction) && row.interaction > 0);
  const longTasks = rows.filter(row => row.kind === 'longtask' && row.visible === true && Number.isFinite(row.tMs) && Number.isFinite(row.durationMs));
  const groups = new Map();
  for (const row of stages) {
    if (!groups.has(row.interaction)) groups.set(row.interaction, []);
    groups.get(row.interaction).push(row);
  }
  const paired = [];
  for (const [interaction, group] of groups) {
    const overlay = group.filter(row => row.stage === 'settings-overlay-sync');
    const navigation = group.filter(row => row.stage === 'settings-navigation-sync');
    // Incomplete or repeated boundaries cannot establish a unique per-open sum.
    if (overlay.length !== 1 || navigation.length !== 1) continue;
    paired.push({ interaction, durationMs: overlay[0].durationMs + navigation[0].durationMs,
      moduleWaitObserved: group.some(row => row.stage === 'settings-module-wait') });
  }
  const names = [...new Set(stages.map(row => row.stage))].sort();
  return { eventTiming: summarizeEventTiming(trace, rows), stages: Object.fromEntries(names.map(name => [name, stats(stages.filter(row => row.stage === name).map(row => row.durationMs))])),
    synchronousSettings: { ...stats(paired.map(row => row.durationMs)), samples: paired,
      moduleWaitObserved: stats(paired.filter(row => row.moduleWaitObserved).map(row => row.durationMs)),
      noModuleWaitObserved: stats(paired.filter(row => !row.moduleWaitObserved).map(row => row.durationMs)),
      incompleteOrAmbiguousInteractions: groups.size - paired.length },
    longTasks: { support: ['supported', 'unsupported', 'unavailable'].includes(trace.longTaskSupport) ? trace.longTaskSupport : 'unknown',
      visibleRecords: longTasks.length,
      overlappingStageRecords: longTasks.filter(task => stages.some(stage => task.tMs < stage.tMs + stage.durationMs && stage.tMs < task.tMs + task.durationMs)).length },
    dropped: Number.isSafeInteger(trace.dropped) && trace.dropped >= 0 ? trace.dropped : null,
    excludedStageRecords: rows.filter(row => row.kind === 'stage').length - stages.length };
}
export function compareRuntimeStages(before, after) {
  const first = summarizeRuntimeStages(before), second = summarizeRuntimeStages(after);
  const a = first.synchronousSettings.medianMs, b = second.synchronousSettings.medianMs;
  return { schema: 'sdt-runtime-stage-comparison-v1', before: first, after: second,
    synchronousMedianChangeMs: a === null || b === null ? null : Math.round((b - a) * 100) / 100,
    limitations: [
      'Small unpaired session samples are descriptive, not statistical or causal proof; verify deployment identity and comparable browser conditions separately.',
      'Only visible, valid, completed stages are included; dropped, hidden, cancelled or missing records may bias results. Completion does not prove successful presentation.',
      'Synchronous totals pair exactly one overlay and navigation stage per interaction; asynchronous module/visual waits are never added to CPU totals.',
      'No module-wait record means unobserved, not proven warm. Stage intervals may overlap; do not sum arbitrary stages.',
      'Long-task overlap is correlation, not attribution. Unsupported API or zero records does not prove no blocking, and session counts have different observation lengths.',
      'Stage analysis is not input latency measurement. Event Timing inputDelay is reported separately for the thresholded, matched subset; neither section proves FPS, exact paint or animation completion.',
    ] };
}

// Reuses the trace whitelist without requiring video or inventing a sync anchor.
if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  try {
    const { parseArgs } = await import('node:util');
    const { readFile, stat } = await import('node:fs/promises');
    const { values } = parseArgs({ options: { before: { type: 'string' }, after: { type: 'string' } } });
    const readTrace = async file => {
      if (!file || !(await stat(file)).isFile() || (await stat(file)).size > 1024 * 1024) throw new Error('Expected local trace JSON under 1 MiB');
      return JSON.parse(await readFile(file, 'utf8'));
    };
    console.log(JSON.stringify(compareRuntimeStages(await readTrace(values.before), await readTrace(values.after)), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
