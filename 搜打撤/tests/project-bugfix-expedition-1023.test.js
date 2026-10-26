/* 2026-10-23 远征缺陷修复回归。复用 SYS03 夹具并控制保存与授予故障。 */
import { beforeEach, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  game: {},
  saves: [],
  consumed: 0, save:() => true,
  curLayer: { logical: [{ def: { type: 'altar' } }] },
  bagCapN: 10,
}));

vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { rules: { fireHeal: 10, fireClassCardChance: 0 } },
  MODES: {},
  bagCap: () => st.bagCapN,
  curLayer: () => st.curLayer,
  enterLayer: vi.fn(), exitToTitle: vi.fn(),
  game: st.game,
  getActiveSlot: () => null,
  newUid: (() => { let n = 0; return () => 'uid-' + (n++); })(),
  saveGame: (...args) => { st.saves.push(args); return st.save(); },
  scaledEnemy: x => x,
  pick: xs => xs[0],
  usedSlots: () => st.game.ownedCards.length,
}));
vi.mock('../game/src/core/characters.js', () => ({ CHARACTERS: [], characterFor: () => null, characterName: () => '' }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub: vi.fn() }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick: vi.fn(), ding: vi.fn() }, _set_cardPageOpen: vi.fn(), cardHTML: c => c.name }));
vi.mock('../game/src/battle/battle-loader.js', async importOriginal => ({ ...await importOriginal(), captureBattleContext: () => () => true, ensureBattleReady: vi.fn(), startBattle: vi.fn() }));
vi.mock('../game/src/run/game.run.data.js', () => ({
  IMMEDIATE_SCENES: {}, NODE_BG: { fire: 'scene-fire-bg', altar: 'scene-altar-bg', event: 'scene-event' },
  PICKUP_BG: {}, PRELOAD_SCENES: [], SCENES: { coin:{ icon:'', title:'硬币', lines:['风雪里的零钱'] } },
}));
vi.mock('../game/src/run/game.nest.js', () => ({ unlockNest: vi.fn() }));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: {} }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn() }));

let UI, acts;
function makeGame() {
  return {
    state: 'idle', layerIdx: 0, trackPos: 0, turn: 1, mode: 'normal', myClass: 'wu',
    hp: 20, maxHp: 30, coins: 0, fragments: 0, visited: {},
    ownedCards: [], usedPocket: [], inventory: [],
    // 祭坛/火堆运行期标记：原地 assign 复用同一 game 对象时必须显式复位，
    // 否则上一用例的激活/上锁状态会泄漏到下一用例
    altarActivated: undefined, altarItemSacrificed: undefined, altarRewardPending: undefined,
    bossKilled: false, _fireRestKey: undefined, nodeRewards: {},
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    bagCap: () => st.bagCapN,
    usedSlots() { return this.ownedCards.length; },
    canReceiveCard(card) {
      if (this.__canReceive) return this.__canReceive(card);
      // 简化口径：新卡名需空格，本测试用 ownedCards.length 直接控满包；同名并入恒可收
      const owned = this.ownedCards.filter(o => o.card.name === card.name).length;
      return owned > 0 ? true : this.ownedCards.length < this.bagCap();
    },
  };
}

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = '<div id="body"></div>';
  // mock 工厂在首次执行时捕获 st.game 引用且 resetModules 不重跑工厂——
  // 必须原地 Object.assign 复用同一对象（extraction-flow.test.js 同款），不得换新实例
  // 先清掉上一用例动态添加的领奖/补给状态，避免失败中断后污染后续地图投影。
  for (const key of Object.keys(st.game)) delete st.game[key];
  Object.assign(st.game, makeGame());
  st.saves = []; st.save = () => true;
  st.curLayer = { logical: [{ def: { type: 'altar' } }] };
  st.bagCapN = 10;
  acts = {};
  UI = {
    el: { ovBody:document.getElementById('body') },
    showOverlay: (_t, html) => { document.getElementById('body').innerHTML = html; },
    hideOverlay: () => { document.getElementById('body').innerHTML = ''; },
    act: (name, fn) => { acts[name] = fn; },
    refresh: vi.fn(), log: vi.fn(), registerHelp: vi.fn(), helpBtn: () => '',
    showCardReward: vi.fn(), showCardZoom:vi.fn(),
  };
  window.SDT = {
    UI,
    Sound: { sfx: vi.fn(), scene: vi.fn() },
    Icons: { rich: x => x },
    Meta: { addXpToProgress: x => ({ after: x }), track: vi.fn() },
    Cards: {
      all: () => [
        { id: 'lg1', name: '传说甲', rarity: '传说', type: '法术' },
        { id: 'eq1', name: '装备甲', rarity: '史诗', type: '装备' },
      ],
      classPool: () => [{ id: 'ab1', name: '能力甲', rarity: '职业', type: '能力卡' }],
      isRandomObtainable: () => true,
      randomClassCard: () => null,
      cardHTML: c => c.name,
      sellPrice: () => 1,
    },
    MAP: { chestKinds:{ small:{ name:'小型物资箱' } } },
    Base: { isSha: () => false, bagCap:() => st.bagCapN },
    Motion: undefined,
  };
});

