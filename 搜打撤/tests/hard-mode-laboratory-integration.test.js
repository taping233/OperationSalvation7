// Regression coverage for unchanged public laboratory next-node actions and independent enemy values.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ game:{}, map:{ rules:{ fireHeal:10, playerMaxHp:35,
  battleEnergy:3, battleStartDraw:4, battleTurnDraw:2 } }, UI:{}, actions:{}, starts:[], roll:0 }));
// Random is frozen in production: replace only the draw boundary, never redefine its properties.
vi.mock('../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random:{ ...actual.Random, random:() => H.roll } };
});
vi.mock('../game/src/run/game.session.kernel.js', () => ({ game:H.game, MAP:H.map }));
vi.mock('../game/src/run/game.session.js', async () => ({
  ...(await import('../game/src/run/game.session.modes.js')),
  game:H.game, MAP:H.map, getActiveSlot:() => null, saveGame:() => true,
  clearSave() {}, syncPlayTime() {}, exitToTitle() {},
}));
vi.mock('../game/src/ui/ui.js', () => ({ UI:H.UI }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/run/lab.ending.js', () => ({ playLabEnding:done => done() }));
let Nest, modeCfg, scaledEnemy, previousSDT;
beforeAll(async () => {
  previousSDT = window.SDT;
  Object.assign(H.UI, { el:{}, showOverlay(_title, body) {
    Object.keys(H.actions).forEach(key => delete H.actions[key]);
    this.el.ovBody.innerHTML = body; this.el.overlay.hidden = false;
  }, hideOverlay() { this.el.overlay.hidden = true; }, act:(name, fn) => H.actions[name] = fn,
  log() {}, refresh() {} });
  window.SDT = { game:H.game, UI:H.UI, Icons:{ rich:text => text }, Sound:{ sfx() {} },
    Cards:{ all:() => [], SHA:{ id:'starter-attack' } },
    Meta:{ classLv:() => 1, setXpMul() {}, track() {}, checkUnlocks() {} },
    Base:{ data:{ runes:[], stash:[], stats:{}, nestBagUp:0 }, carriedPet:() => null } };
  ({ modeCfg, scaledEnemy } = await import('../game/src/run/game.session.modes.js'));
  ({ Nest } = await import('../game/src/run/game.nest.js'));
  Nest.bindBattleStart((game, foes, opts) => {
    H.starts.push({ foes:structuredClone(foes), opts:structuredClone(opts) });
    game.battleActive = true; game.state = 'modal'; return true;
  });
});
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  H.UI.el = { overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') };
});
afterAll(() => { window.SDT = previousSDT; });
function enter(mode, beforePos, roll = 0) {
  H.starts.length = 0;
  Object.assign(H.game, { mode, seed:7, discoveredPairs:new Set(), state:'modal', runActive:true,
    nestActive:true, nestPos:beforePos, nestEquipped:[], nestRunes:[], pendingRunePick:null,
    nestTargetedBox:0, battleActive:false, ownedCards:[], cardBox:[], nestKills:0, nestBossDown:false,
    coins:0, hp:20, maxHp:35, nestBoss:null, nestBossName:'待选择' });
  H.roll = roll;
  Nest.renderNestMap();
  H.actions[`nestCell${beforePos + 1}`]();
  expect(H.starts).toHaveLength(1);
  const result = H.starts[0];
  expect(result.opts.isBoss).toBe(true);
  expect(result.opts.nest).toEqual({ runes:[] });
  return result.foes;
}
const stats = foes => foes.map(({ id, hp, maxHp, atk, hearts, heartsMode }) =>
  ({ id, hp, maxHp, atk, hearts, heartsMode }));

describe('laboratory bypass remains independent of hard-mode scaling', () => {
  it.each([
    [0,'nest-dark-elem',30,9,undefined,undefined],
    [1,'nest-sand-elem',8,8,8,true],
    [3,'nest-dragon',40,7,undefined,undefined],
    [4,'nest-evil-dragon',60,18,undefined,undefined],
    [6,'nest-envoy',12,10,12,true],
  ])('actual next-node definition %s / %s stays unscaled in both modes', (position, id, hp, atk, hearts, heartsMode) => {
    const normal = enter('standard', position);
    const hard = enter('elite', position);
    expect(stats(normal)).toEqual([{ id, hp, maxHp:hp, atk, hearts, heartsMode }]);
    expect(stats(hard)).toEqual([{ id, hp, maxHp:hp, atk, hearts, heartsMode }]);
    expect(hard).toEqual(normal);
    // Positive control: the real expedition scaler would change these values, but the lab caller did not use it.
    expect(modeCfg().enemyMul).toBe(1.35);
    expect(scaledEnemy({ hp:30, atk:9 })).toEqual({ hp:41, atk:12 });
  });
  it.each([
    [0,[['nest-ancient-dragon',99,9,undefined,undefined]]],
    [0.99,[['nest-elem-lord',32,8,32,true],['nest-storm-hand',16,4,16,true],['nest-storm-hand',16,4,16,true]]],
  ])('original boss selection roll %s preserves counts, adds and stat/heart fields', (roll, rows) => {
    const normal = enter('standard', 9, roll);
    const hard = enter('elite', 9, roll);
    const expected = rows.map(([id, hp, atk, hearts, heartsMode]) => ({ id, hp, maxHp:hp, atk, hearts, heartsMode }));
    expect(stats(normal)).toEqual(expected);
    expect(stats(hard)).toEqual(expected);
    expect(hard).toEqual(normal);
  });
});
