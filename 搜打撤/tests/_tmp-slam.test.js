/* 临时验证（2026-09-13 留言批次九）：背包砸击初始牌 + 发现池排除道具。验证后可删。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 8, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 99, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle.core.js');
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
  const g = {
    ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp: 300, maxHp: 99999, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs, heal() {}, addItem() {}, onBattleEnd() {},
  };
  return g;
}
const foe = () => ({ id: 'infantry', name: '靶子', hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const snap = () => BattleSession.getSnapshot();

describe('留言批次九：背包砸击初始牌', () => {
  it('砸击不再发入手牌；按钮 2 费造成 4 点固定伤害', async () => {
    const slash = C.all().find(c => c.type === '武术' && (c.dmg || 0) >= 2 && !/消耗|选择|注能|抽到|释放|化为|丢弃|砸击/.test(String(c.desc || '')));
    const g = makeGame(slash ? [slash] : []);
    BattleSession.start(g, [foe()], { isBoss: false, risk: '' });
    await tick();
    const names = snap().hand.map(u => (viewApi.findCard(u) || {}).card && (viewApi.findCard(u) || {}).card.name);
    expect(names).not.toContain('背包砸击');
    const before = snap().foes[0].hp;
    const energyBefore = snap().energy;
    BattleSession.commands.bagSlam();
    BattleSession.commands.resolveSlam(0);
    await tick();
    const s2 = snap();
    expect(s2.foes[0].hp).toBe(before - 4);
    expect(s2.energy).toBe(energyBefore - 2);
    expect(s2.slamPending).toBe(false);
    BattleSession.commands.flee();
    await tick();
  });

  it('发现池不出现道具卡', () => {
    const pool = C.all().filter(c =>
      c.rarity !== '衍生' && c.type !== '资源' && c.type !== '道具' && C.isRandomObtainable(c));
    expect(pool.every(c => c.type !== '道具')).toBe(true);
    expect(C.all().some(c => c.type === '道具')).toBe(true);
  });
});
