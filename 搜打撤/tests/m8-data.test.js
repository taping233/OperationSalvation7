import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM8RuleBackfill } from '../game/src/cards/cards.sync.m8.js';
import { ensureCanonicalFaceRefresh } from '../game/src/cards/cards.sync.face-refresh.js';
import { dataSlice } from '../game/src/cards/cards.data.js';
import cardsSyncData from '../game/data/cards-sync.json';

const MARKER = 'sdt-cards-m8-rule-backfill-v1-seeded';
// canonical 夹具（2026-09-29 镜像收编）：原「手写镜像」改为按本批 id 取真源行——
// TABLETOP10/11 取 dataSlice（resolveCardCatalog 数组混有字符串别名元素，按 id 过滤），
// CARDS_SYNC 取 cards-sync.json；卡面字段值不再手抄（petal heal 2→3 一类定版修订
// 只改 cards.data.js 真源即可），真源漂移时以真源为准。
const M8_IDS = ['cmtn1r10xnl1', 'tt3-petal', 'tt7-elementstorm', 'tt7-swordimmortal',
  'tt7-goldencicada', 'cmtn0pbkmnvc', 'cmtn2jc142dj', 'tt3-grope', 'tt7-abysscurse', 'tt7-demonbreaker'];
const rowsById = (table, ids) => table.filter(card => card?.id && ids.includes(card.id));
const TABLETOP10 = rowsById(dataSlice.TABLETOP10, M8_IDS);
const TABLETOP11 = rowsById(dataSlice.TABLETOP11, M8_IDS);
const CARDS_SYNC = rowsById(cardsSyncData.cards, M8_IDS);
const RULES = {
  cmtn0pbkmnvc: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'execute', what: 'starterAttack', perCurseStacks: true }] } },
  cmtn1r10xnl1: { version: 1, triggers: { onPlay: [{ op: 'registerRule', rule: 'discoverPlus' }] } },
  'tt7-elementstorm': { version: 1, triggers: { onPlay: [{ op: 'registerRule', rule: 'doubleNextSpell' }] } },
  'tt3-petal': { version: 1, triggers: { onTurnStart: [{ op: 'draw', amountField: 'draw' }, { op: 'heal', amountField: 'heal' }], duration: 3, onPlay: [] } },
  'tt7-swordimmortal': { version: 1, triggers: { onTurnStart: [{ op: 'draw', amountField: 'draw' }], onPlay: [] } },
  'tt7-goldencicada': { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'draw', amount: 3, handOps: [{ op: 'consumeHand' }] }] } },
  cmtn2jc142dj: { version: 1, triggers: { onTurnStart: [{ op: 'copyRandom' }], onPlay: [] } },
  'tt3-grope': { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'draw', range: [2, 3] }] } },
  'tt7-abysscurse': { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'curse', curse: 'healban', duration: 1, target: 'chosenEnemy' },
    { op: 'draw', perCurseKinds: true },
  ] } },
  'tt7-demonbreaker': { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', onKill: { armor: 4 } },
    { op: 'curse', curse: 'abreak', duration: 2, target: 'chosenEnemy' },
  ] } },
};
// 按测试库形状去重：真源 TABLETOP10 内的 cards-sync 引用解析行（elementstorm/demonbreaker）
// 与 CARDS_SYNC 表行内容一致，生产存档每 id 一行，这里同样收敛为唯一行。
const ALL = [...TABLETOP10, ...TABLETOP11, ...CARDS_SYNC]
  .filter((card, index, list) => list.findIndex(item => item.id === card.id) === index);
const fresh = () => ALL.map(card => ({ ...card }));

function harness(cards) {
  const storageMap = new Map([[KEY, JSON.stringify(cards)]]);
  const storage = {
    getItem: key => storageMap.has(key) ? storageMap.get(key) : null,
    setItem: (key, value) => storageMap.set(key, String(value)),
  };
  let current = cards.map(card => ({ ...card }));
  const library = {
    TABLETOP10, TABLETOP11, CARDS_SYNC,
    all: () => current,
    saves: 0,
    saveAll(next) { this.saves += 1; current = next.map(card => ({ ...card })); storage.setItem(KEY, JSON.stringify(current)); return true; },
  };
  return { storage, library, cards: () => current };
}

