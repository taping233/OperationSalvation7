import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVersionedSlotReader } from '../game/src/hub/versioned-slot-reader.js';

// 版本化档位读取管线的直接单测（2026-09-28 代码线收敛批）：
// 之前 base.js / game.storage.js 各持一份孪生实现，只有间接覆盖；
// 收敛后管线骨架唯一权威，这里把契约逐条钉死，防止两侧语义再次漂移。

const MIGRATIONS = {
  1: (d) => { d.added = (d.added || 0) + 1; return d; },
};

function makeReader(overrides = {}) {
  return createVersionedSlotReader({
    logTag: '[test]',
    maxVersion: 2,
    migrations: MIGRATIONS,
    corruptKeyFor: (i) => `test-corrupt-${i}`,
    versionOf: (d) => {
      const v = Object.hasOwn(d, 'version') ? d.version : 0;
      return (Number.isInteger(v) && v >= 0) ? v : NaN;
    },
    rejectArrays: true,
    ...overrides,
  });
}

describe('versioned-slot-reader 版本化读取管线', () => {
  beforeEach(() => localStorage.clear());

  it('空原串清缓存清 issue 并返回 null', () => {
    const r = makeReader();
    localStorage.setItem('test-corrupt-1', 'old');
    expect(r.parse(1, null)).toBeNull();
    expect(r.issue(1)).toBeNull();
  });

  it('缺失 version 按 0 迁移并逐版盖章到当前版本', () => {
    const r = makeReader();
    const out = r.parse(1, JSON.stringify({ hp: 10 }));
    expect(out).toEqual({ hp: 10, added: 1, version: 2 });
    expect(r.issue(1)).toBeNull();
  });

  it('过新版本拒读并标记 tooNew，原串原样保留不碰', () => {
    const r = makeReader();
    const raw = JSON.stringify({ version: 3 });
    localStorage.setItem('test-slot', raw);
    expect(r.parse(1, raw)).toBeNull();
    expect(r.issue(1)).toBe('tooNew');
    expect(localStorage.getItem('test-slot')).toBe(raw);   // 原键原串未动
  });

  it('非法 JSON 与坏版本形状走坏档备份（备份失败如实告警不虚构）', () => {
    const r = makeReader();
    expect(r.parse(1, '{broken')).toBeNull();
    expect(r.issue(1)).toBe('corrupt');
    expect(localStorage.getItem('test-corrupt-1')).toBe('{broken');
    // versionOf 返回 NaN（如小数版本）同判损坏
    expect(r.parse(2, JSON.stringify({ version: 1.5 }))).toBeNull();
    expect(r.issue(2)).toBe('corrupt');
  });

  it('备份失败（存储不可写）不虚构已备份', () => {
    const r = makeReader();
    // jsdom 的 Storage 实例方法 spyOn 不可靠，直接整体换掉 localStorage
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('quota'); },
      removeItem: () => {},
    });
    try {
      expect(r.parse(1, '{broken')).toBeNull();
      expect(r.issue(1)).toBe('corrupt');
      expect(localStorage.getItem('test-corrupt-1')).toBeNull();   // 没有假备份串
    } finally { vi.unstubAllGlobals(); }
  });

  it('rejectArrays=true 拒数组顶层判损坏（run 语义）', () => {
    const r = makeReader();
    expect(r.parse(1, '[]')).toBeNull();
    expect(r.issue(1)).toBe('corrupt');
  });

  it('invalidateAll 清空全部指纹缓存', () => {
    const r = makeReader();
    const raw = JSON.stringify({ hp: 7 });
    const first = r.parse(1, raw);
    r.invalidateAll();
    expect(r.parse(1, raw)).not.toBe(first);   // 缓存已空：重新解析出新的对象
  });

  it('指纹缓存命中直出、原串变化自动重解析', () => {
    const r = makeReader();
    const raw = JSON.stringify({ hp: 1 });
    const first = r.parse(1, raw);
    first.hp = 999;   // base 语义：出口是同一引用，允许就地加工
    expect(r.parse(1, raw)).toBe(first);
    const raw2 = JSON.stringify({ hp: 2 });
    const second = r.parse(1, raw2);
    expect(second).not.toBe(first);
    expect(second.hp).toBe(2);
  });

  it('命中与成功路径清除旧 issue（修复粘滞缺陷）', () => {
    const r = makeReader();
    r.parse(1, '{broken');
    expect(r.issue(1)).toBe('corrupt');
    // 原档被外部修复为合法串后，issue 不再粘滞
    const good = JSON.stringify({ hp: 5 });
    expect(r.parse(1, good)).toEqual({ hp: 5, added: 1, version: 2 });
    expect(r.issue(1)).toBeNull();
  });

  it('rejectArrays=false 放行数组顶层（base 历史语义）', () => {
    const r = makeReader({ rejectArrays: false, versionOf: () => 0 });
    const out = r.parse(1, JSON.stringify(['a']));
    expect(Array.isArray(out)).toBe(true);
    expect(out[0]).toBe('a');
  });

  it('宽松 versionOf（+version||0）不因版本形状判坏', () => {
    const r = makeReader({ versionOf: (d) => +d.version || 0 });
    expect(r.parse(1, JSON.stringify({ version: 'abc' }))).toEqual({ version: 2, added: 1 });
  });

  it('postMigrate 与 toPublic 按注入生效（run 侧克隆语义）', () => {
    const r = makeReader({
      postMigrate: (d) => { d.tagged = true; return d; },
      toPublic: (d) => ({ ...d, _hidden: undefined }),
    });
    const out = r.parse(1, JSON.stringify({ hp: 3 }));
    expect(out).toEqual({ hp: 3, added: 1, version: 2, tagged: true, _hidden: undefined });
    // 缓存值与出口对象分离：改出口不影响缓存命中结果
    out.hp = 0;
    expect(r.parse(1, JSON.stringify({ hp: 3 })).hp).toBe(3);
  });

  it('poke 写穿透与 invalidate 失效', () => {
    const r = makeReader();
    r.poke(1, '{"v":1}', { written: true });
    expect(r.parse(1, '{"v":1}')).toEqual({ written: true });
    r.invalidate(1);
    expect(r.parse(1, '{"v":1}')).toEqual({ v: 1, added: 1, version: 2 });
  });
});
