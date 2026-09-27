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

const MARKER = 'sdt-cards-m2-onplay-rules-v1-seeded';

// canonical 夹具：逐字照抄 cards.data.js TABLETOP7/10/11/12 定版行与 game/data/cards-sync.json
// （cc-chase-slash 定版真身在 cards-sync，cards.js 装配为 CARDS_SYNC 表；若源表日后漂移，
// 回填器按深相等保守跳过，不会写脏）。
const CARDS_SYNC = [
  { id: 'cc-chase-slash', name: '追斩', cost: 2, rarity: '稀有', type: '武术', dmg: 0, dmgType: 'attack', desc: '攻（+0），本回合每打出一张其他武术，费用-1。', value: 2 },
];
const TABLETOP7 = [
  { id: 'cc-demon', name: '恶魔之力', cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, dmg: 4, dmgType: 'spell', desc: '4′，损失 2 点生命。', value: 3 },
];
const TABLETOP10 = [
  { id: 'tt2-swiftarrow', name: '迅疾箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），抽 1 张牌。', dmg: -1, dmgType: 'attack', draw: 1, value: 2 },
  { id: 'tt2-comboarrow', name: '连击箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1）；如果你打出的上一张牌是武术牌，本牌变为0费。', dmg: -1, dmgType: 'attack', value: 2 },
  { id: 'tt2-piercearrow', name: '破甲箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），获得 3 点护甲。', dmg: -1, dmgType: 'attack', armor: 3, value: 2 },
  { id: 'tt2-forestarrow', name: '绿化箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），+3 甲。', dmg: -1, dmgType: 'attack', armor: 3, value: 2 },
  { id: 'tt3-toxin', name: '毒药', cost: 0, rarity: '古朴', type: '法术', desc: '附加 1 层中毒。抽 1 张牌。', dmg: 0, draw: 1, value: 2 },
  { id: 'tt3-nature-form', name: '自然形态', cost: 2, rarity: '稀有', type: '法术', desc: '本局战斗中，能量上限 +1。', dmg: 0, value: 3 },
  { id: 'tt3-firm-barrier', cls: '法师', name: '坚冰结界', cost: 0, rarity: '职业', type: '法术', desc: '延长 1 名角色的冰冻 1 回合，抽1张牌。', dmg: 0, draw: 1, value: 3, unrandom: true },
  { id: 'tt7-throwblade', cls: '侠客', name: '飞刃偷袭', cost: 0, rarity: '职业', type: '武术', desc: '攻（-3），附加流血，抽 1 张牌。', dmg: -3, dmgType: 'attack', draw: 1, value: 3, unrandom: true },
  { id: 'tt7-silence', cls: '牧师', name: '禁言术', cost: 0, rarity: '职业', type: '法术', desc: '沉默 1 名角色 1 回合，抽 1 张牌。', dmg: 0, draw: 1, value: 3, unrandom: true },
  { id: 'tt7-fullstrike', cls: '战士', name: '全力一击', cost: 2, rarity: '职业', type: '武术', desc: '攻（+5），抽 1 张牌。', dmg: 5, dmgType: 'attack', draw: 1, value: 2, unrandom: true },
];
const TABLETOP11 = [
  { id: 'cmtn28jv33wx', name: '搜索大宝箱', cost: 0, rarity: '衍生', type: '法术', dmg: 0, desc: '随机获取3张卡牌', value: 3, sellable: false },
  { id: 'tt3-flame-storm', cls: '降临者', name: '风暴火球', cost: 2, rarity: '职业', type: '法术', dmg: 4, dmgType: 'spell', desc: '对全体敌人每人释放1次火球。', value: 3, sellable: false, unrandom: true },
];
const TABLETOP12 = [
  { id: 'tt12-sporewall', name: '孢子城墙', cost: 1, rarity: '古朴', type: '法术', armor: 6, desc: '对一名敌人附加2层中毒，自己获得6点护甲' },
  { id: 'tt12-breakthrough', name: '突破进展', cost: 1, rarity: '稀有', type: '法术', desc: '随机获取1张0费，一张1费，一张2费招式' },
];

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

      it('回填函数对 canonical 卡生效：rules 逐键一致、卡面不动、落库复读一致、marker 盖章', () => {
        const harness = makeHarness(freshCards());
        ensureM2OnplayRules(harness);
        const card = harness.cards().find(entry => entry.id === id);
        expect(card.rules, `${id} 应被回填结构化 rules`).toEqual(EXPECTED_RULES[id]);
        // 除 rules 外卡面一字未动
        const face = Object.fromEntries(Object.entries(card).filter(([key]) => key !== 'rules'));
        expect(face).toEqual(canonicalById.get(id));
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
    delete harness.library.TABLETOP12;
    ensureM2OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards().some(card => card.rules)).toBe(false);
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
