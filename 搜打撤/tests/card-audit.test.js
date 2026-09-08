/* 卡牌库实装审计（2026-09-08 老板任务 #4/#6）：
   1) 用真实种子流程灌库 + 真实效果解析器逐句跑描述，防止「一打就崩」的描述进库；
   2) 结构化词条与描述的一致性（合并残留错误词条）；
   3) 老板 2026-09-08 限制卡池清单逐项验证。
   注意：「未识别清单」输出为人工复核用（恒通过），其中结构化词条覆盖的句子
   （如「造成 2 点伤害」有 dmg 字段）属正常假阳性，以未识别总数趋势为准。 */
import { describe, it, expect, beforeAll } from 'vitest';
window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
await import('../game/src/cards.js');
import { createEffectExecutor, splitEffectClauses, parsePoolNoun } from '../game/src/battle.effects.js';

const C = window.SDT.Cards;

// —— 真实种子流程（与 game.boot.js 一致的顺序）——
beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

// —— 假战斗模块：只记录调用，不动真实战斗 ——
const FakeCombat = {
  TYPES: { ATTACK: 'attack', SPELL: 'spell', FIXED: 'fixed', TRUE: 'true' },
  TYPE_NAME: { attack: '攻击伤害', spell: '法术伤害', fixed: '固定伤害', true: '真实伤害' },
  CURSES: ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban'],
  addCurse: (t, k, n) => { t.status[k] = (t.status[k] || 0) + (n || 1); },
  addBlessing: (t, k, n) => { t.status[k] = (t.status[k] || 0) + (n || 1); },
  purify: (t) => { const ks = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban'].filter(k => (t.status[k] || 0) > 0); ks.forEach(k => { t.status[k] = 0; }); return ks; },
  hasCurse: (t) => Object.values(t.status || {}).some(v => v > 0),
  CURSE_META: { bleed: { name: '流血' }, poison: { name: '中毒' }, freeze: { name: '冰冻' }, silence: { name: '沉默' }, abreak: { name: '破甲' }, healban: { name: '禁疗' } },
  dealDamage: (a, t, amt) => { t.hp = Math.max(0, (t.hp == null ? 0 : t.hp) - amt); return { dealt: amt, log: [] }; },
};

function makeRunner(myClass) {
  const rec = {};
  const foes = [
    { name: '怪A', atk: 4, hp: 20, maxHp: 20, status: {}, defense: { shield: 0, armor: 0, guard: false }, dead: false },
    { name: '怪B', atk: 3, hp: 9, maxHp: 15, status: {}, defense: { shield: 0, armor: 0, guard: false }, dead: false },  // 怪B带伤：供「消灭受伤敌人」类句式判定
  ];
  const pstat = { hp: 30, status: {}, defense: { shield: 0, armor: 0, guard: false } };
  const pdef = { shield: 0, armor: 0, guard: false };
  const applyTextEffects = createEffectExecutor({
    combat: FakeCombat,
    getAlive: () => foes.filter(f => !f.dead),
    getPlayerStatus: () => pstat,
    getPlayerDefense: () => pdef,
    getMode: () => 'boss',
    log: () => {},
    escapeHtml: s => String(s),
    heal: n => { rec.heal = (rec.heal || 0) + n; },
    pushFloat: () => {},
    drawCards: n => { rec.draw = (rec.draw || 0) + n; return n; },
    grantStarterAttack: n => { rec.sha = (rec.sha || 0) + n; },
    markNoDrawNext: () => { rec.noDraw = true; },
    queueDiscover: j => { rec.disc = rec.disc || []; rec.disc.push(j); },
    randomDiscoverCard: pred => {
      const pool = pred ? C.all().filter(c => c.rarity !== '衍生' && !['生物', '事件'].includes(c.type) && pred(c))
        : C.all().filter(c => c.rarity !== '衍生' && C.isRandomObtainable(c));
      return pool.length ? pool[0] : null;
    },
    addTempCard: c => { rec.temp = rec.temp || []; rec.temp.push(c); return 'u1'; },
    addDeckCard: c => { rec.deck = rec.deck || []; rec.deck.push(c); },
    queueHandSelect: j => { rec.sel = rec.sel || []; rec.sel.push(j); },
    restoreConsumed: n => n,
    random01: () => 0.42,
    allCards: () => C.all(),
    shuffleDeck: () => 0,
    addEnergy: n => { rec.energy = (rec.energy || 0) + n; return n; },
    addEnergyCap: n => { rec.energyCap = (rec.energyCap || 0) + n; return n; },
    queueChoice: j => { rec.choice = rec.choice || []; rec.choice.push(j); },
    setStealthStrike: v => { rec.stealthStrike = !!v; },
    setNextSpellTwice: n => { rec.nextTwice = n; },
    getPlayerHp: () => 20,
    getHandSize: () => 4 + ((rec.temp && rec.temp.length) || 0),   // 模拟置入临时卡会增大手牌
    getHandCards: () => [{ uid: 'u0', card: { name: '占位', type: '武术' } }],
    burstPoison: t => ({ dealt: t.status.poison || 0 }),
    deckDraw: ({ n, type }) => { rec.deckDraw = { n, type }; return n; },
    fleeBattle: () => { rec.fled = true; },
    getPlayerClass: () => myClass || '侠客',
    getPlayerCaster: () => ({ atk: 5, spellPower: 2 }),
    foeIndexOf: () => 0,
    releaseHandMatches: k => { rec.released = k; return 2; },
    autoPlayHandType: t => { rec.auto = t; return 1; },
    setShaTransform: n => { rec.shaTo = n; },
    setConsumeFireball: n => { rec.cfb = n; },
    damagePlayer: n => { rec.selfDmg = (rec.selfDmg || 0) + n; },
    addPlayerMaxHp: n => { rec.maxHpUp = (rec.maxHpUp || 0) + n; },
    dumpHand: () => { rec.dumped = (rec.dumped || 0) + 1; return 3; },
  });
  return { applyTextEffects, rec, foes, pstat, pdef };
}

// 含动作关键词的句子才要求被识别；纯风味句不算失败
const ACTION_RE = /造成|伤害|抽|发现|获得|获取|随机|洗入|置入|放入|消耗|攻击|冰冻|冻结|中毒|流血|沉默|破甲|禁疗|净化|回复|治疗|护甲|护盾|能量|法术伤害|法伤|召唤|释放|施放|打出|化为|消灭|复活|弃|免疫|无敌|偷取|降低|翻倍|复制|替换|逃跑|潜行|变为|变成|延|升|夺|诱发|诅咒|门|枪|箭|杀|牌|张/;
const isFlavor = (t) => !ACTION_RE.test(t);

function auditCard(card, myClass) {
  const { applyTextEffects, foes } = makeRunner(myClass);
  const desc = String(card.desc || '');
  const parts = splitEffectClauses(desc);
  const isDmgType = C.DMG_TYPES.includes(card.type);
  const structuredHit = isDmgType && ((+card.dmg || 0) > 0 || card.dmgType === 'attack');
  const unrecognized = [];
  const run = (text) => {
    try { return applyTextEffects(card, text, foes[0], { structuredHit }).did; }
    catch (e) { unrecognized.push(`[崩溃:${e.message}] ${text}`); return true; }
  };
  parts.immediate.forEach(cl => { if (!run(cl) && !isFlavor(cl)) unrecognized.push(cl); });
  parts.turnStart.forEach(it => { if (!run(it.text) && !isFlavor(it.text)) unrecognized.push('回合开始：' + it.text); });
  parts.battle.forEach(cl => {
    const inner = cl.replace(/^(本局对战内|本场对战|本场战斗)[中内]?[：:，,]?\s*/, '');
    if (!run(inner) && !isFlavor(inner)) unrecognized.push('本局：' + inner);
  });
  parts.onInfused.forEach(cl => { if (!run(cl) && !isFlavor(cl)) unrecognized.push('被注能：' + cl); });
  return { card, structuredHit, unrecognized };
}

const BATTLE_TYPES = ['武术', '法术', '装备', '道具', '英雄卡'];

describe('全卡库描述实装审计', () => {
  let bad = [];
  beforeAll(() => {
    bad = [];
    C.all().forEach(card => {
      if (!BATTLE_TYPES.includes(card.type)) return;
      for (const cls of ['侠客', '战士', '牧师', '法师', '降临者', null]) {
        const r = auditCard(card, cls);
        if (r.unrecognized.length) { bad.push(r); break; }
      }
    });
  });
  it('输出未识别清单（人工复核用）', () => {
    const lines = bad.map(r => `【${r.card.name}】(${r.card.type}) => ${r.unrecognized.join(' ⧼ NEXT ⧽ ')}`);
    console.log(`\n===== 未识别句式的战斗卡：${bad.length} 张 =====\n` + lines.join('\n') + '\n');
    expect(true).toBe(true);
  });
  it('不得存在「一打就崩」的描述（此前 getPlayerHp 等端口缺失）', () => {
    const crashed = bad.filter(r => r.unrecognized.some(u => u.includes('[崩溃')));
    expect(crashed).toEqual([]);
  });
});

describe('结构化词条与描述一致性（合并残留检查）', () => {
  it('draw/heal/armor/infuse 字段必须在描述中有依据', () => {
    const warns = [];
    C.all().forEach(c => {
      const d = String(c.desc || '');
      if (+(c.draw || 0) > 0 && !/抽/.test(d)) warns.push(`${c.name}: draw=${c.draw} 但描述无「抽」`);
      if (+(c.heal || 0) > 0 && !/回复|治疗|\+\s*\d+\s*血/.test(d)) warns.push(`${c.name}: heal=${c.heal} 但描述无「回复」`);
      if (+(c.armor || 0) > 0 && !/护甲|甲/.test(d)) warns.push(`${c.name}: armor=${c.armor} 但描述无「护甲」`);
      if (+(c.infuse || 0) > 0 && !/注能/.test(d)) warns.push(`${c.name}: infuse=${c.infuse} 但描述无「注能」`);
    });
    console.log('\n===== 词条与描述不一致：\n' + warns.join('\n'));
    expect(warns).toEqual([]);
  });
});

describe('限制卡池识别验证（老板 2026-09-08 清单）', () => {
  const myClass = '侠客';
  const count = (noun) => C.all().filter(c => c.rarity !== '衍生' && !['生物', '事件'].includes(c.type) && (parsePoolNoun(noun, myClass) || (() => false))(c)).length;
  const cases = [
    ['能施加诅咒的招式', 1], ['能施加诅咒的卡牌', 1], ['招式', 1], ['武术', 1], ['法术', 1],
    ['装备', 1], ['0费招式', 1], ['1费', 1], ['2费', 1], ['古朴', 1], ['英雄卡', 1],
    ['火球系列', 1], ['箭系列', 1], ['本职业', 1], ['其它职业', 1], ['形态', 1],
    ['药水系列', 1], ['杀', 1], ['火球', 1], ['注能', 1], ['传说', 1],
  ];
  it.each(cases)('池子「%s」可识别且非空', (noun) => {
    expect(count(noun)).toBeGreaterThan(0);
  });
  it('通用随机池非空', () => {
    expect(C.all().filter(c => C.isRandomObtainable(c) && c.rarity !== '衍生').length).toBeGreaterThan(0);
  });
});
