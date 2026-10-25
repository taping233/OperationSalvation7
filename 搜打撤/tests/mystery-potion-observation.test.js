import { battleRules } from './helpers/environment-fixtures.js';
// Approved mystery-potion regression; original observations are preserved in the evidence directory.
import { makeRuntimeBattleGame as makeGame } from './helpers/battle-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const observation = vi.hoisted(() => ({ lootRoll:null }));
vi.mock('../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random: { ...actual.Random, random: (...args) =>
    args[0] === 'loot' && observation.lootRoll !== null ? observation.lootRoll : actual.Random.random(...args) } };
});

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(99, 20, 15, 0, 20, 0) }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { addTempCard } = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { observation.lootRoll = null; vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };

async function settle() { await vi.advanceTimersByTimeAsync(1000); expect(R.busy).toBe(false); }


function startMystery(boss) {
  const game = makeGame([canonical('tt3-mystery-potion'), canonical('tt3-reshot')]);
  game.hp = 50;
  BattleSession.start(game, [{ id:'mystery-observe', name:'神秘药水观测靶', hp:1000, atk:1, behavior:'strike' }], { isBoss:boss });
  if (boss) {
    BattleSession.commands.selectDeckCard('runtime-1');
    BattleSession.commands.confirmDeck();
  }
  expect(game.ownedCards[0].card.desc).toContain('回合开始时');
  return game;
}
it.each([false, true])('观测不使用神秘药水不会在回合开始自动变形，BOSS=%s', async boss => {
  const game = startMystery(boss);
  expect(game.ownedCards.some(o => o.uid === 'runtime-0')).toBe(true);
  BattleSession.commands.endTurn(); await settle();
  expect(game.ownedCards.some(o => o.uid === 'runtime-0')).toBe(true);
  expect(game.logs.some(log => log.includes('神秘变化'))).toBe(false);
});

const allowedMove = (id, type = '法术', extra = {}) => ({ id, name:id, type, rarity:'古朴', cost:2, desc:'造成2点伤害。', dmg:2, ...extra });
it.each([false, true])('普通/BOSS=%s：0能量使用排队，下回合仅一次0费招式，重复点击不复制', async boss => {
  const game = startMystery(boss);
  vi.spyOn(C, 'all').mockReturnValue([allowedMove('candidate-spell')]);
  R.set$energy(0);
  const coins = game.coins, hp = game.hp;
  const potionUid = boss ? addTempCard(game.ownedCards[0].card) : 'runtime-0';
  BattleSession.commands.usePotion(potionUid);
  BattleSession.commands.usePotion(potionUid);
  await settle();
  expect(game.ownedCards.some(o => o.uid === 'runtime-0')).toBe(boss);
  expect(BattleSession.getSnapshot().potionBar.some(o => o.uid === potionUid)).toBe(false);
  expect(game.coins).toBe(coins); expect(game.hp).toBe(hp);
  expect(R.granted.some(o => o.card.id === 'candidate-spell')).toBe(false);
  expect(R.delayed).toHaveLength(1);
  BattleSession.commands.endTurn(); await settle();
  const got = R.granted.filter(o => o.card.id === 'candidate-spell');
  expect(got).toHaveLength(1);
  expect(got[0].card).toMatchObject({ type:'法术', cost:0, _baseCost:2 });
  expect(R.hand).toContain(got[0].uid);
  expect(R.delayed).toEqual([]);
  BattleSession.commands.endTurn(); await settle();
  expect(R.granted.filter(o => o.card.id === 'candidate-spell')).toHaveLength(1);
});
it.each(['武术', '法术'])('招式池允许%s，排除初始/职业/衍生/棱彩/unrandom及非招式', async type => {
  startMystery(false);
  const excluded = ['初始','职业','衍生','棱彩'].map((rarity, i) => allowedMove(`excluded-${i}`, type, { rarity }));
  excluded.push(allowedMove('unrandom', type, { unrandom:true }), allowedMove('tool','道具'), allowedMove('equip','装备'));
  vi.spyOn(C, 'all').mockReturnValue([...excluded, allowedMove('legal-move', type)]);
  BattleSession.commands.usePotion('runtime-0'); await settle();
  BattleSession.commands.endTurn(); await settle();
  expect(R.granted.filter(o => o.card.id === 'legal-move')).toHaveLength(1);
  expect(R.granted.some(o => excluded.some(card => card.id === o.card.id))).toBe(false);
});
it('药水登记后本场终局，未触发任务不进入下一战', async () => {
  const game = startMystery(false);
  BattleSession.commands.usePotion('runtime-0'); await settle();
  expect(R.delayed).toHaveLength(1);
  R.foes[0].hp = 1;
  BattleSession.commands.playCard('runtime-1', 0); await settle();
  expect(game.battleActive).toBe(false);
  const next = startMystery(false);
  expect(R.delayed).toEqual([]);
  BattleSession.commands.endTurn(); await settle();
  expect(next.logs.some(log => log.includes('神秘变化'))).toBe(false);
});
it.each(['随机神秘效果。', '回合开始时：变成1张随机招式卡牌，使其费用为0。', 'current', '玩家自定义神秘药水说明'])('旧档精确说明迁移：%s', value => {
  const original = C.all().map(card => ({ ...card }));
  const current = C.TABLETOP10.find(card => card.id === 'tt3-mystery-potion').desc;
  const desc = value === 'current' ? current : value;
  try {
    C.saveAll(original.map(card => card.id === 'tt3-mystery-potion' ? { ...card, desc } : card));
    C.ensureTabletop();
    expect(canonical('tt3-mystery-potion').desc).toBe(value.startsWith('玩家') ? value : current);
  } finally { C.saveAll(original); }
});

