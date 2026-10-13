/* M2 卡牌规则化数据迁移批 D3 锁定（2026-09-27）：cards.sync.m2.js ensureM2OnplayRules。
 * 每张迁的卡（16 张）三条用例，锁定四件事：
 *   1) validateCardRules 通过；2) inspectCardRuleCapability supported；
 *   3) 回填函数对 canonical 卡生效（rules 与定义逐键一致、落库复读一致、marker 盖章）；
 *   4) 对被改名 / 改字段 / 已有自有 rules 的卡保守跳过。
 * 批次级另锁：marker 一次性、缺卡/缺 canonical/saveAll 失败/无原库串整体保守退出不标记、
 * 单卡被改只跳过该卡其余正常迁移。
 * 回填器为 A3 式全批语义（definitions 16 张齐备才落库），故运行夹具一律放全量 16 张 canonical 卡。
 * 纯单元：依赖注入 storage/library，不启动 cards.js 播种链。 */
import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM2OnplayRules } from '../game/src/cards/cards.sync.m2.js';
import { dataSlice } from '../game/src/cards/cards.data.js';
import cardsSyncData from '../game/data/cards-sync.json';

const MARKER = 'sdt-cards-m2-onplay-rules-v1-seeded';

// canonical 夹具（2026-09-29 镜像收编）：原「逐字照抄定版行」改为按本批 id 取真源行——
// TABLETOP7/10/11/12 取 dataSlice，cc-chase-slash 定版真身取 cards-sync.json（cards.js
// 装配为 CARDS_SYNC 表）；resolveCardCatalog 数组混有字符串别名元素，按 id 过滤。
// 卡面字段值不再手抄，真源漂移时以真源为准（深相等守卫按真源判定，不会写脏）。
const M2_IDS = ['cc-chase-slash', 'tt2-comboarrow', 'tt2-forestarrow', 'tt2-piercearrow',
  'tt2-swiftarrow', 'tt7-fullstrike', 'tt7-throwblade', 'cc-demon', 'cmtn28jv33wx',
  'tt12-breakthrough', 'tt12-sporewall', 'tt3-firm-barrier', 'tt3-flame-storm',
  'tt3-nature-form', 'tt3-toxin', 'tt7-silence'];
const rowsById = (table, ids) => table.filter(card => card?.id && ids.includes(card.id));
const CARDS_SYNC = rowsById(cardsSyncData.cards, M2_IDS);
const TABLETOP7 = rowsById(dataSlice.TABLETOP7, M2_IDS);
const TABLETOP10 = rowsById(dataSlice.TABLETOP10, M2_IDS);
const TABLETOP11 = rowsById(dataSlice.TABLETOP11, M2_IDS);
const TABLETOP12 = rowsById(dataSlice.TABLETOP12, M2_IDS);

