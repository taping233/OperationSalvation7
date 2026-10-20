import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
window.SDT = { Cards: { all: () => [] } };
const { RULES } = await import('../game/src/core/rules.js');
window.SDT.MAP = { rules: RULES };
await import('../game/src/hub/base.js');
const { createHubPreparationAdapter } = await import('../game/src/hub/game.hub.preparation-ports.js');
const Base = window.SDT.Base;
let actions, UI, navigation, feature;
const card = { id: 'adapter-card', name: '整备卡', rarity: '稀有', type: '法术', variantKey: 'foil' };
beforeEach(async () => {
  localStorage.clear(); Base.use(1); Base.data.stash = [{ card, count: 2 }];
  Base.data.goals = { tracked: [], presets: { 'preset-1': { id: 'preset-1', name: '方案', picks: [{ card: { cardId: card.id, variantKey: 'foil' }, count: 1 }] } } };
  expect((await Base.save())).toBe(true); actions = {}; document.body.replaceChildren();
  UI = { showOverlay: (_title, html) => { document.body.innerHTML = html; }, act: (name, callback) => { actions[name] = callback; }, log: vi.fn() };
  navigation = { returnToBase: vi.fn(), applyPicks: vi.fn(), openDeparture: vi.fn() };
  feature = createHubPreparationAdapter({ SDT: { Base, Cards: { all: () => [card] } }, UI, ...navigation });
});
afterEach(() => { feature?.dispose(); document.body.replaceChildren(); });
describe('整备adapter真实Base读取与DOM视图', () => {
  it('普通打开/返回保留同一feature实例且不会重复导航', () => {
    expect(feature.open()).toBe(true); const root = document.getElementById('preparationRoot');
    expect(root.querySelector('.preparation-module')).not.toBeNull(); expect(feature.open()).toBe(true); expect(document.getElementById('preparationRoot')).toBe(root);
    actions.preparationBack(); actions.preparationBack(); expect(navigation.returnToBase).toHaveBeenCalledOnce(); expect(navigation.applyPicks).not.toHaveBeenCalled();
  });
  it('真实预设应用经DOM到稳定身份导航，当前阶段不扣库存', async () => {
    expect(feature.open()).toBe(true); const before = structuredClone(Base.data.stash);
    const button = document.querySelector('[data-preset="preset-1"] [data-action="preset-apply"]'); expect(button.disabled).toBe(false); button.click();
    await vi.waitFor(() => expect(navigation.applyPicks).toHaveBeenCalledExactlyOnceWith(
      { 'card:adapter-card:foil': 1 }, {}, expect.any(Function)));
    expect(navigation.openDeparture).toHaveBeenCalledOnce(); expect(Base.data.stash).toEqual(before);
  });
  it('人物宠物应用失败留在预设页显示错误，重试成功后才导航', async () => {
    Base.data.pets.robot = { lv: 1 };
    Object.assign(Base.data.goals.presets['preset-1'], { characterId: 'baita', petId: 'robot' });
    expect((await Base.save())).toBe(true);
    navigation.applyPicks.mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(feature.open()).toBe(true);
    const before = structuredClone(Base.data.stash);
    const button = () => document.querySelector('[data-preset="preset-1"] [data-action="preset-apply"]');
    button().click();
    await vi.waitFor(() => expect(document.querySelector('.prep-error')?.textContent).toContain('人物或宠物设置未能应用'));
    expect(navigation.applyPicks).toHaveBeenCalledExactlyOnceWith(
      { 'card:adapter-card:foil': 1 }, { characterId: 'baita', petId: 'robot' }, expect.any(Function));
    expect(navigation.openDeparture).not.toHaveBeenCalled();
    expect(Base.data.stash).toEqual(before);
    expect(button().disabled).toBe(false);
    button().click();
    await vi.waitFor(() => expect(navigation.openDeparture).toHaveBeenCalledOnce());
    expect(navigation.applyPicks).toHaveBeenCalledTimes(2);
    expect(Base.data.stash).toEqual(before);
  });
  it('换slot后旧返回不能导航或读取新档', () => {
    expect(feature.open()).toBe(true); const oldBack = actions.preparationBack; Base.use(2); oldBack();
    expect(navigation.returnToBase).not.toHaveBeenCalled(); expect(navigation.applyPicks).not.toHaveBeenCalled(); expect(Base.slot).toBe(2);
  });
});
