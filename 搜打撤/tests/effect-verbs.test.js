/* 牌效动词注册表 + 未识别子句哨兵（2026-09-11 架构批次 3）
 *
 * 三件事：
 *   1. 注册表卫生：id 唯一、pattern 是正则、每项有可读 label；
 *   2. 覆盖度（硬断言）：全卡库每一句「有效果」的描述都必须被注册表认识
 *      （已实装动词 / 外部层实装 / 明确登记的设计者留白），否则构建失败——
 *      这是「新卡文案没实装」的报警器；
 *   3. 行为等价：ELSEWHERE 表是执行器原「识别补丁」白名单的搬家，句式冻结快照，
 *      改动会红——避免识别面被悄悄扩大/缩小（识别面直接影响 did 返回值）。
 * 另含哨兵的单测：牌面像有效果却没结算也没被认领时，记入 UNKNOWN_EFFECTS。 */
import { beforeEach, describe, expect, it } from 'vitest';
import frozenElsewhere from './fixtures/effect-elsewhere-frozen.json';
import { createEffectExecutor, splitEffectClauses } from '../game/src/battle/battle.effects.js';
import { DESIGNER_BLANKS, ELSEWHERE, VERBS, getUnknownEffects, isRecognized, looksLikeEffect, matchVerbs, resetUnknownEffects } from '../game/src/battle/effect-verbs.js';

window.SDT = window.SDT || {};
window.SDT.Icons = window.SDT.Icons || { img: () => '' };
window.SDT.Icons.TYPE_ART = {};
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;

const BUCKETS = ['immediate', 'turnStart', 'battle', 'onInfused', 'onDraw', 'skill'];
const BATTLE_TYPES = ['武术', '法术', '装备', '道具', '能力卡'];
const clauseText = (item) => (typeof item === 'string' ? item : item.text);

/** 收集全卡库所有子句（按 splitEffectClauses 的正式分桶）。 */
function allClauses() {
  const out = [];
  for (const card of C.all()) {
    if (!BATTLE_TYPES.includes(card.type)) continue;
    const parts = splitEffectClauses(String(card.desc || ''));
    for (const bucket of BUCKETS) {
      for (const item of parts[bucket]) {
        const text = clauseText(item);
        // 「本局对战内」前缀句与外层同义，检查内层（与执行器一致）
        const inner = bucket === 'battle' ? text.replace(/^(本局对战内|本场对战|本场战斗)[中内]?[：:，,]?\s*/, '') : text;
        out.push({ card: card.name, bucket, text, inner });
      }
    }
  }
  return out;
}

/** 最小可用的执行器环境：只喂「不认识就不会被调用」的哑端口。 */
function makeExecutor() {
  const rec = { logs: [] };
  const applyTextEffects = createEffectExecutor({
    combat: { TYPES: {}, TYPE_NAME: {}, CURSES: [], CURSE_META: {}, addCurse() {}, addBlessing() {}, purify() {}, hasCurse: () => false, dealDamage: () => ({ dealt: 0, log: [] }) },
    getAlive: () => [],
    getPlayerStatus: () => ({ hp: 30, status: {}, defense: { shield: 0, armor: 0, guard: false } }),
    getPlayerDefense: () => ({ shield: 0, armor: 0, guard: false }),
    getMode: () => 'boss',
    log: (m) => rec.logs.push(String(m)),
    escapeHtml: (s) => String(s),
    heal: () => {},
    pushFloat: () => {},
    drawCards: () => 1,
    getPlayerHp: () => 30,
    getHandSize: () => 0,
    getHandCards: () => [],
    getPlayerClass: () => '侠客',
    getPlayerCaster: () => ({ atk: 4, spellPower: 1 }),
    allCards: () => C.all(),
    random01: () => 0.5,
  });
  return { applyTextEffects, rec };
}

