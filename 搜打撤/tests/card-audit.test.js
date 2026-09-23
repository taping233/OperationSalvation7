/* 卡牌库实装审计（2026-09-08 老板任务 #4/#6）：
   1) 用真实种子流程灌库 + 真实效果解析器逐句跑描述，防止「一打就崩」的描述进库；
   2) 结构化词条与描述的一致性（合并残留错误词条）；
   3) 老板 2026-09-08 限制卡池清单逐项验证。
   未识别项必须与精确 ID/句式例外清单一致；结构化字段覆盖的句子仍需逐项注明原因，
   新增项或仍在卡池中的过期例外都会让测试失败。 */
import { describe, it, expect, beforeAll } from 'vitest';
import knownAuditFindings from './fixtures/card-effect-audit-known.json';
import { compareEffectAuditFindings } from './helpers/card-effect-audit.js';
window.SDT = window.SDT || { Icons: { img: () => '' } };
// 静态 import 会先于本文件顶层代码执行，此时 sdt-facade 可能已建好 window.SDT（无 Icons）——
// 所以必须补齐而不是直接赋值。
window.SDT.Icons = window.SDT.Icons || { img: () => '' };
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
    // —— 2026-09-09 机制审计补实装端口（真实接线在 battle.core）——
    getInfuseFuels: () => 0,
    getPriceOfLastDrawn: () => 0,
    dealAoeFixed: () => {},
    replaceShaInDeck: () => 0,
    summonAlly: () => { rec.summon = (rec.summon || 0) + 1; },
    setExtraTurn: () => { rec.extraTurn = true; },
    setDeathSave: n => { rec.deathSave = n; },
    queuePouchCast: () => { rec.pouch = true; },
    registerGrowthCard: () => { rec.growth = true; },
    unlockSeal: () => { rec.seal = true; },
    // —— 2026-09-23 第十二批新卡补实装端口（真实接线在 battle.engine）——
    refillEnergy: () => { rec.refilled = true; return 99; },
    isRandomObtainable: c => C.isRandomObtainable(c),
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
    try { return applyTextEffects(card, text, foes[0], { structuredHit, uid: 'audit' }).did; }
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

const BATTLE_TYPES = ['武术', '法术', '装备', '道具', '能力卡'];

describe('全卡库描述实装审计', () => {
  let bad = [];
  beforeAll(() => {
    const findingsById = new Map();
    C.all().forEach(card => {
      if (!BATTLE_TYPES.includes(card.type)) return;
      for (const cls of ['侠客', '战士', '牧师', '法师', '降临者', null]) {
        const r = auditCard(card, cls);
        if (!r.unrecognized.length) continue;
        const finding = findingsById.get(card.id) || { card, unrecognized: new Set() };
        r.unrecognized.forEach(clause => finding.unrecognized.add(clause));
        findingsById.set(card.id, finding);
      }
    });
    bad = [...findingsById.values()].map(({ card, unrecognized }) => ({ card, unrecognized: [...unrecognized] }));
  });
  it('未识别项必须是有明确原因的已知例外', () => {
    const lines = bad.map(r => `【${r.card.name}】(${r.card.type}) => ${r.unrecognized.join(' ⧼ NEXT ⧽ ')}`);
    console.log(`\n===== 未识别句式的战斗卡：${bad.length} 张 =====\n` + lines.join('\n') + '\n');
    const actual = bad.flatMap(r => r.unrecognized.map(clause => ({ id: r.card.id, clause })));
    const availableIds = new Set(C.all().map(card => card.id));
    const { unknown, stale } = compareEffectAuditFindings(actual, knownAuditFindings, availableIds);
    const badReasons = knownAuditFindings.known.filter(item =>
      !['unsupported', 'audit_context'].includes(item.reason?.kind) || !item.reason.detail?.trim());
    expect(badReasons, '每个例外都要标明未支持或审计上下文原因及说明').toEqual([]);
    expect({ unknown, stale }, '新增句式须复核；仍在卡池但已被识别的例外须从 fixture 移除').toEqual({ unknown: [], stale: [] });
  });
  it('发现新增未知句式时比较器必须拒绝', () => {
    const sample = { id: 'audit-negative-sample', clause: '新增未知效果句式' };
    const newClauseOnKnownCard = { id: knownAuditFindings.known[0].id, clause: '同卡新增未知效果句式' };
    const result = compareEffectAuditFindings([sample, newClauseOnKnownCard], knownAuditFindings,
      new Set([sample.id, newClauseOnKnownCard.id]));
    expect(result.unknown).toEqual([sample, newClauseOnKnownCard]);

    const supported = { id: 'supported-card', clause: '已识别效果句式', reason: { kind: 'unsupported', detail: 'fixture example' } };
    expect(compareEffectAuditFindings([], { known: [supported], allowMissingCardIds: [] },
      new Set([supported.id])).stale).toEqual([supported]);

    const optional = { id: 'tt12-optional-sample', clause: '分支特有句式', reason: { kind: 'unsupported', detail: 'fixture example' } };
    expect(compareEffectAuditFindings([], { known: [optional], allowMissingCardIds: [optional.id] }, new Set()).stale).toEqual([]);
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
  // 2026-09-16 留言「把火球设定成衍生」后，「火球」池唯一命中的是衍生火球（三重火球等效果仍会用到），
  // 故池子识别验证不再排除衍生卡，只看谓词命中
  const count = (noun) => C.all().filter(c => !['生物', '事件'].includes(c.type) && (parsePoolNoun(noun, myClass) || (() => false))(c)).length;
  const cases = [
    ['能施加诅咒的招式', 1], ['能施加诅咒的卡牌', 1], ['招式', 1], ['武术', 1], ['法术', 1],
    ['装备', 1], ['0费招式', 1], ['1费', 1], ['2费', 1], ['古朴', 1], ['能力卡', 1],
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
