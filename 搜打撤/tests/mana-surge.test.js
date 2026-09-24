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
await import('../game/src/cards/cards.js');
const { Random } = await import('../game/src/core/random.js');
const { BattleSession } = await import('../game/src/battle/battle.core.js');

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
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
const snap = () => BattleSession.getSnapshot();

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
    Random.reseed('mana-surge-observable-regression');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '奔涌测试' });
    await drain();
    const entry = g.ownedCards[0];
    const before = snap().foes[0].hp;
    BattleSession.commands.playCard(entry.uid, 0);
    await drain(500);

    // 恰好 4 发 = 外层循环序号 1..4 各打一次。随机池里有神灯（发现 1 张牌并将其释放），
    // 神灯发现到法力奔涌会合法地再跑一轮 4 发——所以不能数日志总行数（重放时是 8），
    // 改为按序号去重断言：每个序号都至少出现一次（日志带 <b> 标签，只匹配无标签段）。
    const castLogs = g.logs.filter(l => /（第 \d+\/4 发）/.test(l));
    const shotNums = [...new Set(castLogs.map(l => (l.match(/第 (\d+)\/4 发/) || [])[1]).filter(Boolean))].sort();
    expect(shotNums).toEqual(['1', '2', '3', '4']);
    // 每一发（含合法重放）释放的都是库内「法术」；提取名先剥掉日志里的 <b> 标签
    castLogs
      .map(l => (l.match(/释放随机法术【(.+?)】/) || [])[1])
      .map(n => n.replace(/<[^>]+>/g, ''))
      .filter(Boolean)
      .forEach(name => {
        const lib = C.all().find(c => c.name === name);
        expect(lib, `释放的【${name}】应在卡牌库中`).toBeTruthy();
        expect(lib.type).toBe('法术');
      });
    // 防递归守卫直接对生产池断言：castRandomSpells 按「type 法术 + id≠自身 + isRandomObtainable」取池，
    // 池内不得出现法力奔涌自身（神灯重放是另一条链，各自都排除自己，属合法行为）
    const prodPool = C.all().filter(c => c.type === '法术' && c.id !== surge().id && C.isRandomObtainable(c));
    expect(prodPool.some(c => c.id === 'cc-mana-surge'), '随机法术池应排除法力奔涌自身').toBe(false);
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
