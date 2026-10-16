import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// This suite stubs rendering ports; the motion installer must not replace its spies.
vi.mock('../game/src/ui/interface-motion.js', () => ({ interfaceReducedMotion: () => true }));

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
    Cards: { all: () => [card], classPool: () => [card], randomClassCard: () => card, cardHTML: () => 'test card',
      applyAbilityRename: () => false, applyDuplicateRenames: () => false },
    Base: { slot: 1, peek: () => ({}), use(n) { this.slot = n; }, issue: () => null,
      data: { stash: [], pocket: [] }, save() {}, applyStoredCardRenames: () => false } };
  battle = { start: vi.fn(() => true), restore: vi.fn(), getSnapshot: vi.fn(() => ({})) };
  vi.doMock('../game/src/battle/view/battle.view.js', async () => {
    entered.resolve(); await gate.promise; SDT.Battle = battle; return {};
  });
  vi.doMock('../game/src/run/game.session.js', () => ({ game,
    MAP: { rules: { playerMaxHp: 30, playerAtk: 4 }, altar: { bosses: [{ name: 'boss' }] } }, MODES: {}, getActiveSlot: () => slot,
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
  const { createGameMenuController } = await import('./helpers/menu-controller.js');
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

  it('boss confirmation uses the shared transition before drawing the boss and loading battle', async () => {
    const { openBossGate } = await import('../game/src/run/game.run.altar.js');
    game.altarActivated = true;
    openBossGate();
    const fight = handlers.bossGateFight;
    const request = fight();
    expect(document.querySelector('.city-run-transition')).not.toBeNull();
    expect(document.querySelector('.camp-entry-caption').textContent).toContain('旅途继续');
    expect(game.bossPlan).toBeUndefined();
    expect(battle.start).not.toHaveBeenCalled();
    fight();
    expect(game.bossPlan).toBeUndefined();
    handlers.flowContinue(); await entered.promise; gate.resolve();
    expect(await request).toBe(true);
    expect(battle.start).toHaveBeenCalledExactlyOnceWith(game, expect.objectContaining({ name:'boss', boss:true }),
      { isBoss:true, name:'boss', directBossStart:true });
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
    expect(document.querySelector('.city-run-transition')).not.toBeNull();
    handlers.flowContinue(); await entered.promise;
    expect(loadGame).not.toHaveBeenCalled(); gate.resolve();
    // 续局首帧揭幕：160ms 布局兜底 + 220ms 揭幕定时器需推进后才完成恢复。
    await vi.advanceTimersByTimeAsync(600);
    await request;
    expect(loadGame).toHaveBeenCalledExactlyOnceWith(1);
  });

  it.each(['resolve', 'reject'])('does not load or report an old slot after title exit (%s)', async outcome => {
    menu.startNewGame(); const request = handlers.enterSlot({ slot: 1 });
    handlers.flowContinue(); await entered.promise;
    menu.showTitle(); UI.log.mockClear(); UI.showOverlay.mockClear();
    gate[outcome](new Error('offline')); expect(await request).toBe(false);
    expect(loadGame).not.toHaveBeenCalled(); expect(UI.log).not.toHaveBeenCalled();
    expect(game.state).toBe('title');
    expect(UI.showOverlay).not.toHaveBeenCalled();
    // 取消后 finally 即时收起自有的续局过场，不在标题页残留旧画面。
    expect(document.querySelector('.city-run-transition')).toBeNull();
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
    const { openClassChoice } = await import('../game/src/run/game.run.class-choice.page.js');
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
      // 选角先冻结待领补给，过场结束只回地图；实际入口格负责显示领取页。
      expect(UI.showOverlay).not.toHaveBeenCalled();
      expect(game.entrySupply).toMatchObject({ version:1, layerIdx:0, trackPos:2, cardIds:['test'], taken:[] });
      expect(game.ownedCards).toHaveLength(1);
      expect(saveGame).toHaveBeenCalledTimes(2);
      const { openEntrySupply } = await import('../game/src/run/game.run.altar.js');
      expect(openEntrySupply()).toBe(true);
      expect(document.querySelector('[data-act="clsEntryReveal"]')).not.toBeNull();
      handlers.clsEntryReveal();
      expect(document.querySelector('.entry-reward-scene')).not.toBeNull();
      handlers.clsEntryContinue(); expect(game.state).toBe('modal');
      expect(document.querySelector('[data-act="clsEntryContinue"]')).toBeNull();
      handlers.entrySupplyTake({ i: '0' });
      expect(game.entrySupply.taken).toEqual([0]);
      expect(document.querySelector('[data-act="clsEntryContinue"]')).not.toBeNull();
      handlers.clsEntryContinue(); expect(game.state).toBe('idle');
      saveGame.mockClear(); game.discoveredPairs = new Set(); game.state = 'modal';
      handlers.clsEntryContinue(); expect(saveGame).not.toHaveBeenCalled(); expect(game.state).toBe('modal');
    } else {
      expect(UI.showOverlay).not.toHaveBeenCalled();
      expect(saveGame).toHaveBeenCalledOnce(); // 过场前冻结待领补给；过期回调不再保存。
    }
    if (replacement) { handlers.flowContinue(); expect(await replacement).toBe(true); }
  });
});


