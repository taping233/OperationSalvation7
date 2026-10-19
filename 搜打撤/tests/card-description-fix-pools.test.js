import { describe, expect, it } from 'vitest';
import { parsePoolNoun, makeHitFoe } from '../game/src/battle/effects/effect-steps.ctx.js';
import { killsSteps } from '../game/src/battle/effects/effect-steps.kills.js';
import { createBattleResolution } from '../game/src/battle/core/battle.resolution.js';
import { createBattleDiscoverFlow } from '../game/src/battle/effects/battle.discover-flow.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import * as Combat from '../game/src/battle/core/combat.js';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 20, battleHandMax: 99, bossDeckSize: 8, starterSha: 0,
    battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } } };
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const byId = id => Cards.all().find(card => card.id === id);
const sample = (type, cost, desc = '') => ({ id: `${type}-${cost}-${desc}`, name: `${type}${cost}`, type, cost, desc, rarity: '古朴' });

function probe(pool) {
  const added = [], jobs = [];
  const player = Combat.ensureStatus({ hp: 50 });
  const foe = Combat.ensureStatus({ hp: 100, maxHp: 100 });
  const resolver = createBattleResolution({
    readState: () => ({ mode: 'boss', grave: [], playedMovesThisTurn: 0 }),
    getPlayerStatus: () => player, esc: String, log() {}, heal() {}, addFloat() {}, addDelayed() {},
    takeDeckBottom: () => [], deckBottomCount: () => 0, startSurge() {}, getAllCards: () => pool,
    isRandomObtainable: c => !c.unrandom, randomBattle: () => 0,
    getDamageTypes: () => ['武术', '法术'], getDamageTypeMeta: () => Combat.TYPE_NAME, fixedDamageType: 'fixed',
    hasCurse: Combat.hasCurse, getAliveFoes: () => [foe], getGrowth: () => 0, findCard: () => null,
    addTempCard: c => added.push(c), addDeckCard: c => added.push(c), shuffleDeck: () => added.length,
    randomDiscoverCard: pred => pool.find(c => !pred || pred(c)), queueDiscover: job => jobs.push(job), getMyClass: () => '战士',
    splitClauses: () => ({ immediate: [], turnStart: [], battle: [], onInfused: [], onDraw: [], skill: [] }),
    applyTextEffects: () => ({ did: false }), registerTurnStart() {}, registerBattle() {}, castRandomSpells() {},
    drawCards: () => 0, grantSha() {}, drawOf: () => 0, isAOE: () => false,
    addArmor() {}, addEnergy() {}, addEnergyCap() {}, addPlayerMaxHp() {}, addCoins() {},
    damagePlayer() {}, getPlayerHp: () => 50, getPlayerSpellPower: () => 0,
    countDrawnSpells: () => 0, getHandSize: () => 0, combat: Combat, hitFoe() {},
  });
  return { run: card => resolver(card, foe), added, jobs };
}

