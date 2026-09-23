import { getDiagnosticSummary } from './diagnostics.local.js';

const FEEDBACK_KEY = 'sdt-suggestions-v1';
const DIAGNOSTIC_SOURCES = new Set(['window.error', 'unhandledrejection', 'event-bus.sync', 'event-bus.async', 'battle-loader', 'console.error']);
const DIAGNOSTIC_NAMES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError', 'DOMException', 'AbortError', 'TimeoutError', 'NetworkError', 'SecurityError', 'QuotaExceededError', 'NonErrorValue']);
const DIAGNOSTIC_CODES = new Set(['UNKNOWN', 'ABORTED', 'TIMEOUT', 'NETWORK', 'STORAGE']);
const fail = (code, message) => ({ ok: false, code, message });

function storageOrFailure(storage) {
  if (storage) return { ok: true, value: storage };
  try { return { ok: true, value: globalThis.localStorage }; }
  catch { return fail('READ_FAILED', '无法访问本地留言存储'); }
}
function readLocalFeedback(storage) {
  const port = storageOrFailure(storage); if (!port.ok) return port;
  let raw;
  try { raw = port.value.getItem(FEEDBACK_KEY); } catch { return fail('READ_FAILED', '无法读取本地留言'); }
  if (raw == null) return { ok: true, value: [], raw: null };
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? { ok: true, value, raw } : fail('INVALID_DATA', '留言库格式损坏，原数据已保留');
  } catch { return fail('INVALID_DATA', '留言库格式损坏，原数据已保留'); }
}

function appendLocalFeedback(entry, storage) {
  const read = readLocalFeedback(storage);
  if (!read.ok) return read;
  const port = storageOrFailure(storage); if (!port.ok) return port;
  try { port.value.setItem(FEEDBACK_KEY, JSON.stringify([...read.value, entry])); return { ok: true, value: entry }; }
  catch { return fail('WRITE_FAILED', '本地写入失败，请保留内容后重试'); }
}

function feedbackExportRecord(entry, diagnostics = getDiagnosticSummary()) {
  const at = entry?.at && Number.isFinite(+entry.at.x) && Number.isFinite(+entry.at.y)
    ? { x: +entry.at.x, y: +entry.at.y } : null;
  const record = {
    formatVersion: 1, ts: String(entry?.ts || ''), gameVersion: String(entry?.version || '未知'),
    page: { id: String(entry?.page?.id || ''), name: String(entry?.page?.name || '未知页面') },
    target: { name: String(entry?.target?.name || '') }, at,
    text: String(entry?.text || ''), steps: String(entry?.steps || ''),
    expected: String(entry?.expected || ''), actual: String(entry?.actual || ''),
  };
  if (diagnostics?.count && Array.isArray(diagnostics.recent) && diagnostics.recent.length) {
    record.diagnostics = {
      count: Math.max(0, Math.min(10000, Number(diagnostics.count) || diagnostics.recent.length)),
      recent: diagnostics.recent.slice(-8).map(item => {
        const timestamp = Date.parse(item?.at);
        return {
          at: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date(0).toISOString(),
          source: DIAGNOSTIC_SOURCES.has(item?.source) ? item.source : 'window.error',
          name: DIAGNOSTIC_NAMES.has(item?.name) ? item.name : 'Error',
          code: DIAGNOSTIC_CODES.has(item?.code) ? item.code : 'UNKNOWN',
        };
      }),
    };
  }
  return record;
}

function downloadFeedbackRecord(entry, ports = {}) {
  let href = null, revoke = null;
  try {
    const blob = new Blob([JSON.stringify(feedbackExportRecord(entry), null, 2)], { type: 'application/json;charset=utf-8' });
    const create = ports.createObjectURL || URL.createObjectURL.bind(URL);
    revoke = ports.revokeObjectURL || URL.revokeObjectURL.bind(URL);
    const click = ports.click || ((url, name) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); });
    href = create(blob);
    const safeTs = String(entry?.ts || 'unknown').replace(/[^0-9A-Za-z_-]/g, '-').slice(0, 40);
    click(href, `sdt-feedback-${safeTs || 'unknown'}.json`);
    return { ok: true };
  }
  catch { return fail('DOWNLOAD_FAILED', '导出失败，请重试'); }
  finally { if (href && revoke) setTimeout(() => revoke(href), 0); }
}

export { FEEDBACK_KEY, appendLocalFeedback, downloadFeedbackRecord, feedbackExportRecord, readLocalFeedback };
