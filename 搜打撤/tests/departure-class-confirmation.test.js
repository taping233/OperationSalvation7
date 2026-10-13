import { describe, expect, it, vi } from 'vitest';

describe('选角确认的出征整备守卫', () => {
  it.each([[false, true], [true, true], [false, false]])('整备守卫与入城边界（延迟确认：%s，转场完成：%s）', async (deferred, completed) => {
    document.body.replaceChildren();
    vi.resetModules();
    const handlers = {};
    const game = { state: 'idle', characterId: null, myClass: null, classCard: null, ownedCards: [], layerIdx:0, trackPos:3 };
    const hideOverlay = vi.fn();
    const randomClassCard = vi.fn(() => ({ id: 'class-card', name: '职业卡' }));
    const beforeConfirm = vi.fn(() => false);
    const saveGame = vi.fn();
    const nodeShell = vi.fn();
    const transition = Object.assign(Promise.resolve(completed), { isCurrent: () => true });

    vi.doMock('../game/src/run/game.session.js', () => ({
      MAP: { rules: { fireHeal: 5 } }, MODES: { standard: { xpMul: 1 } },
      curLayer: () => ({}), enterLayer: vi.fn(), exitToTitle: vi.fn(), game,
      getActiveSlot: () => 1, newUid: () => 'uid', saveGame, scaledEnemy: value => value,
    }));
    vi.doMock('../game/src/ui/expedition-feedback.js', () => ({ installExpeditionFeedback: vi.fn() }));
    vi.doMock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({}) }));
    vi.doMock('../game/src/hub/game.hub.js', () => ({ openBaseHub: vi.fn() }));
    vi.doMock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick: vi.fn() }, _set_cardPageOpen: vi.fn() }));
    vi.doMock('../game/src/core/random.js', () => ({
      Random: { random: vi.fn(() => 0) },
      SeededRandomService: class { random() { return 0; } snapshot() { return { seed: 'test' }; } restore() {} },
    }));
    vi.doMock('../game/src/battle/battle-loader.js', () => ({
      captureBattleContext: vi.fn(() => () => true), ensureBattleReady: vi.fn(async () => {}), startBattle: vi.fn(),
    }));
    vi.doMock('../game/src/run/game.run.scenes.js', () => ({
      FIRE_RESTORABLE: [], consumeCurrentCell: vi.fn(), finishInstant: vi.fn(), grantEventCard: vi.fn(),
      nodeOpt: vi.fn(), nodeShell, openPocketRestore: vi.fn(), openShop: vi.fn(),
      preloadAllNodeShellBgs: vi.fn(), showRunTransition: vi.fn(() => transition),
    }));
    vi.doMock('../game/src/hub/game.storage.js', () => ({ RunStorage: {} }));
    vi.doMock('../game/src/hub/recovery.commands.js', () => ({
      commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn(),
    }));

    const ui = {
      act(name, handler) { handlers[name] = handler; },
      showOverlay: vi.fn(), hideOverlay,
      showCardZoom: vi.fn(),
      log: vi.fn(), refresh: vi.fn(),
    };
    window.SDT = {
      UI: ui,
      Sound: { sfx: vi.fn() },
      Base: {},
      Meta: {
        addXpToProgress: vi.fn(), classLv: () => 1, classXP: () => 0,
        LEVEL_MAX: 10, xpForNext: () => 100, perkText: () => '',
      },
      Cards: { classPool: () => [{ id: 'class-card' }], randomClassCard, cardHTML: card => `<article>${card.name}</article>` },
      Art: {
        warmClassRoster: vi.fn(), classFullArt: () => '', classArt: () => '',
        listSkins: () => [], getSkin: () => 'default',
      },
    };
    vi.stubGlobal('requestIdleCallback', vi.fn());
    const { openClassChoice } = await import('../game/src/run/game.run.altar.js');

    const onSelect = vi.fn();
    openClassChoice({ beforeConfirm, onCancel: vi.fn(), ...(deferred ? { onSelect } : {}) });
    handlers.pickClass();
    if (deferred) {
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect.mock.calls[0][0]).toBe('侠客');
      expect(beforeConfirm).not.toHaveBeenCalled();
      expect(randomClassCard).not.toHaveBeenCalled();
      expect(game.characterId).toBeNull();
      onSelect.mock.calls[0][1]();
    }

    expect(beforeConfirm).toHaveBeenCalledTimes(1);
    expect(randomClassCard).not.toHaveBeenCalled();
    expect(hideOverlay).not.toHaveBeenCalled();
    expect(game).toMatchObject({ state: 'modal', characterId: null, myClass: null, classCard: null, ownedCards: [] });
    if (!deferred) {
      const overlay = document.createElement('div');
      overlay.id = 'overlay';
      overlay.innerHTML = ui.showOverlay.mock.calls[0][1];
      document.body.replaceChildren(overlay);
      const mounted = overlay.querySelector('.cls2-page');
      handlers.selClass({ cls: '法师' });
      handlers.selClass({ cls: '战士' });
      handlers.selClass({ cls: '侠客' });
      expect(overlay.querySelector('.cls2-page')).toBe(mounted);
      expect(mounted.querySelector('.cls2-name').textContent).toBe('无');
      expect(ui.showOverlay).toHaveBeenCalledTimes(1);
      beforeConfirm.mockReturnValue(true);
      randomClassCard.mockReturnValueOnce({ id: 'first', name: '实际牌甲' }).mockReturnValueOnce({ id: 'second', name: '实际牌乙' });
      saveGame.mockReturnValue(false);
      handlers.pickClass();
      handlers.pickClass();
      expect(randomClassCard).toHaveBeenCalledTimes(2);
      await transition;
      await Promise.resolve();
      if (!completed) {
        expect(nodeShell).not.toHaveBeenCalled();
        expect(saveGame).toHaveBeenCalledTimes(1);
        expect(game.ownedCards).toEqual([]);
        return;
      }
      expect(game.state).toBe('idle');
      expect(game.ownedCards).toEqual([]);
      expect(game.classCard).toBeNull();
      expect(game.entrySupply).toEqual({ version:1, layerIdx:0, trackPos:3, cardIds:['first','second'], taken:[] });
      expect(nodeShell).not.toHaveBeenCalled();
      expect(ui.showCardZoom).not.toHaveBeenCalled();
      expect(randomClassCard).toHaveBeenCalledTimes(2);
      expect(saveGame).toHaveBeenCalledTimes(2);
      expect(ui.refresh).toHaveBeenCalledWith(game);
      expect(handlers.clsGrantGo).toBeUndefined();
    }
  });
});
