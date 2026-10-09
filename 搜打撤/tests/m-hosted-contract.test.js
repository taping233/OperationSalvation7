import { describe, expect, it, vi } from 'vitest';
import { HOSTED_CARD_RULES, validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { resolveRegisterRule } from '../game/src/battle/effects/effect-steps.m2.js';
import { getHostedExecutionCard } from '../game/src/battle/effects/battle.hosted.js';
import { buildFirstSourceCardIndex } from '../game/src/battle/effects/hosted-catalog-index.js';
import { RETIRED_1010 } from './helpers/card-catalog-approved-revisions.js';

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

  it('builds a first-source-wins index when catalogs repeat an ID', () => {
    const preferred = { id: 'duplicate', desc: 'first catalog' };
    const later = { id: 'duplicate', desc: 'later catalog' };
    const laterSameCatalog = { id: 'duplicate', desc: 'later row' };
    const index = buildFirstSourceCardIndex([
      [preferred], [later, laterSameCatalog], [null, {}, { id: 'other' }],
    ]);

    expect(index.get('duplicate')).toBe(preferred);
    expect(index.get('other')).toEqual({ id: 'other' });
    expect(buildFirstSourceCardIndex([[later, laterSameCatalog]]).get('duplicate')).toBe(later);
  });

  it('keeps canonical M-batch execution text for every registered hosted ID', () => {
    for (const [id, hostedName] of hostedCards) {
      if (RETIRED_1010.has(id)) continue; // 退役卡不再有现役canonical，注册表仍兼容历史规则形状。
      const savedCard = {
        id,
        desc: '玩家存档改写的文字',
        rules: { version: 1, battle: { hosted: [hostedName] } },
      };
      const executionCard = getHostedExecutionCard(savedCard);
      expect(executionCard.desc, id).toBeTypeOf('string');
      expect(executionCard.desc, id).not.toBe('玩家存档改写的文字');
      expect(savedCard.desc, id).toBe('玩家存档改写的文字');
    }
  });

  it('returns unknown IDs unchanged', () => {
    const unknown = { id: 'not-a-hosted-card', desc: '存档文字', rules: { version: 1, battle: { hosted: ['priest'] } } };
    expect(getHostedExecutionCard(unknown)).toBe(unknown);
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
