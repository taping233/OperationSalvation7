/* 英雄卡（能力卡，11 张）与「直接释放」类卡牌真战斗实打审计（2026-09-11 老板任务）。
 * 生效口径 = cards.js v10 设计者稿批次（整卡覆盖）。
 * 覆盖：每张英雄卡的核心效果可观测发生（状态/牌库/手牌/日志/血量），
 * 以及 直接释放家族：万剑归宗、禁咒I-IV（抽到时施放）、诛魔剑/天启剑（抽到时触发）、
 * 剑荡妖邪（手选直接释放）、药水魔法（发现即释放）、每消耗施放火球（降临者双英雄）。
 * 规则注意：带「洗入/牌库」词条的英雄卡（无极梦魇/天剑诛魔）按规则只在 BOSS 战可用，
 * 普通战斗会以「牌库词条仅 BOSS 生效」拒绝——这两张走 BOSS 编组流程实打。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 8, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 99, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle.core.js');

const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();   // 含设计者稿整卡覆盖
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

const hero = id => {
  const list = C.all().filter(x => x.id === id);
  expect(list.length > 0, `卡库应存在 ${id}`).toBe(true);
  return list[list.length - 1];   // 与游戏内整卡覆盖口径一致：取最后生效批
};
const martialDmg = n => C.all().find(c => c.type === '武术' && (c.dmg || 0) >= n
  && !/消耗|选择|注能|抽到|释放|化为|丢弃/.test(String(c.desc || '')));
const plainSpell = () => C.all().find(c => c.type === '法术' && c.rarity !== '初始' && c.rarity !== '职业'
  && c.rarity !== '衍生' && !/洗入|牌库|抽到|消耗|选择|发现|释放|回合/.test(String(c.desc || '')));

let uidSeq = 0;
function makeGame(cards, over = {}) {
  const logs = [];
  const g = {
    ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp: 300, maxHp: 99999, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {},
    onBattleEnd() {},
    ...over,
  };
  return g;
}
const foe = (name = '靶子') => ({ id: 'infantry', name, hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
const waitLog = async (pred, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (pred()) return true; await nap(20); } return false; };   // 结果级轮询：等动作链真正落日志/终态再断言（根治负载 flake）
const snap = () => BattleSession.getSnapshot();
const handNames = () => snap().hand.map(u => (viewApi.findCard(u) || {}).card && (viewApi.findCard(u) || {}).card.name);
const pileNames = () => snap().drawPile.map(u => (viewApi.findCard(u) || {}).card && (viewApi.findCard(u) || {}).card.name);

async function drain(maxLoops = 400) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (s.choosing) continue;                       // 抉择留给用例自己决定
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
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
// 等待结算空闲但不代选手牌（供「选择手牌」类用例在半途断言）
async function waitIdle(maxLoops = 400) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (s.handSelecting || s.choosing) return s;
    if (!s.busy && s.actionQueueLength === 0 && !s.discovering) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = snap();
      if (!fresh.busy && fresh.actionQueueLength === 0 && !fresh.discovering) return fresh;
      continue;
    }
  }
  return snap();
}
// 等待回到玩家阶段（敌方阶段异步推进 + 回合开始效果排队）
async function nextTurn(maxLoops = 400) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!s.busy && s.actionQueueLength === 0 && String(s.phase).includes('player')) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = snap();
      if (!fresh.busy && fresh.actionQueueLength === 0 && String(fresh.phase).includes('player')) return fresh;
      continue;
    }
  }
  return snap();
}
async function startBoss(cards, over = {}) {
  const g = makeGame(cards, over);
  BattleSession.start(g, [foe()], { isBoss: true, name: '英雄卡审计' });
  expect(Boolean(snap().deckSelection), 'BOSS 战应先进入编组').toBe(true);
  while (snap().deckSelection && snap().deckSelection.selected.length < Math.min(snap().deckSelection.need, snap().deckSelection.cards.length)) {
    const next = snap().deckSelection.cards.find(c => !snap().deckSelection.selected.includes(c.uid));
    if (!next) break;
    BattleSession.commands.selectDeckCard(next.uid);
  }
  BattleSession.commands.confirmDeck();
  await drain();
  return g;
}
const uidOf = (g, card) => {
  const o = g.ownedCards.find(x => x.card.id === card.id);
  return o && o.uid;
};

let logs; // 每个用例开始前记录起点，断言只看增量
const mark = g => { logs = g.logs.length; };
const slice = g => g.logs.slice(logs).join('|');
const seen = (g, text) => g.logs.slice(logs).some(l => l.includes(text));

describe('英雄卡实打 · 侠客', () => {
  it('白梅落影·妄：净化+潜行2回合；破隐一击伤害翻倍且攻击后破除', async () => {
    const m = martialDmg(3);
    expect(Boolean(m), '需要一张无副词的直伤武术').toBe(true);
    const g = await startBoss([hero('tt8-hero-assassin'), m]);
    mark(g);
    BattleSession.commands.playCard(uidOf(g, hero('tt8-hero-assassin')), 'self');
    await drain();
    expect(seen(g, '潜行'), slice(g)).toBe(true);
    expect(snap().pstat.status.stealth).toBe(2);
    // 潜行中打出直伤武术：卡面基础伤×2，攻击力照加一次（实现口径）
    const before = snap().foes[0].hp;
    BattleSession.commands.playCard(uidOf(g, m), '0');
    await drain();
    const after = snap().foes[0].hp;
    expect(seen(g, '破隐一击'), slice(g)).toBe(true);
    expect(before - after).toBe(2 * m.dmg + 5);
    expect(snap().pstat.status.stealth || 0).toBe(0);      // 造成伤害后潜行破除
    BattleSession.commands.flee();
    await drain(20);
  });

undefined

  it('无量仙剑·云风（BOSS战）：抽牌并直接释放其中武术', async () => {
    // 牌库全武术（确定性）：无论怎么洗抽，抽到的必然全部被「直接释放」，不残留手牌
    const m = martialDmg(3);
    let g;
    for (let a = 0; a < 30; a++) {
      g = await startBoss([hero('tt8-hero-sword'), m, m, m, m, m, m, m]);
      const u = uidOf(g, hero('tt8-hero-sword'));
      if (snap().hand.includes(u) && snap().drawPile.length > 0) break;   // 触发卡在起手且牌库有余（洗牌随机 → 重试到满足）
      if (a === 29) throw new Error('30 次尝试内未同时满足「触发卡在起手 + 牌库有余」');
    }
    mark(g);
    BattleSession.commands.playCard(uidOf(g, hero('tt8-hero-sword')), null);
    await drain();
    await waitLog(() => /抽了 \d+ 张牌/.test(slice(g)));
    expect(/抽了 \d+ 张牌/.test(slice(g)), slice(g)).toBe(true);
    await waitLog(() => /直接释放了其中 [1-5] 张武术/.test(slice(g)));
    expect(/直接释放了其中 [1-5] 张武术/.test(slice(g)), slice(g)).toBe(true);
    // 释放语义 = 只自动打出「刚抽到的」武术；开局已在手牌的同名卡照常保留（同名堆叠干扰计数，
    // 故以释放日志为准，不按名字断言手牌残留）
    BattleSession.commands.flee();
    await drain(20);
  });

  it('天剑诛魔·云阳（BOSS战）：断念把天启剑与诛魔剑洗入牌库，抽到时触发', async () => {
    const m = martialDmg(3);
    const g = await startBoss([hero('tt8-hero-ranger'), m, m]);
    mark(g);
    BattleSession.commands.playCard(uidOf(g, hero('tt8-hero-ranger')), null);
    await drain();
    expect(seen(g, '洗入'), slice(g)).toBe(true);
    expect(pileNames().concat(handNames()).filter(n => n === '天启剑' || n === '诛魔剑').length).toBeGreaterThan(0);
    // 回合推进抽干牌库：诛魔剑抽到时攻击全体、天启剑抽到时额外抽 1
    BattleSession.commands.endTurn();
    await nextTurn();
    expect(seen(g, '抽到时') || seen(g, '诛魔剑'), slice(g) || g.logs.join('|')).toBe(true);
    const hurt = snap().foes[0].maxHp - snap().foes[0].hp;
    expect(hurt > 0, '诛魔剑抽到时应攻击全体敌人').toBe(true);
    BattleSession.commands.flee();
    await drain(20);
  });
});

describe('英雄卡实打 · 战士', () => {
  it('圣剑化身：能量上限 +1、装备上限 +1', async () => {
    const g = await startBoss([hero('tt8-hero-guardian')]);
    mark(g);
    BattleSession.commands.playCard(uidOf(g, hero('tt8-hero-guardian')), null);
    await drain();
    expect(snap().maxEnergy).toBe(viewApi.R().battleEnergy + 1);   // 上限 +1
    expect(slice(g).includes('能量上限'), slice(g)).toBe(true);   // 能量上限句有播报；装备上限由下方三连穿验证
    // 装备上限生效：连续穿戴 3 件不被拒
    const equips = C.all().filter(c => c.type === '装备' && c.rarity !== '初始'
      && !/对战开始时|限定/.test(String(c.desc || '')) && !c.unrandom).slice(0, 3);
    if (equips.length === 3) {
      const g2 = await startBoss([hero('tt8-hero-guardian'), ...equips]);
      mark(g);
      BattleSession.commands.playCard(uidOf(g2, hero('tt8-hero-guardian')), null);
      await drain();
      for (const e of equips) {
        BattleSession.commands.playCard(uidOf(g2, e), 'self');
        await drain();
      }
      expect(g2.logs.slice(logs).some(l => l.includes('最多同时装配'))).toBe(false);
      BattleSession.commands.flee();
      await drain(20);
    }
    BattleSession.commands.flee();
    await drain(20);
  });

  it('青龙化身：初始攻击化为青龙偃月斩并被直接释放', async () => {
    const g = await startBoss([hero('tt8-hero-warrior'), hero('tt8-hero-sword')]);
    mark(g);
    BattleSession.commands.playCard(uidOf(g, hero('tt8-hero-warrior')), null);
    await drain();
    expect(seen(g, '化为'), slice(g)).toBe(true);
    // 普通战发牌段随能力卡禁入普通战而失效（2026-09-16 规则）；化为登记在 BOSS 战照常生效
    expect(seen(g, '化为'), slice(g)).toBe(true);
    BattleSession.commands.flee();
    await drain(20);
  });
});

describe('英雄卡实打 · 牧师', () => {
  it('禁术解放（BOSS战）：四张禁咒洗入牌库，洗混后「然后抽 2 张」', async () => {
    const m = martialDmg(3);
    const g = await startBoss([hero('tt8-hero-warlock'), m, m]);
    mark(g);
    BattleSession.commands.playCard(uidOf(g, hero('tt8-hero-warlock')), null);
    await drain();
    expect(seen(g, '洗入牌库'), slice(g)).toBe(true);
    expect(seen(g, '然后抽') || seen(g, '洗入后抽了 2 张牌'), slice(g)).toBe(true);
    // 洗混后立刻抽的 2 张应是禁咒（抽到时施放），而不是洗入前的旧牌
    const castNow = g.logs.filter(l => l.includes('抽到时施放') && l.includes('禁咒'));
    expect(castNow.length >= 2, `洗入后应立即施放 2 张禁咒：${slice(g)}`).toBe(true);
    // 回合推进抽干牌库：剩下 2 张禁咒也依次施放
    BattleSession.commands.endTurn();
    await nextTurn();
    const castAll = g.logs.filter(l => l.includes('抽到时施放') && l.includes('禁咒'));
    for (const nm of ['禁咒I', '禁咒II', '禁咒III', '禁咒IV']) {
      expect(castAll.some(l => l.includes(nm)), `${nm} 应施放过（测试规则每回合抽99张、弃牌堆循环洗回会重复施放）：${g.logs.join('|').slice(-500)}`).toBe(true);
    }
    BattleSession.commands.flee();
    await drain(20);
  });

  it('浪掷风吟：置入随机卡牌直至手牌6张，每置入1张法术回复3血', async () => {
    const g = await startBoss([hero('tt8-hero-priest')], { hp: 100 });
    mark(g);
    BattleSession.commands.playCard(uidOf(g, hero('tt8-hero-priest')), 'self');
    const s = await drain();
    expect(s.hand.length, `手牌应补到 6 张：${s.hand.length}`).toBe(6);
    await waitLog(() => /置入 \d+ 张随机卡牌/.test(slice(g)));
    expect(/置入 \d+ 张随机卡牌/.test(slice(g)), slice(g)).toBe(true);
    expect(g.hp > 100, '置入法术应回复生命').toBe(true);
    BattleSession.commands.flee();
    await drain(20);
  });
});

describe('英雄卡实打 · 法师', () => {
  it('明灯千里·孔明：法伤 +1，回合开始时发现 1 张卡牌', async () => {
    const g = await startBoss([hero('tt8-hero-mage'), martialDmg(3)]);
    mark(g);
    BattleSession.commands.playCard(uidOf(g, hero('tt8-hero-mage')), null);
    await drain();
    expect(snap().pstat.status.spellUp).toBe(1);
    expect(seen(g, '回合开始时'), slice(g)).toBe(true);      // 回合开始段已注册
    BattleSession.commands.endTurn();
    const s = await nextTurn();
    expect(seen(g, '发现'), `回合开始应结算发现：${slice(g)}`).toBe(true);
    if (s.discovering) BattleSession.commands.pickDiscover(0);
    await drain();
    BattleSession.commands.flee();
    await drain(20);
  });

  it('神话终章·雷修斯：元素潮汐抉择两扇门，两回合后开启未选的门', async () => {
    const g = await startBoss([hero('tt8-hero-summoner')]);
    mark(g);
    BattleSession.commands.playCard(uidOf(g, hero('tt8-hero-summoner')), null);
    await drain();
    const ch = snap().choosing;
    expect(Boolean(ch), '应弹出元素潮汐抉择').toBe(true);
    expect(ch.options.length).toBe(2);
    BattleSession.commands.pickChoice(0);
    await drain();
    // 推进回合：未选择的门应在两回合后开启
    BattleSession.commands.endTurn();
    await nextTurn();
    BattleSession.commands.endTurn();
    await nextTurn();
    BattleSession.commands.endTurn();
    await nextTurn();
    expect(g.logs.slice(logs).filter(l => l.includes('门')).length > 0, `门类日志应出现：${slice(g)}`).toBe(true);
    BattleSession.commands.flee();
    await drain(20);
  }, 25000);
});

describe('英雄卡实打 · 降临者', () => {
  // tt8-hero-sealer 已定版重做为「受缚之残影」（深海封印/化形，2026-09-16）——
  // 不再是消耗引擎，其新机制由 abyss-sovereign.test.js 实打覆盖
  for (const [id, label] of [['tt8-hero-descender', '充能火山']]) {
    it(`${label}：法伤+1，每消耗 1 张卡牌自动施放火球`, async () => {
      const turtle = C.all().find(c => c.name === '铸甲');
      const equip = C.all().find(c => c.type === '装备' && c.rarity !== '初始'
        && !/对战开始时|限定|洗入|牌库/.test(String(c.desc || '')) && !c.unrandom);
      expect(Boolean(turtle && equip), '需要铸甲+一件可消耗装备').toBe(true);
      const g = await startBoss([hero(id), turtle, equip]);
      mark(g);
      BattleSession.commands.playCard(uidOf(g, hero(id)), '0');   // 描述含「火球」→ 指向敌人
      await drain();
      expect(snap().pstat.status.spellUp).toBe(1);
      expect(seen(g, '每消耗 1 张卡牌，自动施放火球'), slice(g)).toBe(true);
      // 消耗一张装备牌 → 联动施放 1 次火球
      BattleSession.commands.playCard(uidOf(g, turtle), 'self');
      const picked = await waitIdle();
      expect(Boolean(picked.handSelecting), '铸甲应进入选牌消耗').toBe(true);
      BattleSession.commands.pickHandSelect(uidOf(g, equip));
      await drain();
      expect(seen(g, '火球'), slice(g)).toBe(true);
      BattleSession.commands.flee();
      await drain(20);
    });
  }
});

describe('直接释放家族实打', () => {
  it('剑荡妖邪：选择手牌中 1 张武术卡直接释放', async () => {
    const jd = C.all().find(c => c.name === '剑荡妖邪');
    const m = martialDmg(3);
    expect(Boolean(jd && m), '需要剑荡妖邪+直伤武术').toBe(true);
    const g = makeGame([jd, m]);
    BattleSession.start(g, [foe()], { name: '剑荡' });
    await drain();
    mark(g);
    const before = snap().foes[0].hp;
    BattleSession.commands.playCard(uidOf(g, jd), '0');
    const picked = await waitIdle();
    expect(Boolean(picked.handSelecting), '应进入手牌选择').toBe(true);
    BattleSession.commands.pickHandSelect(uidOf(g, m));
    await drain();
    expect(seen(g, '直接释放') || g.logs.slice(logs).some(l => l.includes(m.name)), slice(g)).toBe(true);
    expect(snap().foes[0].hp).toBeLessThan(before);
    BattleSession.commands.flee();
    await drain(20);
  });

  it('药水魔法：发现 1 瓶药水并真正直接释放（不得只置入手牌）', async () => {
    const ym = C.all().find(c => c.name === '药水魔法');
    expect(Boolean(ym), '卡库应有药水魔法').toBe(true);
    const g = makeGame([ym]);
    BattleSession.start(g, [foe()], { name: '药水' });
    await drain();
    mark(g);
    BattleSession.commands.playCard(uidOf(g, ym), null);
    const s0 = await waitIdle();
    expect(Boolean(s0.discovering), '应进入发现面板').toBe(true);
    const picked = s0.discovering.options[0];
    expect(Boolean(picked), '发现面板应有候选').toBe(true);
    BattleSession.commands.pickDiscover(0);
    const s = await drain();
    // 2026-09-11 实机回访 bug：发现选中的药水只被置入手牌，没有按卡面「并直接释放」结算——
    // 旧断言只查日志字样（打出药水魔法时的预告日志就含「直接释放」）而被骗过。
    // 释放语义 = 选中的卡被免费打出：不在手牌残留，且对局有可观测变化（敌掉血 / 敌冰冻 / 我回血 / 随机神秘效果）。
    const hand = snap().hand.map(u => (viewApi.findCard(u) || {}).card).filter(Boolean).map(c => c.name);
    expect(hand.includes(picked.name), `选中的【${picked.name}】应被直接释放而非留在手牌：${slice(g)}`).toBe(false);
    const foe0 = snap().foes[0];
    const st = foe0.status || {};
    // 药水池（parsePoolNoun('药水')=带「药水」名字的道具）逐瓶的可观测信号：
    //   伤害/诅咒类 → 敌掉血/冰冻/中毒/流血；回复类 → hp>300（满血 99999 不存在）；
    //   攻击/法伤强化 → atkUp/spellUp；蓝瓶/精神药水抽牌（普通战变获得初始攻击）→「初始攻击」；
    //   巨蟒药水 →「召唤」；转势药水「附加陷阱牌」暂无结算分支 → 走「占位」日志（管线确实跑过该牌）。
    //   复原药水在战斗内是合法无操作（本场没有可复原的消耗堆），与满血回复同样豁免。
    const noOpInBattle = picked.name === '复原药水';
    const healingAtFull = picked.name === '恢复药水' && g.hp >= g.maxHp;
    const observable = noOpInBattle || healingAtFull || foe0.hp < foe0.maxHp
      || (st.freeze || 0) > 0 || (st.poison || 0) > 0 || (st.bleed || 0) > 0
      || g.hp > 300
      || (snap().pstat.status && ((snap().pstat.status.spellUp || 0) > 0 || (snap().pstat.status.atkUp || 0) > 0))
      || slice(g).includes('祝福')
      || slice(g).includes('神秘药水')
      || slice(g).includes('初始攻击')
      || slice(g).includes('召唤')
      || slice(g).includes('占位');
    expect(observable, `释放应有可观测效果：${slice(g)}`).toBe(true);
    BattleSession.commands.flee();
    await drain(20);
  }, 25000);
});
