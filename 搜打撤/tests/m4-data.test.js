/* M4 卡牌规则化数据迁移批 D6 锁定（2026-09-27）：cards.sync.m4.js ensureM4EquipRules。
 * B-M3 装备批派工 27 张，实迁 2 张（tt3-deep-diary / tt3-deep-seal，矩阵陷阱 T6 同草案同测）；
 * 跳过 25 张的逐卡原因见 docs/M4-D6-RESULT.md（本文件不为其立用例）。
 * 每张迁的卡三条用例，锁定四件事：
 *   1) validateCardRules 通过；2) inspectCardRuleCapability supported；
 *   3) 回填函数对 canonical 卡生效（rules 与定义逐键一致、落库复读一致、marker 盖章）；
 *   4) 对被改名 / 改字段 / 已有自有 rules 的卡保守跳过。
 * 批次级另锁：marker 一次性、缺卡/缺 canonical/saveAll 失败/无原库串整体保守退出不标记、
 * 单卡被改只跳过该卡其余正常迁移。
 * 回填器为 A3 式全批语义（definitions 2 张齐备才落库），故运行夹具一律放全量 2 张 canonical 卡。
 * 纯单元：依赖注入 storage/library，不启动 cards.js 播种链。 */
import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM4EquipRules } from '../game/src/cards/cards.sync.m4.js';

const MARKER = 'sdt-cards-m4-equip-rules-v1-seeded';

// canonical 夹具：逐字照抄 cards.data.js TABLETOP10 定版行（两卡的 TABLETOP3 旧行——深解印记/
// 深衍日记——已被 TABLETOP10 定版覆盖；若源表日后漂移，回填器按深相等保守跳过，不会写脏）。
const TABLETOP10 = [
  { id: 'tt3-deep-seal', name: '深海印记', cost: 0, rarity: '稀有', type: '装备', desc: '诅咒状态下，攻 +2，法伤 +2。', dmg: 0, dmgType: 'attack' },
  { id: 'tt3-deep-diary', name: '深海咒印', cost: 0, rarity: '史诗', type: '装备', desc: '自身处于诅咒状态时，获得 2 点攻击力且法伤 +2。', dmg: 0, value: 4 },
];

// 期望回填结果：version:1 / 纯 equip 域（无 battle/triggers）。cond.hasCurse 条件被动 +
// aura 双数值——由 syncCurseCondEquips 动态核算（rules 分支短路 desc 文本旧读法）。
const EXPECTED_RULES = {
  'tt3-deep-diary': {
    version: 1,
    equip: {
      passive: {
        cond: { hasCurse: true },
        aura: { atk: 2, spellPower: 2 },
      },
    },
  },
  'tt3-deep-seal': {
    version: 1,
    equip: {
      passive: {
        cond: { hasCurse: true },
        aura: { atk: 2, spellPower: 2 },
      },
    },
  },
};

const ALL_IDS = TABLETOP10.map(card => card.id);
const freshCards = () => TABLETOP10.map(card => ({ ...card }));

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

