import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIAGNOSTICS_KEY, MAX_DIAGNOSTICS, getDiagnosticSummary, installRuntimeDiagnostics, readLocalDiagnostics, recordDiagnostic, resetDiagnosticMemory } from '../game/src/core/diagnostics.local.js';
import { emit, reset } from '../game/src/core/event-bus.js';
import { feedbackExportRecord } from '../game/src/ui/feedback.local.js';

beforeEach(() => {
  localStorage.removeItem(DIAGNOSTICS_KEY);
  resetDiagnosticMemory();
  reset();
});

afterEach(() => {
  localStorage.removeItem(DIAGNOSTICS_KEY);
  resetDiagnosticMemory();
  reset();
  vi.restoreAllMocks();
});

describe('本地运行时诊断摘要', () => {
  it('只记录有限来源、错误类型、代码和时间，不保存消息或堆栈', () => {
    const secret = new TypeError('https://secret.invalid C:\\Users\\player\\save.json 卡牌存档内容');
    secret.stack = 'secret stack';
    const entry = recordDiagnostic('event-bus.sync', secret, localStorage);
    expect(entry).toMatchObject({ source: 'event-bus.sync', name: 'TypeError', code: 'UNKNOWN' });
    expect(Object.keys(entry).sort()).toEqual(['at', 'code', 'name', 'source']);
    const raw = localStorage.getItem(DIAGNOSTICS_KEY);
    expect(raw).not.toContain('secret.invalid');
    expect(raw).not.toContain('player');
    expect(raw).not.toContain('存档');
    expect(raw).not.toContain('stack');
  });

  it('name getter 抛错或时间非法时记录仍不抛出', () => {
    const hostile = new Error('private');
    Object.defineProperty(hostile, 'name', { get() { throw new Error('getter failure'); } });
    expect(() => recordDiagnostic('event-bus.sync', hostile, localStorage, Symbol('invalid-time'))).not.toThrow();
    expect(getDiagnosticSummary()?.recent[0]).toMatchObject({ name: 'Error', code: 'UNKNOWN' });
    expect(Number.isFinite(Date.parse(getDiagnosticSummary().recent[0].at))).toBe(true);
  });

  it('全局 error 与 unhandledrejection 都进入本地记录，且拒绝值不序列化', () => {
    const errorEvent = new ErrorEvent('error', { message: 'hidden URL', error: new RangeError('private data') });
    window.dispatchEvent(errorEvent);
    const rejection = new Event('unhandledrejection');
    Object.defineProperty(rejection, 'reason', { value: new Error('private card data') });
    window.dispatchEvent(rejection);

    const records = readLocalDiagnostics();
    expect(records.map(record => record.source)).toContain('window.error');
    expect(records.map(record => record.source)).toContain('unhandledrejection');
    expect(records.every(record => !('message' in record) && !('stack' in record))).toBe(true);
  });

  it('包装 console.error 保留原调用，只从 Error 取白名单类型', () => {
    const listeners = new Map(), calls = [];
    const target = {
      addEventListener: (type, callback) => listeners.set(type, callback),
      console: { error: (...args) => calls.push(args) },
    };
    expect(installRuntimeDiagnostics(target)).toBe(true);
    target.console.error('[game] caught', new TypeError('private path C:\\secret\\save.json'));
    const hostile = new Error('private');
    Object.defineProperty(hostile, 'name', { get() { throw new Error('getter failure'); } });
    expect(() => target.console.error('[game] hostile', hostile)).not.toThrow();
    target.console.error('plain legacy log');
    expect(calls).toHaveLength(3);
    expect(getDiagnosticSummary()?.recent.some(record => record.source === 'console.error' && record.name === 'TypeError')).toBe(true);
    expect(JSON.stringify(readLocalDiagnostics())).not.toContain('secret');
    expect(JSON.stringify(readLocalDiagnostics())).not.toContain('private');
  });

  it('Bus 同步与异步订阅异常都会记录来源，同时保留原控制台日志', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const offSync = (await import('../game/src/core/event-bus.js')).on('diagnostic-test', () => { throw new TypeError('secret'); });
    const offAsync = (await import('../game/src/core/event-bus.js')).on('diagnostic-test', () => Promise.reject(new RangeError('secret')));
    emit('diagnostic-test');
    await Promise.resolve();
    offSync(); offAsync();
    expect(getDiagnosticSummary()?.recent.map(record => record.source)).toContain('event-bus.sync');
    expect(getDiagnosticSummary()?.recent.map(record => record.source)).toContain('event-bus.async');
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it('存储写入失败时导出仍包含内存摘要，且不会重复同一诊断', () => {
    const storage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('quota secret', 'QuotaExceededError'); },
    };
    recordDiagnostic('battle-loader', new DOMException('private value', 'QuotaExceededError'), storage);
    const summary = getDiagnosticSummary(storage);
    expect(summary?.count).toBe(1);
    expect(summary?.recent[0]).toMatchObject({ source: 'battle-loader', name: 'QuotaExceededError', code: 'STORAGE' });
    expect(getDiagnosticSummary(storage)?.count).toBe(1);
  });

  it('记录数量有上限，导出只追加安全摘要且无诊断时兼容旧格式', () => {
    for (let index = 0; index < MAX_DIAGNOSTICS + 7; index++) {
      recordDiagnostic('unknown-source', new Error('private'), localStorage, Date.now() + 1000 * index);
    }
    expect(readLocalDiagnostics(localStorage)).toHaveLength(MAX_DIAGNOSTICS);

    localStorage.removeItem(DIAGNOSTICS_KEY);
    resetDiagnosticMemory();
    const oldRecord = { ts: 't', text: 'x', page: { id: 'p', name: '页' }, target: { name: '按钮' } };
    expect(feedbackExportRecord(oldRecord)).not.toHaveProperty('diagnostics');
    const exported = feedbackExportRecord(oldRecord, { count: 1, recent: [{
      at: '2026-09-23T00:00:00.000Z', source: 'event-bus.sync', name: 'TypeError', code: 'UNKNOWN',
      message: 'must not pass through', path: 'C:\\private\\save',
    }] });
    expect(exported.diagnostics).toEqual({ count: 1, recent: [{
      at: '2026-09-23T00:00:00.000Z', source: 'event-bus.sync', name: 'TypeError', code: 'UNKNOWN',
    }] });
    expect(JSON.stringify(exported)).not.toContain('private');
  });
});
