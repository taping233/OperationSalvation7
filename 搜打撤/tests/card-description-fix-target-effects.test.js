import { battleRules } from './helpers/environment-fixtures.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { ...battleRules(99, 99, 8, 0, 99, 1) }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const Combat = await import('../game/src/battle/core/combat.js');
const { Random, SeededRandomService, setRandomService } = await import('../game/src/core/random.js');
const { applyRandomBlessings, withBlessingChoices } = await import('../game/src/battle/effects/random-blessings.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const byId = id => C.all().filter(card => card.id === id).at(-1);
let randomBefore = null;
function chooseFirstRandomOption() {
  randomBefore = Random.snapshot();
  const fixed = new SeededRandomService(randomBefore.seed);
  fixed.random = () => 0;
  setRandomService(fixed);
}
afterEach(() => {
  if (randomBefore) {
    setRandomService(new SeededRandomService(randomBefore.seed));
    Random.restore(randomBefore);
    randomBefore = null;
  }
  vi.restoreAllMocks();
});

async function drain() {
  for (let i = 0; i < 300; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) {
      await new Promise(resolve => setTimeout(resolve, 30));
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
    }
  }
  throw Error('卡面回归动作未收口');
}
async function start(ids, boss = false) {
  const game = {
    ownedCards: ids.map((id, i) => ({ uid: `target-${i}`, card: byId(id) })), inventory: [], usedPocket: [],
    hp: 50, maxHp: 50, atk: 5, spellPower: 0, coins: 0, state: 'idle', battleActive: false, myClass: '战士',
    log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, onBattleEnd() {},
  };
  BattleSession.start(game, [{ id: 'target-foe', name: '靶', hp: 1000, atk: 0 }], { isBoss: boss, nest: boss });
  await drain();
  return game;
}
const ally = (name, more = {}) => Combat.ensureStatus({ name, hp: 20, maxHp: 20, atk: 1, dead: false, ...more });
const score = unit => ['stealth', 'atkUp', 'spellUp', 'reduce'].reduce((sum, key) => sum + (unit.status[key] || 0), 0) + (unit.defense?.armor || 0);

