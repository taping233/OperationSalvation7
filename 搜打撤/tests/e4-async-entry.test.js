import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let game, UI, SDT, handlers, slot, gate, entered, battle, menu, scenes, saveGame, loadGame, hasSavedRun, clickedAction;

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="title"></div><div id="exitScr"></div><div id="overlay" hidden><div id="ovBody"></div></div>';
  localStorage.setItem('sdt-rmb-hint', '1');
  slot = 1; handlers = {}; gate = deferred(); entered = deferred();
  hasSavedRun = true; clickedAction = null;
  const overlay = document.getElementById('overlay');
  overlay.addEventListener('click', event => {
    const button = event.target.closest('button[data-act]');
    if (button && !button.disabled) clickedAction = handlers[button.dataset.act]?.(button.dataset);
  });
  game = { seed: 'same', discoveredPairs: new Set(), nestRunes: [], runActive: true,
    nestActive: false, layerIdx: 0, trackPos: 2, nestPos: 0, state: 'idle', ownedCards: [{}] };
  saveGame = vi.fn(); loadGame = vi.fn(() => ({ ok: true }));
  UI = { log: vi.fn(), refresh: vi.fn(), clearLog() {}, registerHelp() {}, helpBtn: () => '',
    hideScreen(node) { node.hidden = true; }, showScreen(node) { node.hidden = false; }, act(name, fn) { handlers[name] = fn; },
    hideOverlay: vi.fn(() => { overlay.hidden = true; document.getElementById('ovBody').innerHTML = ''; }),
    showOverlay: vi.fn((_title, html) => { document.getElementById('ovBody').innerHTML = html; overlay.hidden = false; }),
    el: { overlay, ovBody: document.getElementById('ovBody') } };
  const card = { id: 'test', name: 'test' };
  SDT = window.SDT = { game, UI, Sound: { music() {}, sfx() {} }, Icons: { img: () => '' },
    Art: { classArt: () => '', classFullArt: () => '', listSkins: () => [] },
    Meta: { ACHIEVEMENTS: [], isUnlocked: () => false, classLv: () => 1, classXP: () => 0,
      xpForNext: () => 10, perkText: () => '', addXpToProgress() {} },
    Cards: { classPool: () => [card], randomClassCard: () => card, cardHTML: () => 'test card',
      applyAbilityRename: () => false, applyDuplicateRenames: () => false },
    Base: { slot: 1, peek: () => ({}), use(n) { this.slot = n; }, issue: () => null,
      data: { stash: [], pocket: [] }, save() {} } };
  battle = { start: vi.fn(() => true), restore: vi.fn(), getSnapshot: vi.fn(() => ({})) };
  vi.doMock('../game/src/battle/view/battle.view.js', async () => {
    entered.resolve(); await gate.promise; SDT.Battle = battle; return {};
  });
  vi.doMock('../game/src/run/game.session.js', () => ({ game,
    MAP: { altar: { bosses: [{ name: 'boss' }] } }, MODES: {}, getActiveSlot: () => slot,
    bagCap: () => 9, newUid: () => 'uid', pick: a => a[0], saveGame, scaledEnemy: x => x,
    usedSlots: () => 0, newRun() {}, curLayer() {}, enterLayer() {}, exitToTitle() {} }));
  vi.doMock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick() {} }, _set_cardPageOpen() {}, cardHTML: () => '' }));
  vi.doMock('../game/src/run/game.run.shop.js', () => ({ createShopController: () => ({ openShop() {} }) }));
  vi.doMock('../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
  vi.doMock('../game/src/run/game.run.flow.js', () => ({ runEventDeck() {} }));
  vi.doMock('../game/src/agent/agent.console.js', () => ({ agentTabHTML() {}, bindAgentTab() {}, keysTabHTML() {}, bindKeysTab() {} }));
  vi.doMock('../game/src/agent/agent.data.js', () => ({ dataPanelHTML() {}, bindDataActions() {} }));
  scenes = await import('../game/src/run/game.run.scenes.js');
  const { ensureBattleReady } = await import('../game/src/battle/battle-loader.js');
  const { createGameMenuController } = await import('../game/src/ui/game.menu.js');
  menu = createGameMenuController({ SDT, UI, game,
    runtime: { resize() {}, showRunTransition: scenes.showRunTransition, openBaseHub: vi.fn() },
    SLOT_COUNT: 1, esc: String, readSlot: () => null, loadGame, clearSlot() {}, saveGame,
    clearAllSlots() {}, getActiveSlot: () => slot, setActiveSlot: n => { slot = n; },
    preflightRunMap: () => ({ ok: true }), RunStorage: { has: () => hasSavedRun, issue() {} }, ensureBattleReady });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('E4 real async entry chains (render/storage ports stubbed)', () => {
  it('enters a node through the real transition and lazy loader', async () => {
    const request = scenes.enterNode('battle', () => scenes.openBattleCell(null, [{ name: 'foe' }]));
    handlers.flowContinue(); await entered.promise; gate.resolve();
    expect(await request).toBe(true); expect(battle.start).toHaveBeenCalledOnce();
  });

  it('title exit cancels an old transition and its node callback even if flags return', async () => {
    const done = vi.fn(); const request = scenes.enterNode('battle', done);
    const finish = handlers.flowContinue;
    menu.showTitle(); game.runActive = true; game.state = 'modal'; slot = 1;
    UI.hideOverlay.mockClear(); finish();
    expect(await request).toBe(false); expect(done).not.toHaveBeenCalled();
    expect(UI.hideOverlay).not.toHaveBeenCalled(); expect(game.state).toBe('modal');
  });

  it('an older transition cannot close the replacement transition', async () => {
    const first = scenes.showRunTransition({ title: 'old' }); const oldFinish = handlers.flowContinue;
    const second = scenes.showRunTransition({ title: 'new' }); UI.hideOverlay.mockClear();
    oldFinish(); expect(await first).toBe(false); expect(UI.hideOverlay).not.toHaveBeenCalled();
    handlers.flowContinue(); expect(await second).toBe(true);
  });

  it('a resolved transition cannot dispatch done after a same-seed new run', async () => {
    const done = vi.fn(); const request = scenes.enterNode('battle', done);
    handlers.flowContinue(); game.discoveredPairs = new Set();
    expect(await request).toBe(false); expect(done).not.toHaveBeenCalled();
  });

  it('a resolved node transition cannot dispatch after a new transition starts', async () => {
    const done = vi.fn(); const request = scenes.enterNode('battle', done);
    handlers.flowContinue();
    const replacement = scenes.showRunTransition({ title: 'new' });
    expect(await request).toBe(false); expect(done).not.toHaveBeenCalled();
    handlers.flowContinue(); expect(await replacement).toBe(true);
  });

  it('resumes a slot only after real transition and loader completion', async () => {
    menu.startNewGame(); const request = handlers.enterSlot({ slot: 1 });
    handlers.flowContinue(); await entered.promise;
    expect(loadGame).not.toHaveBeenCalled(); gate.resolve(); await request;
    expect(loadGame).toHaveBeenCalledExactlyOnceWith(1);
  });

  it.each(['resolve', 'reject'])('does not load or report an old slot after title exit (%s)', async outcome => {
    menu.startNewGame(); const request = handlers.enterSlot({ slot: 1 });
    handlers.flowContinue(); await entered.promise;
    menu.showTitle(); UI.log.mockClear(); UI.showOverlay.mockClear();
    const page = document.getElementById('ovBody').innerHTML;
    gate[outcome](new Error('offline')); expect(await request).toBe(false);
    expect(loadGame).not.toHaveBeenCalled(); expect(UI.log).not.toHaveBeenCalled();
    expect(game.state).toBe('title');
    expect(UI.showOverlay).not.toHaveBeenCalled();
    expect(document.getElementById('ovBody').innerHTML).toBe(page);
    expect(document.getElementById('slotRestoreError')).toBeNull();
  });

  it('checks the real active slot after awaiting the loader', async () => {
    menu.startNewGame(); const request = handlers.enterSlot({ slot: 1 });
    handlers.flowContinue(); await entered.promise; slot = 2; gate.resolve();
    expect(await request).toBe(false); expect(loadGame).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'])('a new same-run transition supersedes pending slot load (%s)', async outcome => {
    menu.startNewGame(); const request = handlers.enterSlot({ slot: 1 });
    handlers.flowContinue(); await entered.promise;
    const replacement = scenes.showRunTransition({ title: 'new' }); UI.log.mockClear();
    gate[outcome](new Error('offline'));
    expect(await request).toBe(false); expect(loadGame).not.toHaveBeenCalled();
    expect(UI.log).not.toHaveBeenCalled(); expect(game.state).toBe('modal');
    handlers.flowContinue(); expect(await replacement).toBe(true);
  });

  it.each(['module', 'load-result'])('shows a current %s failure in an actionable slot picker after clearing run ownership', async failure => {
    menu.startNewGame(); const request = handlers.enterSlot({ slot: 1 });
    handlers.flowContinue(); await entered.promise;
    if (failure === 'module') gate.reject(new Error('offline'));
    else { loadGame.mockReturnValueOnce({ ok: false, message: '测试路线恢复失败' }); gate.resolve(); }
    expect(await request).toBe(false);
    expect(game.runActive).toBe(false); expect(slot).toBeNull();
    const alert = document.getElementById('slotRestoreError');
    expect(alert).not.toBeNull();
    expect(alert.hidden).toBe(false);
    expect(game.state).toBe('modal');
    expect(alert.textContent).toContain(failure === 'module' ? '进入档位失败，请刷新页面后重试' : '测试路线恢复失败');
    expect(alert.textContent).toContain('原档已保留');
    expect(document.getElementById('overlay').hidden).toBe(false);
    const enterButton = document.querySelector('button[data-act="enterSlot"]');
    expect(enterButton).not.toBeNull(); expect(enterButton.disabled).toBe(false);
    if (failure === 'module') expect(loadGame).not.toHaveBeenCalled();
    else expect(loadGame).toHaveBeenCalledExactlyOnceWith(1);
    // Exercise the newly rendered button and its newly registered handler; no retry mock.
    hasSavedRun = false;
    enterButton.click(); handlers.flowContinue();
    expect(await clickedAction).toMatchObject({ ok: true });
    expect(slot).toBe(1);
  });

  it('dev boss failure does not inspect a missing battle or report success', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { devForceBattle } = await import('../game/src/run/game.run.dev.js');
    const request = devForceBattle(true); await entered.promise; gate.reject(new Error('offline'));
    expect(await request).toBe(false); expect(battle.getSnapshot).not.toHaveBeenCalled();
    expect(UI.log.mock.calls.some(([message]) => message.includes('强制进入'))).toBe(false);
  });

  it.each(['normal', 'new-run', 'title', 'resolved-then-new-run', 'resolved-then-transition'])('guards class grant transition (%s)', async change => {
    SDT.Battle = battle;
    const { openClassChoice } = await import('../game/src/run/game.run.altar.js');
    openClassChoice(); handlers.pickClass(); const finish = handlers.flowContinue;
    if (change === 'new-run') game.discoveredPairs = new Set();
    if (change === 'title') menu.showTitle();
    UI.showOverlay.mockClear(); UI.hideOverlay.mockClear();
    finish();
    if (change === 'resolved-then-new-run') game.discoveredPairs = new Set();
    const replacement = change === 'resolved-then-transition' ? scenes.showRunTransition({ title: 'new' }) : null;
    if (replacement) UI.showOverlay.mockClear();
    await Promise.resolve();
    if (change === 'normal') {
      expect(UI.showOverlay).toHaveBeenCalledOnce();
      handlers.clsGrantGo(); expect(saveGame).toHaveBeenCalledOnce();
      saveGame.mockClear(); game.discoveredPairs = new Set(); game.state = 'modal';
      handlers.clsGrantGo(); expect(saveGame).not.toHaveBeenCalled(); expect(game.state).toBe('modal');
    } else {
      expect(UI.showOverlay).not.toHaveBeenCalled(); expect(saveGame).not.toHaveBeenCalled();
    }
    if (replacement) { handlers.flowContinue(); expect(await replacement).toBe(true); }
  });
});
