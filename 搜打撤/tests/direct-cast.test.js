import { battleRules } from './helpers/environment-fixtures.js';
/* 直接释放 / 直接施放类卡牌 + 能力卡专项实打审计（2026-09-13 老板任务 #8）：
 * 在真实 BattleSession（battle.core，无视图层）里逐条验证「直接释放」链路的语义正确性：
 *   1 无量仙剑·云风（能力卡）——抽 5 张后自动直接释放其中的武术（免费）
 *   2 剑荡妖邪——手选 1 张武术直接释放，选中卡不扣费（isFree）
 *   3 永恒绽放——可施放牌免费打出；纯注能牌直接施放视为已注能（反馈#5b 老板定版），其余两张入手（playKeep）
 *   4 千变万化——发现并直接施放 1 张，再抽 2 张
 *   5 江湖救急——发现其它职业的卡并直接施放
 *   6 药水魔法——发现 1 瓶药水并直接释放
 *   7 法师锦囊——容器选 1 张直接施放（pouch）
 *   8 连弩 × 天狼长弓——回合开始获得「箭」令牌，限定技能直接释放全部箭并逐张抽牌
 *     （此前卡库无「箭」，两卡从未生效；现由 effect-steps 的 ARROW_TOKEN 虚拟令牌支撑）
 *   9 阿波罗的礼物——穿戴后发现面板出现「直接施放」（discoverCastable），castDiscover 免费打出
 * 判定口径：不崩、不悬挂、关键日志存在、能量账目符合「免费用」语义。 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { targetSideFor } from '../game/src/battle/effects/battle.target-rules.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { ...battleRules(99, 99, 10, 0, 5, 3) },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, infuseOf } = await import('../game/src/battle/core/battle.core.js');
const { findCard } = await import('../game/src/battle/core/battle.engine.js');
const { Random } = await import('../game/src/core/random.js');

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
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
const waitLog = async (pred, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (pred()) return true; await nap(20); } return false; };   // 结果级轮询：等动作链真正落日志/终态再断言（根治负载 flake）
const snap = () => BattleSession.getSnapshot();
const logsJoin = (g) => g.logs.join('\n');
const endBattle = (g) => { try { if (g.battleActive && !snap().busy) BattleSession.commands.flee(); } catch { /* 已终局/不可撤离：收尾 best-effort */ } };

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
    if (!s.busy && s.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = snap();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
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

// 固定合法候选和测试种子，再按 ID 选择；不把发现第 0 张的随机可施放性当作规则。
// 真实 BattleSession 仍执行发现、免费施放与注能守卫；测试结束恢复卡池和随机状态。
async function playBloomChoice(g, bloom, chosenId) {
  const options = ['tt3-ice-spike', 'tt12-raydragon', 'tt12-freezeray'].map(card);
  const randomBefore = Random.snapshot();
  const pool = vi.spyOn(C, 'all').mockReturnValue(options);
  try {
    Random.reseed('direct-cast-bloom');
    BattleSession.commands.playCard(g.ownedCards[0].uid, sideFor(bloom));
    const discovering = (await drain(300, true)).discovering;
    expect(discovering).toBeTruthy();
    expect(discovering.act).toBe('playKeep');
    expect(discovering.n).toBe(1);
    expect(discovering.options.map(c => c.id).sort()).toEqual(options.map(c => c.id).sort());
    const index = discovering.options.findIndex(c => c.id === chosenId);
    expect(index).toBeGreaterThanOrEqual(0);
    BattleSession.commands.pickDiscover(index);
    await drain();
    return options;
  } finally {
    pool.mockRestore();
    Random.restore(randomBefore);
  }
}

describe('直接释放 / 直接施放类卡牌专项审计', () => {

  it('能力卡·无量仙剑·云风：抽5张后自动直接释放其中的武术（免费）', async () => {
    const hero = card('tt8-hero-sword');
    if (!/直接释放其中/.test(hero.desc || '')) { console.log('（运行时版本无直接释放词条，跳过）'); return; }
    // 普通战无法使用能力卡（2026-09-16 规则）→ 走 BOSS 编组流程实打。
    // 2026-09-18：填充足的武术牌——原 9 张时英雄卡能否进开局手牌、以及打牌时牌库余量
    // 都靠洗牌运气，卡池变化（v25）会让「直接释放了其中」时有时无；厚牌库让断言确定。
    const fillers = Array.from({ length: 29 }, () => card('tt2-jianghu'));
    let g, uid;
    for (let a = 0; a < 30; a++) {
      g = makeGame([hero, ...fillers], '侠客');
      BattleSession.start(g, [foeDef()], { isBoss: true, name: '直释审计' });
      await drain();
      expect(snap().deckSelection, 'BOSS 战应先进入编组').toBeTruthy();
      while (snap().deckSelection && snap().deckSelection.selected.length < Math.min(snap().deckSelection.need, snap().deckSelection.cards.length)) {
        const next = snap().deckSelection.cards.find(c => !snap().deckSelection.selected.includes(c.uid));
        if (!next) break;
        BattleSession.commands.selectDeckCard(next.uid);
      }
      BattleSession.commands.confirmDeck();
      await drain();
      uid = g.ownedCards[0].uid;
      for (let t = 0; t < 8 && !snap().hand.includes(uid); t++) { BattleSession.commands.endTurn(); await drain(); }
      if (snap().hand.includes(uid) && snap().drawPile.length > 0) break;   // 触发卡在起手且牌库有余（洗牌随机 → 重试到满足）
      if (a === 29) throw new Error('30 次尝试内未同时满足「触发卡在起手 + 牌库有余」');
    }
    expect(snap().hand.includes(uid)).toBe(true);   // 能力卡在 BOSS 战正常进手牌（回合抽牌必到手）
    await playIt(g, uid, hero);
    await waitLog(() => logsJoin(g).includes('直接释放了其中'));
    expect(logsJoin(g)).toContain('直接释放了其中');   // 万剑归宗自动释放了抽到的武术
    const s = snap();
    expect(s.busy || s.actionQueueLength > 0).toBe(false);
    endBattle(g);
    expect(takeAsyncError()).toBeNull();
  });

  it('剑荡妖邪：手选的武术直接释放且不扣费', async () => {
    const frost = card('tt3-frostfall');
    if (!/直接释放/.test(frost.desc || '')) { console.log('（运行时版本无直接释放词条，跳过）'); return; }
    // 使用只有伤害的武术，避免江湖救急随机施放回能卡改变能量账目。
    const strike = { id: 'direct-cast-strike', name: '直释测试斩', type: '武术', cost: 1, dmg: 1, dmgType: '物理', desc: '造成1点物理伤害' };
    const g = makeGame([frost, strike, strike, strike], '侠客');
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
    // 剑荡妖邪 2 费已扣；被直接释放的测试武术（1 费）不应再扣
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
    const before = snap();
    const handBefore = snap().hand.length;
    const chosenId = 'tt3-ice-spike';
    expect(infuseOf(card(chosenId))).toBe(0);
    const options = await playBloomChoice(g, bloom, chosenId);
    await waitLog(() => logsJoin(g).includes('并直接施放'));
    expect(logsJoin(g)).toContain('并直接施放');
    await waitLog(() => logsJoin(g).includes('其余的'));
    expect(logsJoin(g)).toContain('其余的');   // 剩余两张入手
    const s = snap();
    expect(s.hand.length).toBeGreaterThanOrEqual(handBefore + 1);
    expect(s.hand.map(uid => findCard(uid).card.id).sort())
      .toEqual(options.filter(c => c.id !== chosenId).map(c => c.id).sort());
    expect(s.consumedPile.filter(uid => findCard(uid)?.card.id === chosenId)).toHaveLength(1);
    expect(s.foes[0].hp).toBeLessThan(before.foes[0].hp);
    expect(s.energy).toBe(before.energy - bloom.cost);
    expect(s.discovering).toBeFalsy();
    expect(s.busy || s.actionQueueLength > 0).toBe(false);
    endBattle(g);
    expect(takeAsyncError()).toBeNull();
  });

  it('永恒绽放：纯注能牌直接施放视为已注能（释放成功、按注能效果结算、材料不消耗）', async () => {
    // 反馈#5b（2026-10-21 老板定版）：「直接释放/直接施放」词条释放注能卡时视为已注能，
    // 不再「未注能留手」；留手规则仅保留给不含释放动作的纯发现效果。
    const bloom = card('tt7-bladebloom');
    const dragon = card('tt12-raydragon');
    const g = makeGame([bloom], '法师');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '直释审计' });
    await drain();
    try {
      const before = snap();
      expect(infuseOf(dragon)).toBe(1);
      const options = await playBloomChoice(g, bloom, dragon.id);
      const s = snap();
      expect(logsJoin(g)).toContain('并直接施放');
      expect(logsJoin(g), '注能卡直释应提示视为已注能').toContain('视为已注能');
      expect(logsJoin(g)).not.toContain('未施放，保留在手牌中等待注能');
      expect(logsJoin(g)).toContain('其余的');
      // 直释的龙焰射线不留在手牌；其余两张候选入手
      expect(s.hand.map(uid => findCard(uid).card.id).sort())
        .toEqual(options.filter(c => c.id !== dragon.id).map(c => c.id).sort());
      // 龙焰射线唯一效果是「注能（1）：造成 11 点法术伤害」——视为已注能 → 11 + 法伤 2 = 13
      expect(before.foes[0].hp - s.foes[0].hp).toBe(13);
      const consumedDragon = s.consumedPile.filter(uid => findCard(uid)?.card.id === dragon.id);
      expect(consumedDragon).toHaveLength(1);
      expect(s.consumedPile).toEqual([g.ownedCards[0].uid, consumedDragon[0]]);
      expect(s.energy).toBe(before.energy - bloom.cost);
      expect(s.infusing).toBeFalsy();
      expect(s.discovering).toBeFalsy();
      expect(s.busy || s.actionQueueLength > 0).toBe(false);
    } finally {
      endBattle(g);
    }
    expect(takeAsyncError()).toBeNull();
  });

  it('千变万化：发现并直接施放，再抽 2 张', async () => {
    const g = makeGame([cardByName('千变万化')], '法师');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '直释审计' });
    await drain();
    await playIt(g, g.ownedCards[0].uid, cardByName('千变万化'));
    await waitLog(() => logsJoin(g).includes('并直接施放'));
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
    await waitLog(() => logsJoin(g).includes('并直接施放'));
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
    await waitLog(() => logsJoin(g).includes('药水'));
    expect(logsJoin(g)).toContain('药水');
    const s = snap();
    expect(s.busy || s.actionQueueLength > 0).toBe(false);
    endBattle(g);
    expect(takeAsyncError()).toBeNull();
  });

  it('法师锦囊：空锦囊无效果；预存法术后打出选 1 释放（2026-09-16 定版）', async () => {
    const pouch = card('tt7-stratagem');
    const spell = card('tt3-fireball');
    const g = makeGame([pouch, spell], '法师');
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '锦囊审计' });
    await drain();
    // 空锦囊打出：无效果
    BattleSession.commands.playCard(g.ownedCards[0].uid, 0);
    await drain();
    await waitLog(() => logsJoin(g).includes('锦囊是空的'));
    expect(logsJoin(g)).toContain('锦囊是空的');
    // 模拟背包预存法术（09-29 双向同步：背包 pouchOf 母本即镜像源，不再直写 _pouch）
    g.ownedCards[1].pouchOf = 'tt7-stratagem';
    // 再打一次：从预存法术选 1 释放
    BattleSession.commands.playCard(g.ownedCards[0].uid, 0);
    await drain();
    const s2 = snap();
    expect(s2.busy || s2.actionQueueLength > 0).toBe(false);
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
    const arrow = card('tt2-swiftarrow');
    const pool = vi.spyOn(C, 'all').mockReturnValue([arrow]);
    let s;
    try { BattleSession.commands.endTurn(); s = await drain(); }
    finally { pool.mockRestore(); }
    // 敌人行动后回到玩家回合（hp 99999 扛得住）
    for (let i = 0; i < 20 && s.phase !== 'player'; i++) { BattleSession.commands.endTurn?.(); await tick(); s = snap(); }
    await waitLog(() => logsJoin(g).includes('箭'));
    expect(logsJoin(g)).toContain('箭');   // 「获得【箭】，其费用已变为 0」
    // 连弩限定技能：直接释放手牌中的所有「箭」
    const xbowEntry = snap().equipped.find(e => e.name === '连弩');
    expect(xbowEntry).toBeTruthy();
    const arrows = s.hand.filter(uid => /箭/.test(findCard(uid)?.card.name || ''));
    expect(arrows).toHaveLength(1);
    expect(findCard(arrows[0]).card).toMatchObject({ id: arrow.id, cost: 0 });
    const before = s;
    BattleSession.commands.useEquipSkill(xbowEntry.uid);
    s = await drain();
    expect(s.hand).not.toContain(arrows[0]);
    expect(s.consumedPile.filter(uid => uid === arrows[0])).toHaveLength(1);
    // 迅疾箭自身抽1张；连弩每次释放再抽1张，均移动本场牌库原UID。
    expect(s.drawPile).toHaveLength(before.drawPile.length - arrows.length * 2);
    const gained = s.hand.filter(uid => !before.hand.includes(uid));
    expect(gained).toHaveLength(2);
    expect(before.drawPile).toEqual(expect.arrayContaining(gained));
    expect(s.foes[0].hp).toBeLessThan(before.foes[0].hp);
    expect(s.energy).toBe(before.energy);
    expect(s.equipped.find(entry => entry.uid === xbowEntry.uid).used).toBe(true);
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
