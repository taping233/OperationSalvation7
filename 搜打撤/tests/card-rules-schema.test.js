import { describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/card-rules.schema.js';

describe('card rules v1 schema', () => {
  it('accepts an in-memory supported battle contract', () => {
    expect(validateCardRules({
      id: 'sample', cost: 3, dmg: 4,
      rules: {
        version: 1,
        battle: {
          target: { side: 'enemy', area: false },
          requirements: [
            { kind: 'unplayable' },
            { kind: 'deckOnly' },
            { kind: 'handCards', count: 2, type: '法术' },
          ],
          costModifiers: [
            { kind: 'previousCardTypeFree', type: '武术' },
            { kind: 'martialPlayedDiscount', amount: 1 },
            { kind: 'armorZeroFree' },
            { kind: 'consumedSpellDiscount', amount: 2 },
          ],
        },
      },
    })).toEqual({ ok: true, errors: [], pending: [] });
  });

  it('accepts base material rules only for resource cards', () => {
    for (const kind of ['wood', 'rations', 'keys']) {
      expect(validateCardRules({
        id: `material-${kind}`, type: '资源',
        rules: { version: 1, base: { material: { kind, amount: 2 } } },
      })).toEqual({ ok: true, errors: [], pending: [] });
    }
    expect(validateCardRules({ id: 'without-base', rules: { version: 1, battle: {}, triggers: { onPlay: [] } } }).ok).toBe(true);
  });

  it('reports base material fields, kinds, parameters, and card type with id and path', () => {
    const cases = [
      { card: { id: 'unknown-base', type: '资源', rules: { version: 1, base: { stash: true } } }, path: 'rules.base.stash' },
      { card: { id: 'unknown-material-field', type: '资源', rules: { version: 1, base: { material: { kind: 'wood', amount: 1, label: '木材' } } } }, path: 'rules.base.material.label' },
      { card: { id: 'unknown-material-kind', type: '资源', rules: { version: 1, base: { material: { kind: 'stone', amount: 1 } } } }, path: 'rules.base.material.kind' },
      { card: { id: 'missing-material-params', type: '资源', rules: { version: 1, base: { material: {} } } }, path: 'rules.base.material.amount' },
      { card: { id: 'wrong-material-type', type: '道具', rules: { version: 1, base: { material: { kind: 'keys', amount: 1 } } } }, path: 'rules.base.material' },
    ];
    for (const { card, path } of cases) {
      expect(validateCardRules(card).errors).toContainEqual(expect.objectContaining({ cardId: card.id, path }));
    }
  });

  it('validates the single supported bag use operation against card fields and item type', () => {
    for (const card of [
      { id: 'bag-heal', type: '道具', heal: 4, rules: { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }] } } },
      { id: 'bag-restore-three', type: '道具', rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount: 3 }] } } },
      { id: 'bag-restore-dynamic', type: '道具', rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount: 8 }] } } },
      { id: 'legacy-no-bag-rules', type: '道具' },
    ]) {
      expect(validateCardRules(card), card.id).toEqual({ ok: true, errors: [], pending: [] });
    }

    const cases = [
      [{ id: 'bag-empty', type: '道具', rules: { version: 1, bag: { use: [] } } }, 'rules.bag.use'],
      [{ id: 'bag-no-use', type: '道具', rules: { version: 1, bag: {} } }, 'rules.bag.use'],
      [{ id: 'bag-unknown-op', type: '道具', rules: { version: 1, bag: { use: [{ op: 'consume' }] } } }, 'rules.bag.use[0].op'],
      [{ id: 'bag-heal-wrong-type', type: '法术', heal: 2, rules: { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }] } } }, 'rules.bag.use'],
      [{ id: 'bag-heal-missing', type: '道具', rules: { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }] } } }, 'rules.bag.use[0].amountField'],
      [{ id: 'bag-heal-extra', type: '道具', heal: 2, rules: { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal', amount: 2 }] } } }, 'rules.bag.use[0]'],
      [{ id: 'bag-restore-fraction', type: '道具', rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount: 1.5 }] } } }, 'rules.bag.use[0].amount'],
      [{ id: 'bag-mixed', type: '道具', heal: 2, rules: { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }, { op: 'restoreConsumed', amount: 3 }] } } }, 'rules.bag.use'],
      [{ id: 'bag-unknown-domain-field', type: '道具', rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount: 3 }], trigger: 'onUse' } } }, 'rules.bag'],
    ];
    for (const [card, path] of cases) {
      expect(validateCardRules(card).errors, card.id).toContainEqual(expect.objectContaining({ cardId: card.id, path }));
    }
  });

  it('reports the card id and path for unsupported versions, kinds, parameters, and references', () => {
    const result = validateCardRules({
      id: 'bad-card',
      rules: {
        version: 2,
        battle: {
          requirements: [{ kind: 'handCards', count: 0, mystery: true }, { kind: 'custom' }],
          costModifiers: [{ kind: 'consumedSpellDiscount', amount: 0, amountField: 'cost' }],
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: 'bad-card', path: 'rules.version' }),
      expect.objectContaining({ cardId: 'bad-card', path: 'rules.battle.requirements[0]' }),
      expect.objectContaining({ cardId: 'bad-card', path: 'rules.battle.requirements[0].count' }),
      expect.objectContaining({ cardId: 'bad-card', path: 'rules.battle.requirements[1].kind' }),
      expect.objectContaining({ cardId: 'bad-card', path: 'rules.battle.costModifiers[0].amount' }),
      expect.objectContaining({ cardId: 'bad-card', path: 'rules.battle.costModifiers[0].amountField' }),
    ]));
  });

  it('accepts an empty onPlay list as an explicit no-effect declaration', () => {
    expect(validateCardRules({
      id: 'no-onplay-effect',
      rules: { version: 1, triggers: { onPlay: [] } },
    })).toEqual({ ok: true, errors: [], pending: [] });
  });

  it('validates damage operations and rejects unknown triggers, operations, and parameters', () => {
    expect(validateCardRules({
      id: 'simple-damage', type: '武术', dmg: 3, dmgType: 'fixed',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } },
    }).ok).toBe(true);

    const result = validateCardRules({
      id: 'invalid-trigger', type: '武术', dmg: 3, dmgType: 'fixed',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
        onDraw: [],
        onPlay: [
          { op: 'damage', amountField: 'heal', target: 'self', extra: true },
          { op: 'heal', amountField: 'heal', target: 'self' },
        ],
      } },
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: 'invalid-trigger', path: 'rules.triggers' }),
      expect.objectContaining({ cardId: 'invalid-trigger', path: 'rules.triggers.onPlay[0]' }),
      expect.objectContaining({ cardId: 'invalid-trigger', path: 'rules.triggers.onPlay[0].amountField' }),
      expect.objectContaining({ cardId: 'invalid-trigger', path: 'rules.triggers.onPlay[0].target' }),
      expect.objectContaining({ cardId: 'invalid-trigger', path: 'rules.triggers.onPlay[1].amountField' }),
    ]));
  });

  it('validates structured multi-hit, retargeting, and negative attack modifiers', () => {
    const make = (id, dmg, dmgType, operation) => ({
      id, type: '武术', dmg, dmgType,
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } },
        triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', ...operation }] } },
    });
    expect(validateCardRules(make('meteor', -1, 'attack', { hitCount: 2, retarget: 'livingFoes' })).ok).toBe(true);
    for (const [card, path] of [
      [make('fraction', 0, 'attack', { hitCount: 1.5 }), 'rules.triggers.onPlay[0].hitCount'],
      [make('unknown-retarget', 0, 'attack', { hitCount: 2, retarget: 'nearest' }), 'rules.triggers.onPlay[0].retarget'],
      [make('missing-hit-count', 0, 'attack', { retarget: 'livingFoes' }), 'rules.triggers.onPlay[0].retarget'],
      [make('negative-fixed', -1, 'fixed', { hitCount: 2 }), 'rules.triggers.onPlay[0].amountField'],
      [{ ...make('area-retarget', 0, 'attack', { hitCount: 2, retarget: 'livingFoes', target: 'allEnemies' }),
        rules: { version: 1, battle: { target: { side: 'enemy', area: true } },
          triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'allEnemies', hitCount: 2, retarget: 'livingFoes' }] } } },
      'rules.triggers.onPlay[0].retarget'],
    ]) {
      expect(validateCardRules(card).errors, card.id).toContainEqual(expect.objectContaining({ cardId: card.id, path }));
    }
  });

  it('accepts a single armor operation and rejects invalid or mixed onPlay operations', () => {
    expect(validateCardRules({
      id: 'structured-armor', type: '法术', armor: 4,
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'armor', amountField: 'armor' }] } },
    }).ok).toBe(true);

    const mixed = validateCardRules({
      id: 'mixed-damage-armor', type: '武术', dmg: 2, dmgType: 'fixed', armor: 3,
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
        { op: 'armor', amountField: 'armor' },
      ] } },
    });
    expect(mixed.errors).toContainEqual(expect.objectContaining({
      cardId: 'mixed-damage-armor', path: 'rules.triggers.onPlay',
    }));

    for (const card of [
      { id: 'missing-armor', type: '法术' },
      { id: 'zero-armor', type: '法术', armor: 0 },
      { id: 'string-armor', type: '法术', armor: '4' },
    ]) {
      const result = validateCardRules({
        ...card,
        rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'armor', amountField: 'armor' }] } },
      });
      expect(result.errors).toContainEqual(expect.objectContaining({
        cardId: card.id, path: 'rules.triggers.onPlay[0].amountField',
      }));
    }
  });

  it('accepts ordered heal/armor/draw operations and rejects duplicate or unsupported combinations', () => {
    const make = (id, ops, fields = {}) => validateCardRules({
      id, type: '武术', dmg: 0, ...fields,
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: ops } },
    });
    expect(make('heal-armor', [
      { op: 'heal', amountField: 'heal' }, { op: 'armor', amountField: 'armor' },
    ], { heal: 3, armor: 3 }).ok).toBe(true);
    expect(make('armor-draw', [
      { op: 'armor', amountField: 'armor' }, { op: 'draw', amountField: 'draw' },
    ], { armor: 5, draw: 1 }).ok).toBe(true);

    for (const [id, ops, fields] of [
      ['duplicate-heal', [{ op: 'heal', amountField: 'heal' }, { op: 'heal', amountField: 'heal' }], { heal: 2 }],
      ['bad-heal-ref', [{ op: 'heal', amountField: 'armor' }], { heal: 2 }],
      ['missing-draw', [{ op: 'draw', amountField: 'draw' }], {}],
      ['mixed-damage-heal', [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }, { op: 'heal', amountField: 'heal' },
      ], { dmg: 2, dmgType: 'fixed', heal: 2 }],
    ]) {
      const result = make(id, ops, fields);
      expect(result.ok, id).toBe(false);
      expect(result.errors.every(error => error.cardId === id)).toBe(true);
      expect(result.errors.every(error => typeof error.path === 'string')).toBe(true);
    }
  });

  it('rejects unsupported damage types, negative damage, and extra card effects', () => {
    for (const card of [
      { type: '武术', dmg: -1, dmgType: 'fixed' },
      { type: '武术', dmg: 2, dmgType: 'mystery' },
      { type: '道具', dmg: 2, dmgType: 'fixed' },
      { type: '法术', dmg: 2, dmgType: 'fixed', heal: 1 },
      { type: '法术', dmg: 2, dmgType: 'fixed', infuse: 1 },
      { type: '武术', dmg: 2, dmgType: 'attack', armor: 1 },
      { type: '法术', dmg: 2, dmgType: 'spell', draw: 1 },
    ]) {
      expect(validateCardRules({
        id: 'unsupported-damage-card',
        ...card,
        rules: { version: 1, battle: { target: { side: 'enemy', area: true } }, triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'allEnemies' }] } },
      }).ok).toBe(false);
    }
  });

  it('enforces cross-domain agreement between onPlay targets and battle targets', () => {
    const card = overrides => ({
      id: 'target-contract', type: '武术', dmg: 2, dmgType: 'fixed',
      rules: { version: 1, battle: { target: overrides.battleTarget }, triggers: {
        onPlay: [{ op: 'damage', amountField: 'dmg', target: overrides.operationTarget }],
      } },
    });
    expect(validateCardRules(card({ operationTarget: 'chosenEnemy', battleTarget: { side: 'enemy', area: false } })).ok).toBe(true);
    expect(validateCardRules(card({ operationTarget: 'allEnemies', battleTarget: { side: null, area: true } })).ok).toBe(true);

    for (const [operationTarget, battleTarget, expectedPath] of [
      ['chosenEnemy', { side: 'enemy', area: true }, 'rules.battle.target.area'],
      ['chosenEnemy', { side: null, area: false }, 'rules.battle.target.side'],
      ['allEnemies', { side: 'enemy', area: false }, 'rules.battle.target.area'],
      ['allEnemies', { side: 'self', area: true }, 'rules.battle.target.side'],
    ]) {
      const result = validateCardRules(card({ operationTarget, battleTarget }));
      expect(result.errors).toContainEqual(expect.objectContaining({ cardId: 'target-contract', path: expectedPath }));
    }

    const armor = validateCardRules({
      id: 'armor-target-contract', type: '法术', armor: 2,
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'armor', amountField: 'armor' }] } },
    });
    expect(armor.errors).toContainEqual(expect.objectContaining({ cardId: 'armor-target-contract', path: 'rules.battle.target.side' }));
  });

  it('rejects amountField references that the current runtime does not read', () => {
    const result = validateCardRules({
      id: 'unsupported-reference', cost: 3,
      rules: {
        version: 1,
        battle: {
          requirements: [{ kind: 'handCards', count: 1, amountField: 'cost' }],
          costModifiers: [{ kind: 'martialPlayedDiscount', amount: 1, amountField: 'cost' }],
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: 'unsupported-reference', path: 'rules.battle.requirements[0].amountField' }),
      expect.objectContaining({ cardId: 'unsupported-reference', path: 'rules.battle.costModifiers[0].amountField' }),
    ]));
  });

  it('rejects repeated kinds within requirements and cost modifiers', () => {
    const result = validateCardRules({
      id: 'duplicate-kinds',
      rules: {
        version: 1,
        battle: {
          requirements: [{ kind: 'unplayable' }, { kind: 'unplayable' }],
          costModifiers: [
            { kind: 'armorZeroFree' },
            { kind: 'armorZeroFree' },
          ],
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: 'duplicate-kinds', path: 'rules.battle.requirements[1].kind', message: 'duplicate kind is unsupported' }),
      expect.objectContaining({ cardId: 'duplicate-kinds', path: 'rules.battle.costModifiers[1].kind', message: 'duplicate kind is unsupported' }),
    ]));
  });
});
