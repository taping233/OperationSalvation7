import { afterEach, describe, expect, it } from 'vitest';
import { createBattleGameFactory, drainBattle } from './helpers/battle-fixtures.js';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 30, bossDeckSize: 3, starterSha: 0,
    battleStartDraw: 3, battleTurnDraw: 1, diceSides: 6 }, items: {} } };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const makeGame = createBattleGameFactory();
const filler = () => Cards.all().find(card => card.id === 'tt3-frostfall');
const enemy = { id: 'sweep-target', name: '回归靶子', hp: 999, atk: 1 };
async function waitForSelection() {
  for (let i = 0; i < 200 && !runtime.handSelecting; i++) await new Promise(resolve => setTimeout(resolve, 5));
}

afterEach(() => { if (runtime.G?.battleActive) BattleSession.commands.flee(); });

describe('real engine deck and selection regressions', () => {
  it('real chaos-eye selection changes the live capacity and blocks overflow after removal', async () => {
    const eye = Cards.all().find(card => card.id === 'tt3-chaos-eye');
    const game = makeGame([...Array.from({ length: 7 }, filler), eye]);
    BattleSession.start(game, [enemy], { isBoss: true });
    for (const entry of game.ownedCards.slice(0, 3)) BattleSession.commands.selectDeckCard(entry.uid);
    BattleSession.commands.selectDeckCard(game.ownedCards[7].uid);
    expect(BattleSession.getSnapshot().deckSelection.max).toBe(8);
    for (const entry of game.ownedCards.slice(3, 7)) BattleSession.commands.selectDeckCard(entry.uid);
    expect(runtime.sel.size).toBe(8);
    BattleSession.commands.selectDeckCard(game.ownedCards[7].uid);
    expect(BattleSession.getSnapshot().deckSelection.max).toBe(3);
    BattleSession.commands.confirmDeck();
    expect(runtime.selectingDeck).toBe(true);
    for (const entry of game.ownedCards.slice(3, 7)) BattleSession.commands.selectDeckCard(entry.uid);
    BattleSession.commands.confirmDeck();
    await drainBattle(BattleSession);
    expect(runtime.selectingDeck).toBe(false);
  });

  it('ignores a stale confirm-deck command after combat starts', async () => {
    const game = makeGame([filler(), filler(), filler()]);
    BattleSession.start(game, [enemy], { isBoss: true });
    for (const entry of game.ownedCards) BattleSession.commands.selectDeckCard(entry.uid);
    BattleSession.commands.confirmDeck();
    await drainBattle(BattleSession);
    runtime.set$energy(1);
    runtime.set$turn(4);
    const hand = [...runtime.hand];
    BattleSession.commands.confirmDeck();
    expect(runtime.energy).toBe(1);
    expect(runtime.turn).toBe(4);
    expect(runtime.hand).toEqual(hand);
  });

  it('real text effect releases both requested hand cards instead of stopping after one', async () => {
    const select = { id: 'sweep-two', name: '双牌释放回归', type: '法术', cost: 0, desc: '选择手牌中 2 张武术施放。', dmg: 0 };
    const attack = { id: 'sweep-strike', name: '回归攻击', type: '武术', cost: 1, desc: '造成 1 点攻击伤害。', dmg: 1, dmgType: 'attack' };
    const game = makeGame([select, attack, attack]);
    BattleSession.start(game, [enemy], { isBoss: false });
    BattleSession.commands.playCard(game.ownedCards[0].uid);
    await waitForSelection();
    expect(runtime.handSelecting).toMatchObject({ n: 2, act: 'play' });
    BattleSession.commands.pickHandSelect(game.ownedCards[1].uid);
    await waitForSelection();
    expect(runtime.handSelecting).toMatchObject({ n: 1, act: 'play' });
    BattleSession.commands.pickHandSelect(game.ownedCards[2].uid);
    await drainBattle(BattleSession);
    expect(runtime.handSelecting).toBeNull();
    expect(runtime.played).toEqual(game.ownedCards.map(entry => entry.uid));
    expect(runtime.energy).toBe(9);
    expect(runtime.foes[0].hp).toBe(987);
  });
});
