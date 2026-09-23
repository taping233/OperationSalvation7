/* 龙巢回归（2026-09-18 三局实测修复）：
 * 1. 移动：直线图改「点击下一格」推进（原禁用条件把出发格永禁、其余只有当前格可点——开局无格可点）
 * 2. pickNestBoss 此前未定义：startNestBattle 一进来就 ReferenceError，龙巢任何战斗都开不起来
 * 3. 战后链：战斗结束走总线；龙巢订阅负责结算与推进，一图战后流程对龙巢让位
 * 4. 心模式：心数按最终伤害折算（含攻击力），而非卡面基础伤害值 */
import { describe, it, expect, beforeAll } from 'vitest';

/* jsdom 的 canvas 无 2D 上下文：game.session 顶层会建画布，先垫一个万能 stub */
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === 'canvas') return { width: 300, height: 150 };
    return () => ctxStub;
  },
  set: () => true,
});
window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
const __cv = document.createElement('canvas');
__cv.id = 'game';
document.body.appendChild(__cv);

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = { rules: { battleEnergy: 2, battleHandMax: 99, bossDeckSize: 10, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } };
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');            // UI.init 需要的 overlay 骨架
await import('../game/src/hub/base.js');          // SDT.Base（boot-order 同款绑定）
await import('../game/src/run/game.session.js');
await import('../game/src/run/game.nest.js');
const { BattleSession, configureBattleRenderer } = await import('../game/src/battle/battle.core.js');
configureBattleRenderer(() => {});
window.SDT.Nest.bindBattleStart(BattleSession.start);
const C = window.SDT.Cards;

beforeAll(() => {
  // UI 层在 jsdom 里没有 index.html 骨架：把界面方法换成无操作/收集器，只测游戏逻辑
  const UI = window.SDT.UI;
  UI.init = () => {};
  UI.showOverlay = () => {};
  UI.hideOverlay = () => {};
  UI.refresh = () => {};
  UI.act = () => {};
  UI.log = (m) => { (window.__uiLog = window.__uiLog || []).push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); };
  C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
  const B = window.SDT.Base;
  B.data.nestUnlocked = true;
  B.data.runes = [];
  B.save();
});

