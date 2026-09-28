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

const MARKER = 'sdt-cards-m3-onplay-rules-v3-seeded';

// canonical 夹具：逐字照抄定版源行（CARDS_SYNC=game/data/cards-sync.json 实机覆盖批次；
// TABLETOP10/11/12=cards.data.js 定版表；同 id 多表引用取「最后写入的定版」，与 catalog-after
// 实测逐卡深相等）。若源表日后漂移，回填器按深相等保守跳过，不会写脏。
const CARDS_SYNC = [
  { cost: 2, desc: '攻（+3），附加手牌中的招式所具有的全部诅咒效果。', dmg: 3, dmgType: 'attack', id: 'cc-cursed-blade', name: '诅咒之刃', rarity: '稀有', type: '武术', value: 3 },
  { cost: 2, desc: '攻（+3）；若本牌为最后一张手牌，效果触发 2 次。', dmg: 3, dmgType: 'attack', id: 'cc-last-stand', name: '破釜沉舟', rarity: '稀有', type: '武术', value: 3 },
  { cost: 1, desc: '本回合每打出一张其他招式，造成2点固定伤害（触发次数＝本回合已打出的招式数）。', dmg: 2, dmgType: 'fixed', id: 'cc-rapid-fire', name: '连续射击', rarity: '史诗', type: '武术', value: 3 },
  { cost: 1, desc: '回复 5 点生命，净化自身', dmg: 0, heal: 5, id: 'tt3-holy-water', name: '治愈', rarity: '古朴', type: '法术', value: 2 },
];
const TABLETOP10 = [
  { id: 'tt2-jianghu', name: '江湖救急', cost: 1, rarity: '史诗', type: '武术', desc: '发现 1 张其它职业的卡牌并直接施放。', dmg: 0, value: 4 },
  { id: 'tt2-turtlearmor', name: '铸甲', cost: 1, rarity: '稀有', type: '武术', desc: '消耗1 张装备牌，+10甲。', dmg: 0, armor: 10, value: 3 },
  { id: 'tt3-dig-treasure', name: '挖宝', cost: 1, rarity: '古朴', type: '武术', desc: '从牌库底发现 1 张牌，并获得等同于其价格的护甲。', dmg: 0, value: 2 },
  { id: 'tt3-fly-arrowhawk', name: '飞身劈', cost: 2, rarity: '稀有', type: '武术', desc: '攻（+3），触发的流血伤害翻倍。', dmg: 3, dmgType: 'attack', value: 3 },
  { id: 'tt3-purify-arrow', name: '净化箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），净化自身。', dmg: -1, dmgType: 'attack', value: 2 },
  { id: 'tt3sp-shadowbug', name: '影噬', cost: 1, rarity: '稀有', type: '武术', desc: '本回合偷取 1 名敌人的攻击力至1点。', dmg: 0, value: 3 },
  { id: 'tt3wu-shike', name: '割蚀', cost: 1, rarity: '古朴', type: '武术', desc: '降低 1 名敌人 2 攻，持续3回合；附加流血。', dmg: 0, value: 2 },
  { id: 'tt7-armup', cls: '战士', name: '武装', cost: 1, rarity: '职业', type: '武术', desc: '从牌库中抽取 2 张装备牌。', dmg: 0, value: 3, unrandom: true },
  { id: 'cmtn1epgt20j', name: '灵能召唤', cost: 1, rarity: '稀有', type: '法术', desc: '发现一张注能卡，使其无需注能', value: 3 },
  { id: 'tt7-bladebloom', cls: '法师', name: '永恒绽放', cost: 2, rarity: '职业', type: '法术', desc: '发现并直接施放 1 张牌，获取剩下两张。', dmg: 0, value: 3, unrandom: true },
  { id: 'tt7-burnharvest', cls: '降临者', name: '爆燃火球', cost: 1, rarity: '职业', type: '法术', desc: '5′，受法伤加成翻倍；', dmg: 5, dmgType: 'spell', value: 3, unrandom: true },
  { id: 'tt7-recruit', cls: '法师', name: '征召', cost: 2, rarity: '职业', type: '法术', desc: '召唤步兵（4-4） ×2为你抵挡伤害并自动战斗。', dmg: 0, value: 3, unrandom: true },
  { id: 'tt3sp-devour', cls: '牧师', name: '吞噬', cost: 1, rarity: '职业', type: '法术', desc: '消灭 1 名 攻击力4 点及以下小怪。', dmg: 0, value: 3, unrandom: true },
  { id: 'tt3sp-magicoil', name: '药水魔法', cost: 1, rarity: '稀有', type: '法术', desc: '发现1瓶药水并直接释放', dmg: 0, value: 3 },
  { id: 'tt3sp-shadowshot', cls: '降临者', name: '暗影射击', cost: 1, rarity: '职业', type: '法术', desc: '3′，若对手处于诅咒状态，额外施放 1 次。', dmg: 3, dmgType: 'spell', unrandom: true },
  { id: 'tt3-thunderblast', name: '雷殛', cost: 2, rarity: '传说', type: '法术', desc: '造成7点法术伤害；墓地中每有1 张法术牌，伤害+1。', dmg: 7, dmgType: 'spell', value: 5 },
];
const TABLETOP11 = [
  { id: 'cmtn0xt0zr7', name: '闪金之锤', cost: 1, rarity: '衍生', type: '武术', dmg: 5, dmgType: 'fixed', desc: '造成5点固定伤害，若击杀敌人，+2币。', value: 3, sellable: false },
  { id: 'cmtn1p9vb5au', cls: '法师', name: '千变万化', cost: 2, rarity: '职业', type: '法术', dmg: 0, desc: '发现一种形态并释放', value: 3, sellable: false, unrandom: true },
  { id: 'tt7-maxsupply', cls: '法师', name: '法力补给', cost: 1, rarity: '职业', type: '法术', dmg: 0, desc: '抽牌，直到有 4 张手牌。', value: 3, sellable: false },
];
const TABLETOP12 = [
  { id: 'tt12-chargeray', name: '充能射线', cost: 1, rarity: '稀有', type: '法术', dmg: 5, dmgType: 'spell', desc: '造成5点法伤，本牌在你手牌中时每注能过1张卡牌，伤害+2' },
];

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
      { op: 'acquire', n: 1, pool: { kind: '注能' }, dest: 'hand', act: 'noInfuse' },
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
      { op: 'acquire', n: 3, pool: { kind: '随机' }, dest: 'discover', act: 'playKeep' },
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
