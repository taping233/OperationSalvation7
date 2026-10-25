import { describe, expect, it, vi } from 'vitest';
import { isStarterAttackIdentity, isStarterAttackTextName, isStarterAttackPoolMember,
  usesNonLethalDamage, doublesLegacyBleed, hasLegacySealUnlock, isLegacySearchChestOperation,
  legacyDeckBottomCandidateCount, hasLegacyStealthBreakBonus, hasLegacyImitateTransform,
  needsLegacyImitateSource, isLegacyProvoke } from '../game/src/cards/card-legacy-battle-policy.js';
import { createLegacyResolution } from '../game/src/battle/core/battle.legacy-resolution.domain.js';

function setup() {
  let mode = 'boss';
  const cards = [{ id: 'spell', type: '法术' }, { id: 'item', type: '道具' }];
  const ports = { combat: { addCurse: vi.fn() }, log: vi.fn(), esc: String,
    getHandSize: () => 6, randomDiscoverCard: vi.fn(), addTempCard: vi.fn(card => card.id),
    getPlayerStatus: () => ({ status: {} }), heal: vi.fn(), addFloat: vi.fn(),
    getAllCards: () => cards, isRandomObtainable: () => true, readState: () => ({ mode }),
    randomBattle: () => 0, addDelayed: vi.fn(), deckBottomCount: () => 2,
    takeDeckBottom: vi.fn(() => ['a', 'b']), findCard: uid => ({ card: { id: uid } }), queueDiscoverTracked: vi.fn() };
  return { ports, domain: createLegacyResolution(ports), setMode: next => { mode = next; } };
}

describe('legacy battle source boundaries', () => {
  it('keeps starter identity, text and acquisition-pool scopes distinct', () => {
    const renamed = { id: 'starter-attack', name: '改名' };
    const custom = { id: 'custom', name: '杀' };
    expect(isStarterAttackIdentity(renamed)).toBe(true);
    expect(isStarterAttackTextName(renamed)).toBe(false);
    expect(isStarterAttackIdentity(custom)).toBe(false);
    expect(isStarterAttackPoolMember(custom)).toBe(true);
    expect(isStarterAttackIdentity({ name: '杀' })).toBe(false);
    expect(isStarterAttackIdentity({ name: '初始攻击' })).toBe(true);
    expect(isStarterAttackPoolMember({ id: 'new-starter' }, 'new-starter')).toBe(true);
  });

  it('keeps explicit damage policy and structured onPlay ahead of the mercy identity', () => {
    expect(usesNonLethalDamage({ id: 'tt13-mercy' })).toBe(true);
    expect(usesNonLethalDamage({ id: 'tt13-mercy', rules: { triggers: { onPlay: [] } } })).toBe(false);
    expect(usesNonLethalDamage({ id: 'custom', name: '慈悲' })).toBe(false);
    expect(usesNonLethalDamage({ _cardDamagePolicy: { nonLethal: true } })).toBe(true);
    expect(doublesLegacyBleed({ id: 'custom', desc: '流血伤害翻倍' })).toBe(true);
  });

  it('requires the exact former chest operation, leaving custom edits authoritative', () => {
    const card = { id: 'cmtn28jv33wx' };
    const op = { n: 3, pool: { kind: '随机' }, dest: 'hand' };
    expect(isLegacySearchChestOperation(card, op)).toBe(true);
    for (const patch of [{ n: 2 }, { act: 'dup' }, { filter: {} }, { dest: 'discover' }]) {
      expect(isLegacySearchChestOperation(card, { ...op, ...patch })).toBe(false);
    }
    expect(isLegacySearchChestOperation({ id: 'custom' }, op)).toBe(false);
    expect(legacyDeckBottomCandidateCount({ id: 'tt3-dig-treasure' }, 1)).toBe(3);
    expect(legacyDeckBottomCandidateCount({ id: 'custom' }, 1)).toBe(1);
  });

  it('preserves distinct equipment, hosted and structured ownership gates', () => {
    expect(hasLegacySealUnlock({ id: 'tt3-element-seal' })).toBe(true);
    expect(hasLegacySealUnlock({ id: 'tt3-element-seal', rules: { equip: { passive: {} } } })).toBe(false);
    expect(hasLegacyStealthBreakBonus({ id: 'custom', rules: { battle: { hosted: ['stealth-break-bonus'] } } })).toBe(false);
    const imitate = { id: 'tt7-imitate' };
    expect(needsLegacyImitateSource(imitate, true)).toBeFalsy();
    expect(hasLegacyImitateTransform(imitate, true)).toBe(false);
    expect(isLegacyProvoke({ id: 'tt7-provoke', rules: { triggers: { onPlay: [] } } })).toBe(false);
  });

  it('does not let a complete legacy handler intercept an explicitly owned play', () => {
    const h = setup();
    const target = { hp: 10 };
    expect(h.domain.resolveOpening({ id: 'cc-rot-seed' }, target, true)).toBe(false);
    expect(h.ports.combat.addCurse).not.toHaveBeenCalled();
    expect(h.domain.resolveOpening({ id: 'cc-rot-seed' }, target, false)).toBe(true);
    expect(h.ports.combat.addCurse).toHaveBeenCalledWith(target, 'poison', 2);
    expect(target.rotSeedMarked).toBe(true);
    expect(h.domain.resolveAcquisition({ id: 'cmtn28jv33wx' }, true)).toBe(false);
    expect(h.ports.takeDeckBottom).not.toHaveBeenCalled();
  });

  it('queues real bottom UIDs and a single selection without random fallback', () => {
    const h = setup();
    expect(h.domain.resolveAcquisition({ id: 'cmtn28jv33wx' }, false)).toBe(true);
    expect(h.ports.takeDeckBottom).toHaveBeenCalledWith(2);
    expect(h.ports.queueDiscoverTracked).toHaveBeenCalledWith({ n: 1,
      explicit: [{ id: 'a' }, { id: 'b' }], explicitUids: ['a', 'b'], deckBottom: true });
    expect(h.ports.randomDiscoverCard).not.toHaveBeenCalled();
  });

  it('reads the current battle mode for emergency supplies and retains expiration scheduling', () => {
    const h = setup();
    h.domain.resolveAcquisition({ id: 'cmtn1wnhhym', name: '救急' }, false);
    expect(h.ports.addDelayed).toHaveBeenCalledWith({ special: 'consumeTemps', uids: ['spell', 'spell', 'spell'], cardName: '救急' });
    h.setMode('normal'); h.ports.randomBattle = () => 0.99;
    const next = createLegacyResolution(h.ports);
    next.resolveAcquisition({ id: 'cmtn1wnhhym', name: '救急' }, false);
    expect(h.ports.addTempCard).toHaveBeenLastCalledWith({ id: 'item', type: '道具' });
  });
});
