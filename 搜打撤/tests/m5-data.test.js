/* M5 卡牌规则化数据迁移批 D7 锁定（2026-09-27）：cards.sync.m5.js ensureM5DelayedRules。
 * 每张迁的卡一条用例组，锁定四件事：
 *   1) validateCardRules 通过；2) inspectCardRuleCapability supported；
 *   3) 回填函数对 canonical 卡生效（rules 与定义逐键一致、卡面不动（noon-duel 例外：定版
 *      卡面改写 dmg/dmgType）、落库复读一致、marker 盖章）；
 *   4) 对被改名 / 改字段 / 已有自有 rules 的卡保守跳过。
 * 批次级另锁：marker 一次性、缺卡/缺 canonical/saveAll 失败/无原库串/热缓存不一致整体保守
 * 退出不标记。末组锁定 9 张跳过卡的契约缺口（schema/capability 现场确实拒，或双结算死锁，
 * 防止误判可迁）。回填器为 A3 式全批语义（definitions 六张齐备才落库），故运行夹具一律放
 * 全量六张 canonical 卡。纯单元：依赖注入 storage/library，不启动 cards.js 播种链。 */
import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM5DelayedRules } from '../game/src/cards/cards.sync.m5.js';

const MARKER = 'sdt-cards-m5-delayed-rules-v1-seeded';

// canonical 夹具：逐字照抄 cards.data.js TABLETOP10 定版行与 game/data/cards-sync.json 定版
// 条目（禁咒 I-IV 的 CARDS_SYNC 行与 TABLETOP10 行逐字一致；若源表日后漂移，回填器按
// 深相等保守跳过，不会写脏）。
const TABLETOP10 = [
  { id: 'tt3-wave-slash', name: '破浪斩', cost: 1, rarity: '稀有', type: '武术', desc: '攻（+3），下回合无法抽牌。', dmg: 3, dmgType: 'attack', value: 2 },
  { id: 'tt3-noon-duel', name: '正午决战', cost: 1, rarity: '史诗', type: '武术', desc: '下回合开始时，连开四枪！（每枪造成2点固定伤害）。', dmg: 0, value: 3 },
  { id: 'tt8-curse1', name: '禁咒I', cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：夺取 1 点攻击力。', value: 5 },
  { id: 'tt8-curse2', name: '禁咒II', cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：冰冻。', value: 5 },
  { id: 'tt8-curse3', name: '禁咒III', cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：中毒，流血。', value: 5 },
  { id: 'tt8-curse4', name: '禁咒IV', cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：沉默 1 回合。', value: 5 },
];
// 禁咒 I-IV 定版真身在 cards-sync.json（cards.js 装配为 CARDS_SYNC 表，m2 cc-chase-slash 先例）。
const CARDS_SYNC = TABLETOP10.filter(card => card.id.startsWith('tt8-curse')).map(card => ({ ...card }));

// 期望回填结果：version:1 / 有序 ops。纯触发器卡的 triggers.onPlay: [] 为文本抑制标记
// （resolver 文本路径挂在 !hasStructuredOnPlay 上，空键防 desc 宿主与 runner 双结算）。
const EXPECTED_RULES = {
  'tt3-wave-slash': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'noDrawNext' },
    ] },
  },
  'tt3-noon-duel': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', schedule: 'nextTurnStart', hits: { count: 4 } },
    ] },
  },
  'tt8-curse1': {
    version: 1,
    triggers: { onDraw: [{ op: 'stealAtk', target: 'chosenEnemy', amount: 1 }], onPlay: [] },
  },
  'tt8-curse2': {
    version: 1,
    triggers: { onDraw: [{ op: 'curse', curse: 'freeze', duration: 1, target: 'chosenEnemy' }], onPlay: [] },
  },
  'tt8-curse3': {
    version: 1,
    triggers: { onDraw: [
      { op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy' },
      { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
    ], onPlay: [] },
  },
  'tt8-curse4': {
    version: 1,
    triggers: { onDraw: [{ op: 'curse', curse: 'silence', duration: 1, target: 'chosenEnemy' }], onPlay: [] },
  },
};

// 定版卡面改写（A3 canonicalFieldsById 先例，回填时以描述定版值覆盖卡面）：
//   noon-duel：dmg:0→2、补 dmgType:'fixed'（与「每枪造成2点固定伤害」对齐）；
//   petal：最新裁决保留 heal:2；m8 回迁同步修正文案为回复 2。
const EXPECTED_FACE_OVERRIDES = {
  'tt3-noon-duel': { dmg: 2, dmgType: 'fixed' },
};

const canonicalById = new Map(TABLETOP10.map(card => [card.id, card]));
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
    CARDS_SYNC,
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

describe('M5 数据迁移批 D7：每张迁的卡', () => {
  for (const id of ALL_IDS) {
    describe(id, () => {
      it('validateCardRules 通过且 inspectCardRuleCapability supported（回填后的 rules 形状）', () => {
        const card = { ...canonicalById.get(id), ...(EXPECTED_FACE_OVERRIDES[id] ?? {}), rules: EXPECTED_RULES[id] };
        const validation = validateCardRules(card);
        expect(validation.ok, `${id} schema 校验失败：${JSON.stringify(validation.errors)}`).toBe(true);
        const capability = inspectCardRuleCapability(card);
        expect(capability.ok, `${id} 能力门拒绝：${JSON.stringify(capability.issues)}`).toBe(true);
        expect(capability.kind).toBe('supported');
      });

      it('回填函数对 canonical 卡生效：rules 逐键一致、卡面符合定版、落库复读一致、marker 盖章', () => {
        const harness = makeHarness(freshCards());
        ensureM5DelayedRules(harness);
        const card = harness.cards().find(entry => entry.id === id);
        expect(card.rules, `${id} 应被回填结构化 rules`).toEqual(EXPECTED_RULES[id]);
        // 卡面按定版（noon-duel / petal 例外：定版卡面改写，A3 canonicalFieldsById 先例）
        const face = Object.fromEntries(Object.entries(card).filter(([key]) => key !== 'rules'));
        expect(face).toEqual({ ...canonicalById.get(id), ...(EXPECTED_FACE_OVERRIDES[id] ?? {}) });
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
          ensureM5DelayedRules(harness);
          const card = harness.cards().find(entry => entry.id === id);
          expect(card, `${label}：卡面不应被改动`).toEqual(variant);
          expect(card.rules, `${label}：不应写入结构化 rules`).toBe(variant.rules);
        }
      });
    });
  }
});

