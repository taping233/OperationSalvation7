import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RULES } from '../game/src/core/rules.js';
import { installImmediateWebLocks } from './helpers/web-locks.js';
import { createTerminalCommands } from '../game/src/hub/terminal.commands.js';
import { createPreparationCommands, getPreparation, previewDeployment } from '../game/src/hub/preparation.commands.js';

window.SDT ||= {};
window.SDT.MAP = { rules: RULES };
const { Base } = await import('../game/src/hub/base.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');
const { createExtractionCommands } = await import('../game/src/hub/extraction.commands.js');
const card = { id: 'sweep-original', name: '同名库存卡', type: '法术', rarity: '稀有' };
const persisted = () => JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)));

beforeEach(async () => {
  installImmediateWebLocks(); localStorage.clear();
  await RunStorage.remove(1);
  window.SDT.MAP = { rules: RULES };
  window.SDT.UI = { log: vi.fn() };
  window.SDT.Sound = { sfx: vi.fn() };
  Base.use(1);
  Base.data.stash = [{ card, count: 2 }];
  Base.data.coins = 30;
  Base.data.keys = 20;
  expect(await Base.save()).toBe(true);
});
afterEach(async () => { vi.restoreAllMocks(); await Base.flushWrites(); await RunStorage.flushWrites(); localStorage.clear(); });

describe('仓库入库保留稳定卡身份', () => {
  const variants = [
    ['不同ID', { ...card, id: 'sweep-other' }, undefined],
    ['卡牌variant', { ...card, variantKey: 'foil' }, undefined],
    ['库存variant', card, 'foil'],
  ];
  it.each(variants)('直接入库不把%s的新卡转成已有卡', async (_label, incoming, variantKey) => {
    expect(await Base.depositCards([{ card: incoming, count: 1, ...(variantKey ? { variantKey } : {}) }])).toBe(true);
    expect(persisted().stash).toEqual([
      { card, count: 2 }, { card: incoming, count: 1, ...(variantKey ? { variantKey } : {}) },
    ]);
    expect(Base.use(1).stash).toEqual(persisted().stash);
  });
  it('同一ID与variant仍合堆，保存失败不增加库存', async () => {
    expect(await Base.depositCards([{ card: { ...card }, count: 3 }])).toBe(true);
    expect(Base.data.stash).toEqual([{ card, count: 5 }]);
    const raw = localStorage.getItem(Base.SLOT_KEY(1));
    const native = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === Base.SLOT_KEY(1)) throw new Error('quota');
      return native.call(this, key, value);
    });
    expect(await Base.depositCards([{ card: { ...card, id: 'unwritten' }, count: 1 }])).toBe(false);
    expect(Base.data.stash).toEqual([{ card, count: 5 }]);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(raw);
  });
  it('旧无ID卡仍按名称合堆，不吞掉后来有稳定ID的同名卡', async () => {
    const legacy = { name: card.name, type: card.type, rarity: card.rarity };
    Base.data.stash = [{ card: legacy, count: 1 }];
    await Base.save();
    expect(await Base.depositCards([{ card: legacy, count: 1 }, { card, count: 1 }])).toBe(true);
    expect(Base.data.stash).toEqual([{ card: legacy, count: 2 }, { card, count: 1 }]);
  });
  it('消耗区复原保留库存级variant，并与相同variant合堆', async () => {
    Base.data.pocket = [{ card, variantKey: 'foil', count: 2 }];
    await Base.save();
    expect(await Base.restore(0)).toBe(true);
    expect(Base.data.stash).toEqual([{ card, count: 2 }, { card, variantKey: 'foil', count: 2 }]);
    Base.data.pocket = [{ card, variantKey: 'foil', count: 1 }];
    await Base.save();
    expect(await Base.restore(0)).toBe(true);
    expect(Base.data.stash).toEqual([{ card, count: 2 }, { card, variantKey: 'foil', count: 3 }]);
  });
  it.each(['run.death', 'run.abandon'])('%s 抢运保留卡身份，事务重放不重复入库', async command => {
    expect(await RunStorage.write(1, { seed: 'identity-sweep', ownedCards: [], inventory: [] })).toBe(true);
    const recovery = createRecoveryCommands({ storage: localStorage, lockManager: navigator.locks, baseApi: Base, runStore: RunStorage });
    const commands = createTerminalCommands({ getBase: () => Base, getRunStorage: () => RunStorage,
      getRecovery: () => recovery, getActiveSlot: () => 1 });
    const incoming = { ...card, id: 'terminal-other' };
    const created = await commands.createAttempt({ slotId: 1, command, cards: [{ card: incoming, count: 2 }, { card, variantKey: 'foil', count: 1 }] });
    expect(created.ok).toBe(true);
    expect((await commands.commitAttempt(created.attempt)).ok).toBe(true);
    expect(persisted().stash).toEqual([{ card, count: 2 }, { card: incoming, count: 2 }, { card, variantKey: 'foil', count: 1 }]);
    const raw = localStorage.getItem(Base.SLOT_KEY(1));
    expect((await commands.commitAttempt(created.attempt)).replay).toBe(true);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(raw);
  });
  it.each(['id', 'variant'])('成功撤离保留%s不同的新卡及消耗区身份，完成后读档一致', async kind => {
    const incoming = kind === 'id' ? { ...card, id: 'extract-other' } : { ...card, variantKey: 'foil' };
    Base.data.pocket = [{ card, count: 1 }];
    await Base.save();
    const game = { seed: 'extract-sweep', ownedCards: [{ card: incoming }], inventory: [],
      usedPocket: [{ card: incoming, count: 1 }], pendingExtraction: null, runActive: true, elapsed: 0, elapsedSynced: 0 };
    expect(await RunStorage.write(1, game)).toBe(true);
    const recovery = createRecoveryCommands({ storage: localStorage, lockManager: navigator.locks, baseApi: Base, runStore: RunStorage });
    const commands = createExtractionCommands({ game, getActiveSlot: () => 1, baseApi: Base, runStore: RunStorage, recovery, random: () => 0 });
    const started = await commands.begin();
    expect(started.ok).toBe(true);
    expect(persisted().pocket).toEqual([{ card, count: 1 }, { card: incoming, count: 1 }]);
    expect((await commands.updateCards([{ name: incoming.name, count: 1 }], started.value.runId, 1)).ok).toBe(true);
    expect((await commands.finish(started.value.runId, 1)).ok).toBe(true);
    expect(Base.use(1).stash).toEqual([{ card, count: 2 }, { card: incoming, count: 1 }]);
    expect(RunStorage.read(1)).toBeNull();
  });
});

