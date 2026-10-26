import { extractionMocks } from './helpers/environment-fixtures.js';
import { beforeEach, expect, it, vi } from 'vitest';

const altarState = vi.hoisted(() => ({ game: {}, random: vi.fn(() => 0) }));

vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { rules: { starterSha: 0, stashUpgradeWood: 1, stashUpgradeSlots: 1 } },
  MODES: {}, game: altarState.game, getActiveSlot: () => altarState.slot ?? null,
  clearSave: vi.fn(), curLayer: () => ({ logical: [{ def: { type: altarState.game.layerIdx === 2 ? 'emergencyExit' : 'exit' } }] }),
  enterLayer: vi.fn(), exitToTitle: vi.fn(), newUid: vi.fn(), saveGame: vi.fn(),
  scaledEnemy: vi.fn(), syncPlayTime: vi.fn(),
}));
vi.mock('../game/src/core/characters.js', () => ({ CHARACTERS: [], characterFor: () => null, characterName: () => '' }));
vi.mock('../game/src/core/shared.js', () => ({ clone: value => (value == null ? value : JSON.parse(JSON.stringify(value))), esc: String, escAttr: value => String(value).replaceAll('"', '&quot;') }));
vi.mock('../game/src/audio/sound.js', () => ({ tone: vi.fn() }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub: (...args) => altarState.openBaseHub(...args) }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick: vi.fn(), ding: vi.fn() }, _set_cardPageOpen: vi.fn(), cardHTML: c => c.name }));
vi.mock('../game/src/core/random.js', () => ({
  Random: { random: altarState.random, seed: 1, restore: vi.fn() },
  SeededRandomService: class {
    constructor(seed) { this.state = { seed }; }
    restore(state) { this.state = state; }
    random() { return altarState.random(); }
    snapshot() { return this.state; }
  },
}));
vi.mock('../game/src/battle/battle-loader.js', async importOriginal => ({ ...await importOriginal(), ensureBattleReady: vi.fn(), startBattle: vi.fn() }));
vi.mock('../game/src/run/game.run.scenes.js', () => ({
  ...extractionMocks(() => vi),
}));
vi.mock('../game/src/run/game.nest.js', () => ({ unlockNest: vi.fn() }));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: {} }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn() }));

let game, UI, base, openEmergencyModal, openBaseHub;
let stashLimit = 0;
beforeEach(async () => {
  altarState.slot = null;
  vi.resetModules();
  document.body.innerHTML = '<div id="overlay"><div id="body"></div></div>';
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
    el: { overlay: document.getElementById('overlay'), ovBody: document.getElementById('body') },
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
    Icons: { rich: html => html }, Cards: { cardHTML: c => c.name, sellPrice: () => 1 }, Meta: { track: vi.fn(), addXpToProgress: x => ({ after: x }) },
  };
  ({ openEmergencyModal } = await import('../game/src/run/game.run.altar.js'));
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
  if (document.querySelector('[data-act=exConfirmFinish]')) await UI.acts.exConfirmFinish();
  expect(document.querySelector('[data-act="goBase"]')).not.toBeNull();
  expect(document.querySelectorAll('[data-act=goBase]')).toHaveLength(1);
  expect(document.querySelector('[data-act=again]')).toBeNull();
  expect(document.querySelector('[data-act=goBase]').textContent).toContain('返回基地');
  UI.acts.goBase();
  expect(openBaseHub).toHaveBeenCalledOnce();
  expect(game.state).toBe('modal');
});

it('取消献祭回到撤离点，继续深入恢复地图状态且不丢卡', async () => {
  openEmergencyModal();
  await UI.acts.payExit();
  UI.acts.sacPick({ uid: '0' });
  UI.acts.sacCancel();
  await UI.acts.stayHere();
  expect(game.state).toBe('idle');
  expect(game.ownedCards).toHaveLength(4);
});

