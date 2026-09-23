import { beforeAll, describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 7, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};

await import('../game/src/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle.core.js');
const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

const byId = id => {
  const card = Cards.all().find(entry => entry.id === id);
  if (!card) throw new Error(`现役卡库缺卡：${id}`);
  return card;
};

function makeGame(ownedCards) {
  const logs = [];
  return {
    ownedCards,
    hp: 50, maxHp: 50, atk: 5, spellPower: 0, coins: 0,
    myClass: '降临者', characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {}, onBattleEnd() {},
  };
}

const foe = () => ({ id: 'tt12-preplay-foe', name: '规则验收靶', hp: 999, atk: 1 });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function drain() {
  for (let i = 0; i < 400; i++) {
    await tick();
    const state = BattleSession.getSnapshot();
    if (state.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (state.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (state.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!state.busy && state.actionQueueLength === 0) return state;
  }
  throw new Error('TT12 战斗动作队列等待 400 轮仍未收敛');
}

describe('TT12 结构化出牌前规则：真实 BattleSession', () => {
  it('从现役卡库取屏障修复规则；零护甲免费自选自身，护甲存在时仍扣 1 费', async () => {
    const canonical = byId('tt12-barriermend');
    expect(canonical.rules.battle.target).toEqual({ side: 'self', area: false });
    expect(canonical.rules.battle.costModifiers).toEqual([{ kind: 'armorZeroFree' }]);
    expect(canonical.rules.triggers.onPlay).toEqual([{ op: 'armor', amountField: 'armor' }]);
    // 改写即时描述仍按 armor 字段结算一次，费用和目标也不随文案变化。
    const rewritten = { ...canonical, desc: '造成1点法术伤害' };
    const firstUid = 'tt12-barrier-canonical';
    const rewrittenUid = 'tt12-barrier-rewritten';
    const game = makeGame([
      { uid: firstUid, card: canonical, safe: false },
      { uid: rewrittenUid, card: rewritten, safe: false },
    ]);

    BattleSession.start(game, [foe()], { isBoss: false });
    let state = await drain();
    const startingEnergy = state.energy;
    expect(state.pdef.armor).toBe(0);

    BattleSession.commands.playCard(firstUid, null);
    state = BattleSession.getSnapshot();
    expect(state.pendingTarget).toBeTruthy();
    expect(state.energy).toBe(startingEnergy);
    BattleSession.commands.playCard(firstUid, 'self');
    state = await drain();
    expect(state.pdef.armor).toBe(6);
    expect(state.energy).toBe(startingEnergy);

    expect(viewApi.effCostOf(rewritten, rewrittenUid)).toBe(1);
    BattleSession.commands.playCard(rewrittenUid, null);
    state = BattleSession.getSnapshot();
    expect(state.pendingTarget).toBeTruthy();
    expect(state.energy).toBe(startingEnergy);
    BattleSession.commands.playCard(rewrittenUid, 'self');
    state = await drain();
    expect(state.energy).toBe(startingEnergy - 1);
    expect(state.pdef.armor).toBe(12);
    expect(state.hand).not.toContain(rewrittenUid);

    BattleSession.commands.flee();
    await drain();
  });

  it('后备能源按真实消耗口袋快照折费，并在改写描述后直接打出', async () => {
    const canonical = byId('tt12-backupcell');
    const dragon = byId('tt12-raydragon');
    const fuel = byId('tt3-holy-water');
    expect(canonical.rules.battle.target).toEqual({ side: null, area: false });
    expect(canonical.rules.battle.costModifiers).toEqual([{ kind: 'consumedSpellDiscount', amount: 1 }]);
    expect(fuel.type).toBe('法术');
    // 改写描述会影响抽牌/回能旧效果；本用例只验结构化目标、费用预检和成功出牌。
    const backup = { ...canonical, desc: '对敌人造成1点法术伤害' };
    const backupUid = 'tt12-backup-rewritten';
    const dragonUid = 'tt12-raydragon-infuser';
    const fuelUid = 'tt12-pocket-spell-fuel';
    const game = makeGame([
      { uid: backupUid, card: backup, safe: false },
      { uid: dragonUid, card: dragon, safe: false },
      { uid: fuelUid, card: fuel, safe: false },
    ]);

    BattleSession.start(game, [foe()], { isBoss: false });
    await drain();
    expect(BattleSession.getSnapshot().energy).toBe(7);

    BattleSession.commands.playCard(dragonUid, null);
    expect(BattleSession.getSnapshot().infusing).toBeTruthy();
    BattleSession.commands.selectInfusion(fuelUid);
    await tick();
    BattleSession.commands.confirmInfusion();
    let state = await drain();
    expect(state.energy).toBe(5);
    expect(viewApi.effCostOf(backup, backupUid)).toBe(5);

    // 用 5 点当前能量实打：未计入口袋法术时 6 费无法通过出牌预检。
    BattleSession.commands.playCard(backupUid, null);
    state = await drain();
    expect(state.pendingTarget).toBeNull();
    expect(state.hand).not.toContain(backupUid);
    expect(state.energy).toBe(0);
    expect(game.logs.some(line => line.includes('能量不足'))).toBe(false);

    BattleSession.commands.flee();
    await drain();
  });

  it('违禁烟火从现役卡库取得结构化规则；改写描述后仍选敌方目标并对全体造成一次固定伤害', async () => {
    const canonical = byId('tt12-firecracker');
    expect(canonical.rules.battle.target).toEqual({ side: 'enemy', area: true });
    expect(canonical.rules.triggers.onPlay).toEqual([{ op: 'damage', amountField: 'dmg', target: 'allEnemies' }]);
    const rewritten = { ...canonical, desc: '改写后的任意文案' };
    const uid = 'tt12-firecracker-rewritten';
    const game = makeGame([{ uid, card: rewritten, safe: false }]);
    const foes = [foe(), { ...foe(), id: 'tt12-preplay-foe-2' }];

    BattleSession.start(game, foes, { isBoss: false });
    await drain();
    let state = BattleSession.getSnapshot();
    const enemies = state.foes || state.enemies;
    const before = enemies.map(enemy => enemy.hp);
    expect(before).toEqual([999, 999]);
    BattleSession.commands.playCard(uid, null);
    state = BattleSession.getSnapshot();
    expect(state.pendingTarget).toBeTruthy();
    BattleSession.commands.playCard(uid, '0');
    state = await drain();
    expect((state.foes || state.enemies).map(enemy => enemy.hp)).toEqual([998, 998]);
    expect(state.hand).not.toContain(uid);

    BattleSession.commands.flee();
    await drain();
  });
});