async function importAltar() {
  const scenes = await import('../game/src/run/game.run.scenes.js');
  st.game.grantCard = scenes.grantEventCard;
  await import('../game/src/run/chests.js');
  const altar = await import('../game/src/run/game.run.altar.js');
  return altar;
}
async function importScenes() {
  return import('../game/src/run/game.run.scenes.js');
}

const flush = async () => { for (let i=0;i<15;i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve=r; }); return { promise, resolve }; };

it('E1: entry opening late save preserves the new run page', async () => {
  st.game.entrySupply = { version:1, layerIdx:0, trackPos:0, cardIds:['lg1'], taken:[] };
  const { openEntrySupply } = await importAltar();
  const gate = deferred(); st.save = () => gate.promise;
  const opening = openEntrySupply();
  st.game.entrySupply = { version:1, layerIdx:0, trackPos:0, cardIds:['eq1'], taken:[] };
  st.game.discoveredPairs = new Set(); st.game.state = 'title';
  UI.showOverlay('', '<main id="new-run-page">new run title</main>');
  gate.resolve(true); await opening;
  expect(document.getElementById('new-run-page')?.textContent).toBe('new run title');
  expect(document.querySelector('.entry-supply-strips')).toBeNull();
  expect(st.game.state).toBe('title');
});

it('E1: entry claiming late save preserves the title page after run switch', async () => {
  st.game.entrySupply = { version:1, layerIdx:0, trackPos:0, cardIds:['lg1'], taken:[] };
  const { openEntrySupply } = await importAltar();
  await openEntrySupply();
  const gate = deferred(); st.save = () => gate.promise;
  acts.entrySupplyTake({ i:'0' });
  expect(st.game.ownedCards).toHaveLength(1);
  st.game.entrySupply = { version:1, layerIdx:0, trackPos:0, cardIds:['eq1'], taken:[] };
  st.game.discoveredPairs = new Set(); st.game.state = 'title';
  UI.showOverlay('', '<main id="new-run-page">new run title</main>');
  gate.resolve(true); await flush();
  expect(document.getElementById('new-run-page')?.textContent).toBe('new run title');
  expect(document.querySelector('.entry-supply-strips')).toBeNull();
  expect(st.game.entrySupply.taken).toEqual([]);
});

it('E2: pending fire heal save preserves another same-run modal page', async () => {
  const { openFireRest } = await importAltar();
  st.game.discoveredPairs = new Set();
  openFireRest();
  const gate = deferred(); st.save = () => gate.promise;
  acts.fireHeal();
  UI.showOverlay('', '<main id="replacement-page">settings</main>');
  gate.resolve(true); await flush();
  expect(document.getElementById('replacement-page')?.textContent).toBe('settings');
  expect(document.querySelector('[data-act="fireDone"]')).toBeNull();
});

