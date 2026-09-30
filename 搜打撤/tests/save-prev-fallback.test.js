import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunStorage, TX_KEY } from '../game/src/hub/game.storage.js';

// U17 读档失败自动回退（2026-09-30 老板拍板 PENDING #17）：
// prev 备份键（bb2e122 写侧）补上读侧消费者——主档读取失败时回退上一版并自愈。
window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');
await import('../game/src/hub/meta.js');

const prevKey = slot => `sdt-run-${slot}-prev`;

describe('U17 读档失败自动回退 prev 备份', () => {
  beforeEach(() => {
    localStorage.clear();
    for (let slot = 1; slot <= 5; slot++) RunStorage.remove(slot);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('主档坏 + prev 好：读到 prev 数据，主档被逐字节自愈，身份不丢', () => {
    expect(RunStorage.write(1, { hp: 1, turn: 1 })).toBe(true);   // 首写：无 prev
    expect(RunStorage.write(1, { hp: 2, turn: 2 })).toBe(true);   // 覆盖：prev = 第一版原串
    const prevRaw = localStorage.getItem(prevKey(1));
    localStorage.setItem(RunStorage.key(1), '{broken json');
    const run = RunStorage.read(1);
    expect(run).not.toBeNull();
    expect(run.hp).toBe(1);   // 回退后是上一版数据，不是坏主档
    expect(RunStorage.issue(1)).toBeNull();
    // 自愈：主档 = prev 原串逐字节（_r2 身份与 version 原样保真，不经 write 重盖章）
    expect(localStorage.getItem(RunStorage.key(1))).toBe(prevRaw);
    expect(JSON.parse(prevRaw)._r2.runId).toBe(JSON.parse(localStorage.getItem(RunStorage.key(1)))._r2.runId);
    // 坏档原串仍留 corrupt 键（取证留存，与 prev 回退分工并存）
    expect(localStorage.getItem(RunStorage.corruptKey(1))).toBe('{broken json');
    // 诊断通道记账
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('已回退到上一版存档'));
    // 读取自愈不推进旧运行态的写基线；必须显式采纳恢复后的候选。
    expect(RunStorage.write(1, { hp: 3 })).toBe(false);
    expect(RunStorage.lastWriteIssue(1)).toBe('STALE_SLOT');
    expect(RunStorage.acceptLoad(1, RunStorage.readForPreflight(1))).toEqual({ ok: true });
    expect(RunStorage.write(1, { hp: 3 })).toBe(true);
    expect(RunStorage.read(1).hp).toBe(3);
  });

  it('主档 prev 都坏：维持现有失败路径，主档原样保留', () => {
    localStorage.setItem(RunStorage.key(2), '{broken');
    localStorage.setItem(prevKey(2), '{also broken');
    expect(RunStorage.read(2)).toBeNull();
    expect(RunStorage.issue(2)).toBe('corrupt');
    expect(localStorage.getItem(RunStorage.key(2))).toBe('{broken');
  });

  it('prev 也无效时主档失败口径不被污染（corrupt 不被 prev 的 tooNew 覆盖）', () => {
    localStorage.setItem(RunStorage.key(2), '{broken');
    localStorage.setItem(prevKey(2), JSON.stringify({ version: 99, hp: 1 }));
    expect(RunStorage.read(2)).toBeNull();
    expect(RunStorage.issue(2)).toBe('corrupt');
    expect(localStorage.getItem(RunStorage.key(2))).toBe('{broken');
  });

  it('tooNew 主档不回退（R11 复审口径）：过新档原串零备份保留，等新版程序读', () => {
    expect(RunStorage.write(4, { hp: 1 })).toBe(true);
    const tooNewRaw = JSON.stringify({ version: 99, hp: 9 });
    localStorage.setItem(RunStorage.key(4), tooNewRaw);
    expect(RunStorage.read(4)).toBeNull();
    // 回退自愈不触发：主档原串逐字节保留（不被 prev 覆盖），issue 维持 tooNew
    expect(localStorage.getItem(RunStorage.key(4))).toBe(tooNewRaw);
    expect(RunStorage.issue(4)).toBe('tooNew');
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('已回退到上一版存档'));
  });

  it('主档好：正常读档不触碰 prev、行为与基线逐字一致（零额外开销）', () => {
    expect(RunStorage.write(3, { hp: 5 })).toBe(true);
    expect(RunStorage.write(3, { hp: 6 })).toBe(true);
    const mainRaw = localStorage.getItem(RunStorage.key(3));
    const prevRaw = localStorage.getItem(prevKey(3));
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const run = RunStorage.read(3);
    expect(run.hp).toBe(6);
    // 失败分支才碰 prev：成功路径对 prev 键的读取次数为 0
    expect(get.mock.calls.filter(([k]) => k === prevKey(3))).toHaveLength(0);
    expect(localStorage.getItem(RunStorage.key(3))).toBe(mainRaw);
    expect(localStorage.getItem(prevKey(3))).toBe(prevRaw);
  });

  it('txPending（事务待恢复）：主档坏也不回退，走既有事务恢复路径', () => {
    expect(RunStorage.write(4, { hp: 1 })).toBe(true);
    expect(RunStorage.write(4, { hp: 2 })).toBe(true);
    const prevRaw = localStorage.getItem(prevKey(4));
    localStorage.setItem(RunStorage.key(4), '{broken');
    localStorage.setItem(TX_KEY(4), '{"version":1}');
    expect(RunStorage.read(4)).toBeNull();
    expect(localStorage.getItem(RunStorage.key(4))).toBe('{broken');   // 未自愈
    expect(localStorage.getItem(prevKey(4))).toBe(prevRaw);            // prev 未动
    // 事务日志清除后恢复普通读档语义：再读即回退自愈
    localStorage.removeItem(TX_KEY(4));
    expect(RunStorage.read(4).hp).toBe(1);
    expect(localStorage.getItem(RunStorage.key(4))).toBe(prevRaw);
  });

  it('装载链集成：预检回退后 acceptLoad 对上生效原串，采纳与写入贯通', () => {
    expect(RunStorage.write(5, { hp: 1 })).toBe(true);
    expect(RunStorage.write(5, { hp: 2 })).toBe(true);
    const prevRaw = localStorage.getItem(prevKey(5));
    localStorage.setItem(RunStorage.key(5), '{broken');
    const candidate = RunStorage.readForPreflight(5);
    expect(candidate.hp).toBe(1);   // 预检已回退到 prev 数据
    // 候选记账必须是生效原串（自愈后的 prev 原串），否则 acceptLoad 误报 STALE_SLOT
    expect(RunStorage.acceptLoad(5, candidate)).toEqual({ ok: true });
    expect(RunStorage.write(5, { hp: 7 })).toBe(true);
    expect(localStorage.getItem(RunStorage.key(5))).not.toBe(prevRaw);
    expect(RunStorage.read(5).hp).toBe(7);
  });

  it('readIdentity 保持只读窄口：不回退、不写回（R6 契约不动）', () => {
    expect(RunStorage.write(1, { hp: 1 })).toBe(true);
    expect(RunStorage.write(1, { hp: 2 })).toBe(true);
    localStorage.setItem(RunStorage.key(1), '{broken');
    expect(RunStorage.readIdentity(1)).toMatchObject({ ok: false, code: 'RUN_UNREADABLE' });
    expect(localStorage.getItem(RunStorage.key(1))).toBe('{broken');
  });

  it('显式 readForLoad 回退后采纳生效原串，兼容后续保存', () => {
    expect(RunStorage.write(1, { hp: 10 })).toBe(true);
    expect(RunStorage.write(1, { hp: 20 })).toBe(true);
    localStorage.setItem(RunStorage.key(1), '{broken');
    expect(RunStorage.readForLoad(1).hp).toBe(10);
    expect(RunStorage.write(1, { hp: 9 })).toBe(true);
  });

  it.each(['read', 'readForPreflight'])('%s 回退另一对局后不授予旧运行态写权', method => {
    expect(RunStorage.write(1, { hp: 30 })).toBe(true);
    const backup = JSON.stringify({ version: 2, hp: 12, _r2: { runId: 'other-run', revision: 4 } });
    localStorage.setItem(prevKey(1), backup);
    localStorage.setItem(RunStorage.key(1), '{broken');
    expect(RunStorage[method](1).hp).toBe(12);
    expect(RunStorage.write(1, { hp: 29 })).toBe(false);
    expect(RunStorage.lastWriteIssue(1)).toBe('STALE_SLOT');
    expect(localStorage.getItem(RunStorage.key(1))).toBe(backup);
  });
});
