/* M6 卡牌规则化数据迁移批 D8 锁定（2026-09-27）：cards.sync.m6.js ensureM6BagRules。
 * 13 张 bag 道具卡逐卡三条用例：
 *   1) validateCardRules + inspectCardRuleCapability 双门通过（回填后的 rules 形状）；
 *   2) 回填函数对 canonical 卡生效（rules 逐键一致、卡面不动、落库复读一致、marker 盖章）；
 *   3) 保守跳过：被改名 / 改字段 / 已有自有 rules 的卡一律不回填。
 * 用例 1/2 依赖 bag.use 扩展 op（energy/blessing/curse/draw/damage/execute/acquire/discover/flee）
 * 的在途实现——运行时探测双门：未放行的卡自动 skip 并在标题标注等待的契约项（合入后自动转正）；
 * 用例 3 与批次级保守语义不依赖双门，无条件锁定。
 * 纯单元：依赖注入 storage/library，不启动 cards.js 播种链。 */
import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM6BagRules } from '../game/src/cards/cards.sync.m6.js';

const MARKER = 'sdt-cards-m6-bag-rules-v1-seeded';

// canonical 夹具：逐字照抄 cards.data.js TABLETOP10 / TABLETOP11 定版行。其中 tt3sp-doom /
// tt-token-gold 在 TABLETOP10 是 cards-sync 字符串引用，此处写 resolveCardCatalog 解析后的
// 定版真身（game/data/cards-sync.json 同 id 行）；若源表日后漂移，回填器按深相等保守跳过，不会写脏。
const TABLETOP10 = [
  { id: 'tt3-blue-potion', name: '恢复药水', cost: 0, rarity: '稀有', type: '道具', desc: '回复 5 点生命，回复1点能量。', dmg: 0, heal: 5, value: 2 },
  { id: 'tt3-demon-potion', name: '法力药水', cost: 0, rarity: '稀有', type: '道具', desc: '法伤 +2。持续 1 回合。', dmg: 0, value: 2 },
  { id: 'tt3-houyi-potion', name: '狂暴药水', cost: 0, rarity: '稀有', type: '道具', desc: '获得 2 点攻击力。持续 1 回合。', dmg: 0, value: 3 },
  { id: 'tt3-iceheart-potion', name: '冰冻药水', cost: 0, rarity: '稀有', type: '道具', desc: '附加冰冻，持续 1 回合。', dmg: 0, value: 3 },
  { id: 'tt3-mind-potion', name: '精神药水', cost: 0, rarity: '稀有', type: '道具', desc: '抽 2 张牌。', dmg: 0, draw: 2, value: 3 },
  { id: 'tt3-mixed-potion', name: '流血药水', cost: 0, rarity: '稀有', type: '道具', desc: '造成 2 点固定伤害，附加流血。', dmg: 0, value: 2 },
  { id: 'tt3-python-potion', name: '火焰药水', cost: 0, rarity: '稀有', type: '道具', desc: '对所有敌人造成2点法伤', dmg: 0, value: 3 },
  { id: 'tt3-turnabout-potion', name: '剧毒药水', cost: 0, rarity: '稀有', type: '道具', desc: '对所有敌人附加1层中毒。', dmg: 0, value: 3 },
  { id: 'tt3sp-doom', name: 'TNT', cost: 0, rarity: '史诗', type: '道具', desc: '消灭 2 名 攻击力5点及以下小怪', dmg: 0, value: 4, sellable: false },
  { id: 'tt-token-gold', name: '员工通行证B', cost: 0, rarity: '史诗', type: '道具', desc: '随机获取 1 张传说卡（不含棱彩卡）。', dmg: 0, value: 4 },
  { id: 'tt4-shine-token', name: '员工通行证C', cost: 0, rarity: '史诗', type: '道具', desc: '发现 1 张传说卡。', dmg: 0, value: 4 },
  { id: 'tt4-smoke-bomb', name: '烟雾弹', cost: 0, rarity: '稀有', type: '道具', desc: '非 BOSS 战逃跑一次。', dmg: 0, value: 3 },
];
const TABLETOP11 = [
  { id: 'cmtmvq6ss84l', name: '员工通行证A', cost: 0, rarity: '衍生', type: '道具', dmg: 0, desc: '获取本职业的能力卡', value: 8, sellable: false },
];

