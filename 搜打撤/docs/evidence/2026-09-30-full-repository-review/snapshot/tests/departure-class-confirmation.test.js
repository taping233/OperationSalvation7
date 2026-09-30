import { describe, expect, it, vi } from 'vitest';

describe('选角确认的出征整备守卫', () => {
  it('beforeConfirm 返回 false 时不修改角色、不抽职业卡，也不关闭选角页', async () => {
    vi.resetModules();
    const handlers = {};
    const game = { state: 'idle', characterId: null, myClass: null, classCard: null, ownedCards: [] };
    const hideOverlay = vi.fn();
    const randomClassCard = vi.fn(() => ({ id: 'class-card', name: '职业卡' }));
    const beforeConfirm = vi.fn(() => false);

    vi.doMock('../game/src/run/game.session.js', () => ({
      MAP: { rules: { fireHeal: 5 } }, MODES: { standard: { xpMul: 1 } },
      curLayer: () => ({}), enterLayer: vi.fn(), exitToTitle: vi.fn(), game,
      getActiveSlot: () => 1, newUid: () => 'uid', saveGame: vi.fn(), scaledEnemy: value => value,
    }));
    vi.doMock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({}) }));
    vi.doMock('../game/src/hub/game.hub.js', () => ({ openBaseHub: vi.fn() }));
    vi.doMock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick: vi.fn() }, _set_cardPageOpen: vi.fn() }));
    vi.doMock('../game/src/core/random.js', () => ({
      Random: { random: vi.fn(() => 0) },
      SeededRandomService: class { random() { return 0; } snapshot() { return { seed: 'test' }; } restore() {} },
    }));
    vi.doMock('../game/src/battle/battle-loader.js', () => ({
      captureBattleContext: vi.fn(), ensureBattleReady: vi.fn(async () => {}), startBattle: vi.fn(),
    }));
    vi.doMock('../game/src/run/game.run.scenes.js', () => ({
      FIRE_RESTORABLE: [], consumeCurrentCell: vi.fn(), finishInstant: vi.fn(), grantEventCard: vi.fn(),
      nodeOpt: vi.fn(), nodeShell: vi.fn(), openPocketRestore: vi.fn(), openShop: vi.fn(),
      preloadAllNodeShellBgs: vi.fn(), showRunTransition: vi.fn(),
    }));
    vi.doMock('../game/src/hub/game.storage.js', () => ({ RunStorage: {} }));
    vi.doMock('../game/src/hub/recovery.commands.js', () => ({
      commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn(),
    }));

    const ui = {
      act(name, handler) { handlers[name] = handler; },
      showOverlay: vi.fn(), hideOverlay,
      log: vi.fn(), refresh: vi.fn(),
    };
    window.SDT = {
      UI: ui,
      Base: {},
      Meta: {
        addXpToProgress: vi.fn(), classLv: () => 1, classXP: () => 0,
        LEVEL_MAX: 10, xpForNext: () => 100, perkText: () => '',
      },
      Cards: { classPool: () => [{ id: 'class-card' }], randomClassCard },
      Art: {
        warmClassRoster: vi.fn(), classFullArt: () => '', classArt: () => '',
        listSkins: () => [], getSkin: () => 'default',
      },
    };
    vi.stubGlobal('requestIdleCallback', vi.fn());
    const { openClassChoice } = await import('../game/src/run/game.run.altar.js');

    openClassChoice({ beforeConfirm, onCancel: vi.fn() });
    handlers.pickClass();

    expect(beforeConfirm).toHaveBeenCalledTimes(1);
    expect(randomClassCard).not.toHaveBeenCalled();
    expect(hideOverlay).not.toHaveBeenCalled();
    expect(game).toEqual({ state: 'modal', characterId: null, myClass: null, classCard: null, ownedCards: [] });
  });
});
