// Read-only gameplay audit: real card and BattleSession commands; constructed status cases are explicit.
import { afterEach, describe, expect, it } from 'vitest';

window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 8,
    starterSha: 0, battleStartDraw: 99, battleTurnDraw: 1, diceSides: 6 },
    items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
const root = '../../../game/src/';
await import(root + 'cards/cards.js');
const { BattleSession } = await import(root + 'battle/core/battle.core.js');
const runtime = await import(root + 'battle/runtime/battle.runtime.js');
const Combat = await import(root + 'battle/core/combat.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const byId = id => C.all().filter(c => c.id === id).at(-1);
let game;
async function drain() {
  for (let i = 0; i < 500; i++) {
    await new Promise(r => setTimeout(r, 2));
    const s = BattleSession.getSnapshot();
    if (!s.busy && !s.actionQueueLength) {
      await new Promise(r => setTimeout(r, 20));
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && !fresh.actionQueueLength) return fresh;
    }
  }
  throw Error('Audit battle action did not settle');
}
const foe = (id, hp = 100, atk = 3) => ({ id, name: id, hp, maxHp: hp, atk });
async function start(enemies = [foe('target')], ids = ['tt7-recruit', 'starter-attack']) {
  game = {
    ownedCards: ids.map((id, i) => ({ uid: 'audit-' + i, card: byId(id) })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '法师',
    state: 'idle', battleActive: false, inventory: [], usedPocket: [], logs: [],
    log(m) { this.logs.push(String(m)); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    onBattleEnd() {}, addItem() {},
  };
  BattleSession.start(game, enemies, { isBoss: false, name: '随从机制审查' });
  await drain();
  BattleSession.commands.playCard('audit-0', 'self');
  await drain();
  return game;
}
async function end() { BattleSession.commands.endTurn(); return drain(); }
afterEach(async () => {
  if (game?.battleActive) { BattleSession.commands.flee(); await drain(); }
});

describe('随从机制审查：当前工作树', () => {
  it('真实征召召唤两名4/4，消耗2能量', async () => {
    await start();
    expect(runtime.allies).toHaveLength(2);
    expect(runtime.allies.map(a => [a.name, a.atk, a.hp])).toEqual([['步兵', 4, 4], ['步兵', 4, 4]]);
    expect(BattleSession.getSnapshot().energy).toBe(97);
  });
  it('自动攻击、逐名代挡、阵亡停止攻击、全灭后玩家承伤', async () => {
    await start();
    const states = [];
    for (let i = 0; i < 5; i++) {
      await end();
      states.push([runtime.foes[0].hp, game.hp, ...runtime.allies.map(a => [a.hp, a.dead])]);
    }
    expect(states).toEqual([
      [92, 100, [1, false], [4, false]],
      [84, 100, [0, true], [4, false]],
      [80, 100, [0, true], [1, false]],
      [76, 100, [0, true], [0, true]],
      [76, 97, [0, true], [0, true]],
    ]);
  });
  it('一名随从击杀后，下一名改打存活敌人', async () => {
    await start([foe('first', 4, 0), foe('second', 10, 0)]);
    await end();
    expect(runtime.foes.map(f => [f.hp, !!f.dead])).toEqual([[0, true], [6, false]]);
  });
  it('最后敌人被随从击杀后战斗胜利', async () => {
    await start([foe('last', 8, 99)]);
    await end();
    expect(game.battleActive).toBe(false);
    expect(game.hp).toBe(100);
    expect(runtime.foes[0].dead).toBe(true);
  });
  it('新战斗清空上一场随从', async () => {
    await start();
    BattleSession.commands.flee(); await drain();
    BattleSession.start(game, [foe('next')], { isBoss: false });
    await drain();
    expect(runtime.allies).toHaveLength(0);
  });
  it('构造天国之门可授予的潜行：随从造成伤害后应破潜', async () => {
    await start();
    runtime.allies.forEach(a => Combat.addBlessing(a, 'stealth', 1));
    await end();
    expect(runtime.foes[0].hp).toBe(92);
    expect(runtime.allies.map(a => a.status.stealth || 0)).toEqual([0, 0]);
    expect(runtime.allies[0].hp).toBe(1);
  });
  it('构造零攻击潜行随从：1回合潜行应到期', async () => {
    await start([foe('target', 100, 0)]);
    runtime.allies.forEach(a => { a.atk = 0; Combat.addBlessing(a, 'stealth', 1); });
    await end();
    expect(runtime.allies.map(a => a.status.stealth || 0)).toEqual([0, 0]);
  });
  it('构造首位敌人潜行：自动攻击应选择后方合法目标', async () => {
    await start([foe('hidden', 100, 0), foe('visible', 100, 0)]);
    Combat.addBlessing(runtime.foes[0], 'stealth', 1);
    await end();
    expect(runtime.foes.map(f => f.hp)).toEqual([100, 92]);
  });
});