describe('卡面修复：招式池和铁甲阵费用', () => {
  it.each(['0费招式', '1费招式', '2费招式'])('%s 包含同费用武术与法术，排除装备和其他费用', noun => {
    const n = Number(noun[0]), pred = parsePoolNoun(noun);
    expect([sample('武术', n), sample('法术', n)].every(pred)).toBe(true);
    expect(pred(sample('装备', n))).toBe(false);
    expect(pred(sample('法术', n + 1))).toBe(false);
  });

  it.each(['tt12-basicdev', 'tt12-breakthrough'])('%s 可从纯法术样本池获取正确张数与费用', id => {
    const p = probe([sample('法术', 0), sample('法术', 1), sample('法术', 2)]);
    p.run(byId(id));
    expect(p.added.map(card => card.cost)).toEqual(id === 'tt12-basicdev' ? [0, 0] : [0, 1, 2]);
  });

  it('厄运保留诅咒筛选，并接受诅咒法术、排除非诅咒招式和诅咒装备', () => {
    const pool = [sample('法术', 1, '附加冰冻。'), sample('武术', 1, '附加流血。'),
      sample('法术', 1, '造成伤害。'), sample('装备', 1, '附加流血。')];
    const pred = parsePoolNoun('能施加诅咒的招式');
    expect(pool.map(pred)).toEqual([true, true, false, false]);
    const p = probe(pool); p.run(byId('cmtn1gfhczzj'));
    expect(p.added).toEqual([pool[0]]);
    const added = [];
    const step = killsSteps({ allCards: () => pool, random01: () => 0, addTempCard: c => added.push(c), log() {}, esc: String })
      .find(s => s.id === 'hand.curseCards');
    const ctx = { card: byId('cmtn1gfhczzj'), desc: '随机获取1张能施加诅咒的招式' };
    step.run(ctx, step.when(ctx));
    expect(added).toEqual([pool[0]]);
  });

  it('魔法新发现限定1费招式，仍将所选牌费用变为0', () => {
    const p = probe([]); p.run(byId('tt12-magicfind'));
    expect(p.jobs).toHaveLength(1);
    expect(p.jobs[0].zeroCost).toBe(true);
    expect([sample('武术', 1), sample('法术', 1), sample('装备', 1), sample('法术', 2)].map(p.jobs[0].pred))
      .toEqual([true, true, false, false]);
  });

  it('高端研发的真实发现消费器接受2费法术，保留逐回合降费声明', () => {
    const p = probe([]); p.run(byId('tt12-hitechrd'));
    expect(p.jobs[0].pool).toEqual({ kind: 'moves', cost: 2 });
    expect(p.jobs[0].costDecayPerTurn).toBe(1);
    const candidates = [sample('武术', 2), sample('法术', 2), sample('装备', 2), sample('法术', 1)];
    let state = null;
    let picks = 0;
    const flow = createBattleDiscoverFlow({
      cards: { all: () => candidates, isRandomObtainable: () => true, sellPrice: () => 0 },
      interaction: { getJobs: () => p.jobs, get: () => state, set: v => { state = v; }, requestRender() {} },
      // 真实消费器对固定池有放回抽样并重试去重；交替抽两张，避免常量0永远只抽首张。
      random: { next: () => picks++ % 2 ? 0.75 : 0 }, battle: { currentClass: () => '战士' }, effects: {}, output: { log() {} },
    });
    flow.processDiscoverQueue();
    expect(state.options.map(card => card.type).sort()).toEqual(['武术', '法术']);
  });

  it.each([0, 1, 3])('铁甲阵将随机牌原费用%s降低1，最低0，保持原模板', cost => {
    const template = sample('法术', cost), p = probe([template]);
    p.run(byId('tt7-ironphalanx'));
    expect(p.added).toHaveLength(5);
    expect(p.added.every(card => card.cost === Math.max(0, cost - 1))).toBe(true);
    expect(template.cost).toBe(cost);
    expect(p.added.every(card => card !== template)).toBe(true);
  });

  it('费用减1动作只允许洗入牌库，并保留其他费用动作', () => {
    const card = byId('tt7-ironphalanx');
    expect(inspectCardRuleCapability(card)).toMatchObject({ ok: true });
    for (const dest of ['hand', 'discover']) {
      const changed = structuredClone(card);
      changed.rules.triggers.onPlay[1].dest = dest;
      expect(inspectCardRuleCapability(changed).ok).toBe(false);
    }
  });
});

describe('冰冻装备与伤害路径', () => {
  it('寒冰剑生产声明对冰冻增伤2，文本伤害端口仅叠加一次', () => {
    expect(byId('tt2-frostsword').rules.equip.passive.cond.vsFreeze).toBe(2);
    const hit = makeHitFoe({ combat: Combat, pushFloat() {}, getFrozenTargetBonus: t => t.status.freeze > 0 ? 2 : 0 });
    const frozen = Combat.ensureStatus({ hp: 30 }); Combat.addCurse(frozen, 'freeze', 1);
    const normal = Combat.ensureStatus({ hp: 30 });
    expect(hit({ card: {} }, frozen, 5, 'attack').dealt).toBe(7);
    expect(hit({ card: {} }, normal, 5, 'attack').dealt).toBe(5);
  });

  it('背包伤害类型仅允许damage操作携带四类合法伤害', () => {
    const card = { id: 'bag-type', type: '道具', rules: { version: 1, bag: { use: [{ op: 'damage', amount: 3, dmgType: 'spell' }] } } };
    expect(validateCardRules(card).ok).toBe(true);
    card.rules.bag.use[0].dmgType = 'invalid';
    expect(validateCardRules(card).ok).toBe(false);
    card.rules.bag.use[0] = { op: 'heal', amount: 3, dmgType: 'spell' };
    expect(validateCardRules(card).ok).toBe(false);
  });
});
