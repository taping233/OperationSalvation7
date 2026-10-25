import { afterEach, describe, expect, it } from 'vitest';
import { createBattleGameFactory, drainBattle } from './helpers/battle-fixtures.js';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 30, bossDeckSize: 2, starterSha: 0,
    battleStartDraw: 10, battleTurnDraw: 1, diceSides: 6 }, items: {} } };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const { validateCardRules } = await import('../game/src/cards/card-rules.schema.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const makeGame = createBattleGameFactory();
const enemy = { id: 'round2-target', name: '二轮回归靶子', hp: 999, atk: 1 };
afterEach(() => { if (runtime.G?.battleActive) BattleSession.commands.flee(); });

describe('battle round two: scheduled bag and seal collection', () => {
  it('scheduled bag healing runs on exactly the declared three following turns', async () => {
    const medicine = { id: 'sweep-repeat-med', name: '三回合合剂', cost: 0, type: '道具', heal: 6, desc: '',
      rules: { version: 1, bag: { use: [{ op: 'heal', amount: 6, schedule: 'nextTurnStart', duration: 3 }] } } };
    expect(validateCardRules(medicine).ok).toBe(true);
    const game = makeGame([medicine]);
    game.hp = 50;
    BattleSession.start(game, [enemy], { isBoss: false });
    BattleSession.commands.useItem(game.ownedCards[0].uid, null);
    await drainBattle(BattleSession);
    expect(game.hp).toBe(50);
    for (let i = 1; i <= 4; i++) {
      BattleSession.commands.endTurn();
      await drainBattle(BattleSession);
      expect(game.hp).toBe(50 - i + Math.min(i, 3) * 6);
    }
    expect(runtime.delayed).toEqual([]);
  });

  it('seal transformation consumes five required cards while preserving a duplicated seal set', async () => {
    const sealer = Cards.all().find(card => card.id === 'tt8-hero-sealer');
    const game = makeGame([sealer, sealer]);
    const extraUid = game.ownedCards[1].uid;
    BattleSession.start(game, [enemy], { isBoss: true });
    game.ownedCards.forEach(entry => BattleSession.commands.selectDeckCard(entry.uid));
    BattleSession.commands.confirmDeck();
    await drainBattle(BattleSession);
    expect(runtime.consumed).toHaveLength(5);
    expect(runtime.hand.map(uid => engine.findCard(uid)?.card?.id)).toContain('tt8-abyss-sovereign');
    const extraCopies = runtime.hand.filter(uid => engine.findCard(uid)?.card?.id === sealer.id);
    expect(extraCopies).toHaveLength(1);
    expect([...runtime.consumed, ...extraCopies]).toContain(extraUid);
  });
});
