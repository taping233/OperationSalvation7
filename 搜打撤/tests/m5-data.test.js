import { sourceCardLibrary } from '../scripts/sync-cards-from-live.mjs';
/* M5 卡牌规则化数据迁移批 D7 锁定（2026-09-27）：cards.sync.m5.js ensureM5DelayedRules。
 * 每张迁的卡一条用例组，锁定四件事：
 *   1) validateCardRules 通过；2) inspectCardRuleCapability supported；
 *   3) 回填函数对 canonical 卡生效（rules 与定义逐键一致、卡面不动（noon-duel 例外：定版
 *      卡面改写 dmg/dmgType）、落库复读一致、marker 盖章）；
 *   4) 对被改名 / 改字段 / 已有自有 rules 的卡保守跳过。
 * 批次级另锁：marker 一次性、缺卡/缺 canonical/saveAll 失败/无原库串/热缓存不一致整体保守
 * 退出不标记。末组直接校验现行卡库的九张卡，防止已落地能力被旧草案误判为不支持。
 * 回填器为全批语义，运行夹具包含全部六张 canonical 卡。纯单元：依赖注入 storage/library，不启动 cards.js 播种链。 */
import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM5DelayedRules } from '../game/src/cards/cards.sync.m5.js';
import { dataSlice } from '../game/src/cards/cards.data.js';

const MARKER = 'sdt-cards-m5-delayed-rules-v1-seeded';

// canonical 夹具（2026-09-29 镜像收编）：原「逐字照抄 TABLETOP10 定版行」改为按本批 id 取
// dataSlice 真源行；禁咒 I-IV 定版真身在 cards-sync.json（cards.js 装配为 CARDS_SYNC 表，
// m2 cc-chase-slash 先例），此处与原夹具同法从 TABLETOP10 真源行派生。卡面字段值不再手抄，
// 真源漂移时以真源为准（深相等守卫按真源判定，不会写脏）。
const M5_IDS = ['tt3-wave-slash', 'tt3-noon-duel', 'tt8-curse1', 'tt8-curse2', 'tt8-curse3', 'tt8-curse4'];
const TABLETOP10 = dataSlice.TABLETOP10.filter(card => card?.id && M5_IDS.includes(card.id));
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
// noon-duel：dmg:0→2、补 dmgType:'fixed'（与「每枪造成2点固定伤害」对齐）。
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
  it('整批只迁移和保存一次，逐卡校验规则、卡面及持久化', () => {
    expect(ALL_IDS.slice().sort()).toEqual(Object.keys(EXPECTED_RULES).sort());
    const harness = makeHarness(freshCards());
    ensureM5DelayedRules(harness);
    for (const id of ALL_IDS) {
      const card = harness.cards().find(entry => entry.id === id);
      expect(card.rules, `${id} 应被回填结构化 rules`).toEqual(EXPECTED_RULES[id]);
      // 卡面按定版（noon-duel 例外：定版卡面改写，A3 canonicalFieldsById 先例）
      const face = Object.fromEntries(Object.entries(card).filter(([key]) => key !== 'rules'));
      expect(face).toEqual({ ...canonicalById.get(id), ...(EXPECTED_FACE_OVERRIDES[id] ?? {}) });
    }
    expect(harness.storage.getItem(KEY)).toBe(JSON.stringify(harness.cards()));
    expect(harness.storage.getItem(MARKER)).toBe('1');
    expect(harness.library.saves).toBe(1);
  });

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

describe('现行卡库中已落地的规则能力', () => {
  const cards = new Map(sourceCardLibrary().map(card => [card.id, card]));
  it.each([
    ['tt7-swordimmortal', { triggers:{ onTurnStart:[{ op:'draw', amountField:'draw' }], onPlay:[] } }],
    ['tt3-petal', { triggers:{ onTurnStart:[{ op:'draw', amountField:'draw' },{ op:'heal', amountField:'heal' }], duration:3, onPlay:[] } }],
    ['cmtn1r10xnl1', { triggers:{ onPlay:[{ op:'registerRule', rule:'discoverPlus' }] } }],
    ['tt7-elementstorm', { triggers:{ onPlay:[{ op:'registerRule', rule:'doubleNextSpell' }] } }],
    ['tt2-apollo', { triggers:{ onAcquire:[{ op:'energy', n:1 },{ op:'acquire', n:1, pool:{ kind:'随机' }, filter:{ exceptIds:['tt2-apollo'] }, dest:'hand' }] } }],
    ['cmtn2jc142dj', { triggers:{ onTurnStart:[{ op:'copyRandom' }], onPlay:[] } }],
    ['cmtn1wnhhym', { triggers:{ onPlay:[{ op:'acquire', n:3, pool:{ kind:'随机' }, dest:'hand', expire:'nextTurnStart' }] } }],
    ['tt7-provoke', { triggers:{ onPlay:[{ op:'foeFight', pick:'two' }] } }],
    ['cmtn233trmeg', { battle:{ keepInHand:true, fuelAllowed:false }, triggers:{ onPlay:[{ op:'damage', amountField:'dmg', target:'chosenEnemy' }] } }],
  ])('%s 现行规则有实际消费者，关键行为与卡面一致', (id, expected) => {
    const card = cards.get(id);
    expect(card, id + ' must remain in the current catalogue').toBeDefined();
    expect(card.rules, id).toMatchObject(expected);
    expect(validateCardRules(card), id).toMatchObject({ ok:true, errors:[] });
    expect(inspectCardRuleCapability(card), id).toEqual({ kind:'supported', ok:true });
  });
});
