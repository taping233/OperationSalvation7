/* 余烬爆裂（cc-ember-burst）+ 腐化之种（cc-rot-seed，2026-09-16 需求批次 v19）真实战斗实打：
 * 2 费稀有法术——「对全体敌人造成 2 点法术伤害；若击杀敌人，再施放一次」；
 * 1 费史诗法术——「对 1 名敌人附加 2 层中毒；其死亡时，将中毒层数转移给另一名敌人」。
 * 覆盖：入库字段 / 随机池资格 / 实打 AOE 与击杀连锁 / 中毒死亡转移。 */
import { describe, it, expect, beforeAll } from 'vitest';

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
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v19：余烬爆裂+腐化之种入库）
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
const foeDef = (name, hp) => ({ id: 'infantry', name: name || '靶子', hp: hp || 99999, atk: 1 });
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

const ember = () => C.all().find(c => c.id === 'cc-ember-burst');
const rot = () => C.all().find(c => c.id === 'cc-rot-seed');
// 击杀补刀用的最便宜固定伤（不算法伤加成）：直接内联卡面，与熔岩爆破测试的构造同口径
const shot = () => ({ id: 'test-shot', name: '补刀射击', cost: 0, rarity: '古朴', type: '武术', dmg: 2, dmgType: 'fixed', desc: '造成 2 点伤害。' });

async function playOwned(g, card, targetIdx = 0) {
  const entry = g.ownedCards.find(o => o.card.name === card.name);
  expect(entry, `背包中应有【${card.name}】`).toBeTruthy();
  BattleSession.commands.playCard(entry.uid, targetIdx);
  return drain();
}

describe('余烬爆裂 + 腐化之种', () => {
  it('卡牌已入库：余烬爆裂2费稀有法术2′；腐化之种1费史诗法术', () => {
    const a = ember(), b = rot();
    expect(a).toBeTruthy();
    expect(a.cost).toBe(2);
    expect(a.rarity).toBe('稀有');
    expect(a.type).toBe('法术');
    expect(a.dmg).toBe(2);
    expect(a.dmgType).toBe('spell');
    expect(b).toBeTruthy();
    expect(b.cost).toBe(1);
    expect(b.rarity).toBe('史诗');
    expect(b.type).toBe('法术');
  });

  it('两张卡都进随机获取池（稀有/史诗法术正常掉落）', () => {
    expect(C.isRandomObtainable(ember())).toBe(true);
    expect(C.isRandomObtainable(rot())).toBe(true);
  });

  it('实打：余烬爆裂 AOE 各 4 伤；击杀残血敌人后再对所有存活者施放一次', async () => {
    const g = makeGame([ember()]);
    // 靶子A 血量 4（恰被第一段 2+法伤2 打死），靶子B 满血吃两段
    BattleSession.start(g, [foeDef('残血靶', 4), foeDef('厚血靶')], { isBoss: false, name: '爆裂测试' });
    await drain();
    const hpB0 = snap().foes[1].hp;

    await playOwned(g, ember(), 0);
    expect(snap().foes[0].dead).toBe(true);                       // 残血靶被第一段击杀
    expect(snap().foes[1].hp).toBe(hpB0 - 8);                     // 厚血靶：4（首段）+ 4（再施放）
    expect(g.logs.some(l => l.includes('击杀敌人，再施放一次'))).toBe(true);
    expect(snap().energy).toBe(97);                               // 99 - 2 费
  });

  it('实打：未击杀时不重复施放（单体各只吃一段）', async () => {
    const g = makeGame([ember()]);
    BattleSession.start(g, [foeDef('厚血靶')], { isBoss: false, name: '爆裂测试' });
    await drain();
    const hp0 = snap().foes[0].hp;

    await playOwned(g, ember(), 0);
    expect(snap().foes[0].hp).toBe(hp0 - 4);                      // 只有一段 4 伤
    expect(g.logs.some(l => l.includes('再施放一次'))).toBe(false);
  });

  it('实打：腐化之种附加 2 层中毒；目标死亡时层数转移给另一名敌人', async () => {
    const g = makeGame([rot(), shot()]);
    // 靶子A 血量 2（中毒后被补刀击杀），靶子B 承接转移
    BattleSession.start(g, [foeDef('中毒靶', 2), foeDef('承接靶')], { isBoss: false, name: '腐化测试' });
    await drain();

    await playOwned(g, rot(), 0);
    expect(snap().foes[0].status.poison).toBe(2);                 // 中毒靶挂 2 层

    // 同回合用固定伤补刀（毒尚未结算，2 层原样转移）
    await playOwned(g, shot(), 0);
    expect(snap().foes[0].dead).toBe(true);
    expect(snap().foes[1].status.poison).toBe(2);                 // 承接靶获得 2 层中毒
    expect(g.logs.some(l => l.includes('腐化之种') && l.includes('2 层中毒转移给'))).toBe(true);
  });

  it('对照：中毒来自其他卡（毒箭）时，击杀不触发转移', async () => {
    const arrow = C.all().find(c => c.id === 'tt3-venom-arrow');
    expect(arrow, '毒箭应在卡库中').toBeTruthy();
    const g = makeGame([arrow]);
    // 靶子A 血量 4＝攻击伤害（攻5-1），带毒死于直伤
    BattleSession.start(g, [foeDef('中毒靶', 4), foeDef('承接靶')], { isBoss: false, name: '对照测试' });
    await drain();

    await playOwned(g, arrow, 0);
    expect(snap().foes[0].dead).toBe(true);
    // 「附加 1 层中毒」子句在目标死亡后回落到下一个存活敌人（既有引擎规则）＝1 层，
    // 但不应出现「腐化之种」的层数转移日志
    expect(snap().foes[1].status.poison || 0).toBe(1);
    expect(g.logs.some(l => l.includes('中毒转移给'))).toBe(false);
  });
});
