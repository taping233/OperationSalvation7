/* N1 回归（2026-09-25 老板定版）：注能选牌按 uid 精确 toggle。
 * 缺陷：旧「组级 toggle」（组内非空即 delete 最后一张）让「同名堆叠 ×need≥2」
 * 永远选不满燃料——tt12 实机走查 N1（docs/tt12-live-walkthrough-2026-09-24.md）：
 * 同一叠连点三次 picked 0→1→0→1，点第二张=顶掉第一张。
 * 修复口径：点已选中的那张=取消它；点未选中的=尝试选中这张本身；
 * 组级校验（真手牌 + need 封顶）不回退。
 * 只打真实 BattleSession（battle.core，无视图层），姿势与
 * battle-all-cards.test.js / card-effect-semantics.test.js 同源。 */
import { beforeAll, describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle/battle.core.js');
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
    ownedCards: cards.map(card => ({ uid: `n1-${uidSeq++}`, card, safe: false })),
    hp: 999, maxHp: 999, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs, heal() {}, addItem() {}, onBattleEnd() {},
  };
}
const clone = card => ({ ...card });
const MAIN = { id: 'n1-test-main', name: '邪能护体（测试）', type: '法术', cost: 1, dmgType: 'spell', infuse: 2, desc: '注能(2)：获得 6 点护盾。' };
const FUEL = { id: 'n1-test-fuel', name: '测试燃料（同名×3）', type: '武术', cost: 1, dmgType: 'attack', dmg: 1, desc: '攻击 1。' };
const OTHER = { id: 'n1-test-other', name: '测试对照（不同名）', type: '法术', cost: 1, dmgType: 'spell', desc: '获得 2 点护盾。' };
const foe = () => ({ id: 'infantry', name: 'N1 测试靶', hp: 999, atk: 1 });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

// 开一场普通战斗，把注能(2)主卡打进注能态；返回手牌里同名燃料叠 uid 与不同名对照 uid。
async function beginInfuseOnStack() {
  const game = makeGame([clone(MAIN), clone(FUEL), clone(FUEL), clone(FUEL), clone(OTHER)]);
  BattleSession.start(game, [foe()], { isBoss: false });
  for (let i = 0; i < 100; i++) {
    await tick();
    const s = BattleSession.getSnapshot();
    if (!s.busy && !s.actionQueueLength) break;
  }
  const s0 = BattleSession.getSnapshot();
  const stackUids = s0.hand.filter(u => { const o = viewApi.findCard(u); return o && o.card.id === FUEL.id; });
  const other = s0.hand.find(u => { const o = viewApi.findCard(u); return o && o.card.id === OTHER.id; });
  expect(stackUids.length, '前置：同名燃料叠应有 3 张在手').toBe(3);
  expect(other, '前置：不同名对照卡应在手').toBeTruthy();
  const main = game.ownedCards.find(o => o.card.id === MAIN.id);
  BattleSession.commands.playCard(main.uid, null);
  const s1 = BattleSession.getSnapshot();
  expect(s1.infusing, '前置：应进入注能态').toBeTruthy();
  expect(s1.infusing.need, '前置：注能 need 应为 2').toBe(2);
  return { stackUids, other };
}
const picked = () => [...BattleSession.getSnapshot().infusing.picked];

describe('N1：注能选牌按 uid 精确 toggle（同名堆叠 ×need≥2）', () => {
  it('连点两张不同 uid 都保持 picked——同名堆叠可选满 need', async () => {
    const { stackUids } = await beginInfuseOnStack();
    BattleSession.commands.selectInfusion(stackUids[0]);
    expect(picked()).toEqual([stackUids[0]]);
    BattleSession.commands.selectInfusion(stackUids[1]);   // 旧实现此处会顶掉 stackUids[0]
    expect(picked()).toContain(stackUids[0]);
    expect(picked()).toContain(stackUids[1]);
    expect(picked().length).toBe(2);   // 同叠两张，选满 need=2
  });

  it('点同一 uid 两次回到 0——per-uid 取消，选中的就是点的那张', async () => {
    const { stackUids } = await beginInfuseOnStack();
    BattleSession.commands.selectInfusion(stackUids[1]);   // 故意点非首位张：选中的必须是它本身
    expect(picked()).toEqual([stackUids[1]]);
    BattleSession.commands.selectInfusion(stackUids[1]);
    expect(picked().length).toBe(0);
  });

  it('超 need 上限被拒；取消单张只影响该张，不动其他已选张', async () => {
    const { stackUids, other } = await beginInfuseOnStack();
    BattleSession.commands.selectInfusion(stackUids[0]);
    BattleSession.commands.selectInfusion(stackUids[1]);
    expect(picked().length).toBe(2);
    BattleSession.commands.selectInfusion(stackUids[2]);   // 同叠第三张：超上限应被拒
    expect(picked().length).toBe(2);
    expect(picked()).not.toContain(stackUids[2]);
    BattleSession.commands.selectInfusion(other);          // 满员时点不同名卡：同样被拒（容量校验不回退）
    expect(picked().length).toBe(2);
    expect(picked()).not.toContain(other);
    BattleSession.commands.selectInfusion(stackUids[0]);   // 取消第一张
    expect(picked()).toEqual([stackUids[1]]);
    BattleSession.commands.selectInfusion(other);          // 腾出容量后不同名卡可选
    expect(picked().length).toBe(2);
    expect(picked()).toContain(stackUids[1]);
    expect(picked()).toContain(other);
    BattleSession.commands.selectInfusion(other);          // 再点它自己=只取消它
    expect(picked()).toEqual([stackUids[1]]);
  });
});