it('E2: pending fire leave does not close a replacement page', async () => {
  const { openFireRest } = await importAltar(); const done=vi.fn();
  openFireRest(done); const gate=deferred(); st.save=()=>gate.promise;
  const leaving=acts.fireDone(); UI.showOverlay('', '<main id="replacement-page">settings</main>');
  gate.resolve(true); await leaving;
  expect(document.getElementById('replacement-page')?.textContent).toBe('settings');
  expect(done).not.toHaveBeenCalled();
});

it('营火回血演出中连点和退出不重复结算，演出结束才开放下一操作', async () => {
  vi.useFakeTimers();
  try {
    const { openFireRest } = await importAltar(); const done = vi.fn();
    openFireRest(done); document.querySelector('.sc-fire').animate = vi.fn();
    const healing = acts.fireHeal(); await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('.fire-rest-feedback.is-heal')).not.toBeNull();
    expect(st.game.hp).toBe(30);
    await acts.fireHeal(); await acts.fireRestore(); await acts.fireDone();
    expect(st.saves).toHaveLength(1); expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500); await healing;
    expect(document.querySelector('.fire-rest-feedback')).toBeNull();
    expect(document.querySelector('[data-act="fireHeal"]').disabled).toBe(true);
    await acts.fireDone(); expect(done).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});

it('营火复原演出用消耗区实际卡，切页后迟到完成不重绘旧营火', async () => {
  vi.useFakeTimers();
  try {
    const { openFireRest } = await importAltar();
    const card = { id:'variant-missing-from-catalog', name:'强化过的旧牌', type:'武术', desc:'强化快照' };
    st.game.usedPocket = [{ card, count:2 }];
    openFireRest(); document.querySelector('.sc-fire').animate = vi.fn();
    const restoring = acts.fireRestore(); await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelectorAll('.fire-rest-reveal-card')).toHaveLength(2);
    expect(document.querySelector('.fire-rest-feedback').textContent).toContain(card.name);
    expect(st.game.ownedCards).toHaveLength(2); expect(st.game.usedPocket).toHaveLength(0);
    expect(window.SDT.Sound.sfx).toHaveBeenCalledWith('cardRestore');
    UI.showOverlay('', '<main id="replacement-page">settings</main>');
    await flush(); await restoring;
    expect(document.getElementById('replacement-page')?.textContent).toBe('settings');
    expect(document.querySelector('.sc-fire')).toBeNull();
  } finally { vi.useRealTimers(); }
});

it('entry and fire accept retry after rejected checkpoint Promise', async () => {
  st.game.entrySupply={version:1,layerIdx:0,trackPos:0,cardIds:['lg1'],taken:[]};
  const {openEntrySupply,openFireRest}=await importAltar();
  st.save=()=>Promise.reject(new Error('storage'));
  await openEntrySupply(); expect(document.querySelector('.entry-save-warning')).not.toBeNull();
  st.save=()=>true; await acts.entrySupplyTake({i:0}); expect(st.game.ownedCards).toHaveLength(1);
  openFireRest(); st.save=()=>Promise.reject(new Error('storage')); await acts.fireHeal();
  expect(document.body.textContent).toContain('进度未保存');
  st.save=()=>true; await acts.fireDone(); expect(st.game.state).toBe('idle');
});

it('E3: altar preserves pending reward after failed reward admission', async () => {
  const { openAltarRitual } = await importAltar();
  st.game.altarActivated = true; st.game.altarRewardPending = true;
  const { default:facade } = await import('../game/src/core/sdt-facade.js');
  const originalRestore = facade.Chests.restore;
  facade.Chests.restore = () => false;
  try {
    openAltarRitual(); acts.altarRewardLoot();
    expect(st.game.altarRewardPending).toBe(true);
    expect(st.game.nodeChestRewards).toBeUndefined();
    expect(st.game.ownedCards).toEqual([]);
    UI.showOverlay('', '<main>map</main>');
    openAltarRitual();
    expect(document.querySelector('[data-act="altarRewardLoot"]')).not.toBeNull();
  } finally { facade.Chests.restore = originalRestore; }
});