describe('选档消费 pending 选角就绪', () => {
  it('选角真实就绪前保持enterSlot锁且不写已进入成功日志', async () => {
    const choice = deferred();
    loadGame.mockReturnValue({ ok:true, classChoiceEntry:choice.promise });
    menu.startNewGame(); const opening = handlers.enterSlot({ slot:1 });
    await vi.runAllTimersAsync(); gate.resolve(); await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    expect(loadGame).toHaveBeenCalledOnce();
    expect(UI.log.mock.calls.flat().join(' ')).not.toContain('已进入');
    await expect(handlers.enterSlot({ slot:1 })).resolves.toBe(false);
    expect(loadGame).toHaveBeenCalledOnce();
    choice.resolve(true);
    // 就绪后续局首帧揭幕含 160ms/220ms 定时器，推进后再等待完成。
    await vi.advanceTimersByTimeAsync(600);
    await opening;
    expect(UI.log.mock.calls.flat().join(' ')).toContain('已进入');
  });
  it.each(['failed', 'title', 'settings', 'new-run'])('未就绪结果按来源处理（%s）', async change => {
    const choice = deferred();
    loadGame.mockReturnValue({ ok:true, classChoiceEntry:choice.promise });
    menu.startNewGame(); const opening = handlers.enterSlot({ slot:1 });
    await vi.runAllTimersAsync(); gate.resolve(); await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    expect(loadGame).toHaveBeenCalledOnce();
    if (change === 'title') menu.showTitle();
    if (change === 'settings') { document.getElementById('ovBody').innerHTML = '<section id="newSettings">设置</section>'; game.state = 'modal'; }
    if (change === 'new-run') game.discoveredPairs = new Set();
    choice.resolve(false); expect(await opening).toBe(false);
    expect(UI.log.mock.calls.flat().join(' ')).not.toContain('已进入');
    if (change === 'failed') {
      expect(document.querySelector('.slot-page')).not.toBeNull();
      expect(document.getElementById('slotRestoreError').textContent).toContain('对局进度已保留');
    } else if (change === 'settings') expect(document.getElementById('newSettings')).not.toBeNull();
  });
});


describe('迟到选角操作失效', () => {
  it.each(['title', 'new-run', 'replaced-page'])('旧pickClass不能修改新页面或新局（%s）', async change => {
    const { openClassChoice } = await import('../game/src/run/game.run.class-choice.page.js');
    openClassChoice(); const oldPick = handlers.pickClass;
    const random = vi.spyOn(SDT.Cards, 'randomClassCard');
    if (change === 'title') menu.showTitle();
    if (change === 'new-run') game.discoveredPairs = new Set();
    if (change === 'replaced-page') document.getElementById('ovBody').innerHTML = '<section>新的页面</section>';
    UI.hideOverlay.mockClear(); oldPick();
    expect(random).not.toHaveBeenCalled(); expect(game.entrySupply).toBeUndefined();
    expect(UI.hideOverlay).not.toHaveBeenCalled();
  });
  it.each(['slot', 'new-run', 'confirmation-owner'])('整备保存前废弃旧人物confirm闭包（%s）', async change => {
    const { openClassChoice } = await import('../game/src/run/game.run.class-choice.page.js');
    let valid = true; const onSelect = vi.fn(), beforeConfirm = vi.fn(() => true);
    openClassChoice({ onSelect, beforeConfirm, isConfirmationCurrent:() => valid });
    handlers.pickClass(); const confirm = onSelect.mock.lastCall[1];
    if (change === 'slot') slot = 2;
    if (change === 'new-run') game.discoveredPairs = new Set();
    if (change === 'confirmation-owner') valid = false;
    confirm(); expect(beforeConfirm).not.toHaveBeenCalled(); expect(saveGame).not.toHaveBeenCalled();
    expect(game.entrySupply).toBeUndefined();
  });
});
