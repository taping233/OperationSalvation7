import { beforeAll, describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
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
    ownedCards: cards.map(card => ({ uid: `sem-${uidSeq++}`, card, safe: false })),
    hp: 99, maxHp: 99, atk: 5, spellPower: 0, coins: 0,
    myClass: '降临者', characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {}, onBattleEnd() {},
  };
}
const card = id => {
  const found = C.all().find(entry => entry.id === id);
  if (!found) throw new Error(`卡库缺卡：${id}`);
  return found;
};
const foe = (hp = 999) => ({ id: 'infantry', name: '语义测试靶', hp, atk: 1 });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const nap = (ms) => new Promise(resolve => setTimeout(resolve, ms));   // 空闲确认用真实延时（根治负载 flake）
async function drain() {
  for (let i = 0; i < 400; i++) {
    await tick();
    const state = BattleSession.getSnapshot();
    if (state.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (state.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (state.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!state.busy && state.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
  }
  throw new Error('战斗动作队列等待 400 轮仍未收敛');
}
async function infuseAndPlay(game, cardId, fuelIds, target = 0) {
  const main = game.ownedCards.find(entry => entry.card.id === cardId);
  BattleSession.commands.playCard(main.uid, null);
  for (const id of fuelIds) {
    const fuel = game.ownedCards.find(entry => entry.card.id === id && entry.uid !== main.uid);
    expect(fuel, `应有注能燃料 ${id}`).toBeTruthy();
    BattleSession.commands.selectInfusion(fuel.uid);
    await tick();
  }
  BattleSession.commands.confirmInfusion();
  await drain();
  if (BattleSession.getSnapshot().pendingTarget) {
    BattleSession.commands.playCard(main.uid, target);
    await drain();
  }
  return BattleSession.getSnapshot();
}

describe('已知效果条目的真实战斗语义', () => {
  it('tt3sp-silverthorn：注能后法术伤害从 5 增至 8', async () => {
    const laser = card('tt3sp-silverthorn');
    const fuel = card('tt3-holy-water');
    expect(laser.name).toBe('镭射');
    const game = makeGame([laser, fuel]);
    BattleSession.start(game, [foe()], { isBoss: false });
    await drain();
    await infuseAndPlay(game, laser.id, [fuel.id]);
    expect(BattleSession.getSnapshot().foes[0].hp).toBe(999 - 8);
    BattleSession.commands.flee();
    await drain();
  });

  it('tt7-holyheal：注能费用 2 的燃料后回复 4 点生命', async () => {
    const heal = card('tt7-holyheal');
    const fuel = card('cc-cursed-blade');
    expect(fuel.cost).toBe(2);
    const game = makeGame([heal, fuel]);
    game.hp = 50;
    BattleSession.start(game, [foe()], { isBoss: false });
    await drain();
    await infuseAndPlay(game, heal.id, [fuel.id], 'self');
    expect(game.hp).toBe(54);
    expect(game.logs.some(line => line.includes('牺牲品费用 2') && line.includes('回复 4 点生命'))).toBe(true);
    BattleSession.commands.flee();
    await drain();
  });

  it('tt7-meteorstrong：注能两张后施放三次火球，共造成 12 点法伤', async () => {
    const meteor = card('tt7-meteorstrong');
    expect(meteor.name).toBe('星陨之力');
    const fuels = [card('tt3-holy-water'), card('tt3sp-silverthorn')];
    const game = makeGame([meteor, ...fuels]);
    BattleSession.start(game, [foe()], { isBoss: false });
    await drain();
    await infuseAndPlay(game, meteor.id, fuels.map(entry => entry.id));
    expect(BattleSession.getSnapshot().foes[0].hp).toBe(999 - 12);
    expect(game.logs.some(line => line.includes('施放 3 次火球'))).toBe(true);
    BattleSession.commands.flee();
    await drain();
  });
});
