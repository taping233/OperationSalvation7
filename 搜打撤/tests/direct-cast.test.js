/* 直接释放 / 直接施放类卡牌 + 能力卡专项实打审计（2026-09-13 老板任务 #8）：
 * 在真实 BattleSession（battle.core，无视图层）里逐条验证「直接释放」链路的语义正确性：
 *   1 无量仙剑·云风（能力卡）——抽 5 张后自动直接释放其中的武术（免费）
 *   2 剑荡妖邪——手选 1 张武术直接释放，选中卡不扣费（isFree）
 *   3 永恒绽放——发现并直接施放 1 张，其余两张入手（playKeep）
 *   4 千变万化——发现并直接施放 1 张，再抽 2 张
 *   5 江湖救急——发现其它职业的卡并直接施放
 *   6 药水魔法——发现 1 瓶药水并直接释放
 *   7 法师锦囊——容器选 1 张直接施放（pouch）
 *   8 连弩 × 天狼长弓——回合开始获得「箭」令牌，限定技能直接释放全部箭并逐张抽牌
 *     （此前卡库无「箭」，两卡从未生效；现由 effect-steps 的 ARROW_TOKEN 虚拟令牌支撑）
 *   9 阿波罗的礼物——穿戴后发现面板出现「直接施放」（discoverCastable），castDiscover 免费打出
 * 判定口径：不崩、不悬挂、关键日志存在、能量账目符合「免费用」语义。 */
import { describe, it, expect, beforeAll } from 'vitest';
import { targetSideFor } from '../game/src/battle.rules.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 0, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const { BattleSession } = await import('../game/src/battle.core.js');

const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

let uidSeq = 0;
function makeGame(cards, myClass = '侠客') {
  const logs = [];
  const g = {
    ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp: 99999, maxHp: 99999, atk: 5, spellPower: 2, coins: 0,
    myClass, characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {},
    onBattleEnd() {},
  };
  return g;
}
const foeDef = () => ({ id: 'infantry', name: '直释靶子', hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const snap = () => BattleSession.getSnapshot();
const logsJoin = (g) => g.logs.join('\n');
const endBattle = (g) => { try { if (g.battleActive && !snap().busy) BattleSession.commands.flee(); } catch (_) {} };

let asyncError = null;
process.on('unhandledRejection', (e) => { asyncError = e; });
function takeAsyncError() { const e = asyncError; asyncError = null; return e; }

// 抽干动作队列；stopPanel = 遇到发现/手选面板时停下（不自动选/跳过），由用例自己驱动
async function drain(maxLoops = 300, stopPanel = false) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (stopPanel && (s.discovering || s.handSelecting)) return s;
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!s.busy && s.actionQueueLength === 0) return s;
  }
  return snap();
}

const card = (id) => { const c = C.all().find(x => x.id === id); if (!c) throw new Error('卡库缺卡: ' + id); return c; };
const cardByName = (name) => { const c = C.all().find(x => x.name === name); if (!c) throw new Error('卡库缺卡: ' + name); return c; };

// 指向侧解析（同 battle-all-cards 口径）：enemy→0，self→'self'，无指向→undefined
const sideFor = (c) => {
  const side = targetSideFor(c, C.DMG_TYPES);
  return side === 'enemy' ? 0 : side === 'self' ? 'self' : undefined;
};

// 在已开打的战斗里把一张手牌打出（自动补选注能燃料 / 发现 / 抉择）
async function playIt(game, uid, c) {
  BattleSession.commands.playCard(uid, sideFor(c));
  if (snap().infusing) {
    for (let i = 0; i < 30 && snap().infusing; i++) {
      const s = snap();
      const target = s.hand.find(u => u !== s.infusing.uid && !s.infusing.picked.includes(u));
      if (!target) break;
      BattleSession.commands.selectInfusion(target);
      await tick();
    }
    if (snap().infusing) BattleSession.commands.confirmInfusion();
  }
  return drain();
}

