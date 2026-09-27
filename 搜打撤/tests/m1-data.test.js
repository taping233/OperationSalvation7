/* M1 卡牌规则化数据迁移批 D1 锁定（2026-09-27）：cards.sync.m1.js ensureM1OnplayRules。
 * 每张迁的卡一条用例，锁定四件事：
 *   1) validateCardRules 通过；2) inspectCardRuleCapability supported；
 *   3) 回填函数对 canonical 卡生效（rules 与定义逐键一致、落库复读一致、marker 盖章）；
 *   4) 对被改名 / 改字段 / 已有自有 rules 的卡保守跳过。
 * 批次级另锁：marker 一次性、缺卡/缺 canonical/saveAll 失败/无原库串整体保守退出不标记、
 * tt8-dragonblade 旧批次同名副本（TABLETOP8 旧版卡面）不回填。
 * 回填器为 A3 式全批语义（definitions 四张齐备才落库），故运行夹具一律放全量四张 canonical 卡。
 * 纯单元：依赖注入 storage/library，不启动 cards.js 播种链。 */
import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM1OnplayRules } from '../game/src/cards/cards.sync.m1.js';

const MARKER = 'sdt-cards-m1-onplay-rules-v1-seeded';

// canonical 夹具：逐字照抄 cards.data.js TABLETOP10 / TABLETOP11 定版行（这 4 个 id 均不在
// cards-sync，TABLETOP 内联对象即定版真身；若源表日后漂移，回填器按深相等保守跳过，不会写脏）。
const TABLETOP10 = [
  { id: 'starter-attack', name: '初始攻击', cost: 1, rarity: '初始', type: '武术', desc: '攻（+0）：造成等同于攻击力的伤害。', dmg: 0, dmgType: 'attack', value: 1 },
  { id: 'tt3-skewer', name: '穿刺', cost: 1, rarity: '古朴', type: '武术', desc: '攻（+2），附加破甲，持续 1 回合。', dmg: 2, dmgType: 'attack', value: 3 },
  { id: 'tt8-dragonblade', cls: '战士', hero: true, tokenOf: 'tt8-hero-warrior', name: '青龙偃月斩', cost: 2, rarity: '衍生', type: '武术', desc: '攻+6，附加破甲与 1 层流血。', dmg: 6, dmgType: 'attack', value: 8, unrandom: true },
];
const TABLETOP11 = [
  { id: 'tt7-livingwater', cls: '牧师', name: '圣光之源', cost: 2, rarity: '职业', type: '法术', dmg: 0, draw: 5, desc: '抽 5 张牌。', value: 3, sellable: false },
];

// 期望回填结果：version:1 / onPlay 有序 ops，字段风格与 ensureA3* 定义一致。
const EXPECTED_RULES = {
  'starter-attack': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] },
  },
  'tt3-skewer': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'curse', curse: 'abreak', duration: 1, target: 'chosenEnemy' },
    ] },
  },
  'tt8-dragonblade': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'curse', curse: 'abreak', duration: 2, target: 'chosenEnemy' },
      { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
    ] },
  },
  'tt7-livingwater': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [{ op: 'draw', amountField: 'draw' }] },
  },
};

const canonicalById = new Map([...TABLETOP10, ...TABLETOP11].map(card => [card.id, card]));
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
    TABLETOP10,
    TABLETOP11,
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

describe('M1 数据迁移批 D1：每张迁的卡', () => {
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
        ensureM1OnplayRules(harness);
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
          ensureM1OnplayRules(harness);
          const card = harness.cards().find(entry => entry.id === id);
          expect(card, `${label}：卡面不应被改动`).toEqual(variant);
          expect(card.rules, `${label}：不应写入结构化 rules`).toBe(variant.rules);
        }
      });
    });
  }
});

describe('M1 数据迁移批 D1：批次级保守语义', () => {
  it('marker 一次性：盖章后重复执行不再写库', () => {
    const harness = makeHarness(freshCards());
    ensureM1OnplayRules(harness);
    expect(harness.library.saves).toBe(1);
    ensureM1OnplayRules(harness);
    ensureM1OnplayRules(harness);
    expect(harness.library.saves, 'marker 已盖章，重复执行不得再 saveAll').toBe(1);
    expect(harness.cards().filter(card => card.rules).length).toBe(ALL_IDS.length);
  });

  it('库内缺卡：整体保守退出，不标记、不部分回填', () => {
    const harness = makeHarness([{ ...canonicalById.get('starter-attack') }]);
    ensureM1OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards()[0].rules, '缺其余卡时连可迁卡也不写（下次启动重试）').toBeUndefined();
  });

  it('缺 canonical 定版表：整体保守退出，不标记', () => {
    const harness = makeHarness(freshCards());
    delete harness.library.TABLETOP11;
    ensureM1OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards().some(card => card.rules)).toBe(false);
  });

  it('saveAll 返回 false：不标记', () => {
    const harness = makeHarness(freshCards());
    harness.library.saveAll = () => false;
    ensureM1OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('无原库串（raw == null）：保守退出不标记', () => {
    const harness = makeHarness(freshCards());
    harness.storage = makeStorage();   // 无 KEY 原库串
    ensureM1OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('tt8-dragonblade 旧批次同名副本（TABLETOP8 旧版卡面）：跳过不写脏，其余三张正常迁移', () => {
    const legacy = {
      id: 'tt8-dragonblade', name: '青龙偃月斩', cost: 0, rarity: '衍生', type: '武术', cls: '战士',
      tokenOf: 'tt8-hero-warrior', unrandom: true, dmg: 6, dmgType: 'attack', desc: '攻6，破甲，流血。', value: 8,
    };
    const others = ALL_IDS.filter(id => id !== 'tt8-dragonblade').map(id => ({ ...canonicalById.get(id) }));
    const harness = makeHarness([{ ...legacy }, ...others]);
    ensureM1OnplayRules(harness);
    // 旧副本卡面与 TABLETOP10 定版深不相等 → 按 id 计数在批内但深等校验不过 → 保守跳过
    expect(harness.cards().find(card => card.id === 'tt8-dragonblade')).toEqual(legacy);
    expect(harness.cards().find(card => card.id === 'tt8-dragonblade').rules).toBeUndefined();
    for (const id of ALL_IDS.filter(id => id !== 'tt8-dragonblade')) {
      expect(harness.cards().find(card => card.id === id).rules).toEqual(EXPECTED_RULES[id]);
    }
  });
});
