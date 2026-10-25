import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertSlotWriteLease, withSlotWriteLock } from '../game/src/hub/slot-write-lock.js';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, UI: { log: vi.fn() }, Sound: { sfx: vi.fn() } };
await import('../game/src/core/mapData.js');
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');
const { commitBase, readBase } = await import('../game/src/hub/base.commands.js');
const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const Base = window.SDT.Base;

function serialLocks() {
  const tails = new Map(), active = new Set();
  return {
    active,
    request: vi.fn((name, _opts, callback) => {
      const task = (tails.get(name) || Promise.resolve()).then(() => {
        active.add(name);
        try { return callback(); } finally { active.delete(name); }
      });
      tails.set(name, task.catch(() => {}));
      return task;
    }),
  };
}
let locks;
beforeEach(async () => {
  vi.restoreAllMocks();
  locks = serialLocks();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: locks });
  localStorage.clear();
  Base.use(1);
  Base.data.coins = 1;
  Base.data.wood = 10;
  expect(await Base.save()).toBe(true);
});
afterEach(async () => { await Base.flushWrites(); vi.restoreAllMocks(); });

describe('Base所有持久写入共用同槽锁', () => {
  it('公开save和业务命令均为Promise，物理主档/备份写只在相同槽锁内发生', async () => {
    const original = Storage.prototype.setItem;
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key.startsWith('sdt-base-')) expect(locks.active.has('sdt-slot-1')).toBe(true);
      return original.call(this, key, value);
    });
    const saved = Base.save();
    expect(saved).toBeInstanceOf(Promise);
    expect(await saved).toBe(true);
    expect(await Base.purchase({ price: 1, material: 'wood' })).toEqual({ ok: true });
    expect(writes).toHaveBeenCalled();
    expect(locks.request.mock.calls.every(([name]) => name === 'sdt-slot-1')).toBe(true);
  });

  it('同槽两个并行购买在锁内重验余额，只扣一次而不会透支', async () => {
    const results = await Promise.all([Base.purchase({ price: 1, material: 'wood' }), Base.purchase({ price: 1, material: 'wood' })]);
    expect(results).toEqual([{ ok: true }, { ok: false, why: 'poor' }]);
    expect(Base.data.coins).toBe(0);
    expect(Base.data.wood).toBe(11);
  });

  it('通用mutate与requestId命令争同一锁，旧修订提交被拒绝且不发事件', async () => {
    const snapshot = readBase(1);
    const event = vi.fn(); window.addEventListener('sdt:domain-event', event);
    try {
      const purchase = Base.purchase({ price: 1, material: 'wood' });
      const command = commitBase({ slotId: 1, requestId: 'stale-claim', expectedRevision: snapshot.revision }, {
        command: 'claim', beforeRevision: snapshot.revision, afterState: { ...snapshot.value, coins: 100 },
        events: [{ type: 'claimed' }],
      });
      expect((await purchase).ok).toBe(true);
      expect((await command).code).toBe('STALE_REVISION');
      expect(Base.data.coins).toBe(0);
      expect(event).not.toHaveBeenCalled();
    } finally { window.removeEventListener('sdt:domain-event', event); }
  });

  it('requestId在锁内先查已完成回执，双重请求只发一次奖励/事件', async () => {
    const snapshot = readBase(1), event = vi.fn();
    const context = { slotId: 1, requestId: 'same-award', expectedRevision: snapshot.revision };
    const prepared = { command: 'award', beforeRevision: snapshot.revision, afterState: { ...snapshot.value, coins: 6 }, events: [{ type: 'award' }] };
    window.addEventListener('sdt:domain-event', event);
    try {
      const [first, second] = await Promise.all([commitBase(context, prepared), commitBase(context, prepared)]);
      expect(first.ok).toBe(true); expect(second).toEqual(first);
      expect(Base.data.coins).toBe(6); expect(event).toHaveBeenCalledOnce();
    } finally { window.removeEventListener('sdt:domain-event', event); }
  });

  it.each(['single', 'pair'])('已准备的%s事务等待锁时不会覆盖刚推进的checkpoint', async kind => {
    RunStorage.readForLoad(1);
    expect(await RunStorage.write(1, { seed: 'checkpoint-race', _r2: { runId: 'checkpoint-run', revision: 0 } })).toBe(true);
    const recovery = createRecoveryCommands({ lockManager: locks });
    const submit = () => {
      const snapshot = readBase(1), run = JSON.parse(localStorage.getItem(RunStorage.key(1)));
      return kind === 'single'
        ? commitBase({ slotId: 1, requestId: 'checkpoint-award', expectedRevision: snapshot.revision }, {
          command: 'award', beforeRevision: snapshot.revision, afterState: { ...snapshot.value, coins: 9 }, events: [],
        })
        : recovery.commitBaseAndRun({ slotId: 1, requestId: 'checkpoint-award', expectedBaseRevision: snapshot.revision,
          expectedRunRevision: run._r2.revision }, { command: 'award', runId: run._r2.runId,
          afterBase: { ...snapshot.value, coins: 9 }, afterRun: run });
    };
    const transaction = submit();
    const checkpoint = Base.recordEggBattle();
    expect((await transaction).code).toBe('STALE_REVISION');
    expect((await checkpoint).persisted).toBe(true);
    expect(Base.data).toMatchObject({ coins: 1, eggBattles: 1 });
    expect(JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)))).toMatchObject({ coins: 1, eggBattles: 1 });
    expect(localStorage.getItem('sdt-tx-v1-slot1')).toBeNull();
    expect((await submit()).ok).toBe(true);
    expect(Base.data).toMatchObject({ coins: 9, eggBattles: 1 });
  });

  it('失败重开恢复原写基线，旧内存不能随后覆盖外部新档', async () => {
    const key = Base.SLOT_KEY(1), raw = JSON.parse(localStorage.getItem(key));
    raw.coins = 99; raw._m01.revision++;
    localStorage.setItem(key, JSON.stringify(raw));
    const original = Storage.prototype.setItem;
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
      if (name === key) throw new Error('quota');
      return original.call(this, name, value);
    });
    expect(await Base.reset(1)).toBe(false);
    expect(Base.data.coins).toBe(1);
    failure.mockRestore();
    expect(await Base.save()).toBe(false);
    expect(JSON.parse(localStorage.getItem(key)).coins).toBe(99);
  });

  it('内存改名首写失败后同页重试仍实际保存，不把changed:false当作已落盘', async () => {
    Base.data.stash = [{ card: { id: 'rename-race', name: '旧名称' }, count: 1 }];
    expect(await Base.save()).toBe(true);
    vi.spyOn(window.SDT.Cards, 'applyAbilityRename').mockImplementation(cards => {
      const changed = cards.some(card => card.name === '旧名称');
      cards.forEach(card => { card.name = '新名称'; });
      return changed;
    });
    vi.spyOn(window.SDT.Cards, 'applyDuplicateRenames').mockReturnValue(false);
    const original = Storage.prototype.setItem;
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === Base.SLOT_KEY(1)) throw new Error('quota');
      return original.call(this, key, value);
    });
    expect(await Base.applyStoredCardRenames()).toEqual({ changed: true, persisted: false });
    failure.mockRestore();
    expect(await Base.applyStoredCardRenames()).toEqual({ changed: false, persisted: true });
    expect(JSON.parse(localStorage.getItem(Base.SLOT_KEY(1))).stash[0].card.name).toBe('新名称');
  });

  it('等待锁时切换档位，原操作不写新档或旧档', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_n, _o, callback) => { await gate; return callback(); } } });
    const old = localStorage.getItem(Base.SLOT_KEY(1));
    const purchase = Base.purchase({ price: 1, material: 'wood' });
    Base.use(2); release();
    expect((await purchase).ok).toBe(false);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(old);
    expect(localStorage.getItem(Base.SLOT_KEY(2))).toBeNull();
  });

  it('没有Web Locks时显式拒绝普通写命令，余额与原串保留', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    const raw = localStorage.getItem(Base.SLOT_KEY(1));
    expect(await Base.save()).toBe(false);
    expect((await Base.purchase({ price: 1, material: 'wood' })).code).toBe('CAPABILITY_UNAVAILABLE');
    expect(Base.data.coins).toBe(1);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(raw);
  });

  it('写失败保留业务库存，重试只扣一次', async () => {
    const original = Storage.prototype.setItem;
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === Base.SLOT_KEY(1)) throw new Error('quota');
      return original.call(this, key, value);
    });
    expect((await Base.purchase({ price: 1, material: 'wood' })).why).toBe('save');
    expect(Base.data.coins).toBe(1); expect(Base.data.wood).toBe(10);
    failure.mockRestore();
    expect((await Base.purchase({ price: 1, material: 'wood' })).ok).toBe(true);
    expect(Base.data.coins).toBe(0); expect(Base.data.wood).toBe(11);
  });

  it('旧checkpoint即时推进内存，批量蛋保底在锁等待期间也不会重复保底', async () => {
    Base.data.eggPity = 149;
    const first = Base.recordPetEggChestResult({ eggGranted: true });
    expect(Base.data.eggPity).toBe(0);
    expect(Base.petEggDropChance()).toBeLessThan(1);
    const second = Base.recordPetEggChestResult({ eggGranted: false });
    expect(Base.data.eggPity).toBe(1);
    expect((await first).persisted).toBe(true); expect((await second).persisted).toBe(true);
    expect(JSON.parse(localStorage.getItem(Base.SLOT_KEY(1))).eggPity).toBe(1);
  });

  it('伪造、跨槽或已经离开回调的lease不能调用私有写入口', async () => {
    const raw = localStorage.getItem(Base.SLOT_KEY(1));
    expect(() => Base._writeCommitted(1, Base.data, {})).toThrow(/lease/);
    let expired;
    const result = await withSlotWriteLock(1, lease => {
      expired = lease;
      expect(() => assertSlotWriteLease(lease, 2)).toThrow(/lease/);
      return true;
    });
    expect(result.ok).toBe(true);
    expect(() => Base._writeCommitted(1, Base.data, expired)).toThrow(/lease/);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(raw);
  });

  it('Base坏档备份同样排队持锁，peek不在读路径直接写入', async () => {
    localStorage.setItem(Base.SLOT_KEY(2), '{broken');
    const original = Storage.prototype.setItem;
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === Base.CORRUPT_KEY(2)) expect(locks.active.has('sdt-slot-2')).toBe(true);
      return original.call(this, key, value);
    });
    Base.peek(2);
    expect(localStorage.getItem(Base.CORRUPT_KEY(2))).toBeNull();
    await Base.flushWrites();
    expect(localStorage.getItem(Base.CORRUPT_KEY(2))).toBe('{broken');
    expect(writes).toHaveBeenCalled();
  });

  it('reset、wipe及旧档迁移也在目标槽锁内写入，迁移保留旧档原串', async () => {
    const originalSet = Storage.prototype.setItem, originalRemove = Storage.prototype.removeItem;
    const legacy = localStorage.getItem(Base.SLOT_KEY(1));
    localStorage.setItem(Base.LEGACY_KEY, legacy);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      const match = /^sdt-base-v2-slot(\d+)$/.exec(key);
      if (match) expect(locks.active.has(`sdt-slot-${match[1]}`)).toBe(true);
      return originalSet.call(this, key, value);
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      const match = /^sdt-base-v2-slot(\d+)$/.exec(key);
      if (match) expect(locks.active.has(`sdt-slot-${match[1]}`)).toBe(true);
      if (key === Base.LEGACY_KEY) expect(locks.active.has('sdt-slot-2')).toBe(true);
      return originalRemove.call(this, key);
    });
    expect(await Base.migrateLegacy([2, 3])).toBe(true);
    expect(localStorage.getItem(Base.SLOT_KEY(2))).toBe(legacy);
    expect(localStorage.getItem(Base.SLOT_KEY(3))).toBe(legacy);
    expect(await Base.wipe(3)).toBe(true);
    Base.use(3);
    expect(await Base.reset(3)).toBe(true);
    expect(localStorage.getItem(Base.SLOT_KEY(3))).not.toBeNull();
  });

  it('两键恢复提交与普通Base购买使用同一锁序，不互相覆盖', async () => {
    RunStorage.readForLoad(1);
    expect(await RunStorage.write(1, { seed: 'pair', _r2: { runId: 'pair-run', revision: 0 } })).toBe(true);
    const run = JSON.parse(localStorage.getItem(RunStorage.key(1)));
    const base = Base._readForCommit(1);
    const recovery = createRecoveryCommands({ lockManager: locks });
    const transaction = recovery.commitBaseAndRun({ slotId: 1, requestId: 'pair-award', expectedBaseRevision: base._m01.revision, expectedRunRevision: run._r2.revision }, {
      command: 'pair-award', runId: run._r2.runId, afterBase: { ...base, coins: 9 }, afterRun: run,
    });
    const purchase = Base.purchase({ price: 1, material: 'wood' });
    expect((await transaction).ok).toBe(true);
    expect((await purchase).ok).toBe(true);
    expect(Base.data.coins).toBe(8);
    expect(JSON.parse(localStorage.getItem(Base.SLOT_KEY(1))).coins).toBe(8);
    expect(locks.request.mock.calls.every(([name]) => name === 'sdt-slot-1')).toBe(true);
  });
});
