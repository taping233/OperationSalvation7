/* 背包技能按钮形态（2026-09-16 老板定向按钮化；2026-10-02 老板：砸击换成技能，按五职业分化）：
 *   ① 不再向手牌自动置入「背包砸击」常驻令牌（2026-09-13 的做法作废）——手牌检测
 *      （末手判定/手牌上限/补牌到 N 张/消耗所有手牌）天然不含砸击；
 *   ② 战斗界面手牌左侧背包图案按钮（bt-slam-btn）——按钮本体是声明式模板，
 *      这里实打它的命令链路：bagSlam 进入点选（有目标技能）→ slamPending → resolveSlam 结算；
 *   ③ 五职业分化口径（单源 battle.slam-skill.js）：侠客(刺客) 1 费 2 固定伤 / 战士 2 费攻击一次 /
 *      法师 1 费随机获取 / 降临者 2 费火球 / 牧师 1 费圣疗与惩戒每次使用后交替；
 *      未知职业兜底=战士口径。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, commands, viewApi } = await import('../game/src/battle/core/battle.core.js');
const { enqueueFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const { set$energy } = await import('../game/src/battle/runtime/battle.runtime.session.js');

const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

let uidSeq = 0;
function makeGame(cards, cls = '侠客', hp = 99999) {
  const logs = [];
  const g = {
    ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp, maxHp: 99999, atk: 5, spellPower: 2, coins: 0,
    myClass: cls, characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {},
    onBattleEnd() {},
  };
  return g;
}
const foeOf = (name, hp = 99999) => ({ id: 'infantry', name, hp, atk: 1 });
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
  it('前摇中能量不足取消时不扣费、不占次数，补能后可再次使用', async () => {
    const g = makeGame([], '侠客');
    BattleSession.start(g, [foeOf('取消靶')], { isBoss: false, name: '前摇取消测试' });
    await drain();
    let release;
    const heldFeedback = new Promise(resolve => { release = resolve; });
    enqueueFeedback(() => heldFeedback);
    await tick();
    commands.bagSlam();
    commands.resolveSlam(0);
    await tick();
    expect(snap().busy).toBe(true);
    set$energy(0);
    release();
    await drain();
    expect(commands.slamSkill().used).toBe(false);
    expect(snap().foes[0].hp).toBe(99999);
    expect(snap().energy).toBe(0);
    set$energy(snap().maxEnergy);
    commands.bagSlam();
    commands.resolveSlam(0);
    await drain();
    expect(commands.slamSkill().used).toBe(true);
    expect(snap().foes[0].hp).toBe(99997);
    commands.flee();
    await drain(100);
  });

  it('取消与无效目标不占次数，成功使用后同回合禁止重复，下回合及新战斗复位', async () => {
    const g = makeGame([], '侠客');
    BattleSession.start(g, [foeOf('次数靶')], { isBoss: false, name: '次数测试' });
    await drain();
    const initialEnergy = snap().energy;
    commands.bagSlam();
    commands.bagSlam();
    expect(commands.slamSkill().used).toBe(false);
    commands.bagSlam();
    commands.resolveSlam(99);
    expect(commands.slamSkill().used).toBe(false);
    expect(snap().energy).toBe(initialEnergy);
    commands.resolveSlam(0);
    await drain();
    expect(commands.slamSkill().used).toBe(true);
    const usedHp = snap().foes[0].hp;
    commands.bagSlam();
    commands.resolveSlam(0);
    await drain();
    expect(snap().foes[0].hp).toBe(usedHp);
    expect(snap().energy).toBe(initialEnergy - 1);
    commands.endTurn();
    await drain();
    expect(commands.slamSkill().used).toBe(false);
    commands.bagSlam();
    commands.resolveSlam(0);
    await drain();
    expect(snap().foes[0].hp).toBe(usedHp - 2);
    expect(commands.slamSkill().used).toBe(true);
    commands.flee();
    await drain(100);
    BattleSession.start(g, [foeOf('新战斗靶')], { isBoss: false, name: '次数复位测试' });
    await drain();
    expect(commands.slamSkill().used).toBe(false);
    commands.bagSlam();
    commands.resolveSlam(0);
    await drain();
    expect(commands.slamSkill().used).toBe(true);
    expect(snap().foes[0].hp).toBe(99997);
    commands.flee();
    await drain(100);
  });

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

  it('侠客（刺客）刺击：固定 2 点伤害（不吃攻 5/法伤 2 加成），扣 1 能量', async () => {
    const g = makeGame([], '侠客');
    BattleSession.start(g, [foeOf('刺击靶')], { isBoss: false, name: '按钮测试' });
    await drain();
    const hp0 = snap().foes[0].hp;
    const e0 = snap().energy;

    commands.bagSlam();
    expect(snap().slamPending).toBe(true);
    commands.resolveSlam(0);
    await drain();
    expect(snap().foes[0].hp).toBe(hp0 - 2);   // 固定伤害：不受 atk 5 / spellPower 2 影响
    expect(snap().energy).toBe(e0 - 1);
    expect(g.logs.some(l => l.includes('刺击</b> → 刺击靶') && l.includes('点固定伤害（-1 能量）'))).toBe(true);
    expect(snap().slamPending).toBe(false);
    BattleSession.commands.flee();
    await drain(100);
  });

  it('战士猛击：攻击一次（伤害=攻击力 5），扣 2 能量', async () => {
    const g = makeGame([], '战士');
    BattleSession.start(g, [foeOf('猛击靶')], { isBoss: false, name: '按钮测试' });
    await drain();
    const hp0 = snap().foes[0].hp;
    const e0 = snap().energy;

    commands.bagSlam();
    commands.resolveSlam(0);
    await drain();
    expect(snap().foes[0].hp).toBe(hp0 - 5);   // 攻击结算链：amount 0 + 攻 5（不吃法伤加成）
    expect(snap().energy).toBe(e0 - 2);
    expect(g.logs.some(l => l.includes('猛击</b> → 猛击靶') && l.includes('点攻击伤害（-2 能量）'))).toBe(true);
    BattleSession.commands.flee();
    await drain(100);
  });

  it('未知职业兜底=战士口径：攻击一次（伤害=攻击力），扣 2 能量', async () => {
    const g = makeGame([], null);
    BattleSession.start(g, [foeOf('兜底靶')], { isBoss: false, name: '按钮测试' });
    await drain();
    const hp0 = snap().foes[0].hp;
    const e0 = snap().energy;

    commands.bagSlam();
    commands.resolveSlam(0);
    await drain();
    expect(snap().foes[0].hp).toBe(hp0 - 5);
    expect(snap().energy).toBe(e0 - 2);
    BattleSession.commands.flee();
    await drain(100);
  });

  it('法师搜刮：不进点选直接随机获得一张卡入手牌，扣 1 能量', async () => {
    const g = makeGame([], '法师');
    BattleSession.start(g, [foeOf('搜刮靶')], { isBoss: false, name: '按钮测试' });
    await drain();
    const e0 = snap().energy;
    const n0 = snap().hand.length;

    commands.bagSlam();
    expect(snap().slamPending).toBe(false);   // 无目标技能：不进点选直接结算
    await drain();
    const e1 = snap().energy;
    expect([e0 - 1, e0]).toContain(e1);   // 抽到「阿猫的礼物」时 onAcquire 回 1 能量（随机获取链自带）
    expect(snap().hand.length).toBeGreaterThanOrEqual(n0 + 1);
    expect(g.logs.some(l => l.includes('搜刮') && l.includes('随机获得'))).toBe(true);
    BattleSession.commands.flee();
    await drain(100);
  });

  it('降临者火球：4 点法伤（+法伤加成 2 = 6），扣 2 能量', async () => {
    const g = makeGame([], '降临者');
    BattleSession.start(g, [foeOf('火球靶')], { isBoss: false, name: '按钮测试' });
    await drain();
    const hp0 = snap().foes[0].hp;
    const e0 = snap().energy;

    commands.bagSlam();
    commands.resolveSlam(0);
    await drain();
    expect(snap().foes[0].hp).toBe(hp0 - 6);   // 4 + 法伤加成 2（深渊降焰同款 SPELL 结算）
    expect(snap().energy).toBe(e0 - 2);
    expect(g.logs.some(l => l.includes('火球</b>施放 1 次火球 → 火球靶') && l.includes('点法术伤害（-2 能量）'))).toBe(true);
    BattleSession.commands.flee();
    await drain(100);
  });

  it('牧师圣疗与惩戒每次使用后交替，取消选敌不切换，每回合只能使用一次', async () => {
    const g = makeGame([], '牧师', 10);
    BattleSession.start(g, [foeOf('惩戒靶')], { isBoss: false, name: '按钮测试' });
    await drain();
    const e0 = snap().energy;

    commands.bagSlam();   // 圣疗无目标：直接结算
    expect(snap().slamPending).toBe(false);
    await drain();
    expect(g.hp).toBe(13);
    expect(snap().energy).toBe(e0 - 1);
    expect(g.logs.some(l => l.includes('圣疗') && l.includes('翻面') && l.includes('惩戒'))).toBe(true);

    commands.bagSlam();
    expect(snap().slamPending).toBe(false);
    expect(snap().energy).toBe(e0 - 1);
    expect(commands.slamSkill().used).toBe(true);
    commands.endTurn();
    await drain();
    const nextEnergy = snap().energy;
    expect(commands.slamSkill().used).toBe(false);
    commands.bagSlam();   // 下一回合翻面后：惩戒=点选敌人
    expect(snap().slamPending).toBe(true);
    commands.bagSlam();   // 取消选敌不切换、不占次数
    expect(commands.slamSkill()).toMatchObject({ name: '惩戒', used: false });
    commands.bagSlam();
    commands.resolveSlam(0);
    await drain();
    expect(snap().foes[0].hp).toBe(99999 - 5);   // 3 + 法伤加成 2
    expect(snap().energy).toBe(nextEnergy - 1);   // 下一回合惩戒消耗 1 费
    expect(commands.slamSkill()).toMatchObject({ name: '圣疗', used: true, needsTarget: false });
    commands.bagSlam();
    expect(snap().energy).toBe(nextEnergy - 1);
    commands.endTurn();
    await drain();
    const hpBeforeHeal = g.hp;
    commands.bagSlam();
    await drain();
    expect(g.hp).toBe(hpBeforeHeal + 3);
    expect(commands.slamSkill()).toMatchObject({ name: '惩戒', used: true, needsTarget: true });
    BattleSession.commands.flee();
    await drain(100);
    BattleSession.start(g, [foeOf('新战斗靶')], { isBoss: false, name: '技能复位测试' });
    await drain();
    expect(commands.slamSkill()).toMatchObject({ name: '圣疗', used: false });
    BattleSession.commands.flee();
    await drain(100);
  });
});