describe('牌效动词注册表', () => {
  it('注册表卫生：id 唯一、pattern 为正则、label 可读、留白显式登记', () => {
    const tables = { VERBS, ELSEWHERE, DESIGNER_BLANKS };
    const ids = [];
    for (const [name, table] of Object.entries(tables)) {
      expect(table.length, `${name} 不应为空`).toBeGreaterThan(0);
      for (const v of table) {
        expect(v.id, `${name} 条目缺 id`).toBeTruthy();
        expect(v.pattern, `${name}.${v.id} 的 pattern 应为正则`).toBeInstanceOf(RegExp);
        expect(v.pattern.source.length, `${name}.${v.id} 的 pattern 不应为空`).toBeGreaterThan(0);
        expect(v.label, `${name}.${v.id} 缺可读 label`).toBeTruthy();
        ids.push(`${name}:${v.id}`);
      }
    }
    expect(new Set(ids).size, `注册表 id 有重复：${ids.join(',')}`).toBe(ids.length);
    // 留白是「已知未实装」清单，只应显式存在少量；新增必须是有意登记
    expect(DESIGNER_BLANKS.length).toBeLessThanOrEqual(3);
    expect(DESIGNER_BLANKS.every(v => !v.impl)).toBe(true);
  });

  it('覆盖度：全卡库每一句有效果的描述都被注册表认识（未实装文案会红）', () => {
    const unknowns = allClauses()
      .filter(({ text, inner }) => looksLikeEffect(inner) && !isRecognized(inner, { structuredHit: true, infusedLead: /^\s*注能/.test(text) }))
      .map(({ card, bucket, inner }) => `${card} [${bucket}] ${inner}`);
    expect(unknowns, `以下描述既没被注册表认识，也没有实现：\n${unknowns.join('\n')}`).toEqual([]);
  });

  it('覆盖度不是靠宽泛正则糊过去的：风味句不进覆盖范围', () => {
    expect(looksLikeEffect('向深渊献上敬意')).toBe(false);
    expect(looksLikeEffect('抽 1 张牌')).toBe(true);
    expect(isRecognized('向深渊献上敬意')).toBe(false);
  });

  it('识别面冻结：ELSEWHERE 是执行器原「识别补丁」白名单的等价搬家', () => {
    // 快照由 HEAD 版 battle.effects.js 的识别补丁块机械抽取（见 fixtures 内 provenance），
    // 不是照着现表反抄：现表若被扩大/缩小/改门控，这里就会红。
    const frozen = frozenElsewhere.entries.map(e => `${e.gate || '-'}:${e.source}`);
    const actual = ELSEWHERE.map(v => `${v.gate || '-'}:${v.pattern.source}`);
    expect(actual).toEqual(frozen);
    expect(actual).toHaveLength(frozenElsewhere.entries.length);
  });
});

describe('未识别子句哨兵', () => {
  beforeEach(() => resetUnknownEffects());

  it('牌面有效果、执行器没结算、注册表也不认识 → 记录一条', () => {
    const { applyTextEffects } = makeExecutor();
    const card = { name: '测试卡', type: '法术', desc: '对敌人造成 3 点诡异伤害' };
    const result = applyTextEffects(card, '对敌人造成 3 点诡异伤害', null, {});
    expect(Object.keys(result).sort()).toEqual(['armored', 'did', 'drawn', 'healed']);
    expect(result.did).toBe(false);
    const unknown = getUnknownEffects();
    expect(unknown).toHaveLength(1);
    expect(unknown[0]).toMatchObject({ card: '测试卡', text: '对敌人造成 3 点诡异伤害', count: 1 });
  });

  it('已实装句式不报警，重复出现只累计次数', () => {
    const { applyTextEffects } = makeExecutor();
    const card = { name: '测试卡', type: '法术', desc: '' };
    expect(applyTextEffects(card, '抽 1 张牌', null, {}).did).toBe(true);
    expect(getUnknownEffects()).toEqual([]);
    applyTextEffects(card, '对敌人造成 3 点诡异伤害', null, {});
    applyTextEffects(card, '对敌人造成 3 点诡异伤害', null, {});
    expect(getUnknownEffects()).toEqual([expect.objectContaining({ count: 2 })]);
  });

  it('纯风味句不报警（避免噪音淹掉真正的未识别）', () => {
    const { applyTextEffects } = makeExecutor();
    applyTextEffects({ name: '测试卡', type: '法术' }, '向深渊献上敬意', null, {});
    expect(getUnknownEffects()).toEqual([]);
  });

  it('外部层实装的句式不报警（识别补丁仍生效）', () => {
    const { applyTextEffects } = makeExecutor();
    const result = applyTextEffects({ name: '沉船宝盒', type: '装备' }, '消耗该牌时，造成 4 点固定伤害', null, {});
    expect(result.did).toBe(true);
    expect(getUnknownEffects()).toEqual([]);
    expect(matchVerbs('消耗该牌时，造成 4 点固定伤害').length).toBeGreaterThan(0);
  });
});
