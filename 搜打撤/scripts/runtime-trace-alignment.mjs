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
    records: records.filter(row => Number.isFinite(row.tMs)).map(row => ({ ...row, videoSeconds: videoSeconds + (row.tMs - anchorMs) / 1000 })) };
}
