import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';

const harness = globalThis.__r6Flow = {
  activeSlot: 1, game: { layerIdx: 0, trackPos: 1, visited: {}, state: 'idle' },
  acts: {}, pages: [], consumed: 0, finish: 0, saveResult: true,
  narrative: async () => ({ intro: '灯', choices: [{ label: '继续', detail: '继续调查', effect: 'continue', choose: () => '记录' }] }),
};

vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { randomEvents: [{ w: 1, text: '普通事件' }], chestTable: [], monsters: {}, encounters: [], items: {}, rules: {} },
  game: harness.game,
  getActiveSlot: () => harness.activeSlot,
  saveGame: () => harness.saveResult,
  weighted: xs => xs[0], pick: xs => xs[0], gainCoins: () => {}, scaledEnemy: x => x,
  cellCenter: () => ({ x: 0, y: 0 }), curLayer: () => ({ logical: [] }), markSeen: () => {}, modeCfg: () => ({ coinMul: 1 }),
}));
vi.mock('../game/src/run/game.run.scenes.js', () => ({
  nodeShell: page => harness.pages.push(page), consumeCurrentCell: () => {
    harness.consumed++; harness.game.visited[`${harness.game.layerIdx},${harness.game.trackPos}`] = 1;
  }, finishInstant: () => { harness.finish++; },
  buildEncounter: () => [], cancelLegacyChainMove: () => {}, consumeCell: () => {}, enterNode: (_, fn) => fn(), grantEventCard: () => true,
  openBattleCell: () => {}, openBlankSafePage: () => {}, openChestsOnCell: () => {}, openPickupPage: () => {}, openPocketRestore: () => {},
  openFixedRewardsOnCell: vi.fn(), openShop: () => {}, preloadCellScene: () => {},
}));
vi.mock('../game/src/run/game.run.altar.js', () => ({ openDoorModal() {}, openFireRest() {}, openAltarRitual() {}, openBossGate() {}, openEmergencyModal() {}, resumeNodeRestore:()=>false }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: {}, _set_cardPageOpen() {}, cardHTML: () => '' }));
vi.mock('../game/src/battle/battle-loader.js', async importOriginal => ({ ...await importOriginal(), startBattle: async () => {} }));
vi.mock('../game/src/core/render-scheduler.js', () => ({ renderScheduler: { invalidate() {} } }));
vi.mock('../game/src/audio/sound.js', () => ({ tone: () => '' }));
vi.mock('../game/src/core/random.js', () => ({ Random: { random: () => 0 } }));
vi.mock('../game/src/run/game.run.data.js', () => ({ EVENT_SCENE_META: {} }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: async () => null, lastLampNarrative: (...args) => harness.narrative(...args) }));

let runEventDeck, RunStorage, Base;
beforeAll(async () => {
  window.SDT = {
    Icons: { img: () => '' }, Cards: { all: () => [] }, Sound: { sfx() {} }, Meta: { track() {} },
    UI: { act: (name, fn) => { harness.acts[name] = fn; }, refresh() {}, log() {}, hideOverlay() {} },
  };
  await import('../game/src/hub/base.js');
  Base = window.SDT.Base;
  ({ RunStorage } = await import('../game/src/hub/game.storage.js'));
  ({ runEventDeck } = await import('../game/src/run/game.run.flow.js'));
});

async function seedRun(slot, runId) {
  harness.activeSlot = slot;
  Base.use(slot); (await Base.save());
  localStorage.setItem(RunStorage.key(slot), JSON.stringify({ version: 2, _r2: { runId, revision: 0 } }));
}

beforeEach(()=>{
  localStorage.clear();Object.assign(harness,{activeSlot:1,acts:{},pages:[],consumed:0,finish:0,saveResult:true});
  Object.assign(harness.game,{layerIdx:0,trackPos:1,visited:{},state:'idle'});
});

it.each([true,false,'reject'])('retired-series fallback checkpoint from old run cannot clear or finish the new run (%s)',async result=>{
  await seedRun(1,'old-story');
  let resolve,reject;harness.saveResult=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const pending=runEventDeck();for(let i=0;i<8;i++)await Promise.resolve();
  await seedRun(2,'new-story');harness.game.layerIdx=3;harness.game.trackPos=8;
  harness.game.visited={'0,1':7,'3,8':1};
  if(result==='reject')reject(new Error('old save failure'));else resolve(result);
  await pending;
  expect(harness.game.visited).toEqual({'0,1':7,'3,8':1});expect(harness.finish).toBe(0);
});


