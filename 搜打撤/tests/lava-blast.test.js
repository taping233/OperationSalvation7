/* 熔岩爆破（cc-lava-blast）+ 二次爆炸（cc-double-boom，2026-09-10 需求）真实战斗实打：
 * 2 费稀有法术——「造成9点法术伤害，获得1张「二次爆炸」」；
 * 1 费衍生法术——「对所有敌人造成 3 点法术伤害」。
 * 覆盖：入库字段 / token 不进随机池 / 实打伤害与 AOE / 衍生卡战后消散不入背包。 */
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
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v8：熔岩爆破+二次爆炸入库）
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
const foeDef = (name) => ({ id: 'infantry', name: name || '爆破靶子', hp: 99999, atk: 1 });
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

async function playByName(g, name) {
  const s = snap();
  const entry = g.ownedCards.find(o => o.card.name === name && s.hand.includes(o.uid));
  if (entry) {                                   // 背包卡（含熔岩爆破）
    BattleSession.commands.playCard(entry.uid, 0);
    return drain();
  }
  const uid = s.hand[0];                         // 衍生 token 不在背包：取手牌里的临时卡
  expect(uid, `手牌中应有【${name}】`).toBeTruthy();
  BattleSession.commands.playCard(uid, 0);
  return drain();
}

const lava = () => C.all().find(c => c.id === 'cc-lava-blast');
const boom = () => C.all().find(c => c.id === 'cc-double-boom');

describe('熔岩爆破 + 二次爆炸', () => {
  it('卡牌已入库：熔岩爆破2费稀有法术9伤；二次爆炸1费衍生法术3伤', () => {
    const a = lava(), b = boom();
    expect(a).toBeTruthy();
    expect(a.cost).toBe(2);
    expect(a.rarity).toBe('稀有');
    expect(a.dmg).toBe(9);
    expect(a.dmgType).toBe('spell');
    expect(b).toBeTruthy();
    expect(b.cost).toBe(1);
    expect(b.rarity).toBe('衍生');
    expect(b.dmg).toBe(3);
    expect(b.dmgType).toBe('spell');
  });

  it('衍生 token 不进随机获取池', () => {
    expect(C.isRandomObtainable(boom())).toBe(false);
    expect(C.isRandomObtainable(lava())).toBe(true);
  });

  it('实打：熔岩爆破单体11伤并置入二次爆炸；二次爆炸对全体各5伤', async () => {
    const g = makeGame([lava()]);
    BattleSession.start(g, [foeDef('靶子A'), foeDef('靶子B')], { isBoss: false, name: '爆破测试' });
    await drain();
    expect(snap().foes.length).toBe(2);
    const hpA = snap().foes[0].hp, hpB = snap().foes[1].hp;

    // 打出熔岩爆破（拖到靶子A）：9+法伤2 = 11，并获得二次爆炸
    BattleSession.commands.playCard(g.ownedCards[0].uid, 0);
    await drain();
    expect(snap().foes[0].hp).toBe(hpA - 11);
    expect(snap().foes[1].hp).toBe(hpB);            // 单体：B 不受伤
    expect(snap().energy).toBe(97);
    expect(g.logs.some(l => l.includes('获得 1 张【二次爆炸】'))).toBe(true);
    expect(snap().hand.length).toBeGreaterThan(0);

    // 打出置入的二次爆炸（AOE）：全体 3+法伤2 = 5
    // （手牌里另有背包砸击初始牌常驻（2026-09-13 留言），按名字定位二次爆炸）
    const uid2 = snap().hand.find(u => { const o = viewApi.findCard(u); return o && o.card.name === '二次爆炸'; });
    BattleSession.commands.playCard(uid2, 0);
    await drain();
    expect(snap().foes[0].hp).toBe(hpA - 16);       // 11 + 5
    expect(snap().foes[1].hp).toBe(hpB - 5);        // AOE：B 也吃 5
    expect(snap().energy).toBe(96);
  });

  it('衍生 token 战后消散：不进背包存档', async () => {
    const g = makeGame([lava()]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '爆破测试' });
    await drain();
    BattleSession.commands.playCard(g.ownedCards[0].uid, 0);
    await drain();
    expect(snap().hand.length).toBeGreaterThan(0);  // 战斗中二次爆炸在手牌
    BattleSession.commands.flee();
    await drain(100);
    expect(g.battleActive).toBe(false);
    expect(g.ownedCards.length).toBe(1);            // 背包仍只有熔岩爆破
    expect(g.ownedCards[0].card.name).toBe('熔岩爆破');
  });
});
