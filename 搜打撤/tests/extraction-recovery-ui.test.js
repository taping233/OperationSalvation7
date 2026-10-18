import { beforeEach, expect, it, vi } from 'vitest';

const UIState = vi.hoisted(() => ({ game: {}, activeSlot: 2, acts: {}, overlay: '', saveResult: true, failAfterBase: true, saveGame: null }));

beforeEach(async () => {
  vi.resetModules();
  for (const path of [
    '../game/src/run/game.session.js', '../game/src/core/characters.js', '../game/src/core/shared.js',
    '../game/src/audio/sound.js', '../game/src/hub/game.hub.js', '../game/src/hub/game.cardslib.js',
    '../game/src/core/random.js', '../game/src/battle/battle-loader.js',
    '../game/src/run/game.run.scenes.js', '../game/src/hub/recovery.commands.js',
  ]) vi.doUnmock(path);
  localStorage.clear();
  document.body.innerHTML = '<div id="app"></div>';
  UIState.activeSlot = 2;
  UIState.acts = {};
  UIState.overlay = '';
  UIState.saveResult = true;
  UIState.failAfterBase = true;
  Object.assign(UIState.game, {
    state: 'idle', runActive: true, pendingExtraction: null, extractionPending: false,
    seed: 'extract-ui', hp: 20, maxHp: 30, coins: 5, turn: 3, myClass: 'wu', mode: 'normal', bossKilled: false,
    inventory: [{ name: '木材', count: 2 }, { name: '口粮', count: 1 }],
    ownedCards: [{ card: { id: 'ui-card', name: '界面测试卡', rarity: '古朴' } }],
    usedPocket: [], elapsed: 1, layerIdx: 1, rngState: { seed: 'extract-ui', streams: { pocket: 0 } },
  });

  window.SDT = {
    Icons: { img: () => '', TYPE_ART: {} }, Sound: { music: vi.fn(), sfx: vi.fn(), setDucked: vi.fn() },
    FX: { feedback: vi.fn() }, UI: {
      acts: UIState.acts, log: vi.fn(), refresh: vi.fn(), registerHelp: vi.fn(), helpBtn: () => '',
      showOverlay: (_title, html) => { UIState.overlay = html; document.body.innerHTML = html; },
      hideOverlay: () => { UIState.overlay = ''; document.body.innerHTML = ''; },
      act(name, fn) { UIState.acts[name] = fn; },
    },
    MAP: { rules: { starterSha: 0, playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10,
      bossDeckSize: 10, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6, stashStart: 20, stashMax: 100, stashUpgradeSlots: 5 } },
  };
  await import('../game/src/cards/cards.js');
  await import('../game/src/hub/base.js');
  await import('../game/src/hub/meta.js');
  const { RunStorage } = await import('../game/src/hub/game.storage.js');
  const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');
  const Base = window.SDT.Base;
  Base.use(2);
  Base.reset(2);
  RunStorage.write(2, { seed: 'extract-ui', rngState: UIState.game.rngState, hp: 20, maxHp: 30,
    inventory: UIState.game.inventory, ownedCards: UIState.game.ownedCards, usedPocket: [], myClass: 'wu',
    mode: 'normal', bossKilled: false, turn: 3, coins: 5, elapsed: 1 });
  UIState.saveGame = vi.fn(() => UIState.saveResult && RunStorage.write(2, {
    ...RunStorage.read(2), seed: UIState.game.seed, rngState: UIState.game.rngState,
    hp: UIState.game.hp, maxHp: UIState.game.maxHp, inventory: UIState.game.inventory,
    ownedCards: UIState.game.ownedCards, usedPocket: UIState.game.usedPocket,
    myClass: UIState.game.myClass, mode: UIState.game.mode, bossKilled: UIState.game.bossKilled,
    turn: UIState.game.turn, coins: UIState.game.coins, elapsed: UIState.game.elapsed,
    layerIdx: UIState.game.layerIdx, trackPos: UIState.game.trackPos,
  }));
  const recovery = createRecoveryCommands({ storage: localStorage, lockManager: { request: (_name, _opts, fn) => fn() },
    baseApi: Base, runStore: RunStorage,
    failpoint: phase => { if (UIState.failAfterBase && phase === 'after-base') { UIState.failAfterBase = false; throw new Error('simulated interruption'); } },
  });
  vi.doMock('../game/src/run/game.session.js', () => ({
    MAP: window.SDT.MAP, MODES: { normal: { xpMul: 1 } }, game: UIState.game,
    getActiveSlot: () => UIState.activeSlot, clearSave: vi.fn(), curLayer: () => null, enterLayer: vi.fn(),
    exitToTitle: vi.fn(), newUid: vi.fn(), saveGame: UIState.saveGame, scaledEnemy: vi.fn(), syncPlayTime: vi.fn(),
  }));
  vi.doMock('../game/src/core/characters.js', () => ({ CHARACTERS: [], characterFor: () => ({ id: 'wu' }), characterName: () => '侠客', migrateRunCharacter: value => value }));
  vi.doMock('../game/src/core/shared.js', () => ({ clone: value => structuredClone(value), esc: String, escAttr: String }));
  vi.doMock('../game/src/audio/sound.js', () => ({ tone: vi.fn() }));
  vi.doMock('../game/src/hub/game.hub.js', () => ({ openBaseHub: vi.fn() }));
  vi.doMock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { ding: vi.fn() }, _set_cardPageOpen: vi.fn(), cardHTML: c => c.name }));
  vi.doMock('../game/src/core/random.js', () => ({
    Random: { random: () => 0.1, seed: 'extract-ui', restore: vi.fn() },
    SeededRandomService: class { constructor(seed) { this.state = { seed, streams: { pocket: 0 } }; }
      restore(snapshot) { this.state = snapshot; } random() { return 0.1; } snapshot() { return this.state; } },
  }));
  vi.doMock('../game/src/battle/battle-loader.js', () => ({ ensureBattleReady: vi.fn(), startBattle: vi.fn() }));
  vi.doMock('../game/src/run/game.run.scenes.js', () => ({
    FIRE_RESTORABLE: [], consumeCurrentCell: vi.fn(), finishInstant: vi.fn(), grantEventCard: vi.fn(),
    nodeOpt: (act, label) => `<button data-act="${act}">${label}</button>`,
    nodeShell: ({ body = '', foot = '' }) => window.SDT.UI.showOverlay('', `${body}${foot}`),
    openPocketRestore: vi.fn(), openShop: vi.fn(), preloadAllNodeShellBgs: vi.fn(), showRunTransition: vi.fn(),
  }));
  vi.doMock('../game/src/hub/recovery.commands.js', () => ({
    commitBaseAndRun: (...args) => recovery.commitBaseAndRun(...args),
    readSettlementReceipt: (...args) => recovery.readSettlementReceipt(...args),
    recoverSlot: (...args) => recovery.recoverSlot(...args),
  }));
});

