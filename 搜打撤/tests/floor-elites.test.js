// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import map from '../game/data/map.json';
import { createBattleEngineInstance } from '../game/src/battle/core/battle.engine.instance.js';
import { previewAction } from '../game/src/battle/view/battle.preview.js';

const held = { id:'elite-held', name:'测试牌', type:'武术', cost:0, dmgType:'fixed', desc:'' };
const engines = [];
const normal = { id:'normal', name:'普通怪', hp:20, atk:1 };
function setup(ids, extra = []) {
  const cards = { all:() => [held], deriveDraw:() => 0, deriveInfuse:() => 0, isRandomObtainable:() => true,
    sellPrice:() => 1, randomClassCard:() => held, SHA:{ ...held, id:'starter-attack', name:'初始攻击' },
    TABLETOP10:[], DMG_TYPES:['武术','法术'], DMG_TYPE_META:{ fixed:{}, spell:{}, attack:{}, true:{} } };
  const e = createBattleEngineInstance({ cards, readRules:() => ({ battleEnergy:8, battleHandMax:20,
    bossDeckSize:15, starterSha:0, battleStartDraw:0, battleTurnDraw:0, diceSides:6 }), testMode:true,
    presentation:{ demoMs:() => 0, waitMs:async() => {} } });
  const game = { ownedCards:[{ uid:'held', card:held }], hp:100, maxHp:100, atk:2, spellPower:0,
    coins:0, state:'idle', battleActive:false, log:vi.fn(), heal() {}, addItem() {}, onBattleEnd() {} };
  e.start(game, [...ids.map(id => ({ ...map.monsters[id] })), ...extra], { isBoss:false });
  engines.push(e);
  return { e, r:e.runtime, combat:e.runtime.combat, game };
}
const kill = (e, foe) => e.hitFoe(foe, held, 999, 'true');
async function turn(e) {
  await e.idle();
  e.endTurn();
  await vi.runAllTimersAsync();
  await e.idle();
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const e of engines.splice(0)) if (e.runtime.G.battleActive) e.finish(null);
  vi.clearAllTimers(); vi.useRealTimers();
});