describe('M5 数据迁移批 D7：批次级保守语义', () => {
  it('marker 一次性：盖章后重复执行不再写库', () => {
    const harness = makeHarness(freshCards());
    ensureM5DelayedRules(harness);
    expect(harness.library.saves).toBe(1);
    ensureM5DelayedRules(harness);
    ensureM5DelayedRules(harness);
    expect(harness.library.saves, 'marker 已盖章，重复执行不得再 saveAll').toBe(1);
    expect(harness.cards().filter(card => card.rules).length).toBe(ALL_IDS.length);
  });

  it('库内缺卡：整体保守退出，不标记、不部分回填', () => {
    const harness = makeHarness([{ ...canonicalById.get('tt3-wave-slash') }]);
    ensureM5DelayedRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards()[0].rules, '缺其余卡时连可迁卡也不写（下次启动重试）').toBeUndefined();
  });

  it('缺 canonical 定版表（CARDS_SYNC）：整体保守退出，不标记', () => {
    const harness = makeHarness(freshCards());
    delete harness.library.CARDS_SYNC;
    ensureM5DelayedRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards().some(card => card.rules)).toBe(false);
  });

  it('saveAll 返回 false：不标记', () => {
    const harness = makeHarness(freshCards());
    harness.library.saveAll = () => false;
    ensureM5DelayedRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('无原库串（raw == null）：保守退出不标记', () => {
    const harness = makeHarness(freshCards());
    harness.storage = makeStorage();   // 无 KEY 原库串
    ensureM5DelayedRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('热缓存与原库不一致：保守退出不标记（绝不迁移未保存的修改）', () => {
    const harness = makeHarness(freshCards());
    harness.library.all = () => [...freshCards(), { id: 'unsaved-extra', name: '未保存卡' }];
    ensureM5DelayedRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.library.saves).toBe(0);
  });

  it('noon-duel 卡面被玩家改过（dmg:99）：深不相等保守跳过，定版改写不生效', () => {
    const variant = { ...canonicalById.get('tt3-noon-duel'), dmg: 99, value: 9 };
    const others = ALL_IDS.filter(id => id !== 'tt3-noon-duel').map(id => ({ ...canonicalById.get(id) }));
    const harness = makeHarness([variant, ...others]);
    ensureM5DelayedRules(harness);
    const card = harness.cards().find(entry => entry.id === 'tt3-noon-duel');
    expect(card.dmg, '深相等门未过时不得触发定版卡面改写').toBe(99);
    expect(card.rules).toBeUndefined();
  });
});

describe('M5 数据迁移批 D7：跳过卡的契约缺口锁定', () => {
  // 9 张跳过卡按矩阵草案的「最贴近表达」构造 rules，锁定 schema/capability 现场确实拒绝
  // （或文本宿主双结算死锁）——契约扩集之前这些卡不可迁，防止后续误判。
  const rejected = (card, gate) => {
    if (gate === 'schema') {
      const validation = validateCardRules(card);
      expect(validation.ok).toBe(false);
    } else {
      const validation = validateCardRules(card);
      expect(validation.ok, 'schema 形状应放行，拒点在能力门').toBe(true);
      const capability = inspectCardRuleCapability(card);
      expect(capability.ok).toBe(false);
    }
  };

  const supported = card => {
    const validation = validateCardRules(card);
    expect(validation.ok, JSON.stringify(validation.errors)).toBe(true);
    expect(inspectCardRuleCapability(card)).toEqual({ kind: 'supported', ok: true });
  };

  it('tt7-swordimmortal 剑仙形态：空 onPlay 可抑制文本，回合开始抽牌规则通过双门', () => {
    supported({ id: 'tt7-swordimmortal', type: '武术', dmg: 0, draw: 1,
      rules: { version: 1, battle: { target: { side: 'self', area: false } },
        triggers: { onTurnStart: [{ op: 'draw', amountField: 'draw' }], onPlay: [] } } });
  });

  it('tt3-petal 花瓣法阵：按卡面 heal:2 执行三次回合开始效果，空 onPlay 通过双门', () => {
    supported({ id: 'tt3-petal', type: '法术', dmg: 0, draw: 1, heal: 2,
      rules: { version: 1, battle: { target: { side: 'self', area: false } },
        triggers: { onTurnStart: [{ op: 'draw', amountField: 'draw' }, { op: 'heal', amountField: 'heal' }], duration: 3, onPlay: [] } } });
  });

  it('cmtn1r10xnl1 黑暗形态：discoverPlus 已由 schema 与发现队列消费', () => {
    const card = { id: 'cmtn1r10xnl1', type: '法术', rules: { version: 1, triggers: { onPlay: [{ op: 'registerRule', rule: 'discoverPlus' }] } } };
    expect(validateCardRules(card).ok).toBe(true);
    expect(inspectCardRuleCapability(card)).toEqual({ kind: 'supported', ok: true });
  });

  it('tt7-elementstorm 元素风暴：doubleNextSpell 已由 schema 与施法覆盖消费', () => {
    const card = { id: 'tt7-elementstorm', type: '法术', rules: { version: 1, triggers: { onPlay: [{ op: 'registerRule', rule: 'doubleNextSpell' }] } } };
    expect(validateCardRules(card).ok).toBe(true);
    expect(inspectCardRuleCapability(card)).toEqual({ kind: 'supported', ok: true });
  });

  it('tt2-apollo 阿猫的礼物：onAcquire 已由 schema 与获取卡牌入口消费（数据迁移另由装备批处理）', () => {
    const card = { id: 'tt2-apollo', type: '装备', rules: { version: 1, triggers: { onAcquire: [{ op: 'energy', n: 1 }] } } };
    expect(validateCardRules(card).ok).toBe(true);
    expect(inspectCardRuleCapability(card)).toEqual({ kind: 'supported', ok: true });
  });

  it('cmtn2jc142dj 刀剑形态：handOps copyRandom 解释器未消费（capability 拒）', () => {
    rejected({ id: 'cmtn2jc142dj', type: '武术', rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'draw', amount: 1, handOps: [{ op: 'copyRandom' }] }] } } }, 'capability');
  });

  it('cmtn1wnhhym 江湖救急-改：acquire dest hand 无 decay act（capability 拒）', () => {
    rejected({ id: 'cmtn1wnhhym', type: '武术', rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'acquire', n: 3, pool: { kind: '随机' }, dest: 'hand', act: 'decay' }] } } }, 'capability');
  });

  it('tt7-provoke 扰敌：敌对敌攻击域无 foeFight op（schema 拒）', () => {
    rejected({ id: 'tt7-provoke', type: '法术', rules: { version: 1, triggers: { onPlay: [{ op: 'foeFight', count: 2 }] } } }, 'schema');
  });

  it('cmtn233trmeg 不朽斩：keepInHand 自指无 damage op 键位（schema 拒）', () => {
    rejected({ id: 'cmtn233trmeg', type: '武术', dmg: 1, dmgType: 'attack', rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', keepInHand: true }] } } }, 'schema');
  });
});
