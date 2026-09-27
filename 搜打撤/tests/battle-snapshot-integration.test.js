import { describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 6, battleHandMax: 8, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};

await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/battle.core.js');

window.SDT.Cards.ensureSha();
window.SDT.Cards.ensureStarters();
window.SDT.Cards.ensureTabletop();
window.SDT.Cards.ensureDmgTypes();
window.SDT.Cards.ensureEffectFields();

describe('真实 BattleSession 快照卡牌隔离', () => {
  it('复用稳定快照，并在源卡嵌套规则变化后重新投影待选目标卡', () => {
    const card = {
      id: 'snapshot-integration-probe', name: '快照集成探针', cost: 0,
      type: '武术', desc: '造成 1 点攻击伤害。', dmg: 1, dmgType: 'attack',
      rules: { battle: { target: { side: 'enemy', area: false }, extension: { values: [1] } } },
    };
    const game = {
      ownedCards: [{ uid: 'snapshot-integration-probe', card, safe: false }],
      inventory: [], cardOrder: ['snapshot-integration-probe'], usedPocket: [], eventLog: [],
      hp: 30, maxHp: 30, atk: 5, spellPower: 0, coins: 8, turn: 1,
      myClass: '战士', characterId: 'heixiang', state: 'idle', battleActive: false,
      log(message) { this.eventLog.push(String(message)); },
      heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
      onBattleEnd() {},
    };
    const foe = { id: 'snapshot-integration-foe', name: '集成靶子', hp: 40, atk: 1 };

    BattleSession.start(game, [foe], { isBoss: false, name: '快照卡牌隔离集成' });
    BattleSession.commands.playCard('snapshot-integration-probe', null);
    const first = BattleSession.getSnapshot();

    expect(first.pendingTarget?.card.id).toBe(card.id);
    expect(Object.isFrozen(first.pendingTarget.card.rules.battle.extension.values)).toBe(true);
    expect(Object.isFrozen(card)).toBe(false);
    expect(Object.isFrozen(card.rules.battle.extension.values)).toBe(false);
    expect(BattleSession.getSnapshot()).toBe(first);

    card.rules.battle.extension.values.push(2);
    const refreshed = BattleSession.getSnapshot();
    expect(refreshed).not.toBe(first);
    expect(first.pendingTarget.card.rules.battle.extension.values).toEqual([1]);
    expect(refreshed.pendingTarget.card.rules.battle.extension.values).toEqual([1, 2]);
    expect(Object.isFrozen(card.rules.battle.extension.values)).toBe(false);

    BattleSession.commands.flee();
  });
});
