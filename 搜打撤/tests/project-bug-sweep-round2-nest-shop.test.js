import { connectSdtFixture } from './helpers/environment-fixtures.js';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
const H = vi.hoisted(() => ({ game:{}, UI:{}, cards:[], saves:[], saveResult:true }));
vi.mock('../game/src/run/game.session.js', () => ({ game:H.game, MAP:{ rules:{ playerMaxHp:35 } },
  getActiveSlot:() => null, saveGame:() => { H.saves.push(JSON.parse(JSON.stringify(H.game))); return H.saveResult; },
  clearSave(){}, syncPlayTime(){}, exitToTitle(){} }));
vi.mock('../game/src/ui/ui.js', () => ({ UI:H.UI }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun(){}, readSettlementReceipt(){}, recoverSlot(){} }));
const actions = {};
let Nest;
beforeAll(async () => {
  Object.assign(H.UI, { el:{}, showOverlay(_title, body) {
    for (const key of Object.keys(actions)) delete actions[key];
    this.el.ovBody.innerHTML = body; this.el.overlay.hidden = false;
  }, hideOverlay(){ this.el.overlay.hidden = true; }, act:(name, fn) => { actions[name] = fn; }, log(){}, refresh(){} });
  await connectSdtFixture({ game:H.game, UI:H.UI, Icons:{ rich:text => text }, Sound:{ sfx(){} },
    Cards:{ all:() => H.cards, isRandomObtainable:card => card.rarity !== '初始', SHA:{ id:'sha' } },
    Meta:{ classLv:() => 1, track(){}, checkUnlocks(){} }, Base:{ data:{ nestBagUp:0 }, isSha:card => card.id === 'sha' } });
  await import('../game/src/run/game.nest.js'); Nest = window.SDT.Nest;
});
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  H.UI.el = { overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') };
  for (const key of Object.keys(H.game)) delete H.game[key];
  Object.assign(H.game, { seed:7, discoveredPairs:new Set(), state:'modal', runActive:true, nestActive:true,
    nestPos:2, nestEquipped:[], nestRunes:[], pendingRunePick:null, nestTargetedBox:0, battleActive:false,
    ownedCards:[], cardBox:[], coins:50, hp:35, maxHp:35, elapsed:0 });
  H.cards = Array.from({ length:8 }, (_, i) => ({ id:`loot${i}`, name:`商品${i}`, rarity:'古朴', type:'法术' }));
  H.cards.push({ id:'class', name:'职业', rarity:'职业', type:'法术' });
  H.saves = []; H.saveResult = true;
});
const enter = async (position = 2) => { H.game.nestPos = position; Nest.renderNestMap(); await actions[`nestCell${position + 1}`](); };

it('research shop reentry keeps generated stock and sold slots without consuming RNG', async () => {
  const { Random } = await import('../game/src/core/random.js');
  await enter(); await actions.nsC0();
  expect(H.game.cardBox).toHaveLength(1); const coins = H.game.coins;
  const snapshot = JSON.stringify(H.game.nestShopStocks), rng = Random.snapshot();
  await enter();
  expect(H.UI.el.ovBody.querySelector('[data-act="nsC0"]')).toBeNull();
  expect(JSON.stringify(H.game.nestShopStocks)).toBe(snapshot);
  expect(H.game.coins).toBe(coins); expect(Random.snapshot()).toEqual(rng);
});

it('a saved purchase freezes card, payment and sold status together and survives a JSON roundtrip', async () => {
  await enter(); await actions.nsC0();
  const saved = H.saves.at(-1);
  expect(saved.coins).toBe(47); expect(saved.cardBox).toHaveLength(1);
  expect(saved.nestShopStocks['3'].cardSlots[0].sold).toBe(true);
  Object.assign(H.game, saved); await enter();
  expect(H.UI.el.ovBody.querySelector('[data-act="nsC0"]')).toBeNull();
  expect(H.game.cardBox).toHaveLength(1);
  await enter(7); expect(H.UI.el.ovBody.querySelector('[data-act="nsC0"]')).not.toBeNull();
  expect(H.game.nestShopStocks['3']).not.toBe(H.game.nestShopStocks['8']);
});

it('failed checkpoint preserves the same in-memory shelf for retry and does not restore sold goods', async () => {
  await enter(); H.saveResult = false; const buying=actions.nsR0();
  await vi.waitFor(()=>expect(actions.nestProgressRetry).toBeTypeOf('function'));
  expect(H.saves.at(-1).nestShopStocks['3'].runeSlots[0].sold).toBe(true);
  expect(H.UI.el.ovBody.textContent).toContain('本次操作与收获已保留');
  H.saveResult=true; await actions.nestProgressRetry(); expect(await buying).toBe(true);
  await enter(); expect(H.UI.el.ovBody.querySelector('[data-act="nsR0"]')).toBeNull();
  expect(H.game.nestRunes).toHaveLength(1);
});

it('real payload and load preserve optional research shelves and reject malformed shelf data', async () => {
  await enter(); await actions.nsC0();
  const { createSessionPersistence } = await import('../game/src/run/game-session-persistence.js');
  const { createSessionRestoration } = await import('../game/src/run/game-session-restoration.js');
  const { validateRunSave } = await import('../game/src/hub/run-save-validation.js');
  const { createRunSavePayload } = createSessionPersistence({ readState:() => ({ game:H.game, activeSlot:null }),
    readServices:() => ({}), Random:{ seed:7, snapshot:() => ({}) }, assertZones(){}, snapshotRunBattles:() => ({}) });
  const payload = createRunSavePayload();
  expect(payload.nestShopStocks).toEqual(H.game.nestShopStocks); expect(validateRunSave(payload).ok).toBe(true);
  expect(validateRunSave({ ...payload, nestShopStocks:{ 3:{ cardSlots:[] } } }).ok).toBe(false);
  const state = { game:{}, runtime:{} };
  const makeRestoration = run => createSessionRestoration({ readState:() => state,
    readServices:() => ({ Base:{ use(){}, issue:() => null, syncPlayTime:() => ({ changed:false }), data:{ stats:{}, stash:[], pocket:[] } },
      Cards:{ applyAbilityRename:() => false, applyDuplicateRenames:() => false }, Nest:{ renderNestMap(){} } }),
    readUI:() => ({ log(){} }), development:false,
    RunStorage:{ readIdentity:() => ({ ok:true, value:{ runId:'nest-shop' } }), readForPreflight:() => run, acceptLoad:() => ({ ok:true }) },
    validateRunSave, planMapRestore:() => ({ ok:true, value:{ source:'nest' } }), trackRestoration:work => work(),
    Random:{ restore:() => 7 }, restoreRunBattles(){}, setLobby(){}, MAP:{ rules:{ playerMaxHp:35, playerAtk:2 } },
    MODES:{ standard:{} }, applyModeRules(){}, refreshCardClones(){}, recordBaseSaveForLoad(){} });
  expect(makeRestoration(payload).loadGame(1).ok).toBe(true);
  expect(state.game.nestShopStocks).toEqual(payload.nestShopStocks);
  delete payload.nestShopStocks;
  expect(makeRestoration(payload).loadGame(1).ok).toBe(true); expect(state.game.nestShopStocks).toEqual({});
});