describe('M8 rule data backfill', () => {
  for (const source of ALL) {
    const { id } = source;
    it(`${id}: rules pass schema and real-consumer capability gates`, () => {
      const card = { ...source, rules: RULES[id] };
      const validation = validateCardRules(card);
      expect(validation.ok, JSON.stringify(validation.errors)).toBe(true);
      expect(inspectCardRuleCapability(card)).toEqual({ kind: 'supported', ok: true });
    });
    it(`${id}: canonical card is migrated and rereads with marker`, () => {
      const h = harness(fresh());
      ensureM8RuleBackfill(h);
      const card = h.cards().find(item => item.id === id);
      expect(card.rules).toEqual(RULES[id]);
      if (id === 'tt3-petal') {
        const canonicalPetal = TABLETOP11.find(card => card.id === 'tt3-petal');
        expect(card.heal).toBe(canonicalPetal.heal);
        expect(card.desc).toBe(canonicalPetal.desc);
      }
      expect(h.storage.getItem(KEY)).toBe(JSON.stringify(h.cards()));
      expect(h.storage.getItem(MARKER)).toBe('1');
      expect(h.library.saves).toBe(1);
    });
    it(`${id}: modified face or owned rules are conservatively skipped`, () => {
      for (const changed of [
        { ...source, name: '玩家改名' },
        { ...source, value: 99 },
        { ...source, rules: { version: 1 } },
      ]) {
        const h = harness([changed, ...ALL.filter(item => item.id !== id).map(item => ({ ...item }))]);
        ensureM8RuleBackfill(h);
        expect(h.cards().find(item => item.id === id)).toEqual(changed);
      }
    });
  }
  it('missing canonical cards do not write or mark a partial migration', () => {
    const h = harness([ALL[0]]);
    ensureM8RuleBackfill(h);
    expect(h.library.saves).toBe(0);
    expect(h.storage.getItem(MARKER)).toBe(null);
  });
  it('marker is one-shot and save failure remains unmarked', () => {
    const h = harness(fresh());
    ensureM8RuleBackfill(h);
    ensureM8RuleBackfill(h);
    expect(h.library.saves).toBe(1);
    const failed = harness(fresh());
    failed.library.saveAll = () => false;
    ensureM8RuleBackfill(failed);
    expect(failed.storage.getItem(MARKER)).toBe(null);
  });
});

describe('定版卡面刷新器（cards.sync.face-refresh.js）', () => {
  it('老档固化的 heal:2/旧描述被重刷为 canonical 定版，rules 不动，已定版则幂等不落盘', () => {
    const h = harness(fresh());
    ensureM8RuleBackfill(h);
    const stale = h.cards().find(item => item.id === 'tt3-petal');
    stale.heal = 2;
    stale.desc = '回合开始时额外抽1张牌并回复 2 点生命，持续 3 回合。';
    h.library.saveAll(h.cards());
    const savesBefore = h.library.saves;
    ensureCanonicalFaceRefresh({ library: h.library });
    const card = h.cards().find(item => item.id === 'tt3-petal');
    expect(card.heal).toBe(3);
    expect(card.desc).toBe('回合开始时额外抽1张牌并回复 3 点生命，持续 3 回合。');
    expect(card.rules).toEqual(RULES['tt3-petal']);
    expect(h.library.saves).toBe(savesBefore + 1);
    ensureCanonicalFaceRefresh({ library: h.library });
    expect(h.library.saves).toBe(savesBefore + 1);
  });

  it('cc-demon 老档 4′固化为 7′定版（dmg+desc 点名刷新），m2 rules 不动且幂等不落盘', () => {
    const canonicalDemon = dataSlice.TABLETOP7.find(card => card?.id === 'cc-demon');
    expect(canonicalDemon.dmg).toBe(7);   // 2026-10-06 老板拍板 4→7 法伤（真源 cards.data.js）
    const m2Rules = { version: 1, battle: { target: { side: 'enemy', area: false } },
      triggers: { onPlay: [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
        { op: 'heal', selfDamage: 2 },
      ] } };
    const h = harness([...fresh(), { ...canonicalDemon, dmg: 4, desc: '4′，损失 2 点生命。', rules: m2Rules }]);
    const library = { ...h.library, TABLETOP7: [canonicalDemon] };   // 刷新器按注册表读 TABLETOP7 定版
    ensureCanonicalFaceRefresh({ library });
    const card = h.cards().find(item => item.id === 'cc-demon');
    expect(card.dmg).toBe(7);
    expect(card.desc).toBe('7′，损失 2 点生命。');
    expect(card.rules).toEqual(m2Rules);
    expect(library.saves).toBe(1);
    ensureCanonicalFaceRefresh({ library });
    expect(library.saves).toBe(1);   // 已定版幂等不落盘
  });

  it('缺卡或缺定版表时安全退出不落盘；点名外字段不碰', () => {
    const withoutPetal = harness(fresh().filter(card => card.id !== 'tt3-petal'));
    ensureCanonicalFaceRefresh({ library: withoutPetal.library });
    expect(withoutPetal.library.saves).toBe(0);
    const withoutTable = harness(fresh());
    withoutTable.library.TABLETOP11 = [];
    ensureCanonicalFaceRefresh({ library: withoutTable.library });
    expect(withoutTable.library.saves).toBe(0);
    // 玩家改过 name（未点名字段）：不动该字段；heal 偏差仍被点名刷新
    const renamed = harness(fresh());
    renamed.cards().find(item => item.id === 'tt3-petal').name = '玩家改名';
    renamed.cards().find(item => item.id === 'tt3-petal').heal = 2;
    ensureCanonicalFaceRefresh({ library: renamed.library });
    expect(renamed.cards().find(item => item.id === 'tt3-petal').name).toBe('玩家改名');
    expect(renamed.cards().find(item => item.id === 'tt3-petal').heal).toBe(3);
  });
});
