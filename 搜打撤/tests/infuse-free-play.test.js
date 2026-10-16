import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 10, battleHandMax: 99, starterSha: 0, battleStartDraw: 5, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle/core/battle.core.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

async function drain() {
  for (let i = 0; i < 400; i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) {
      await new Promise(resolve => setTimeout(resolve, 30));
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
    }
  }
  throw new Error('免注能出牌队列未结束');
}

afterEach(async () => {
  vi.restoreAllMocks();
  BattleSession.commands.flee();
  await drain();
});

describe('灵能召唤获得的免注能牌：真实出牌结算', () => {
  it.each([
    { name: '纯注能治疗', desc: '注能（1）：回复7点生命', infuse: 1, heal: 7, side: 'self', damage: 0, healing: 7 },
    { name: '可选注能加伤', desc: '造成5点法术伤害；注能(1)：伤害+3。', infuse: 1, dmg: 5, dmgType: 'spell', side: 0, damage: 8, healing: 0 },
    { name: '注能重复施放', desc: '造成3点法术伤害；注能(2)：触发2次。', infuse: 2, dmg: 3, dmgType: 'spell', side: 0, damage: 6, healing: 0 },
  ])('$name：免材料触发效果，正常扣费且不计入材料消耗', async ({ side, damage, healing, ...fields }) => {
    const source = Cards.all().find(card => card.id === 'cmtn1epgt20j');
    expect(source).toBeTruthy();
    const target = { id: 'infuse-free-target', type: '法术', cost: 1, rarity: '稀有', ...fields };
    const filler = { id: 'infuse-free-filler', type: '法术', cost: 0, name: '保留材料', desc: '回复1点生命', heal: 1 };
    const game = {
      ownedCards: [{ uid: 'source', card: source }, { uid: 'filler', card: filler }],
      hp: 30, maxHp: 50, atk: 0, spellPower: 0, coins: 0,
      myClass: '降临者', characterId: null, state: 'idle', battleActive: false,
      log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
      addItem() {}, onBattleEnd() {},
    };
    BattleSession.start(game, [{ id: 'infuse-free-foe', name: '靶子', hp: 999, atk: 1 }], { isBoss: false });
    await drain();
    // 仅固定随机获取候选；真实灵能召唤规则、临时牌实例和出牌链完整执行。
    vi.spyOn(Cards, 'all').mockReturnValue([target]);
    BattleSession.commands.playCard('source', 'self');
    let state = await drain();
    const uid = state.hand.find(value => viewApi.findCard(value)?.card.id === target.id);
    expect(uid).toBeTruthy();
    expect(viewApi.findCard(uid).card._noInfuse).toBe(true);
    expect(target._noInfuse).toBeUndefined();
    const energy = state.energy;
    const hp = game.hp;
    const foeHp = state.foes[0].hp;
    const fuelCount = runtime.infuseFuels;
    BattleSession.commands.playCard(uid, side);
    state = await drain();
    expect(state.infusing).toBeNull();
    expect(state.hand).not.toContain(uid);
    expect(state.hand).toContain('filler');
    expect(state.energy).toBe(energy - target.cost);
    expect(game.hp - hp).toBe(healing);
    expect(foeHp - state.foes[0].hp).toBe(damage);
    expect(runtime.infuseFuels).toBe(fuelCount);
    expect(runtime.consumed).toEqual([]);
  });
});
