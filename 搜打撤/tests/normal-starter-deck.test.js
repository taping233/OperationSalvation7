import { battleRules } from './helpers/environment-fixtures.js';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { ...battleRules(30, 200, 3, 2, 2, 1) }, items: {} } };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const E = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const { restoreBattlePiles } = await import('../game/src/battle/runtime/battle.runtime.piles.js');
const { createDrawDomain } = await import('../game/src/battle/core/battle.draw.domain.js');
let sequence = 0;
const card = (ops, extra = {}) => ({ id: `normal-deck-test-${sequence++}`, name: '牌库测试', type: '法术',
  cost: 0, desc: '', rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: ops } }, ...extra });
const foe = () => ({ id: 'deck-target', name: '牌库靶', hp: 9999, atk: 0 });
function start(cards = [], options = {}) {
  const game = { ownedCards: cards.map((value, index) => ({ uid: `owned-${index}`, card: structuredClone(value) })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, turn: 1, characterId: null, myClass: '战士',
    cardOrder: [], usedPocket: [], eventLog: [], inventory: [], state: 'idle', battleActive: false,
    logs: [], log(value) { this.logs.push(value); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, onBattleEnd() {} };
  BattleSession.start(game, [foe()], { isBoss: false, ...options });
  return game;
}
async function settle() { await vi.advanceTimersByTimeAsync(3000); }
async function play(value, target = 'self') {
  const uid = E.addTempCard(value); BattleSession.commands.playCard(uid, target); await settle(); return uid;
}
beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); });
afterEach(() => { if (R.G?.battleActive) E.finish(null); vi.clearAllTimers(); vi.useRealTimers(); });

it('普通开局随身牌直接入手，10张初始攻击是独立的唯一临时实体', () => {
  const game = start([C.SHA]);
  expect(R.hand).toEqual(['owned-0']); expect(R.drawPile).toHaveLength(10);
  expect(new Set(R.drawPile).size).toBe(10);
  expect(R.granted).toHaveLength(10);
  expect(R.drawPile.every(uid => E.findCard(uid)?.card.id === C.SHA.id)).toBe(true);
  expect(game.ownedCards).toHaveLength(1);
});

it('抽n实际从10库移动实体，抽空后不生成替代牌', () => {
  start(); const original = new Set(R.drawPile);
  expect(E.drawCards(7)).toBe(7); expect(R.drawPile).toHaveLength(3);
  expect(R.hand.every(uid => original.has(uid))).toBe(true);
  expect(E.drawCards(200)).toBe(3); expect(R.drawPile).toHaveLength(0);
  expect(E.drawCards(3)).toBe(0); expect(R.hand).toHaveLength(10); expect(R.granted).toHaveLength(10);
});

it.each([{ isBoss: false }, { isBoss: true, directBossStart: true }, { isBoss: true, nest: true }])(
  '空库不自动取回消耗牌：%j', options => {
    start([C.SHA, card([])], options);
    R.set$drawPile([]);
    const uid = E.addTempCard(C.SHA); R.hand.splice(R.hand.indexOf(uid), 1); R.set$discard([uid]);
    expect(E.drawCards(5)).toBe(0);
    expect(R.drawPile).toEqual([]); expect(R.hand).not.toContain(uid); expect(R.discard).toContain(uid);
  });

it('实例工厂抽牌域同样在空库返回0，不读取或洗回消耗牌', () => {
  const runtime = { battleState: { token: 1 }, G: { battleActive: true, log: vi.fn() },
    drawPile: [], discard: ['spent'], hand: [], lastDrawnUids: [], set$lastDrawnUids(value) { this.lastDrawnUids = value; } };
  const audio = { sfx: vi.fn() };
  const { createBattleDraw } = createDrawDomain({ runtime, audio, cards: C });
  const draw = createBattleDraw({ checkSealTransformation() {} });
  expect(draw.drawCards(3)).toBe(0); expect(runtime.discard).toEqual(['spent']);
  expect(runtime.drawPile).toEqual([]); expect(audio.sfx).not.toHaveBeenCalled();
});

