import { describe, expect, it, vi } from 'vitest';
import { HOSTED_CARD_RULES, validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { resolveRegisterRule } from '../game/src/battle/effect-steps.m2.js';
import { getHostedExecutionCard } from '../game/src/battle/battle.hosted.js';

const hostedCards = Object.entries(HOSTED_CARD_RULES);

describe('M hosted battle contract', () => {
  it('accepts every registered hosted dispatch name through schema and capability', () => {
    for (const [id, name] of hostedCards) {
      const card = { id, rules: { version: 1, battle: { hosted: [name] } } };
      expect(validateCardRules(card), `${id}:${name}`).toMatchObject({ ok: true });
      expect(inspectCardRuleCapability(card), `${id}:${name}`).toMatchObject({ kind: 'supported', ok: true });
    }
  });

  it('rejects unknown and duplicate hosted names before battle entry', () => {
    expect(validateCardRules({ id: 'bad-hosted', rules: { version: 1, battle: { hosted: ['unknown'] } } }).ok).toBe(false);
    expect(validateCardRules({ id: 'duplicate-hosted', rules: { version: 1, battle: { hosted: ['imitate', 'imitate'] } } }).ok).toBe(false);
  });

  it('uses the immutable canonical host text for a migrated card with rewritten display text', () => {
    const hosted = getHostedExecutionCard({
      id: 'tt8-hero-priest', name: 'display name', desc: '纯展示文本',
      rules: { version: 1, battle: { hosted: ['priest'] } },
    });
    expect(hosted.desc).toContain('置入随机卡牌直至手牌达到');
    expect(hosted.desc).not.toBe('纯展示文本');
    expect(getHostedExecutionCard({
      id: 'tt8-hero-priest', desc: '纯展示文本', rules: { version: 1, battle: { hosted: ['warlock'] } },
    }).desc).toBe('纯展示文本');
  });

  it('dispatches newly registered legacy flags to their live runtime ports', () => {
    const deps = {
      esc: value => value,
      log: vi.fn(), setConsumeFireball: vi.fn(), setAllSpellsInfused: vi.fn(),
      registerGrowthCard: vi.fn(), setPoisonLegacy: vi.fn(), setPlayerCurseImmune: vi.fn(),
      setStealthStrike: vi.fn(),
    };
    const card = { name: 'contract card' };
    const expected = new Map([
      ['consumeFireball', ['setConsumeFireball', 1]],
      ['allSpellsInfused', ['setAllSpellsInfused', true]],
      ['growth', ['registerGrowthCard', card]],
      ['poisonLegacy', ['setPoisonLegacy', true]],
      ['playerCurseImmune', ['setPlayerCurseImmune', true]],
      ['stealthStrike', ['setStealthStrike', true]],
    ]);
    for (const [rule, [port, value]] of expected) {
      expect(resolveRegisterRule(card, { rule }, deps)).toBe(true);
      expect(deps[port]).toHaveBeenCalledWith(value);
    }
  });
});
