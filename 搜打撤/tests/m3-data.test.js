/* M3 卡牌规则化数据迁移批 D5 锁定（2026-09-27）：cards.sync.m3.js ensureM3OnplayRules。
 * B-M2 onPlay 扩展批 24 张（派单 33 张扣 9 跳过，跳过清单见 docs/archive/card-migration-2026-09-27/M3-D5-RESULT.md）。
 * 每张迁的卡三条用例，锁定三件事：
 *   1) validateCardRules 通过且 inspectCardRuleCapability supported（双门）；
 *   2) 回填函数对 canonical 卡生效（rules 与定义逐键一致、卡面不动、落库复读一致、marker 盖章）；
 *   3) 对被改名 / 改字段 / 已有自有 rules 的卡保守跳过。
 * 批次级另锁：marker 一次性、缺卡/缺 canonical/saveAll 失败/无原库串整体保守退出不标记、
 * tt7-goldencicada 运行时注入 draw 字段的漂移卡（ensureEffectFields 补词条，卡面与源表不可深相等）
 * 不回填、其余 24 张正常迁移。
 * 回填器为 A3 式全批语义（definitions 24 张齐备才落库），故运行夹具一律放全量 24 张 canonical 卡。
 * 纯单元：依赖注入 storage/library，不启动 cards.js 播种链。 */
import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM3OnplayRules } from '../game/src/cards/cards.sync.m3.js';
import { dataSlice } from '../game/src/cards/cards.data.js';
import cardsSyncData from '../game/data/cards-sync.json';

const MARKER = 'sdt-cards-m3-onplay-rules-v5-seeded';

// canonical 夹具（2026-09-29 镜像收编）：原「逐字照抄定版源行」改为按本批 id 取真源行——
// CARDS_SYNC=game/data/cards-sync.json 实机覆盖批次；TABLETOP10/11/12=cards.data.js 定版表；
// 同 id 多表引用取「最后写入的定版」（与 catalog-after 实测一致）。卡面字段值不再手抄，
// 真源漂移时以真源为准（深相等守卫按真源判定，不会写脏）。
const M3_IDS = ['cc-cursed-blade', 'cc-last-stand', 'cc-rapid-fire', 'tt3-holy-water',
  'tt2-jianghu', 'tt2-turtlearmor', 'tt3-dig-treasure', 'tt3-fly-arrowhawk', 'tt3-purify-arrow',
  'tt3sp-shadowbug', 'tt3wu-shike', 'tt7-armup', 'cmtn1epgt20j', 'tt7-bladebloom',
  'tt7-burnharvest', 'tt7-recruit', 'tt3sp-devour', 'tt3sp-magicoil', 'tt3sp-shadowshot',
  'tt3-thunderblast', 'cmtn0xt0zr7', 'cmtn1p9vb5au', 'tt7-maxsupply', 'tt12-chargeray'];
const rowsById = (table, ids) => table.filter(card => card?.id && ids.includes(card.id));
const CARDS_SYNC = rowsById(cardsSyncData.cards, M3_IDS);
const TABLETOP10 = rowsById(dataSlice.TABLETOP10, M3_IDS);
const TABLETOP11 = rowsById(dataSlice.TABLETOP11, M3_IDS);
const TABLETOP12 = rowsById(dataSlice.TABLETOP12, M3_IDS);

