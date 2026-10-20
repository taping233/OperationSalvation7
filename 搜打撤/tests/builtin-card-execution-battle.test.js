import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';
import { Random } from '../game/src/core/random.js';
import { BUILTIN_PREVIOUS_RULES } from '../game/src/cards/builtin-card-previous-rules.js';
import { isBuiltinExecutableCard } from '../game/src/cards/builtin-card-identities.js';

window.SDT ||= {};
window.SDT.Icons = { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { sfx() {}, music() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 15,
  starterSha: 0, battleStartDraw: 0, battleTurnDraw: 1, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const Cards = window.SDT.Cards;
beforeAll(() => { Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields(); });
afterEach(() => { if (runtime.G?.battleActive) BattleSession.commands.flee(); });

async function outcome(card) {
  Random.reseed(1020);
  const logs = [];
  const ownedCards = [{ uid: 'source', card }, ...Array.from({ length: 5 }, (_, index) => ({ uid: `draw${index}`,
    card: { id: `fixture${index}`, name: `牌${index}`, type: '武术', cost: index + 1, dmg: 0, rules: { version: 1, triggers: { onPlay: [] } } } }))];
  const game = { ownedCards, hp: 50, maxHp: 100, atk: 3, spellPower: 0, coins: 0, myClass: null,
    state: 'idle', battleActive: false, log(message) { logs.push(message); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {} };
  BattleSession.start(game, [{ id: 'a', name: '甲', hp: 200, atk: 2 }, { id: 'b', name: '乙', hp: 200, atk: 4 }], { isBoss: false });
  runtime.set$hand(['source']); runtime.set$drawPile(ownedCards.slice(1).map(entry => entry.uid));
  runtime.set$mode('boss');
  const enemy = card.rules?.battle?.target?.side === 'enemy' || card.dmg > 0 || card.id === 'tt3-qi-wave';
  BattleSession.commands.playCard('source', enemy ? 0 : 'self');
  await vi.waitFor(() => {
    const snapshot = BattleSession.getSnapshot();
    expect(snapshot.busy).toBe(false); expect(snapshot.actionQueueLength).toBe(0);
    expect(runtime.hand.includes('source'), logs.join('\n')).toBe(false);
  });
  const result = { hp: game.hp, maxHp: game.maxHp, foes: runtime.foes.map(foe => ({ hp: foe.hp, atk: foe.atk, status: foe.status })),
    status: { ...runtime.pstat.status }, armor: runtime.pdef.armor, energy: runtime.energy, maxEnergy: runtime.maxEnergy,
    hand: [...runtime.hand], deck: [...runtime.drawPile], consumed: [...runtime.consumed],
    consumeFireballN: runtime.consumeFireballN, stealthStrike: runtime.stealthStrike,
    rng: Random.snapshot() };
  BattleSession.commands.flee();
  return result;
}

describe('native declarations execute through real battle commands', () => {
  it('repairs every native numeric input without reading edited library descriptions on reload', () => {
    Cards.ensureDmgValues();
    const original = Cards.all();
    const inputs = cards => cards.filter(isBuiltinExecutableCard).map(card => Object.fromEntries(
      ['id', 'dmg', 'dmgType', 'draw', 'infuse', 'heal', 'armor'].filter(key => Object.hasOwn(card, key)).map(key => [key, card[key]])));
    const expected = inputs(original);
    Cards.saveAll(original.map(card => isBuiltinExecutableCard(card) ? { ...card, desc: '99′。抽99张牌，回复99点生命，获得99点护甲。注能（99）：造成99点法术伤害。' } : card));
    try {
      Cards.ensureDmgTypes(); Cards.ensureEffectFields(); Cards.ensureDmgValues();
      expect(inputs(Cards.all())).toEqual(expected);
    } finally { Cards.saveAll(original); }
  });
  it('upgrades an exact old Run declaration before execution and preserves explicit custom rules', async () => {
    const { getHostedExecutionCard } = await import('../game/src/battle/effects/battle.hosted.js');
    const card = Cards.all().find(entry => entry.id === 'tt7-arcanebolt');
    const saved = { ...card, desc: '玩家编辑的卡面', rules: structuredClone(BUILTIN_PREVIOUS_RULES[card.id]) };
    expect(getHostedExecutionCard(saved)).toMatchObject({ desc: saved.desc, rules: card.rules });
    expect(saved.rules).toEqual(BUILTIN_PREVIOUS_RULES[card.id]);
    const custom = { ...saved, rules: { version: 1, triggers: { onPlay: [] } } };
    expect(getHostedExecutionCard(custom)).toBe(custom);
  });
  it('keeps the real reload pipeline from converting edited display text into native numeric inputs', async () => {
    const original = Cards.all();
    const card = structuredClone(original.find(entry => entry.id === 'starter-attack'));
    const baseline = await outcome(card);
    Cards.saveAll(original.map(entry => entry.id === card.id ? { ...card, desc: '99′。' } : entry));
    try {
      Cards.ensureDmgTypes(); Cards.ensureEffectFields(); Cards.ensureDmgValues();
      const reloaded = Cards.all().find(entry => entry.id === card.id);
      expect(reloaded.dmg).toBe(card.dmg);
      expect(await outcome(reloaded)).toEqual(baseline);
    } finally { Cards.saveAll(original); }
  });
  it.each(['tt3-qi-wave', 'tt7-marchrush', 'tt7-arcanebolt', 'tt8-hero-assassin', 'tt8-hero-descender'])(
    '%s retains the legacy state, RNG flow and display independence', async id => {
      const native = structuredClone(Cards.all().find(card => card.id === id));
      const previous = { ...native, rules: structuredClone(BUILTIN_PREVIOUS_RULES[id]) };
      const expected = await outcome(previous);
      native.desc = '抽到时获得99能量，每回合回复99血，对全体造成99伤害。';
      expect(await outcome(native)).toEqual(expected);
    });
});
