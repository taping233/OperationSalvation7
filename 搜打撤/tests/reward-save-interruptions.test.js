// Isolated jsdom storage only. Real session save/load, grant, capacity and chest controller.
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

let session, game, UI, Base, Chests, RunStorage, Random;
const reward = { id:'interruption-reward', name:'中断奖励', type:'法术', rarity:'古朴', desc:'', cost:0 };
const clone = value => JSON.parse(JSON.stringify(value));
const ctx = new Proxy({}, { get:() => () => ctx, set:() => true });

beforeAll(async () => {
  document.body.innerHTML = readFileSync('game/index.html', 'utf8');
  window.HTMLCanvasElement.prototype.getContext = () => ctx;
  window.SDT = {
    MAP:JSON.parse(readFileSync('game/data/map.json', 'utf8')),
    Icons:{ img:() => '', rich:String, TYPE_ART:{} },
    Sound:{ music() {}, sfx:vi.fn(), setDucked() {} }, FX:{ feedback() {} },
  };
  await import('../game/src/cards/cards.js');
  await import('../game/src/ui/ui.js');
  await import('../game/src/hub/base.js');
  session = await import('../game/src/run/game.session.js');
  ({ RunStorage } = await import('../game/src/hub/game.storage.js'));
  ({ Random } = await import('../game/src/core/random.js'));
  const { grantEventCard } = await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js');
  ({ UI, Base, Chests } = window.SDT); game = session.game;
  UI.init(); UI.log = vi.fn(); UI.refresh = () => {};
  window.SDT.Cards.cardHTML = card => `<span>${card.name}</span>`;
  window.SDT.Cards.cardBackHTML = () => '';
  window.SDT.Meta = { setXpMul() {}, track() {} };
  game.grantCard = grantEventCard;
  game.persistSave = session.saveGame;
  session.configureGameRuntime({ resumeChestsOnCell:saved => Chests.restore(game, saved, () => {}), openClassChoice:vi.fn() });
});
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); RunStorage.remove(1);
  Base.use(1); Base.reset(1); session._set_active_slot(1);
  game.seed = Random.reseed('reward-interruption');
  session.buildDerived(game.seed);
  Object.assign(game, { runActive:true, nestActive:false, battleActive:false, state:'idle', myClass:'战士',
    pendingExtraction:null, extractionPending:null, terminalPending:null, nodeChestRewards:{},
    layerIdx:0, trackPos:game.layerData[0].entrances[0], coins:0, inventory:[], ownedCards:[], usedPocket:[],
    cardOrder:[], elapsed:0, elapsedSynced:0 });
  expect(session.saveGame()).toBe(true);
});
afterEach(() => { UI.hideOverlay({ immediate:true }); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

const saved = () => RunStorage.read(1);
const count = id => game.ownedCards.filter(item => item.card.id === id).length;
function restore() { const result = session.loadGame(1); expect(result, JSON.stringify(result)).toMatchObject({ ok:true, value:true }); }
function open() {
  vi.spyOn(window.SDT.Cards, 'randomDropCard').mockReturnValue(reward);
  vi.spyOn(Base, 'petEggDropChance').mockReturnValue(0);
  Chests.open(game, [{kind:'small'}], () => {}, {onCell:true});
  UI._acts.chestNext();
}

it('开箱收币后动画中关页、重开与实际读档均保留同一单卡，不重抽或重复收币', () => {
  open();
  expect(saved().chestReward.current.rewardStage).toBe('opening');
  expect(saved().coins).toBe(1);
  const rng = clone(Random.snapshot());
  const staleReveal = UI._acts.chestReveal;
  UI._acts.chestClosePicker();
  expect(saved().chestReward.screen).toBe('overview');
  restore(); UI._acts.chestNext();
  staleReveal(); vi.advanceTimersByTime(10000);
  expect(Chests.serialize(game).current.cards).toEqual([reward]);
  expect(game.coins).toBe(1); expect(count(reward.id)).toBe(0);
  expect(Random.snapshot()).toEqual(rng);
  expect(window.SDT.Cards.randomDropCard).toHaveBeenCalledTimes(1);
});

it('成功授予后立即返回地图，飞卡尚未完成也已保存；读档再进入和旧回调不重领', async () => {
  open(); UI._acts.chestReveal();
  const staleTake = UI._acts.chestTake1;
  staleTake({i:0});
  expect(saved().ownedCards.filter(item => item.card.id === reward.id)).toHaveLength(1);
  expect(saved().chestReward.current.taken).toEqual([0]);
  expect(document.querySelector('.bt-card-reveal')).not.toBeNull();
  await UI._acts.chestReturn();
  expect(document.querySelector('.bt-card-feedback-layer')).toBeNull();
  const location = `${game.layerIdx},${game.trackPos}`;
  restore();
  expect(Chests.restore(game, game.nodeChestRewards[location], () => {})).toBe(true);
  staleTake({i:0}); staleTake({i:0});
  expect(UI._acts.chestTake1).toBeUndefined();
  vi.advanceTimersByTime(10000);
  expect(count(reward.id)).toBe(1); expect(game.coins).toBe(1);
  expect(saved().ownedCards.filter(item => item.card.id === reward.id)).toHaveLength(1);
});

it('满包失败保存后读档腾位再领，只有成功领取更新taken且再次读档不重复', () => {
  game.inventory = Array.from({length:session.bagCap()}, (_, i) => ({name:`物资${i}`,count:1,value:1}));
  open(); UI._acts.chestReveal(); UI._acts.chestTake1({i:0});
  expect(session.usedSlots()).toBe(session.bagCap());
  expect(saved().chestReward.current.taken).toEqual([]); expect(count(reward.id)).toBe(0);
  restore(); game.inventory.pop(); expect(session.saveGame()).toBe(true);
  const take = UI._acts.chestTake1; take({i:0}); take({i:0});
  expect(count(reward.id)).toBe(1); expect(saved().chestReward.current.taken).toEqual([0]);
  restore(); UI._acts.chestTake1({i:0}); expect(count(reward.id)).toBe(1);
});

it('旧三选一小箱在选择前后真实保存恢复，保留三张候选及永久放弃索引', () => {
  const cards = [0,1,2].map(i => ({...reward,id:`legacy-${i}`,name:`旧奖励${i}`}));
  const current = {kind:'small',cards,coins:1,coinsReceived:true,rewardStage:'cards',claimMode:'one',choiceCount:3,taken:[],lost:[]};
  const snapshot = {version:1,seed:game.seed,layerIdx:game.layerIdx,trackPos:game.trackPos,
    queue:[{kind:'small',reward:current}],index:1,current,screen:'cards',context:{onCell:true}};
  expect(Chests.restore(game,snapshot,() => {})).toBe(true);
  restore(); expect(Chests.serialize(game).current.cards).toEqual(cards);
  const pick = UI._acts.chestPick; pick({i:1}); pick({i:2});
  expect(saved().chestReward.current).toMatchObject({taken:[1],lost:[0,2],choiceCount:3});
  restore(); UI._acts.chestPick({i:0});
  expect(game.ownedCards.map(item => item.card.id)).toEqual(['legacy-1']);
  expect(Chests.serialize(game).current.cards).toEqual(cards);
});


it('授予后的实际写盘失败不写半份奖励，读档回退后可重新领取一次', () => {
  open(); UI._acts.chestReveal();
  const diskBefore = localStorage.getItem(RunStorage.key(1));
  const original = Storage.prototype.setItem;
  const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === RunStorage.key(1)) throw new Error('isolated reward quota failure');
    return original.call(this, key, value);
  });
  const oldTake = UI._acts.chestTake1; oldTake({i:0}); oldTake({i:0});
  expect(count(reward.id)).toBe(1);
  expect(Chests.serialize(game).current.taken).toEqual([0]);
  expect(localStorage.getItem(RunStorage.key(1))).toBe(diskBefore);
  failure.mockRestore(); restore();
  expect(count(reward.id)).toBe(0); expect(Chests.serialize(game).current.taken).toEqual([]);
  UI._acts.chestTake1({i:0}); restore();
  expect(count(reward.id)).toBe(1); expect(game.coins).toBe(1);
  expect(saved().chestReward.current.taken).toEqual([0]);
});

