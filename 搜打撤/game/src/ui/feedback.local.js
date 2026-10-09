// @ts-check
import { getDiagnosticSummary } from '../core/diagnostics.local.js';

/** 右键坐标（屏幕百分比）。 */
/** @typedef {{x: number, y: number}} FeedbackPoint */
/** 右键命中的 UI 位置。 */
/** @typedef {{name: string}} FeedbackTarget */
/** 留言所在页面/弹层标识。 */
/** @typedef {{id: string, name: string}} FeedbackPage */
/**
 * 用户留言条目（game.menu.js saveSuggestion 装配）。本文件读端对字段一律
 * 防御式解构以兼容历史/外部位串数据，故除 ts/text 外均声明为可缺省。
 * @typedef {{
 *   ts: string, version: string,
 *   page: (FeedbackPage|null|undefined),
 *   target: (FeedbackTarget|null|undefined),
 *   at: (FeedbackPoint|null|undefined),
 *   text: string, steps: string, expected: string, actual: string,
 *   done?: boolean,
 * }} FeedbackEntry
 */
/** 失败结果（ok 为字面量 false，与各成功形状构成可判别联合）。 */
/** @typedef {{ok: false, code: string, message: string}} FeedbackFailure */
/** 存储端口就绪（value 取参数注入或 globalThis.localStorage 兜底）。 */
/** @typedef {{ok: true, value: Storage}} FeedbackStoragePort */
/** 留言库整读结果（raw 为原始 JSON 串）。 */
/** @typedef {{ok: true, value: FeedbackEntry[], raw: (?string)}} FeedbackReadResult */
/** 追加成功（回传落库条目）。 */
/** @typedef {{ok: true, value: FeedbackEntry}} FeedbackWriteResult */
/** 诊断记录只读切面（core/diagnostics.local.js getDiagnosticSummary 的行形状）。 */
/** @typedef {{at: string, source: string, name: string, code: string}} DiagnosticRecordView */
/** 诊断摘要只读切面（getDiagnosticSummary 返回形状；无记录时为 null）。 */
/** @typedef {{count: number, recent: DiagnosticRecordView[]}} DiagnosticSummaryView */
/**
 * 导出 JSON 记录（formatVersion 1）；diagnostics 仅在有可读摘要时附加。
 * @typedef {{
 *   formatVersion: number, ts: string, gameVersion: string,
 *   page: FeedbackPage, target: FeedbackTarget, at: (FeedbackPoint|null),
 *   text: string, steps: string, expected: string, actual: string,
 *   diagnostics?: {count: number, recent: DiagnosticRecordView[]},
 * }} FeedbackExportRecord
 */
/** 导出端口注入（测试/桌面壳可替换；缺省走 Blob URL + 隐形 <a download> 点击）。
 * @typedef {{
 *   createObjectURL?: ((blob: Blob) => string),
 *   revokeObjectURL?: ((url: string) => void),
 *   click?: ((url: string, name: string) => void),
 * }} FeedbackExportPorts */

const FEEDBACK_KEY = 'sdt-suggestions-v1';
const DIAGNOSTIC_SOURCES = new Set(['window.error', 'unhandledrejection', 'event-bus.sync', 'event-bus.async', 'battle-loader', 'console.error']);
const DIAGNOSTIC_NAMES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError', 'DOMException', 'AbortError', 'TimeoutError', 'NetworkError', 'SecurityError', 'QuotaExceededError', 'NonErrorValue']);
const DIAGNOSTIC_CODES = new Set(['UNKNOWN', 'ABORTED', 'TIMEOUT', 'NETWORK', 'STORAGE']);
/** @param {string} code @param {string} message @returns {FeedbackFailure} */
const fail = (code, message) => ({ ok: false, code, message });

/** @param {(Storage|null|undefined)} [storage] @returns {(FeedbackStoragePort|FeedbackFailure)} */
function storageOrFailure(storage) {
  if (storage) return { ok: true, value: storage };
  try { return { ok: true, value: globalThis.localStorage }; }
  catch { return fail('READ_FAILED', '无法访问本地留言存储'); }
}
/** @param {(Storage|null|undefined)} [storage] @returns {(FeedbackReadResult|FeedbackFailure)} */
function readLocalFeedback(storage) {
  const port = storageOrFailure(storage); if (!port.ok) return port;
  let raw;
  try { raw = port.value.getItem(FEEDBACK_KEY); } catch { return fail('READ_FAILED', '无法读取本地留言'); }
  if (raw == null) return { ok: true, value: [], raw: null };
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? { ok: true, value, raw } : fail('INVALID_DATA', '留言信箱格式损坏，原数据已保留');
  } catch { return fail('INVALID_DATA', '留言信箱格式损坏，原数据已保留'); }
}

