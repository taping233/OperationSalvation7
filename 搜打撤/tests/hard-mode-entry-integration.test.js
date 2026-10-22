// Regression coverage for elite-mode 1.35 scaling through real encounter and altar entry paths.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mapData from '../game/data/map.json';

// Real encounter/altar callers and scaler; rendering/storage and battle-start boundary only are ports.
const H = vi.hoisted(() => ({ game:{}, map:{ rules:{ fireHeal:10 } }, streams:{}, draws:[], acts:{},
  start:vi.fn(async () => true), save:vi.fn(() => true) }));
vi.mock('../game/src/run/game.session.kernel.js', () => ({ game:H.game, MAP:H.map }));
vi.mock('../game/src/run/game.session.js', async () => ({
  ...await import('../game/src/run/game.session.modes.js'),
  game:H.game, MAP:H.map, bagCap:() => 9, usedSlots:() => 0, newUid:() => 'entry-fixture',
  pick:items => items[0], getActiveSlot:() => null, saveGame:H.save,
  curLayer:() => H.game.layerData[H.game.layerIdx], enterLayer() {}, exitToTitle() {},
}));
vi.mock('../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random:{ ...actual.Random, random:stream => {
    H.draws.push(stream); return H.streams[stream]?.shift() ?? 0.5;
  } } };
});
vi.mock('../game/src/battle/battle-loader.js', async importOriginal => ({
  ...await importOriginal(), startBattle:H.start, ensureBattleReady:async () => true,
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx:{ tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML:() => '' }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../game/src/run/game.run.shop.js', () => ({ createShopController:() => ({ openShop() {} }) }));
vi.mock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands:() => ({}),
  buildExtractionReceipt() {}, extractionPocketOutcome() {}, validatePendingExtraction:() => ({ ok:true }) }));
vi.mock('../game/src/ui/expedition-feedback.js', () => ({ installExpeditionFeedback:() => () => {} }));
vi.mock('../game/src/ui/interface-motion.js', () => ({ interfaceReducedMotion:() => true }));
vi.mock('../game/src/core/motion.js', async importOriginal => ({ ...await importOriginal(), reduceMotion:() => true }));