// 期望回填结果：version:1 / onPlay 有序 ops，字段风格与 ensureA3* / m1 / m2 定义一致。
const EXPECTED_RULES = {
  'cc-cursed-blade': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'curse', source: 'handMoves', target: 'chosenEnemy' },
    ] },
  },
  'cc-last-stand': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', recast: { on: 'lastHand', times: 1 } },
    ] },
  },
  'cc-rapid-fire': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amount: 2, target: 'chosenEnemy', hits: { perPlayedMoves: true } },
    ] },
  },
  'cmtn0xt0zr7': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amount: 5, target: 'chosenEnemy', onKill: { coins: 2 } },
    ] },
  },
  'tt2-jianghu': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [
      { op: 'acquire', n: 1, pool: { kind: '其它职业' }, dest: 'discover', act: 'play' },
    ] },
  },
  'tt2-turtlearmor': {
    version: 1,
    battle: { target: { side: 'self', area: false }, requirements: [{ kind: 'handCards', count: 1, type: '装备' }] },
    triggers: { onPlay: [
      { op: 'armor', amount: 10 },
    ] },
  },
  'tt3-dig-treasure': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [
      { op: 'acquire', n: 1, pool: { kind: '牌库底' }, dest: 'discover' },
      { op: 'armor', priceOf: 'discovered' },
    ] },
  },
  'tt3-fly-arrowhawk': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'registerRule', rule: 'bleedAmp' },
    ] },
  },
  'tt3-purify-arrow': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'cleanse', target: 'self' },
    ] },
  },
  'tt3sp-shadowbug': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'stealAtk', capTo: 1, target: 'chosenEnemy' },
    ] },
  },
  'tt3wu-shike': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'curse', curse: 'atkDown', amount: 2, duration: 3, target: 'chosenEnemy' },
      { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
    ] },
  },
  'tt7-armup': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [
      { op: 'draw', amount: 2, filter: { type: '装备' } },
    ] },
  },
  'cmtn1epgt20j': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [
      { op: 'acquire', n: 1, pool: { kind: '注能' }, dest: 'discover', act: 'noInfuse' },
    ] },
  },
  'cmtn1p9vb5au': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [
      { op: 'acquire', n: 1, pool: { kind: '形态' }, dest: 'discover', act: 'play' },
    ] },
  },
  'tt12-chargeray': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amount: 5, target: 'chosenEnemy', perInfusedInHand: 2 },
    ] },
  },
  'tt3-holy-water': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [
      { op: 'heal', amountField: 'heal' },
      { op: 'cleanse', target: 'self' },
    ] },
  },
  'tt3-thunderblast': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amount: 7, target: 'chosenEnemy', graveyard: { type: '法术', perCard: 1 } },
    ] },
  },
  'tt7-bladebloom': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [
      { op: 'acquire', n: 1, pool: { kind: '随机' }, dest: 'discover', act: 'playKeep' },
    ] },
  },
  'tt7-burnharvest': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amount: 5, target: 'chosenEnemy', spellPowerMul: 2 },
    ] },
  },
  'tt7-maxsupply': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [
      { op: 'draw', untilHandN: 4 },
    ] },
  },
  'tt7-recruit': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [
      { op: 'summon', name: '步兵', atk: 4, hp: 4, count: 2, taunt: true },
    ] },
  },
  'tt3sp-devour': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'execute', cap: { atk: 4 }, count: 1 },
    ] },
  },
  'tt3sp-magicoil': {
    version: 1,
    battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [
      { op: 'acquire', n: 1, pool: { kind: '药水' }, dest: 'discover', act: 'play' },
    ] },
  },
  'tt3sp-shadowshot': {
    version: 1,
    battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [
      { op: 'damage', amount: 3, target: 'chosenEnemy' },
      { op: 'damage', amount: 3, target: 'chosenEnemy', cond: { anyCurse: true } },
    ] },
  },
};

const canonicalById = new Map([...CARDS_SYNC, ...TABLETOP10, ...TABLETOP11, ...TABLETOP12]
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

describe('M3 数据迁移批 D5：每张迁的卡', () => {
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
        ensureM3OnplayRules(harness);
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
          ['改字段', { ...canonicalById.get(id), value: 9 }],
          ['已有自有 rules', { ...canonicalById.get(id), rules: { version: 1, bag: { use: [] } } }],
        ];
        for (const [label, variant] of variants) {
          const others = ALL_IDS.filter(other => other !== id).map(other => ({ ...canonicalById.get(other) }));
          const harness = makeHarness([variant, ...others]);
          ensureM3OnplayRules(harness);
          const card = harness.cards().find(entry => entry.id === id);
          expect(card, `${label}：卡面不应被改动`).toEqual(variant);
          expect(card.rules, `${label}：不应写入结构化 rules`).toBe(variant.rules);
        }
      });
    });
  }
});

