import { afterEach, describe, expect, it, vi } from 'vitest';

// 结点备注存储失败契约（2026-09-28 代码线）：set 写入失败（配额满/隐私模式）
// 返回 false 且不抛错——旧实现裸 setItem 抛错炸断 saveNote 回调，备注丢失、
// 弹层卡死在 modal。clearAll 静默容忍存储不可用。
await import('../game/src/core/notes.js');
const { KEY } = await import('../game/src/core/notes.js');
const { set, clearAll } = window.SDT.Notes;

afterEach(() => vi.unstubAllGlobals());

describe('core/notes 存储失败契约', () => {
  it('写入成功返回数据对象', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    const out = set(1, 2, 3, '笔记');
    expect(out).toEqual({ '1|2,3': '笔记' });
  });

  it('写入失败（配额满）返回 false 不抛错，且不虚构写入', () => {
    const backing = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => backing.get(k) ?? null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: (k) => backing.delete(k),
    });
    expect(set(1, 2, 3, '笔记')).toBe(false);
    expect(backing.has(KEY)).toBe(false);
  });

  it('clearAll 在存储不可用时静默容忍', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => { throw new Error('unavailable'); },
    });
    expect(() => clearAll()).not.toThrow();
  });
});
