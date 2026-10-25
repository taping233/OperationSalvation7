import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
const H = vi.hoisted(() => ({ game:{}, UI:{}, random:vi.fn(() => 0.99) }));
vi.mock('../game/src/core/random.js', async original => {
  const actual = await original();
  return { ...actual, Random:{ ...actual.Random, random:(...args) => H.random(...args) } };
});
vi.mock('../game/src/run/game.session.js', () => ({ game:H.game, MAP:{ rules:{ playerMaxHp:35 } },
  getActiveSlot:() => null, saveGame:() => true, clearSave(){}, syncPlayTime(){}, exitToTitle(){} }));
vi.mock('../game/src/ui/ui.js', () => ({ UI:H.UI }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun(){}, readSettlementReceipt(){}, recoverSlot(){} }));
let Nest;
const actions = {};
beforeAll(async () => {
  Object.assign(H.UI, { el:{}, showOverlay(_title, body){ this.el.ovBody.innerHTML = body; this.el.overlay.hidden = false; },
    hideOverlay(){ this.el.overlay.hidden = true; }, act:(name, fn) => { actions[name] = fn; }, log(){}, refresh(){} });
  window.SDT = { game:H.game, UI:H.UI, Icons:{ rich:text => text }, Sound:{ sfx(){} },
    Cards:{ all:() => [], SHA:{ id:'sha' } }, Meta:{ classLv:() => 1, track(){} }, Base:{ data:{} } };
  await import('../game/src/run/game.nest.js'); Nest = window.SDT.Nest;
});
beforeEach(() => {
  vi.restoreAllMocks();
  H.random.mockClear();
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  H.UI.el = { overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') };
  for (const key of Object.keys(H.game)) delete H.game[key];
  Object.assign(H.game, { state:'modal', nestActive:true, runActive:true, seed:7, discoveredPairs:new Set(),
    nestPos:9, nestRunes:[], nestEquipped:[], cardBox:[], ownedCards:[], nestBoss:null, nestBossName:'远古龙尊' });
});

it('restored research boss keeps the saved identity without rerolling the nest random stream', async () => {
  const begin = vi.fn(() => true);
  Nest.bindBattleStart(begin); Nest.renderNestMap(); actions.nestCell10();
  expect(begin.mock.calls[0][1][0].id).toBe('nest-ancient-dragon');
  expect(H.game.nestBossName).toBe('远古龙尊');
  expect(H.random).not.toHaveBeenCalled();
});

it('research payload retains exact kills and boss result and rejects malformed progress', async () => {
  const { createSessionPersistence } = await import('../game/src/run/game-session-persistence.js');
  const { validateRunSave } = await import('../game/src/hub/run-save-validation.js');
  H.game.nestKills = 7; H.game.nestBossDown = true;
  const { createRunSavePayload } = createSessionPersistence({ readState:() => ({ game:H.game, activeSlot:null }),
    readServices:() => ({}), Random:{ seed:7, snapshot:() => ({}) }, assertZones(){}, snapshotRunBattles:() => ({}) });
  const payload = createRunSavePayload();
  expect(payload.nestKills).toBe(7); expect(payload.nestBossDown).toBe(true);
  expect(validateRunSave(payload).ok).toBe(true);
  expect(validateRunSave({ ...payload, nestKills:-1 }).ok).toBe(false);
  expect(validateRunSave({ ...payload, nestBossDown:'true' }).ok).toBe(false);
});

it.each([{ nestKills:8, nestBossDown:true }, {}])('research load replaces another run progress using saved facts or legacy defaults (%j)', async fields => {
  const { createSessionRestoration } = await import('../game/src/run/game-session-restoration.js');
  const { validateRunSave } = await import('../game/src/hub/run-save-validation.js');
  const run = { seed:7, nestActive:true, nestPos:9, cardBox:[], nestRunes:[], nestEquipped:[], ...fields };
  const state = { game:{ nestKills:99, nestBossDown:true }, runtime:{} };
  const restore = createSessionRestoration({ readState:() => state,
    readServices:() => ({ Base:{ use(){}, issue:() => null, data:{ stats:{}, stash:[], pocket:[] } },
      Cards:{ applyAbilityRename:() => false, applyDuplicateRenames:() => false }, Nest:{ renderNestMap(){} } }),
    readUI:() => ({ log(){} }), development:false,
    RunStorage:{ readIdentity:() => ({ ok:true, value:{ runId:'nest-progress' } }), readForPreflight:() => run, acceptLoad:() => ({ ok:true }) },
    validateRunSave, planMapRestore:() => ({ ok:true, value:{ source:'nest' } }), trackRestoration:work => work(),
    Random:{ restore:() => 7 }, restoreRunBattles(){}, setLobby(){}, MAP:{ rules:{ playerMaxHp:35, playerAtk:2 } },
    MODES:{ standard:{} }, applyModeRules(){}, refreshCardClones(){} });
  expect(restore.loadGame(1).ok).toBe(true);
  expect(state.game.nestKills).toBe(fields.nestKills || 0);
  expect(state.game.nestBossDown).toBe(fields.nestBossDown || false);
});