describe('整备预设数量边界', () => {
  it('合并恰好99的预设可保存，并在读取后保留完整数量', async () => {
    const api = createPreparationCommands();
    const result = await api.savePreset({ slotId: 1, requestId: 'ninety-nine', expectedRevision: Base.data._m01.revision },
      { presetId: 'preset-1', name: '边界', picks: [{ card: { cardId: card.id }, count: 60 }, { card: { cardId: card.id }, count: 39 }] });
    expect(result.ok).toBe(true);
    expect(getPreparation(Base.use(1)).presets[0].picks).toEqual([{ card: { cardId: card.id }, count: 99 }]);
  });
  it('同卡合并超过99时拒绝保存，原预设仍保留', async () => {
    const api = createPreparationCommands();
    let revision = Base.data._m01.revision;
    const original = { presetId: 'preset-1', name: '原方案', picks: [{ card: { cardId: card.id }, count: 2 }] };
    expect((await api.savePreset({ slotId: 1, requestId: 'original', expectedRevision: revision }, original)).ok).toBe(true);
    revision = Base.data._m01.revision;
    const raw = localStorage.getItem(Base.SLOT_KEY(1));
    const oversized = { ...original, picks: [{ card: { cardId: card.id }, count: 60 }, { card: { cardId: card.id }, count: 40 }] };
    expect(await api.savePreset({ slotId: 1, requestId: 'oversized', expectedRevision: revision }, oversized)).toMatchObject({ ok: false, code: 'INVALID_ARGUMENT' });
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(raw);
    expect(getPreparation(Base.data).presets[0].picks).toEqual(original.picks);
    expect(previewDeployment({ baseSnapshot: Base.data, preset: oversized }).canStart).toBe(false);
  });
});

describe('基地保存后的音效异常不改变事务结果', () => {
  it.each(['upgradeBag', 'upgradeStash', 'upgradePet'])('%s 已持久化后仍返回成功，不让音效异常伪装成保存失败', async method => {
    Base.data.wood = 20; Base.data.rations = 20;
    await Base.save();
    window.SDT.Sound.sfx.mockImplementation(() => { throw new Error('audio unavailable'); });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(await Base[method](...(method === 'upgradePet' ? ['dog'] : []))).toBe(true);
    expect(writes.mock.calls.filter(([key]) => key === Base.SLOT_KEY(1))).toHaveLength(1);
    expect(Base.data).toEqual(persisted());
    if (method === 'upgradePet') expect(Base.data.pets.dog.lv).toBe(2);
    else expect(Base.data[method === 'upgradeBag' ? 'bagUp' : 'stashUp']).toBe(1);
  });
  it('孵化已提交时播音异常仍返回获得的宠物，蛋和币只消耗一次', async () => {
    Base.data.coins = 100;
    Base.data.stash = [{ card: { id: Base.PET_EGG_ID, name: '宠物蛋' }, count: 2 }];
    await Base.save();
    window.SDT.Sound.sfx.mockImplementation(() => { throw new Error('audio unavailable'); });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const result = await Base.hatchPet();
    expect(result).toMatchObject({ ok: true, pet: { id: expect.any(String) } });
    expect(Base.data.pets[result.pet.id].lv).toBe(1);
    expect(Base.data.stash[0].count).toBe(1);
    expect(Base.data.coins).toBe(50);
    expect(Base.data).toEqual(persisted());
    expect(writes.mock.calls.filter(([key]) => key === Base.SLOT_KEY(1))).toHaveLength(1);
  });
});
