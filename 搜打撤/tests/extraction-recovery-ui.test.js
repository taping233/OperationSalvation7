import { beforeEach, expect, it, vi } from 'vitest';

const UIState = vi.hoisted(() => ({ game: {}, activeSlot: 2, acts: {}, overlay: '' }));

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  document.body.innerHTML = '<div id="app"></div>';
  UIState.activeSlot = 2;
  UIState.acts = {};
  UIState.overlay = '';
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
  await import('../game/src/cards.js');
  await import('../game/src/base.js');
  await import('../game/src/meta.js');
  const { RunStorage } = await import('../game/src/game.storage.js');
  const { createRecoveryCommands } = await import('../game/src/recovery.commands.js');
  const Base = window.SDT.Base;
  Base.use(2);
  Base.reset(2);
  RunStorage.write(2, { seed: 'extract-ui', rngState: UIState.game.rngState, hp: 20, maxHp: 30,
    inventory: UIState.game.inventory, ownedCards: UIState.game.ownedCards, usedPocket: [], myClass: 'wu',
    mode: 'normal', bossKilled: false, turn: 3, coins: 5, elapsed: 1 });
  let shouldFail = true;
  const recovery = createRecoveryCommands({ storage: localStorage, lockManager: { request: (_name, _opts, fn) => fn() },
    baseApi: Base, runStore: RunStorage,
    failpoint: phase => { if (shouldFail && phase === 'after-base') { shouldFail = false; throw new Error('simulated interruption'); } },
  });
  vi.doMock('../game/src/game.session.js', () => ({
    MAP: window.SDT.MAP, MODES: { normal: { xpMul: 1 } }, game: UIState.game,
    getActiveSlot: () => UIState.activeSlot, clearSave: vi.fn(), curLayer: () => null, enterLayer: vi.fn(),
    exitToTitle: vi.fn(), newUid: vi.fn(), saveGame: vi.fn(), scaledEnemy: vi.fn(), syncPlayTime: vi.fn(),
  }));
  vi.doMock('../game/src/characters.js', () => ({ CHARACTERS: [], characterFor: () => ({ id: 'wu' }), characterName: () => '侠客' }));
  vi.doMock('../game/src/shared.js', () => ({ esc: String, escAttr: String }));
  vi.doMock('../game/src/sound.js', () => ({ tone: vi.fn() }));
  vi.doMock('../game/src/game.hub.js', () => ({ openBaseHub: vi.fn() }));
  vi.doMock('../game/src/game.cardslib.js', () => ({ Sfx: { ding: vi.fn() }, _set_cardPageOpen: vi.fn(), cardHTML: c => c.name }));
  vi.doMock('../game/src/random.js', () => ({
    Random: { random: () => 0.1, seed: 'extract-ui', restore: vi.fn() },
    SeededRandomService: class { constructor(seed) { this.state = { seed, streams: { pocket: 0 } }; }
      restore(snapshot) { this.state = snapshot; } random() { return 0.1; } snapshot() { return this.state; } },
  }));
  vi.doMock('../game/src/battle-loader.js', () => ({ ensureBattleReady: vi.fn(), startBattle: vi.fn() }));
  vi.doMock('../game/src/game.run.scenes.js', () => ({
    FIRE_RESTORABLE: [], consumeCurrentCell: vi.fn(), finishInstant: vi.fn(), grantEventCard: vi.fn(),
    nodeOpt: (act, label) => `<button data-act="${act}">${label}</button>`,
    nodeShell: ({ body = '', foot = '' }) => window.SDT.UI.showOverlay('', `${body}${foot}`),
    openPocketRestore: vi.fn(), openShop: vi.fn(), preloadAllNodeShellBgs: vi.fn(), showRunTransition: vi.fn(),
  }));
  vi.doMock('../game/src/recovery.commands.js', () => ({
    commitBaseAndRun: (...args) => recovery.commitBaseAndRun(...args),
    readSettlementReceipt: (...args) => recovery.readSettlementReceipt(...args),
    recoverSlot: (...args) => recovery.recoverSlot(...args),
  }));
});

it('doExtract 首次事务中断留在可重试状态，重试恢复后进入整理且资源只入库一次', async () => {
  const { doExtract } = await import('../game/src/game.run.altar.js');
  const { RunStorage } = await import('../game/src/game.storage.js');
  const Base = window.SDT.Base;

  expect(await doExtract()).toBe(false);
  expect(UIState.game.pendingExtraction).toBeNull();
  expect(UIState.game.extractionPending).toMatchObject({ slotId: 2 });
  expect(UIState.game.state).toBe('modal');
  expect(UIState.overlay).toContain('extractRetry');
  expect(localStorage.getItem('sdt-tx-v1-slot2')).not.toBeNull();

  await UIState.acts.extractRetry();
  await vi.waitFor(() => expect(document.querySelector('#exMain')).not.toBeNull());
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