const tick = () => new Promise(r => setTimeout(r, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
const snap = () => BattleSession.getSnapshot();
const drain = async (max = 200) => {
  for (let i = 0; i < max; i++) {
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
};

function prepRun() {
  const g = window.SDT.game;
  g.nestActive = true; g.nestPos = 1; g.nestEquipped = []; g.nestRunes = [];
  g.nestBoss = null; g.nestBossName = '测试巢主'; g.nestTargetedBox = 0;
  g.hp = 60; g.maxHp = 60; g.atk = 99;
  g.cardBox = [
    { id: 'd1', name: '穿刺', cost: 1, rarity: '古朴', type: '武术', dmg: 0, dmgType: 'attack', desc: '攻（+2），附加破甲，无视护甲。' },
    ...Array.from({ length: 16 }, (_, i) => ({ id: 'sha' + i, name: '初始攻击', cost: 1, rarity: '初始', type: '武术', dmg: 0, dmgType: 'attack', desc: '造成等同于攻击力的伤害。' })),
  ];
  return g;
}

describe('龙巢回归', () => {
  it('startNestBattle 不再因 pickNestBoss 未定义而崩溃，且整盒成库、不进编组', async () => {
    const g = prepRun();
    const def = { id: 'nest-sand-elem', name: '沙暴元素', hearts: 8, atk: 8, heartsMode: true, reward: { coins: 3, chests: [], runes: ['small'] } };
    await window.SDT.Nest.startNestBattle(def);
    const s = await drain();
    expect(s.deckSelection, '龙巢战斗不应进 BOSS 编组').toBeFalsy();
    expect(g.nestBoss, 'pickNestBoss 应补上巢主').toBeTruthy();
    expect(s.foes[0].name).toBe('沙暴元素');
    expect(s.hand.length).toBe(5);
    BattleSession.commands.flee();
    await drain(60);
  });

  it('战斗结束走龙巢结算：状态还原、回满血、推进一格、不跑一图战后流程', async () => {
    const g = prepRun();
    const def = { id: 'nest-sand-elem', name: '沙暴元素', hearts: 4, atk: 8, heartsMode: true, reward: { coins: 3, chests: [], runes: [] } };
    await window.SDT.Nest.startNestBattle(def);
    await drain();
    g.hp = 30;   // 战后应回满 60
    // 从真实起手取两张不同伤害牌：两刀 99 攻击 → 每刀 -2 心 → 4 心清空。
    const attackUids = snap().hand.filter(uid => {
      const entry = g.ownedCards.find(o => o.uid === uid);
      return !!(entry && entry.card.dmgType);
    }).slice(0, 2);
    expect(attackUids).toHaveLength(2);
    expect(new Set(attackUids).size).toBe(2);
    for (const uid of attackUids) {
      expect(snap().hand).toContain(uid);
      BattleSession.commands.playCard(uid, 0);
      await drain();
      if (!SDT.game.battleActive) break;
    }
    expect(window.SDT.game.battleActive).toBe(false);
    expect(g.nestPos).toBe(2);   // advance：从 1 推进到 2
    expect(g.hp).toBe(60);       // 回满血
    expect(g.coins).toBeGreaterThanOrEqual(3);
  });

  it('心模式按最终伤害折算：初始攻击（卡面 0 伤）也击碎 2 心', async () => {
    const g = prepRun();
    const def = { id: 'nest-sand-elem', name: '沙暴元素', hearts: 8, atk: 8, heartsMode: true, reward: { coins: 3, chests: [], runes: [] } };
    await window.SDT.Nest.startNestBattle(def);
    await drain();
    const shaUid = snap().hand.find(uid => {
      const entry = g.ownedCards.find(o => o.uid === uid);
      return entry && entry.card.name === '初始攻击';
    });
    expect(shaUid, '起手 5 张在仅 1 张非初始攻击的牌盒中必含初始攻击').toBeTruthy();
    expect(snap().hand).toContain(shaUid);
    BattleSession.commands.playCard(shaUid, 0);
    await drain();
    expect(snap().foes[0].hp, '99 攻击应击碎 2 心（8→6）').toBe(6);
    BattleSession.commands.flee();
    await drain(60);
  });
});

/* 江湖救急定版（2026-09-18 老板澄清）：随机直接给 3 张临时卡——不走发现面板，回合开始消耗。 */
describe('江湖救急 · 随机直接给3张', () => {
  it('打出后不弹发现面板，手牌直接多 3 张临时卡，并登记回合开始消耗', async () => {
    const g = prepRun();
    // 单卡牌盒保证目标牌必在起手，避免随机洗牌让测试误从牌库外调用 uid。
    g.cardBox = [{ id: 'cmtn1wnhhym', name: '江湖救急-改', cost: 0, rarity: '职业', type: '武术', dmg: 0, desc: '随机获得3张临时卡牌，回合开始时将其消耗。', value: 3, sellable: false, unrandom: true }];
    const def = { id: 'nest-sand-elem', name: '沙暴元素', hearts: 8, atk: 8, heartsMode: true, reward: { coins: 3, chests: [], runes: [] } };
    await window.SDT.Nest.startNestBattle(def);
    await drain();
    const before = snap().hand.length;
    const e = g.ownedCards.find(o => o.card.id === 'cmtn1wnhhym');
    BattleSession.commands.playCard(e.uid, 'any');
    const s = await drain();
    expect(s.discovering, '不应弹出发现面板').toBeFalsy();
    expect(s.hand.length).toBe(before - 1 + 3);   // 打出的江湖救急离手 + 3 张临时卡置入
    const log = (window.__uiLog || []).join(' | ');
    expect(log).toContain('随机获得 3 张临时卡牌');
    BattleSession.commands.flee();
    await drain(60);
  });
});
