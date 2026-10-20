import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 20, battleTurnDraw: 0, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { addTempCard } = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const { RUNE_KINDS } = await import('../game/src/battle/runes.js');
const { assertUniqueZones } = await import('../game/src/battle/bag/battle.piles.js');

beforeEach(() => { temporaryItems.clear(); vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };
function makeGame(cards) {
  return { ownedCards: cards.map((card, i) => ({ uid: `runtime-${i}`, card: { ...card }, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士', characterId: null,
    state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(message); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {}, };
}
const temporaryItems = new Map();
function useAvailablePotion(uid) {
  if (R.mode !== 'boss') { BattleSession.commands.usePotion(uid); return; }
  if (!temporaryItems.has(R.G)) temporaryItems.set(R.G, new Map());
  const items = temporaryItems.get(R.G);
  if (!items.has(uid)) items.set(uid, addTempCard(R.G.ownedCards.find(o => o.uid === uid).card));
  BattleSession.commands.usePotion(items.get(uid));
}

async function settle() { await vi.advanceTimersByTimeAsync(1000); expect(R.busy).toBe(false); }

async function infuseInBoss(extra = [], boss = true) {
  const game = makeGame([canonical('tt3sp-silverthorn'), canonical('tt3sp-shadowbug'), canonical('tt-crystal'), ...extra]);
  BattleSession.start(game, [{ id: 'runtime-foe', name: '靶子', hp: 1000, atk: 1, behavior: 'strike' }], { isBoss: boss });
  if (boss) {
    game.ownedCards.filter(o => o.card.type !== '道具').forEach(o => BattleSession.commands.selectDeckCard(o.uid));
    BattleSession.commands.confirmDeck();
  }
  expect(R.hand).toEqual(expect.arrayContaining(['runtime-0', 'runtime-1']));
  BattleSession.commands.beginInfusion('runtime-0');
  BattleSession.commands.selectInfusion('runtime-1');
  BattleSession.commands.confirmInfusion();
  await settle();
  expect(R.consumed).toEqual(['runtime-1']);
  expect(R.grave).toEqual(boss ? ['runtime-1'] : []);
  expect(R.hand).not.toContain('runtime-1');
  return game;
}

describe('运行态补审真实入口回归', () => {
  it('BOSS 镭射注能后，能源结晶复原燃料应从墓地移动到手牌且只占一个牌区', async () => {
    const game = await infuseInBoss();
    useAvailablePotion('runtime-2');
    await settle();
    expect(game.ownedCards.some(o => o.uid === 'runtime-2')).toBe(true);
    expect(BattleSession.getSnapshot().potionBar).toEqual([]);
    expect(R.consumed).toEqual([]);
    expect(R.hand).toContain('runtime-1');
    expect(R.grave).not.toContain('runtime-1');
    expect(() => assertUniqueZones({ hand: R.hand, drawPile: R.drawPile, discard: R.discard, grave: R.grave })).not.toThrow();
  });

  it('普通战燃料不在墓地时照常复原，重复点击已消费结晶不会复制手牌', async () => {
    const game = await infuseInBoss([], false);
    useAvailablePotion('runtime-2');
    await settle();
    expect(R.hand).toEqual(['runtime-1', 'runtime-0']);
    expect(R.grave).toEqual([]);
    const afterFirstUse = BattleSession.getSnapshot();
    useAvailablePotion('runtime-2');
    await settle();
    expect(BattleSession.getSnapshot()).toBe(afterFirstUse);
    expect(game.ownedCards.filter(o => o.uid === 'runtime-2')).toEqual([]);
  });

  it('同名牌不同 UID：只移出实际燃料，未被消耗的另一实例仍在手牌一次', async () => {
    await infuseInBoss([canonical('tt3sp-shadowbug')]);
    expect(R.hand).toEqual(['runtime-3']);
    useAvailablePotion('runtime-2');
    await settle();
    expect(R.hand).toEqual(['runtime-3', 'runtime-1', 'runtime-0']);
    expect(R.grave).toEqual([]);
    expect(() => assertUniqueZones({ hand: R.hand, drawPile: R.drawPile, discard: R.discard, grave: R.grave })).not.toThrow();
  });

  it('合法复原后同一燃料再注能、再复原，牌区仍唯一且保留 LIFO 次序', async () => {
    await infuseInBoss([canonical('tt3sp-silverthorn'), canonical('tt-crystal')]);
    useAvailablePotion('runtime-2');
    await settle();
    const firstCrystal = temporaryItems.get(R.G).get('runtime-2');
    BattleSession.commands.beginInfusion('runtime-3');
    BattleSession.commands.selectInfusion('runtime-1');
    BattleSession.commands.confirmInfusion();
    await settle();
    expect(R.consumed).toEqual(['runtime-1']);
    expect(R.grave).toEqual(['runtime-1']);
    useAvailablePotion('runtime-4');
    await settle();
    expect(R.hand).toEqual(['runtime-0', 'runtime-1', 'runtime-3', firstCrystal]);
    expect(R.consumed).toEqual([]);
    expect(R.grave).toEqual([]);
    expect(R.discard).toEqual([]);
    expect(new Set(R.hand).size).toBe(R.hand.length);
    expect(BattleSession.getSnapshot().consumedPile).not.toContain(firstCrystal);
    expect(() => assertUniqueZones({ hand: R.hand, drawPile: R.drawPile, discard: R.discard, grave: R.grave })).not.toThrow();
  });


  it('真实冰冻符文 frozen：BOSS 使用冰冻药水后抽 2 张牌', async () => {
    window.SDT.MAP.rules.battleStartDraw = 1;
    const kind = RUNE_KINDS.find(r => r.id === 'frozen');
    const rune = { ...kind, kind: kind.id, attrs: ['暗'] };
    const game = makeGame([canonical('tt3sp-silverthorn'), canonical('tt3sp-shadowbug'), canonical('tt3sp-shadowbug'), canonical('tt3-iceheart-potion')]);
    BattleSession.start(game, [{ id: 'nest-dark-elem', name: '黑暗元素', hp: 30, atk: 9, rotateImmune: true }], { isBoss: true, nest: { runes: [rune] } });
    expect(R.hand).toHaveLength(1);
    expect(R.drawPile).toHaveLength(2);
    useAvailablePotion('runtime-3');
    await settle();
    expect(R.foes[0].status.freeze).toBe(1);
    expect(R.hand).toHaveLength(3);
    expect(R.drawPile).toHaveLength(0);
  });


  it('冰冻符文在当前场只抽一次，切到无符文 BOSS 和普通战后不残留', async () => {
    window.SDT.MAP.rules.battleStartDraw = 1;
    const kind = RUNE_KINDS.find(r => r.id === 'frozen');
    const cards = [canonical('tt3sp-silverthorn'), canonical('tt3sp-shadowbug'), canonical('tt3sp-shadowbug'), canonical('tt3-iceheart-potion')];
    const defs = [{ id: 'nest-dark-elem', name: '黑暗元素', hp: 30, atk: 9 }];
    const withRune = makeGame(cards);
    BattleSession.start(withRune, defs, { isBoss: true, nest: { runes: [{ ...kind, kind: kind.id, attrs: ['暗'] }] } });
    useAvailablePotion('runtime-3');
    await settle();
    expect(R.hand).toHaveLength(3);
    expect(withRune.logs.filter(log => log.includes('冰冻符文') && log.includes('抽 2 张牌'))).toHaveLength(1);
    const noRune = makeGame(cards);
    BattleSession.start(noRune, defs, { isBoss: true, nest: { runes: [] } });
    useAvailablePotion('runtime-3');
    await settle();
    expect(R.freezeRuneOn).toBe(false);
    expect(R.hand).toHaveLength(1);
    expect(noRune.logs.some(log => log.includes('冰冻符文'))).toBe(false);
    const normal = makeGame(cards);
    BattleSession.start(normal, defs, { isBoss: false });
    useAvailablePotion('runtime-3');
    await settle();
    expect(R.freezeRuneOn).toBe(false);
    expect(R.hand).toHaveLength(3);
    expect(normal.logs.some(log => log.includes('冰冻符文'))).toBe(false);
  });

  it('真实沙暴元素 8 心：战士猛击 5 攻应按心模式仅减少 1 心', async () => {
    const game = makeGame([]);
    BattleSession.start(game, [{ id: 'nest-sand-elem', name: '沙暴元素', hp: 8, hearts: 8, atk: 8, heartsMode: true }], { isBoss: true, nest: { runes: [] } });
    BattleSession.commands.bagSlam();
    BattleSession.commands.resolveSlam(0);
    await settle();
    expect(R.foes[0].hp).toBe(7);
  });


  it('能源结晶复原两张同名注能燃料保留 consumed 的 LIFO 次序', async () => {
    const game = makeGame([canonical('tt3sp-bloodstorm'), canonical('tt3sp-shadowbug'), canonical('tt3sp-shadowbug'), canonical('tt-crystal')]);
    BattleSession.start(game, [{ id: 'runtime-foe', name: '靶子', hp: 1000, atk: 1 }], { isBoss: true, nest: { runes: [] } });
    BattleSession.commands.beginInfusion('runtime-0');
    BattleSession.commands.selectInfusion('runtime-1');
    BattleSession.commands.selectInfusion('runtime-2');
    BattleSession.commands.confirmInfusion();
    await settle();
    expect(R.consumed).toEqual(['runtime-1', 'runtime-2']);
    expect(R.grave).toEqual(['runtime-1', 'runtime-2']);
    useAvailablePotion('runtime-3');
    await settle();
    expect(R.hand).toEqual(['runtime-2', 'runtime-1', 'runtime-0']);
    expect(R.grave).toEqual([]);
    expect(R.discard).toEqual([]);
  });

  it('真实元素领主偶数回合元素庇幕挡住猛击，费用与本回合次数仍只消费一次', async () => {
    const game = makeGame([]);
    BattleSession.start(game, [{ id: 'nest-elem-lord', name: '完全形态·元素领主', hp: 32, hearts: 32, atk: 8, heartsMode: true, affix: 'aegis' }], { isBoss: true, nest: { runes: [] } });
    BattleSession.commands.endTurn();
    await settle();
    expect(R.turn).toBe(2);
    const energyBefore = R.energy;
    BattleSession.commands.bagSlam();
    BattleSession.commands.resolveSlam(0);
    await settle();
    expect(R.foes[0].hp).toBe(32);
    expect(R.energy).toBe(energyBefore - 2);
    expect(BattleSession.commands.slamSkill().used).toBe(true);
    BattleSession.commands.bagSlam();
    BattleSession.commands.resolveSlam(0);
    await settle();
    expect(R.energy).toBe(energyBefore - 2);
    expect(R.foes[0].hp).toBe(32);
  });

  it('已有 protected 契约态：守护者存活时技能不能绕过庇护', async () => {
    const game = makeGame([]);
    BattleSession.start(game, [
      { id: 'protected-contract', name: '受庇护目标', hp: 32, atk: 8, protected: true },
      { id: 'guardian-contract', name: '守护者', hp: 16, atk: 4, protects: true },
    ], { isBoss: true, nest: { runes: [] } });
    BattleSession.commands.bagSlam();
    BattleSession.commands.resolveSlam(0);
    await settle();
    expect(R.foes[0].hp).toBe(32);
    expect(R.foes[1].hp).toBe(16);
  });

  it('猛击击杀只触发一次饮血剑奖励并只产生一次伤害浮字', async () => {
    const game = makeGame([canonical('tt3-blooddrinker')]);
    BattleSession.start(game, [{ id: 'kill-foe', name: '低血靶子', hp: 3, atk: 1 }, { id: 'spare-foe', name: '剩余靶子', hp: 100, atk: 1 }], { isBoss: false });
    BattleSession.commands.playCard('runtime-0', 'self');
    await settle();
    expect(R.pstat.status.atkUp).toBe(0);
    BattleSession.commands.bagSlam();
    BattleSession.commands.resolveSlam(0);
    await settle();
    expect(R.foes[0].dead).toBe(true);
    expect(R.pstat.status.atkUp).toBe(1);
    expect(R.floats.filter(f => f.unit === 0 && f.hpBefore != null)).toHaveLength(1);
  });

  it('猛击造成伤害后只破隐一次，不登记一次新的打出牌事件', async () => {
    const game = makeGame([canonical('tt7-stealth')]);
    BattleSession.start(game, [{ id: 'runtime-foe', name: '靶子', hp: 1000, atk: 1 }], { isBoss: false });
    BattleSession.commands.playCard('runtime-0', 'self');
    await settle();
    expect(R.pstat.status.stealth).toBe(1);
    const movesBefore = R.playedMovesThisTurn;
    BattleSession.commands.bagSlam();
    BattleSession.commands.resolveSlam(0);
    await settle();
    expect(R.pstat.status.stealth).toBe(0);
    expect(R.playedMovesThisTurn).toBe(movesBefore);
    expect(game.logs.filter(log => log.includes('你造成了伤害') && log.includes('潜行'))).toHaveLength(1);
    expect(R.floats.filter(f => f.unit === 0 && f.hpBefore != null)).toHaveLength(1);
  });

});
