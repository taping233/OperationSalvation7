// Regression coverage for elite-mode 1.35 scaling through public event and reward paths.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mapData from '../game/data/map.json';

// Public event controller + real scaler/commands/coin award; UI, storage and battle-start are ports.
const H = vi.hoisted(() => ({ game:{}, map:{ rules:{ fireHeal:10 } }, cards:[], acts:{}, draws:[],
  start:vi.fn(async () => true), save:vi.fn(() => true) }));
vi.mock('../game/src/run/game.session.kernel.js', () => ({ game:H.game, MAP:H.map }));
vi.mock('../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random:{ ...actual.Random, random:stream => { H.draws.push(stream); return 0; } } };
});
let UI, scaler, gainCoins, createController, createCommands, createChoice, optionHTML, narrative, captureContext, setReturn, previousSDT;
beforeAll(async () => {
  previousSDT = window.SDT;
  UI = { el:{}, act:(name, action) => { H.acts[name] = action; }, refresh() {}, log() {},
    showOverlay(_title, html) { UI.el.ovBody.innerHTML = html; UI.el.overlay.hidden = false; },
    hideOverlay() { UI.el.overlay.hidden = true; UI.el.ovBody.innerHTML = ''; } };
  window.SDT = { game:H.game, UI, Sound:{ sfx() {} }, Meta:{ setXpMul() {} }, Base:{ slot:null, bagCap:() => 9 },
    Cards:{ all:() => H.cards, cardHTML:card => card.name, isRandomObtainable:() => true } };
  ({ scaledEnemy:scaler } = await import('../game/src/run/game.session.modes.js'));
  ({ gainCoins } = await import('../game/src/run/game.session.bag.js'));
  ({ createRunEventController:createController } = await import('../game/src/run/game.run.events.js'));
  ({ createEventCommands:createCommands } = await import('../game/src/run/event-commands.js'));
  ({ createEventCardChoiceController:createChoice } = await import('../game/src/run/event-card-choice.js'));
  ({ eventOptionHTML:optionHTML } = await import('../game/src/ui/event-option-state.js'));
  ({ eventNarrative:narrative } = await import('../game/src/home/narrative.js'));
  ({ captureBattleContext:captureContext } = await import('../game/src/battle/battle-loader.js'));
  ({ setBagReturnHook:setReturn } = await import('../game/src/hub/bag-return-hook.js'));
});
beforeEach(() => {
  H.start.mockClear(); H.save.mockClear(); H.acts = {}; H.draws = []; H.cards = [];
  for (const key of Object.keys(H.game)) delete H.game[key];
  Object.assign(H.map, structuredClone(mapData));
  Object.assign(H.game, { mode:'elite', seed:'mode-events', state:'idle', runActive:true, layerIdx:0, trackPos:0,
    discoveredPairs:new Set(), layerData:[{ logical:[{ def:{ type:'event' } }] }],
    hp:30, maxHp:30, coins:0, ownedCards:[], visited:{}, nodeRewards:{}, canReceiveCard:() => true });
  document.body.innerHTML = '<div id="overlay" hidden><div id="ovBody"></div></div>';
  UI.el = { overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') };
});
afterEach(() => { setReturn(null); UI.hideOverlay(); });
afterAll(() => { window.SDT = previousSDT; });

async function openEvent(id, resolveNarrative = narrative) {
  H.cards = [{ id, name:'模式事件夹具', type:'事件' }];
  const award = vi.fn(gainCoins);
  const unused = () => { throw new Error('Unexpected unrelated event path'); };
  const controller = createController({ game:H.game, UI, dom:document, MAP:H.map,
    getCards:() => window.SDT.Cards, sound:() => {}, serializeReward:() => null,
    eventCommands:createCommands({ state:H.game, gainCoins:award, grantCard:unused, heal:unused, damage:unused }),
    scaledEnemy:scaler, startBattle:H.start, getActiveSlot:() => null, saveGame:H.save,
    pick:items => items[0], weighted:items => items[0], eventNarrative:resolveNarrative,
    lastLampNarrative:async () => null, eventOptionHTML:optionHTML,
    captureRunContext:() => captureContext(H.game, () => null),
    createCardChoice:options => createChoice({ ...options, SDT:window.SDT }), createDice:unused,
    nodeShell:spec => UI.showOverlay('', `<main>${spec.body || ''}${spec.foot || ''}</main>`),
    nodeOpt:(act, label) => `<button data-act="${act}">${label}</button>`,
    enterNode:async (_kind, done) => done(),
    consumeCurrentCell:() => { H.game.visited[`${H.game.layerIdx},${H.game.trackPos}`] = 1; },
    finishInstant:() => { H.game.state = 'idle'; }, cancelLegacyChainMove:unused,
    grantEventCard:unused, openFixedRewardsOnCell:unused, openChestsOnCell:unused, openPocketRestore:unused,
    setBagReturnHook:setReturn, bagSlots:{}, setCardPageOpen() {}, RunStorage:{}, storyCommands:{},
  });
  await controller.runEventDeck();
  expect(H.acts.evtChoice).toBeTypeOf('function');
  return { award, choose:async index => { H.acts.evtChoice({ i:String(index) }); await Promise.resolve(); } };
}

describe.each(['standard','elite'])('actual built-in bandit narrative/controller in %s', mode => {
  it.each([[0,3],[1,4],[2,5],[3,5]])('layer index %s keeps %s enemies and pending reward', async (layer, count) => {
    H.game.mode = mode; H.game.layerIdx = layer;
    const original = structuredClone(H.map.monsters.bandit);
    const page = await openEvent('tt6-bandits'); await page.choose(0);
    expect(H.start).toHaveBeenCalledOnce();
    const [game, foes, options] = H.start.mock.calls[0];
    expect(game).toBe(H.game); expect(foes).toHaveLength(count);
    const expected = { ...original, hp:mode === 'elite' ? 4 : 3, atk:mode === 'elite' ? 4 : 3 };
    expect(foes).toEqual(Array.from({ length:count }, () => expected));
    expect(H.map.monsters.bandit).toEqual(original);
    expect(options).toEqual({ isBoss:false, layer, name:original.name });
    expect(H.game.pendingEventLoot).toEqual({ text:'密封物资箱 ×2', chests:['medium','medium'] });
    expect(page.award).not.toHaveBeenCalled(); expect(H.game.coins).toBe(0);
    expect(H.draws.filter(stream => stream === 'enemy')).toEqual([]);
  });
});

const strikeNarrative = async () => ({ intro:'旧事件兼容夹具', choices:[
  { label:'攻击', detail:'固定减去 5 HP', effect:'goldhammer_strike', choose:() => '' },
] });
describe.each(['standard','elite'])('retained legacy/custom hammer controller in %s', mode => {
  it.each([[3,-2,-1],[4,-1,0],[6,1,3]])('base HP %s retains fixed -5 and existing reward branch', async (hp, normalLeft, hardLeft) => {
    H.game.mode = mode;
    // Explicit old-schema fixture: current built-in map has entries, not this legacy top-level pool.
    H.map.monsters.legacy_foe = { id:'legacy_foe', name:'旧事件敌人', hp, atk:4, behavior:'strike' };
    H.map.encounters[0].pool = ['legacy_foe'];
    const original = structuredClone(H.map.monsters.legacy_foe);
    const page = await openEvent('custom-legacy-hammer', strikeNarrative); await page.choose(0);
    const remaining = mode === 'elite' ? hardLeft : normalLeft;
    if (remaining <= 0) {
      expect(H.start).not.toHaveBeenCalled(); expect(page.award).toHaveBeenCalledExactlyOnceWith(2);
      expect(H.game.coins).toBe(mode === 'elite' ? 3 : 2);
      expect(H.game.state).toBe('idle');
    } else {
      expect(H.start).toHaveBeenCalledExactlyOnceWith(H.game,
        [{ ...original, hp:remaining, atk:mode === 'elite' ? 5 : 4 }],
        { isBoss:false, layer:0, name:original.name });
      expect(page.award).not.toHaveBeenCalled(); expect(H.game.coins).toBe(0);
    }
    expect(H.draws.filter(stream => stream === 'enemy')).toEqual(['enemy']);
    expect(H.map.monsters.legacy_foe).toEqual(original);
    // Base HP4 was old-hard 6 minus5 =1; the new hard value5 reaches the existing instant-win branch.
    // Do not assert equal battle/XP/whole-playthrough RNG outcomes across that threshold.
  });
  it('current built-in hammer remains V2 commission/receive-card, not legacy strike', async () => {
    H.game.mode = mode;
    const page = await openEvent('tt6-goldhammer', strikeNarrative); await page.choose(1);
    expect(H.game.nodeRewards['0,0'].commission).toEqual({ status:'pending' });
    expect(H.start).not.toHaveBeenCalled(); expect(page.award).not.toHaveBeenCalled();
    expect(H.draws.filter(stream => stream === 'enemy')).toEqual([]); expect(H.game.coins).toBe(0);
  });
});
