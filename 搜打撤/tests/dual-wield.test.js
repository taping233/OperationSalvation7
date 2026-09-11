/* 二刀流（cc-dual-wield，2026-09-10 需求）真实战斗实打：
 * 1 费稀有武术——「发现一张武术卡并额外获得1张复制」。
 * 覆盖：入库字段 / 打出后三选一发现武术 / 本体+复制共 2 张同名置入手牌。 */
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
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v10：二刀流入库）
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
const foeDef = () => ({ id: 'infantry', name: '双刀靶子', hp: 99999, atk: 1 });
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

const dual = () => C.all().find(c => c.id === 'cc-dual-wield');

describe('二刀流（cc-dual-wield）', () => {
  it('卡牌已入库：1费稀有武术', () => {
    const c = dual();
    expect(c).toBeTruthy();
    expect(c.cost).toBe(1);
    expect(c.rarity).toBe('稀有');
    expect(c.type).toBe('武术');
  });

  it('打出 → 三选一发现武术 → 本体+复制共 2 张同名置入手牌', async () => {
    const g = makeGame([dual()]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '双刀测试' });
    await drain();
    BattleSession.commands.playCard(g.ownedCards[0].uid, undefined);   // 无对敌效果：直接打出
    const end = await drain(500);

    // 手牌应为 2 张发现的武术（同名，×2 堆叠展示）
    expect(snap().hand.length).toBe(2);
    const cards = snap().hand.map(u => viewApi.findCard(u)).filter(Boolean);
    expect(cards[0].card.name).toBe(cards[1].card.name);   // 复制=同名
    expect(cards[0].card.type).toBe('武术');
    expect(g.logs.some(l => l.includes('并额外获得 1 张复制'))).toBe(true);
    // 发现的是候选项之一（三选一面板第一项），且为武术
    expect(g.logs.some(l => l.includes('发现 1 张【武术】卡牌'))).toBe(true);
    BattleSession.commands.flee();
    await drain(100);
    expect(g.battleActive).toBe(false);
    expect(g.ownedCards.length).toBe(1);                   // 临时卡战后消散，背包不变
  });
});
