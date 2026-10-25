import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('旧系列退役后的真实事件 flow',()=>{
  beforeEach(()=>{localStorage.clear();Object.assign(harness,{activeSlot:1,acts:{},pages:[],consumed:0,finish:0,saveResult:true});
    Object.assign(harness.game,{layerIdx:0,trackPos:1,visited:{},state:'idle',nodeRewards:{}});});
  it.each([0,1,2,3,'complete','missing'])('旧档阶段 %s 不再抢占普通事件或写入故事',async stage=>{
    await seedRun(1,'retired-'+stage);
    if(stage!=='missing')Base.data.story.outcomes['last-lamp']={stage,choiceId:'continue'};
    const before=JSON.stringify(Base.data.story);const narrative=vi.fn(harness.narrative);harness.narrative=narrative;
    await runEventDeck();
    expect(harness.consumed).toBe(1);expect(harness.game.visited['0,1']).toBe(1);
    expect(harness.acts.lastLampChoice).toBeUndefined();expect(harness.acts.lastLampFinish).toBeUndefined();
    expect(narrative).not.toHaveBeenCalled();expect(JSON.stringify(Base.data.story)).toBe(before);
  });
});