it('真实宝箱授予经读档进入撤离整理，入库后重建commands再完成只入仓一次', async () => {
  open(); UI._acts.chestReveal(); UI._acts.chestTake1({i:0}); restore();
  UI._acts.chestFinish();
  const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');
  const { createExtractionCommands } = await import('../game/src/hub/extraction.commands.js');
  const recovery = createRecoveryCommands({ storage:localStorage, baseApi:Base, runStore:RunStorage,
    lockManager:{ request:(_name, _options, callback) => callback() } });
  const deps = { getActiveSlot:() => 1, runStore:RunStorage, baseApi:Base, recovery, game, random:() => .1 };
  const commands = createExtractionCommands(deps);
  const started = await commands.begin();
  expect(started.ok).toBe(true);
  expect(started.value.remainingCards).toEqual([{card:reward,count:1}]);
  const runId = started.value.runId;
  const result = await commands.updateCards([{name:reward.name,count:1}], runId, 1);
  expect(result).toMatchObject({ok:true,count:1});
  game.pendingExtraction = clone(RunStorage.read(1).pendingExtraction);
  const resumed = createExtractionCommands(deps);
  expect(await resumed.updateCards([{name:reward.name,count:1}], runId, 1)).toMatchObject({ok:true,unchanged:true});
  const finished = await resumed.finish(runId, 1);
  expect(finished.ok).toBe(true);
  expect(finished.value.output.receipt.netTake.cardsStashed).toBe(1);
  expect(await resumed.finish(runId, 1)).toMatchObject({ok:false,code:'STALE_RUN'});
  const base = JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)));
  expect(base.stash.filter(stack => stack.card.id === reward.id)).toEqual([{card:reward,count:1}]);
  expect(base.stats.extracts).toBe(1); expect(RunStorage.read(1)).toBeNull();
});
