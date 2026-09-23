import { describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 2, battleHandMax: 8, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/battle.core.js');

const starter = window.SDT.Cards.all().find(card => card.id === 'starter-attack') || {
  id: 'starter-attack', name: '初始攻击', cost: 1, type: '武术', desc: '造成攻击伤害。', dmg: 0, dmgType: 'attack',
};

function makeGame() {
  return {
    ownedCards: [{ uid: 'starter-1', card: { ...starter }, safe: false }],
    inventory: [{ id: 'ration', count: 1 }], cardOrder: ['starter-1'], usedPocket: [], eventLog: [],
    hp: 30, maxHp: 30, atk: 5, spellPower: 0, coins: 8, turn: 1,
    myClass: '战士', characterId: 'heixiang', state: 'idle', battleActive: false,
    log(message) { this.eventLog.push(String(message)); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    onBattleEnd() {},
  };
}

describe('战斗读档从入场检查点重开', () => {
  it('restores run state and rebuilds turn one instead of resuming a partial battle', () => {
    const game = makeGame();
    BattleSession.start(game, [{ id: 'infantry', name: '检查点靶子', hp: 12, atk: 4, behavior: 'strike' }], { isBoss: false, name: '检查点测试' });
    const checkpoint = BattleSession.serialize();
    expect(checkpoint).toMatchObject({ restartVersion: 1, selectedDeck: null });

    game.hp = 7;
    game.coins = 999;
    game.ownedCards[0].safe = true;
    expect(BattleSession.restore(game, checkpoint)).toBe(true);

    const state = BattleSession.getSnapshot();
    expect(game.hp).toBe(30);
    expect(game.coins).toBe(8);
    expect(game.ownedCards[0].safe).toBe(false);
    expect(state.turn).toBe(1);
    expect(state.energy).toBe(2);
    expect(state.foes[0]).toMatchObject({ hp: 12, maxHp: 12, dead: false });
    expect(game.eventLog.join('\n')).toContain('已从本场战斗开始处重新进入');
    BattleSession.commands.flee();
  });
});
