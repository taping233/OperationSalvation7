import { describe, expect, it } from 'vitest';
import { FURNITURE_CATALOG, ROOM_SPEC } from '../game/src/home.catalog.js';
import { createHomeCommands, getHome, validateLayout } from '../game/src/home.commands.js';

const initial = (coins = 30) => ({ coins, collection: {}, home: { owned: {}, placements: [], displays: [] }, xp: 7, power: 11 });

function memoryPort(seed = initial()) {
  let state = structuredClone(seed), revision = 0;
  const completed = new Map();
  let failSave = false;
  return {
    readBase: () => ({ ok: true, value: structuredClone(state), revision }),
    readBaseReceipt: async (context, { command, payload }) => {
      const hit = completed.get(`${context.slotId}:${command}:${context.requestId}`);
      if (!hit) return { ok: true, value: null, revision };
      return hit.signature === JSON.stringify(payload) ? structuredClone(hit.result) : { ok: false, code: 'REQUEST_ID_CONFLICT', retryable: false };
    },
    commitBase: async (context, change) => {
      const key = `${context.slotId}:${change.command}:${context.requestId}`;
      const signature = JSON.stringify(change.payload);
      if (completed.has(key)) {
        const old = completed.get(key);
        return old.signature === signature ? structuredClone(old.result) : { ok: false, code: 'REQUEST_ID_CONFLICT', retryable: false };
      }
      if (context.expectedRevision !== revision) return { ok: false, code: 'STALE_REVISION', retryable: false };
      if (failSave) return { ok: false, code: 'SAVE_FAILED', retryable: true };
      state = structuredClone(change.afterState); revision++;
      const result = { ok: true, value: { baseRevision: revision, ...(change.output === undefined ? {} : { output: change.output }) }, revision };
      completed.set(key, { signature, result });
      return structuredClone(result);
    },
    state: () => structuredClone(state),
    revision: () => revision,
    failNext: value => { failSave = value; },
  };
}

describe('M03-A 家具购买', () => {
  it('扣现有储备币、增加稳定实例；同请求重试不重复，新请求受上限约束', async () => {
    const port = memoryPort(initial(30));
    const home = createHomeCommands(port);
    const first = await home.buyFurniture({ slotId: 1, requestId: 'buy-1', expectedRevision: 0 }, { furnitureId: 'chair', quantity: 1 });
    expect(first.ok).toBe(true);
    expect(port.state().coins).toBe(27);
    expect(port.state().home.owned.chair).toEqual(['chair-1']);
    const retry = await home.buyFurniture({ slotId: 1, requestId: 'buy-1', expectedRevision: 0 }, { furnitureId: 'chair', quantity: 1 });
    expect(retry.ok).toBe(true);
    expect(port.state().coins).toBe(27);
    expect(port.state().home.owned.chair).toHaveLength(1);
    expect((await home.buyFurniture({ slotId: 1, requestId: 'buy-2', expectedRevision: 1 }, { furnitureId: 'chair', quantity: 3 })).ok).toBe(true);
    expect((await home.buyFurniture({ slotId: 1, requestId: 'buy-3', expectedRevision: 2 }, { furnitureId: 'chair', quantity: 1 })).code).toBe('INVALID_STATE');
  });

  it('不足与保存失败都不改变币和拥有量', async () => {
    const poor = memoryPort(initial(2));
    expect((await createHomeCommands(poor).buyFurniture({ slotId: 1, requestId: 'p', expectedRevision: 0 }, { furnitureId: 'chair' })).code).toBe('INSUFFICIENT_FUNDS');
    expect(poor.state()).toEqual(initial(2));
    const broken = memoryPort(initial(30)); broken.failNext(true);
    expect((await createHomeCommands(broken).buyFurniture({ slotId: 1, requestId: 'f', expectedRevision: 0 }, { furnitureId: 'chair' })).code).toBe('SAVE_FAILED');
    expect(broken.state()).toEqual(initial(30));
  });
});

