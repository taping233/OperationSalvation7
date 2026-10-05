import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rules: {}, base: null }));
vi.mock('../game/src/run/game.session.js', () => ({ MAP: { get rules() { return state.rules; } }, game: {} }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: {}, _set_cardPageOpen: vi.fn() }));
vi.mock('../game/src/hub/base.commands.js', () => ({ readBase: vi.fn() }));
vi.mock('../game/src/hub/collection.commands.js', () => ({ convertCollection: vi.fn(), getCharacter: vi.fn(), stackKeyOf: vi.fn() }));
vi.mock('../game/src/home/home.presenter.js', () => ({ homeErrorMessage: vi.fn() }));
vi.mock('../game/src/home/story.last-lamp.js', () => ({ validateLastLampState: vi.fn() }));
vi.mock('../game/src/hub/game.hub.bridge.js', () => ({ slots: {}, homeRequestId: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  state.rules = { bagMax: 30, bagUpgradeWood: 2, stashMax: 100, stashUpgradeWood: 2, stashUpgradeSlots: 3, stashRuneSlotFrom: 48, stashRuneSlotCost: 3 };
  state.base = {
    data: { wood: 0, rations: 0, runes: [] }, bagN: 16, stashN: 25, level: 1,
    PETS: [{ id: 'dog', name: '狗', icon: 'paw', desc: '携带效果：保护卡牌' }], PET_LEVEL_MAX: 5, PET_UP_COSTS: [2, 3, 4, 5],
    ownedPets: () => ['dog'], carriedPet: () => ({ id: 'dog' }),
    bagCap() { return this.bagN; }, stashCap() { return this.stashN; }, safeCap: () => 2,
    petLevel() { return this.level; }, petUpCost: () => 2,
    canUpgradeBag() { return this.bagN < 30 && this.data.wood >= 2; },
    canUpgradeStash() { return this.stashN < 100 && this.data.wood >= 2 && (this.stashN < 48 || this.data.runes.length >= 3); },
  };
  window.SDT = { Base: state.base, UI: {} };
});

async function render() {
  const { hubUpgradeHTML } = await import('../game/src/hub/game.hub.pages.js');
  const root = document.createElement('div');
  root.innerHTML = hubUpgradeHTML();
  return root;
}

it('零资源明确说明三个禁用原因，渲染不扣资源', async () => {
  const before = JSON.stringify(state.base.data);
  const root = await render();
  expect(root.textContent.match(/木材不足，还需 2/g)).toHaveLength(2);
  expect(root.textContent).toContain('口粮不足，还需 2');
  for (const act of ['upBag', 'upStash', 'upPet']) expect(root.querySelector(`[data-act=${act}]`).disabled).toBe(true);
  expect(JSON.stringify(state.base.data)).toBe(before);
});

it('阈值前不列符文，阈值按实际配置列成本、数量和不足', async () => {
  state.base.data.wood = 8;
  state.base.stashN = 47;
  expect((await render()).querySelector('[data-act=upStash]').textContent).not.toContain('符文');
  state.base.stashN = 48;
  state.base.data.runes = ['a', 'b'];
  const before = JSON.stringify(state.base.data);
  const root = await render();
  expect(root.querySelector('[data-act=upStash]').textContent).toContain('符文 ×3');
  expect(root.textContent).toContain('本次需符文 3 个 · 当前 2 个');
  expect(root.textContent).toContain('符文不足，还需 1');
  expect(root.querySelector('[data-act=upStash]').disabled).toBe(true);
  expect(JSON.stringify(state.base.data)).toBe(before);
});

it('阈值资源够则保留可用动作，单纯渲染不消耗符文或木材', async () => {
  state.base.stashN = 48;
  state.base.data.wood = 8;
  state.base.data.runes = ['a', 'b', 'c'];
  const before = JSON.stringify(state.base.data);
  const root = await render();
  expect(root.querySelector('[data-act=upStash]').disabled).toBe(false);
  expect(root.textContent).not.toContain('符文不足');
  expect(JSON.stringify(state.base.data)).toBe(before);
});

it('满级原因优先于资源不足', async () => {
  state.base.bagN = 30; state.base.stashN = 100; state.base.level = 5;
  const root = await render();
  expect(root.textContent.match(/已达上限/g)).toHaveLength(2);
  expect(root.querySelector('[data-act=upPet]').title).toBe('已满级');
  expect(root.textContent).not.toContain('不足');
});
