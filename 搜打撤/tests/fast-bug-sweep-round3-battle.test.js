import { afterEach, describe, expect, it } from 'vitest';
import { createBattleGameFactory, drainBattle } from './helpers/battle-fixtures.js';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 30, bossDeckSize: 2, starterSha: 0,
    battleStartDraw: 2, battleTurnDraw: 1, diceSides: 6 }, items: {} } };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { finish: engineFinish } = await import('../game/src/battle/core/battle.engine.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const makeGame = createBattleGameFactory();
const enemy = { id: 'round3-target', name: '三轮回归靶子', hp: 999, atk: 1 };
afterEach(() => { if (runtime.G?.battleActive) BattleSession.commands.flee(); });

describe('battle round three item command boundaries', () => {
  it.each(['useItem', 'usePotion'])('ignores a stale %s command after battle has finished', async command => {
    const medicine = { id: 'legacy-sweep-heal', name: '旧版治疗药', type: '道具', cost: 0, desc: '回复 5 点生命。' };
    const game = makeGame([medicine]);
    game.hp = 50;
    BattleSession.start(game, [enemy], { isBoss: false });
    const uid = game.ownedCards[0].uid;
    BattleSession.commands.flee();
    expect(game.battleActive).toBe(false);
    BattleSession.commands[command](uid, null);
    await drainBattle(BattleSession);
    expect(game.ownedCards.map(entry => entry.uid)).toContain(uid);
    expect(game.hp).toBe(50);
    expect(runtime.played).toEqual([]);
  });

  it('ignores a stale real structured potion command after victory without an illegal phase transition', async () => {
    const medicine = Cards.all().find(card => card.id === 'tt-jinchuangyao');
    const game = makeGame([medicine]);
    game.hp = 50;
    BattleSession.start(game, [enemy], { isBoss: false });
    const uid = game.ownedCards[0].uid;
    runtime.foes[0].hp = 0;
    engineFinish(true);
    expect(() => BattleSession.commands.usePotion(uid)).not.toThrow();
    await drainBattle(BattleSession);
    expect(game.ownedCards.map(entry => entry.uid)).toContain(uid);
    expect(game.hp).toBe(50);
  });
});