// 期望回填结果：version:1 / onPlay 有序 ops，字段风格与 ensureA3* / ensureM1 定义一致。
// 混合目标卡（敌方主体 + 自身域字面量效果 op）走 M1 混合放行：battle.target 声明敌方主体。
const ENEMY_ONE = { side: 'enemy', area: false };
const EXPECTED_RULES = {
  'cc-chase-slash': {
    version: 1,
    battle: { target: ENEMY_ONE, costModifiers: [{ kind: 'martialPlayedDiscount', amount: 1 }] },
    triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] },
  },
  'tt2-comboarrow': {
    version: 1,
    battle: { target: ENEMY_ONE, costModifiers: [{ kind: 'previousCardTypeFree', type: '武术' }] },
    triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] },
  },
  'tt2-forestarrow': {
    version: 1,
    battle: { target: ENEMY_ONE },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'armor', amount: 3 },
    ] },
  },
  'tt2-piercearrow': {
    version: 1,
    battle: { target: ENEMY_ONE },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'armor', amount: 3 },
    ] },
  },
  'tt2-swiftarrow': {
    version: 1,
    battle: { target: ENEMY_ONE },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'draw', amount: 1 },
    ] },
  },
  'tt7-fullstrike': {
    version: 1,
    battle: { target: ENEMY_ONE },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'draw', amount: 1 },
    ] },
  },
  'tt7-throwblade': {
    version: 1,
    battle: { target: ENEMY_ONE },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
      { op: 'draw', amount: 1 },
    ] },
  },
  'cc-demon': {
    version: 1,
    battle: { target: ENEMY_ONE },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'heal', selfDamage: 2 },
    ] },
  },
  'cmtn28jv33wx': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [{ op: 'acquire', n: 3, pool: { kind: '随机' }, dest: 'hand' }] },
  },
  'tt12-breakthrough': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [
      { op: 'acquire', n: 1, pool: { kind: '0费招式' }, dest: 'hand' },
      { op: 'acquire', n: 1, pool: { kind: '1费招式' }, dest: 'hand' },
      { op: 'acquire', n: 1, pool: { kind: '2费招式' }, dest: 'hand' },
    ] },
  },
  'tt12-sporewall': {
    version: 1,
    battle: { target: ENEMY_ONE },
    triggers: { onPlay: [
      { op: 'curse', curse: 'poison', stacks: 2, target: 'chosenEnemy' },
      { op: 'armor', amount: 6 },
    ] },
  },
  'tt3-firm-barrier': {
    version: 1,
    battle: { target: ENEMY_ONE },
    triggers: { onPlay: [
      { op: 'curse', curse: 'freeze', duration: 1, extend: 1, target: 'chosenEnemy' },
      { op: 'draw', amount: 1 },
    ] },
  },
  'tt3-flame-storm': {
    version: 1,
    battle: { target: { side: 'enemy', area: true } },
    triggers: { onPlay: [{ op: 'damage', amount: 4, target: 'allEnemies' }] },
  },
  'tt3-nature-form': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [{ op: 'energyCap', n: 1 }] },
  },
  'tt3-toxin': {
    version: 1,
    battle: { target: ENEMY_ONE },
    triggers: { onPlay: [
      { op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy' },
      { op: 'draw', amount: 1 },
    ] },
  },
  'tt7-silence': {
    version: 1,
    battle: { target: ENEMY_ONE },
    triggers: { onPlay: [
      { op: 'curse', curse: 'silence', duration: 1, target: 'chosenEnemy' },
      { op: 'draw', amount: 1 },
    ] },
  },
};

const canonicalById = new Map([...CARDS_SYNC, ...TABLETOP7, ...TABLETOP10, ...TABLETOP11, ...TABLETOP12]
  .map(card => [card.id, card]));
const ALL_IDS = [...canonicalById.keys()];
const freshCards = () => ALL_IDS.map(id => ({ ...canonicalById.get(id) }));

// v37 同步源已直接带上回音箭的 M2 规则；其余定版卡仍由本批保守回填。
const syncedEchoArrow = canonicalById.get('tt2-forestarrow');

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
  };
}

// 生产形态的假库：saveAll 把全量数组 JSON 串写入 storeKey（cards.js saveAll 同款持久化形状），
// 供回填器「成功后复读确认」比对；saves 计数供 marker 一次性断言。
function makeHarness(cards) {
  let store = cards.map(card => ({ ...card }));
  const storage = makeStorage({ [KEY]: JSON.stringify(store) });
  const library = {
    CARDS_SYNC,
    TABLETOP7,
    TABLETOP10,
    TABLETOP11,
    TABLETOP12,
    saves: 0,
    all: () => store,
    saveAll(next) {
      this.saves += 1;
      store = next.map(card => ({ ...card }));
      storage.setItem(KEY, JSON.stringify(store));
      return true;
    },
  };
  return { storage, library, cards: () => store };
}

