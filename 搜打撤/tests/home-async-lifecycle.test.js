import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  readBase: vi.fn(),
  actions: {},
  view: { revision: 1, home: { placements: [] } },
}));

vi.mock('../game/src/core/characters.js', () => ({ CHARACTERS: [], characterFor: (id) => ({ rulesetId: id }), characterName: (id) => id }));
vi.mock('../game/src/core/shared.js', () => ({ clone: value => (value == null ? value : JSON.parse(JSON.stringify(value))), esc: String, escAttr: String }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { rules: {} }, MODES: {}, game: { state: '' }, getActiveSlot: () => 1, startNewGame: vi.fn(),
  newRun: vi.fn(), requestClassChoice: vi.fn(), setLobby: vi.fn(), showTitle: vi.fn(),
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: {}, configureCardNavigation: vi.fn(), _set_cardPageOpen: vi.fn() }));
vi.mock('../game/src/core/random.js', () => ({ Random: {} }));
vi.mock('../game/src/hub/base.commands.js', () => ({ readBase: (...args) => state.readBase(...args), readBaseReceipt: vi.fn(), commitBase: vi.fn() }));
vi.mock('../game/src/hub/collection.commands.js', () => ({ convertCollection: vi.fn(), getCharacter: vi.fn(), getCollection: vi.fn(), selectSkin: vi.fn(), stackKeyOf: vi.fn() }));
vi.mock('../game/src/home/home.commands.js', () => { throw new Error('Retired Home commands evaluated'); });
vi.mock('../game/src/home/home.presenter.js', () => { throw new Error('Retired Home presenter evaluated'); });
vi.mock('../game/src/home/home.visuals.js', () => { throw new Error('Retired Home visuals evaluated'); });
vi.mock('../game/src/home/home.catalog.js', () => { throw new Error('Retired furniture catalog evaluated'); });
vi.mock('../game/src/hub/game.hub.home-scene.js', () => { throw new Error('Retired Home controller evaluated'); });
vi.mock('../game/src/home/story.last-lamp.js', () => ({ validateLastLampState: vi.fn() }));
vi.mock('../game/src/hub/preparation.commands.js', () => ({ createPreparationCommands: () => ({}), getPreparation: vi.fn(), previewDeployment: vi.fn() }));
vi.mock('../game/src/hub/preparation.view.js', () => ({ buildPreparationViewModel: vi.fn(), mountPreparationView: vi.fn() }));
vi.mock('../game/src/hub/game.hub.bridge.js', () => ({ slots: {}, homeRequestId: (type) => type }));
vi.mock('../game/src/hub/game.hub.depart.js', () => ({ hubDeployHTML: () => '<div>deploy</div>', openDepartPrep: vi.fn(), deployPick: {}, setDeployPick: vi.fn() }));
vi.mock('../game/src/hub/game.hub.pages.js', () => ({
  hubStashHTML: () => '', openStashCardView: vi.fn(), openRawItem: vi.fn(),
  hubUpgradeHTML: () => '', hubClassesHTML: () => '', hubAchHTML: () => '', HUB_SHOP_GOODS: [],
}));
vi.mock('../game/src/home/home.scene.js', () => { throw new Error('Retired Home scene evaluated'); });

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
  state.hub ||= await import('../game/src/hub/game.hub.runtime.js');
  return state.hub;
}

describe('退役家具入口与普通基地隔离', () => {
  beforeEach(async () => {
    await vi.dynamicImportSettled();
    state.hub?.closeBase();
    await vi.dynamicImportSettled();
    document.body.innerHTML = '';
    state.readBase.mockReset().mockReturnValue({ ok: true, value: state.view, revision: 1 });
    for (const key of Object.keys(state.actions)) delete state.actions[key];
  });

  it('进入基地直接显示普通出发页，不加载 2.5D 场景', async () => {
    const hub = await loadHub();
    hub.openBaseHub('deploy');
    await vi.dynamicImportSettled();

    expect(document.getElementById('hubMain')).not.toBeNull();
    expect(document.querySelector('[data-tab="home"]')).toBeNull();
    expect(document.getElementById('homeSceneHost')).toBeNull();
  });

  it('退役 runtime 出口重复调用不创建页面、不读取命令也不写存档', async () => {
    const hub = await loadHub();
    const before = structuredClone(window.SDT.Base.data);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    try {
      expect(hub.renderHomeScene()).toBe(false);
      expect(hub.renderHomeScene()).toBe(false);
      await vi.dynamicImportSettled();
      expect(document.body.innerHTML).toBe('');
      expect(state.readBase).not.toHaveBeenCalled();
      expect(window.SDT.Base.data).toEqual(before);
      expect(write).not.toHaveBeenCalled();
    } finally { write.mockRestore(); }
  });

  it('普通基地打开后调用退役出口保留原页面、焦点和现行导航', async () => {
    const hub = await loadHub();
    hub.openBaseHub('deploy');
    const root = document.getElementById('hubMain');
    const button = root.querySelector('button');
    button.focus();
    const markup = root.outerHTML;
    expect(hub.renderHomeScene()).toBe(false);
    await vi.dynamicImportSettled();
    expect(document.getElementById('hubMain')).toBe(root);
    expect(root.outerHTML).toBe(markup);
    expect(document.activeElement).toBe(button);
    state.actions.hubTab({ tab: 'home' });
    expect(document.getElementById('hubMain').dataset.page).toBe('deploy');
    expect(document.getElementById('homeSceneHost')).toBeNull();
  });
});
