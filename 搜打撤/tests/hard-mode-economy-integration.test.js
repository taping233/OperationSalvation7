// Regression coverage for elite-mode 1.35 scaling with unchanged reward formulas and settlement replay.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { installImmediateWebLocks } from './helpers/web-locks.js';
import mapData from '../game/data/map.json';

const H = vi.hoisted(() => ({ game:{}, map:{ rules:{} } }));
vi.mock('../game/src/run/game.session.kernel.js', () => ({ game:H.game, MAP:H.map }));
let Base, Meta, RunStorage, createRecoveryCommands, createBattleSettlementCommands;
let applyModeRules, modeCfg, scaledEnemy, previousSDT, previousLocks;
const storedBase = () => JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)));
beforeAll(async () => {
  previousSDT = window.SDT;
  previousLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
  installImmediateWebLocks();
  window.SDT = { game:H.game, MAP:H.map, Icons:{ img:() => '', TYPE_ART:{} },
    UI:{ log() {}, refresh() {} }, Sound:{ sfx() {} } };
  const { RULES } = await import('../game/src/core/rules.js');
  Object.assign(H.map.rules, RULES);
  await import('../game/src/cards/cards.js');
  await import('../game/src/hub/base.js');
  ({ Meta } = await import('../game/src/hub/meta.js'));
  Base = window.SDT.Base;
  window.SDT.Cards.ensureTabletop();
  ({ applyModeRules, modeCfg, scaledEnemy } = await import('../game/src/run/game.session.modes.js'));
  await import('../game/src/run/game.session.bag.js');
  ({ RunStorage } = await import('../game/src/hub/game.storage.js'));
  ({ createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js'));
  ({ createBattleSettlementCommands } = await import('../game/src/hub/battle-settlement.commands.js'));
});
beforeEach(async () => {
  localStorage.clear();
  Base.use(1);
  Object.assign(Base.data, { characters:{ wu:{ lv:1, xp:0 } }, classes:{},
    stash:[], pocket:[], collXp:{}, collection:{}, eggBattles:0, ammoTaught:true });
  Base.data.stats.kills = 0; Base.data.stats.bossKills = [];
  Base.data.stats.playSeconds = 0;
  expect(await Base.save()).toBe(true);
  Object.assign(H.game, { mode:'standard', coins:0, inventory:[], ownedCards:[], usedPocket:[] });
  applyModeRules();
});
afterAll(async () => {
  await Base?.flushWrites?.();
  if (previousLocks) Object.defineProperty(navigator, 'locks', previousLocks);
  else delete navigator.locks;
  window.SDT = previousSDT;
});
function selectMode(mode, multiplier) {
  H.game.mode = mode; applyModeRules();
  expect(modeCfg().coinMul).toBe(multiplier);
  expect(Meta.xpMultiplier()).toBe(multiplier);
}

describe('hard reduction leaves actual economy award paths unchanged', () => {
  it.each([
    ['standard',1,0,1], ['standard',1,1,1], ['standard',1,2,2], ['standard',1,3,3],
    ['elite',1.5,0,1], ['elite',1.5,1,2], ['elite',1.5,2,3], ['elite',1.5,3,5],
  ])('%s multiplier %s awards base %s as %s coins through the real bound game command', (mode, multiplier, input, expected) => {
    selectMode(mode, multiplier);
    H.game.coins = 7;
    H.game.gainCoins(input);
    expect(H.game.coins).toBe(7 + expected);
  });
  it.each([
    ['standard',1,false,6,1,6], ['elite',1.5,false,9,1,9],
    ['standard',1,true,40,1,40], ['elite',1.5,true,60,2,10],
  ])('%s Meta.track compatibility award [multiplier=%s, boss=%s]', async (mode, multiplier, boss, amount, lv, xp) => {
    selectMode(mode, multiplier);
    const result = await Meta.track('kill', { boss, cls:'wu', name:'hard-mode-award-fixture' });
    expect(result).toMatchObject({ changed:true, persisted:true, xp:{ cls:'wu', amount } });
    expect(Base.data.characters.wu).toEqual({ lv, xp });
    expect(storedBase().characters.wu).toEqual({ lv, xp });
    expect(Base.data.stats.kills).toBe(1);
  });
  it.each([
    ['standard',1,false,1,12], ['elite',1.5,false,1,18],
    ['standard',1,true,1,40], ['elite',1.5,true,2,10],
  ])('%s slot victory commit awards actual XP once [multiplier=%s, boss=%s]', async (mode, multiplier, isBoss, lv, xp) => {
    selectMode(mode, multiplier);
    const source = isBoss ? [mapData.altar.bosses[0]] : [mapData.monsters.infantry, mapData.monsters.bandit];
    const foes = source.map(enemy => scaledEnemy(Object.freeze({ ...enemy })));
    expect(foes.map(enemy => enemy.name)).toEqual(source.map(enemy => enemy.name));
    const node = { layerIdx:0, trackPos:1, isBoss, encounterId:isBoss ? 'hard-boss' : 'hard-group' };
    RunStorage.readForLoad(1);
    expect(await RunStorage.write(1, { mode, turn:1, layerIdx:0, trackPos:1, visited:{},
      ownedCards:[], elapsed:0, rngState:{ enemy:1 } })).toBe(true);
    const recovery = createRecoveryCommands({ storage:localStorage, lockManager:navigator.locks,
      baseApi:Base, runStore:RunStorage });
    const commands = createBattleSettlementCommands({ getBase:() => Base, getRunStorage:() => RunStorage,
      getRecovery:() => recovery, getActiveSlot:() => 1 });
    const prepared = await commands.createAttempt({ slotId:1, node, elapsedDelta:0,
      afterRun:{ ...RunStorage.read(1), visited:{ '0,1':1 }, battleComplete:true },
      victoryProgress:{ foeNames:foes.map(enemy => enemy.name), isBoss, classId:'wu', xpMultiplier:Meta.xpMultiplier() } });
    expect(prepared).toMatchObject({ ok:true, replay:false });
    expect(Base.data.characters.wu).toEqual({ lv:1, xp:0 });
    expect(prepared.attempt.afterBase.characters.wu).toEqual({ lv, xp });
    expect(await commands.commitAttempt(prepared.attempt)).toMatchObject({ ok:true, replay:false });
    expect(Base.data.characters.wu).toEqual({ lv, xp });
    expect(storedBase().characters.wu).toEqual({ lv, xp });
    expect(Base.data.stats.kills).toBe(isBoss ? 1 : 2);
    expect(await commands.commitAttempt(prepared.attempt)).toMatchObject({ ok:true, replay:true });
    expect(storedBase().characters.wu).toEqual({ lv, xp });
    expect(Base.data.stats.kills).toBe(isBoss ? 1 : 2);
  });
});
