/* 诅咒之刃（cc-cursed-blade，2026-09-10 需求）真实战斗实打：
 * 2 费稀有武术——「攻（+3），附加手牌中的招式所具有的全部诅咒效果」。
 * 覆盖：入库字段 / 从手牌招式收集诅咒（含法术、叠加合并）/ 命中时全部附加 /
 *       无诅咒手牌时的降级提示 / viewApi.handCurseSpecs 卡面数据实时性。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle.core.js');

const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v7：诅咒之刃入库）
  C.ensureDmgTypes();
  C.ensureEffectFields();
  // 测试专用手牌招式（只在本测试文件的 localStorage 环境内）
  C.upsert({ id: 'test-cb-martial', name: '测试毒斩', cost: 1, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻1，附加 2 层中毒。' });
  C.upsert({ id: 'test-curse-spell', name: '测试咒焰', cost: 2, rarity: '古朴', type: '法术', dmg: 3, dmgType: 'spell', desc: '造成 3 点法术伤害，附加灼烧；破甲。' });
  C.upsert({ id: 'test-no-curse', name: '测试木桩', cost: 1, rarity: '古朴', type: '武术', dmg: 2, dmgType: 'attack', desc: '攻2。' });
});

let uidSeq = 0;
function makeGame(cards) {
  const logs = [];
  const g = {
    ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp: 99999, maxHp: 99999, atk: 5, spellPower: 2, coins: 0,
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
const foeDef = () => ({ id: 'infantry', name: '诅咒靶子', hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
const snap = () => BattleSession.getSnapshot();
const foe = () => snap().foes[0];

async function drain(maxLoops = 300) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!s.busy && s.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = snap();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
  }
  return snap();
}

async function playByName(g, name) {
  const s = snap();
  const entry = g.ownedCards.find(o => o.card.name === name && s.hand.includes(o.uid));
  expect(entry, `手牌中应有【${name}】`).toBeTruthy();
  BattleSession.commands.playCard(entry.uid, 0);
  return drain();
}

const blade = () => C.all().find(c => c.id === 'cc-cursed-blade');
const specOf = (key) => viewApi.handCurseSpecs().find(s => s.key === key);

describe('诅咒之刃（cc-cursed-blade）', () => {
  it('卡牌已入库：2费稀有武术，攻（+3）词条', () => {
    const c = blade();
    expect(c).toBeTruthy();
    expect(c.cost).toBe(2);
    expect(c.rarity).toBe('稀有');
    expect(c.type).toBe('武术');
    expect(c.dmg).toBe(3);
    expect(c.dmgType).toBe('attack');
  });

  it('手牌招式的诅咒被实时合并：武术与法术都计入、无诅咒卡不干扰', async () => {
    const g = makeGame([blade(), C.all().find(c => c.id === 'test-cb-martial'),
      C.all().find(c => c.id === 'test-curse-spell'), C.all().find(c => c.id === 'test-no-curse')]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '诅咒测试' });
    await drain();
    const specs = viewApi.handCurseSpecs();
    const get = k => (specs.find(s => s.key === k) || {}).n || 0;
    expect(get('poison')).toBe(2);   // 测试毒斩：附加 2 层中毒（可叠加）
    expect(get('burn')).toBe(1);     // 测试咒焰：附加灼烧（不叠加）
    expect(get('abreak')).toBe(2);   // 测试咒焰：破甲（引擎缺省 2 回合）
    expect(get('bleed')).toBe(0);    // 手牌没有流血来源
    BattleSession.commands.flee();
  });

  it('打出时命中附加全部诅咒：伤害 3+攻5=8，中毒2/灼烧/破甲到位', async () => {
    const g = makeGame([blade(), C.all().find(c => c.id === 'test-cb-martial'),
      C.all().find(c => c.id === 'test-curse-spell')]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '诅咒测试' });
    await drain();
    const hp = foe().hp;
    await playByName(g, '诅咒之刃');
    expect(foe().hp).toBe(hp - 8);                     // 攻3 + 攻击力5
    expect(foe().status.poison).toBe(2);
    expect(foe().status.burn).toBe(1);
    expect(foe().status.abreak).toBe(2);
    expect(g.logs.some(l => l.includes('附加手牌招式的诅咒'))).toBe(true);
    BattleSession.commands.flee();
  });

  it('手牌没有带诅咒的招式 → 只造成攻击伤害并提示', async () => {
    const g = makeGame([blade(), C.all().find(c => c.id === 'test-no-curse')]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '诅咒测试' });
    await drain();
    const hp = foe().hp;
    await playByName(g, '诅咒之刃');
    expect(foe().hp).toBe(hp - 8);
    expect(foe().status.poison || 0).toBe(0);
    expect(g.logs.some(l => l.includes('没有带诅咒的招式'))).toBe(true);
    BattleSession.commands.flee();
  });
});
