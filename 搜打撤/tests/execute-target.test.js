// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { resolveExecute, executeTargetReason } from '../game/src/battle/effects/effect-steps.m2.js';

const card = { id: 'tt3sp-devour', name: '吞噬', desc: '', rules: { battle: { target: { side: 'enemy', area: false } } } };
const foe = id => ({ id, name: id, hp: 6, maxHp: 6, atk: 4, dead: false });
function fixture() {
  const targets = [foe('first'), foe('second'), foe('third')];
  const hitFoe = vi.fn(target => { target.hp = 0; target.dead = true; });
  return { targets, deps: { getAliveFoes: () => targets.filter(target => !target.dead), hitFoe, log: vi.fn(), esc: value => value } };
}
it('single execute honors the selected second eligible enemy', () => {
  const { targets, deps } = fixture();
  expect(resolveExecute(card, { cap: { atk: 4 }, count: 1 }, targets[1], deps)).toBe(true);
  expect(deps.hitFoe).toHaveBeenCalledTimes(1);
  expect(deps.hitFoe.mock.calls[0][0]).toBe(targets[1]);
  expect(deps.hitFoe.mock.calls[0].slice(2)).toEqual([10005, 'true', '（消灭）']);
  expect(targets.map(target => target.dead)).toEqual([false, true, false]);
});
it('untargeted multi-execute preserves original eligible order and count', () => {
  const { targets, deps } = fixture();
  expect(resolveExecute(card, { cap: { atk: 4 }, count: 2 }, null, deps)).toBe(true);
  expect(deps.hitFoe.mock.calls.map(call => call[0])).toEqual(targets.slice(0, 2));
});
it('no eligible enemy produces no hit', () => {
  const { targets, deps } = fixture();
  targets.forEach(target => { target.atk = 5; });
  expect(resolveExecute(card, { cap: { atk: 4 }, count: 1 }, null, deps)).toBe(false);
  expect(deps.hitFoe).not.toHaveBeenCalled();
});

it.each(['over-cap', 'dead', 'absent', 'affix'])('explicit %s target never redirects to another eligible enemy', reason => {
  const { targets, deps } = fixture();
  let selected = targets[1];
  if (reason === 'over-cap') selected.atk = 5;
  if (reason === 'dead') selected.dead = true;
  if (reason === 'absent') selected = foe('removed');
  if (reason === 'affix') selected.affix = 'boss';
  expect(resolveExecute(card, { cap: { atk: 4 }, count: 1 }, selected, deps)).toBe(false);
  expect(deps.hitFoe).not.toHaveBeenCalled();
});
it('untargeted TNT ignores incidental anchor and preserves multi-target count', () => {
  const { targets, deps } = fixture();
  const tnt = { ...card, rules: { battle: { target: { side: null, area: false } } } };
  resolveExecute(tnt, { cap: { atk: 5 }, count: 2 }, targets[1], deps);
  expect(deps.hitFoe.mock.calls.map(call => call[0])).toEqual(targets.slice(0, 2));
});

it('pure execute precheck allows choosing when any eligible foe exists and rejects an empty eligible set', () => {
  const { targets } = fixture();
  const pure = { ...card, rules: { ...card.rules, triggers: { onPlay: [{ op: 'execute', cap: { atk: 4 }, count: 1 }] } } };
  expect(executeTargetReason(pure, null, targets)).toBeNull();
  targets.forEach(target => { target.atk = 5; });
  expect(executeTargetReason(pure, null, targets)).toMatchObject({ code: 'EXECUTE_TARGET_INELIGIBLE' });
  expect(executeTargetReason(pure, targets[1], targets).message).toContain('攻击力不高于4');
  const mixed = { ...pure, rules: { ...pure.rules, triggers: { onPlay: [{ op: 'stealAtk', n: 2 }, ...pure.rules.triggers.onPlay] } } };
  expect(executeTargetReason(mixed, targets[1], targets)).toBeNull();
});
