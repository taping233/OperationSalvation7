import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { KEY } from '../game/src/cards/cards.consts.js';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { ...window.SDT.Icons, img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const Cards = window.SDT.Cards;
let activeGame;

const damage = () => ({ op: 'damage', amount: 2, target: 'allEnemies', hits: { perFoe: true } });
const cardAt = point => ({
  id: `fixture-per-foe-${point}`, name: 'fixture rule', type: '法术', cost: 2, dmgType: 'fixed',
  rules: { version: 1, triggers: { [point]: [damage()] } },
});
const equipmentAt = point => ({
  id: `fixture-per-foe-equip-${point}`, name: 'fixture equipment', type: '装备', cost: 0,
  rules: { version: 1, equip: { [point]: point === 'skill'
    ? { oncePerBattle: true, ops: [damage()] } : [damage()] } },
});

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function settle() {
  for (let index = 0; index < 500; index++) {
    const snapshot = BattleSession.getSnapshot();
    if (!snapshot.busy && snapshot.actionQueueLength === 0) {
      await tick();
      const next = BattleSession.getSnapshot();
      if (!next.busy && next.actionQueueLength === 0) return;
    }
    await tick();
  }
  throw new Error('fixture battle did not settle');
}
function resources() {
  return {
    hand: [...runtime.hand], played: [...runtime.played], consumed: [...runtime.consumed],
    grave: [...runtime.grave], energy: runtime.energy,
    equipped: runtime.equipped.map(entry => ({ uid: entry.uid, used: entry.used })),
    foeHp: runtime.foes.map(foe => foe.hp),
  };
}

describe('unsupported hits.perFoe is rejected across every executable card array', () => {
  beforeEach(() => { localStorage.clear(); Cards.clearAll(); });
  afterEach(async () => {
    if (activeGame?.battleActive) { BattleSession.commands.flee(); await settle(); }
    activeGame = null;
  });

  for (const point of ['onTurnStart', 'onTurnEnd', 'onBattleStart', 'onConsume', 'onDraw',
    'onKill', 'onDamaged', 'onPlayCard', 'onAcquire', 'onFreezeDealt']) {
    it(`${point} is schema-valid but rejected before entry as unsupported`, () => {
      const card = cardAt(point);
      expect(validateCardRules(card).ok).toBe(true);
      expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'unsupported', ok: false,
        issues: [expect.objectContaining({ path: `rules.triggers.${point}[0].hits.perFoe` })] });
    });
  }
  for (const point of ['onEquip', 'battleStart', 'skill']) {
    it(`equip.${point} is schema-valid but rejected before entry as unsupported`, () => {
      const card = equipmentAt(point);
      expect(validateCardRules(card).ok).toBe(true);
      expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'unsupported', ok: false,
        issues: [expect.objectContaining({ path: `rules.equip.${point}${point === 'skill' ? '.ops' : ''}[0].hits.perFoe` })] });
    });
  }

  for (const fixture of [cardAt('onTurnStart'), equipmentAt('skill')]) {
    it(`${fixture.type}: real persisted custom card is rejected without payment, registration or skill-use state`, async () => {
      expect(Cards.saveAll([fixture])).toBe(true);
      expect(JSON.parse(localStorage.getItem(KEY))).toEqual([fixture]);
      const card = Cards.all()[0];
      activeGame = {
        ownedCards: [{ uid: 'fixture-source', card, safe: false }],
        hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0,
        myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
        logs: [], log(message, level) { this.logs.push({ message, level }); },
        heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
        addItem() {}, onBattleEnd() {},
      };
      BattleSession.start(activeGame, [{ id: 'fixture-foe', name: 'fixture target', hp: 1000, atk: 0 }], { isBoss: false });
      await settle();
      const before = resources();
      expect(BattleSession.commands.playCard('fixture-source', fixture.type === '装备' ? 'self' : undefined)).toBe(false);
      await settle();
      expect(resources()).toEqual(before);
      expect(runtime.equipped).toEqual([]);
      expect(activeGame.logs.some(entry => entry.level === 'warn' && entry.message.includes('perFoe'))).toBe(true);
    });
  }
});