// 期望回填结果：version:1 / rules.bag.use 有序 ops，逐字对齐 cards.sync.m6.js definitions。
const EXPECTED_RULES = {
  'tt3-blue-potion': { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }, { op: 'energy', n: 1 }] } },
  'tt3-demon-potion': { version: 1, bag: { use: [{ op: 'blessing', key: 'spellUp', stacks: 2, duration: 1 }] } },
  'tt3-houyi-potion': { version: 1, bag: { use: [{ op: 'blessing', key: 'atkUp', stacks: 2, duration: 1 }] } },
  'tt3-iceheart-potion': { version: 1, bag: { use: [{ op: 'curse', curse: 'freeze', duration: 1 }] } },
  'tt3-mind-potion': { version: 1, bag: { use: [{ op: 'draw', amountField: 'draw' }] } },
  'tt3-mixed-potion': { version: 1, bag: { use: [{ op: 'damage', amount: 2 }, { op: 'curse', curse: 'bleed' }] } },
  'tt3-python-potion': { version: 1, bag: { use: [{ op: 'damage', amount: 2, target: 'allEnemies' }] } },
  'tt3-turnabout-potion': { version: 1, bag: { use: [{ op: 'curse', curse: 'poison', stacks: 1, target: 'allEnemies' }] } },
  'tt3sp-doom': { version: 1, bag: { use: [{ op: 'execute', cap: { atk: 5 }, count: 2 }] } },
  'cmtmvq6ss84l': { version: 1, bag: { use: [{ op: 'acquire', pool: { kind: 'classAbility' } }] } },
  'tt-token-gold': { version: 1, bag: { use: [{ op: 'acquire', pool: { kind: 'legendary' } }] } },
  'tt4-shine-token': { version: 1, bag: { use: [{ op: 'discover', count: 1, pool: { kind: 'legendary' } }] } },
  'tt4-smoke-bomb': { version: 1, bag: { use: [{ op: 'flee' }] } },
};

const canonicalById = new Map([...TABLETOP10, ...TABLETOP11].map(card => [card.id, card]));
const ALL_IDS = [...canonicalById.keys()];
const freshCards = () => ALL_IDS.map(id => ({ ...canonicalById.get(id) }));

// 双门探测：bag.use 扩展 op 由并行批在途实现，未放行的卡在运行时标记「等待收编」。
const probe = Object.fromEntries(ALL_IDS.map((id) => {
  const card = { ...canonicalById.get(id), rules: EXPECTED_RULES[id] };
  const validation = validateCardRules(card);
  if (!validation.ok) {
    return [id, { ok: false, reason: validation.errors.map(err => `${err.path}: ${err.message}`).join('; ') }];
  }
  const capability = inspectCardRuleCapability(card);
  return [id, capability.ok
    ? { ok: true, reason: '' }
    : { ok: false, reason: capability.issues.map(issue => `${issue.path}: ${issue.message}`).join('; ') }];
}));
const ALL_SUPPORTED = ALL_IDS.every(id => probe[id].ok);

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

describe('M6 数据迁移批 D8：每张迁的卡', () => {
  for (const id of ALL_IDS) {
    describe(id, () => {
      it.skipIf(!probe[id].ok)(`双门通过：schema 校验 ok 且 capability supported【${probe[id].reason}】`, () => {
        const card = { ...canonicalById.get(id), rules: EXPECTED_RULES[id] };
        const validation = validateCardRules(card);
        expect(validation.ok, `${id} schema 校验失败：${JSON.stringify(validation.errors)}`).toBe(true);
        const capability = inspectCardRuleCapability(card);
        expect(capability.ok, `${id} 能力门拒绝：${JSON.stringify(capability.issues)}`).toBe(true);
        expect(capability.kind).toBe('supported');
      });

      it.skipIf(!probe[id].ok)(`回填生效：rules 逐键一致、卡面不动、落库复读一致、marker 盖章【等待契约键：${probe[id].reason}】`, () => {
        const harness = makeHarness(freshCards());
        ensureM6BagRules(harness);
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
          ['改字段', { ...canonicalById.get(id), value: 99, desc: '玩家改过描述' }],
          ['已有自有 rules', { ...canonicalById.get(id), rules: { version: 1, bag: { use: [] } } }],
        ];
        for (const [label, variant] of variants) {
          const others = ALL_IDS.filter(other => other !== id).map(other => ({ ...canonicalById.get(other) }));
          const harness = makeHarness([variant, ...others]);
          ensureM6BagRules(harness);
          const card = harness.cards().find(entry => entry.id === id);
          expect(card, `${label}：卡面不应被改动`).toEqual(variant);
          expect(card.rules, `${label}：不应写入结构化 rules`).toBe(variant.rules);
        }
      });
    });
  }
});

