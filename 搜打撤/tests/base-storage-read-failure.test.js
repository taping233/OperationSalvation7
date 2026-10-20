import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readBase, readBaseReceipt, commitBase } from '../game/src/hub/base.commands.js';

const Base = window.SDT.Base;
const key = Base.SLOT_KEY(1);
const copy = value => JSON.parse(JSON.stringify(value));

function seed(revision = 0) {
  const raw = JSON.stringify({ version: Base.BASE_VERSION, coins: 150, stash: [], pocket: [],
    _m01: { revision, requests: {} } });
  localStorage.setItem(key, raw);
  Base.use(1);
  return raw;
}

function failReads() {
  const get = Storage.prototype.getItem;
  return vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (name) {
    if (name === key) throw new Error('read unavailable');
    return get.call(this, name);
  });
}

function prepare(read) {
  const afterState = copy(read.value);
  afterState.coins -= 10;
  return { command: 'home.purchase', beforeRevision: read.revision, afterState,
    payload: { furnitureId: 'chair' }, events: [{ type: 'home.changed' }] };
}

describe('基地存储读取失败边界', () => {
  beforeEach(() => {
    localStorage.clear();
    Base.use(1);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('读取失败拒绝快照、收据与提交，保留修订号为零的真实存档且不发布事件', async () => {
    const beforeDisk = seed();
    const read = readBase(1);
    const change = prepare(read);
    const context = { slotId: 1, requestId: 'read-failed', expectedRevision: 0 };
    const beforeMemory = copy(Base.data);
    const get = failReads();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const publish = vi.spyOn(window, 'dispatchEvent');
    const failure = { ok: false, code: 'SAVE_FAILED', retryable: true, details: { issue: 'readFailed' } };

    expect(readBase(1)).toMatchObject(failure);
    expect(readBaseReceipt(context, { command: change.command, payload: change.payload })).toMatchObject(failure);
    expect(await commitBase(context, change)).toMatchObject(failure);
    expect(Base.issue(1)).toBe('readFailed');
    expect((await Base.save())).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(Base.data).toEqual(beforeMemory);
    get.mockRestore();
    expect(localStorage.getItem(key)).toBe(beforeDisk);
  });

  it('健康读取清除暂时异常，恢复原余额和修订号后同一请求可成功且幂等', async () => {
    seed(4);
    const read = readBase(1);
    const change = prepare(read);
    const context = { slotId: 1, requestId: 'read-recovered', expectedRevision: 4 };
    const get = failReads();
    expect(await commitBase(context, change)).toMatchObject({ ok: false, code: 'SAVE_FAILED', retryable: true });
    get.mockRestore();

    expect(readBase(1)).toMatchObject({ ok: true, revision: 4, value: { coins: 150 } });
    expect(Base.issue(1)).toBeNull();
    const committed = await commitBase(context, change);
    expect(committed).toMatchObject({ ok: true, revision: 5 });
    expect(await commitBase(context, change)).toEqual(committed);
    expect(readBaseReceipt(context, { command: change.command, payload: change.payload })).toEqual(committed);
    expect(JSON.parse(localStorage.getItem(key))).toMatchObject({ coins: 140, _m01: { revision: 5 } });
  });

  it('失败装载的兜底运行态不能在健康只读预览后覆盖原档，重新装载才恢复写权限', async () => {
    const beforeDisk = seed();
    const get = failReads();
    Base.use(1);
    expect(Base.issue(1)).toBe('readFailed');
    get.mockRestore();

    expect(Base.peek(1)).toMatchObject({ coins: 150 });
    expect(readBase(1)).toMatchObject({ ok: true, value: { coins: 150 } });
    expect(Base.issue(1)).toBeNull();
    Base.data.coins = 2;
    expect((await Base.save())).toBe(false);
    expect(localStorage.getItem(key)).toBe(beforeDisk);

    expect(Base.use(1)).toMatchObject({ coins: 150 });
    Base.data.coins = 140;
    expect((await Base.save())).toBe(true);
    expect(JSON.parse(localStorage.getItem(key)).coins).toBe(140);
  });

  it('刷新读取失败不授予写权限，健康刷新采纳存档后恢复保存', async () => {
    const beforeDisk = seed();
    const get = failReads();
    expect(Base._refreshExternal(1)).toBeNull();
    expect(Base.issue(1)).toBe('readFailed');
    get.mockRestore();

    expect(Base.peek(1)).toMatchObject({ coins: 150 });
    Base.data.coins = 2;
    expect((await Base.save())).toBe(false);
    expect(localStorage.getItem(key)).toBe(beforeDisk);
    expect(Base._refreshExternal(1)).toMatchObject({ coins: 150 });
    expect((await Base.save())).toBe(true);
  });

  it('真正缺档的健康读取可清除旧异常并按零修订号初始化提交', async () => {
    const get = failReads();
    expect(readBase(1)).toMatchObject({ ok: false, details: { issue: 'readFailed' } });
    get.mockRestore();

    const read = readBase(1);
    expect(read).toMatchObject({ ok: true, revision: 0, value: { coins: 0 } });
    expect(Base.issue(1)).toBeNull();
    const afterState = copy(read.value);
    afterState.coins = 2;
    expect(await commitBase({ slotId: 1, requestId: 'empty-created', expectedRevision: 0 }, {
      command: 'test.create', beforeRevision: 0, afterState,
    })).toMatchObject({ ok: true, revision: 1 });
    expect(JSON.parse(localStorage.getItem(key)).coins).toBe(2);
  });

  it('显式重开可在健康读取后重置失败装载的档位', async () => {
    seed();
    const get = failReads();
    Base.use(1);
    expect((await Base.reset(1))).toBe(false);
    get.mockRestore();

    expect((await Base.reset(1))).toBe(true);
    expect(Base.issue(1)).toBeNull();
    expect(JSON.parse(localStorage.getItem(key)).coins).toBe(0);
  });

  it('装载和预览各只读一次基地原串，状态与写基线使用同一份读取结果', () => {
    seed();
    const get = vi.spyOn(Storage.prototype, 'getItem');
    Base.use(1);
    expect(get.mock.calls.filter(([name]) => name === key)).toHaveLength(1);
    get.mockClear();
    Base.peek(1);
    expect(get.mock.calls.filter(([name]) => name === key)).toHaveLength(1);
  });
});
