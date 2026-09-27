import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RunStorage } from '../game/src/hub/game.storage.js';
import { validateRunSave } from '../game/src/hub/run-save-validation.js';

const key = RunStorage.key(1);
const fixture = name => JSON.parse(readFileSync(resolve(process.cwd(), `tests/fixtures/${name}`), 'utf8'));

describe('E5 storage 读取边界', () => {
  beforeEach(() => {
    localStorage.clear();
    RunStorage.remove(1);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([[], null, 3, 'run', { version: null }, { version: false }, { version: '1' },
    { version: -1 }, { version: 1.5 }, { version: {} }, { version: [] }])('拒绝非法顶层/版本 %j 并保留原串', value => {
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    expect(RunStorage.read(1)).toBeNull();
    expect(RunStorage.issue(1)).toBe('corrupt');
    expect(localStorage.getItem(key)).toBe(raw);
    expect(localStorage.getItem(RunStorage.corruptKey(1))).toBe(raw);
  });

  it.each([undefined, 0, 1, 2])('保留历史 version=%j 的迁移与扩展字段', version => {
    const value = { hp: 0, extension: { untouched: true }, ...(version === undefined ? {} : { version }) };
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    expect(RunStorage.read(1)).toMatchObject({ hp: 0, version: 2, extension: value.extension });
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('未来整数版本与坏版本明确区分，且不备份/覆盖', () => {
    const raw = JSON.stringify({ version: 3 });
    localStorage.setItem(key, raw);
    expect(RunStorage.read(1)).toBeNull();
    expect(RunStorage.issue(1)).toBe('tooNew');
    expect(localStorage.getItem(RunStorage.corruptKey(1))).toBeNull();
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('备份失败只声称原档保留', () => {
    localStorage.setItem(key, '{bad');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(RunStorage.read(1)).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('备份失败，原档已保留'));
    expect(localStorage.getItem(key)).toBe('{bad');
    expect(localStorage.getItem(RunStorage.corruptKey(1))).toBeNull();
  });

  it('另一标签先损坏/未来版本再恢复缓存原串时清除陈旧 issue', () => {
    const raw = JSON.stringify({ version: 2, hp: 12 });
    localStorage.setItem(key, raw);
    expect(RunStorage.readForLoad(1).hp).toBe(12);
    for (const replaced of ['{bad', '{"version":3}']) {
      localStorage.setItem(key, replaced);
      expect(RunStorage.read(1)).toBeNull();
      localStorage.setItem(key, raw);
      expect(RunStorage.read(1).hp).toBe(12);
      expect(RunStorage.issue(1)).toBeNull();
    }
  });

  it('缺档清理读取异常但不推进写入基线，保护另一标签删除', () => {
    localStorage.setItem(key, '{"version":2,"hp":12}');
    RunStorage.readForLoad(1);
    localStorage.setItem(key, '{bad');
    RunStorage.read(1);
    localStorage.removeItem(key);
    expect(RunStorage.read(1)).toBeNull();
    expect(RunStorage.issue(1)).toBeNull();
    expect(RunStorage.write(1, { hp: 9 })).toBe(false);
    expect(RunStorage.lastWriteIssue(1)).toBe('STALE_SLOT');
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('装载者修改卡实例/地图节点不会污染相同原串的读取缓存', () => {
    const raw = JSON.stringify({ version: 2, ownedCards: [{ card: { id: 'custom', name: '原卡' } }], mapSnapshot: { nodes: [{ visited: false }] } });
    localStorage.setItem(key, raw);
    const first = RunStorage.readForLoad(1);
    first.ownedCards[0].card.name = '运行态修改';
    first.mapSnapshot.nodes[0].visited = true;
    const next = RunStorage.read(1);
    expect(next.ownedCards[0].card.name).toBe('原卡');
    expect(next.mapSnapshot.nodes[0].visited).toBe(false);
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('只预检另一标签的坏结构不能授权旧运行态覆盖原串', () => {
    localStorage.setItem(key, '{"version":2,"ownedCards":[]}');
    RunStorage.readForLoad(1);
    const changed = '{"version":2,"ownedCards":[null]}';
    localStorage.setItem(key, changed);
    const candidate = RunStorage.readForPreflight(1);
    expect(validateRunSave(candidate).ok).toBe(false);
    expect(RunStorage.write(1, { ownedCards: [] })).toBe(false);
    expect(localStorage.getItem(key)).toBe(changed);
  });

  it('采纳必须使用已校验对象的精确原串，拒绝克隆/错槽/读取后替换', () => {
    const raw = '{"version":2,"ownedCards":[]}';
    localStorage.setItem(key, raw);
    const candidate = RunStorage.readForPreflight(1);
    expect(RunStorage.acceptLoad(1, { ...candidate }).code).toBe('STALE_SLOT');
    expect(RunStorage.acceptLoad(2, candidate).code).toBe('STALE_SLOT');
    localStorage.setItem(key, raw + ' ');
    expect(RunStorage.acceptLoad(1, candidate)).toMatchObject({ ok: false, code: 'STALE_SLOT', preserveRun: true });
    expect(localStorage.getItem(key)).toBe(raw + ' ');
  });

  it('预检只取一次原串，真正采纳后才允许写入', () => {
    localStorage.setItem(key, '{"version":2,"hp":1}');
    RunStorage.readForLoad(1);
    localStorage.setItem(key, '{"version":2,"hp":2}');
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const candidate = RunStorage.readForPreflight(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(RunStorage.write(1, { hp: 3 })).toBe(false);
    expect(RunStorage.acceptLoad(1, candidate)).toEqual({ ok: true });
    expect(RunStorage.write(1, { hp: 3 })).toBe(true);
  });

  it('预检/采纳读取失败可辨，且保留旧写基线', () => {
    localStorage.setItem(key, '{"version":2,"hp":1}');
    RunStorage.readForLoad(1);
    const candidate = RunStorage.readForPreflight(1);
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('read denied'); });
    expect(RunStorage.readForPreflight(1)).toBeNull();
    expect(RunStorage.issue(1)).toBe('readFailed');
    expect(RunStorage.acceptLoad(1, candidate)).toMatchObject({ ok: false, code: 'STORAGE_READ_FAILED', preserveRun: true });
    get.mockRestore();
    localStorage.setItem(key, '{"version":2,"hp":2}');
    expect(RunStorage.write(1, { hp: 3 })).toBe(false);
    expect(RunStorage.lastWriteIssue(1)).toBe('STALE_SLOT');
  });
});

describe('E5 恢复消费者最小结构校验', () => {
  it.each(['save-v1-run.json', 'save-v2-slot2-run.json'])('固定历史样本 %s 无损通过', name => {
    const data = fixture(name);
    const raw = JSON.stringify(data);
    expect(validateRunSave(data)).toEqual({ ok: true });
    expect(JSON.stringify(data)).toBe(raw);
  });

  it('缺省、null、未知卡 ID、扩展字段及标量默认仍保留', () => {
    const data = { inventory: null, cardOrder: null, eventLog: null, discovered: null, seen: null,
      ownedCards: [{ card: { id: 'not-in-library', custom: [1] } }], usedPocket: null,
      hp: 'old-default', nestActive: 'false', nestRunes: 'inactive', battle: null, extension: { a: [null] } };
    const raw = JSON.stringify(data);
    expect(validateRunSave({})).toEqual({ ok: true });
    expect(validateRunSave(data)).toEqual({ ok: true });
    expect(JSON.stringify(data)).toBe(raw);
  });

  it.each([
    { inventory: {} }, { inventory: [null] }, { ownedCards: [null] }, { ownedCards: [{}] },
    { ownedCards: [{ card: [] }] }, { ownedCards: 'bad' }, { usedPocket: [null] },
    { usedPocket: [{ card: 'bad' }] }, { cardBox: [null] }, { cardBox: {} },
    { cardOrder: {} }, { eventLog: {} }, { discovered: {} }, { discovered: 'bad' },
    { visited: [] }, { seen: 'bad' }, { shopStocks: [] }, { shopStocks: { a: {} } },
    { shopStocks: { a: [null] } }, { shopStocks: { a: [{}] } },
    { nestActive: true, nestRunes: {} }, { nestActive: true, nestEquipped: [null] },
    { nestActive: true, pendingRunePick: [{ attrs: '火' }] },
    { battle: [] }, { battle: { opts: [] } }, { battle: { opts: {}, foes: [null] } },
    { battle: { opts: {}, allies: [null] } }, { battle: { hand: {} } },
    { battle: { restartVersion: 1, opts: {}, foes: [null] } },
    { battle: { restartVersion: 1, enemyDefs: null, opts: {}, hand: {} } },
    { battle: { granted: [{ card: null }] } }, { battle: { zeroFeeUntil: [null] } },
    { battle: { cardOverrides: [['uid']] } }, { battle: { growthNames: {} } },
    { battle: { restartVersion: 1, enemyDefs: [null], opts: {} } },
    { battle: { restartVersion: 1, enemyDefs: [], opts: {}, run: { ownedCards: null } } },
    { battle: { restartVersion: 1, enemyDefs: [], opts: {}, run: { ownedCards: [{ card: null }] } } },
    { battle: { restartVersion: 1, enemyDefs: [], opts: {}, run: { usedPocket: {} } } },
    { battle: { opts: { nest: { runes: [{ attrs: null }] } } } },
  ])('坏字段在纯预检阶段拒绝且不修剪 %j', data => {
    const raw = JSON.stringify(data);
    expect(validateRunSave(data)).toMatchObject({ ok: false, code: 'INVALID_RUN_STRUCTURE', preserveRun: true });
    expect(JSON.stringify(data)).toBe(raw);
  });

  it('龙巢和未完成战斗允许合法空值与记录', () => {
    const rune = { name: '扩展符文', attrs: ['火'], kind: 'custom' };
    expect(validateRunSave({ nestActive: true, nestRunes: [rune], nestEquipped: [], pendingRunePick: null,
      shopStocks: { unopened: null, shop: [{ mystery: true, card: null }, { sold: true }, { empty: true }] },
      battle: { restartVersion: 1, enemyDefs: [{}], opts: { nest: { runes: [rune] } }, selectedDeck: null,
        run: { ownedCards: [], inventory: [], usedPocket: [], nestRunes: [], nestEquipped: [], extra: 3 } },
    })).toEqual({ ok: true });
    expect(validateRunSave({ battle: { opts: {}, foes: [{}], allies: [{}], hand: ['uid'], granted: [{ uid: 'u', card: {} }],
      zeroFeeUntil: [['uid', 0]], cardOverrides: [['uid', {}]], delayed: [{}], growthNames: ['card'] } })).toEqual({ ok: true });
  });
});