it.each([[1,3],[2,5]])('部分仓容 %i / 同叠 %i 显示可入数量，余卡仍留在整理列表', async (room,count) => {
  stashLimit = room;
  game.layerIdx = 3;
  game.bossKilled = true;
  game.ownedCards = Array.from({length:count},(_,i)=>i).map(uid => ({ uid: String(uid), card: { id: 'dup', name: '重复卡' } }));
  openEmergencyModal();
  await UI.acts.payExit();
  await vi.waitFor(() => expect(document.querySelectorAll('.ext-card')).toHaveLength(1));
  const before=document.querySelector('.ext-card');
  expect(before.classList.contains('off')).toBe(false);
  expect(before.getAttribute('aria-disabled')).toBe('false');
  expect(before.textContent).toContain(`入库 ${room}/${count} 张`);
  expect(before.getAttribute('aria-label')).toContain(`可入库 ${room}/${count} 张`);
  await UI.acts.exStash({ i: 0 });

  expect(base.data.stash).toEqual([{ card: { id: 'dup', name: '重复卡' }, count: room }]);
  expect(game.pendingExtraction.remainingCards).toEqual([{ card: { id: 'dup', name: '重复卡' }, count: count-room }]);
  expect(document.querySelector('.ext-card')).not.toBeNull();
  expect(document.querySelector('.ext-card').closest('.exr-item').textContent).toContain(`×${count-room}`);
  expect(document.querySelector('.ext-card').textContent).toContain('仓库已满');
  expect(document.querySelector('.ext-card').classList.contains('off')).toBe(true);
  expect(document.querySelector('.ext-card').getAttribute('aria-disabled')).toBe('true');
});

it('card details never deposit; rarity display order preserves source indices and the next action', async () => {
  stashLimit = 1;
  game.layerIdx = 3; game.bossKilled = true;
  game.ownedCards = [{uid:'c',card:{id:'common',name:'高价值古朴',rarity:'古朴',value:10}},
    {uid:'r',card:{id:'rare',name:'低价值传说',rarity:'传说',value:1}}];
  window.SDT.Cards.sellPrice = c => c.value;
  UI.showCardZoom = vi.fn();
  openEmergencyModal(); await UI.acts.payExit();
  const before = JSON.stringify({pending:game.pendingExtraction,base:base.data});
  const preview = document.querySelector('[data-act=exInspect]');
  expect(preview.dataset.i).toBe('1');
  UI.acts.exInspect(preview.dataset);
  expect(UI.showCardZoom).toHaveBeenCalledWith(game.ownedCards[1].card, {hideNote:true,presentation:'expedition'});
  expect(JSON.stringify({pending:game.pendingExtraction,base:base.data})).toBe(before);
  await UI.acts.exAll(); // A stale/synthetic all-in call must not perform a partial action under that label.
  expect(base.data.stash).toEqual([]);
  const oldInspect = UI.acts.exInspect;
  await UI.acts.exSmart();
  expect(base.data.stash.map(s=>s.card.id)).toEqual(['common']); // Price priority is unchanged.
  expect(document.querySelector('.exr-notice').textContent).toContain('已入库 1 张');
  oldInspect({i:0});
  expect(UI.showCardZoom).toHaveBeenCalledTimes(1); // No stale page action after refresh.
  UI.acts.exSavedInspect({i:0});
  expect(UI.showCardZoom).toHaveBeenCalledTimes(2);
  UI.el.overlay.hidden = true;
  UI.acts.exSavedInspect({i:0});
  expect(UI.showCardZoom).toHaveBeenCalledTimes(2);
  UI.el.overlay.hidden = false;
  await UI.acts.exFinish();
  if (document.querySelector('[data-act=exConfirmFinish]')) await UI.acts.exConfirmFinish();
  UI.acts.exDoneInspect({i:0});
  expect(UI.showCardZoom).toHaveBeenCalledTimes(3);
  UI.el.overlay.hidden = true;
  UI.acts.exDoneInspect({i:0});
  expect(UI.showCardZoom).toHaveBeenCalledTimes(3);
});

it('saving blocks duplicate actions without consuming a second stack', async () => {
  stashLimit = 3; game.layerIdx = 3; game.bossKilled = true;
  game.ownedCards = [{uid:'a',card:{id:'a',name:'卡A'}},{uid:'b',card:{id:'b',name:'卡B'}}];
  openEmergencyModal(); await UI.acts.payExit();
  const stash = UI.acts.exStash;
  const first=stash({i:0}),second=stash({i:1});
  expect(document.querySelector('#exMain').getAttribute('aria-busy')).toBe('true');
  await Promise.all([first,second]);
  expect(base.data.stash.map(s=>s.card.name)).toEqual(['卡A']);
  expect(game.pendingExtraction.remainingCards).toEqual([{card:{id:'b',name:'卡B'},count:1}]);
});


