import { beforeAll, describe, expect, it } from 'vitest';
import { ensureM7EquipRules } from '../game/src/cards/cards.sync.m7.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 6, battleHandMax: 30, bossDeckSize: 15, starterSha: 5,
    battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/battle.core.js');
const { applyKillRewards, fireConsumeTriggers } = await import('../game/src/battle/battle.engine.js');
const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
  ensureM7EquipRules();
});

const card = id => {
  const found = Cards.all().find(entry => entry.id === id);
  if (!found) throw new Error(`M7 战斗测试缺卡 ${id}`);
  return found;
};
const foe = () => ({ id: 'm7-test-foe', name: 'M7 靶子', hp: 9999, atk: 0 });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const nap = ms => new Promise(resolve => setTimeout(resolve, ms));

function makeGame(ownedCards = []) {
  return {
    ownedCards, inventory: [], cardOrder: ownedCards.map(entry => entry.uid), usedPocket: [],
    eventLog: [], hp: 50, maxHp: 50, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
    log(message) { this.eventLog.push(String(message)); },
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }, onBattleEnd() {},
  };
}

async function drain() {
  for (let i = 0; i < 160; i++) {
    await tick();
    const state = BattleSession.getSnapshot();
    if (state.discovering || state.choosing || state.handSelecting) return state;
    if (!state.busy && state.actionQueueLength === 0) {
      await nap(30);
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
    }
  }
  throw new Error('M7 BattleSession action did not settle');
}

function endBattle(game) {
  if (game.battleActive) BattleSession.commands.flee();
}

describe('M7 装备触发器真实 BattleSession 消费', () => {
  it('饮血剑：装备后击杀只增加 1 点攻击，旧文本 kill flag 不重复登记', async () => {
    const worn = card('tt3-blooddrinker');
    const game = makeGame([{ uid: 'blooddrink-1', card: worn, safe: false }]);
    BattleSession.start(game, [foe()], { isBoss: false, name: 'M7 饮血剑验证' });
    await drain();
    BattleSession.commands.playCard('blooddrink-1', 'self');
    await drain();
    applyKillRewards({ name: '击杀探针', desc: '' }, 1);
    const result = BattleSession.getSnapshot();
    expect(result.pstat.status.atkUp).toBe(1);
    expect(game.eventLog.filter(line => line.includes('饮血剑')).length).toBe(1);
    endBattle(game);
  });

  it('沉船宝盒：消耗触发只走结构化获取，精确获得两张临时卡', async () => {
    const game = makeGame();
    BattleSession.start(game, [foe()], { isBoss: false, name: 'M7 沉船宝盒验证' });
    await drain();
    const before = BattleSession.getSnapshot().hand.length;
    fireConsumeTriggers(card('tt2-wreck'), null);
    const after = BattleSession.getSnapshot();
    expect(after.hand.length - before).toBe(2);
    endBattle(game);
  });

  it('奥术残卷：消耗触发只抽三张，不再回放描述文本', async () => {
    const game = makeGame();
    BattleSession.start(game, [foe()], { isBoss: false, name: 'M7 奥术残卷验证' });
    await drain();
    const before = BattleSession.getSnapshot().hand.length;
    fireConsumeTriggers(card('tt7-arcanescroll'), null);
    expect(BattleSession.getSnapshot().hand.length - before).toBe(3);
    endBattle(game);
  });
});
