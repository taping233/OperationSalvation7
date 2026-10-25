import { describe, expect, it, vi } from 'vitest';

describe('选角确认的出征整备守卫', () => {
  it.each([
    [false, true, null], [true, true, null], [false, false, null],
    [false, true, 'source-page'], [false, true, 'hidden'], [false, true, 'run'],
    [true, true, 'deferred-new-run'], [true, true, 'deferred-stale-page'],
    [false, true, 'before-hidden'], [false, true, 'before-run'],
    [false, true, 'pool-return'], [true, true, 'pool-return'],
    [false, true, 'pool-browse'],
  ])('整备守卫与入城边界（延迟确认：%s，转场完成：%s，等待情形：%s）', async (deferred, completed, waiting) => {
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
      MAP: { rules: { fireHeal: 5, playerMaxHp: 24, playerAtk: 3 } }, MODES: { standard: { xpMul: 1 } },
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
    vi.doMock('../game/src/battle/battle-loader.js', async () => {
      const { captureBattleContext } = await vi.importActual('../game/src/battle/battle-loader.js');
      return { captureBattleContext, ensureBattleReady: vi.fn(async () => {}), startBattle: vi.fn() };
    });
    const showRunTransition = vi.fn(() => transition);
    vi.doMock('../game/src/run/game.run.scenes.js', () => ({
      FIRE_RESTORABLE: [], consumeCurrentCell: vi.fn(), finishInstant: vi.fn(), grantEventCard: vi.fn(),
      nodeOpt: vi.fn(), nodeShell, openPocketRestore: vi.fn(), openShop: vi.fn(),
      preloadAllNodeShellBgs: vi.fn(), showRunTransition,
    }));
    vi.doMock('../game/src/hub/game.storage.js', () => ({ RunStorage: {} }));
    vi.doMock('../game/src/hub/recovery.commands.js', () => ({
      commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn(),
    }));

    const ui = {
      act(name, handler) { handlers[name] = handler; },
      showOverlay: vi.fn((_title, html) => {
        document.body.innerHTML = `<div id="overlay"><div id="ovBody">${html}</div></div>`;
      }), hideOverlay,
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
      Cards: { classPool: () => waiting === 'pool-browse' ? Array.from({length:42},(_,i)=>({id:`card-${i}`,name:`卡牌${i}`,type:i%2?'装备':'法术'})) : [{ id: 'class-card' }], randomClassCard, rarityOf: () => '古朴', cardHTML: card => `<article>${card.name}</article>` },
      Art: {
        warmClassRoster: vi.fn(), classFullArt: () => '', classArt: () => '',
        listSkins: () => [], getSkin: () => 'default',
      },
    };
    vi.stubGlobal('requestIdleCallback', vi.fn());
    const { openClassChoice } = await import('../game/src/run/game.run.class-choice.page.js');

    const onSelect = vi.fn();
    if (waiting === 'pool-browse') {
      openClassChoice({onCancel:vi.fn()});
      const original=document.querySelector('.cls2-face[aria-pressed="true"]').dataset.cls;
      const other=[...document.querySelectorAll('.cls2-face')].find(button=>button.dataset.cls!==original).dataset.cls;
      handlers.clsPool();handlers.poolFilter({filter:'装备'});handlers.poolNext();
      const card=[...document.querySelectorAll('.pool-card-button')][2];
      card.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));
      const selected=card.dataset.i;
      document.getElementById('poolGrid').scrollTop=83;document.getElementById('poolPreview').scrollTop=41;
      handlers.clsBack();handlers.clsPool();
      expect(document.querySelector('.pool-filter.active').dataset.filter).toBe('装备');
      expect(document.querySelector('.pool-page-now').textContent).toBe('2');
      expect(document.querySelector('.pool-card-button.selected').dataset.i).toBe(selected);
      expect(document.getElementById('poolPreview').dataset.cardIndex).toBe(selected);
      expect(document.getElementById('poolGrid').scrollTop).toBe(83);
      expect(document.getElementById('poolPreview').scrollTop).toBe(41);
      handlers.clsBack();handlers.selClass({cls:other});handlers.clsPool();
      expect(document.querySelector('.pool-filter.active').dataset.filter).toBe('all');
      expect(document.querySelector('.pool-page-now').textContent).toBe('1');
      expect(document.getElementById('poolGrid').scrollTop).toBe(0);
      handlers.clsBack();handlers.selClass({cls:original});handlers.clsPool();
      expect(document.querySelector('.pool-filter.active').dataset.filter).toBe('all');
      expect(document.querySelector('.pool-page-now').textContent).toBe('1');
      expect(saveGame).not.toHaveBeenCalled();return;
    }
    if (waiting === 'pool-return') {
      openClassChoice(deferred ? { onCancel:vi.fn() } : {});
      handlers.clsPool();
      const back = document.querySelector('.pool-back.archive-back[data-act="clsBack"]');
      expect(back.type).toBe('button'); expect(back.textContent).toBe('返回');
      expect(back.getAttribute('aria-label')).toBe('返回选人');
      expect(back.dataset.cancel).toBe('true');
      expect(back.querySelector('svg').getAttribute('width')).toBe('24');
      expect(back.closest('.cls-pool-page').dataset.baseDeparture).toBe(String(deferred));
      back.focus(); expect(document.activeElement).toBe(back);
      handlers.clsBack();
      expect(document.querySelector('.cls2-page')).not.toBeNull();
      expect(document.querySelector('.cls-pool-page')).toBeNull();
      expect(game.myClass).toBeNull(); expect(saveGame).not.toHaveBeenCalled();
      return;
    }
    if (waiting) {
      const beforeWaiting = waiting.startsWith('before-');
      let finishWaiting;
      const pending = new Promise(resolve => { finishWaiting = resolve; });
      const markAmmoTaught = vi.fn(() => pending);
      window.SDT.Base = { data: { ammoTaught: beforeWaiting }, markAmmoTaught };
      beforeConfirm.mockImplementation(() => {
        if (deferred) {
          // The departure adapter legitimately creates a new run from the preparation page.
          game.seed = 'new-run'; game.discoveredPairs = new Set(); game.runActive = true;
        }
        return beforeWaiting ? pending : true;
      });
      let confirmationCurrent = true;
      openClassChoice({ beforeConfirm, ...(deferred ? {
        onSelect, isConfirmationCurrent: () => confirmationCurrent && !!document.getElementById('depMain') && !document.getElementById('overlay').hidden,
      } : {}) });
      const clicked = handlers.pickClass();
      if (deferred) ui.showOverlay('', '<section id="depMain">出发整备</section>');
      const confirmation = deferred ? onSelect.mock.calls[0][1]() : clicked;
      await Promise.resolve();
      expect(beforeConfirm).toHaveBeenCalledOnce();
      if (beforeWaiting) expect(markAmmoTaught).not.toHaveBeenCalled();
      else expect(markAmmoTaught).toHaveBeenCalledOnce();
      expect(randomClassCard).not.toHaveBeenCalled();
      if (waiting === 'source-page') ui.showOverlay('', '<section id="inbox">留言信箱</section>');
      if (waiting === 'hidden' || waiting === 'before-hidden') document.getElementById('overlay').hidden = true;
      if (waiting === 'run' || waiting === 'before-run') game.discoveredPairs = new Set();
      if (waiting === 'deferred-stale-page') confirmationCurrent = false;
      finishWaiting(true);
      const confirmed = await confirmation;
      if (waiting === 'deferred-new-run') {
        expect(confirmed).toBe(true);
        expect(game).toMatchObject({ seed: 'new-run', runActive: true, myClass: '侠客', characterId: 'wu' });
        expect(showRunTransition).toHaveBeenCalledOnce(); expect(saveGame).toHaveBeenCalledTimes(2);
      } else {
        expect(confirmed).toBe(false);
        expect(game.myClass).toBeNull(); expect(game.characterId).toBeNull(); expect(game.entrySupply).toBeUndefined();
        expect(randomClassCard).not.toHaveBeenCalled(); expect(hideOverlay).not.toHaveBeenCalled();
        expect(saveGame).not.toHaveBeenCalled(); expect(showRunTransition).not.toHaveBeenCalled();
      }
      return;
    }
    openClassChoice({ beforeConfirm, onCancel: vi.fn(), ...(deferred ? { onSelect } : {}) });
    const back = document.querySelector('.archive-back[data-act="cls2Quit"]');
    expect(back.type).toBe('button'); expect(back.getAttribute('aria-label')).toBe(deferred ? '返回基地' : '返回出发整备');
    expect(back.dataset.cancel).toBe('true');
    expect(back.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.cls2-stats').textContent).toContain('生命上限 24');
    expect(document.querySelector('.cls2-stats').textContent).toContain('基础攻击 3');
    expect(document.querySelector('.cls2-skill').textContent).toContain('刺击');
    expect(document.querySelector('.cls2-skill').textContent).toContain('不消耗卡牌');
    expect(document.querySelector('.cls2-supply-rules')).toBeNull();
    expect(document.querySelector('.cls2-growth summary').textContent).toContain('熟练成长');
    expect(document.querySelectorAll('.cls2-face[aria-pressed="true"]')).toHaveLength(1);
    expect(document.querySelector('.cls2-face[aria-pressed="true"]').dataset.cls).toBe('侠客');
    await handlers.pickClass();
    if (deferred) {
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect.mock.calls[0][0]).toBe('侠客');
      expect(beforeConfirm).not.toHaveBeenCalled();
      expect(randomClassCard).not.toHaveBeenCalled();
      expect(game.characterId).toBeNull();
      await onSelect.mock.calls[0][1]();
    }

    expect(beforeConfirm).toHaveBeenCalledTimes(1);
    expect(randomClassCard).not.toHaveBeenCalled();
    expect(hideOverlay).not.toHaveBeenCalled();
    expect(game).toMatchObject({ state: 'modal', characterId: null, myClass: null, classCard: null, ownedCards: [] });
    if (!deferred) {
      const overlay = document.getElementById('overlay');
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
      const firstConfirmation = handlers.pickClass();
      const repeatedConfirmation = handlers.pickClass();
      await firstConfirmation;
      await repeatedConfirmation;
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
