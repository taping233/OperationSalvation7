// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createChoiceSemanticOperations } from '../game/src/battle/effects/choice-semantic-operations.js';
import { applyRandomBlessings } from '../game/src/battle/effects/random-blessings.js';
import { BUILTIN_CHOICE_REVISIONS } from '../game/src/cards/builtin-choice-execution.js';

const curses = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban'];
function harness() {
  const runtime = { turn:3, delayed:[], pstat:{ status:{} }, pdef:{ armor:0 }, allies:[] };
  const combat = {
    addCurse:vi.fn((unit, key, n) => { unit.status[key] = (unit.status[key] || 0) + n; }),
    addBlessing:(unit, key, n) => { unit.status[key] = (unit.status[key] || 0) + n; },
    hasCurse:unit => curses.some(key => unit.status[key] > 0),
    purify:unit => { for (const key of curses) unit.status[key] = 0; },
  };
  const foes = [{ status:{} }, { status:{} }, { status:{} }], queueChoice = vi.fn(), randomBattle = vi.fn(() => 0.5);
  return { runtime, combat, foes, ports:{ queueChoice, randomBattle, getAliveFoes:() => foes },
    ...createChoiceSemanticOperations({ runtime, combat }) };
}

it('结构选项保留展示标签并把执行计划单独交给队列', () => {
  const h = harness(), card = { name:'改写后的神灯', rules:BUILTIN_CHOICE_REVISIONS['tt3-magic-lamp'].rules };
  const operation = card.rules.triggers.onPlay[0];
  expect(h.resolveOperation(card, operation, h.ports)).toBe(true);
  const job = h.ports.queueChoice.mock.lastCall[0];
  expect(job.options).toEqual(operation.options.map(option => option.label));
  expect(job.plans).toEqual(operation.options);
  expect(job.srcCard).toBe(card);
  expect(h.foes.every(foe => Object.keys(foe.status).length === 0)).toBe(true);
});

it('普通选择返回真实操作步骤，未选分支不会执行', () => {
  const h = harness(), card = { name:'任意卡文' }, ops = [{ op:'armor', amount:5 }];
  const stepsForOperations = vi.fn(function* (source, operations, target) { yield { source, operations, target }; });
  const output = [...h.selectChoice({ srcCard:card, plans:[{ label:'选项', ops }] }, 0, { ...h.ports, stepsForOperations })];
  expect(stepsForOperations).toHaveBeenCalledWith(card, ops, h.foes[0]);
  expect(output).toEqual([{ source:card, operations:ops, target:h.foes[0] }]);
  expect(h.runtime.delayed).toEqual([]);
});

it('两扇门分别从下回合和两回合后的回合开始执行，不提前掷随机', () => {
  const h = harness(), operation = BUILTIN_CHOICE_REVISIONS['tt8-hero-summoner'].rules.triggers.onPlay[0];
  const card = { name:'花开两面', desc:'与规则无关' };
  h.resolveOperation(card, operation, h.ports);
  const job = h.ports.queueChoice.mock.lastCall[0];
  expect([...h.selectChoice(job, 1, h.ports)]).toEqual([]);
  expect(h.runtime.delayed).toHaveLength(2);
  expect(h.runtime.delayed[0]).toMatchObject({ special:'choiceOps', repeat:true, ops:operation.options[1].ops });
  expect(h.runtime.delayed[0].notBeforeTurn).toBeUndefined();
  expect(h.runtime.delayed[1]).toMatchObject({ special:'choiceOps', repeat:true, ops:operation.options[0].ops, notBeforeTurn:5 });
  expect(h.ports.randomBattle).not.toHaveBeenCalled();
});

it('诅咒每名敌人独立随机，优先缺少种类，六种齐备时从完整池选', () => {
  const h = harness(); h.foes.splice(2);
  h.foes[0].status = { bleed:1, poison:1, freeze:1, silence:1, abreak:1 };
  h.foes[1].status = Object.fromEntries(curses.map(key => [key, 1]));
  h.ports.randomBattle.mockReturnValueOnce(0.9).mockReturnValueOnce(0);
  h.resolveOperation({}, { op:'randomCurse', target:'allEnemies', curses, stacks:1, preferMissing:true }, h.ports);
  expect(h.foes[0].status.healban).toBe(1);
  expect(h.foes[1].status.bleed).toBe(2);
  expect(h.ports.randomBattle).toHaveBeenCalledTimes(2);
});

it('结构祝福与原真实门帮助器的状态和随机消耗相同，场面物件不承载祝福', () => {
  const h = harness();
  h.runtime.pstat.status = { stealth:1, atkUp:1, spellUp:1, reduce:1, poison:1 };
  h.runtime.allies = [{ name:'随从', hp:5, status:{} }, { statless:true, hp:0, status:{} }];
  const legacy = structuredClone(h.runtime), random = vi.fn(() => 0.75);
  const choices = ['stealth', 'atkUp', 'spellUp', 'reduce', 'armor', 'purify'];
  applyRandomBlessings({ text:'全体友方 潜行 攻击力 法伤 减伤 护甲 净化', player:legacy.pstat,
    playerDefense:legacy.pdef, allies:legacy.allies, combat:h.combat, random01:random, log:() => {}, esc:String });
  h.ports.randomBattle.mockReturnValue(0.75);
  h.resolveOperation({}, { op:'randomBlessing', target:'allAllies', choices, preferMissing:true }, h.ports);
  expect(h.runtime).toEqual(legacy);
  expect(h.ports.randomBattle).toHaveBeenCalledTimes(random.mock.calls.length);
  expect(h.runtime.allies[1].status).toEqual({});
});

it('冻结稳定选择前两名存活目标，不额外掷随机', () => {
  const h = harness();
  h.resolveOperation({}, { op:'freezeFirstEnemies', count:2, duration:1 }, h.ports);
  expect(h.foes.map(foe => foe.status.freeze || 0)).toEqual([1, 1, 0]);
  expect(h.ports.randomBattle).not.toHaveBeenCalled();
});
