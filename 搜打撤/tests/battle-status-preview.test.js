// @vitest-environment node
import { expect, it } from 'vitest';
import { previewAction } from '../game/src/battle/view/battle.preview.js';
const curse = { op: 'curse', curse: 'poison', stacks: 2, target: 'chosenEnemy' };
const armor = { op: 'armor', amount: 6 };
function input(ops = [curse, armor], mode = 'normal') {
  return { snapshot: { mode, foes: [{ hp: 5, dead: false, status: {}, defense: {} }] },
    action: { uid: 'status-card', targetIndex: 0 }, cardContext: { mode, card: { id: 'not-hardcoded', cost: 1,
      rules: { triggers: { onPlay: ops } } }, targetIndexes: [0], legal: true } };
}
it('shows generic structured declarations without predicting zero damage or mutating input', () => {
  const request = input(), before = JSON.stringify(request);
  const result = previewAction(request);
  expect(result).toMatchObject({ confidence: 'unknown', damage: null, reasons: [], knownEffects: ['目标附加 2 层中毒', '自己获得 6 点护甲'] });
  expect(result.unknownEffects).toEqual([]);
  expect(JSON.stringify(request)).toBe(before);
  expect(Object.isFrozen(result.knownEffects)).toBe(true);
});
it.each(['normal', 'boss'])('describes draw substitution for %s', mode => {
  const result = previewAction(input([curse, { op: 'draw', amount: 1 }], mode));
  expect(result.knownEffects[1]).toBe(mode === 'normal' ? '从本场牌库抽 1 张牌' : '抽 1 张牌');
});
it('distinguishes extending an existing status from applying it', () => {
  const result = previewAction(input([{ op: 'curse', curse: 'freeze', duration: 1, extend: 2, target: 'allEnemies' }]));
  expect(result.knownEffects[0]).toBe('所有敌人已有的冰冻延长 2 回合（未附带时无效）');
});
it.each([
  [{ ...curse, burst: true }], [{ ...curse, mystery: true }], [{ ...curse, target: 'randomEnemy' }],
  [{ ...curse, stacks: '2' }], [{ ...armor, amountField: 'armor' }], [{ op: 'damage', amount: 2 }, curse],
  [{ op: 'registerRule' }], [], [{ op: 'curse', curse: 'freeze', duration: 1, stacks: 2, target: 'chosenEnemy' }],
].map(ops => [ops]))('does not classify unknown or damage operations as pure status: %j', ops => {
  expect(previewAction(input(ops)).knownEffects).toEqual([]);
});
it('keeps illegal and transformed guards, and labels declarations even with damage-only modifiers', () => {
  const request = input(); request.cardContext.legal = false;
  expect(previewAction(request).legal).toBe(false);
  request.cardContext.legal = true; request.cardContext.shaTransformed = true;
  expect(previewAction(request).knownEffects).toEqual([]);
  request.cardContext.shaTransformed = false; request.cardContext.heartsMode = true;
  request.cardContext.modifiers = { specialLifecycle: true }; request.cardContext.wholeCardRepeats = 2;
  expect(previewAction(request)).toMatchObject({ confidence: 'unknown', damage: null, reasons: [], unknownEffects: ['本次会重复结算'] });
});

it.each(['__proto__', 'constructor', 'toString', 'unknown-status'])('rejects inherited or unknown status/target keys: %s', key => {
  expect(previewAction(input([{ ...curse, curse:key }])).knownEffects).toEqual([]);
  expect(previewAction(input([{ ...curse, target:key }])).knownEffects).toEqual([]);
});
it('does not coerce object keys into supported declaration names', () => {
  expect(previewAction(input([{ ...curse, curse:{ toString:() => 'poison' } }])).knownEffects).toEqual([]);
  expect(previewAction(input([{ ...curse, target:{ toString:() => 'chosenEnemy' } }])).knownEffects).toEqual([]);
});