describe('M4 数据迁移批 D6：每张迁的卡', () => {
  for (const id of ALL_IDS) {
    describe(id, () => {
      it('validateCardRules 通过且 inspectCardRuleCapability supported（回填后的 rules 形状）', () => {
        const card = { ...freshCards().find(entry => entry.id === id), rules: EXPECTED_RULES[id] };
        const validation = validateCardRules(card);
        expect(validation.ok, `${id} schema 校验失败：${JSON.stringify(validation.errors)}`).toBe(true);
        const capability = inspectCardRuleCapability(card);
        expect(capability.ok, `${id} 能力门拒绝：${JSON.stringify(capability.issues)}`).toBe(true);
        expect(capability.kind).toBe('supported');
      });

      it('回填函数对 canonical 卡生效：rules 逐键一致、卡面不动、落库复读一致、marker 盖章', () => {
        const harness = makeHarness(freshCards());
        ensureM4EquipRules(harness);
        const card = harness.cards().find(entry => entry.id === id);
        expect(card.rules, `${id} 应被回填结构化 rules`).toEqual(EXPECTED_RULES[id]);
        // 除 rules 外卡面一字未动
        const face = Object.fromEntries(Object.entries(card).filter(([key]) => key !== 'rules'));
        expect(face).toEqual(TABLETOP10.find(entry => entry.id === id));
        // 成功后复读确认：storage 串与库内容一致；全批一次保存、单枚 marker
        expect(harness.storage.getItem(KEY)).toBe(JSON.stringify(harness.cards()));
        expect(harness.storage.getItem(MARKER)).toBe('1');
        expect(harness.library.saves).toBe(1);
      });

      it('保守跳过：被改名 / 改字段 / 已有自有 rules 的卡一律不回填', () => {
        const variants = [
          ['被改名', { ...TABLETOP10.find(entry => entry.id === id), name: '玩家改名' }],
          ['改字段', { ...TABLETOP10.find(entry => entry.id === id), desc: '改过的描述', value: 9 }],
          ['已有自有 rules', { ...TABLETOP10.find(entry => entry.id === id), rules: { version: 1, equip: { passive: { aura: { atk: 1 } } } } }],
        ];
        for (const [label, variant] of variants) {
          const others = TABLETOP10.filter(entry => entry.id !== id).map(entry => ({ ...entry }));
          const harness = makeHarness([variant, ...others]);
          ensureM4EquipRules(harness);
          const card = harness.cards().find(entry => entry.id === id);
          expect(card, `${label}：卡面不应被改动`).toEqual(variant);
          expect(card.rules, `${label}：不应改写既有 rules`).toBe(variant.rules);
        }
      });
    });
  }
});

describe('M4 数据迁移批 D6：批次级保守语义', () => {
  it('marker 一次性：盖章后重复执行不再写库', () => {
    const harness = makeHarness(freshCards());
    ensureM4EquipRules(harness);
    expect(harness.library.saves).toBe(1);
    ensureM4EquipRules(harness);
    ensureM4EquipRules(harness);
    expect(harness.library.saves, 'marker 已盖章，重复执行不得再 saveAll').toBe(1);
    expect(harness.cards().filter(card => card.rules).length).toBe(ALL_IDS.length);
  });

  it('库内缺卡：整体保守退出，不标记、不部分回填', () => {
    const harness = makeHarness([{ ...TABLETOP10[0] }]);
    ensureM4EquipRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards()[0].rules, '缺其余卡时连可迁卡也不写（下次启动重试）').toBeUndefined();
  });

  it('缺 canonical 定版表：整体保守退出，不标记', () => {
    const harness = makeHarness(freshCards());
    delete harness.library.TABLETOP10;
    ensureM4EquipRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards().some(card => card.rules)).toBe(false);
  });

  it('saveAll 返回 false：不标记', () => {
    const harness = makeHarness(freshCards());
    harness.library.saveAll = () => false;
    ensureM4EquipRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('无原库串（raw == null）：保守退出不标记', () => {
    const harness = makeHarness(freshCards());
    harness.storage = makeStorage();   // 无 KEY 原库串
    ensureM4EquipRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('单卡被改（旧批次同名副本卡面）：该卡保守跳过，其余 1 张正常迁移', () => {
    // TABLETOP3 旧行「深衍日记」即现实中的旧批次副本形态（同名不同面）——深相等不过即跳过
    const legacy = { ...TABLETOP10.find(entry => entry.id === 'tt3-deep-diary'), name: '深衍日记', cost: 1, rarity: '古朴', desc: '装备：记载深处的秘密。', value: 3 };
    const others = TABLETOP10.filter(entry => entry.id !== 'tt3-deep-diary').map(entry => ({ ...entry }));
    const harness = makeHarness([{ ...legacy }, ...others]);
    ensureM4EquipRules(harness);
    expect(harness.cards().find(card => card.id === 'tt3-deep-diary')).toEqual(legacy);
    expect(harness.cards().find(card => card.id === 'tt3-deep-diary').rules).toBeUndefined();
    expect(harness.cards().find(card => card.id === 'tt3-deep-seal').rules).toEqual(EXPECTED_RULES['tt3-deep-seal']);
    expect(harness.storage.getItem(MARKER)).toBe('1');
  });
});