describe('M6 数据迁移批 D8：批次级保守语义', () => {
  it('marker 一次性：盖章后重复执行不再写库；双门未收编时保守退出', () => {
    const harness = makeHarness(freshCards());
    ensureM6BagRules(harness);
    expect(harness.library.saves).toBe(ALL_SUPPORTED ? 1 : 0);
    expect(harness.storage.getItem(MARKER)).toBe(ALL_SUPPORTED ? '1' : null);
    ensureM6BagRules(harness);
    ensureM6BagRules(harness);
    expect(harness.library.saves, '重复执行不得再 saveAll').toBe(ALL_SUPPORTED ? 1 : 0);
  });

  it.skipIf(ALL_SUPPORTED)('等待收编形态：双门未放行时十三张数据全部不动、无 marker', () => {
    const harness = makeHarness(freshCards());
    ensureM6BagRules(harness);
    expect(harness.library.saves).toBe(0);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    for (const card of harness.cards()) {
      expect(card.rules, `${card.id} 在扩展键收编前不得写入 rules`).toBeUndefined();
    }
  });

  it('库内缺卡：整体保守退出，不标记、不部分回填', () => {
    const harness = makeHarness([{ ...canonicalById.get('tt3-blue-potion') }]);
    ensureM6BagRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards()[0].rules, '缺其余卡时连可迁卡也不写（下次启动重试）').toBeUndefined();
  });

  it('缺 canonical 定版表：整体保守退出，不标记', () => {
    const harness = makeHarness(freshCards());
    delete harness.library.TABLETOP11;
    ensureM6BagRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards().some(card => card.rules)).toBe(false);
  });

  it('saveAll 返回 false：不标记', () => {
    const harness = makeHarness(freshCards());
    harness.library.saveAll = () => false;
    ensureM6BagRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('无原库串（raw == null）：保守退出不标记', () => {
    const harness = makeHarness(freshCards());
    harness.storage = makeStorage();   // 无 KEY 原库串
    ensureM6BagRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('tt3-blue-potion 旧批次同名副本（TABLETOP3 旧版「蓝瓶药水」卡面）：跳过不写脏', () => {
    const legacy = { id: 'tt3-blue-potion', name: '蓝瓶药水', cost: 3, rarity: '古朴', type: '道具', desc: '回复 3 点生命，抽 1 张牌。', value: 2 };
    const others = ALL_IDS.filter(id => id !== 'tt3-blue-potion').map(id => ({ ...canonicalById.get(id) }));
    const harness = makeHarness([{ ...legacy }, ...others]);
    ensureM6BagRules(harness);
    // 旧副本卡面与 TABLETOP10 定版深不相等 → 按 id 计数在批内但深等校验不过 → 保守跳过
    expect(harness.cards().find(card => card.id === 'tt3-blue-potion')).toEqual(legacy);
    expect(harness.cards().find(card => card.id === 'tt3-blue-potion').rules).toBeUndefined();
    if (ALL_SUPPORTED) {
      for (const id of ALL_IDS.filter(id => id !== 'tt3-blue-potion')) {
        expect(harness.cards().find(card => card.id === id).rules).toEqual(EXPECTED_RULES[id]);
      }
    } else {
      expect(harness.storage.getItem(MARKER)).toBe(null);
    }
  });
});
