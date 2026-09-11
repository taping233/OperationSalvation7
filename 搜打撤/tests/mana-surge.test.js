/* 法力奔涌（cc-mana-surge，2026-09-10 需求）真实战斗实打：
 * 2 费传说法术——「对随机敌人释放4个随机法术（这些随机法术默认已注能）」。
 * 覆盖：入库字段 / 恰好释放 4 发 / 每发是池内随机法术且不含自身 / 战斗可正常收尾。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const { BattleSession } = await import('../game/src/battle.core.js');

const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v5：法力奔涌入库）
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
const foeDef = () => ({ id: 'infantry', name: '奔涌靶子', hp: 99999, atk: 1 });
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

const surge = () => C.all().find(c => c.id === 'cc-mana-surge');

describe('法力奔涌（cc-mana-surge）', () => {
  it('卡牌已入库：2费传说法术', () => {
    const c = surge();
    expect(c).toBeTruthy();
    expect(c.cost).toBe(2);
    expect(c.rarity).toBe('传说');
    expect(c.type).toBe('法术');
  });

  it('随机法术池非空且不含自身', () => {
    const pool = C.all().filter(c => c.type === '法术' && c.id !== 'cc-mana-surge' && C.isRandomObtainable(c));
    expect(pool.length).toBeGreaterThan(0);
  });

  it('打出后恰好释放 4 发随机法术，均为池内法术且不含自身', async () => {
    const g = makeGame([surge()]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '奔涌测试' });
    await drain();
    const entry = g.ownedCards[0];
    const before = snap().foes[0].hp;
    BattleSession.commands.playCard(entry.uid, 0);
    const end = await drain(500);

    // 恰好 4 发，编号 1..4（日志带 <b> 标签，只匹配无标签的「（第 N/4 发）」段）
    const castLogs = g.logs.filter(l => /（第 \d+\/4 发）/.test(l));
    expect(castLogs.length).toBe(4);
    [1, 2, 3, 4].forEach(i => {
      expect(castLogs.some(l => l.includes(`第 ${i}/4 发`))).toBe(true);
    });
    // 每发释放的是库内「法术」且不是法力奔涌自身（防递归）；提取名先剥掉日志里的 <b> 标签
    const castNames = castLogs
      .map(l => (l.match(/释放随机法术【(.+?)】/) || [])[1])
      .map(n => n.replace(/<[^>]+>/g, ''))
      .filter(Boolean);
    expect(castNames.length).toBe(4);
    castNames.forEach(name => {
      expect(name).not.toBe('法力奔涌');
      const lib = C.all().find(c => c.name === name);
      expect(lib, `释放的【${name}】应在卡牌库中`).toBeTruthy();
      expect(lib.type).toBe('法术');
    });
    // 产生了可观测变化（敌人掉血 / 回复 / 抽牌等至少其一）
    const observed = snap().foes[0].hp !== before
      || snap().energy === 97
      || g.logs.some(l => l.includes('回复') || l.includes('获得 1 张【初始攻击】'));
    expect(observed).toBe(true);
    // 战斗可正常收尾（不崩不悬挂）
    BattleSession.commands.flee();
    await drain(100);
    expect(g.battleActive).toBe(false);
  });
});