describe('M2 数据迁移批 D3：每张迁的卡', () => {
  it('已同步回音箭的名称与规则和 M2 定版完全一致', () => {
    expect(syncedEchoArrow.name).toBe('回音箭');
    expect(syncedEchoArrow.rules).toEqual(EXPECTED_RULES['tt2-forestarrow']);
  });

  for (const id of ALL_IDS) {
    describe(id, () => {
      it('validateCardRules 通过且 inspectCardRuleCapability supported（回填后的 rules 形状）', () => {
        const card = { ...canonicalById.get(id), rules: EXPECTED_RULES[id] };
        const validation = validateCardRules(card);
        expect(validation.ok, `${id} schema 校验失败：${JSON.stringify(validation.errors)}`).toBe(true);
        const capability = inspectCardRuleCapability(card);
        expect(capability.ok, `${id} 能力门拒绝：${JSON.stringify(capability.issues)}`).toBe(true);
        expect(capability.kind).toBe('supported');
      });

      it('回填或保留 canonical 规则：rules 逐键一致、卡面不动、落库复读一致、marker 盖章', () => {
        const harness = makeHarness(freshCards());
        ensureM2OnplayRules(harness);
        const card = harness.cards().find(entry => entry.id === id);
        expect(card.rules, `${id} 应被回填结构化 rules`).toEqual(EXPECTED_RULES[id]);
        // 除 rules 外卡面一字未动
        const face = Object.fromEntries(Object.entries(card).filter(([key]) => key !== 'rules'));
        const canonicalFace = Object.fromEntries(Object.entries(canonicalById.get(id)).filter(([key]) => key !== 'rules'));
        expect(face).toEqual(canonicalFace);
        // 成功后复读确认：storage 串与库内容一致；全批一次保存、单枚 marker
        expect(harness.storage.getItem(KEY)).toBe(JSON.stringify(harness.cards()));
        expect(harness.storage.getItem(MARKER)).toBe('1');
        expect(harness.library.saves).toBe(1);
      });

      it('保守跳过：被改名 / 改字段 / 已有自有 rules 的卡一律不回填', () => {
        const variants = [
          ['被改名', { ...canonicalById.get(id), name: '玩家改名' }],
          ['改字段', { ...canonicalById.get(id), dmg: 99, value: 9 }],
          ['已有自有 rules', { ...canonicalById.get(id), rules: { version: 1, bag: { use: [] } } }],
        ];
        for (const [label, variant] of variants) {
          const others = ALL_IDS.filter(other => other !== id).map(other => ({ ...canonicalById.get(other) }));
          const harness = makeHarness([variant, ...others]);
          ensureM2OnplayRules(harness);
          const card = harness.cards().find(entry => entry.id === id);
          expect(card, `${label}：卡面不应被改动`).toEqual(variant);
          expect(card.rules, `${label}：不应写入结构化 rules`).toBe(variant.rules);
        }
      });
    });
  }
});

describe('M2 数据迁移批 D3：批次级保守语义', () => {
  it('marker 一次性：盖章后重复执行不再写库', () => {
    const harness = makeHarness(freshCards());
    ensureM2OnplayRules(harness);
    expect(harness.library.saves).toBe(1);
    ensureM2OnplayRules(harness);
    ensureM2OnplayRules(harness);
    expect(harness.library.saves, 'marker 已盖章，重复执行不得再 saveAll').toBe(1);
    expect(harness.cards().filter(card => card.rules).length).toBe(ALL_IDS.length);
  });

  it('库内缺卡：整体保守退出，不标记、不部分回填', () => {
    const harness = makeHarness([{ ...canonicalById.get('tt3-toxin') }]);
    ensureM2OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards()[0].rules, '缺其余卡时连可迁卡也不写（下次启动重试）').toBeUndefined();
  });

  it('缺 canonical 定版表：整体保守退出，不标记', () => {
    const harness = makeHarness(freshCards());
    const originalCards = structuredClone(harness.cards());
    delete harness.library.TABLETOP12;
    ensureM2OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards()).toEqual(originalCards);
  });

  it('saveAll 返回 false：不标记', () => {
    const harness = makeHarness(freshCards());
    harness.library.saveAll = () => false;
    ensureM2OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('无原库串（raw == null）：保守退出不标记', () => {
    const harness = makeHarness(freshCards());
    harness.storage = makeStorage();   // 无 KEY 原库串
    ensureM2OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('单卡被改（旧副本卡面）：该卡保守跳过，其余 15 张正常迁移', () => {
    const legacy = { ...canonicalById.get('tt2-swiftarrow'), desc: '旧批次措辞', draw: 2 };
    const others = ALL_IDS.filter(id => id !== 'tt2-swiftarrow').map(id => ({ ...canonicalById.get(id) }));
    const harness = makeHarness([{ ...legacy }, ...others]);
    ensureM2OnplayRules(harness);
    expect(harness.cards().find(card => card.id === 'tt2-swiftarrow')).toEqual(legacy);
    expect(harness.cards().find(card => card.id === 'tt2-swiftarrow').rules).toBeUndefined();
    for (const id of ALL_IDS.filter(id => id !== 'tt2-swiftarrow')) {
      expect(harness.cards().find(card => card.id === id).rules).toEqual(EXPECTED_RULES[id]);
    }
    expect(harness.storage.getItem(MARKER)).toBe('1');
  });
});
