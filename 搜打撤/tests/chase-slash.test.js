/* 追斩（cc-chase-slash，2026-09-10 需求）真实战斗实打：
 * 2 费稀有武术——「攻（+0），本回合每打出一张其他武术，费用-1」。
 * 覆盖：入库字段 / 原价与折价结算（能量差） / 伤害=攻击力 / 回合开始折扣清零。 */
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

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v6：追斩入库）
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
const foeDef = () => ({ id: 'infantry', name: '追斩靶子', hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
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
    if (!s.busy && s.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = snap();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
  }
  return snap();
}

// 只打仍在手牌中的同名卡第一张
async function playByName(g, name) {
  const s = snap();
  const entry = g.ownedCards.find(o => o.card.name === name && s.hand.includes(o.uid));
  expect(entry, `手牌中应有【${name}】`).toBeTruthy();
  BattleSession.commands.playCard(entry.uid, 0);
  return drain();
}

const chase = () => C.all().find(c => c.id === 'cc-chase-slash');
const sha = () => C.all().find(c => c.name === '初始攻击');

describe('追斩（cc-chase-slash）', () => {
  it('卡牌已入库：2费稀有武术，攻（+0）词条', () => {
    const c = chase();
    expect(c).toBeTruthy();
    expect(c.cost).toBe(2);
    expect(c.rarity).toBe('稀有');
    expect(c.type).toBe('武术');
    expect(c.dmg).toBe(0);
    expect(c.dmgType).toBe('attack');
  });

  it('原价与逐张折价：随本回合武术数 2→1→0 费，伤害均为攻击力', async () => {
    const g = makeGame([sha(), chase(), chase(), sha(), chase()]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '追斩测试' });
    await drain();

    // n=0：原价 2 费，攻（+0）→ 5 点（攻击力 5）
    let hp = foeHp();
    await playByName(g, '初始攻击');           // -5，n→1
    expect(energy()).toBe(99 - 1);

    // n=1：1 费
    hp = foeHp();
    await playByName(g, '追斩');
    expect(energy()).toBe(98 - 1);
    expect(foeHp()).toBe(hp - 5);

    // n=2（先前的追斩也算「其他武术」）：0 费，能量不动
    hp = foeHp();
    await playByName(g, '追斩');
    expect(energy()).toBe(97);
    expect(foeHp()).toBe(hp - 5);

    // n=3 → 0 费；再打一张武术 n→4，追斩仍 0 费
    hp = foeHp();
    await playByName(g, '初始攻击');           // -5
    expect(energy()).toBe(96);
    await playByName(g, '追斩');
    expect(energy()).toBe(96);
    expect(foeHp()).toBe(hp - 10);             // 初始攻击 5 + 追斩 5

    BattleSession.commands.flee();
  });

  it('新回合开始折扣清零：首张追斩回到 2 费', async () => {
    const g = makeGame([chase(), chase(), sha()]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '追斩测试' });
    await drain();
    await playByName(g, '初始攻击');           // n→1
    await playByName(g, '追斩');               // 1 费
    BattleSession.commands.endTurn();
    await drain(500);
    expect(snap().foes[0].dead || energy() === 99).toBe(true);   // 能量回满=新回合已开始
    const hp = foeHp();
    await playByName(g, '追斩');               // 新回合 n=0 → 2 费
    expect(energy()).toBe(97);
    expect(foeHp()).toBe(hp - 5);
    BattleSession.commands.flee();
  });
});