let scenes, altar, UI, rules, rollCount, previousSDT;
beforeAll(async () => {
  previousSDT = window.SDT;
  UI = { el:{}, act:(key, action) => { H.acts[key] = action; }, refresh() {}, log() {},
    showOverlay(_title, html) { UI.el.ovBody.innerHTML = html; UI.el.overlay.hidden = false; },
    hideOverlay() { UI.el.overlay.hidden = true; UI.el.ovBody.innerHTML = ''; } };
  window.SDT = { game:H.game, UI, Sound:{ sfx() {}, music() {} }, Icons:{ rich:value => value },
    Cards:{ all:() => [], cardHTML:() => '' }, Base:{ slot:null, bagCap:() => 9 },
    Meta:{ setXpMul() {}, addXpToProgress() {} } };
  const { MAP } = await import('../game/src/core/mapData.js');
  rules = { ...MAP.rules }; rollCount = MAP.rollCount;
  Object.assign(H.map, structuredClone(mapData), { rules:{ ...rules }, rollCount });
  scenes = await import('../game/src/run/game.run.scenes.js');
  altar = await import('../game/src/run/game.run.altar.js');
});
beforeEach(() => {
  vi.useFakeTimers(); H.start.mockClear(); H.save.mockClear(); H.draws = []; H.streams = {}; H.acts = {};
  for (const key of Object.keys(H.game)) delete H.game[key];
  Object.assign(H.map, structuredClone(mapData), { rules:{ ...rules }, rollCount });
  Object.assign(H.game, { mode:'elite', seed:'mode-entry', mapSeed:'mode-entry', state:'idle', runActive:true,
    layerIdx:0, trackPos:0, encounterRotationVersion:0, discoveredPairs:new Set(), ownedCards:[],
    hp:30, maxHp:30, coins:0, visited:{}, nodeRewards:{}, altarActivated:true,
    layerData:[0,1,2,3].map(layer => ({ logical:[0,1,2].map(index => ({ id:`${layer}:${index}`, def:{ type:'battle' } })) })) });
  document.body.innerHTML = '<div id="overlay" hidden><div id="ovBody"></div></div>';
  UI.el = { overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') };
});
afterEach(() => { UI.hideOverlay(); vi.clearAllTimers(); vi.useRealTimers(); });
afterAll(() => { window.SDT = previousSDT; });

const hard = { infantry:[5,5], archer:[7,4], bandit:[4,4], cavalry:[7,8], orc_jav:[8,5],
  wolf_rider:[9,8], orc_axe:[5,9], fire_el:[14,9], water_el:[9,14], grass_el:[7,16], dragon:[9,54] };
const metaKeys = ['risk','strategy','encounterId','encounterKind','rewardKind','fallbackReason'];
const metadata = list => Object.fromEntries(metaKeys.map(key => [key,list[key]]));
const encounters = [
  ['first-layer ordinary',0,0,[0,0,0,0],['bandit','bandit'],'entry',4],
  ['second-layer group',1,0,[0.99],['archer','cavalry'],'group',1],
  ['third-layer old single',2,0,[0.9,0.1,0,0.1],['wolf_rider'],'entry',4],
  ['third-layer fresh rotation',2,1,[0.9,0.5,0.6,0.1,0.2,0.3],null,'entry',6],
  ['fourth-layer special elite',3,0,[0.05,0,0.1],['dragon'],'elite',3],
  ['fourth-layer group',3,0,[0.99,0.99],['fire_el','grass_el'],'group',2],
  ['fourth-layer ordinary',3,0,[0.99,0,0,0.1],['water_el'],'entry',4],
];
describe('same selection inputs preserve encounter construction, not whole-playthrough RNG', () => {
  it.each(encounters)('%s', async (_label, layer, rotation, values, ids, kind, draws) => {
    H.game.layerIdx = layer; H.game.encounterRotationVersion = rotation;
    const templatesBefore = structuredClone(H.map.monsters);
    H.game.mode = 'standard'; H.streams.enemy = [...values];
    const normal = scenes.buildEncounter(layer), normalDraws = [...H.draws];
    for (const foe of normal) expect(foe).toEqual(mapData.monsters[foe.id]);
    await scenes.openBattleCell(null, normal);
    expect(H.start).toHaveBeenLastCalledWith(H.game, normal, expect.objectContaining(metadata(normal)));
    H.game.mode = 'elite'; H.draws = []; H.streams.enemy = [...values];
    const reduced = scenes.buildEncounter(layer);
    expect(H.draws).toEqual(normalDraws); expect(H.draws).toEqual(Array(draws).fill('enemy'));
    expect(reduced.map(foe => foe.id)).toEqual(normal.map(foe => foe.id));
    if (ids) expect(reduced.map(foe => foe.id)).toEqual(ids);
    expect(reduced).toHaveLength(ids?.length ?? 3);
    expect(reduced.encounterKind).toBe(kind); expect(metadata(reduced)).toEqual(metadata(normal));
    for (const foe of reduced) {
      const [atk,hp] = hard[foe.id];
      expect(foe).toEqual({ ...mapData.monsters[foe.id], atk, hp });
    }
    await scenes.openBattleCell(null, reduced);
    expect(H.start).toHaveBeenLastCalledWith(H.game, reduced, expect.objectContaining(metadata(reduced)));
    expect(H.start.mock.calls.at(-1)[1]).toBe(reduced);
    expect(H.map.monsters).toEqual(templatesBefore);
  });
  it.each(['standard','elite'])('public openBattleCell builds exactly once without a supplied list in %s', async mode => {
    H.game.mode = mode; H.streams.enemy = [0,0,0,0];
    await scenes.openBattleCell(null);
    expect(H.start).toHaveBeenCalledOnce(); expect(H.draws).toEqual(Array(4).fill('enemy'));
    expect(H.start.mock.calls[0][1].map(foe => ({ id:foe.id, hp:foe.hp, atk:foe.atk })))
      .toEqual(Array.from({ length:2 }, () => ({ id:'bandit', hp:mode === 'elite' ? 4 : 3, atk:mode === 'elite' ? 4 : 3 })));
  });
});

const bosses = [['boss_general',0.1,0,5,50,7,68], ['boss_orc',0.5,1,4,45,5,61], ['boss_elem',0.9,2,8,48,11,65]];
describe.each(['standard','elite'])('public altar confirmation in %s', mode => {
  it.each(bosses)('%s selects once and reuses bossPlan', async (id, random, index, atk, hp, hardAtk, hardHp) => {
    H.game.mode = mode; H.streams.boss = [random];
    const original = structuredClone(H.map.altar.bosses[index]);
    expect(original.id).toBe(id);
    altar.openBossGate(); expect(H.draws).toEqual([]);
    const pending = H.acts.bossGateFight();
    H.acts.flowContinue(); await pending;
    expect(H.game.bossPlan).toBe(index); expect(H.draws).toEqual(['boss']);
    const expected = { ...original, boss:true, atk:mode === 'elite' ? hardAtk : atk, hp:mode === 'elite' ? hardHp : hp };
    expect(H.start).toHaveBeenLastCalledWith(H.game, expected, { isBoss:true, name:original.name });
    // Standard's pre-existing boss flag mutation is not a stat change and is not repaired here.
    expect(H.map.altar.bosses[index]).toMatchObject({ hp, atk });
    H.draws = []; H.streams.boss = [0.99]; H.game.state = 'idle';
    altar.openBossGate(); const repeated = H.acts.bossGateFight(); H.acts.flowContinue(); await repeated;
    expect(H.draws).toEqual([]); expect(H.game.bossPlan).toBe(index);
    expect(H.start.mock.calls.at(-1)[1]).toEqual(expected);
  });
});
