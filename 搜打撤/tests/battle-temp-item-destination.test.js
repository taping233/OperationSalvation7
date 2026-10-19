import { afterEach, beforeEach, expect, it, vi } from 'vitest';
window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 20, battleTurnDraw: 0, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { addTempCard, queueCardExecution, finish, processDelayed, resolveCard } = await import('../game/src/battle/core/battle.engine.js');
const { createBattleDraw } = await import('../game/src/battle/core/battle.draw.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
let game;
const healItem = { id: 'temp-heal', name: '临时回复道具', type: '道具', cost: 0, desc: '回复3点生命' };
const bar = () => BattleSession.getSnapshot().potionBar;
beforeEach(() => {
  vi.useFakeTimers(); R.set$lastDeckSel([]);
  game = { ownedCards: [{ uid: 'permanent-last', card: { ...C.SHA }, safe: false }],
    hp: 30, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士', characterId: null,
    state: 'idle', battleActive: false, log() {}, heal(n) { this.hp += n; }, addItem() {}, onBattleEnd: vi.fn() };
  BattleSession.start(game, [{ id: 'target', name: '靶子', hp: 10000, atk: 1, behavior: 'strike' }], { isBoss: false });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
it('获得道具只进快捷栏，不占手牌或抽到记录；普通卡保持入手', () => {
  const uid = addTempCard(healItem);
  expect(R.hand).not.toContain(uid);
  expect(R.lastDrawnUids).not.toContain(uid);
  expect(bar()).toContainEqual(expect.objectContaining({ uid, count: 1 }));
  expect(game.ownedCards.map(o => o.uid)).toEqual(['permanent-last']);
  const attack = addTempCard(C.SHA);
  expect(R.hand).toContain(attack); expect(R.lastDrawnUids).toContain(attack);
});
it.each([
  ['文本即时', healItem],
  ['结构化', { ...healItem, rules: { bag: { use: [{ op: 'heal', amount: 3 }] } } }],
  ['排队文本', { ...healItem, id: 'temp-energy', name: '临时能量道具', desc: '获得2点能量' }],
])('%s道具只消费一次，不误删永久末卡', async (_name, card) => {
  const uid = addTempCard(card);
  BattleSession.commands.usePotion(uid);
  await vi.advanceTimersByTimeAsync(1000);
  expect(bar().some(o => o.uid === uid)).toBe(false);
  expect(R.granted.some(o => o.uid === uid)).toBe(true);
  expect(R.played.filter(playedUid => playedUid === uid)).toHaveLength(1);
  const state = [game.hp, R.energy];
  BattleSession.commands.useItem(uid);
  await vi.advanceTimersByTimeAsync(1000);
  expect([game.hp, R.energy]).toEqual(state);
  expect(game.ownedCards.map(o => o.uid)).toEqual(['permanent-last']);
  if (card !== healItem && card.id === 'temp-energy') expect(R.energy).toBe(101);
  else expect(game.hp).toBe(33);
});
it('直接施放道具不会在快捷栏留下第二次使用机会', async () => {
  const uid = addTempCard(healItem, { source: 'discover-cast' });
  expect(bar().some(o => o.uid === uid)).toBe(false);
  queueCardExecution(uid, healItem, [], null, true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(R.played).toContain(uid);
  expect(bar().some(o => o.uid === uid)).toBe(false);
  expect(R.hand).not.toContain(uid);
});
it('BOSS仅提供临时道具，永久道具仍受限制；洗入牌库的道具也改进栏', () => {
  R.set$mode('boss');
  game.ownedCards.push({ uid: 'owned-item', card: healItem, safe: false });
  const draw = createBattleDraw({});
  const uid = draw.addDeckCard(healItem);
  expect(R.drawPile).not.toContain(uid);
  expect(bar().map(o => o.uid)).toEqual([uid]);
});
it('战斗结束清除未使用临时道具，不永久保存', () => {
  addTempCard(healItem);
  finish(true);
  expect(R.granted).toEqual([]);
  expect(game.ownedCards.map(o => o.uid)).toEqual(['permanent-last']);
  expect(game.onBattleEnd).toHaveBeenCalled();
});

it('直接施放的临时道具和招式沿原规则进入战后消耗区回传', async () => {
  const uid = addTempCard(healItem, { source: 'discover-cast' });
  queueCardExecution(uid, healItem, [], null, true);
  await vi.advanceTimersByTimeAsync(1000);
  const attack = addTempCard(C.SHA);
  queueCardExecution(attack, C.SHA, [], R.foes[0], true);
  await vi.advanceTimersByTimeAsync(1000);
  finish(true);
  const callbackArgs = game.onBattleEnd.mock.calls[0];
  const opts = callbackArgs.find(arg => arg && typeof arg === 'object' && 'spentCards' in arg);
  expect(opts.spentCards.map(o => o.uid)).toContain(uid);
  expect(opts.spentCards.map(o => o.uid)).toContain(attack);
});

it.each([false, true])('江湖救急到期回收临时道具，已使用=%s不重复消费', async used => {
  const uid = addTempCard(healItem);
  if (used) BattleSession.commands.usePotion(uid);
  R.delayed.push({ special:'consumeTemps', uids:[uid], cardName:'江湖救急' });
  await processDelayed();
  expect(R.consumed.includes(uid)).toBe(!used);
  expect(bar().some(o => o.uid === uid)).toBe(false);
  expect(game.ownedCards.map(o => o.uid)).toEqual(['permanent-last']);
});
it.each(['hosted', 'legacy'].flatMap(path => ['mixed', 'items', 'empty'].map(pool => [path, pool])))('%s补手池%s只补招式，无候选安全结束', (path, poolKind) => {
  const hero = path === 'hosted' ? C.all().find(c => c.id === 'tt8-hero-priest')
    : {id:'legacy-fill',name:'补手测试',type:'法术',cost:0,desc:'置入随机卡牌直至手牌达到6张。'};
  const item = C.all().find(c => c.type === '道具' && C.isRandomObtainable(c) && !c.rules?.triggers?.onAcquire);
  const spell = C.all().find(c => c.type === '法术' && C.isRandomObtainable(c) && !c.rules?.triggers?.onAcquire);
  const pool = poolKind === 'mixed' ? [item,spell] : poolKind === 'items' ? [item] : [];
  const before = R.hand.length;
  const spy = vi.spyOn(C,'all').mockReturnValue(pool);
  try {
    resolveCard(hero,null,false,0);
    expect(R.hand).toHaveLength(poolKind === 'mixed' ? 6 : before);
    expect(R.granted.some(o => o.card.type === '道具')).toBe(false);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(6);
  } finally { spy.mockRestore(); }
});

it('江湖救急真实生成3件道具到栏，下回合逐一消耗', async () => {
  const rescue = C.all().find(c => c.id === 'cmtn1wnhhym');
  const item = C.all().find(c => c.id === 'tt4-woodify');
  const spy = vi.spyOn(C,'all').mockReturnValue([item]);
  try {
    resolveCard(rescue,null,false,0);
    const uids = R.granted.filter(o => o.card.id === item.id).map(o => o.uid);
    expect(uids).toHaveLength(3);
    expect(bar().find(o => o.name === item.name)).toMatchObject({count:3});
    expect(R.hand.some(uid => uids.includes(uid))).toBe(false);
    R.set$turn(R.turn + 1);
    await processDelayed();
    expect(R.consumed).toEqual(expect.arrayContaining(uids));
    expect(bar().some(o => o.name === item.name)).toBe(false);
  } finally { spy.mockRestore(); }
});
