/* 实机卡库同步脚本单测（卡库审计 2026-09-17 发现一「sync carried 失效」，2026-09-25 修复）。
 * 锁定两件事：
 * ① 六文件重构（2026-09-22）后脚本沙箱仍能建出源码有效卡库（旧脚本读 game/src/cards.js
 *    直接 ENOENT，链路整体失效）；
 * ② buildDoc 的 carried 保留语义——prev 覆盖批次未变化条目（cc-* 纯实机卡、共享 id 覆盖
 *    条目）必须单调保留，旧条件 `!srcIds.has(c.id)` 恒假会把它们整份抹掉。 */
import { describe, it, expect } from 'vitest';
import { sourceCardLibrary, diff, buildDoc, stripModule } from '../scripts/sync-cards-from-live.mjs';

describe('sync-cards-from-live 源码有效卡库（六文件沙箱）', () => {
  it('沙箱求值建出完整现役卡库，关键卡在位', () => {
    const lib = sourceCardLibrary();
    expect(lib.length, '现役卡库口径约 272 张，沙箱播种链应等量建出').toBeGreaterThan(250);
    expect(lib.some(c => c.id === 'tt8-hero-descender'), '能力卡（充能火山）应在源码有效卡库').toBe(true);
    expect(lib.some(c => c.id === 'tt3-garnet-marble'), '资源卡（石榴弹珠）应在源码有效卡库').toBe(true);
  });

  it('diff 对齐口径：完全一致的输入零差异', () => {
    const lib = sourceCardLibrary();
    const { upserts, changed, retire } = diff(lib, lib);
    expect(upserts).toHaveLength(0);
    expect(changed).toHaveLength(0);
    expect(retire).toHaveLength(0);
  });
});

describe('buildDoc carried 保留语义（2026-09-25 修正恒空 bug）', () => {
  const prevBase = { version: 9, changelog: [], retire: [] };

  it('prev 中未变化条目全部保留（纯实机卡 + 源码定义的共享 id 覆盖条目）', () => {
    const prev = { ...prevBase, cards: [
      { id: 'cc-fake-live', name: '历史纯实机卡' },   // 源码不定义：cc-* 类
      { id: 'tt-gold', value: 9 },                    // 源码定义且与实机一致：旧代码恒丢
    ] };
    const doc = buildDoc([], [], [], 10, prev);
    const ids = doc.cards.map(c => c.id);
    expect(ids).toContain('cc-fake-live');
    expect(ids, '未变化的定版覆盖条目不得被整份重写抹掉').toContain('tt-gold');
  });

  it('本轮覆盖同 id 时不堆积重复，取本轮新值', () => {
    const prev = { ...prevBase, cards: [{ id: 'tt-gold', value: 9 }] };
    const doc = buildDoc([], [{ id: 'tt-gold', value: 8 }], [], 10, prev);
    const golds = doc.cards.filter(c => c.id === 'tt-gold');
    expect(golds).toHaveLength(1);
    expect(golds[0].value).toBe(8);
  });

  it('退役名单条目不保留', () => {
    const prev = { ...prevBase, cards: [{ id: 'cc-gone', name: '已退役实机卡' }] };
    const doc = buildDoc([], [], ['cc-gone'], 10, prev);
    expect(doc.cards.map(c => c.id)).not.toContain('cc-gone');
  });

  it('无 id 的 prev 条目不进覆盖批次（与播种 upsert 语义对齐）', () => {
    const prev = { ...prevBase, cards: [{ name: '无id历史行' }] };
    const doc = buildDoc([], [], [], 10, prev);
    expect(doc.cards).toHaveLength(0);
  });
});

describe('stripModule 拼接剥壳', () => {
  it('剥 import / export 块 / export 前缀，重复 SDT 声明去重', () => {
    const seen = new Set();
    const a = stripModule('const SDT = window.SDT;   // 注释变体\nimport { X } from "./x.js";\nexport const A = 1;\n', seen);
    const b = stripModule('const SDT = window.SDT;\nexport function F() { return A; }\nexport { A };\n', seen);
    expect(a).not.toMatch(/import|export/);
    expect(a).toContain('const A = 1;');
    expect(b).not.toContain('const SDT = window.SDT;');
    expect(b).toContain('function F()');
    expect(b).not.toMatch(/export/);
  });
});
