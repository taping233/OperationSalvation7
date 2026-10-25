import { expect, it, vi } from 'vitest';
import * as fixtures from './helpers/environment-fixtures.js';

function holder() {
  return { game: { ownedCards: [], layerData: [], layerIdx: 0 }, cards: [], saves: [], uid: 0, bagCapN: 9,
    Application: class {}, Sprite: class {}, emptyTexture: {}, ui: { el: {} } };
}

const contracts = [
  ['battleRules', 'battleEnergy,battleHandMax,bossDeckSize,starterSha,battleStartDraw,battleTurnDraw,diceSides', () => [9, 99, 15, 0, 5, 1]],
  ['battleViewMocks', 'Icons,Sound,Art,Meta,Motion,MAP', () => [x => x, true, 9, 99, 5, 5]],
  ['overlayElements', 'overlay,ovBody,ovTitle', () => []],
  ['playerFields', 'hp,maxHp,atk,spellPower,coins,myClass,characterId,state,battleActive', () => [20, 30, 4, 2, '法师', null]],
  ['damageRuleFields', 'version,battle,triggers', () => [false, 'chosenEnemy']],
  ['eventCardMocks', 'game,Icons,Sound,Meta,Base,MAP,Cards', h => [h]],
  ['canvasTraps', 'get,set,apply', () => [() => null]],
  ['eventMapMocks', 'game,MAP,MODES,bagCap,usedSlots', h => [h]],
  ['frameMocks', 'attach,hide,cacheStats,play,setPaused,presentDeath,isLiveBattleFigure,actionImpactRemaining', () => []],
  ['eventMapActions', 'curLayer,cellCenter,markSeen,modeCfg,gainCoins,weighted,enterLayer,exitToTitle', h => [h]],
  ['altarMocks', 'Sound,Icons,Meta,Cards,MAP,Base,Motion', h => [h, () => vi]],
  ['inventoryFields', 'inventory,usedPocket,hp,maxHp,atk,spellPower,coins,myClass,state,battleActive', () => [20, 30, 2, null]],
  ['eventUiMocks', '_acts,_baseActs,_roomActive,el,act,refresh,log,showCardReward,_checkPageBg', h => [() => h.ui]],
  ['pixiFrameMocks', 'utils,RENDERER_TYPE,Application,Sprite,Texture,Assets', h => [h]],
  ['chestBaseMocks', 'Base,Sound,Icons', () => [() => vi]],
  ['audioGainFields', 'connect,disconnect,gain', () => []],
  ['extractionMocks', 'FIRE_RESTORABLE,consumeCurrentCell,finishInstant,grantEventCard,nodeOpt,nodeShell,openPocketRestore,openShop,preloadAllNodeShellBgs,showRunTransition', () => [() => vi]],
  ['chestMocks', 'Icons,Sound,MAP,Cards,Base', h => [h.cards, () => vi, () => () => null]],
  ['eventCapacityPorts', 'readStacks,canReceive,capacity,moveToSafe,discardOne', h => [h, { card: {} }]],
  ['altarStateFields', 'coins,fragments,visited,ownedCards,usedPocket,inventory,altarActivated,altarItemSacrificed,altarRewardPending,bossKilled,_fireRestKey,nodeRewards', () => []],
  ['eventSaveActions', 'newUid,pick,saveGame,scaledEnemy', h => [h]],
  ['runPendingFields', 'usedPocket,cardOrder,pendingExtraction,extractionPending,terminalPending,battleActive,nestActive,hp,maxHp,elapsed,elapsedSynced', () => []],
  ['quietUiMocks', 'clearLog,hideOverlay,hideScreen,showScreen,showOverlay,act,registerHelp,helpBtn', () => []],
  ['acquireRuleFields', 'version,battle,triggers', () => [1, 'any', 'hand', 'gain']],
];

it.each(contracts)('%s retains ordered ordinary data fields', (name, keys, args) => {
  const values = args(holder()), first = fixtures[name](...values), second = fixtures[name](...values);
  expect(Reflect.ownKeys(first)).toEqual(keys.split(','));
  expect(Object.getPrototypeOf(first)).toBe(Object.prototype);
  expect(first).not.toBe(second);
  for (const key of Reflect.ownKeys(first)) {
    expect(Object.getOwnPropertyDescriptor(first, key)).toMatchObject({ enumerable: true, configurable: true, writable: true });
  }
});

it('creates independent nested state and preserves concise method metadata', () => {
  const a = fixtures.battleViewMocks(x => x, true, 9, 99, 5, 5);
  const b = fixtures.battleViewMocks(x => x, true, 9, 99, 5, 5);
  expect(a.Icons.TYPE_ART).not.toBe(b.Icons.TYPE_ART);
  expect(a.MAP.rules).not.toBe(b.MAP.rules);
  const piles = [fixtures.inventoryFields(20, 30, 2, null), fixtures.inventoryFields(20, 30, 2, null)];
  expect(piles[0].inventory).not.toBe(piles[1].inventory);
  expect(piles[0].usedPocket).not.toBe(piles[1].usedPocket);
  expect(a.Sound.music.name).toBe('music');
  expect(a.Sound.music.length).toBe(0);
  expect(Object.hasOwn(a.Sound.music, 'prototype')).toBe(false);
  expect(() => new a.Sound.music()).toThrow(TypeError);
});

it('keeps holder reads live and external object identity intact', () => {
  const h = holder(), services = fixtures.eventCardMocks(h), commands = fixtures.eventMapActions(h);
  expect(services.game).toBe(h.game);
  const cards = [{ id: 'later' }]; h.cards = cards;
  expect(services.Cards.all()).toBe(cards);
  h.game.coins = 4; commands.gainCoins(3);
  expect(h.game.coins).toBe(7);
  expect(fixtures.eventSaveActions(h).newUid()).toBe('u1');
});
