import { playerFields } from './helpers/environment-fixtures.js';
import { expect, it, vi } from 'vitest';

window.SDT = { Icons:{ img:() => '', TYPE_ART:{} }, Sound:{ music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP:{ rules:{ battleEnergy:7, battleHandMax:99, bossDeckSize:1, starterSha:0, battleStartDraw:5, battleTurnDraw:1, diceSides:6 } } };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
window.SDT.Cards.ensureSha();
window.SDT.Cards.ensureStarters();
window.SDT.Cards.ensureTabletop();
window.SDT.Cards.ensureDmgTypes();
window.SDT.Cards.ensureEffectFields();

it('控制台发卡加入普通战和首脑战的当前手牌，结束后拒绝发卡', async () => {
  const card = window.SDT.Cards.all().find(card => card.id === 'tt3-fireball');
  for (const isBoss of [false, true]) {
    const game = { ownedCards:[{ uid:'starter', card }], inventory:[], usedPocket:[], ...playerFields(50, 50, 5, 0, '降临者', null),
      log:vi.fn(), addItem() {}, onBattleEnd() {} };
    BattleSession.start(game, [{ id:'target', name:'测试靶', hp:999, maxHp:999, atk:0 }], { isBoss });
    if (isBoss) {
      BattleSession.commands.selectDeckCard('starter');
      BattleSession.commands.confirmDeck();
    }
    await vi.waitFor(() => expect(BattleSession.getSnapshot().busy).toBe(false));
    const before = BattleSession.getSnapshot().hand.length;
    expect(BattleSession.commands.dev('card', 'missing')).toBe(false);
    expect(BattleSession.commands.dev('card', card.id)).toBe(true);
    const snap = BattleSession.getSnapshot();
    expect(snap.hand).toHaveLength(before + 1);
    expect(game.ownedCards).toHaveLength(1);
    BattleSession.commands.dev('win');
    expect(BattleSession.commands.dev('card', card.id)).toBe(false);
  }
});
