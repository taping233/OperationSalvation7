/* 连续射击（cc-rapid-fire，2026-09-10 需求）真实战斗实打：
 * 1 费史诗武术——「本回合每打出一张其他招式，造成2点固定伤害」。
 * 覆盖：n=0 不造成伤害 / n 随本回合已打出的武术数递增 / 回合开始清零 / 本牌不计自身。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 99, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle.core.js');

const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v4：连续射击入库）
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

// ---------- 假对局环境（与 battle-all-cards 同口径） ----------
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
const foeDef = () => ({ id: 'infantry', name: '连射靶子', hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const snap = () => BattleSession.getSnapshot();
const foeHp = () => snap().foes[0].hp;
const energy = () => snap().energy;

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

async function playByName(g, name) {
  const hand = snap().hand || [];
  const entry = hand.map(uid => g.ownedCards.find(o => o.uid === uid)).find(o => o?.card?.name === name);
  expect(entry, `手牌中应有【${name}】`).toBeTruthy();
  expect(hand, `【${name}】uid 必须在当前手牌`).toContain(entry.uid);
  BattleSession.commands.playCard(entry.uid, 0);
  if (snap().infusing) {   // 无注能卡兜底：万一误配注能，自动补燃料
    for (let i = 0; i < 30 && snap().infusing; i++) {
      const s = snap();
      const t = s.hand.find(u => !s.infusing.picked.includes(u) && u !== s.infusing.uid);
      if (!t || !s.infusing) break;
      BattleSession.commands.selectInfusion(t);
      await tick();
    }
    if (snap().infusing) BattleSession.commands.confirmInfusion();
  }
  return drain();
}

const rapid = () => C.all().find(c => c.id === 'cc-rapid-fire');
const sha = () => C.all().find(c => c.name === '初始攻击');

async function freshBattle(cards) {
  const g = makeGame(cards);
  BattleSession.start(g, [foeDef()], { isBoss: false, name: '连射测试' });
  await drain();
  return g;
}

describe('连续射击（cc-rapid-fire）', () => {
  it('卡牌已入库：1费史诗武术，2点固定伤害词条', () => {
    const c = rapid();
    expect(c).toBeTruthy();
    expect(c.cost).toBe(1);
    expect(c.rarity).toBe('史诗');
    expect(c.type).toBe('武术');
    expect(c.dmg).toBe(2);
    expect(c.dmgType).toBe('fixed');
  });

  it('本回合没打出其他招式时打出 → 不造成伤害', async () => {
    const g = await freshBattle([rapid()]);
    const before = foeHp();
    await playByName(g, '连续射击');
    expect(foeHp()).toBe(before);
    expect(g.logs.some(l => l.includes('还没有打出其他招式'))).toBe(true);
    BattleSession.commands.flee();
  });

  it('先打 2 张初始攻击再连射 → 恰好 4 点固定伤害（2点×n=2）', async () => {
    const g = await freshBattle([sha(), sha(), sha(), rapid(), rapid()]);
    const before = foeHp();
    await playByName(g, '初始攻击');           // 攻击力5 → -5
    await playByName(g, '初始攻击');           // -5
    expect(foeHp()).toBe(before - 10);
    await playByName(g, '连续射击');           // n=2 → -4
    expect(foeHp()).toBe(before - 14);
    expect(g.logs.some(l => l.includes('触发 2 次'))).toBe(true);
    // 本牌（武术）计入后，再连射 n=3 → -6
    await playByName(g, '连续射击');
    expect(foeHp()).toBe(before - 20);
    expect(g.logs.some(l => l.includes('触发 3 次'))).toBe(true);
    BattleSession.commands.flee();
  });

  it('打出法术同样计入招式数（招式＝武术+法术，2026-09-10 定版）', async () => {
    const huozhu = C.all().find(c => c.id === 'tt3-fireball');
    expect(huozhu, '库内应有法术「火球」').toBeTruthy();
    const g = makeGame([huozhu, rapid()]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '连射测试' });
    await drain();
    const hp = foeHp();
    await playByName(g, '火球');               // 法术 4+法伤2 → -6，n→1
    expect(energy()).toBe(98);
    expect(foeHp()).toBe(hp - 6);
    await playByName(g, '连续射击');           // n=1 → -2
    expect(energy()).toBe(97);
    expect(foeHp()).toBe(hp - 8);
    expect(g.logs.some(l => l.includes('触发 1 次'))).toBe(true);
    BattleSession.commands.flee();
  });

  it('新回合开始计数清零 → 连射重新从 0 算起', async () => {
    const g = await freshBattle([sha(), rapid(), rapid()]);
    await playByName(g, '初始攻击');
    await playByName(g, '连续射击');           // n=1 → -2
    const afterCombo = foeHp();
    BattleSession.commands.endTurn();
    await drain(500);
    expect(snap().foes[0].dead || snap().energy === 99).toBe(true);   // 能量回满=新回合已开始
    const before = foeHp();
    await playByName(g, '连续射击');           // 新回合 n=0 → 0 伤
    expect(foeHp()).toBe(before);
    expect(g.logs.filter(l => l.includes('还没有打出其他招式')).length).toBe(1);
    BattleSession.commands.flee();
  });
});