it('普通随身手牌超过BOSS的8张上限后仍可实抽，保持原普通容量', async () => {
  const rules = window.SDT.MAP.rules; const previous = rules.battleHandMax; rules.battleHandMax = 8;
  try {
    start(Array.from({ length: 10 }, () => C.SHA));
    expect(R.hand).toHaveLength(10);
    expect(E.drawCards(2)).toBe(2); expect(R.hand).toHaveLength(12); expect(R.drawPile).toHaveLength(8);
    await play(card([{ op: 'draw', amount: 2, filter: { type: '武术' } }]));
    expect(R.hand).toHaveLength(14); expect(R.drawPile).toHaveLength(6);
  } finally { rules.battleHandMax = previous; }
});

it('常规与额外回合都不自动补牌或补库', async () => {
  start(); E.drawCards(3); const uids = [...R.hand];
  BattleSession.commands.endTurn(); await settle();
  expect(R.turn).toBe(2); expect(R.hand).toEqual(uids); expect(R.drawPile).toHaveLength(7);
  R.set$extraTurn(true); BattleSession.commands.endTurn(); await settle();
  expect(R.turn).toBe(3); expect(R.hand).toEqual(uids); expect(R.drawPile).toHaveLength(7);
});

it('结构化抽牌与指定类型抽牌都使用真实库，不匹配类型不随机补足', async () => {
  start(); await play(card([{ op: 'draw', amount: 3 }]));
  expect(R.drawPile).toHaveLength(7); expect(R.hand).toHaveLength(3);
  await play(card([{ op: 'draw', amount: 2, filter: { type: '装备' } }]));
  expect(R.drawPile).toHaveLength(7); expect(R.hand).toHaveLength(3);
  await play(card([{ op: 'draw', amount: 2, filter: { type: '杀' } }]));
  expect(R.drawPile).toHaveLength(5); expect(R.hand).toHaveLength(5);
});

it('补到指定手牌数只消耗实库，手牌不足但空库时停止', async () => {
  start(); await play(card([{ op: 'draw', untilHandN: 4 }]));
  expect(R.hand).toHaveLength(4); expect(R.drawPile).toHaveLength(6);
  R.set$drawPile([]);
  await play(card([{ op: 'draw', untilHandN: 8 }]));
  expect(R.hand).toHaveLength(4); expect(R.drawPile).toHaveLength(0);
});

it('随身道具的结构化抽牌使用实际库，空库不会凭空获取', async () => {
  const potion = card([{ op: 'draw', amount: 3 }], { type: '道具' });
  potion.rules.bag = { use: [{ op: 'draw', amount: 3 }] };
  start([potion]);
  BattleSession.commands.usePotion('owned-0'); await settle();
  expect(R.drawPile).toHaveLength(7); expect(R.hand).toHaveLength(3);
  R.set$drawPile([]);
  const uid = E.addTempCard(potion);
  BattleSession.commands.usePotion(uid); await settle();
  expect(R.hand).toHaveLength(3); expect(R.drawPile).toHaveLength(0);
});

it('普通战仍无墓地，能力卡与库存类型不进普通手牌', () => {
  start([C.SHA, card([], { type: '能力卡' }), card([], { type: '资源' })]);
  expect(R.hand).toEqual(['owned-0']); expect(R.grave).toEqual([]);
  BattleSession.commands.openGrave(); // 普通沿用查看消耗区的入口，不创建墓地实体。
  expect(R.grave).toEqual([]);
  expect(E.unplayableReason(card([], { type: '能力卡' }))).toContain('BOSS');
});