describe('M3 数据迁移批 D5：批次级保守语义', () => {
  it('修复早期破釜沉舟的额外重施次数，不将总次数当额外次数', () => {
    const rules = structuredClone(EXPECTED_RULES['cc-last-stand']);
    rules.triggers.onPlay[0].recast.times = 2;
    const harness = makeHarness(freshCards().map(card => card.id === 'cc-last-stand' ? { ...card, rules } : card));
    harness.storage.setItem('sdt-cards-m3-onplay-rules-v1-seeded', '1');
    ensureM3OnplayRules(harness);
    expect(harness.cards().find(card => card.id === 'cc-last-stand').rules).toEqual(EXPECTED_RULES['cc-last-stand']);
  });

  it('仅修复精确匹配的早期铸甲规则，保留玩家改动', () => {
    const oldRules = { version: 1, battle: { target: { side: 'self', area: false } },
      triggers: { onPlay: [{ op: 'armor', amount: 10, consumeEquip: true }] } };
    for (const customized of [false, true]) {
      const cards = freshCards().map(card => card.id === 'tt2-turtlearmor'
        ? { ...card, ...(customized ? { name: '玩家铸甲' } : {}), rules: oldRules } : card);
      const harness = makeHarness(cards);
      harness.storage.setItem('sdt-cards-m3-onplay-rules-v1-seeded', '1');
      ensureM3OnplayRules(harness);
      expect(harness.cards().find(card => card.id === 'tt2-turtlearmor').rules)
        .toEqual(customized ? oldRules : EXPECTED_RULES['tt2-turtlearmor']);
    }
  });

  it('marker 一次性：盖章后重复执行不再写库', () => {
    const harness = makeHarness(freshCards());
    ensureM3OnplayRules(harness);
    expect(harness.library.saves).toBe(1);
    ensureM3OnplayRules(harness);
    ensureM3OnplayRules(harness);
    expect(harness.library.saves, 'marker 已盖章，重复执行不得再 saveAll').toBe(1);
    expect(harness.cards().filter(card => card.rules).length).toBe(ALL_IDS.length);
  });

  it('库内缺卡：整体保守退出，不标记、不部分回填', () => {
    const harness = makeHarness([{ ...canonicalById.get('tt2-jianghu') }]);
    ensureM3OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards()[0].rules, '缺其余卡时连可迁卡也不写（下次启动重试）').toBeUndefined();
  });

  it('缺 canonical 定版表：整体保守退出，不标记', () => {
    const harness = makeHarness(freshCards());
    delete harness.library.TABLETOP12;
    ensureM3OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
    expect(harness.cards().some(card => card.rules)).toBe(false);
  });

  it('saveAll 返回 false：不标记', () => {
    const harness = makeHarness(freshCards());
    harness.library.saveAll = () => false;
    ensureM3OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('无原库串（raw == null）：保守退出不标记', () => {
    const harness = makeHarness(freshCards());
    harness.storage = makeStorage();   // 无 KEY 原库串
    ensureM3OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).toBe(null);
  });

  it('运行时注入词条的漂移卡（金蝉脱壳 ensureEffectFields 补 draw:3）：跳过不写脏，其余 24 张正常迁移', () => {
    // tt7-goldencicada 不在本批 definitions（跳过卡）——此处以同构漂移件 tt3-purify-arrow 模拟：
    // ensureEffectFields 会给「抽 N 张」描述卡运行时补字段；净化箭无抽牌词条，改用
    // tt7-maxsupply（「抽牌，直到有 4 张手牌」无 draw 词条）注入 draw:1 模拟同类漂移。
    const drifted = { ...canonicalById.get('tt7-maxsupply'), draw: 1 };
    const others = ALL_IDS.filter(id => id !== 'tt7-maxsupply').map(id => ({ ...canonicalById.get(id) }));
    const harness = makeHarness([drifted, ...others]);
    ensureM3OnplayRules(harness);
    expect(harness.cards().find(card => card.id === 'tt7-maxsupply')).toEqual(drifted);
    expect(harness.cards().find(card => card.id === 'tt7-maxsupply').rules).toBeUndefined();
    for (const id of ALL_IDS.filter(id => id !== 'tt7-maxsupply')) {
      expect(harness.cards().find(card => card.id === id).rules).toEqual(EXPECTED_RULES[id]);
    }
  });
});


describe('永恒绽放旧章发现轮数迁移', () => {
  function oldHarness(customized = false) {
    const oldRules = structuredClone(EXPECTED_RULES['tt7-bladebloom']);
    oldRules.triggers.onPlay[0].n = 3;
    const cards = freshCards().map(card => card.id === 'tt7-bladebloom'
      ? {...card, ...(customized ? {name:card.name + '自订'} : {}), rules:oldRules}
      : {...card, rules:structuredClone(EXPECTED_RULES[card.id])});
    const harness = makeHarness(cards);
    harness.storage.setItem('sdt-cards-m3-onplay-rules-v3-seeded','1');
    return harness;
  }
  it.each([false,true])('旧v3章仅改canonical旧n3，保留自定义=%s及其它规则', customized => {
    const harness = oldHarness(customized);
    const other = harness.cards().filter(c => c.id !== 'tt7-bladebloom');
    ensureM3OnplayRules(harness);
    expect(harness.cards().find(c => c.id === 'tt7-bladebloom').rules.triggers.onPlay[0].n).toBe(customized ? 3 : 1);
    expect(harness.cards().filter(c => c.id !== 'tt7-bladebloom')).toEqual(other);
    const saved = harness.library.saves;
    ensureM3OnplayRules(harness); expect(harness.library.saves).toBe(saved);
  });
  it.each(['false','throw'])('旧n3迁移保存%s失败不盖章，恢复后可重试', failure => {
    const harness = oldHarness(); const save = harness.library.saveAll;
    harness.library.saveAll = () => { if(failure === 'throw') throw new Error('probe-save'); return false; };
    ensureM3OnplayRules(harness);
    expect(harness.storage.getItem(MARKER)).not.toBe('1');
    expect(harness.cards().find(c => c.id === 'tt7-bladebloom').rules.triggers.onPlay[0].n).toBe(3);
    harness.library.saveAll = save; ensureM3OnplayRules(harness);
    expect(harness.cards().find(c => c.id === 'tt7-bladebloom').rules.triggers.onPlay[0].n).toBe(1);
    expect(harness.storage.getItem(MARKER)).toBe('1');
  });
});

it.each([false,true])('v5仅迁移灵能召唤精确旧hand规则，保留自改=%s', customized => {
  const all=freshCards().map(card=>({...card,rules:structuredClone(EXPECTED_RULES[card.id])}));
  const source=all.find(card=>card.id==='cmtn1epgt20j');source.rules.triggers.onPlay[0].dest='hand';
  if(customized)source.name='我的灵能召唤';
  const harness=makeHarness(all);harness.storage.setItem('sdt-cards-m3-onplay-rules-v4-seeded','1');
  ensureM3OnplayRules(harness);
  expect(harness.cards().find(card=>card.id===source.id).rules.triggers.onPlay[0].dest).toBe(customized?'hand':'discover');
  expect(harness.storage.getItem(MARKER)).toBe('1');
});
