import { beforeAll, describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = window.SDT.Icons.TYPE_ART || {};
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
beforeAll(() => {
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});

const cardFor = operations => ({ id: 'e6-contract', rules: { version: 1, triggers: { onPlay: operations } } });
const acquire = overrides => ({ op: 'acquire', n: 1, pool: { kind: 'moves' }, ...overrides });

describe('E6 battle-entry rule capability', () => {
  it('distinguishes legacy objects from invalid external input without requiring card-face fields', () => {
    for (const card of [{}, { id: 'old', desc: '旧文字卡' }, { rules: undefined }]) {
      expect(inspectCardRuleCapability(card)).toEqual({ kind: 'legacy', ok: true });
    }
    for (const card of [null, undefined, 0, 'card', [], true]) {
      expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'invalid', ok: false });
    }
    const invalid = cardFor([{ op: 'coins', n: 'bad' }]);
    expect(inspectCardRuleCapability(invalid)).toEqual({ kind: 'invalid', ok: false, issues: validateCardRules(invalid).errors });
    for (const card of [{ rules: null }, { rules: [] }, cardFor([null]), cardFor([{ op: 'unknown' }])]) {
      expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'invalid', ok: false });
    }
  });

  it('does not equate schema-valid acquisition combinations and ignored filters with support', () => {
    for (const operation of [acquire({ dest: 'hand', act: 'play' }), acquire({ dest: 'deck', act: 'decay' }),
      acquire({ dest: 'discover', act: 'noInfuse' }), acquire({ filter: {} })]) {
      const card = cardFor([{ op: 'coins', n: 5 }, operation]);
      expect(validateCardRules(card)).toEqual({ ok: true, errors: [], pending: [] });
      const before = JSON.stringify(card);
      expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'unsupported', ok: false,
        issues: [expect.objectContaining({ cardId: card.id, path: expect.stringContaining('onPlay[1]') })] });
      expect(JSON.stringify(card)).toBe(before);
    }
  });

  it('preserves every currently implemented acquire destination/action combination and default', () => {
    const supported = { hand: [undefined, 'dup', 'noInfuse'], deck: [undefined, 'dup', 'zeroCost', 'noInfuse'],
      discover: [undefined, 'play', 'playKeep', 'dup', 'zeroCost', 'decay'] };
    for (const [dest, acts] of Object.entries(supported)) for (const act of acts) {
      expect(inspectCardRuleCapability(cardFor([acquire({ dest, act })])), `${dest}/${act}`)
        .toEqual({ kind: 'supported', ok: true });
    }
    expect(inspectCardRuleCapability(cardFor([acquire({ act: 'play' })]))).toEqual({ kind: 'supported', ok: true });
  });

  it('reports all unsupported operations and triggers before any list is consumed', () => {
    const card = cardFor([{ op: 'coins', n: 5 }, { op: 'extraTurn' }, acquire({ filter: {} })]);
    card.rules.triggers.onDraw = [];
    const result = inspectCardRuleCapability(card);
    expect(result.kind).toBe('unsupported');
    expect(result.issues.map(issue => issue.path)).toEqual([
      'rules.triggers.onDraw', 'rules.triggers.onPlay[1].op', 'rules.triggers.onPlay[2].filter',
    ]);
  });

  it('rejects pending parameters and equipment while preserving schema diagnostics', () => {
    const cases = [
      { id: 'damage', type: '法术', dmgType: 'spell', rules: { version: 1, battle: { target: { side: 'enemy', area: false } },
        triggers: { onPlay: [{ op: 'damage', amount: 2, target: 'chosenEnemy', schedule: 'nextTurn' }] } } },
      { id: 'draw', rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'draw', untilHandN: 5 }] } } },
      { id: 'equip', type: '装备', rules: { version: 1, equip: { passive: { aura: { atk: 1 } } } } },
    ];
    for (const card of cases) {
      expect(validateCardRules(card).ok, card.id).toBe(true);
      expect(inspectCardRuleCapability(card), card.id).toMatchObject({ kind: 'unsupported', ok: false });
    }
    for (const extra of [{ graveyard: { type: '法术', perCard: 1 } }, { hits: { perFoe: true } }]) {
      const card = structuredClone(cases[0]);
      card.rules.triggers.onPlay = [{ op: 'damage', amount: 2, target: 'chosenEnemy', ...extra }];
      expect(validateCardRules(card).ok, JSON.stringify(extra)).toBe(true);
      expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'unsupported', ok: false });
    }
    const handOps = structuredClone(cases[1]);
    handOps.rules.triggers.onPlay = [{ op: 'draw', amount: 1, handOps: [{ op: 'keepInHand' }] }];
    expect(validateCardRules(handOps).ok).toBe(true);
    expect(inspectCardRuleCapability(handOps)).toMatchObject({ kind: 'unsupported', ok: false });
  });

  it('checks the actual seeded production catalogue and original synchronization source separately', () => {
    const cards = Cards.all();
    const results = cards.map(card => ({ id: card.id, result: inspectCardRuleCapability(card) }));
    expect(results.filter(entry => !entry.result.ok)).toEqual([]);
    expect({ total: cards.length, structured: results.filter(entry => entry.result.kind === 'supported').length,
      legacy: results.filter(entry => entry.result.kind === 'legacy').length }).toEqual({ total: 272, structured: 68, legacy: 204 });
    expect(Cards.CARDS_SYNC).toHaveLength(55);
    expect(Cards.CARDS_SYNC.every(card => inspectCardRuleCapability(card).kind === 'legacy')).toBe(true);
    const count = values => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(entry => entry === value).length]));
    console.info('E6 production catalogue support census', JSON.stringify({
      domains: count(cards.flatMap(card => Object.keys(card.rules || {}).filter(key => key !== 'version'))),
      operations: count(cards.flatMap(card => (card.rules?.triggers?.onPlay || []).map(operation => operation.op))),
    }));
  });
});