describe('楼层精英能力实际战斗', () => {
  it('暴怒者仅响应敌方真正死亡，每个死亡只加一次', () => {
    const { e, r } = setup(['rager'], [normal, { ...normal, id:'second' }]);
    kill(e, r.foes[1]); expect(r.foes[0].atk).toBe(4);
    e.sweepDead(); expect(r.foes[0].atk).toBe(4);
    kill(e, r.foes[2]); expect(r.foes[0].atk).toBe(6);
  });
  it('逃兵失血绕过防御且能触发连锁死亡', () => {
    const { e, r } = setup(['deserter','rager'], [normal]);
    r.foes[0].hp = 2; r.foes[0].defense.shield = 99;
    kill(e, r.foes[2]);
    expect(r.foes[0].dead).toBe(true);
    expect(r.foes[1].atk).toBe(6);
  });
  it('小鬼死亡回1能量且不会在清尸时重复领取', () => {
    const { e, r } = setup(['greedy_imp'], [normal]);
    r.set$energy(2); kill(e, r.foes[0]); e.sweepDead();
    expect(r.energy).toBe(3);
  });
  it('过客光环只加给其它友方，死亡即时移除且保留其它加攻', () => {
    const { e, r } = setup(['swaggerer'], [normal]);
    expect(r.foes.map(f => f.atk)).toEqual([2,3]);
    r.foes[1].atk += 4;
    kill(e, r.foes[0]); e.sweepDead();
    expect(r.foes[1].atk).toBe(5);
  });
  it.each(['attack','spell','fixed'])('铁皮每段%s上限4，破甲解除限制', type => {
    const { e, r, combat } = setup(['tin_mute'], [normal]);
    expect(e.hitFoe(r.foes[0], held, 7, type)).toBe(4);
    combat.addCurse(r.foes[0], 'abreak', 2);
    expect(e.hitFoe(r.foes[0], held, 7, type)).toBeGreaterThan(4);
  });
  it('真实伤害穿过铁皮；中毒每次仍限4且破甲可克制', () => {
    const { e, r, combat } = setup(['tin_mute','tin_mute'], [normal]);
    expect(e.hitFoe(r.foes[0], held, 7, 'true')).toBe(7);
    combat.addCurse(r.foes[1], 'poison', 7);
    expect(combat.tickPoison(r.foes[1]).dealt).toBe(4);
    combat.addCurse(r.foes[1], 'abreak', 2);
    expect(combat.tickPoison(r.foes[1]).dealt).toBe(7);
  });
  it('铁皮的伤害预览与结算一致', () => {
    const { e, r } = setup(['tin_mute'], [normal]);
    const card = { ...held, dmg:7, rules:{ version:1, triggers:{ onPlay:[{ op:'damage', amount:7, target:'chosenEnemy' }] } } };
    const preview = previewAction({ snapshot:e.getSnapshot(), action:{ uid:'held', targetIndex:0 },
      cardContext:{ card, legal:true, targetIndexes:[0], effectiveCost:0 } });
    expect(preview.damage).not.toBeNull();
    expect(preview.damage.total).toBe(4);
    expect(r.foes[0].hp).toBe(9);
  });
  it('锤手首回合蓄力、第二回合攻击，意图同步', async() => {
    const { e, r, game } = setup(['heavy_hammer']);
    expect(e.getSnapshot().foes[0].intent.damage).toBeNull();
    await turn(e); expect(game.hp).toBe(100);
    expect(r.turn).toBe(2);
    expect(e.getSnapshot().foes[0].intent.damage).toBe(8);
    await turn(e); expect(game.hp).toBe(92);
  });
  it('邪教徒阻止新增攻击/法伤祝福，死后可获得，既有强化保留', () => {
    const { e, r, combat } = setup(['cultist'], [normal]);
    r.pstat.status.atkUp = 3;
    combat.addBlessing(r.pstat, 'atkUp', 2, 1);
    combat.addBlessing(r.pstat, 'spellUp', 2);
    combat.addBlessing(r.pstat, 'dodge', 1);
    expect(r.pstat.status).toMatchObject({ atkUp:3, spellUp:0, dodge:1 });
    expect(r.pstat.__timedBuffs).toBeUndefined();
    kill(e, r.foes[0]);
    combat.addBlessing(r.pstat, 'atkUp', 2); combat.addBlessing(r.pstat, 'spellUp', 2);
    expect(r.pstat.status).toMatchObject({ atkUp:5, spellUp:2 });
  });
  it('假药每次诅咒回2，不随层数多回；受禁疗且不超过满血', () => {
    const { r, combat } = setup(['fake_apothecary']);
    const foe = r.foes[0]; foe.hp = 3;
    combat.addCurse(foe, 'poison', 7); expect(foe.hp).toBe(5);
    combat.addCurse(foe, 'freeze', 1); expect(foe.hp).toBe(7);
    combat.addCurse(foe, 'freeze', 1); expect(foe.hp).toBe(9);
    combat.addBleed(foe, 2); expect(foe.hp).toBe(10);
    foe.hp = 4; combat.addCurse(foe, 'healban', 2); expect(foe.hp).toBe(4);
    combat.addCurse(foe, 'poison', 1); expect(foe.hp).toBe(4);
  });
  it('邪教徒拦截真实文本/结构化强化路径，假药响应两条诅咒路径', () => {
    const { e, r } = setup(['cultist','fake_apothecary']);
    const text = { ...held, name:'强化测试', desc:'获得 2 点攻击力。法伤 +2。' };
    e.resolveCard(text, null, false, 0);
    e.resolveCard({ ...held, rules:{ version:1, triggers:{ onPlay:[
      { op:'blessing', key:'atkUp', stacks:2 }, { op:'blessing', key:'spellUp', stacks:2 },
    ] } } }, null, false, 0);
    expect(r.pstat.status).toMatchObject({ atkUp:0, spellUp:0 });
    r.foes[1].hp = 3;
    e.resolveCard({ ...held, name:'中毒测试', desc:'附加 1 层中毒。' }, r.foes[1], false, 0);
    expect(r.foes[1].hp).toBe(5);
    e.resolveCard({ ...held, rules:{ version:1, battle:{ target:{ side:'enemy', area:false } }, triggers:{ onPlay:[
      { op:'curse', curse:'poison', stacks:1, target:'chosenEnemy' },
    ] } } }, r.foes[1], false, 0);
    expect(r.foes[1].hp).toBe(7);
    kill(e, r.foes[0]); e.resolveCard(text, null, false, 0);
    expect(r.pstat.status).toMatchObject({ atkUp:2, spellUp:2 });
  });
  it('狙击手第一回合潜行挡伤，友方全灭即时破隐；单独出场无潜行', () => {
    const { e, r } = setup(['camo_sniper'], [normal]);
    expect(e.hitFoe(r.foes[0], held, 1, 'true')).toBe(0);
    kill(e, r.foes[1]); expect(r.foes[0].status.stealth).toBe(0);
    expect(e.hitFoe(r.foes[0], held, 1, 'true')).toBe(1);
    expect(setup(['camo_sniper']).r.foes[0].status.stealth).toBe(0);
  });
  it('狙击手潜行最迟第一回合结束失效', async() => {
    const { e, r } = setup(['camo_sniper'], [normal]);
    await turn(e); expect(r.turn).toBe(2); expect(r.foes[0].status.stealth).toBe(0);
  });
  it('入场检查点重载保留精英身份、光环和偶数回合能力', () => {
    const { e, r, game } = setup(['swaggerer','heavy_hammer']);
    const checkpoint = e.getSnapshot().restartCheckpoint || r.battleRestartCheckpoint;
    expect(e.restore(game, checkpoint)).toBe(true);
    expect(r.foes.map(f => f.atk)).toEqual([2,10]);
    expect(r.foes[1].evenAttack).toBe(true);
  });
});
