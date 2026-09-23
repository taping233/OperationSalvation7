import { beforeAll, describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 3, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/battle.core.js');
const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

let uidSeq = 0;
function makeGame(cards) {
  const logs = [];
  return {
    ownedCards: cards.map(card => ({ uid: `r3-${uidSeq++}`, card: { ...card }, safe: false })),
    hp: 99, maxHp: 99, atk: 0, spellPower: 0, coins: 0,
    myClass: '战士', characterId: null, state: 'idle', battleActive: false,
    logs, log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {},
  };
}
const foe = (name, hp = 30) => ({ id: 'infantry', name, hp, atk: 1 });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
const snap = () => BattleSession.getSnapshot();
async function settle(max = 300) {
  for (let i = 0; i < max; i++) {
    await tick();
    const state = snap();
    if (!state.busy && state.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = snap();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
  }
  return snap();
}
async function leaveBattle() {
  if (snap().deckSelection) BattleSession.commands.cancelDeck();
  else if (snap().player) BattleSession.commands.flee();
  await settle(30);
}

describe('R3-0 真实 commands 交互守卫', () => {
  it('普通战：无 pending、取消后、有效后重复的双镖命令都不结算', async () => {
    const dart = C.all().find(card => card.id === 'tt7-bloodpoison');
    const game = makeGame([dart]);
    BattleSession.start(game, [foe('甲'), foe('乙')], { isBoss: false, name: 'R3-0 普通战' });
    await settle();

    const hp0 = snap().foes.map(entry => entry.hp);
    BattleSession.commands.resolveDart(1);
    expect(snap().foes.map(entry => entry.hp)).toEqual(hp0);

    BattleSession.commands.playCard(game.ownedCards[0].uid, 0);
    await settle();
    expect(snap().dartPending).toBe(true);
    BattleSession.commands.cancelInteraction();
    const afterCancel = snap().foes.map(entry => entry.hp);
    BattleSession.commands.resolveDart(1);
    expect(snap().foes.map(entry => entry.hp)).toEqual(afterCancel);

    // 再开一场得到合法二段，它只允许结算一次。
    await leaveBattle();
    const game2 = makeGame([dart]);
    BattleSession.start(game2, [foe('甲'), foe('乙')], { isBoss: false, name: 'R3-0 重复命令' });
    await settle();
    BattleSession.commands.playCard(game2.ownedCards[0].uid, 0);
    await settle();
    BattleSession.commands.resolveDart(1);
    const resolved = snap().foes.map(entry => entry.hp);
    BattleSession.commands.resolveDart(1);
    expect(snap().foes.map(entry => entry.hp)).toEqual(resolved);
    expect(snap().dartPending).toBe(false);
    await leaveBattle();
  });

  it('普通战：双镖首段击杀后，点死目标不回退改打另一人，pending 保留供重选', async () => {
    const dart = C.all().find(card => card.id === 'tt7-bloodpoison');
    const game = makeGame([dart]);
    BattleSession.start(game, [foe('残血甲', 1), foe('健康乙', 30)], { isBoss: false, name: 'R3-0 死目标' });
    await settle();
    BattleSession.commands.playCard(game.ownedCards[0].uid, 0);
    await settle();
    expect(snap().foes[0].dead).toBe(true);
    expect(snap().foes[1].status.bleed || 0).toBe(0);
    expect(snap().dartPending).toBe(true);

    const liveHp = snap().foes[1].hp;
    BattleSession.commands.resolveDart(0);
    expect(snap().foes[1].hp).toBe(liveHp);
    expect(snap().foes[1].status.poison || 0).toBe(0);
    expect(snap().dartPending).toBe(true);
    BattleSession.commands.resolveDart(1);
    expect(snap().foes[1].hp).toBeLessThan(liveHp);
    expect(snap().dartPending).toBe(false);
    await leaveBattle();
  });

  it('首脑战：砍击的无 pending、错 side、取消后和重复命令不扣能量也不伤害', async () => {
    const game = makeGame([]);
    BattleSession.start(game, [foe('首脑', 50)], { isBoss: true, name: 'R3-0 首脑战' });
    BattleSession.commands.confirmDeck();
    await settle();

    const initial = snap();
    BattleSession.commands.resolveSlam(0);
    expect(snap().energy).toBe(initial.energy);
    expect(snap().foes[0].hp).toBe(initial.foes[0].hp);

    BattleSession.commands.bagSlam();
    BattleSession.commands.resolveSlam(99);
    expect(snap().slamPending).toBe(true);
    expect(snap().energy).toBe(initial.energy);
    expect(snap().foes[0].hp).toBe(initial.foes[0].hp);

    BattleSession.commands.cancelInteraction();
    BattleSession.commands.resolveSlam(0);
    expect(snap().energy).toBe(initial.energy);
    expect(snap().foes[0].hp).toBe(initial.foes[0].hp);

    BattleSession.commands.bagSlam();
    BattleSession.commands.resolveSlam(0);
    const resolved = snap();
    expect(resolved.energy).toBe(initial.energy - 2);
    expect(resolved.foes[0].hp).toBe(initial.foes[0].hp - 4);
    BattleSession.commands.resolveSlam(0);
    expect(snap().energy).toBe(resolved.energy);
    expect(snap().foes[0].hp).toBe(resolved.foes[0].hp);
    await leaveBattle();
  });

  it('普通战：待选期间能量变为不足时不结算，并保留砍击选择态', async () => {
    const spendTwo = C.all().find(card => card.id === 'cc-unmoved');
    const game = makeGame([spendTwo]);
    BattleSession.start(game, [foe('能量靶')], { isBoss: false, name: 'R3-0 能量守卫' });
    await settle();
    BattleSession.commands.bagSlam();
    expect(snap().slamPending).toBe(true);

    BattleSession.commands.playCard(game.ownedCards[0].uid, 'self');
    await settle();
    expect(snap().energy).toBe(1);
    expect(snap().slamPending).toBe(true);
    const hp = snap().foes[0].hp;
    BattleSession.commands.resolveSlam(0);
    expect(snap().energy).toBe(1);
    expect(snap().foes[0].hp).toBe(hp);
    expect(snap().slamPending).toBe(true);
    expect(game.logs.some(line => line.includes('能量不足'))).toBe(true);
    await leaveBattle();
  });
});
