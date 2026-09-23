import { describe, expect, it, vi } from 'vitest';
import { getSources } from '../game/src/hub/preparation.sources.js';
import { buildPreparationViewModel, mountPreparationView } from '../game/src/hub/preparation.view.js';

describe('M06-D source evidence', () => {
  it('uses actual pool evidence and marks unsupported sources unknown', () => {
    const catalog = [
      { id: 'random', rarity: '古朴', type: '武术' },
      { id: 'class', rarity: '职业', type: '武术', cls: '侠客' },
      { id: 'hero', rarity: '棱彩', type: '能力卡', cls: '牧师', unrandom: true },
      { id: 'event', rarity: '衍生', type: '事件', unrandom: true },
    ];
    expect(getSources('random', 33, catalog)[0]).toMatchObject({ sourceId: 'random-obtainable-pool', certainty: 'known' });
    expect(getSources('class', 33, catalog)[0]).toMatchObject({ sourceId: 'matching-class-pool', classId: '侠客' });
    expect(getSources('hero', 33, catalog)[0]).toMatchObject({ sourceId: 'matching-ability-pool', classId: '牧师' });
    expect(getSources('event', 33, catalog)[0]).toMatchObject({ sourceId: 'unconfirmed-source', certainty: 'unknown' });
    expect(getSources('absent', 33, catalog)[0].conditions).toContain('没有足够证据');
  });
});

describe('M06 mountable view', () => {
  it('builds the shared model from snapshots without consuming inventory', () => {
    const base = { stash: [{ card: { id: 'random', name: '远行短刃', rarity: '古朴', type: '武术' }, count: 1 }], characters: { wu: { lv: 1 } }, pets: { dog: { lv: 1 } } };
    const before = JSON.stringify(base);
    const model = buildPreparationViewModel({ baseSnapshot: base, preparation: { tracked: ['random'], presets: [{ id: 'preset-1', name: '猛攻', characterId: 'wu', petId: 'dog', picks: [{ card: { cardId: 'random' }, count: 1 }] }] }, cardCatalog: [base.stash[0].card], characters: [{ id: 'wu', name: '无' }], pets: [{ id: 'dog', name: '汪汪狗' }], bagCapacity: 6 });
    expect(model.goals[0].source.certainty).toBe('known'); expect(model.presets[0].preview.canStart).toBe(true); expect(JSON.stringify(base)).toBe(before);
  });

  it('emits intents, updates and disposes without leaked listeners', () => {
    const root = document.createElement('div'); const onIntent = vi.fn();
    const model = { goals: [{ id: 'random', name: '远行短刃', sourceLabel: '通用随机卡池' }], targetOptions: [], characterOptions: [], petOptions: [], cardOptions: [], presets: [{ id: 'preset-1', name: '猛攻', characterId: null, petId: null, picks: [], preview: null }, { id: 'preset-2', name: '跑刀', characterId: null, petId: null, picks: [], preview: null }] };
    const view = mountPreparationView(root, { model, onIntent });
    expect(root.querySelector('[data-action="preset-start"]')).toBeNull();
    expect(root.textContent).toContain('在整备页确认宠物并出发');
    root.querySelector('[data-action="goal-remove"]').click();
    expect(onIntent).toHaveBeenCalledWith({ type: 'goal-remove', payload: { targetId: 'random' } });
    view.update({ ...model, busy: true, error: '状态已变化', goals: [] });
    expect(root.getAttribute('aria-busy')).toBe('true'); expect(root.textContent).toContain('状态已变化');
    view.dispose(); expect(root.childElementCount).toBe(0);
    root.click(); expect(onIntent).toHaveBeenCalledTimes(1);
  });
});
