/* 2026-09-10 留言修复回归：
 * #25 铸甲「消耗1张装备牌，+10甲」此前双路径各加一次（结构化兜底 + thenText）实际 +20；
 * #37 法力奔涌只认新描述正则，旧档快照克隆的旧措辞描述会导致整卡无效果（识别失败）。 */
import { describe, it, expect, beforeAll } from 'vitest';

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

it('偷取的攻击力在一个回合结束后归还活着的敌人', async () => {
  const g = makeGame([{ id: 'steal-test', name: '影噬', cost: 0, type: '武术', desc: '本回合偷取1名敌人的攻击力至1点。' }]);
  BattleSession.start(g, [{ ...foeDef(), atk: 7 }], { isBoss: false });
  await drain();
  BattleSession.commands.playCard(g.ownedCards[0].uid, 0);
  await drain();
  expect(snap().foes[0].atk).toBe(1);
  BattleSession.commands.endTurn();
  await drain();
  expect(snap().foes[0].atk).toBe(7);
  BattleSession.commands.flee();
  await drain(20);
});

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
  const g = {
    ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp: 99999, maxHp: 99999, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {},
    onBattleEnd() {},
  };
  return g;
}
const foeDef = () => ({ id: 'infantry', name: '铸甲靶子', hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
const snap = () => BattleSession.getSnapshot();
async function drain(maxLoops = 300, pickUid = null) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.handSelecting) {
      if (pickUid && s.hand.includes(pickUid)) BattleSession.commands.pickHandSelect(pickUid);
      else BattleSession.commands.skipHandSelect();
      continue;
    }
    if (!s.busy && s.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = snap();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
  }
  return snap();
}

const turtle = () => C.all().find(c => c.name === '铸甲');
const anyEquip = () => C.all().find(c => c.type === '装备' && !/对战开始时/.test(String(c.desc || '')));
const surge = () => C.all().find(c => c.id === 'cc-mana-surge');

describe('铸甲 +10 甲不再双倍（2026-09-10 #25）', () => {
  it('消耗 1 张装备牌后护甲恰好 +10', async () => {
    const t = turtle();
    expect(t, '卡库里应有铸甲').toBeTruthy();
    const e = anyEquip();
    expect(e, '需要一张可消耗的装备牌').toBeTruthy();
    const g = makeGame([t, e]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '铸甲测试' });
    await drain();
    const turtleUid = g.ownedCards[0].uid;
    expect(snap().hand).toContain(turtleUid);
    BattleSession.commands.playCard(turtleUid, 'self');   // 消耗句→选择 1 张装备牌
    await drain(300, g.ownedCards[1].uid);                // 手选消耗那张装备牌
    const armor = snap().pdef.armor;
    expect(armor, `铸甲应恰好 +10 甲（logs: ${g.logs.join(' | ').slice(0, 400)}）`).toBe(10);
    BattleSession.commands.flee();
    await drain(20);
  });
});

describe('法力奔涌识别兜底（2026-09-10 #37）', () => {
  it('旧措辞描述的快照克隆也能按名称/ID 识别并释放随机法术', async () => {
    const s = surge();
    expect(s, '卡库里应有法力奔涌').toBeTruthy();
    const oldClone = { ...s, desc: '随机释放4个法术。（旧措辞快照）' };   // 模拟旧档克隆
    const g = makeGame([oldClone]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '奔涌测试' });
    await drain();
    const uid = g.ownedCards[0].uid;
    expect(snap().hand).toContain(uid);
    BattleSession.commands.playCard(uid, 'any');
    await drain(500);
    expect(g.logs.some(l => l.includes('法力奔涌') && l.includes('释放随机法术')),
      `旧描述也应触发随机释放（logs: ${g.logs.join(' | ').slice(0, 300)}）`).toBe(true);
    BattleSession.commands.flee();
    await drain(20);
  });
});

describe('限时数值增益', () => {
  it('「攻击力 +2，持续 1 回合」在本回合结束时准确撤回', async () => {
    const timedBuff = { id: 'test-timed-atk', name: '短时强化', cost: 0, rarity: '古朴', type: '武术', desc: '获得 2 点攻击力，持续 1 回合。' };
    const g = makeGame([timedBuff]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '限时增益测试' });
    await drain();
    const uid = g.ownedCards[0].uid;
    expect(snap().hand).toContain(uid);
    BattleSession.commands.playCard(uid, 'self');
    await drain();
    expect(snap().pstat.status.atkUp).toBe(2);
    BattleSession.commands.endTurn();
    await drain(500);
    expect(snap().pstat.status.atkUp).toBe(0);
    BattleSession.commands.flee();
    await drain(20);
  });
});
