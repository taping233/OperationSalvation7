import { battleRules, damageRuleFields } from './helpers/environment-fixtures.js';
import { battleItemSources, expectBattleItemCommitted } from './helpers/battle-item-assertions.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { ...battleRules(30, 200, 99, 0, 99, 1) }, items: {} } };
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const { createBattleBag } = await import('../game/src/battle/bag/battle.bag.js');
const settle = () => vi.advanceTimersByTimeAsync(3000);
const strike = { id: 'item-strike', name: '道具取回靶牌', type: '武术', cost: 0, dmg: 1, dmgType: 'fixed', desc: '',
  rules: { ...damageRuleFields(false, 'chosenEnemy') } };
const recall = { id: 'item-recall', name: '取回道具', type: '法术', cost: 0, desc: '复活最多3张卡牌。',
  rules: { version: 1, battle: { target: { side: 'self', area: false } } } };
const healing = { id: 'item-heal-text', name: '同步回复道具', type: '道具', desc: '回复 5 点生命。' };
const textItem = { id: 'item-armor-text', name: '异步护甲道具', type: '道具', desc: '获得 1 点护甲。',
  rules: { version: 1, battle: { target: { side: 'self', area: false } } } };
const energyItem = { id: 'item-energy-structured', name: '结构化能量道具', type: '道具', desc: '',
  rules: { version: 1, bag: { use: [{ op: 'energy', amount: 1 }] } } };
let game;

async function start(cards, mode = 'normal') {
  game = { ownedCards: cards.map((card, i) => ({ uid: `item-${i}`, card: structuredClone(card), safe: false })),
    hp: 50, maxHp: 100, atk: 5, spellPower: 0, coins: 0, turn: 1, myClass: '侠客', characterId: null,
    cardOrder: [], usedPocket: [], eventLog: [], inventory: [], state: 'idle', battleActive: false,
    logs: [], log(message) { this.logs.push(message); this.onLog?.(message); },
    heal(amount) { this.onHeal?.(); this.hp = Math.min(this.maxHp, this.hp + amount); },
    onBattleEnd: vi.fn(function (opts, played, win, consumed) { this.ended = { opts, played, win, consumed }; }) };
  BattleSession.start(game, [{ id: 'item-foe', name: '道具结算靶', hp: 9999, atk: 0 }],
    { isBoss: mode === 'boss', directBossStart: mode === 'boss' });
  await settle();
  return game;
}
const pool = () => BattleSession.getSnapshot().consumedPile;
const sourceCount = uid => battleItemSources(game, runtime, uid).length;
beforeEach(() => { vi.useFakeTimers(); runtime.set$lastDeckSel([]); });
afterEach(() => {
  if (runtime.G?.battleActive) engine.finish(null);
  game = null; vi.clearAllTimers(); vi.useRealTimers();
});

it('真实能源结晶取回已完成牌，自己仅在效果结束后可见且保留永久原UID来源', async () => {
  const crystal = Cards.all().find(card => card.id === 'tt-crystal');
  expect(crystal).toBeTruthy();
  await start([strike, crystal]);
  const original = game.ownedCards.find(entry => entry.uid === 'item-1');
  BattleSession.commands.playCard('item-0', 0); await settle();
  let during;
  game.onLog = message => { if (message.includes('复原 1 张消耗牌')) during = BattleSession.getSnapshot(); };
  BattleSession.commands.usePotion('item-1'); await settle();
  expect(during.hand).toContain('item-0');
  expect(during.hand).not.toContain('item-1');
  expect(during.consumedPile).not.toContain('item-1');
  expect(pool()).toEqual(['item-1']);
  expect(expectBattleItemCommitted(game, runtime, 'item-1')).toBe(original);
  expect(game.ownedCards.find(entry => entry.uid === 'item-1')).toBe(original);
  expect(game.usedPocket).toEqual([]);
  expect(BattleSession.getSnapshot().potionBar.some(entry => entry.uid === 'item-1')).toBe(false);
});

it.each([
  ['永久同步', healing, false, 'normal'], ['永久结构化', energyItem, false, 'normal'],
  ['临时异步', textItem, true, 'normal'], ['boss临时', energyItem, true, 'boss'],
])('%s道具使用后可按原UID取回再使用，来源及战后账本各一次', async (_label, item, temporary, mode) => {
  await start(temporary ? [recall] : [recall, item], mode);
  const uid = temporary ? engine.addTempCard(structuredClone(item)) : 'item-1';
  BattleSession.commands.usePotion(uid); await settle();
  expect(pool()).toContain(uid);
  expect(sourceCount(uid)).toBe(1);
  const retained = expectBattleItemCommitted(game, runtime, uid);
  expect(engine.findCard(uid)).toBe(retained);
  BattleSession.commands.playCard('item-0', 'self'); await settle();
  expect(runtime.hand).toContain(uid);
  expect(pool()).not.toContain(uid);
  for (const name of ['played', 'consumed', 'discard', 'grave']) expect(runtime[name]).not.toContain(uid);
  expect(BattleSession.getSnapshot().potionBar.some(entry => entry.uid === uid)).toBe(true);
  BattleSession.commands.usePotion(uid); await settle();
  expect(runtime.hand).not.toContain(uid);
  expect(pool()).toContain(uid);
  expect(runtime.played.filter(value => value === uid)).toHaveLength(1);
  expect(sourceCount(uid)).toBe(1);
  expect(game.ownedCards.some(entry => entry.uid === uid)).toBe(!temporary);
  expect(game.usedPocket).toEqual([]);
  engine.finish(true); await settle();
  expect(game.onBattleEnd).toHaveBeenCalledTimes(1);
  expect(game.ended.played.filter(value => value === uid)).toHaveLength(1);
  expect(game.ended.opts.spentCards).toEqual(temporary ? [{uid, card:retained.card}] : []);
  expect(game.ownedCards.filter(entry => entry.uid === uid)).toEqual(temporary ? [] : [retained]);
  engine.finish(true);
  expect(game.onBattleEnd).toHaveBeenCalledTimes(1);
});

