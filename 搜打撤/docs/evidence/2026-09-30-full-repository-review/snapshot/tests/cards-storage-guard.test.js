// 卡牌库（sdt-cards-v1）坏档备份与并发防护（2026-09-24 F2/F3）：
// 解析失败 → 原串备份 sdt-cards-corrupt + 降级禁写（自动播种不再覆盖原库）；
// 旧缓存页写回 → 检测到外部已改库即放弃（不回滚新批次），缓存失效自愈；
// upsert 单卡写入在失配后重放到最新库之上（不丢写入也不回滚他人）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');

const Cards = window.SDT.Cards;
const CORRUPT_BACKUP_KEY = 'sdt-cards-corrupt';

describe('卡牌库损坏备份与写回防护（F2/F3）', () => {
  beforeEach(() => { localStorage.clear(); Cards.clearAll(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('库串解析失败：原串备份到 corrupt 键、原键不动，自动写回（含播种）被禁止', () => {
    const corrupt = '{"cards": [broken';
    localStorage.setItem(KEY, corrupt);
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(Cards.all()).toEqual([]);
    expect(localStorage.getItem(CORRUPT_BACKUP_KEY)).toBe(corrupt);
    expect(localStorage.getItem(KEY)).toBe(corrupt);
    // 模拟启动链 ensureStarters / ensure* 的自动写回路径：全部被拒
    Cards.upsert({ id: 'starter-attack', name: '初始攻击' });
    expect(Cards.saveAll([{ id: 'whatever' }])).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(corrupt);
    expect(warns.mock.calls.some(c => String(c[0]).includes('sdt-cards-corrupt'))).toBe(true);
  });

  it('JSON 合法但不是数组同样备份 + 降级，不在读取时抛 TypeError', () => {
    localStorage.setItem(KEY, '"just a string"');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => Cards.all()).not.toThrow();
    expect(Cards.all()).toEqual([]);
    expect(localStorage.getItem(CORRUPT_BACKUP_KEY)).toBe('"just a string"');
    expect(localStorage.getItem(KEY)).toBe('"just a string"');
  });

  it('损坏降级后可用 clearAll（清空卡牌库）恢复可写，备份键保留供追查', () => {
    localStorage.setItem(KEY, '{broken');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    Cards.all();
    Cards.upsert({ id: 'a', name: 'A' });
    expect(localStorage.getItem(KEY)).toBe('{broken');   // 降级期间写不进去
    Cards.clearAll();
    Cards.upsert({ id: 'a', name: 'A' });
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual([{ id: 'a', name: 'A' }]);
    expect(localStorage.getItem(CORRUPT_BACKUP_KEY)).toBe('{broken');
  });

  it('空库指纹口径：KEY 缺失与 [] 视为同一状态，全新环境播种不被误判冲突', () => {
    expect(Cards.saveAll([{ id: 'c1', name: '第一张' }])).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual([{ id: 'c1', name: '第一张' }]);
  });

  it('旧缓存页写回不回滚另一标签页刚播入的批次（放弃写回 + 缓存失效自愈）', () => {
    Cards.saveAll([{ id: 'old-1', name: '旧卡' }]);            // 旧标签页基线
    const newRaw = JSON.stringify([{ id: 'old-1', name: '旧卡' }, { id: 'tt12-x', name: '新批次卡' }]);
    localStorage.setItem(KEY, newRaw);                          // 新标签页播种 TT12 后的库
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stale = Cards.all().slice();                          // 旧标签页缓存（不含 tt12-x）
    stale.push({ id: 'old-edit', name: '旧标签编辑' });
    expect(Cards.saveAll(stale)).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(newRaw);             // 新批次未被整体回滚
    // 缓存已失效：下一次 all() 读到最新库，后续写回恢复正常
    expect(Cards.all().some(c => c.id === 'tt12-x')).toBe(true);
    expect(Cards.saveAll(Cards.all())).toBe(true);
    expect(localStorage.getItem(KEY)).toBe(newRaw);
  });

  it('upsert 并发失配时重放到最新库之上：不丢本次写入也不回滚他人批次', () => {
    Cards.saveAll([{ id: 'old-1', name: '旧卡' }]);
    localStorage.setItem(KEY, JSON.stringify([{ id: 'old-1', name: '旧卡' }, { id: 'tt12-x', name: '新批次卡' }]));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    Cards.upsert({ id: 'designer-edit', name: '设计者新卡' });
    const lib = JSON.parse(localStorage.getItem(KEY));
    expect(lib.some(c => c.id === 'tt12-x')).toBe(true);
    expect(lib.some(c => c.id === 'designer-edit')).toBe(true);
  });

  it('单标签正常流程不受并发校验影响：连续写回全部成功', () => {
    expect(Cards.saveAll([{ id: 'a', name: 'A' }])).toBe(true);
    Cards.upsert({ id: 'b', name: 'B' });
    Cards.upsert({ id: 'a', name: 'A 改' });   // 同 id 覆盖
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual([{ id: 'a', name: 'A 改' }, { id: 'b', name: 'B' }]);
  });
});
