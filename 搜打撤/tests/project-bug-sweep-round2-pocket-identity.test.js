import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { planBaseDeparture } from '../game/src/hub/base-departure.commands.js';

vi.mock('../game/src/run/game.run.js', () => ({showRunTransition:async () => true}));
let game, session, bagSlots, UI, openPocketRestore;
const card = (id, variantKey) => ({ id, name:'同名招式', type:'武术', rarity:'古朴',
  ...(variantKey ? {variantKey} : {}) });

beforeAll(async () => {
  document.body.innerHTML = readFileSync('game/index.html', 'utf8');
  window.SDT = { Icons:{img:() => '', rich:String, TYPE_ART:{}},
    Sound:{music(){}, sfx:vi.fn(), setDucked(){}}, FX:{feedback(){}} };
  await import('../game/src/cards/cards.js');
  await import('../game/src/ui/ui.js');
  await import('../game/src/hub/base.js');
  session = await import('../game/src/run/game.session.js');
  await import('../game/src/hub/game.bag.js');
  ({bagSlots} = await import('../game/src/hub/game.bag.bridge.js'));
  game = session.game;
  UI = window.SDT.UI;
  UI.init(); UI.log = vi.fn(); UI.refresh = vi.fn();
  window.SDT.Meta = {track:vi.fn()};
  window.SDT.Chests = {rollDrops:() => [], dropText:() => '', open:vi.fn(), isOpen:() => false};
  const {bindBagMixins} = await import('../game/src/hub/game.bag.settle.js');
  bindBagMixins();
  ({openPocketRestore} = await import('../game/src/run/game.run.scenes.js'));
  session._set_active_slot(null);
});
beforeEach(() => {
  Object.assign(game, {runActive:true, state:'idle', myClass:'战士', inventory:[], usedPocket:[],
    ownedCards:[], cardOrder:[], pendingExtraction:null, extractionPending:null, terminalPending:null,
    pendingEventLoot:null, battleActive:false, nestActive:false, hp:20, maxHp:30, seed:'identity',
    discoveredPairs:new Set(), layerIdx:0, trackPos:1, visited:{}, elapsed:0, elapsedSynced:0});
});
afterEach(() => UI.hideOverlay({immediate:true}));

it.each([
  ['different IDs', card('old-a'), card('new-a')],
  ['different variants', card('a', 'old'), card('a', 'new')],
])('preserves %s through actual departure and battle consumption', async (_label, a, b) => {
  const stash = [{card:a, count:1}, {card:b, count:1}];
  const picks = Object.fromEntries(stash.map(stack => [`card:${stack.card.id}${stack.card.variantKey ? `:${stack.card.variantKey}` : ''}`, 1]));
  const {departure} = planBaseDeparture({stash, pocket:[]}, picks);
  expect(departure.ok).toBe(true);
  expect(departure.cards).toHaveLength(2);
  game.ownedCards = departure.cards.map((stack, index) => ({uid:`used-${index}`, card:stack.card}));
  await game.onBattleEnd({isBoss:false, foeNames:['测试敌人']}, ['used-0', 'used-1'], true, []);
  expect(game.ownedCards).toEqual([]);
  expect(game.usedPocket).toEqual([{card:a, count:1}, {card:b, count:1}]);
});

it.each([card('a'), {name:'同名招式', type:'武术'}])('retains normal stacking for matching identity %j', sample => {
  bagSlots.pocketAdd(sample); bagSlots.pocketAdd({...sample});
  expect(game.usedPocket).toEqual([{card:sample, count:2}]);
});

it.each([false, true])('restores the clicked same-name identity from the live view (node=%s)', async node => {
  const a = card('old-a'), b = card('new-a');
  game.usedPocket = [{card:a, count:1}, {card:b, count:1}];
  let opts = {};
  if (node) {
    const {beginNodeRestore} = await import('../game/src/run/node-restore-state.js');
    opts = {restoreRecord:beginNodeRestore(game, {source:'altar-offering', picks:1})};
  }
  openPocketRestore(1, vi.fn(), opts);
  const buttons = [...document.querySelectorAll('[data-act="restoreOne"]')];
  expect(buttons).toHaveLength(2);
  buttons[1].click();
  expect(game.ownedCards.map(entry => entry.card.id)).toEqual(['new-a']);
  expect(game.usedPocket).toEqual([{card:a, count:1}]);
});

it.each(['count', 'identity', 'removed'])('rejects an altered restore row (%s) without consuming anything else', change => {
  game.usedPocket = [{card:card('old-a'), count:1}, {card:card('new-a'), count:1}];
  openPocketRestore(1, vi.fn());
  const buttons = [...document.querySelectorAll('[data-act="restoreOne"]')];
  const selected = game.usedPocket[1];
  if (change === 'count') selected.count++;
  if (change === 'identity') selected.card.id = 'replacement';
  if (change === 'removed') game.usedPocket.splice(1, 1);
  const before = structuredClone(game.usedPocket);
  buttons[1].click();
  expect(game.ownedCards).toEqual([]);
  expect(game.usedPocket).toEqual(before);
});

it.each([false, true])('rejects ambiguous legacy name-only restore calls (new row after view=%s)', addedLater => {
  game.usedPocket = [{card:card('old-a'), count:1}];
  if (!addedLater) game.usedPocket.push({card:card('new-a'), count:1});
  openPocketRestore(1, vi.fn());
  if (addedLater) game.usedPocket.push({card:card('new-a'), count:1});
  const before = structuredClone(game.usedPocket);
  UI._acts.restoreOne({name:'同名招式'});
  expect(game.ownedCards).toEqual([]);
  expect(game.usedPocket).toEqual(before);
});

it('keeps the only filled container and displays a reason through the live discard entry', () => {
  const box = {id:'tt2-pearlbox', name:'珍珠盒', type:'装备'};
  const contents = {uid:'stored', card:{id:'wood', name:'木材', type:'资源'}, stored:1};
  game.ownedCards = [{uid:'box', card:box}, contents];
  const before = structuredClone(game.ownedCards);
  expect(game.discardCard(box.name, false, 'box')).toBe(false);
  expect(game.ownedCards).toEqual(before);
  expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('请先取出'), 'warn');
});
