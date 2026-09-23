import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  readBase: vi.fn(),
  buyFurniture: vi.fn(),
  mountHome: vi.fn(),
  mounts: [],
  actions: {},
  view: { revision: 1, home: { placements: [] } },
}));

vi.mock('../game/src/core/characters.js', () => ({ CHARACTERS: [], characterFor: (id) => ({ rulesetId: id }), characterName: (id) => id }));
vi.mock('../game/src/core/shared.js', () => ({ esc: String, escAttr: String }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { rules: {} }, MODES: {}, game: { state: '' }, getActiveSlot: () => 1,
  newRun: vi.fn(), requestClassChoice: vi.fn(), setLobby: vi.fn(), showTitle: vi.fn(),
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: {}, configureCardNavigation: vi.fn(), _set_cardPageOpen: vi.fn() }));
vi.mock('../game/src/core/random.js', () => ({ Random: {} }));
vi.mock('../game/src/hub/base.commands.js', () => ({ readBase: (...args) => state.readBase(...args), readBaseReceipt: vi.fn(), commitBase: vi.fn() }));
vi.mock('../game/src/hub/collection.commands.js', () => ({ convertCollection: vi.fn(), getCharacter: vi.fn(), getCollection: vi.fn(), selectSkin: vi.fn(), stackKeyOf: vi.fn() }));
vi.mock('../game/src/home/home.commands.js', () => ({ createHomeCommands: () => ({ buyFurniture: (...args) => state.buyFurniture(...args), saveLayout: vi.fn(), setDisplay: vi.fn() }) }));
vi.mock('../game/src/home/home.presenter.js', () => ({ presentHome: (value) => value, homeErrorMessage: (value) => value?.message || 'error' }));
vi.mock('../game/src/home/home.visuals.js', () => ({ getM04VisualPack: () => ({}) }));
vi.mock('../game/src/home/story.last-lamp.js', () => ({ validateLastLampState: vi.fn() }));
vi.mock('../game/src/hub/preparation.commands.js', () => ({ createPreparationCommands: () => ({}), getPreparation: vi.fn(), previewDeployment: vi.fn() }));
vi.mock('../game/src/hub/preparation.view.js', () => ({ buildPreparationViewModel: vi.fn(), mountPreparationView: vi.fn() }));
vi.mock('../game/src/hub/game.hub.bridge.js', () => ({ slots: {}, homeRequestId: (type) => type }));
vi.mock('../game/src/hub/game.hub.depart.js', () => ({ hubDeployHTML: () => '<div>deploy</div>', openDepartPrep: vi.fn(), deployPick: {}, setDeployPick: vi.fn() }));
vi.mock('../game/src/hub/game.hub.pages.js', () => ({
  hubShopHTML: () => '', hubStashHTML: () => '', openStashItem: vi.fn(), openRawItem: vi.fn(),
  hubUpgradeHTML: () => '', hubClassesHTML: () => '', hubAchHTML: () => '', HUB_SHOP_GOODS: [], hubShopGoodsCard: vi.fn(),
}));
vi.mock('../game/src/home/home.scene.js', () => ({ mountHome: (...args) => state.mountHome(...args) }));

function makeController() {
  return { update: vi.fn(), dispose: vi.fn() };
}

async function loadHub() {
  if (!window.SDT?.__homeLifecycleTest) window.SDT = {
    __homeLifecycleTest: true,
    UI: {
      actions: state.actions,
      showOverlay(_title, html) { document.body.innerHTML = html; },
      hideOverlay() { document.body.innerHTML = ''; },
      log: vi.fn(), helpBtn: () => '', registerHelp: vi.fn(), act(name, handler) { state.actions[name] = handler; },
    },
    Base: { slot: 1, data: { appearance: {}, wood: 0, rations: 0, coins: 0 }, keyCount: () => 0 },
    Cards: { all: () => [] }, Sound: { music: vi.fn() },
    Art: { hydrateSelectedSkins: vi.fn(), classArt: vi.fn() }, Meta: { checkUnlocks: vi.fn(), pendingAch: () => [], pendingColl: () => [] },
    Icons: { img: () => '' },
  };
  state.hub ||= await import('../game/src/hub/game.hub.js');
  return state.hub;
}

