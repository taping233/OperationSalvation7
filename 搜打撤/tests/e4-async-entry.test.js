import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// This suite stubs rendering ports; the motion installer must not replace its spies.
vi.mock('../game/src/ui/interface-motion.js', () => ({ interfaceReducedMotion: () => true }));
vi.mock('../game/src/core/map-image-ready.js', () => ({ mapImageReady: async () => true }));

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let game, UI, SDT, handlers, slot, gate, entered, battle, menu, scenes, saveGame, loadGame, hasSavedRun, clickedAction, preflightRunMap;

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="title"></div><div id="exitScr"></div><div id="overlay" hidden><div id="ovBody"></div></div>';
  localStorage.setItem('sdt-rmb-hint', '1');
  slot = 1; handlers = {}; gate = deferred(); entered = deferred();
  hasSavedRun = true; clickedAction = null;
  preflightRunMap = vi.fn(() => ({ ok:true }));
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
      data: { stash: [], pocket: [] }, save() {}, applyStoredCardRenames: async () => ({ changed:false, persisted:true }),
      flushWrites: async () => ({ ok:true }) } };
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
    preflightRunMap, RunStorage: { has: () => hasSavedRun, issue() {} }, ensureBattleReady });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('E4 real async entry chains (render/storage ports stubbed)', () => {
  it('restores a verified map-only save without loading the battle module', async () => {
    preflightRunMap.mockReturnValue({ ok:true, value:{ run:{ battle:null } } });
    SDT.Renderer = { warm:vi.fn(async () => true), prepare:vi.fn(async () => true) };
    menu.startNewGame();
    const request = handlers.enterSlot({ slot:1 });
    await vi.advanceTimersByTimeAsync(2200);
    expect(await request).toMatchObject({ ok:true });
    expect(loadGame).toHaveBeenCalledExactlyOnceWith(1);
    expect(SDT.Battle).toBeUndefined();
    expect(SDT.Renderer.prepare).toHaveBeenCalledOnce();
  });
  it('new transitions use the standard title and art without a presentation option', async () => {
    const pending = scenes.showRunTransition({ title: '新区域 <入口>', art: '/new-art.webp', detail: '说明', duration: 450 });
    expect(document.querySelector('.flow-transition').getAttribute('aria-label')).toContain('新区域 <入口>');
    expect(document.querySelector('.silent-node-cut').dataset.filmKind).toBe('battle');
    expect(document.querySelector('.transition-heading,.transition-art')).toBeNull();
    expect(document.querySelector('.flow-eyebrow, .flow-detail, .flow-title')).toBeNull();
    expect(document.querySelector('.flow-transition').getAttribute('aria-label')).toContain('说明');
    handlers.flowContinue();
    expect(await pending).toBe(true);
  });

  it.each(['door', 'altar', 'shop'])('%s displays its approved transition art and continues once on skip', async kind => {
    const done = vi.fn(() => true);
    const pending = scenes.enterNode(kind, done);
    expect(document.querySelector('.silent-node-cut').dataset.filmKind).toBe(kind);
    expect(document.querySelector('.silent-film-scenery').dataset.filmRenderer).toBe(kind==='altar'?'image':'procedural');
    expect(done).not.toHaveBeenCalled();
    handlers.flowContinue();
    expect(await pending).toBe(true);
    expect(done).toHaveBeenCalledOnce();
  });

  it('enters a node through the real transition and lazy loader', async () => {
    const request = scenes.enterNode('battle', () => scenes.openBattleCell(null, [{ name: 'foe' }]));
    expect(document.querySelector('[data-film-kind="battle"]')).not.toBeNull();
    expect(document.querySelector('.flow-transition').getAttribute('aria-label')).toContain('旅途继续');
    expect(document.querySelector('.camp-entry-caption')).toBeNull();
    handlers.flowContinue(); await entered.promise; gate.resolve();
    expect(await request).toBe(true); expect(battle.start).toHaveBeenCalledOnce();
  });

  it.each(['shop', 'door', 'event', 'altar'])('%s keeps the old scene until its destination replaces it', async kind => {
    const mounting = deferred();
    const done = vi.fn(() => mounting.promise);
    const pending = scenes.enterNode(kind, done);
    handlers.flowContinue();
    await Promise.resolve();
    expect(done).toHaveBeenCalledOnce();
    expect(UI.hideOverlay).not.toHaveBeenCalled();
    expect(UI.el.overlay.hidden).toBe(false);
    UI.showOverlay('目标', '<main id="node-destination">目标页</main>', 'page');
    mounting.resolve(true);
    expect(await pending).toBe(true);
    expect(UI.hideOverlay).not.toHaveBeenCalled();
    expect(document.getElementById('node-destination')).not.toBeNull();
  });

  it('releases the held noncombat scene when destination mounting fails', async () => {
    const pending = scenes.enterNode('shop', () => { throw new Error('mount failed'); });
    const failure = expect(pending).rejects.toThrow('mount failed');
    handlers.flowContinue();
    await failure;
    expect(UI.hideOverlay).toHaveBeenCalledExactlyOnceWith({ immediate: true });
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
    expect(document.querySelector('.flow-transition').getAttribute('aria-label')).toContain('旅途继续');
    expect(document.querySelector('.camp-entry-scenery img').src).toContain('boss-monolith-v1.webp');
    expect(game.bossPlan).toBeUndefined();
    expect(battle.start).not.toHaveBeenCalled();
    fight();
    expect(game.bossPlan).toBeUndefined();
    handlers.flowContinue(); await entered.promise; gate.resolve();
    expect(await request).toBe(true);
    expect(battle.start).toHaveBeenCalledExactlyOnceWith(game, expect.objectContaining({ name:'boss', boss:true }),
      { isBoss:true, name:'boss' });
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
    menu.startNewGame(); const request = handlers.enterSlot({ slot: 1 }); await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('.city-run-transition')).not.toBeNull();
    handlers.flowContinue(); await entered.promise;
    expect(loadGame).not.toHaveBeenCalled(); gate.resolve();
    // 目标布局及首帧完成后播放完整共用斜切，不能缩成无图片的淡出。
    await vi.advanceTimersByTimeAsync(1600);
    await request;
    expect(loadGame).toHaveBeenCalledExactlyOnceWith(1);
  });

  it.each(['resolve', 'reject'])('does not load or report an old slot after title exit (%s)', async outcome => {
    menu.startNewGame(); const request = handlers.enterSlot({ slot: 1 }); await vi.advanceTimersByTimeAsync(0);
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
    menu.startNewGame(); const request = handlers.enterSlot({ slot: 1 }); await vi.advanceTimersByTimeAsync(0);
    handlers.flowContinue(); await entered.promise; slot = 2; gate.resolve();
    expect(await request).toBe(false); expect(loadGame).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'])('a new same-run transition supersedes pending slot load (%s)', async outcome => {
    menu.startNewGame(); const request = handlers.enterSlot({ slot: 1 }); await vi.advanceTimersByTimeAsync(0);
    handlers.flowContinue(); await entered.promise;
    const replacement = scenes.showRunTransition({ title: 'new' }); UI.log.mockClear();
    gate[outcome](new Error('offline'));
    expect(await request).toBe(false); expect(loadGame).not.toHaveBeenCalled();
    expect(UI.log).not.toHaveBeenCalled(); expect(game.state).toBe('modal');
    handlers.flowContinue(); expect(await replacement).toBe(true);
  });

  it.each(['module', 'load-result'])('shows a current %s failure in an actionable slot picker after clearing run ownership', async failure => {
    menu.startNewGame(); const request = handlers.enterSlot({ slot: 1 }); await vi.advanceTimersByTimeAsync(0);
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
    enterButton.click(); await vi.advanceTimersByTimeAsync(0); handlers.flowContinue();
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
    openClassChoice(); handlers.pickClass(); await vi.advanceTimersByTimeAsync(0); const finish = handlers.flowContinue;
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
      expect(await openEntrySupply()).toBe(true);
      expect(document.querySelector('[data-act="clsEntryReveal"]')).toBeNull();
      expect(document.querySelector('.entry-reward-scene')).not.toBeNull();
      await handlers.clsEntryContinue(); expect(game.state).toBe('modal');
      expect(document.querySelector('[data-act="clsEntryContinue"]')).toBeNull();
      await handlers.entrySupplyTake({ i: '0' });
      expect(game.entrySupply.taken).toEqual([0]);
      expect(document.querySelector('[data-act="clsEntryContinue"]')).not.toBeNull();
      await handlers.clsEntryContinue(); expect(game.state).toBe('idle');
      saveGame.mockClear(); game.discoveredPairs = new Set(); game.state = 'modal';
      await handlers.clsEntryContinue(); expect(saveGame).not.toHaveBeenCalled(); expect(game.state).toBe('modal');
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
    // 目标首帧后播放完整的980ms共用斜切演出，再完成恢复。
    await vi.advanceTimersByTimeAsync(1600);
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

describe('DEV plain battle transition diagnostic', () => {
  afterEach(() => { history.replaceState(null, '', '/'); });
  it.each(['battle', 'boss'])('uses plain artwork for %s while retaining the current cinematic combat timer', async kind => {
    history.replaceState(null, '', '/?perfProbe=1&flightRecord=1&transitionDiagnostic=plain');
    const motion = await import('../game/src/core/motion.js');
    vi.spyOn(motion, 'reduceMotion').mockReturnValue(false);
    gate.resolve();
    const done = vi.fn(); const request = scenes.enterNode(kind, done);
    expect(UI.el.ovBody.querySelector('.flow-transition')).toBeTruthy();
    expect(UI.el.ovBody.querySelector('.camp-entry-cut')).toBeNull();
    await vi.advanceTimersByTimeAsync(kind==='battle'?299:1499); expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await request; expect(done).toHaveBeenCalledTimes(1);
  });
  it('uses the shared painted-frame and 180ms reveal for a held transition', async () => {
    history.replaceState(null, '', '/?perfProbe=1&flightRecord=1&transitionDiagnostic=plain');
    const motion = await import('../game/src/core/motion.js');
    vi.spyOn(motion, 'reduceMotion').mockReturnValue(false);
    const request = scenes.showRunTransition({ tone: 'battle', presentation: 'city-cut', duration: 900, holdVisual: true });
    expect(UI.el.ovBody.querySelector('.flow-transition')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(900); await request;
    expect(UI.hideOverlay).not.toHaveBeenCalled();
    const released = request.release();
    await vi.advanceTimersByTimeAsync(180); expect(UI.hideOverlay).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(540); await released;
    expect(UI.hideOverlay).toHaveBeenCalledExactlyOnceWith({ immediate: true });
  });
});

// These clocks establish overlap/ownership, not real browser latency.
describe('combat transition preparation overlap', () => {
  it.each(['battle','boss'])('%s starts module preparation before the current cinematic timer and holds the old surface while slow', async kind => {
    const motion = await import('../game/src/core/motion.js'); vi.spyOn(motion,'reduceMotion').mockReturnValue(false);
    const done=vi.fn(() => { game.battleActive=true; UI.showOverlay('战斗','<main class="battle-stage"></main>'); return true; });
    const pending=scenes.enterNode(kind,done);
    await vi.advanceTimersByTimeAsync(0); await entered.promise;
    expect(done).not.toHaveBeenCalled(); expect(UI.hideOverlay).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(kind==='boss'?1500:650);
    expect(done).not.toHaveBeenCalled(); expect(UI.el.overlay.hidden).toBe(false); expect(game.state).toBe('modal');
    await vi.advanceTimersByTimeAsync(350); gate.resolve();
    expect(await pending).toBe(true); expect(done).toHaveBeenCalledOnce();
    expect(document.querySelector('.battle-stage')).not.toBeNull(); expect(UI.hideOverlay).not.toHaveBeenCalled();
  });
  it('preparation failures stay covered through the authoritative loader failure path', async () => {
    const error=vi.spyOn(console,'error').mockImplementation(() => {});
    const pending=scenes.enterNode('battle',() => scenes.openBattleCell(null,[{name:'foe'}]));
    await vi.advanceTimersByTimeAsync(0); await entered.promise;
    gate.reject(new Error('offline')); await vi.advanceTimersByTimeAsync(0);
    expect(UI.hideOverlay).not.toHaveBeenCalled();
    handlers.flowContinue(); expect(await pending).toBe(false);
    expect(battle.start).not.toHaveBeenCalled(); expect(game.state).toBe('idle');
    expect(UI.log).toHaveBeenCalledWith(expect.stringContaining('战斗模块加载失败'),'warn');
    expect(UI.hideOverlay).toHaveBeenCalledOnce(); error.mockRestore();
  });
  it('replacing a held surface cancels its resource wait immediately and cannot start old battle', async () => {
    const done=vi.fn(), pending=scenes.enterNode('battle',done);
    await vi.advanceTimersByTimeAsync(0); await entered.promise; handlers.flowContinue();
    UI.showOverlay('新页面','<main id="replacement">新页面</main>');
    expect(await pending).toBe(false); gate.resolve(); await Promise.resolve();
    expect(done).not.toHaveBeenCalled(); expect(document.getElementById('replacement')).not.toBeNull();
    expect(UI.hideOverlay).not.toHaveBeenCalled();
  });
  it('class departure starts map warmup under its existing 1600ms curtain', async () => {
    SDT.Battle=battle; SDT.Renderer={warm:vi.fn(async () => true)};
    const {openClassChoice}=await import('../game/src/run/game.run.class-choice.page.js');
    openClassChoice(); handlers.pickClass(); await Promise.resolve(); await Promise.resolve();
    expect(SDT.Renderer.warm).toHaveBeenCalledOnce(); expect(game.state).toBe('modal');
    expect(document.querySelector('.flow-transition')).not.toBeNull();
    handlers.flowContinue(); await Promise.resolve();
  });
});
