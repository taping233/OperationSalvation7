import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const altarState = vi.hoisted(() => ({
  game: null,
  clearSave: vi.fn(),
  syncPlayTime: vi.fn(),
  unlockNest: vi.fn(),
  random: vi.fn(() => 0),
}));

vi.mock('../game/src/game.session.js', () => ({
  MAP: { rules: { starterSha: 0, stashUpgradeWood: 1, stashUpgradeSlots: 1 } },
  game: altarState.game,
  clearSave: altarState.clearSave,
  syncPlayTime: altarState.syncPlayTime,
  unlockNest: altarState.unlockNest,
  curLayer: () => null,
  enterLayer: vi.fn(),
  exitToTitle: vi.fn(),
  newUid: vi.fn(),
  saveGame: vi.fn(),
  scaledEnemy: vi.fn(),
}));
vi.mock('../game/src/game.hub.js', () => ({ openBaseHub: vi.fn() }));
vi.mock('../game/src/game.cardslib.js', () => ({
  Sfx: { ding: vi.fn() }, _set_cardPageOpen: vi.fn(), cardHTML: () => '',
}));
vi.mock('../game/src/random.js', () => ({ Random: { random: altarState.random } }));
vi.mock('../game/src/battle-loader.js', () => ({ ensureBattleReady: vi.fn(), startBattle: vi.fn() }));
vi.mock('../game/src/game.run.scenes.js', () => ({
  FIRE_RESTORABLE: [], consumeCurrentCell: vi.fn(), finishInstant: vi.fn(), grantEventCard: vi.fn(),
  nodeOpt: vi.fn(), nodeShell: vi.fn(), openPocketRestore: vi.fn(), openShop: vi.fn(),
  preloadAllNodeShellBgs: vi.fn(), showRunTransition: vi.fn(),
}));
vi.mock('../game/src/game.nest.js', () => ({ unlockNest: altarState.unlockNest }));

import { createGameMenuController } from '../game/src/game.menu.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('终局入口幂等', () => {
  it('放弃确认后的迟到重复动作不会再次搬运安全格卡牌', () => {
    const actions = new Map();
    const card = { id: 'safe-card', name: '安全卡' };
    const game = {
      state: 'idle', runActive: true, ownedCards: [{ card, safe: true, brought: false }],
      coins: 9,
    };
    const depositCards = vi.fn();
    const UI = {
      showOverlay(_title, html) {
        document.body.innerHTML = `<div id="ovBody">${html}</div>`;
      },
      act(name, fn) { actions.set(name, fn); },
      hideOverlay: vi.fn(), refresh: vi.fn(), log: vi.fn(),
    };
    const SDT = {
      Base: { depositCards }, Sound: { sfx: vi.fn(), music: vi.fn() },
      Icons: { img: () => '' },
    };
    const controller = createGameMenuController({
      SDT, UI, game, runtime: { resize: vi.fn(), openBaseHub: vi.fn() },
      SLOT_COUNT: 1, esc: String, getActiveSlot: () => 1, setActiveSlot: vi.fn(),
      syncPlayTime: vi.fn(), clearSave: vi.fn(), saveGame: vi.fn(),
      readSlot: vi.fn(), loadGame: vi.fn(), clearSlot: vi.fn(), clearAllSlots: vi.fn(),
      preflightRunMap: vi.fn(), hasRun: vi.fn(), RunStorage: {},
    });

    controller.openLeaveMenu();
    actions.get('leaveAbandon')(); // 首次点击：进入二次确认
    actions.get('leaveAbandon')(); // 确认：实际结算
    actions.get('leaveAbandon')(); // 同一旧回调迟到重放

    expect(game.runActive).toBe(false);
    expect(depositCards).toHaveBeenCalledOnce();
    expect(depositCards).toHaveBeenCalledWith([{ card, count: 1 }]);
    expect(UI.log).toHaveBeenCalledTimes(1);
  });

  it('撤离成功后重复调用不重复存入物资或消耗口袋', async () => {
    const game = {
      state: 'modal', runActive: true, layerIdx: 2, hp: 20, maxHp: 30,
      coins: 7, turn: 3, myClass: '侠客', bossKilled: true,
      inventory: [{ name: '木材', count: 2 }],
      usedPocket: [{ card: { id: 'p', name: '口袋卡' }, count: 2 }],
      ownedCards: [{ uid: 'u1', card: { id: 'b', name: '背包卡' } }],
    };
    altarState.game = game;
    window.SDT = { UI: {} };
    altarState.clearSave.mockClear(); altarState.syncPlayTime.mockClear();
    altarState.unlockNest.mockClear(); altarState.random.mockClear();
    vi.resetModules();
    // The ESM mock closes over this state; importing the real altar module exercises its public entry.
    const { doExtract } = await import('../game/src/game.run.altar.js');
    const UI = window.SDT.UI;
    const deposit = vi.fn();
    const depositCards = vi.fn();
    const track = vi.fn();
    window.SDT.Sound = { sfx: vi.fn(), music: vi.fn() };
    window.SDT.Base = {
      deposit, depositCards, isSha: () => false, stashRoom: () => 10,
      stashUsed: () => 0, stashCap: () => 10, stashCards: [],
    };
    window.SDT.Meta = { track, checkUnlocks: vi.fn() };
    window.SDT.Cards = { cardHTML: () => '' };
    Object.assign(UI, {
      log: vi.fn(), registerHelp: vi.fn(), helpBtn: () => '', showOverlay: vi.fn(),
      act: vi.fn(), refresh: vi.fn(), hideOverlay: vi.fn(),
    });
    expect(doExtract()).toBe(true);
    expect(doExtract()).toBe(false);

    expect(altarState.clearSave).toHaveBeenCalledOnce();
    expect(altarState.syncPlayTime).toHaveBeenCalledOnce();
    expect(deposit).toHaveBeenCalledOnce();
    expect(depositCards).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledTimes(1);
  });
});
