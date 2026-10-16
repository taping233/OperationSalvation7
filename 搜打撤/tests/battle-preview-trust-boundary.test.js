import { describe, expect, it } from 'vitest';
import { previewAction } from '../game/src/battle/view/battle.preview.js';
import { getHostedExecutionCard } from '../game/src/battle/effects/battle.hosted.js';
import { Random } from '../game/src/core/random.js';

const damage = (extra = {}) => ({ op: 'damage', amount: 5, target: 'chosenEnemy', ...extra });
const structured = (ops = [damage()]) => ({ id: 'trust-test', type: '法术', dmgType: 'spell', dmg: 5,
  rules: { version: 1, triggers: { onPlay: ops } } });
function preview(card = structured(), { status = {}, defense = {}, playerStatus = {}, context = {}, spellPower = 0 } = {}) {
  return previewAction({
    snapshot: { foes: [{ hp: 30, dead: false, status, defense: { shield: 0, armor: 0, guard: false, ...defense } }],
      player: { atk: 4, spellPower }, pstat: { status: playerStatus } },
    action: { kind: 'play-card', uid: 'trust-test', targetIndex: 0 },
    cardContext: { card, targetIndexes: [0], legal: true, ...context },
  });
}
function bolt(extra = {}) {
  return getHostedExecutionCard({ id: 'tt7-arcanebolt', name: '奥术弹', type: '法术', dmgType: 'spell', dmg: 1, cost: 0,
    desc: '可编辑展示文本', rules: { version: 1, battle: { hosted: ['damage-and-draw'] } }, ...extra });
}
const normalHosted = { mode: 'normal', hostedExecutionVerified: true };

describe('damage preview trust boundary', () => {
  it.each([
    ['spellPowerMul', 2], ['perInfusedInHand', 2], ['infuseBonus', 3], ['perTargetPrice', true],
    ['cond', { anyCurse: true }], ['bonus', { amount: 2 }], ['range', [4, 6]],
    ['lifesteal', true], ['graveyard', { type: '法术', perCard: 1 }],
    ['recast', { on: 'kill', times: 1 }], ['schedule', 'nextTurn'], ['pick', 'new'],
    ['onKill', { coins: 2 }], ['futureDamageModifier', 9],
  ])('fails closed for unsupported damage key %s', (key, value) => {
    expect(preview(structured([damage({ [key]: value })]))).toMatchObject({ confidence: 'unknown', damage: null });
  });

  it.each([
    { target: 'randomEnemy' }, { hits: { range: [1, 2] } }, { hits: { perPlayedMoves: true } },
    { hits: { count: 2, futureHits: true } }, { hits: null }, { hitCount: 2, hits: { count: 3 } },
    { amount: undefined }, { amountField: 'cost', amount: undefined },
  ])('does not guess an unsupported source/count/target shape %#', extra => {
    expect(preview(structured([damage(extra)]))).toMatchObject({ confidence: 'unknown', damage: null });
  });

  it.each([
    damage({ cond: { anyCurse: true } }), damage({ range: [4, 6] }), damage(),
  ])('scans the complete damage list, including later conditional/random/plain operations %#', later => {
    const result = preview(structured([damage(), later]), { status: { poison: 1 } });
    expect(result).toMatchObject({ confidence: 'unknown', damage: null });
    expect(result.reasons[0]).toContain('多个');
  });

  it('does not fall back to legacy card semantics when structured onPlay suppresses damage', () => {
    expect(preview({ id: 'starter-attack', type: '武术', dmgType: 'attack', dmg: 0,
      desc: '攻(+0):造成等同于攻击力的伤害', rules: { triggers: { onPlay: [] } } })).toMatchObject({ confidence: 'unknown', damage: null });
  });

  it.each([
    { op: 'execute', what: 'fireball', count: 1 },
    { op: 'curse', curse: 'poison', stacks: 1, burst: 1 },
    { op: 'futureDamageOperation' },
  ])('does not hide an additional damage/unknown operation %#', later => {
    expect(preview(structured([damage(), later]))).toMatchObject({ confidence: 'unknown', damage: null });
  });

  it.each([
    ['plain', {}, {}, 5], ['spell power', {}, { spellPower: 2 }, 7],
    ['guard', {}, { defense: { guard: true } }, 1], ['shield', {}, { defense: { shield: 2 } }, 3],
    ['immune', {}, { status: { immune: 1 } }, 0],
  ])('retains ordinary direct damage: %s', (_label, operation, options, expected) => {
    expect(preview(structured([damage(operation)]), options)).toMatchObject({ confidence: 'exact', damage: { total: expected } });
  });

  it('keeps deterministic multi-hit damage and simple AOE target damage', () => {
    expect(preview(structured([damage({ hitCount: 2 })]))).toMatchObject({ confidence: 'exact', damage: { hits: [5, 5], total: 10 } });
    expect(preview(structured([damage({ target: 'allEnemies' })]))).toMatchObject({ confidence: 'exact', damage: { total: 5 } });
  });

  it('labels omitted follow-up effects without discarding the known direct hit', () => {
    const result = preview(structured([damage(), { op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy' }, { op: 'draw', amount: 1 }]));
    expect(result).toMatchObject({ confidence: 'exact', damage: { total: 5 } });
    expect(result.unknownEffects.join('')).toContain('后续触发未计入');
  });

  it.each(['bleedAmp', 'vsFreezeBonus', 'specialLifecycle'])('does not ignore hitFoe-only context %s', key => {
    expect(preview(structured(), { context: { modifiers: { [key]: true } } })).toMatchObject({ confidence: 'unknown', damage: null });
  });

  it('supports only the verified ordinary-battle 奥术弹 identity and direct damage', () => {
    const result = preview(bolt(), { context: normalHosted, spellPower: 2, playerStatus: { spellUp: 1 }, defense: { shield: 1 } });
    expect(result).toMatchObject({ confidence: 'exact', cost: 0, damage: { total: 3, hpAfter: 27 } });
    expect(result.unknownEffects.join('')).toMatch(/普通战抽牌.*初始攻击.*后续触发未计入.*全灭/);
    expect(preview(bolt({ dmg: 3 }), { context: normalHosted })).toMatchObject({ confidence: 'exact', damage: { total: 3 } });
  });

  it.each([
    [() => bolt({ id: 'same-name-bolt' }), normalHosted],
    [() => bolt({ rules: { version: 1, battle: { hosted: ['wrong-host'] } } }), normalHosted],
    [() => bolt({ rules: { version: 1, battle: { hosted: ['damage-and-draw', 'extra'] } } }), normalHosted],
    [() => bolt({ rules: { version: 1, battle: { hosted: ['damage-and-draw'] }, triggers: { onPlay: [damage()] } } }), normalHosted],
    [() => bolt({ dmg: 0 }), normalHosted],
    [() => bolt(), { mode: 'boss', hostedExecutionVerified: true }],
    [() => bolt(), { mode: 'normal' }],
  ])('rejects unverified/expanded hosted definitions or unsupported mode %#', (card, context) => {
    expect(preview(card(), { context })).toMatchObject({ confidence: 'unknown', damage: null });
  });

  it('repeated hosted preview never changes its input or battle RNG', () => {
    const card = bolt();
    const before = structuredClone(card);
    const rng = Random.snapshot();
    const first = preview(card, { context: normalHosted });
    for (let i = 0; i < 100; i++) expect(preview(card, { context: normalHosted })).toEqual(first);
    expect(card).toEqual(before);
    expect(Random.snapshot()).toEqual(rng);
  });
});