it.each(['exStash', 'exAll', 'exSmart'])('完成事务中断后点击 %s 保留可重试整理页，完成重试可进入结算', async action => {
  UIState.failAfterBase = false;
  const { doExtract } = await import('../game/src/run/game.run.altar.js');
  const { RunStorage } = await import('../game/src/hub/game.storage.js');
  const Base = window.SDT.Base;
  const beforeStash = structuredClone(Base.data.stash);
  expect(await doExtract()).toBe(true);
  const runId = UIState.game.pendingExtraction.runId;
  UIState.failAfterBase = true;
  await UIState.acts.exFinish();
  if (document.querySelector('[data-act=exConfirmFinish]')) await UIState.acts.exConfirmFinish();
  expect(document.querySelector('#exMain')).not.toBeNull();
  expect(localStorage.getItem('sdt-tx-v1-slot2')).not.toBeNull();

  await UIState.acts[action]({ i: 0 });
  expect(UIState.game.pendingExtraction?.runId).toBe(runId);
  expect(document.querySelector('[data-act="exFinish"]')).not.toBeNull();
  expect(window.SDT.UI.log).toHaveBeenLastCalledWith(expect.stringContaining('完成整理'), 'warn');

  await UIState.acts.exFinish();
  if (document.querySelector('[data-act=exConfirmFinish]')) await UIState.acts.exConfirmFinish();
  expect(document.querySelector('[data-act="goBase"]')).not.toBeNull();
  expect(document.querySelector('#exMain')).toBeNull();
  expect(UIState.game.pendingExtraction).toBeNull();
  expect(RunStorage.read(2)).toBeNull();
  expect(Base.data.stash).toEqual(beforeStash);
  expect(Base.data.wood).toBe(2);
  expect(Base.data.stats.extracts).toBe(1);
});

