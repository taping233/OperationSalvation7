import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createCardPlayDomain } from '../game/src/battle/core/battle.card-play.domain.js';
import { createInspectionDomain } from '../game/src/battle/effects/battle.card-inspection.domain.js';

const simple = (extra = {}) => ({ id: 'context-test', name: '普通招式', type: '武术', cost: 1, desc: '',
  rules: { version: 1, battle: { requirements: [] }, triggers: { onPlay: [] } }, ...extra });
const payment = (count = 2, type = '初始攻击') => simple({ id: 'context-payment', rules: {
  version: 1, battle: { requirements: [{ kind: 'handCards', count, ...(type ? { type } : {}) }] }, triggers: { onPlay: [] },
} });
const starter = () => simple({ id: 'context-starter', name: '初始攻击' });
function setup(cards, catalog = {}) {
  const state = {
    G: { battleActive: true, log() {} }, battleState: { token: 1, phase: 'player' },
    hand: cards.map((_, i) => `u${i}`), mode: 'boss', equipped: [], foes: [{ id: 'f0' }, { id: 'f1' }],
    energy: 9, freeCast: new Set(), game: { ownedCards: cards.map((card, i) => ({ uid: `u${i}`, card })) },
    cardOverrides: new Map(), granted: [], shaTransform: null,
  };
  const inspection = createInspectionDomain({}).createBattleCardInspection({ cards: catalog, readState: () => state });
  const findCard = vi.fn(inspection.findCard);
  const domain = createCardPlayDomain({}).createBattleCardPlay({
    readState: () => state, findCard, findEffectiveCard: inspection.findEffectiveCard,
    alive: () => state.foes.filter(foe => !foe.dead), equipCap: () => 2,
    hasPendingEndTurn: () => false, effCostOf: () => 1, infuseOf: () => 0,
    damageTypes: () => ['武术', '法术'], interactionOf: () => null,
    requestedTargetReason: () => null, executeTargetReason: () => null, executionAvailability: () => null,
  });
  return { state, inspection, findCard, domain };
}

