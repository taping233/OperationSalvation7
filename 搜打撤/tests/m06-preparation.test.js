import { describe, expect, it, vi } from 'vitest';
import { createPreparationCommands, getPreparation, previewDeployment } from '../game/src/hub/preparation.commands.js';

const cards = [
  { id: 'common-a', name: '远行短刃', rarity: '古朴', type: '武术' },
  { id: 'common-b', name: '寒夜补给', rarity: '稀有', type: '道具' },
  { id: 'class-a', name: '专属誓约', rarity: '职业', type: '武术', cls: '侠客' },
];
const initial = () => ({ goals: { tracked: [], presets: {} }, stash: [{ card: cards[0], count: 2 }, { card: cards[1], count: 1 }, { card: cards[2], count: 3 }], characters: { wu: { lv: 1 } }, pets: { dog: { lv: 1 } } });

function memoryPort(seed = initial()) {
  let state = structuredClone(seed), revision = 0; const done = new Map();
  return {
    readBase: () => ({ ok: true, value: structuredClone(state), revision }),
    readBaseReceipt: async (ctx, { command, payload }) => {
      const old = done.get(`${command}:${ctx.requestId}`); if (!old) return { ok: true, value: null, revision };
      return old.signature === JSON.stringify(payload) ? structuredClone(old.result) : { ok: false, code: 'REQUEST_ID_CONFLICT', retryable: false };
    },
    commitBase: async (ctx, change) => {
      if (ctx.expectedRevision !== revision) return { ok: false, code: 'STALE_REVISION', retryable: false };
      state = structuredClone(change.afterState); revision++;
      const result = { ok: true, value: { output: structuredClone(change.output) }, revision };
      done.set(`${change.command}:${ctx.requestId}`, { signature: JSON.stringify(change.payload), result }); return structuredClone(result);
    },
    state: () => structuredClone(state), revision: () => revision,
  };
}

describe('M06-A goals and presets', () => {
  it('deduplicates three goals, rejects a fourth without mutation, and keeps two editable presets', async () => {
    const port = memoryPort(); const api = createPreparationCommands(port);
    const saved = await api.setTrackedGoals({ slotId: 1, requestId: 'g1', expectedRevision: 0 }, { targetIds: ['a', 'a', 'b', 'c'] });
    expect(saved.ok).toBe(true); expect(port.state().goals.tracked).toEqual(['a', 'b', 'c']);
    const before = port.state();
    expect((await api.setTrackedGoals({ slotId: 1, requestId: 'g2', expectedRevision: 1 }, { targetIds: ['a', 'b', 'c', 'd'] })).code).toBe('GOAL_LIMIT');
    expect(port.state()).toEqual(before);
    expect((await api.savePreset({ slotId: 1, requestId: 'p1', expectedRevision: 1 }, { presetId: 'preset-1', name: '搜集', characterId: 'wu', petId: 'dog', picks: [{ card: { cardId: 'common-a' }, count: 2 }] })).ok).toBe(true);
    expect((await api.savePreset({ slotId: 1, requestId: 'p2', expectedRevision: 2 }, { presetId: 'preset-2', name: '撤离', picks: [] })).ok).toBe(true);
    expect((await api.savePreset({ slotId: 1, requestId: 'p3', expectedRevision: 3 }, { presetId: 'preset-3', name: '非法', picks: [] })).code).toBe('INVALID_ARGUMENT');
    expect(getPreparation(port.state()).presets.map(p => p.name)).toEqual(['搜集', '撤离']);
  });
});

