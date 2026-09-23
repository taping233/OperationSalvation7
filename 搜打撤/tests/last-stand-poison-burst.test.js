/* 破釜沉舟（cc-last-stand）+ 毒爆（cc-poison-burst，2026-09-16 需求批次 v20）真实战斗实打：
 * 2 费稀有武术——「攻（+3）；若本牌为最后一张手牌，效果触发 2 次」；
 * 2 费史诗法术——「立即触发 2 次目标全部毒伤」。
 * 另回归验证：末手判定修正（背包砸击常驻令牌不计入手牌）让急行军末手条款重新可用。
 * 覆盖：入库字段 / 随机池资格 / 末手双倍与非末手单倍 / 毒伤引爆次数与层数保留。 */
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
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v20：破釜沉舟+毒爆入库）
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

const lastStand = () => C.all().find(c => c.id === 'cc-last-stand');
const poisonBurst = () => C.all().find(c => c.id === 'cc-poison-burst');
const rotSeed = () => C.all().find(c => c.id === 'cc-rot-seed');
// 垫手牌用的最便宜固定伤（非末手对照）
const shot = () => ({ id: 'test-shot', name: '垫手射击', cost: 0, rarity: '古朴', type: '武术', dmg: 2, dmgType: 'fixed', desc: '造成 2 点伤害。' });

async function playOwned(g, card, targetIdx = 0) {
  const entry = g.ownedCards.find(o => o.card.name === card.name);
  expect(entry, `背包中应有【${card.name}】`).toBeTruthy();
  BattleSession.commands.playCard(entry.uid, targetIdx);
  return drain();
}

describe('破釜沉舟 + 毒爆', () => {
  it('卡牌已入库：破釜沉舟2费稀有武术攻+3；毒爆2费史诗法术', () => {
    const a = lastStand(), b = poisonBurst();
    expect(a).toBeTruthy();
    expect(a.cost).toBe(2);
    expect(a.rarity).toBe('稀有');
    expect(a.type).toBe('武术');
    expect(a.dmg).toBe(3);
    expect(a.dmgType).toBe('attack');
    expect(b).toBeTruthy();
    expect(b.cost).toBe(2);
    expect(b.rarity).toBe('史诗');
    expect(b.type).toBe('法术');
  });

  it('两张卡都进随机获取池', () => {
    expect(C.isRandomObtainable(lastStand())).toBe(true);
    expect(C.isRandomObtainable(poisonBurst())).toBe(true);
  });

  it('实打：只剩背包砸击常驻令牌时视为末手，攻（+3）触发 2 次＝16 伤', async () => {
    const g = makeGame([lastStand()]);
    BattleSession.start(g, [foeDef('末手靶')], { isBoss: false, name: '末手测试' });
    await drain();
    const hp0 = snap().foes[0].hp;

    await playOwned(g, lastStand(), 0);
    expect(snap().foes[0].hp).toBe(hp0 - 16);   // 2 × (3 + 攻5)，双段
    expect(g.logs.some(l => l.includes('本牌是最后一张手牌，效果触发 2 次'))).toBe(true);
    expect(snap().energy).toBe(97);             // 双倍是效果翻倍，不是再扣一次费
  });

  it('实打：手牌里还有其他牌时不触发末手，只吃一段 8 伤', async () => {
    const g = makeGame([lastStand(), shot()]);
    BattleSession.start(g, [foeDef('非末手靶')], { isBoss: false, name: '对照测试' });
    await drain();
    const hp0 = snap().foes[0].hp;

    await playOwned(g, lastStand(), 0);
    expect(snap().foes[0].hp).toBe(hp0 - 8);    // 单段 3 + 攻5
    // 出牌层的末手重跑日志不应出现（识别层的提示句会打，但那是另一条）
    expect(g.logs.some(l => l.includes('本牌是最后一张手牌，效果触发 2 次'))).toBe(false);
  });

  it('实打：毒爆立即引爆 2 次＝2×全部层数，层数保留', async () => {
    const g = makeGame([rotSeed(), poisonBurst()]);
    BattleSession.start(g, [foeDef('中毒靶')], { isBoss: false, name: '毒爆测试' });
    await drain();
    const hp0 = snap().foes[0].hp;

    await playOwned(g, rotSeed(), 0);           // 腐化之种挂 2 层中毒
    expect(snap().foes[0].status.poison).toBe(2);

    await playOwned(g, poisonBurst(), 0);       // 毒爆：2 次引爆 × 2 层 = 4 点固定
    expect(snap().foes[0].hp).toBe(hp0 - 4);
    expect(snap().foes[0].status.poison).toBe(2);   // 中毒不衰减，层数保留
    expect(g.logs.some(l => l.includes('毒伤引爆 2 次'))).toBe(true);   // 日志数值带加粗标签，只断言句式
    expect(snap().energy).toBe(96);             // 99 - 1(腐化之种) - 2(毒爆)
  });
});