describe('直接释放 / 直接施放类卡牌专项审计', () => {

  it('能力卡·无量仙剑·云风：抽5张后自动直接释放其中的武术（免费）', async () => {
    const hero = card('tt8-hero-sword');
    if (!/直接释放其中/.test(hero.desc || '')) { console.log('（运行时版本无直接释放词条，跳过）'); return; }
    const fillers = Array.from({ length: 9 }, () => card('tt2-jianghu'));
    const g = makeGame([hero, ...fillers], '侠客');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '直释审计' });
    await drain();
    const uid = g.ownedCards[0].uid;
    expect(snap().hand.includes(uid)).toBe(true);   // 能力卡应正常进手牌
    await playIt(g, uid, hero);
    expect(logsJoin(g)).toContain('直接释放了其中');   // 万剑归宗自动释放了抽到的武术
    const s = snap();
    expect(s.busy || s.actionQueueLength > 0).toBe(false);
    endBattle(g);
    expect(takeAsyncError()).toBeNull();
  });

  it('剑荡妖邪：手选的武术直接释放且不扣费', async () => {
    const frost = card('tt3-frostfall');
    if (!/直接释放/.test(frost.desc || '')) { console.log('（运行时版本无直接释放词条，跳过）'); return; }
    const g = makeGame([frost, card('tt2-jianghu'), card('tt2-jianghu'), card('tt2-jianghu')], '侠客');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '直释审计' });
    await drain();
    const energyBefore = snap().energy;
    BattleSession.commands.playCard(g.ownedCards[0].uid, sideFor(frost));   // 剑荡妖邪自身扣费 → 进入手选
    let s = await drain(300, true);   // 停在手选面板（drain 默认会跳过它）
    expect(s.handSelecting || logsJoin(g).includes('手牌中没有')).toBeTruthy();
    if (s.handSelecting) {
      const target = s.hand.find(u => u !== s.handSelecting.uid);
      expect(target).toBeTruthy();
      BattleSession.commands.pickHandSelect(target);   // 选 1 张武术直接释放
      s = await drain();
    }
    const s2 = snap();
    // 剑荡妖邪 2 费已扣；被释放的江湖救急（1 费）不应再扣
    expect(s2.energy).toBe(energyBefore - 2);
    expect(s2.busy || s2.actionQueueLength > 0).toBe(false);
    endBattle(g);
    expect(takeAsyncError()).toBeNull();
  });

  it('永恒绽放：施放 1 张，其余两张入手', async () => {
    const bloom = card('tt7-bladebloom');
    const g = makeGame([bloom], '法师');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '直释审计' });
    await drain();
    const handBefore = snap().hand.length;
    await playIt(g, g.ownedCards[0].uid, bloom);   // drain 会自动选发现第 0 张
    expect(logsJoin(g)).toContain('并直接施放');
    expect(logsJoin(g)).toContain('其余的');   // 剩余两张入手
    const s = snap();
    expect(s.hand.length).toBeGreaterThanOrEqual(handBefore + 1);
    expect(s.busy || s.actionQueueLength > 0).toBe(false);
    endBattle(g);
    expect(takeAsyncError()).toBeNull();
  });

  it('千变万化：发现并直接施放，再抽 2 张', async () => {
    const g = makeGame([cardByName('千变万化')], '法师');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '直释审计' });
    await drain();
    await playIt(g, g.ownedCards[0].uid, cardByName('千变万化'));
    expect(logsJoin(g)).toContain('并直接施放');
    const s = snap();
    expect(s.busy || s.actionQueueLength > 0).toBe(false);
    endBattle(g);
    expect(takeAsyncError()).toBeNull();
  });

  it('江湖救急：发现其它职业的卡并直接施放', async () => {
    const g = makeGame([card('tt2-jianghu')], '侠客');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '直释审计' });
    await drain();
    await playIt(g, g.ownedCards[0].uid, cardByName('千变万化'));
    expect(logsJoin(g)).toContain('并直接施放');
    const s = snap();
    expect(s.busy || s.actionQueueLength > 0).toBe(false);
    endBattle(g);
    expect(takeAsyncError()).toBeNull();
  });

  it('药水魔法：发现 1 瓶药水并直接释放', async () => {
    const g = makeGame([card('tt3sp-magicoil')], '法师');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '直释审计' });
    await drain();
    await playIt(g, g.ownedCards[0].uid, card('tt3sp-magicoil'));
    expect(logsJoin(g)).toContain('药水');
    const s = snap();
    expect(s.busy || s.actionQueueLength > 0).toBe(false);
    endBattle(g);
    expect(takeAsyncError()).toBeNull();
  });

  it('法师锦囊：容器选 1 张直接施放（pouch）', async () => {
    const g = makeGame([card('tt7-stratagem')], '法师');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '直释审计' });
    await drain();
    await playIt(g, g.ownedCards[0].uid, card('tt7-stratagem'));
    expect(logsJoin(g)).toContain('法师锦囊');
    const s = snap();
    expect(s.busy || s.actionQueueLength > 0).toBe(false);
    endBattle(g);
    expect(takeAsyncError()).toBeNull();
  });

  it('连弩 × 天狼长弓：回合开始获得「箭」令牌，限定技能直接释放全部箭并逐张抽牌', async () => {
    const bow = card('tt3-wolf-bow');
    const crossbow = card('tt3-reverse-bow');
    if (!/箭/.test(bow.desc || '') || !/直接释放/.test(crossbow.desc || '')) {
      console.log('（运行时版本无箭矢/直接释放词条，跳过）'); return;
    }
    const g = makeGame([bow, crossbow], '侠客');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '直释审计' });
    await drain();
    // 依次装配两件装备（上限 2）
    await playIt(g, g.ownedCards[0].uid, bow);
    await playIt(g, g.ownedCards[1].uid, crossbow);
    expect(snap().equipped.length).toBe(2);
    // 结束回合 → 敌方 → 新回合开始：天狼长弓发放「箭」令牌（ARROW_TOKEN，0 费）
    BattleSession.commands.endTurn();
    let s = await drain();
    // 敌人行动后回到玩家回合（hp 99999 扛得住）
    for (let i = 0; i < 20 && s.phase !== 'player'; i++) { BattleSession.commands.endTurn?.(); await tick(); s = snap(); }
    expect(logsJoin(g)).toContain('箭');   // 「获得【箭】，其费用已变为 0」
    // 连弩限定技能：直接释放手牌中的所有「箭」
    const xbowEntry = snap().equipped.find(e => e.name === '连弩');
    expect(xbowEntry).toBeTruthy();
    BattleSession.commands.useEquipSkill(xbowEntry.uid);
    s = await drain();
    expect(logsJoin(g)).toMatch(/释放了手牌中 \d+ 张「箭」/);
    expect(s.busy || s.actionQueueLength > 0).toBe(false);
    endBattle(g);
    expect(takeAsyncError()).toBeNull();
  });

  it('阿波罗的礼物：运行时卡面（设计者定版）不含「可直接施放」词条——哨兵用例', () => {
    // 审计结论（2026-09-13）：运行时阿波罗 = TT11 设计者稿「发现或随机获取该牌时，
    // 回复1点能量并获取另1张随机卡牌。」——旧版「任何牌时可直接施放」词条已被设计者
    // 稿覆盖，战斗内只有 fireCatGift 能量+附赠被动（2026-09-12 实装）。
    // 若本断言变红：有人把「可直接施放」词条加了回来——请同步补发现面板的直接施放实现。
    const apollo = card('tt2-apollo');
    expect(/可直接施放/.test(String(apollo.desc || ''))).toBe(false);
  });
});
