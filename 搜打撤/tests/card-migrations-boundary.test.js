import { describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');
const { CARD_MIGRATIONS } = await import('../game/src/cards/card-migrations.js');
const Cards = window.SDT.Cards;

describe('card startup migration boundary', () => {
  it('preserves synchronization, repair, face-refresh and rule-backfill dependency order', () => {
    const steps = CARD_MIGRATIONS.map(step => step.method || step.id || step.prefix || step.batch);
    const before = (first, second) => {
      expect(steps, `missing migration ${first}`).toContain(first);
      expect(steps, `missing migration ${second}`).toContain(second);
      expect(steps.indexOf(first)).toBeLessThan(steps.indexOf(second));
    };
    before('ensureCardsSyncLive', 'ensureRandomPoolFixes');
    before('ensureCardsSyncLive', 'ensureEvents0919');
    before('tt12', 'ensureTT12PreplayRules');
    before('ensureChoiceFixes', 'ensureM1OnplayRules');
    before('ensureM8RuleBackfill', 'ensureCanonicalFaceRefresh');
    before('ensureCanonicalFaceRefresh', 'ensureM9HostedRules');
    before('ensureM11HostedRules', 'ensureRotSeedRevision');
    before('tt13', 'poor-meal');
    before('poor-meal', 'ensureBuiltinExecutionRules');
  });

  it('replays the real chain idempotently while preserving custom rules and zero values', () => {
    Cards.ensureStarters();
    Cards.ensureSha();
    Cards.ensureTabletop();
    const custom = { id: 'custom-migration-boundary', name: '自定义', type: '法术', rarity: '古朴',
      cost: 0, heal: 0, desc: '玩家文本', rules: { version: 1, triggers: { onPlay: [] } } };
    expect(Cards.saveAll([...Cards.all(), custom])).toBe(true);
    Cards.ensureTabletop();
    const first = JSON.stringify(Cards.all());
    Cards.ensureTabletop();
    expect(JSON.stringify(Cards.all())).toBe(first);
    expect(Cards.all().find(card => card.id === custom.id)).toEqual(custom);
  });
});
