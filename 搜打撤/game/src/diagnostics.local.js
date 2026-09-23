const DIAGNOSTICS_KEY = 'sdt-diagnostics-v1';
const MAX_DIAGNOSTICS = 40;
const memoryRecords = [];
const SOURCES = new Set(['window.error', 'unhandledrejection', 'event-bus.sync', 'event-bus.async', 'battle-loader', 'console.error']);
const ERROR_NAMES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError', 'DOMException', 'AbortError', 'TimeoutError', 'NetworkError', 'SecurityError', 'QuotaExceededError']);
const CODES = new Set(['UNKNOWN', 'ABORTED', 'TIMEOUT', 'NETWORK', 'STORAGE']);

function diagnosticRecord(source, error, at = Date.now()) {
  let name = 'Error';
  try {
    const candidate = error && typeof error === 'object' ? error.name : undefined;
    const rawName = typeof candidate === 'string' ? candidate : (error == null ? 'Error' : 'NonErrorValue');
    name = ERROR_NAMES.has(rawName) ? rawName : (rawName === 'NonErrorValue' ? rawName : 'Error');
  } catch { /* 异常属性访问不得影响原始错误处理。 */ }
  const code = name === 'AbortError' ? 'ABORTED'
    : name === 'TimeoutError' ? 'TIMEOUT'
      : name === 'NetworkError' ? 'NETWORK'
        : ['SecurityError', 'QuotaExceededError'].includes(name) ? 'STORAGE' : 'UNKNOWN';
  let timestamp;
  try {
    const numericAt = Number(at);
    timestamp = Number.isFinite(numericAt) ? new Date(numericAt).toISOString() : new Date().toISOString();
  } catch { timestamp = new Date().toISOString(); }
  return {
    at: timestamp,
    source: SOURCES.has(source) ? source : 'window.error',
    name,
    code: CODES.has(code) ? code : 'UNKNOWN',
  };
}

function storageOrNull(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage || null; } catch { return null; }
}

function readStoredDiagnostics(port) {
  try {
    const raw = port.getItem(DIAGNOSTICS_KEY);
    if (raw == null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item.at === 'string' && typeof item.source === 'string'
      && typeof item.name === 'string' && typeof item.code === 'string').slice(-MAX_DIAGNOSTICS).map(item => {
      const timestamp = Date.parse(item.at);
      return {
        at: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date(0).toISOString(),
        source: SOURCES.has(item.source) ? item.source : 'window.error',
        name: ERROR_NAMES.has(item.name) || item.name === 'NonErrorValue' ? item.name : 'Error',
        code: CODES.has(item.code) ? item.code : 'UNKNOWN',
      };
    });
  } catch { return null; }
}

function mergeRecords(...groups) {
  const unique = new Map();
  for (const item of groups.flat()) {
    if (!item) continue;
    const key = `${item.at}|${item.source}|${item.name}|${item.code}`;
    unique.set(key, item);
  }
  return [...unique.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-MAX_DIAGNOSTICS);
}

function readLocalDiagnostics(storage) {
  const port = storageOrNull(storage);
  if (!port) return memoryRecords.slice(-MAX_DIAGNOSTICS);
  const stored = readStoredDiagnostics(port);
  return mergeRecords(stored || [], memoryRecords);
}

function recordDiagnostic(source, error, storage, at = Date.now()) {
  const entry = diagnosticRecord(source, error, at);
  const duplicate = [...memoryRecords].reverse().find(item => item.name === entry.name && item.code === entry.code
    && Math.abs(Date.parse(entry.at) - Date.parse(item.at)) <= 250);
  if (duplicate) return duplicate;
  memoryRecords.push(entry);
  if (memoryRecords.length > MAX_DIAGNOSTICS) memoryRecords.splice(0, memoryRecords.length - MAX_DIAGNOSTICS);
  const port = storageOrNull(storage);
  if (!port) return entry;
  try {
    const stored = readStoredDiagnostics(port);
    if (!stored) return entry;
    const next = mergeRecords(stored, [entry]);
    port.setItem(DIAGNOSTICS_KEY, JSON.stringify(next));
  } catch { /* 存储不可用时保留内存中的有界摘要。 */ }
  return entry;
}

function resetDiagnosticMemory() { memoryRecords.length = 0; }

function getDiagnosticSummary(storage) {
  const records = readLocalDiagnostics(storage);
  return records.length ? { count: records.length, recent: records.slice(-8) } : null;
}

function installRuntimeDiagnostics(target = globalThis) {
  if (!target || typeof target.addEventListener !== 'function') return false;
  if (target.__sdtDiagnosticsInstalled) return false;
  try { Object.defineProperty(target, '__sdtDiagnosticsInstalled', { value: true, configurable: true }); }
  catch { return false; }
  target.addEventListener('error', event => {
    recordDiagnostic('window.error', event?.error || new Error('Uncaught runtime error'));
  });
  target.addEventListener('unhandledrejection', event => {
    recordDiagnostic('unhandledrejection', event?.reason);
  });
  const originalError = target.console?.error;
  if (typeof originalError === 'function' && !originalError.__sdtDiagnosticWrapper) {
    let recording = false;
    const wrappedError = function (...args) {
      try {
        if (!recording) {
          recording = true;
          try {
            const error = args.find(value => value instanceof Error);
            if (error) recordDiagnostic('console.error', error);
          } catch { /* 诊断永远不能阻断原始控制台调用。 */ }
          finally { recording = false; }
        }
      } catch { /* 包括探测异常对象失败在内的诊断问题均忽略。 */ }
      return Reflect.apply(originalError, this, args);
    };
    Object.defineProperty(wrappedError, '__sdtDiagnosticWrapper', { value: true });
    try { target.console.error = wrappedError; } catch { /* 宿主可能提供只读 console。 */ }
  }
  return true;
}

installRuntimeDiagnostics();

export { DIAGNOSTICS_KEY, MAX_DIAGNOSTICS, diagnosticRecord, getDiagnosticSummary, installRuntimeDiagnostics, readLocalDiagnostics, recordDiagnostic, resetDiagnosticMemory };
