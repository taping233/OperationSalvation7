import { beforeEach, expect, it, vi } from 'vitest';

const altarState = vi.hoisted(() => ({ game: {}, random: vi.fn(() => 0) }));

vi.mock('../game/src/game.session.js', () => ({
  MAP: { rules: { starterSha: 0, stashUpgradeWood: 1, stashUpgradeSlots: 1 } },
  MODES: {}, game: altarState.game, getActiveSlot: () => null,
  clearSave: vi.fn(), curLayer: () => ({ logical: [{ def: { type: altarState.game.layerIdx === 2 ? 'emergencyExit' : 'exit' } }] }),
  enterLayer: vi.fn(), exitToTitle: vi.fn(), newUid: vi.fn(), saveGame: vi.fn(),
  scaledEnemy: vi.fn(), syncPlayTime: vi.fn(),
}));
vi.mock('../game/src/characters.js', () => ({ CHARACTERS: [], characterFor: () => null, characterName: () => '' }));
vi.mock('../game/src/shared.js', () => ({ esc: String, escAttr: String }));
vi.mock('../game/src/sound.js', () => ({ tone: vi.fn() }));
vi.mock('../game/src/game.hub.js', () => ({ openBaseHub: (...args) => altarState.openBaseHub(...args) }));
vi.mock('../game/src/game.cardslib.js', () => ({ Sfx: { tick: vi.fn(), ding: vi.fn() }, _set_cardPageOpen: vi.fn(), cardHTML: c => c.name }));
vi.mock('../game/src/random.js', () => ({
  Random: { random: altarState.random, seed: 1, restore: vi.fn() },
  SeededRandomService: class {
    constructor(seed) { this.state = { seed }; }
    restore(state) { this.state = state; }
    random() { return altarState.random(); }
    snapshot() { return this.state; }
  },
}));
vi.mock('../game/src/battle-loader.js', () => ({ ensureBattleReady: vi.fn(), startBattle: vi.fn() }));
vi.mock('../game/src/game.run.scenes.js', () => ({
  FIRE_RESTORABLE: [], consumeCurrentCell: vi.fn(), finishInstant: vi.fn(), grantEventCard: vi.fn(),
  nodeOpt: (act, label) => `<button data-act="${act}">${label}</button>`,
  nodeShell: ({ body = '', foot = '' }) => window.SDT.UI.showOverlay('', `${body}${foot}`),
  openPocketRestore: vi.fn(), openShop: vi.fn(), preloadAllNodeShellBgs: vi.fn(), showRunTransition: vi.fn(),
}));
vi.mock('../game/src/game.nest.js', () => ({ unlockNest: vi.fn() }));
vi.mock('../game/src/game.storage.js', () => ({ RunStorage: {} }));
vi.mock('../game/src/recovery.commands.js', () => ({ commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn() }));

let game, UI, base, openEmergencyModal, openBaseHub;
let stashLimit = 0;
beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = '<div id="body"></div>';
  const nextGame = {
    state: 'idle', layerIdx: 2, trackPos: 0,
    ownedCards: Array.from({ length: 4 }, (_, i) => ({ uid: String(i), card: { id: String(i), name: `卡${i}` } })),
    inventory: [], usedPocket: [], turn: 1, elapsed: 0, hp: 20, maxHp: 30, coins: 0,
    runActive: true, pendingExtraction: null, bossKilled: false, myClass: null, mode: 'normal',
  };
  Object.assign(altarState.game, nextGame);
  game = altarState.game;
  openBaseHub = vi.fn(() => { game.state = 'modal'; });
  altarState.openBaseHub = openBaseHub;
  UI = {
    acts: {}, showOverlay: (_title, html) => { document.getElementById('body').innerHTML = html; },
    hideOverlay: () => { UI.acts = {}; }, act: (name, fn) => { UI.acts[name] = fn; },
    log: vi.fn(), refresh: vi.fn(), registerHelp: vi.fn(), helpBtn: () => '',
  };
  base = {
    data: { _m01: { revision: 0 }, wood: 0, rations: 0, pocket: [], stash: [], nestUnlocked: false,
      coins: 0, collection: {}, stats: { extracts: 0, bestRunCoins: 0, stashTotal: 0 } },
    deposit: vi.fn(), depositCards: vi.fn(), isSha: () => false,
    stashRoom: () => Math.max(0, stashLimit - base.data.stash.reduce((n, stack) => n + stack.count, 0)),
    stashUsed: () => base.data.stash.reduce((n, stack) => n + stack.count, 0), stashCap: () => stashLimit,
  };
  stashLimit = 0;
  window.SDT = {
    UI, Base: base, Sound: { sfx: vi.fn(), music: vi.fn() },
    Cards: { cardHTML: c => c.name, sellPrice: () => 1 }, Meta: { track: vi.fn(), addXpToProgress: x => ({ after: x }) },
  };
  ({ openEmergencyModal } = await import('../game/src/game.run.altar.js'));
});

it('三张献祭完成后到达整理页，仓库满仍能完成整理并回基地', async () => {
  openEmergencyModal();
  await UI.acts.payExit();
  for (const uid of ['0', '1', '2']) UI.acts.sacPick({ uid });
  await UI.acts.sacConfirm();
  await vi.waitFor(() => expect(document.querySelector('[data-act="exFinish"]')).not.toBeNull());
  expect(game.ownedCards.map(o => o.uid)).toEqual(['3']);
  expect(game.state).toBe('done');
  expect(base.data.stats.extracts).toBe(1);
  expect(base.data.stash).toEqual([]);
  const pendingBeforeSmart = JSON.stringify(game.pendingExtraction);
  await UI.acts.exSmart();
  expect(JSON.stringify(game.pendingExtraction)).toBe(pendingBeforeSmart);
  expect(document.querySelector('[data-act="exFinish"]')).not.toBeNull();
  await UI.acts.exFinish();
  expect(document.querySelector('[data-act="goBase"]')).not.toBeNull();
  UI.acts.goBase();
  expect(openBaseHub).toHaveBeenCalledOnce();
  expect(game.state).toBe('modal');
});

it('取消献祭回到撤离点，继续深入恢复地图状态且不丢卡', async () => {
  openEmergencyModal();
  await UI.acts.payExit();
  UI.acts.sacPick({ uid: '0' });
  UI.acts.sacCancel();
  UI.acts.stayHere();
  expect(game.state).toBe('idle');
  expect(game.ownedCards).toHaveLength(4);
});

it('非零部分仓容只入库可容纳数量，余卡仍留在整理列表', async () => {
  stashLimit = 1;
  game.layerIdx = 3;
  game.bossKilled = true;
  game.ownedCards = [0, 1, 2].map(uid => ({ uid: String(uid), card: { id: 'dup', name: '重复卡' } }));
  openEmergencyModal();
  await UI.acts.payExit();
  await vi.waitFor(() => expect(document.querySelectorAll('.ext-card')).toHaveLength(1));
  await UI.acts.exStash({ i: 0 });

  expect(base.data.stash).toEqual([{ card: { id: 'dup', name: '重复卡' }, count: 1 }]);
  expect(game.pendingExtraction.remainingCards).toEqual([{ card: { id: 'dup', name: '重复卡' }, count: 2 }]);
  expect(document.querySelector('.ext-card')).not.toBeNull();
  expect(document.querySelector('.ext-card').textContent).toContain('×2');
});
