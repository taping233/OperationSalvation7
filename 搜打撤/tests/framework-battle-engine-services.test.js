import { afterEach, describe, expect, it, vi } from 'vitest';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { sfx() {}, music() {}, setDucked() {}, setBoss() {} };
await import('../game/src/cards/cards.js');
const Engine = await import('../game/src/battle/core/battle.engine.js');
const { createBattleEngine } = await import('../game/src/battle/core/battle.engine.factory.js');

function ports(label) {
  const catalog = [{ id: label, name: label, type: '法术', cost: 0, draw: 2 }];
  return {
    cards: { all: vi.fn(() => catalog), deriveDraw: () => 0, deriveInfuse: () => 0,
      isRandomObtainable: () => true, sellPrice: () => 1, randomClassCard: () => catalog[0],
      TABLETOP10: [], SHA: catalog[0], DMG_TYPES: ['武术', '法术'], DMG_TYPE_META: {} },
    readRules: () => ({ label, bossDeckSize: 15 }), sound: vi.fn(), evaluateRunes: () => ({}),
  };
}

afterEach(() => {
  runtime.set$G(null);
  runtime.set$shaTransform(null);
});

describe('battle engine explicit composition', () => {
  it('fails explicitly before configuration and rejects incomplete service sets', () => {
    expect(() => Engine.R()).toThrow('has not been configured');
    expect(() => Engine.configureBattleEngine({})).toThrow('requires cards');
    expect(() => Engine.R()).toThrow('has not been configured');
  });

  it('uses replacement service ports through real factories without consulting browser facades', () => {
    const first = ports('first');
    const second = ports('second');
    const engine = createBattleEngine(first);
    const isolated = engine.runtime;
    const facade = window.SDT;
    const originalCards = facade.Cards;
    const originalSound = facade.Sound;
    Object.defineProperty(facade, 'Cards', { configurable: true, get() { throw new Error('browser cards accessed'); } });
    Object.defineProperty(facade, 'Sound', { configurable: true, get() { throw new Error('browser sound accessed'); } });
    try {
      isolated.set$G({ ownedCards: [{ uid: 'card', card: { name: '初始攻击' } }],
        hp: 20, maxHp: 20, log: vi.fn(), battleActive: false });
      isolated.set$shaTransform('first');
      isolated.set$pstat({ status: {} });
      isolated.set$pdef({ armor: 0, shield: 0, guard: false });
      expect(engine.R().label).toBe('first');
      expect(engine.findEffectiveCard('card').card).toMatchObject(first.cards.all()[0]);
      engine.playerTakeHit({ name: 'port foe', atk: 1 });
      expect(first.sound).toHaveBeenCalledWith('hurt');
      expect(isolated.G.hp).toBe(19);
      expect(runtime.G).toBeNull();
      Engine.configureBattleEngine(first);
      runtime.set$G(isolated.G);
      runtime.set$shaTransform('first');
      const capturedQuery = Engine.findEffectiveCard;
      expect(Engine.R().label).toBe('first');
      Engine.configureBattleEngine(second);
      runtime.set$shaTransform('second');
      expect(Engine.R().label).toBe('second');
      expect(Engine.findEffectiveCard('card').card.id).toBe('second');
      expect(capturedQuery('card').card.id).toBe('second');
      expect(typeof Engine.resolveCard.steps).toBe('function');
    } finally {
      Object.defineProperty(facade, 'Cards', { configurable: true, writable: true, value: originalCards });
      Object.defineProperty(facade, 'Sound', { configurable: true, writable: true, value: originalSound });
    }
  });

  it('retains the configured engine when invalid or active replacements are refused', () => {
    Engine.configureBattleEngine(ports('retained'));
    expect(() => Engine.configureBattleEngine({})).toThrow('requires cards');
    expect(Engine.R().label).toBe('retained');
    runtime.set$G({ battleActive: true });
    expect(() => Engine.configureBattleEngine(ports('rejected'))).toThrow('active battle');
    expect(Engine.R().label).toBe('retained');
  });
});
