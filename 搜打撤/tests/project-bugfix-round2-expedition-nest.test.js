import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ game: {}, UI: {}, cards: [], saves: [], slot: null, battleStarts: [] }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: H.game, MAP: { rules: { playerMaxHp: 35, battleEnergy: 3, battleStartDraw: 4, battleTurnDraw: 2 } },
  getActiveSlot: () => H.slot, saveGame: () => { H.saves.push(JSON.parse(JSON.stringify(H.game))); return true; },
  clearSave() {}, syncPlayTime() {}, exitToTitle: () => { H.game.state = 'title'; },
}));
vi.mock('../game/src/ui/ui.js', () => ({ UI: H.UI }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/run/lab.ending.js', () => ({ playLabEnding: done => done() }));
let Nest;
const actions = {};
beforeAll(async () => {
  Object.assign(H.UI, { el: {}, showOverlay(title, body) {
    for (const key of Object.keys(actions)) delete actions[key];
    this.el.ovBody.innerHTML = body; this.el.overlay.hidden = false;
  }, hideOverlay() { this.el.overlay.hidden = true; }, act: (name, fn) => actions[name] = fn, log() {}, refresh() {} });
  window.SDT = { game: H.game, UI: H.UI, Icons: { rich: text => text }, Sound: { sfx() {} },
    Cards: { all: () => H.cards, isRandomObtainable: card => card.rarity !== '初始', SHA: { id: 'sha' } },
    Meta: { classLv: () => 1, track() {}, checkUnlocks() {} },
    Base: { data: {}, isSha: card => card.id === 'sha', save: vi.fn(() => true), carriedPet: () => null,
      recordNestBoss: async name => { const kills = window.SDT.Base.data.stats.nestBossKills ||= [];
        const changed = !kills.includes(name); if (changed) kills.push(name); return { changed, persisted:false }; } },
  };
  await import('../game/src/run/game.nest.js'); Nest = window.SDT.Nest;
});
function bindBattle() { Nest.bindBattleStart((game, foes, opts) => {
  H.battleStarts.push({ foes, opts }); game.battleActive = true; game.state = 'modal'; return true;
}); }
beforeEach(async () => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  H.UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') };
  H.slot = null; H.saves = []; H.battleStarts = [];
  const { MAP } = await import('../game/src/run/game.session.js');
  Object.assign(MAP.rules, { battleEnergy: 3, battleStartDraw: 4, battleTurnDraw: 2 });
  H.cards = [{ id: 'sha', name: '初始攻击', rarity: '初始', type: '武术' },
    { id: 'loot', name: '奖励卡', rarity: '古朴', type: '武术' },
    { id: 'hero', name: '英雄', rarity: '职业', type: '武术', hero: true },
    { id: 'class', name: '职业卡', rarity: '职业', type: '武术' }];
  window.SDT.Base.data = { runes: [], stash: [], stats: {}, nestBagUp: 0 };
  Object.assign(H.game, { seed: 7, discoveredPairs: new Set(), state: 'modal', runActive: true, nestActive: true,
    nestPos: 0, nestEquipped: [], nestRunes: [], pendingRunePick: null, nestTargetedBox: 0, battleActive: false,
    ownedCards: [], cardBox: [], nestKills: 0, nestBossDown: false, coins: 0, hp: 20, maxHp: 35,
    nestBoss: { id: 'fixture-boss', name: '测试所主', hp: 35, atk: 1 }, nestBossName: '测试所主',
  });
  bindBattle(); Nest.renderNestMap();
});
afterEach(() => vi.restoreAllMocks());

it('altar chooses rerolls exclusively and preserves the remaining count on reentry', async () => {
  delete H.game.nestAltarChoice;
  H.game.nestPos=8;H.game.nestRunes=[{name:'火纹',attrs:['火'],rarity:'古朴'}];
  Nest.renderNestMap();actions.nestCell9();actions.naReroll();actions.naHero();
  expect(H.game.cardBox).toHaveLength(0);expect(H.game.nestPos).toBe(8);
  expect(H.game.nestAltarChoice).toEqual({position:9,remaining:2});
  expect(H.saves.at(-1).nestAltarChoice).toEqual({position:9,remaining:2});
  Nest.renderNestMap();actions.nestCell9();actions.naReroll();actions.naReroll();
  expect(H.game.nestAltarChoice.remaining).toBe(0);
  const {Random}=await import('../game/src/core/random.js');const before=Random.snapshot();actions.naReroll();
  expect(Random.snapshot()).toEqual(before);actions.naHero();expect(H.game.cardBox).toHaveLength(0);
});

it('preparation permits only one selected stash card per name', () => {
  window.SDT.Base.data.nestUnlocked=true;
  window.SDT.Base.data.stash=[{card:{id:'dup1',name:'同名',type:'法术'},count:1},{card:{id:'dup2',name:'同名',type:'法术'},count:1}];
  Nest.openNestPrep();actions.nestPick0();actions.nestPick1();
  expect(H.UI.el.ovBody.querySelector('[data-act="nestGo"]').textContent).toContain('1/10');
});

it('preparation does not silently replace a selected card with a changed stash entry', () => {
  H.game.nestActive=false;window.SDT.Base.data.nestUnlocked=true;
  const stash=Array.from({length:10},(_,i)=>({card:{id:`s${i}`,name:`卡${i}`,type:'法术'},count:1}));
  window.SDT.Base.data.stash=stash;Nest.openNestPrep();
  for(let i=0;i<10;i++)actions[`nestPick${i}`]();
  stash[0]={card:{id:'other',name:'未选中的替代牌',type:'法术'},count:1};actions.nestGo();
  expect(H.game.nestActive).toBe(false);
  expect(H.UI.el.ovBody.querySelector('[data-act="nestGo"]').textContent).toContain('9/10');
});

it.each(['hero','class'])('altar missing %s reward does not consume the node or grant a partial reward',missing=>{
  delete H.game.nestAltarChoice;H.game.nestPos=8;
  H.cards=H.cards.filter(card=>card.id!==missing);
  Nest.renderNestMap();actions.nestCell9();actions.naHero();
  expect(H.game.nestPos).toBe(8);expect(H.game.cardBox).toHaveLength(0);
});

it('new altar state is included in the real payload and invalid counts are rejected',async()=>{
  const {createSessionPersistence}=await import('../game/src/run/game-session-persistence.js');
  const {validateRunSave}=await import('../game/src/hub/run-save-validation.js');
  H.game.nestAltarChoice={position:9,remaining:0};
  const {createRunSavePayload}=createSessionPersistence({readState:()=>({game:H.game,activeSlot:null}),
    readServices:()=>({}),Random:{seed:7,snapshot:()=>({})},assertZones(){},snapshotRunBattles:()=>({})});
  const payload=createRunSavePayload();expect(payload.nestAltarChoice).toEqual({position:9,remaining:0});
  expect(validateRunSave(payload).ok).toBe(true);
  expect(validateRunSave({...payload,nestAltarChoice:{position:9,remaining:3}}).ok).toBe(false);
  delete payload.nestAltarChoice;expect(validateRunSave(payload).ok).toBe(true);
});

it.each([undefined,{position:9,remaining:0},{position:9,remaining:2}])('nest restoration retains current altar choice and defaults old saves (%j)',async choice=>{
  const {createSessionRestoration}=await import('../game/src/run/game-session-restoration.js');
  const {validateRunSave}=await import('../game/src/hub/run-save-validation.js');
  const run={seed:7,nestActive:true,nestPos:8,cardBox:[],nestRunes:[],nestEquipped:[],nestAltarChoice:choice};
  const state={game:{nestAltarChoice:{position:9,remaining:1}},runtime:{}};
  const restore=createSessionRestoration({readState:()=>state,
    readServices:()=>({Base:{use(){},issue:()=>null,data:{stats:{},stash:[],pocket:[]}},
      Cards:{applyAbilityRename:()=>false,applyDuplicateRenames:()=>false},Nest:{renderNestMap(){}}}),
    readUI:()=>({log(){}}),development:false,
    RunStorage:{readIdentity:()=>({ok:true,value:{runId:'nest-restore'}}),readForPreflight:()=>run,acceptLoad:()=>({ok:true})},
    validateRunSave,planMapRestore:()=>({ok:true,value:{source:'nest'}}),trackRestoration:run=>run(),
    Random:{restore:()=>7},restoreRunBattles(){},setLobby(){},MAP:{rules:{playerMaxHp:35,playerAtk:2}},
    MODES:{standard:{}},applyModeRules(){},refreshCardClones(){}});
  expect(restore.loadGame(1).ok).toBe(true);expect(state.game.nestAltarChoice).toEqual(choice||null);
});