it('祭坛献祭先保存已支付状态，演出中不重复扣牌，换页不打开迟到奖励',async()=>{
  vi.useFakeTimers();
  try {
    const {openAltarRitual}=await importAltar();
    st.game.ownedCards=Array.from({length:3},(_,i)=>({uid:`s${i}`,card:{id:`c${i}`,name:`祭品${i}`,type:'法术'}}));
    openAltarRitual();acts.altarOn3();UI.el.ovBody.animate=vi.fn();
    for(let i=0;i<3;i++)acts.sacPick({uid:`s${i}`});
    const result=acts.sacConfirm();await vi.advanceTimersByTimeAsync(0);
    expect(st.game.ownedCards).toEqual([]);expect(st.game.altarActivated).toBe(true);expect(st.game.altarRewardPending).toBe(true);
    expect(st.saves).toHaveLength(1);expect(document.querySelectorAll('.fire-rest-reveal-card')).toHaveLength(3);
    acts.sacConfirm();expect(st.saves).toHaveLength(1);
    UI.showOverlay('','<main id="replacement-page">settings</main>');
    await flush();await result;
    expect(document.getElementById('replacement-page')?.textContent).toBe('settings');
    expect(st.game.altarRewardPending).toBe(true);
  }finally{vi.clearAllTimers();vi.useRealTimers();}
});

it('E3: reward adopted before a presentation error remains reserved exactly once', async () => {
  const {openAltarRitual}=await importAltar();
  st.game.altarActivated=true;st.game.altarRewardPending=true;
  const {default:facade}=await import('../game/src/core/sdt-facade.js');
  const original=facade.Chests.restore;
  facade.Chests.restore=(...args)=>{original(...args);throw new Error('late presentation');};
  try {
    openAltarRitual();acts.altarRewardLoot();
    expect(st.game.altarRewardPending).toBe(false);
    expect(st.game.nodeChestRewards['0,0'].current.cards).toHaveLength(2);
  } finally {facade.Chests.restore=original;}
});

it('E6: resource receipt stays taken when logging fails after actual grant', async () => {
  const { createRunResourceController }=await import('../game/src/run/game.run.resources.js');
  const scenes=await importScenes();
  const resource={id:'audit-resource',name:'审查资源',rarity:'古朴',type:'资源'};
  window.SDT.Cards.all=()=>[resource]; window.SDT.Cards.DROP_WEIGHTS={古朴:1};
  const controller=createRunResourceController({game:st.game, UI, dom:document,getCards:()=>window.SDT.Cards,
    rich:x=>x,saveGame:()=>true,captureRunContext:()=>()=>true,grantEventCard:scenes.grantEventCard,
    consumeCurrentCell:scenes.consumeCurrentCell,setBagReturnHook(){},bagSlots:{}});
  await controller.openResourcePick(()=>{});
  UI.log.mockImplementationOnce(()=>{throw new Error('late notification failure');});
  await acts.resTake({i:'0'});
  expect(st.game.ownedCards).toHaveLength(1);
  expect(st.game.nodeRewards['0,0'].taken).toBe(0);
  await acts.resTake({i:'0'});
  expect(st.game.ownedCards).toHaveLength(1);
  expect(st.game.nodeRewards['0,0'].taken).toBe(0);
});

it('entry completion retries an unsaved claim without issuing another card', async () => {
  st.game.entrySupply={version:1,layerIdx:0,trackPos:0,cardIds:['lg1'],taken:[]};
  const {openEntrySupply}=await importAltar();await openEntrySupply();st.save=()=>false;
  await acts.entrySupplyTake({i:0});await acts.clsEntryContinue();
  expect(st.game.state).toBe('modal');expect(st.game.ownedCards).toHaveLength(1);
  st.save=()=>true;await acts.clsEntryContinue();
  expect(st.game.state).toBe('idle');expect(st.game.ownedCards).toHaveLength(1);
});



