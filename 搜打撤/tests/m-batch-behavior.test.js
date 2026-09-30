import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { hand } from '../game/src/battle/runtime/battle.runtime.piles.js';
import { Random } from '../game/src/core/random.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 15,
  starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } } };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const Cards = window.SDT.Cards;
let active;
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function idle() {
  for (let i = 0; i < 500; i++) {
    const state = BattleSession.getSnapshot();
    if (!state.busy && !state.actionQueueLength) {
      await tick();
      const next = BattleSession.getSnapshot();
      if (!next.busy && !next.actionQueueLength) return next;
    }
    await tick();
  }
  throw new Error('battle action did not settle');
}
beforeAll(() => {
  for (const name of ['ensureStarters', 'ensureSha', 'ensureTabletop', 'ensureDmgTypes', 'ensureEffectFields']) Cards[name]();
});
function canonical(id) {
  const card = structuredClone(Cards.all().find(entry => entry.id === id));
  expect(card?.rules, `${id} must be migrated in actual boot`).toBeTruthy();
  card.desc = '纯展示文字：没有任何效果数字。';
  return card;
}
async function start(cards, boss = false) {
  active = { ownedCards: cards.map((card, index) => ({ uid: `mb-${index}`, card, safe: false })),
    hp: 40, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '侠客',
    characterId: null, state: 'idle', battleActive: false,
    logs: [], log(message) { this.logs.push(message); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {} };
  BattleSession.start(active, [{ id: 'mb-target', name: '验证靶', hp: 1000, maxHp: 1000, atk: 0 }],
    { isBoss: boss, name: '规则消费验收' });
  if (boss) {
    let selection = BattleSession.getSnapshot().deckSelection;
    while (selection && selection.selected.length < Math.min(selection.need, selection.cards.length)) {
      BattleSession.commands.selectDeckCard(selection.cards.find(card => !selection.selected.includes(card.uid)).uid);
      selection = BattleSession.getSnapshot().deckSelection;
    }
    BattleSession.commands.confirmDeck();
  }
  await idle();
  return active;
}
async function play(index, target = 'self') {
  BattleSession.commands.playCard(`mb-${index}`, target);
  return idle();
}
afterEach(async () => {
  if (active?.battleActive) { BattleSession.commands.flee(); await idle(); }
  active = null;
});

describe('production rules execute independently of display descriptions', () => {
  it('galaxy sets subsequent martial cost to one', async () => {
    await start([canonical('tt5-galaxy-voyage'), { ...canonical('tt3-skewer'), cost: 4 }]);
    await play(0);
    expect(engine.effCostOf(engine.findCard('mb-1').card, 'mb-1')).toBe(1);
  });

  it('imitate follows each newly played martial card', async () => {
    await start([canonical('tt7-imitate'), canonical('starter-attack'), canonical('tt3-skewer')]);
    await play(1, 0);
    expect(engine.findCard('mb-0').card.id).toBe('starter-attack');
    await play(2, 0);
    expect(engine.findCard('mb-0').card.id).toBe('tt3-skewer');
    expect(engine.findCard('mb-0').card.cost).toBe(1);
  });

  it('petal heals exactly three on each of the next three turn starts', async () => {
    await start([canonical('tt3-petal'), canonical('starter-attack')]);
    await play(0);
    const hp = active.hp;
    for (let count = 1; count <= 4; count++) {
      await engine.processDelayed();
      await idle();
      expect(active.hp).toBe(hp + Math.min(count, 3) * 3);
    }
  });

  it('priest inserts random cards up to six and heals only for the inserted spells', async () => {
    await start([canonical('tt8-hero-priest'), canonical('starter-attack')], true);
    // 获取触发器（阿猫的礼物）可能另送法术，不能把最终手牌都算作牧师直接置入。
    const spell = Cards.all().find(card => card.type === '法术' && Cards.isRandomObtainable(card)
      && card.rules && !card.rules.triggers?.onAcquire?.length);
    expect(spell).toBeTruthy();
    const pool = [canonical(spell.id), canonical('tt3-skewer')];
    const previousRandom = Random.snapshot();
    const catalog = vi.spyOn(Cards, 'all').mockReturnValue(pool);
    Random.reseed(1);
    try {
      await play(0);
      expect(hand, active.logs.join('\n')).toHaveLength(6);
      const added = hand.filter(uid => uid !== 'mb-1').map(uid => engine.findCard(uid)?.card);
      expect(added.every(Boolean)).toBe(true);
      expect(new Set(added.map(card => card.type))).toEqual(new Set(['法术', '武术']));
      expect(active.hp).toBe(40 + added.filter(card => card.type === '法术').length * 3);
    } finally {
      catalog.mockRestore();
      Random.restore(previousRandom);
    }
  });
});
