/* 撤离结算契约：真实 altar ESM + slot=null 命令分支，验证内存迁移分支的经济快照。 */
import { beforeEach, expect, it, vi } from 'vitest';

const altarState = vi.hoisted(() => ({ game: {}, random: vi.fn(() => 0) }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { rules: { starterSha: 0, stashUpgradeWood: 1, stashUpgradeSlots: 1 } },
  MODES: {}, game: altarState.game, getActiveSlot: () => null,
  clearSave: vi.fn(), curLayer: () => null, enterLayer: vi.fn(), exitToTitle: vi.fn(), newUid: vi.fn(),
  saveGame: vi.fn(), scaledEnemy: vi.fn(), syncPlayTime: vi.fn(),
}));
vi.mock('../game/src/core/characters.js', () => ({ CHARACTERS: [], characterFor: () => null, characterName: () => '' }));
vi.mock('../game/src/core/shared.js', () => ({ esc: String, escAttr: String }));
vi.mock('../game/src/audio/sound.js', () => ({ tone: vi.fn() }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub: vi.fn() }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { ding: vi.fn() }, _set_cardPageOpen: vi.fn(), cardHTML: c => c.name }));
vi.mock('../game/src/core/random.js', () => ({
  Random: { random: altarState.random, seed: 1, restore: vi.fn() },
  SeededRandomService: class {
    constructor(seed) { this.state = { seed }; }
    restore(state) { this.state = state; }
    random() { return altarState.random(); }
    snapshot() { return this.state; }
  },
}));
vi.mock('../game/src/battle/battle-loader.js', () => ({ ensureBattleReady: vi.fn(), startBattle: vi.fn() }));
vi.mock('../game/src/run/game.run.scenes.js', () => ({
  FIRE_RESTORABLE: [], consumeCurrentCell: vi.fn(), finishInstant: vi.fn(), grantEventCard: vi.fn(),
  nodeOpt: (act, label) => `<button data-act="${act}">${label}</button>`,
  nodeShell: ({ body = '', foot = '' }) => window.SDT.UI.showOverlay('', `${body}${foot}`),
  openPocketRestore: vi.fn(), openShop: vi.fn(), preloadAllNodeShellBgs: vi.fn(), showRunTransition: vi.fn(),
}));
vi.mock('../game/src/run/game.nest.js', () => ({ unlockNest: vi.fn() }));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: {} }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn() }));

let game, UI, base, doExtract;
const makeGame = ({ bossKilled = true } = {}) => ({
  state: 'modal', runActive: true, pendingExtraction: null, layerIdx: 2,
  hp: 20, maxHp: 30, coins: 7, turn: 3, myClass: null, mode: 'normal', bossKilled,
  inventory: [{ name: '木材', count: 2 }, { name: '口粮', count: 3 }],
  usedPocket: [{ card: { id: 'a', name: '口袋卡' }, count: 4 }],
  ownedCards: [{ uid: 'u1', card: { id: 'b', name: '背包卡' } }],
  elapsed: 0,
});

beforeEach(async () => {
  vi.resetModules();
  Object.assign(altarState.game, makeGame());
  game = altarState.game;
  document.body.innerHTML = '<div id="body"></div>';
  UI = {
    acts: {}, log: vi.fn(), hideOverlay: vi.fn(), refresh: vi.fn(), registerHelp: vi.fn(), helpBtn: () => '',
    showOverlay: (_title, html) => { document.body.innerHTML = html; }, act(name, fn) { this.acts[name] = fn; },
  };
  base = {
    data: { wood: 0, rations: 0, pocket: [], stash: [], nestUnlocked: false,
      coins: 0, collection: {}, stats: { extracts: 0, bestRunCoins: 0, stashTotal: 0 } },
    deposit: vi.fn(), depositCards: vi.fn(), isSha: () => false, stashRoom: () => 5,
    stashUsed: () => 0, stashCap: () => 5,
  };
  window.SDT = {
    UI, Base: base, Sound: { sfx: vi.fn(), music: vi.fn() },
    Cards: { cardHTML: c => c.name, sellPrice: () => 1 }, Meta: { track: vi.fn(), addXpToProgress: x => ({ after: x }) },
  };
  altarState.random.mockReset().mockReturnValue(0);
  ({ doExtract } = await import('../game/src/run/game.run.altar.js'));
});

it('真实撤离命令创建整理快照，资源自动入库并打开整理页', async () => {
  expect(await doExtract()).toBe(true);
  expect(game.runActive).toBe(true);
  expect(game.pendingExtraction).toMatchObject({ phase: 'organizing', resources: { wood: 2, rations: 3 } });
  expect(base.data.wood).toBe(2);
  expect(base.data.rations).toBe(3);
  expect(base.data.stats.extracts).toBe(1);
  expect(base.data.nestUnlocked).toBe(true);
  expect(document.querySelector('#exMain')).not.toBeNull();
  expect(base.deposit).not.toHaveBeenCalled();
  expect(base.depositCards).not.toHaveBeenCalled();
});

it('消耗口袋 1/3 保留：恒保留侧四张全带回且日志/快照一致', async () => {
  altarState.random.mockReturnValue(0);
  expect(await doExtract()).toBe(true);
  expect(game.pendingExtraction.keptPocket).toEqual([{ card: { id: 'a', name: '口袋卡' }, count: 4 }]);
  expect(game.pendingExtraction.totalPocketCount).toBe(4);
  expect(game.pendingExtraction.lostPocketCount).toBe(0);
  expect(UI.log).toHaveBeenCalledWith(expect.stringContaining('张只有 1/3 保留（带回 4 张，散失 0 张）'), 'sys');
  expect(base.data.pocket).toEqual([{ card: { id: 'a', name: '口袋卡' }, count: 4 }]);
});

it('消耗口袋 1/3 保留：恒散失侧全部散失且不进入基地口袋', async () => {
  altarState.random.mockReturnValue(0.99);
  expect(await doExtract()).toBe(true);
  expect(game.pendingExtraction.keptPocket).toEqual([]);
  expect(game.pendingExtraction.lostPocketCount).toBe(4);
  expect(UI.log).toHaveBeenCalledWith(expect.stringContaining('带回 0 张，散失 4 张'), 'sys');
  expect(base.data.pocket).toEqual([]);
});

it('击败首脑后解锁龙巢，未击败则不解锁', async () => {
  expect(await doExtract()).toBe(true);
  expect(base.data.nestUnlocked).toBe(true);
  Object.assign(game, makeGame({ bossKilled: false }));
  base.data.nestUnlocked = false;
  expect(await doExtract()).toBe(true);
  expect(base.data.nestUnlocked).toBe(false);
});