describe('基地 Home 异步生命周期', () => {
  beforeEach(async () => {
    await vi.dynamicImportSettled();
    state.hub?.closeBase();
    await vi.dynamicImportSettled();
    document.body.innerHTML = '';
    state.readBase.mockReset().mockReturnValue({ ok: true, value: state.view, revision: 1 });
    state.buyFurniture.mockReset();
    state.mounts.length = 0;
    for (const key of Object.keys(state.actions)) delete state.actions[key];
    state.mountHome.mockReset().mockImplementation((config) => {
      const controller = makeController();
      state.mounts.push({ config, controller });
      return controller;
    });
  });

  it('进入基地直接显示普通出发页，不加载 2.5D 场景', async () => {
    const hub = await loadHub();
    hub.openBaseHub('deploy');
    await vi.dynamicImportSettled();

    expect(document.getElementById('hubMain')).not.toBeNull();
    expect(document.querySelector('[data-tab="home"]')).toBeNull();
    expect(document.getElementById('homeSceneHost')).toBeNull();
    expect(state.mounts).toHaveLength(0);
  });

  it('退出并重复打开时只挂载最新的 Home 宿主', async () => {
    const hub = await loadHub();
    hub.renderHomeScene();
    hub.closeBase();
    await vi.dynamicImportSettled();
    expect(state.mounts).toHaveLength(0);

    hub.renderHomeScene();
    const latestHost = document.getElementById('homeSceneHost');
    await vi.dynamicImportSettled();
    await vi.waitFor(() => expect(state.mounts).toHaveLength(1));

    expect(state.mounts).toHaveLength(1);
    expect(state.mounts[0].config.host).toBe(latestHost);
    expect(state.mounts[0].config.host.isConnected).toBe(true);
  });

  it('旧场景的 onIntent 等待结束后不会更新新控制器', async () => {
    let finishPurchase;
    state.buyFurniture.mockReturnValue(new Promise((resolve) => { finishPurchase = resolve; }));
    const hub = await loadHub();
    hub.renderHomeScene();
    await vi.dynamicImportSettled();
    const oldMount = state.mounts[0];
    const oldIntent = oldMount.config.onIntent({ type: 'buyFurniture', expectedRevision: 1 });

    hub.renderHomeScene();
    await vi.dynamicImportSettled();
    const newMount = state.mounts[1];
    expect(await oldMount.config.onIntent({ type: 'buyFurniture', expectedRevision: 1 })).toBeNull();
    expect(state.buyFurniture).toHaveBeenCalledTimes(1);
    finishPurchase({ ok: true });
    await expect(oldIntent).resolves.toEqual({ ok: true });

    expect(oldMount.controller.update).not.toHaveBeenCalled();
    expect(newMount.controller.update).not.toHaveBeenCalled();
  });

  it('Pixi 场景挂载失败后回到普通基地，旧 home 页签不再重开场景', async () => {
    state.mountHome.mockImplementationOnce(() => { throw new Error('pixi init failed'); }).mockImplementation((config) => {
      const controller = makeController();
      state.mounts.push({ config, controller });
      return controller;
    });
    const hub = await loadHub();
    hub.renderHomeScene();
    await vi.dynamicImportSettled();

    expect(document.getElementById('hubMain')).not.toBeNull();
    state.actions.hubTab({ tab: 'home' });
    await vi.dynamicImportSettled();

    expect(state.mounts).toHaveLength(0);
    expect(document.getElementById('hubMain')).not.toBeNull();
    expect(document.getElementById('homeSceneHost')).toBeNull();
  });
});
