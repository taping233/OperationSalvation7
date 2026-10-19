// @vitest-environment node
import { expect, it } from 'vitest';
import { projectPlayerEffects } from '../game/src/battle/runtime/battle.player-effects.js';

it('projects only whitelisted active rules, not pending cards or existing blessings', () => {
  expect(projectPlayerEffects({ immune: 2, pendingTarget: {card: {desc:'免疫诅咒'}}, nextSpellTwice: 0, deathSave: 0 })).toEqual([]);
});
it.each([
  [{ playerCurseImmune: true }, '本场'],
  [{ playerCurseImmune: true, curseImmunityTemporary: true }, '本回合'],
  [{ holyRune: true, turn: 2 }, '2回合'],
  [{ holyRune: true, turn: 4 }, null],
  [{ playerCurseImmune: true, holyRune: true, turn: 2 }, '本场'],
  [{ playerCurseImmune: true, curseImmunityTemporary: true, holyRune: true, turn: 2 }, '2回合'],
])('combines curse immunity sources without duplicate or inferred expiry: %j', (state, duration) => {
  const effects = projectPlayerEffects(state);
  expect(effects).toHaveLength(duration ? 1 : 0);
  if (duration) expect(effects[0].duration).toBe(duration);
});
it.each([
  [{spellCost1:true},'法术1费'], [{meleeCost1:true},'武术1费'],
  [{spellCost1:true,meleeCost1:true},'招式1费'],
])('combines cost rules and preserves their actual battle lifetime', (state, name) => {
  expect(projectPlayerEffects(state)).toMatchObject([{name,duration:'本场'}]);
});
it('has explicit ending conditions, independent counts, and no shared mutation', () => {
  const state=Object.freeze({nextSpellTwice:3,allSpellsInfused:true,discoverPlus:2,bleedAmp:1,deathSave:2,extraTurn:true});
  const first=projectPlayerEffects(state);
  expect(first).toHaveLength(6);
  expect(first.find(e=>e.key==='nextSpell').description).toContain('额外施放1次');
  expect(first.find(e=>e.key==='bleedAmp').description).toContain('不是总伤害翻倍');
  expect(first.find(e=>e.key==='deathSave').duration).toBe('2次');
  first[0].name='changed';
  expect(projectPlayerEffects(state)[0].name).not.toBe('changed');
  expect(projectPlayerEffects({})).toEqual([]);
});
