import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCombatRuntime } from '../game/src/battle/core/combat.factory.js';
import { applyBossOpening, applyBossTurnStart, cleanseBlockerAfterAttack, BOSS_SUMMON_POOL } from '../game/src/battle/core/battle.boss-mechanics.js';
import mapData from '../game/data/map.json' with { type: 'json' };
import { battleRules } from './helpers/environment-fixtures.js';

const combat = createCombatRuntime();
const unit = (behavior, overrides = {}) => combat.ensureStatus({ behavior, hp: 75, maxHp: 75, atk: 5, ...overrides });
function harness(foes) {
  const runtime = { turn: 1, foes, allies: [], pstat: unit('player'), drawPile: ['bottom', 'b', 'a'], grave: [], cardAnims: [], G: { mode:'standard', log: vi.fn() } };
  const engine = { intentFor: vi.fn(() => ({})), findCard: uid => ({ card: { name: uid } }), addPlayerCurse: (key, n) => combat.addCurse(runtime.pstat, key, n) };
  return { runtime, combat, engine, random: { random: vi.fn(() => 0) } };
}

describe('四位新首脑数值和机制', () => {
  it('在原池末尾追加四位，不改变已有首脑索引', () => {
    expect(mapData.altar.bosses.slice(0,3).map(b => b.id)).toEqual(['boss_general','boss_orc','boss_elem']);
    expect(mapData.altar.bosses.slice(-4).map(b => [b.atk,b.hp])).toEqual([[1,60],[6,45],[5,55],[5,75]]);
  });
  it('教皇逐段实际攻击增攻；零伤不触发，法伤回血受禁疗/致死约束', () => {
    const pope = unit('witness_pope', { hp:60, maxHp:60, atk:1 });
    combat.dealDamage({}, pope, 2, 'attack'); combat.dealDamage({}, pope, 2, 'attack');
    expect(pope.atk).toBe(3); expect(pope.hp).toBe(56);
    combat.dealDamage({}, pope, 0, 'attack'); expect(pope.atk).toBe(3);
    combat.dealDamage({}, pope, 3, 'spell'); expect(pope.hp).toBe(54);
    pope.status.healban=1; combat.dealDamage({},pope,3,'spell'); expect(pope.hp).toBe(51);
    pope.status.healban=0; combat.dealDamage({},pope,60,'spell'); expect(pope.hp).toBe(0);
  });
  it('死灵最终倍增在护甲之后，覆盖四类伤害与中毒；免疫仍为零', () => {
    for (const type of ['attack','spell','fixed','true']) {
      const foe=unit('necromancer'); foe.status.necroticExposure=4; foe.defense.armor=2;
      expect(combat.dealDamage({},foe,3,type).dealt).toBe(type==='true'?12:4);
    }
    const foe=unit('necromancer'); foe.status.necroticExposure=8; foe.status.poison=2;
    expect(combat.tickPoison(foe).dealt).toBe(16);
    foe.status.immune=1; expect(combat.tickPoison(foe).dealt).toBe(0);
  });
  it('第3/6/9回合先撕牌库顶，再永久×2/4/8；空库仍增长，重复调用/读档不重复', () => {
    const h=harness([unit('necromancer')]);
    for (const turn of [3,6,9]) {
      h.runtime.turn=turn; applyBossTurnStart(h); applyBossTurnStart(h);
      expect(h.runtime.foes[0].status.necroticExposure).toBe(2**(turn/3));
      h.runtime.foes=JSON.parse(JSON.stringify(h.runtime.foes)); applyBossTurnStart(h);
      expect(h.runtime.foes[0].status.necroticExposure).toBe(2**(turn/3));
    }
    expect(h.runtime.grave).toEqual(['b','a','bottom']); expect(h.runtime.drawPile).toEqual([]);
  });
  it('母体仅在2/4/6开始召唤，精英技能/难度和非首脑标记保留', () => {
    const h=harness([unit('mutation_mother')]); h.runtime.G.mode='elite';
    for (let turn=1;turn<=7;turn++) { h.runtime.turn=turn; applyBossTurnStart(h); applyBossTurnStart(h); }
    expect(h.runtime.foes).toHaveLength(4);
    const first=mapData.monsters[BOSS_SUMMON_POOL[0]], summon=h.runtime.foes[1];
    expect(summon).toMatchObject({ id:BOSS_SUMMON_POOL[0], boss:false, controlBoss:false, hp:Math.round(first.hp*1.35) });
    expect(BOSS_SUMMON_POOL).toContain('cultist');
  });
  it('拦路人开场覆盖双方与自身，清除只减随机一种一层，未攻击不调用', () => {
    const blocker=unit('mysterious_blocker'), h=harness([blocker,unit('strike')]);
    h.runtime.allies.push(unit('ally')); applyBossOpening(h);
    for (const target of [h.runtime.pstat,...h.runtime.foes,...h.runtime.allies]) expect(target.status).toMatchObject({bleed:1,poison:1,abreak:1,healban:1});
    blocker.status.bleed=3;
    expect(cleanseBlockerAfterAttack(blocker,combat,h.random,vi.fn())).toBe('流血');
    expect(blocker.status.bleed).toBe(2); expect(blocker.status.poison).toBe(1);
  });
});

