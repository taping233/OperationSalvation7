import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 3, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
let { Cards, KEY } = await import('../game/src/cards/cards.js');
const ids = ['constructor', 'toString', '__proto__'];
const bootCatalog = () => {
  Cards.ensureStarters(); Cards.ensureSha(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
};
const customCard = id => ({ id, name: '自定义卡', type: '法术', rarity: '古朴', cost: 1, dmg: 2, dmgType: 'fixed', desc: '造成 2 点伤害。' });

beforeEach(async () => {
  localStorage.clear(); Cards.clearAll(); vi.resetModules();
  ({ Cards } = await import('../game/src/cards/cards.js'));
});
afterEach(() => { vi.useRealTimers(); });
describe('saved custom IDs through the public startup catalog API (code simulation)', () => {
  it('boots the clean supported source catalog', () => {
    bootCatalog();
    expect(Cards.all().length).toBeGreaterThan(100);
  });
  it.each(ids)('preserves an existing saved custom card named %s on the next startup', async id => {
    // Public storage API, not a direct migration-helper invocation. This reproduces
    // an already existing custom library; the current UI import switch stays off.
    bootCatalog();
    const card = customCard(id);
    Cards.upsert(card);
    expect(JSON.parse(localStorage.getItem(KEY)).find(item => item.id === id)).toEqual(card);
    vi.resetModules();
    ({ Cards } = await import('../game/src/cards/cards.js'));
    expect(Cards.all().find(item => item.id === id)).toEqual(card);
    bootCatalog();
    expect(Cards.all().find(item => item.id === id)).toEqual(card);
  });
});


describe('public play after cold startup with an existing custom card (code simulation)', () => {
  const cases = ['plain-custom-id', ...ids].flatMap(id => ['legacy', 'explicit'].map(kind => [id, kind]));
  it.each(cases)('preserves %s / %s ownership, inputs, cost and intended effect', async (id, kind) => {
    bootCatalog();
    const input = customCard(id);
    if (kind === 'explicit') {
      input.cost = 2; input.dmg = 3; input.desc = '玩家自定义描述。';
      input.rules = { version: 1, battle: { target: { side: 'enemy', area: false } },
        triggers: { onPlay: [{ op: 'damage', amount: 3, target: 'chosenEnemy' }] } };
    }
    const original = structuredClone(input);
    Cards.upsert(input);
    vi.resetModules();
    ({ Cards } = await import('../game/src/cards/cards.js'));
    bootCatalog();
    const card = Cards.all().find(entry => entry.id === id);
    expect(card).toEqual(original);
    const savedBeforePlay = localStorage.getItem(KEY);
    const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
    const { getHostedExecutionCard } = await import('../game/src/battle/effects/battle.hosted.js');
    const { ownsBuiltinExecutionDomain } = await import('../game/src/cards/builtin-card-execution.js');
    const { nativeNumericField, nativeDamageType } = await import('../game/src/cards/builtin-card-numeric-fields.js');
    const { triggerExecutionPlan, equipmentExecutionPlan } = await import('../game/src/cards/card-execution-plan.js');
    const { validateCardRules } = await import('../game/src/cards/card-rules.schema.js');
    expect(validateCardRules(card).ok).toBe(true);
    expect(getHostedExecutionCard(card)).toBe(card);
    expect(ownsBuiltinExecutionDomain(card)).toBe(false);
    expect(nativeNumericField(card, 'dmg')).toBeUndefined();
    expect(nativeDamageType(card)).toBeUndefined();
    expect(triggerExecutionPlan(card, 'onPlay').kind).toBe(kind === 'explicit' ? 'structured' : 'text');
    expect(equipmentExecutionPlan(card, 'battleStart').kind).toBe('text');
    const invalidHosted = { ...card, rules: { version: 1, battle: { hosted: [id] } } };
    expect(validateCardRules(invalidHosted).ok).toBe(false);
    expect(getHostedExecutionCard(invalidHosted)).toBe(invalidHosted);
    vi.useFakeTimers();
    const game = {
      ownedCards: [{ uid: 'custom-1', card, safe: false }], inventory: [], usedPocket: [], cardOrder: ['custom-1'],
      hp: 35, maxHp: 35, atk: 5, spellPower: 0, coins: 0, myClass: '法师', characterId: null, state: 'idle', battleActive: false,
      log() {}, heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }, onBattleEnd() {},
    };
    const foe = { id: 'audit-foe', name: '靶子', hp: 100, atk: 1, behavior: 'strike' };
    try {
      BattleSession.start(game, [foe], { isBoss: false, name: 'custom ID audit' });
      const before = BattleSession.getSnapshot();
      expect(before.hand).toContain('custom-1');
      BattleSession.commands.playCard('custom-1', 0);
      await vi.advanceTimersByTimeAsync(1000);
      const after = BattleSession.getSnapshot();
      expect(after.busy).toBe(false);
      expect(after.energy).toBe(before.energy - original.cost);
      expect(after.foes[0].hp).toBe(before.foes[0].hp - (kind === 'explicit' ? 3 : 2));
      expect(after.hand).not.toContain('custom-1');
      expect(game.ownedCards[0].card).toEqual(original);
      expect(Cards.all().find(entry => entry.id === id)).toEqual(original);
      expect(localStorage.getItem(KEY)).toBe(savedBeforePlay);
    } finally {
      if (game.battleActive) BattleSession.commands.flee();
      vi.clearAllTimers();
    }
  });
});