describe('M03-B/C 布局验证与原子保存', () => {
  const owned = { 'work-table': ['work-table-1'], 'table-lamp': ['table-lamp-1'], chair: ['chair-1'], 'woven-rug': ['woven-rug-1'], 'wall-decoration': ['wall-decoration-1'] };
  const valid = [
    { instanceId: 'work-table-1', furnitureId: 'work-table', zoneId: 'room-floor', x: 1, y: 2, rotation: 0 },
    { instanceId: 'table-lamp-1', furnitureId: 'table-lamp', zoneId: 'room-floor', x: 1, y: 2, rotation: 0 },
    { instanceId: 'woven-rug-1', furnitureId: 'woven-rug', zoneId: 'room-floor', x: 0, y: 1, rotation: 0 },
    { instanceId: 'wall-decoration-1', furnitureId: 'wall-decoration', zoneId: 'back-wall', x: 3, y: 0, rotation: 0 },
  ];

  it('允许地毯与落地家具、桌灯与工作桌重叠，拒绝缺支撑/越界/旋转/未拥有/普通冲突', () => {
    expect(validateLayout({ placements: valid, roomSpec: ROOM_SPEC, ownedFurniture: owned }).valid).toBe(true);
    const cases = [
      [{ ...valid[1], x: 6 }, 'MISSING_SUPPORT'],
      [{ ...valid[0], x: 7 }, 'PLACEMENT_OUT_OF_BOUNDS'],
      [{ ...valid[1], rotation: 90 }, 'INVALID_ROTATION'],
      [{ instanceId: 'chair-x', furnitureId: 'chair', zoneId: 'room-floor', x: 5, y: 2, rotation: 0 }, 'UNOWNED_INSTANCE'],
      [[...valid, { instanceId: 'chair-1', furnitureId: 'chair', zoneId: 'room-floor', x: 1, y: 2, rotation: 0 }], 'PLACEMENT_OVERLAP'],
    ];
    for (const [change, code] of cases) {
      const placements = Array.isArray(change) ? change : valid.map((p, i) => i === (code === 'PLACEMENT_OUT_OF_BOUNDS' ? 0 : code === 'INVALID_ROTATION' || code === 'MISSING_SUPPORT' ? 1 : -1) ? change : p).concat(code === 'UNOWNED_INSTANCE' ? [change] : []);
      expect(validateLayout({ placements, roomSpec: ROOM_SPEC, ownedFurniture: owned }).violations.some(v => v.code === code)).toBe(true);
    }
  });

  it('合法布局重载一致；非法布局和保存失败保留旧布局', async () => {
    const port = memoryPort({ ...initial(), home: { owned, placements: [], displays: [] } });
    const api = createHomeCommands(port);
    expect((await api.saveLayout({ slotId: 1, requestId: 'layout-1', expectedRevision: 0 }, { placements: valid })).ok).toBe(true);
    expect(api.getHome(1).value.placements).toEqual(valid);
    const old = port.state().home.placements;
    expect((await api.saveLayout({ slotId: 1, requestId: 'layout-bad', expectedRevision: 1 }, { placements: [{ ...valid[0], x: 7 }] })).code).toBe('PLACEMENT_OUT_OF_BOUNDS');
    expect(port.state().home.placements).toEqual(old);
    port.failNext(true);
    expect((await api.saveLayout({ slotId: 1, requestId: 'layout-fail', expectedRevision: 1 }, { placements: [] })).code).toBe('SAVE_FAILED');
    expect(port.state().home.placements).toEqual(old);
  });
});

describe('M03-D 展位与无购买门槛', () => {
  it('永久收藏即使实物为0也可展示，设置/清空不改变卡数、经验或战力', async () => {
    const seed = { ...initial(), collection: { cardA: { name: 'A' } }, stash: [], xp: 7, power: 11 };
    const port = memoryPort(seed);
    const api = createHomeCommands({ ...port, getCollection: snapshot => [{ card: { cardId: 'cardA' }, registered: !!snapshot.collection.cardA, ownedCount: 0 }] });
    expect((await api.setDisplay({ slotId: 1, requestId: 'show', expectedRevision: 0 }, { displaySlotId: 'display-left', ref: { kind: 'collection', refId: 'cardA' } })).ok).toBe(true);
    expect(port.state().stash).toEqual([]); expect(port.state().xp).toBe(7); expect(port.state().power).toBe(11);
    expect((await api.setDisplay({ slotId: 1, requestId: 'clear', expectedRevision: 1 }, { displaySlotId: 'display-left', ref: null })).ok).toBe(true);
    expect((await api.setDisplay({ slotId: 1, requestId: 'locked', expectedRevision: 2 }, { displaySlotId: 'display-right', ref: { kind: 'collection', refId: 'missing' } })).code).toBe('DISPLAY_NOT_UNLOCKED');
    expect(api.getHome(1).ok).toBe(true); // 没买家具也能读取和进入基地功能。
  });

  it('查询快照深冻结且预览纯校验不落盘', () => {
    const port = memoryPort(initial());
    const before = port.state();
    const view = getHome(before, FURNITURE_CATALOG);
    expect(Object.isFrozen(view)).toBe(true); expect(Object.isFrozen(view.catalog[0])).toBe(true);
    validateLayout({ placements: [], roomSpec: ROOM_SPEC, ownedFurniture: {} });
    expect(port.state()).toEqual(before);
  });

  it('切换档位后家具、币和布局互不串档', async () => {
    const slots = new Map([[1, memoryPort(initial(10))], [2, memoryPort(initial(20))]]);
    const api = createHomeCommands({
      readBase: slotId => slots.get(slotId).readBase(slotId),
      readBaseReceipt: (context, identity) => slots.get(context.slotId).readBaseReceipt(context, identity),
      commitBase: (context, change) => slots.get(context.slotId).commitBase(context, change),
    });
    expect((await api.buyFurniture({ slotId: 1, requestId: 'slot1-buy', expectedRevision: 0 }, { furnitureId: 'chair' })).ok).toBe(true);
    expect(api.getHome(1).value.coins).toBe(7);
    expect(api.getHome(2).value.coins).toBe(20);
    expect(api.getHome(2).value.owned).toEqual({});
  });
});