describe('single-render raw-hand eligibility context', () => {
  it('18 status/group checks resolve a 9-card hand once instead of 18 times', () => {
    const cards = Array.from({ length: 9 }, (_, i) => simple({ id: `context-${i}` }));
    const { domain, findCard } = setup(cards);
    const check = context => Array.from({ length: 2 }, () => cards.map(card => domain.handUnplayableReason(card, context))).flat();
    const live = check();
    expect(findCard).toHaveBeenCalledTimes(162);
    findCard.mockClear();
    const context = {};
    expect(check(context)).toEqual(live);
    expect(findCard).toHaveBeenCalledTimes(9);
    expect(context.handCards.map(entry => entry.card)).toEqual(cards);
    findCard.mockClear();
    check({});
    expect(findCard).toHaveBeenCalledTimes(9);
  });

  it.each([
    ['ordinary', simple()], ['resource', simple({ type: '资源' })], ['event', simple({ type: '事件' })],
    ['creature', simple({ type: '生物' })], ['boss item', simple({ type: '道具' })],
    ['structured seal', simple({ rules: { battle: { requirements: [{ kind: 'unplayable' }] } } })],
    ['text seal', simple({ rules: undefined, desc: '无法打出' })],
    ['imitate', simple({ id: 'tt7-imitate', rules: undefined })],
    ['missing transform', simple({ _battleTransformMissing: '不存在' })],
    ['structured payment', payment()], ['wildcard payment', payment(2, null)],
    ['text payment', simple({ rules: undefined, desc: '消耗 2 张初始攻击，造成 3 点伤害' })],
    ['structured requirements suppress text', simple({ desc: '消耗 99 张初始攻击' })],
  ])('%s retains live-query reason and identity semantics', (_name, card) => {
    for (const mode of ['normal', 'boss']) for (const count of [0, 1, 2, 3]) {
      const { domain, state } = setup([card, ...Array.from({ length: count }, starter)]);
      state.mode = mode;
      const context = {};
      expect(domain.handUnplayableReason(card, context)).toBe(domain.handUnplayableReason(card));
      expect(domain.handUnplayableReason(card, context)).toBe(domain.handUnplayableReason(card));
    }
  });

  it('excludes all occurrences of the raw self object and ignores missing UIDs', () => {
    const self = payment(2, null);
    const { domain, state } = setup([self, self, starter()]);
    state.hand.push('missing');
    const context = {};
    expect(domain.unplayableReason(self, context)).toContain('现有 1 张');
    expect(context.handCards).toHaveLength(3);
    expect(domain.unplayableReason(self, context)).toBe(domain.unplayableReason(self));
  });

  it('preserves raw override/self identity and transformed-face payment semantics', () => {
    const template = payment(2, null);
    const { domain, inspection, state } = setup([starter(), starter()], { all: () => [{ ...template, name: '变形招式' }] });
    state.shaTransform = '变形招式';
    const effective = inspection.findEffectiveCard('u0').card;
    const context = {};
    expect(effective).not.toBe(state.game.ownedCards[0].card);
    expect(domain.unplayableReason(effective, context)).toBeNull();
    expect(domain.unplayableReason(effective, context)).toBe(domain.unplayableReason(effective));
    expect(context.handCards[0].card).toBe(state.game.ownedCards[0].card);
    state.cardOverrides.set('u0', template);
    const next = {};
    expect(domain.unplayableReason(template, next)).toContain('现有 1 张');
    expect(next.handCards[0].card).toBe(template);
  });

  it('new renders, context-free previews, and final availability see in-place hand changes', () => {
    const self = payment(2);
    const { domain, state } = setup([self, starter(), starter()]);
    expect(domain.unplayableReason(self, {})).toBeNull();
    expect(domain.getCardPlayAvailability('u0', undefined, true).status).toBe('ready');
    state.hand.splice(2, 1);
    expect(domain.unplayableReason(self, {})).toContain('现有 1 张');
    expect(domain.unplayableReason(self)).toContain('现有 1 张');
    const result = domain.getCardPlayAvailability('u0', undefined, true);
    expect(result.reason.code).toBe('CARD_UNPLAYABLE');
    expect(result.reason.message).toContain('现有 1 张');
    state.hand.push('u2');
    state.cardOverrides.set('u2', simple({ type: '法术' }));
    expect(domain.unplayableReason(self, {})).toContain('现有 1 张');
    state.cardOverrides.delete('u2');
    expect(domain.unplayableReason(self, {})).toBeNull();
  });

  it('checks changing requirements, mode, equipment cap, and foes rather than caching final reasons', () => {
    const self = payment(1);
    const { domain, state } = setup([self, starter()]);
    const context = {};
    expect(domain.unplayableReason(self, context)).toBeNull();
    self.rules.battle.requirements[0].count = 2;
    expect(domain.unplayableReason(self, context)).toContain('需要 2 张');
    const equipment = simple({ type: '装备' });
    expect(domain.handUnplayableReason(equipment, context)).toBeNull();
    state.equipped.push({}, {});
    expect(domain.handUnplayableReason(equipment, context)).toContain('最多同时装配 2 件');
    const ability = simple({ type: '能力卡' });
    expect(domain.unplayableReason(ability, context)).toBeNull();
    state.mode = 'normal';
    expect(domain.unplayableReason(ability, context)).toContain('能力卡');
    const fight = simple({ rules: { triggers: { onPlay: [{ op: 'foeFight', pick: 'two' }] } } });
    expect(domain.unplayableReason(fight, context)).toBeNull();
    state.foes[1].dead = true;
    expect(domain.unplayableReason(fight, context)).toContain('不足两名');
  });

  it.each(['tt7-thundergrudge', 'tt7-meteorrain'])('first materialization still repairs legacy %s', id => {
    const canonical = simple({ id, dmg: 7, dmgType: 'fixed' });
    const legacy = simple({ id, dmg: 99, rules: { battle: { requirements: [{ kind: 'unplayable' }] } } });
    const { domain } = setup([legacy], { TABLETOP10: [canonical] });
    const context = {};
    expect(domain.unplayableReason(legacy, context)).toBeNull();
    expect(legacy.dmg).toBe(7);
    expect(legacy.dmgType).toBe('fixed');
    expect(legacy.rules).toEqual(canonical.rules);
    expect(context.handCards[0].card).toBe(legacy);
  });

  it('wires a new context only into synchronous status and hand rendering', () => {
    const view = readFileSync('game/src/battle/view/battle.view.js', 'utf8');
    const layers = readFileSync('game/src/battle/view/battle.layers.js', 'utf8');
    expect(view.slice(view.indexOf('function render('))).toContain('const handRuleContext = {};');
    expect(view).toContain('combatStateCopy(snapshot, cards, handRuleContext)');
    expect(view).toContain('{ spellBonus, mode, discoverSrcRect, handRuleContext, liveInteractionSnapshot }');
    expect(layers).toContain('unplayableReason(g.card, ctx.handRuleContext)');
    expect(layers).toContain('handRuleContext: extra && extra.handRuleContext');
    expect(view.match(/handRuleContext/g)).toHaveLength(5);
    expect(layers.match(/handRuleContext/g)).toHaveLength(3);
  });
});