it('洗入操作只增加牌库，库底发现候选来自真实实体且空库不随机发现', async () => {
  start();
  await play(card([{ op: 'acquire', n: 1, pool: { kind: '初始攻击' }, dest: 'deck' }]));
  expect(R.drawPile).toHaveLength(11); expect(R.hand).toHaveLength(0);
  await play(card([{ op: 'acquire', n: 3, pool: { kind: '牌库底' } }]));
  expect(R.discovering).toBeTruthy();
  expect(R.discovering.options.every(value => value.id === C.SHA.id)).toBe(true);
  BattleSession.commands.pickDiscover(0); await settle();
  expect(R.drawPile).toHaveLength(10); expect(R.hand).toHaveLength(1);
  R.set$drawPile([]);
  await play(card([{ op: 'acquire', n: 3, pool: { kind: '牌库底' } }]));
  expect(R.discovering).toBeNull(); expect(R.drawPile).toHaveLength(0);
});

it('普通打出临时攻击保持已出区去向，不进墓地且不回收到牌库', async () => {
  const game = start([C.SHA]); const ownedBefore = structuredClone(game.ownedCards);
  E.drawCards(1); const uid = R.hand.find(value => value !== 'owned-0');
  BattleSession.commands.playCard(uid, 0); await settle();
  expect(R.played).toContain(uid); expect(R.discard).not.toContain(uid); expect(R.grave).not.toContain(uid);
  E.finish(true); await settle();
  expect(game.ownedCards).toEqual(ownedBefore); expect(R.granted).toHaveLength(0); expect(R.drawPile).toHaveLength(0);
  expect(R.opts.spentCards.some(entry => entry.uid === uid)).toBe(false);
  expect(BattleSession.serialize()).toBeNull();
});

it('正式检查点JSON恢复重建10实体，不把临时库写进随身卡', () => {
  const game = start([C.SHA]); E.drawCards(4);
  const checkpoint = JSON.parse(JSON.stringify(BattleSession.serialize()));
  expect(checkpoint.run.ownedCards).toHaveLength(1);
  expect(BattleSession.restore(game, checkpoint)).toBe(true);
  expect(R.drawPile).toHaveLength(10); expect(new Set(R.drawPile).size).toBe(10);
  expect(R.drawPile.every(uid => E.findCard(uid)?.card.id === C.SHA.id)).toBe(true);
  expect(R.hand).toEqual(['owned-0']); expect(game.ownedCards).toHaveLength(1);
});

it('牌区JSON往返保留全部10UID与卡实体', () => {
  start(); const uids = [...R.drawPile];
  const data = JSON.parse(JSON.stringify({ hand: R.hand, drawPile: R.drawPile, granted: R.granted }));
  restoreBattlePiles(data);
  expect(R.drawPile).toEqual(uids); expect(R.granted).toHaveLength(10);
  expect(R.drawPile.every(uid => E.findCard(uid)?.card.id === C.SHA.id)).toBe(true);
});

it('BOSS保留固定开局与每回合抽牌，不注入10普通库', async () => {
  start([C.SHA, card([], { type: '武术' }), card([], { type: '法术' })], { isBoss: true, directBossStart: true });
  expect(R.hand).toHaveLength(2); expect(R.drawPile.length + R.hand.length).toBe(4);
  expect(R.granted.filter(entry => entry.uid.startsWith('normal-sha-'))).toHaveLength(0);
  const before = R.drawPile.length; BattleSession.commands.endTurn(); await settle();
  expect(R.drawPile).toHaveLength(before - 1); expect(R.hand).toHaveLength(3);
});

it('龙巢仍用随身卡盒实际成库，固定抽牌且不添加普通初始攻击', async () => {
  start([C.SHA, card([]), card([]), card([])], { isBoss: true, nest: true });
  expect(R.hand).toHaveLength(2); expect(R.drawPile).toHaveLength(2); expect(R.granted).toHaveLength(0);
  BattleSession.commands.endTurn(); await settle();
  expect(R.hand).toHaveLength(3); expect(R.drawPile).toHaveLength(1);
});
