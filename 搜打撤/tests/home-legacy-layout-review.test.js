import { describe, expect, it, vi } from 'vitest';
import { createHomeCommands, getHome, validateLayout } from '../game/src/home/home.commands.js';
const placement = { instanceId: 'chair-legacy-1', furnitureId: 'chair', zoneId: 'room-floor', x: 1, y: 2, rotation: 0 };
describe('Home旧数量库存与布局入参', () => {
  it('只读视图将旧数量变为既有稳定legacy实例，原存档及未知字段不改', () => {
    const state = { coins: 10, extra: 'keep', home: { owned: { chair: 2, 'future-owned': { unknown: 1 } }, placements: [placement], displays: [] } }, before = structuredClone(state);
    const view = getHome(state); expect(view.owned.chair).toEqual(['chair-legacy-1', 'chair-legacy-2']); expect(state).toEqual(before);
    expect(validateLayout({ placements: view.placements, ownedFurniture: view.owned }).valid).toBe(true);
    expect(view.owned.chair.map(id => id)).toHaveLength(2);
  });
  it('当前数组实例不重编号，合法空数组仍可清空布局', async () => {
    const state = { home: { owned: { chair: ['chair-existing-9'] }, placements: [{ ...placement, instanceId: 'chair-existing-9' }] } }, commit = vi.fn(async () => ({ ok: true, value: {}, revision: 2 }));
    expect(getHome(state).owned.chair).toEqual(['chair-existing-9']);
    const result = await createHomeCommands({ readBase: () => ({ ok: true, value: state, revision: 1 }), commitBase: commit }).saveLayout({ slotId: 1, requestId: 'empty', expectedRevision: 1 }, { placements: [] });
    expect(result.ok).toBe(true); expect(commit.mock.lastCall[1].afterState.home.placements).toEqual([]);
  });
  it.each([undefined, null, {}, { x: 1 }])('非数组布局%j明确拒绝且不提交', async placements => {
    const validation = validateLayout({ placements, ownedFurniture: {} }); expect(validation.valid).toBe(false); expect(validation.violations[0].code).toBe('INVALID_ARGUMENT');
    const commit = vi.fn(async () => ({ ok: true })), state = { home: { owned: { chair: 1 }, placements: [placement] } }, before = structuredClone(state);
    const result = await createHomeCommands({ readBase: () => ({ ok: true, value: state, revision: 1 }), commitBase: commit }).saveLayout({ slotId: 1, requestId: 'bad', expectedRevision: 1 }, { placements });
    expect(result.ok).toBe(false); expect(commit).not.toHaveBeenCalled(); expect(state).toEqual(before);
  });
  it('正确legacy布局保存失败，原布局原数量保持', async () => {
    const state = { home: { owned: { chair: 1 }, placements: [placement] } }, before = structuredClone(state);
    const result = await createHomeCommands({ readBase: () => ({ ok: true, value: state, revision: 1 }), commitBase: async () => ({ ok: false, code: 'SAVE_FAILED' }) }).saveLayout({ slotId: 1, requestId: 'failed', expectedRevision: 1 }, { placements: [] });
    expect(result.code).toBe('SAVE_FAILED'); expect(state).toEqual(before);
  });
});