describe('M06-B/C deployment preview', () => {
  it('reports enough, short, absent and class-forbidden without mutating state or RNG', () => {
    const base = initial(); const before = JSON.stringify(base); const spy = vi.spyOn(Math, 'random');
    const preset = { id: 'preset-1', characterId: 'wu', petId: 'dog', picks: [{ card: { cardId: 'common-a' }, count: 2 }, { card: { cardId: 'common-b' }, count: 2 }, { card: { cardId: 'missing' }, count: 1 }, { card: { cardId: 'class-a' }, count: 1 }] };
    let preview;
    for (let i = 0; i < 10; i++) preview = previewDeployment({ baseSnapshot: base, preset, cardCatalog: cards, characters: [{ id: 'wu' }], pets: [{ id: 'dog' }], bagCapacity: 8 });
    expect(preview.resolvedPicks.map(x => x.status)).toEqual(['ready', 'missing', 'missing', 'forbidden']);
    expect(preview.missing.map(x => x.missingCount)).toEqual([1, 1]);
    expect(preview.forbidden[0].code).toBe('CLASS_CARD_FORBIDDEN');
    expect(JSON.stringify(base)).toBe(before); expect(spy).not.toHaveBeenCalled(); spy.mockRestore();
  });

  it('counts each equipment card as one slot and blocks an over-capacity preset', () => {
    const equipment = { id: 'equipment-a', name: '远行护甲', type: '装备', rarity: '稀有' };
    const preview = previewDeployment({
      baseSnapshot: { stash: [{ card: equipment, count: 3 }] },
      preset: { picks: [{ card: { cardId: equipment.id }, count: 3 }] },
      cardCatalog: [equipment],
      bagCapacity: 4,
    });
    expect(preview.costs).toMatchObject({ stashCards: 3, slotsUsed: 5, extraStackSlots: 3 });
    expect(preview.canStart).toBe(false);
    expect(preview.errors).toContain('BAG_CAPACITY_EXCEEDED');
  });

  it('uses the supplied starter count and merges same-name variant picks before counting slots', () => {
    const variants = ['a', 'b'].map(variant => ({ ...cards[0], id: `variant-${variant}` }));
    const baseSnapshot = { stash: variants.map(card => ({ card, count: 2 })) };
    const preset = { picks: variants.map(card => ({ card: { cardId: card.id }, count: 2 })) };
    const preview = previewDeployment({ baseSnapshot, preset, cardCatalog: variants, starterCount: 3, bagCapacity: 3 });
    expect(preview.costs).toMatchObject({ stashCards: 4, slotsUsed: 3, extraStackSlots: 1 });
    expect(preview.canStart).toBe(true);
  });

  it('uses the preset pet before the carried pet, including extra starter cards and fireball merging', () => {
    const starter = { id: 'starter-attack', name: '初始攻击', type: '武术' };
    const fireball = { id: 'tt3-fireball', name: '火球', type: '法术' };
    const pets = [{ id: 'robot', effect: { extraSha: 2 } }, { id: 'fire', effect: { shaToFireball: true } }];
    const baseSnapshot = { stash: [{ card: fireball, count: 1 }], petSel: 'robot', pets: { robot: { lv: 1 }, fire: { lv: 1 } } };
    const before = structuredClone(baseSnapshot);
    const options = { baseSnapshot, cardCatalog: [starter, fireball], pets, bagCapacity: 3 };
    const carried = previewDeployment({ ...options, preset: { picks: [] } });
    expect(carried.costs.slotsUsed).toBe(3);
    expect(carried.canStart).toBe(true);
    const selected = previewDeployment({ ...options, preset: { petId: 'fire', picks: [{ card: { cardId: fireball.id }, count: 1 }] } });
    expect(selected.costs).toMatchObject({ stashCards: 1, slotsUsed: 2, extraStackSlots: 1 });
    expect(selected.canStart).toBe(true);
    expect(baseSnapshot).toEqual(before);
  });

  it('rechecks current inventory and delegates run creation only to injected M11', async () => {
    const port = memoryPort(); const preset = { presetId: 'preset-1', name: '可用', characterId: 'wu', petId: 'dog', picks: [{ card: { cardId: 'common-a' }, count: 2 }] };
    const api0 = createPreparationCommands(port);
    await api0.savePreset({ slotId: 1, requestId: 'save', expectedRevision: 0 }, preset);
    expect((await api0.startDeployment({ slotId: 1, requestId: 'start', expectedRevision: 1 }, { presetId: 'preset-1', mode: 'standard', expectedRunRevision: 0 })).code).toBe('DEPENDENCY_UNAVAILABLE');
    const m11 = vi.fn(async () => ({ ok: true, value: { runId: 'run-1' }, revision: 1 }));
    const api = createPreparationCommands({ ...port, startDeployment: m11, cardCatalog: cards, characters: [{ id: 'wu' }], pets: [{ id: 'dog' }], bagCapacity: 8 });
    const result = await api.startDeployment({ slotId: 1, requestId: 'start', expectedRevision: 1 }, { presetId: 'preset-1', mode: 'standard', expectedRunRevision: 0 });
    expect(result.value.runId).toBe('run-1'); expect(m11).toHaveBeenCalledOnce();
    const changed = port.state(); changed.stash[0].count = 1;
    const changedPort = memoryPort(changed);
    const blocked = await createPreparationCommands({ ...changedPort, startDeployment: m11, cardCatalog: cards, characters: [{ id: 'wu' }], pets: [{ id: 'dog' }] }).startDeployment({ slotId: 1, requestId: 'late', expectedRevision: 0 }, { presetId: 'preset-1', mode: 'standard', expectedRunRevision: 0 });
    expect(blocked.code).toBe('INVALID_STATE'); expect(m11).toHaveBeenCalledOnce();
  });
});