it.each(['武术', '法术'])('既有指定%s变形语句不扩大到另一种招式', async type => {
  const { damageSteps } = await import('../game/src/battle/effects/effect-steps.damage.js');
  const addTempCard = vi.fn();
  const other = type === '武术' ? '法术' : '武术';
  const steps = damageSteps({ allCards:() => [allowedMove('other',other), allowedMove('wanted',type)],
    isRandomObtainable:card => C.isRandomObtainable(card), random01:() => 0,
    addTempCard, log:vi.fn(), esc:text => text });
  const step = steps.find(item => item.id === 'summon.morphRandom');
  const ctx = { desc:`变成1张随机${type}卡牌，使其费用为0。` };
  step.run(ctx, step.when(ctx));
  expect(addTempCard).toHaveBeenCalledWith(expect.objectContaining({ id:'wanted', type, cost:0 }));
});

it('旧快照神秘药水展示更新，玩家自定义及不同ID原句保留', async () => {
  const { displayCardDescription } = await import('../game/src/cards/card-description-text.js');
  const legacy = '回合开始时：变成1张随机招式卡牌，使其费用为0。';
  expect(displayCardDescription(legacy, 'tt3-mystery-potion')).toBe(C.TABLETOP10.find(card => card.id === 'tt3-mystery-potion').desc);
  expect(displayCardDescription('玩家神秘说明', 'tt3-mystery-potion')).toBe('玩家神秘说明');
  expect(displayCardDescription(legacy, 'other-id')).toBe(legacy);
});

it.each(['false', 'throw'])('神秘药水精确文案保存%s时不改库，可恢复重试', failure => {
  const original = C.all().map(card => ({ ...card }));
  let save, error;
  try {
    C.saveAll(original.map(card => card.id === 'tt3-mystery-potion' ? { ...card, desc:'随机神秘效果。' } : card));
    const before = JSON.stringify(C.all());
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    save = vi.spyOn(C, 'saveAll').mockImplementation(() => {
      if (failure === 'throw') throw new Error('injected mystery description-save rejection');
      return false;
    });
    expect(() => C.ensureBagUseRules()).not.toThrow();
    expect(save).toHaveBeenCalled(); expect(JSON.stringify(C.all())).toBe(before);
    save.mockRestore(); C.ensureBagUseRules();
    expect(canonical('tt3-mystery-potion').desc).toBe(C.TABLETOP10.find(card => card.id === 'tt3-mystery-potion').desc);
  } finally { save?.mockRestore(); error?.mockRestore(); C.saveAll(original); }
});


it.each(['beforeUse', 'beforeDue'])('神秘药水%s沉默仍兑现产卡，其它延迟法术保留沉默门', async timing => {
  const game = startMystery(false);
  vi.spyOn(C, 'all').mockReturnValue([allowedMove('silence-potion-result')]);
  if (timing === 'beforeUse') R.pstat.status.silence = 3;
  BattleSession.commands.usePotion('runtime-0'); await settle();
  if (timing === 'beforeDue') R.pstat.status.silence = 3;
  expect(R.delayed[0]).toMatchObject({ special: 'triggerOps', srcCard: { type: '道具' }, ops: [{ op: 'acquire', n: 1, pool: { kind: 'types', types: ['武术', '法术'], randomEligible: true }, dest: 'hand', act: 'zeroCost' }] });
  // Construct an ordinary text-delay control; both jobs run through real processDelayed.
  R.delayed.push({ text:'回复8点生命。', cardName:'普通延迟法术对照', repeat:false, left:null });
  const hpBefore = game.hp;
  BattleSession.commands.endTurn(); await settle();
  expect(R.granted.filter(o => o.card.id === 'silence-potion-result')).toHaveLength(1);
  expect(game.logs.some(log => log.includes('沉默中') && log.includes('普通延迟法术对照'))).toBe(true);
  expect(game.logs.some(log => log.includes('沉默中') && log.includes('神秘药水'))).toBe(false);
  expect(game.hp).toBeLessThanOrEqual(hpBefore);
  expect(R.delayed).toEqual([]);
});

it('同回合两瓶神秘药水各自只兑现一次，沉默不吞任务', async () => {
  const game = startMystery(false);
  game.ownedCards.push({ uid:'second-potion', card:{ ...canonical('tt3-mystery-potion') }, safe:false });
  vi.spyOn(C, 'all').mockReturnValue([allowedMove('two-potions-result')]);
  BattleSession.commands.usePotion('runtime-0'); await settle();
  BattleSession.commands.usePotion('second-potion'); await settle();
  expect(R.delayed).toHaveLength(2);
  R.pstat.status.silence = 3;
  BattleSession.commands.endTurn(); await settle();
  expect(R.granted.filter(o => o.card.id === 'two-potions-result')).toHaveLength(2);
  expect(R.delayed).toEqual([]);
  BattleSession.commands.endTurn(); await settle();
  expect(R.granted.filter(o => o.card.id === 'two-potions-result')).toHaveLength(2);
});