describe('卡面修复：目标与当次效果', () => {
  it('飞身劈当次流血加成翻倍，随后初始攻击恢复普通流血加成', async () => {
    await start(['tt3-fly-arrowhawk', 'starter-attack']);
    Combat.addCurse(runtime.foes[0], 'bleed', 2);
    BattleSession.commands.playCard('target-0', 0);
    const firstHp = (await drain()).foes[0].hp;
    BattleSession.commands.playCard('target-1', 0);
    const nextHp = (await drain()).foes[0].hp;
    expect([1000 - firstHp, firstHp - nextHp]).toEqual([12, 7]);
    expect(runtime.pstat.status.bleedAmp || 0).toBe(0);
  });

  it.each(['attack', 'spell', 'fixed', 'true'])('闪避避开首段%s，下一段正常受伤', type => {
    const unit = Combat.ensureStatus({ hp: 30 });
    Combat.addBlessing(unit, 'dodge', 1, 1);
    expect(Combat.dealDamage({ atk: 5, spellPower: 2 }, unit, 3, type).dealt).toBe(0);
    expect([unit.hp, unit.status.dodge]).toEqual([30, 0]);
    expect(Combat.dealDamage({}, unit, 3, 'fixed').dealt).toBe(3);
  });

  it('随机祝福按各角色当前状态优先未获得，并分别掷骰', () => {
    const player = ally('玩家', { status: { stealth: 1 } });
    const minion = ally('随从');
    const random01 = vi.fn(() => 0);
    const applied = applyRandomBlessings({ text: '全体友方随机获取一项祝福（潜行、攻击力、法伤、减伤、护甲、净化）',
      player, playerDefense: player.defense, allies: [minion, ally('死亡', { dead: true }), ally('空血', { hp: 0 }), ally('物件', { statless: true })],
      combat: Combat, random01, log() {}, esc: String });
    expect(applied).toBe(2);
    expect(random01).toHaveBeenCalledTimes(2);
    expect([player.status.atkUp, minion.status.stealth]).toEqual([1, 1]);
  });

  it('拥有全部持续祝福且无诅咒时，完整候选回退仍可净化', () => {
    const unit = ally('全部拥有', { status: { stealth: 1, atkUp: 1, spellUp: 1, reduce: 1 }, defense: { armor: 5 } });
    const purify = vi.fn(Combat.purify);
    applyRandomBlessings({ text: '全体友方随机获取一项祝福：潜行、攻击力、法伤、减伤、护甲、净化',
      player: unit, playerDefense: unit.defense, combat: { ...Combat, purify }, random01: () => 0.999, log() {}, esc: String });
    expect(purify).toHaveBeenCalledWith(unit);
  });

  it.each([0, 1])('花开两面选择分支%s，两门的天国之门保留完整候选并作用玩家与活随从', async choice => {
    await start(['tt8-hero-summoner'], true);
    chooseFirstRandomOption();
    const living = ally('友方');
    const dead = ally('已死亡', { dead: true });
    const object = ally('场面物件', { statless: true });
    runtime.allies.push(living, dead, object);
    BattleSession.commands.playCard('target-0', null);
    await drain();
    BattleSession.commands.pickChoice(choice);
    await drain();
    const heaven = runtime.delayed.find(job => job.ops?.some(operation => operation.op === 'randomBlessing'));
    expect(heaven).toBeTruthy();
    expect(heaven).toMatchObject({ special: 'choiceOps', repeat: true, ops: [{ op: 'randomBlessing', target: 'allAllies', choices: ['stealth', 'atkUp', 'spellUp', 'reduce', 'armor', 'purify'], preferMissing: true }] });
    expect(BattleSession.getSnapshot().choosing).toBeNull();
    const isDelayed = !!heaven.notBeforeTurn;
    const before = score(runtime.pstat) + score(living);
    if (isDelayed) {
      runtime.set$turn(2); await engine.processDelayed(); await drain();
      expect(score(runtime.pstat) + score(living)).toBe(before);
    }
    runtime.set$turn(isDelayed ? 3 : 2);
    await engine.processDelayed(); await drain();
    expect(score(runtime.pstat)).toBe(1);
    expect(score(living)).toBe(1);
    expect(score(dead)).toBe(0);
    expect(score(object)).toBe(0);
  });

  it('天国之门直接注册保留候选，并在连续回合为全体友方施加祝福', async () => {
    await start(['starter-attack']);
    chooseFirstRandomOption();
    const living = ally('直接开门友方');
    runtime.allies.push(living);
    engine.resolveCard(byId('cmtn7err0a7'), runtime.foes[0]);
    const job = runtime.delayed.find(entry => entry.cardName === '天国之门');
    expect(job.text).toMatch(/潜行.*攻击力.*法伤.*减伤.*护甲.*净化/);
    expect(job.repeat).toBe(true);
    runtime.set$turn(2); await engine.processDelayed(); await drain();
    expect([runtime.pstat.status.stealth, living.status.stealth]).toEqual([1, 1]);
    expect([score(runtime.pstat), score(living)]).toEqual([1, 1]);
    runtime.set$turn(3); await engine.processDelayed(); await drain();
    expect([runtime.pstat.status.atkUp, living.status.atkUp]).toEqual([1, 1]);
    expect([score(runtime.pstat), score(living)]).toEqual([2, 2]);
  });

  it('新描述不使用括号时，第二门仍携带六项祝福候选', () => {
    const text = withBlessingChoices('为全体友方随机施加 1 项祝福，优先选择未获得的祝福',
      '回合开始时，为全体友方随机施加 1 项祝福。祝福包括：潜行 1 回合、攻击力增加 1 点、法伤增加 1 点、减伤 1 点、获得 5 点护甲或净化。');
    expect(text).toMatch(/潜行.*攻击力.*法伤.*减伤.*护甲.*净化/);
  });
});
