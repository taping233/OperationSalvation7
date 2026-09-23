/* 背包砸击按钮形态（2026-09-16 老板定向）：
 *   ① 不再向手牌自动置入「背包砸击」常驻令牌（2026-09-13 的做法作废）——手牌检测
 *      （末手判定/手牌上限/补牌到 N 张/消耗所有手牌）天然不含砸击；
 *   ② 战斗界面手牌左侧新增背包图案按钮（bt-slam-btn）——按钮本体是声明式模板，
 *      这里实打它的命令链路：bagSlam 进入点选 → slamPending → resolveSlam 结算。
 * 覆盖：开局手牌干净 / 点选态开关 / 砸击伤害与能量扣费（固定伤不吃攻法加成）。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, commands, viewApi } = await import('../game/src/battle/battle.core.js');

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

function handCardNames(s) {
  return s.hand.map(u => { const o = viewApi.findCard(u); return o && o.card.name; }).filter(Boolean);
}

describe('背包砸击按钮形态', () => {
  it('开局手牌不再有「背包砸击」令牌，手牌=随身战斗卡', async () => {
    const sha = C.all().find(c => c.id === 'starter-attack');
    const g = makeGame([sha]);
    BattleSession.start(g, [{ id: 'infantry', name: '靶子', hp: 99999, atk: 1 }], { isBoss: false, name: '按钮测试' });
    await drain();
    const names = handCardNames(snap());
    expect(names).not.toContain('背包砸击');
    expect(names).toContain('初始攻击');
    expect(snap().slamPending).toBe(false);
    BattleSession.commands.flee();
    await drain(100);
  });

  it('bagSlam 进入点选（slamPending），再点一次取消；期间不扣能量', async () => {
    const g = makeGame([]);
    BattleSession.start(g, [{ id: 'infantry', name: '靶子', hp: 99999, atk: 1 }], { isBoss: false, name: '按钮测试' });
    await drain();
    const e0 = snap().energy;

    commands.bagSlam();
    expect(snap().slamPending).toBe(true);
    expect(snap().energy).toBe(e0);

    commands.bagSlam();   // 再点一次 = 取消
    expect(snap().slamPending).toBe(false);
    expect(snap().energy).toBe(e0);
    BattleSession.commands.flee();
    await drain(100);
  });

  it('砸击结算：固定 4 点伤害（不吃攻 5/法伤 2 加成），扣 2 能量', async () => {
    const g = makeGame([]);
    BattleSession.start(g, [{ id: 'infantry', name: '砸击靶', hp: 99999, atk: 1 }], { isBoss: false, name: '按钮测试' });
    await drain();
    const hp0 = snap().foes[0].hp;
    const e0 = snap().energy;

    commands.bagSlam();
    expect(snap().slamPending).toBe(true);
    commands.resolveSlam(0);
    await drain();
    expect(snap().foes[0].hp).toBe(hp0 - 4);   // 固定伤害：不受 atk 5 / spellPower 2 影响
    expect(snap().energy).toBe(e0 - 2);
    expect(g.logs.some(l => l.includes('砸向 砸击靶') && l.includes('点固定伤害（-2 能量）'))).toBe(true);
    expect(snap().slamPending).toBe(false);
    BattleSession.commands.flee();
    await drain(100);
  });
});
