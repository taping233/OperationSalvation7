/* 迷之匣（tt3eq-mistbox，2026-09-10 需求改版）真实战斗实打：
 * 装备·限定技能「发现两张随机招式，交换其费用」。
 * 覆盖：改版入库 / 打出穿戴 / 技能发现两张招式 / 两张费用互换（各自显示对方的原费）。 */
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
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v9：迷之匣改版入库）
  C.ensureDmgTypes();
  C.ensureEffectFields();
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
const foeDef = () => ({ id: 'infantry', name: '迷匣靶子', hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const snap = () => BattleSession.getSnapshot();

async function drain(maxLoops = 300) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!s.busy && s.actionQueueLength === 0) return s;
  }
  return snap();
}

const mistbox = () => C.all().find(c => c.id === 'tt3eq-mistbox');
const baseCost = (id) => (C.all().find(c => c.id === id) || {}).cost;

describe('迷之匣（tt3eq-mistbox 改版）', () => {
  it('卡牌已改版：装备，限定技能发现两张随机招式', () => {
    const c = mistbox();
    expect(c).toBeTruthy();
    expect(c.type).toBe('装备');
    expect(c.desc).toContain('限定技能');
    expect(c.desc).toContain('发现两张随机招式');
    expect(c.desc).toContain('交换其费用');
    expect(c.desc).not.toContain('对战开始时');   // 旧开战被动已移除
  });

  it('实打：穿戴后发动技能 → 发现两张招式且费用互换', async () => {
    const g = makeGame([mistbox()]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '迷匣测试' });
    await drain();
    const uid = g.ownedCards[0].uid;
    expect(snap().hand).toContain(uid);          // 新描述无「对战开始时」：进手牌可打出
    BattleSession.commands.playCard(uid, 'self');   // 装备拖到自己身上穿戴
    await drain();
    expect(viewApi.findCard(uid)).toBeTruthy();

    // 发动限定技能：两次「三选一」发现（测试里都选第 0 项）
    BattleSession.commands.useEquipSkill(uid);
    await drain(500);

    // 手牌中应有两张发现的招式（非迷之匣）
    const newCards = snap().hand
      .map(u => viewApi.findCard(u))
      .filter(o => o && o.card.id !== 'tt3eq-mistbox');
    expect(newCards.length, JSON.stringify({logs: g.logs, hand: snap().hand})).toBe(2);
    newCards.forEach(o => expect(['武术', '法术']).toContain(o.card.type));

    // 费用互换：每张显示的费用＝另一张的牌库原费
    const [x, y] = newCards;
    expect(x.card.cost).toBe(baseCost(y.card.id));
    expect(y.card.cost).toBe(baseCost(x.card.id));
    expect(g.logs.some(l => l.includes('交换费用'))).toBe(true);

    // 限定技能本场只能用一次
    BattleSession.commands.useEquipSkill(uid);
    await drain(100);
    expect(g.logs.some(l => l.includes('本场已经用过了'))).toBe(true);
    BattleSession.commands.flee();
  });
});