function delayedBag(extra = {}) {
  let execute;
  const queue = vi.fn(action => { execute = action; return Promise.resolve(); });
  const bag = createBattleBag({ requestBattleRender: vi.fn(), clearTargetSession: vi.fn(),
    interactionOf: () => null, queueBattleAction: queue,
    throwIfActionCancelled: signal => { if (signal.aborted) throw new Error('cancelled'); },
    alive: () => runtime.foes.filter(foe => !foe.dead), findCard: engine.findCard,
    getTurn: () => runtime.turn, ...extra });
  return { bag, queue, execute: () => execute(new AbortController().signal) };
}

it('真实会话道具入队即隐藏且禁止重复；执行前目标失效则不消费不入账', async () => {
  const item = { id: 'item-targeted', name: '目标失效道具', type: '道具', desc: '',
    rules: { version: 1, bag: { use: [{ op: 'damage', amount: 2, dmgType: 'fixed', target: 'chosenEnemy' }] } } };
  await start([item]);
  const delayed = delayedBag();
  delayed.bag.useItem('item-0', 0);
  expect(delayed.bag.battleBagItems()).toEqual([]);
  delayed.bag.useItem('item-0', 0);
  expect(delayed.queue).toHaveBeenCalledTimes(1);
  runtime.foes[0].dead = true;
  await delayed.execute();
  expect(game.ownedCards.map(entry => entry.uid)).toEqual(['item-0']);
  expect(sourceCount('item-0')).toBe(1);
  expect(runtime.played).not.toContain('item-0');
  expect(delayed.bag.battleBagItems().map(entry => entry.uid)).toEqual(['item-0']);
});

it('旧战斗延迟动作不向新战同名UID写入消耗账本，也不阻塞新战使用', async () => {
  await start([energyItem]);
  const previous = delayedBag();
  previous.bag.useItem('item-0');
  const oldGame = game;
  engine.finish(null);
  await start([healing]);
  const before = BattleSession.getSnapshot();
  await previous.execute();
  expect(runtime.played).toEqual(before.played);
  expect(pool()).toEqual(before.consumedPile);
  expect(game.ownedCards.map(entry => entry.uid)).toEqual(['item-0']);
  expect(oldGame.ownedCards.map(entry => entry.uid)).toEqual(['item-0']);
  BattleSession.commands.usePotion('item-0'); await settle();
  expect(pool()).toContain('item-0');
});

it('同步效果异常仍保留已提交消耗账本，finally解除取回屏蔽', async () => {
  await start([healing]);
  game.onHeal = () => { throw new Error('injected heal failure'); };
  BattleSession.commands.usePotion('item-0'); await settle();
  expect(pool()).toContain('item-0');
  expect(runtime.played.filter(uid => uid === 'item-0')).toHaveLength(1);
  expect(sourceCount('item-0')).toBe(1);
  expect(expectBattleItemCommitted(game, runtime, 'item-0')).toBe(game.ownedCards[0]);
});

it('异步效果异常仍保留已消费原UID，fallback取回池在finally后可见', async () => {
  await start([textItem]);
  const applyTextEffects = Object.assign(() => {}, { steps: () => [] });
  const delayed = delayedBag({ applyTextEffects, runStagedSteps: async () => { throw new Error('injected steps failure'); } });
  delayed.bag.useItem('item-0');
  await expect(delayed.execute()).rejects.toThrow('injected steps failure');
  expect(pool()).toContain('item-0');
  expect(runtime.played.filter(uid => uid === 'item-0')).toHaveLength(1);
  expect(sourceCount('item-0')).toBe(1);
  expect(expectBattleItemCommitted(game, runtime, 'item-0')).toBe(game.ownedCards[0]);
  expect(delayed.bag.restoreConsumed(1)).toBe(1);
  expect(runtime.hand).toContain('item-0');
});

it('致命结构化道具在效果内finish前已提交来源与账本，战后只结算一次', async () => {
  const lethal = { id: 'item-lethal', name: '致命道具', type: '道具', desc: '',
    rules: { version: 1, bag: { use: [{ op: 'damage', amount: 99999, dmgType: 'fixed', target: 'chosenEnemy' }] } } };
  await start([lethal]);
  const original = game.ownedCards[0];
  BattleSession.commands.usePotion('item-0'); await settle();
  expect(game.battleActive).toBe(false);
  expect(game.onBattleEnd).toHaveBeenCalledTimes(1);
  expect(game.ended.win).toBe(true);
  expect(game.ended.played).toEqual(['item-0']);
  expect(game.ended.opts.spentCards).toEqual([]);
  expect(game.ownedCards.filter(entry => entry.uid === 'item-0')).toEqual([original]);
  expect(game.usedPocket).toEqual([]);
  engine.finish(true);
  expect(game.onBattleEnd).toHaveBeenCalledTimes(1);
});