/** @param {FeedbackEntry} entry @param {(Storage|null|undefined)} [storage] @returns {(FeedbackWriteResult|FeedbackFailure)} */
function appendLocalFeedback(entry, storage) {
  const read = readLocalFeedback(storage);
  if (!read.ok) return read;
  const port = storageOrFailure(storage); if (!port.ok) return port;
  try { port.value.setItem(FEEDBACK_KEY, JSON.stringify([...read.value, entry])); return { ok: true, value: entry }; }
  catch { return fail('WRITE_FAILED', '本地写入失败，请保留内容后重试'); }
}

// 删除指定 ts 的留言后整串覆写（存储收口批 2026-09-25：removeSuggestion
// 浏览器回退从 game.menu.js 内联直读写收口到本封装）。键名、读写时机与
// 解析降级和原内联实现逐点等价：键缺失按 '[]' 处理（仍会写入 '[]'）、
// 解析失败/非数组返回 false 且原串保留，读取或写入抛异常均返回 false。
/** @param {string} ts @param {(Storage|null|undefined)} [storage] @returns {boolean} */
function removeLocalFeedback(ts, storage) {
  const port = storageOrFailure(storage);
  if (!port.ok) return false;
  try {
    const list = JSON.parse(port.value.getItem(FEEDBACK_KEY) || '[]').filter(/** @param {*} e */ (e) => e?.ts !== ts);
    port.value.setItem(FEEDBACK_KEY, JSON.stringify(list));
    return true;
  } catch { return false; }
}

/** @param {FeedbackEntry} entry @param {(DiagnosticSummaryView|null|undefined)} [diagnostics] @returns {FeedbackExportRecord} */
function feedbackExportRecord(entry, diagnostics = getDiagnosticSummary()) {
  const at = entry?.at && Number.isFinite(+entry.at.x) && Number.isFinite(+entry.at.y)
    ? { x: +entry.at.x, y: +entry.at.y } : null;
  /** @type {FeedbackExportRecord} */
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

/** @param {FeedbackEntry} entry @param {FeedbackExportPorts} [ports] @returns {(FeedbackFailure|{ok: true})} */
function downloadFeedbackRecord(entry, ports = {}) {
  const safeTs = String(entry?.ts || 'unknown').replace(/[^0-9A-Za-z_-]/g, '-').slice(0, 40);
  return downloadFeedbackJSON(feedbackExportRecord(entry), `sdt-feedback-${safeTs || 'unknown'}.json`, ports);
}

/** @param {FeedbackEntry[]} entries @param {FeedbackExportPorts} [ports] @returns {(FeedbackFailure|{ok: true})} */
function downloadFeedbackRecords(entries, ports = {}) {
  if (!Array.isArray(entries) || !entries.length) return fail('NO_RECORDS', '没有可导出的留言');
  const exportedAt = new Date().toISOString();
  const diagnostics = getDiagnosticSummary();
  const data = {
    formatVersion: 1, exportedAt, total: entries.length,
    records: entries.map(entry => ({ ...feedbackExportRecord(entry, diagnostics), done: !!entry?.done })),
  };
  return downloadFeedbackJSON(data, `sdt-feedback-all-${exportedAt.replace(/[^0-9A-Za-z_-]/g, '-')}.json`, ports);
}

/** @param {object} data @param {string} name @param {FeedbackExportPorts} ports @returns {(FeedbackFailure|{ok: true})} */
function downloadFeedbackJSON(data, name, ports) {
  let href = /** @type {(string|null)} */ (null), revoke = /** @type {(((url: string) => void)|null)} */ (null);
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const create = ports.createObjectURL || URL.createObjectURL.bind(URL);
    revoke = ports.revokeObjectURL || URL.revokeObjectURL.bind(URL);
    /** @type {(url: string, name: string) => void} */
    const click = ports.click || ((url, name) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); });
    href = create(blob);
    click(href, name);
    return { ok: true };
  }
  catch { return fail('DOWNLOAD_FAILED', '导出失败，请重试'); }
  // 收尾撤销 Blob URL。守卫收窄不进入闭包（TS 不把 let 的守卫收窄带进函数体），
  // 闭包内用注释级 cast 复述守卫后的类型；运行时守卫语义逐字不变。
  finally { if (href && revoke) setTimeout(() => /** @type {((url: string) => void)} */ (revoke)(/** @type {string} */ (href)), 0); }
}

export { appendLocalFeedback, downloadFeedbackRecord, downloadFeedbackRecords, feedbackExportRecord, readLocalFeedback, removeLocalFeedback };