it('remaining-card confirmation lists losses, focuses cancel and cancels without mutations', async () => {
  game.layerIdx = 3; game.bossKilled = true;
  openEmergencyModal(); await UI.acts.payExit();
  const before = JSON.stringify({ pending: game.pendingExtraction, base: base.data });
  await UI.acts.exFinish();
  expect(document.querySelector('.exr-confirm-list').textContent).toContain(game.pendingExtraction.remainingCards[0].card.name);
  expect(document.querySelector('.exr-confirm').textContent).toContain('永久散失');
  expect(document.activeElement.dataset.act).toBe('exCancelFinish');
  const oldConfirm = UI.acts.exConfirmFinish;
  UI.acts.exCancelFinish();
  expect(JSON.stringify({ pending: game.pendingExtraction, base: base.data })).toBe(before);
  await oldConfirm();
  expect(game.pendingExtraction).not.toBeNull();
  expect(document.querySelector('[data-act=goBase]')).toBeNull();
});

it.each(['count', 'name', 'id', 'sequence', 'run', 'slot', 'surface'])('confirmation refuses changed %s', async change => {
  game.layerIdx = 3; game.bossKilled = true;
  openEmergencyModal(); await UI.acts.payExit();
  await UI.acts.exFinish();
  const confirm = UI.acts.exConfirmFinish;
  const pending = game.pendingExtraction;
  if (change === 'count') pending.remainingCards[0].count++;
  if (change === 'name') pending.remainingCards[0].card.name += '新';
  if (change === 'id') pending.remainingCards[0].card.id += '-new';
  if (change === 'sequence') pending.requestSeq++;
  if (change === 'run') pending.runId += '-new';
  if (change === 'slot') altarState.slot = 3;
  if (change === 'surface') document.querySelector('#exMain').remove();
  const before = JSON.stringify({ pending, base: base.data });
  await confirm();
  expect(JSON.stringify({ pending: game.pendingExtraction, base: base.data })).toBe(before);
  expect(game.runActive).toBe(true);
  expect(document.querySelector('[data-act=goBase]')).toBeNull();
});

it('zero remaining finishes directly without a confirmation', async () => {
  stashLimit = 9; game.layerIdx = 3; game.bossKilled = true;
  openEmergencyModal(); await UI.acts.payExit();
  await UI.acts.exAll();
  await UI.acts.exFinish();
  expect(document.querySelector('[data-act=exConfirmFinish]')).toBeNull();
  expect(document.querySelector('[data-act=goBase]')).not.toBeNull();
});

it('equal estimates keep original backpack order even when rarity display differs', async () => {
  stashLimit = 1; game.layerIdx = 3; game.bossKilled = true;
  game.ownedCards = [{ uid: 'a', card: { id: 'a', name: '原序首卡', rarity: '古朴', value: 3, sellable: false } },
    { uid: 'b', card: { id: 'b', name: '后序传说', rarity: '传说', value: 3 } }];
  window.SDT.Cards.sellPrice = c => c.value;
  openEmergencyModal(); await UI.acts.payExit();
  await UI.acts.exSmart();
  expect(base.data.stash[0].card.id).toBe('a');
  await UI.acts.exFinish();
  const confirm = UI.acts.exConfirmFinish;
  await Promise.all([confirm(), confirm()]);
  expect(game.pendingExtraction).toBeNull();
  expect(base.data.stash[0].card.id).toBe('a');
});

it.each(['slot', 'pending'])('撤离帮助返回拒绝旧%s，并保留完成确认状态', async change => {
  game.layerIdx = 3; game.bossKilled = true;
  openEmergencyModal(); await UI.acts.payExit();
  await vi.waitFor(() => expect(document.querySelector('[data-act=exFinish]')).not.toBeNull());
  await UI.acts.exFinish();
  expect(document.querySelector('[data-act=exConfirmFinish]')).not.toBeNull();
  const help = UI.registerHelp.mock.calls.at(-1)[1];
  help.back();
  expect(document.querySelector('[data-act=exConfirmFinish]')).not.toBeNull();
  const currentHelp = UI.registerHelp.mock.calls.at(-1)[1];
  if (change === 'slot') altarState.slot = 2;
  else game.pendingExtraction = {...game.pendingExtraction};
  const current = UI.el.ovBody.firstElementChild;
  currentHelp.back();
  expect(UI.el.ovBody.firstElementChild).toBe(current);
});