window.SDT ||= { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(3,30,15,0,3,1) }, items:{} };
await import('../game/src/cards/cards.js');
window.SDT.Cards.ensureSha(); window.SDT.Cards.ensureStarters(); window.SDT.Cards.ensureDmgTypes(); window.SDT.Cards.ensureEffectFields();
const { BattleSession, configureBattleRenderer } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
let game;
beforeEach(() => { vi.useFakeTimers(); configureBattleRenderer(() => {}); });
afterEach(() => { if(game?.battleActive) BattleSession.commands.flee(); configureBattleRenderer(null); vi.clearAllTimers(); vi.useRealTimers(); });
function start(behavior) {
  game={ hp:1000,maxHp:1000,atk:1,spellPower:0,coins:0,myClass:'战士',state:'idle',battleActive:false,inventory:[],usedPocket:[], ownedCards:[],log() {},onBattleEnd() {},heal(n){this.hp=Math.min(this.maxHp,this.hp+n);} };
  BattleSession.start(game,[{ id:behavior,name:behavior,hp:999,atk:1,behavior }],{ isBoss:false });
}
it('真实开战入口触发拦路人，真实回合管线在第2回合召唤并可读档', async () => {
  start('mysterious_blocker'); expect(R.pstat.status).toMatchObject({bleed:1,poison:1,abreak:1,healban:1});
  BattleSession.commands.flee(); start('mutation_mother');
  BattleSession.commands.endTurn(); await vi.advanceTimersByTimeAsync(2000);
  expect(R.turn).toBe(2); expect(R.foes).toHaveLength(2); expect(R.busy).toBe(false);
  const saved=JSON.parse(JSON.stringify(BattleSession.serialize()));
  expect(BattleSession.restore(game,saved)).toBe(true);
  expect(R.foes).toHaveLength(1); expect(R.turn).toBe(1); expect(R.foes[0].status.bossLastTrigger).toBeUndefined();
});
it('真实回合管线在第3回合撕牌，开始抽牌前执行', async () => {
  start('necromancer'); const deck=R.drawPile.slice();
  for(let n=0;n<2;n++){ BattleSession.commands.endTurn(); await vi.advanceTimersByTimeAsync(2000); }
  expect(R.turn).toBe(3); expect(R.grave).toEqual(deck.slice(-2)); expect(R.drawPile).toHaveLength(deck.length-2);
  expect(R.foes[0].status.necroticExposure).toBe(2);
  const saved=JSON.parse(JSON.stringify(BattleSession.serialize()));
  expect(BattleSession.restore(game,saved)).toBe(true);
  expect(R.turn).toBe(1); expect(R.grave).toEqual([]); expect(R.foes[0].status.necroticExposure).toBeUndefined();
});
it('拦路人攻击被随从承受时仍清除自身一层诅咒', async () => {
  start('mysterious_blocker');
  Object.assign(R.foes[0].status,{bleed:2,poison:0,abreak:0,healban:0});
  R.set$allies([combat.ensureStatus({name:'护卫',hp:100,maxHp:100,atk:1})]);
  BattleSession.commands.endTurn(); await vi.advanceTimersByTimeAsync(2000);
  expect(R.foes[0].status.bleed).toBe(1); expect(R.allies[0].hp).toBeLessThan(100);
});