it('doExtract 首次事务中断留在可重试状态，重试恢复后进入整理且资源只入库一次', async () => {
  const { doExtract } = await import('../game/src/run/game.run.altar.js');
  const { RunStorage } = await import('../game/src/hub/game.storage.js');
  const Base = window.SDT.Base;

  expect(await doExtract()).toBe(false);
  expect(UIState.game.pendingExtraction).toBeNull();
  expect(UIState.game.extractionPending).toMatchObject({ slotId: 2 });
  expect(UIState.game.state).toBe('modal');
  expect(UIState.overlay).toContain('extractRetry');
  expect(localStorage.getItem('sdt-tx-v1-slot2')).not.toBeNull();

  await UIState.acts.extractRetry();
  await vi.waitFor(() => expect(document.querySelector('#exMain')).not.toBeNull());
  expect(UIState.saveGame).toHaveBeenCalledTimes(1); // token 已建立，事务重试不能再次普通写盘
  expect(UIState.game.pendingExtraction).toMatchObject({ phase: 'organizing', resources: { wood: 2, rations: 1 } });
  const base = JSON.parse(localStorage.getItem(Base.SLOT_KEY(2)));
  expect(base.wood).toBe(2);
  expect(base.rations).toBe(1);
  expect(base.stats.extracts).toBe(1);
  const baseRaw = localStorage.getItem(Base.SLOT_KEY(2));
  const runRaw = localStorage.getItem(RunStorage.key(2));
  expect(await doExtract()).toBe(false);
  expect(localStorage.getItem(Base.SLOT_KEY(2))).toBe(baseRaw);
  expect(localStorage.getItem(RunStorage.key(2))).toBe(runRaw);
});

it('撤离前预存失败不启动事务，重试成功后只提交同一份新快照', async () => {
  const { doExtract } = await import('../game/src/run/game.run.altar.js');
  const { RunStorage } = await import('../game/src/hub/game.storage.js');
  const Base = window.SDT.Base;
  const beforeBase = localStorage.getItem(Base.SLOT_KEY(2));
  const beforeRun = localStorage.getItem(RunStorage.key(2));
  UIState.game.trackPos = 2;
  UIState.game.ownedCards.push({ card: { id: 'new-card', name: '新拾取', rarity: '古朴' } });
  UIState.saveResult = false;
  UIState.failAfterBase = false;

  expect(await doExtract()).toBe(false);
  expect(UIState.game.extractionPending).toBe(false);
  expect(localStorage.getItem('sdt-tx-v1-slot2')).toBeNull();
  expect(localStorage.getItem(Base.SLOT_KEY(2))).toBe(beforeBase);
  expect(localStorage.getItem(RunStorage.key(2))).toBe(beforeRun);
  expect(UIState.overlay).toContain('撤离前的进度未保存');
  expect(UIState.overlay).not.toContain('撤离前的局面已保存');

  UIState.saveResult = true;
  await UIState.acts.extractRetry();
  await vi.waitFor(() => expect(document.querySelector('#exMain')).not.toBeNull());
  expect(UIState.saveGame).toHaveBeenCalledTimes(2);
  expect(UIState.game.pendingExtraction.remainingCards.map(stack => stack.card.id)).toContain('new-card');
  expect(RunStorage.read(2)).toMatchObject({ trackPos: 2 });
  expect(RunStorage.read(2).ownedCards.map(entry => entry.card.id)).toContain('new-card');
  expect(JSON.parse(localStorage.getItem(Base.SLOT_KEY(2))).stats.extracts).toBe(1);
});
