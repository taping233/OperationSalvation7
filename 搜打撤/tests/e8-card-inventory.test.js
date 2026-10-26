import { approvedCurrentCatalogBaseline, currentApprovedFieldValue } from './helpers/card-catalog-current-revisions.js';
import approvedBatch from './fixtures/approved-card-batch-20261020.json';
import approvedExecution from './fixtures/builtin-execution-approved-20261020.json';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertInventoryComplete, buildCardInventory, compareMigrationInventories, describeStage, isApprovedBackupcellRevision, renderCardInventory } from './helpers/e8-card-inventory.js';
import beforeInventory from '../docs/evidence/e8-card-migration-2026-09-27/catalog-before.json';
import { approvedRevisionBaseline, APPROVED_1018_PRODUCTION_REVISIONS, RETIRED_1010 } from './helpers/card-catalog-approved-revisions.js';
import { readFileSync } from 'node:fs';

const BOOT_ORDER = ['ensureStarters', 'ensureSha', 'ensureTabletop', 'ensureDmgTypes', 'ensureEffectFields'];
const E6_ORDER = ['ensureSha', 'ensureStarters', 'ensureTabletop', 'ensureDmgTypes', 'ensureEffectFields'];
const MIGRATED_IDS = ['starter-emergency-bandage', 'tt-jinchuangyao', 'tt4-woodify'];
const HEAL_RULES = { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }] } };
// M 批（B-M1 现集，2026-09-27）：cards.sync.m1.js 4 张 + cards.sync.m2.js 16 张 onPlay 规则。
// rules 内容由 tests/m1-data.test.js、tests/m2-data.test.js 守护；此处只锁「自 E8 before 以来仅新增 rules 字段」。
const M_BATCH_ONPLAY_IDS = [
  'starter-attack', 'tt3-skewer', 'tt8-dragonblade', 'tt7-livingwater',
  'cc-chase-slash', 'cc-demon', 'cmtn28jv33wx', 'tt12-breakthrough', 'tt12-sporewall',
  'tt2-comboarrow', 'tt2-forestarrow', 'tt2-piercearrow', 'tt2-swiftarrow', 'tt3-firm-barrier',
  'tt3-flame-storm', 'tt3-nature-form', 'tt3-toxin', 'tt7-fullstrike', 'tt7-silence', 'tt7-throwblade',
];
const ALL_M_BATCH_IDS = [...readFileSync('docs/M-BATCH-MATRIX.md', 'utf8')
  .matchAll(/^\| ([a-z][\w-]+) \|/gm)].map(match => match[1]).filter(id => id !== 'id');
const APPROVED_IDS = [...MIGRATED_IDS, ...ALL_M_BATCH_IDS, 'tt7-ironphalanx', 'cmtn1ntxzoc4'].filter(id => !RETIRED_1010.has(id));
// 2026-10-18 已批准的生产文案/名称修订；固定前后值投影，原 before 与 CARDS_SYNC 不改。
const APPROVED_PRODUCTION_FACE_REVISIONS = [
  ["cmtn6bge52qt","desc","在背包中才能使用，复原最多两张卡牌","地图背包：从消耗区复原最多2张卡牌；战斗：从本场消耗牌复原最多2张回到手牌。对应消耗区为空时不可使用。"],
  ["foe-esper_candle","desc","攻击 9 / 生命 6。反抗能力者·第4层。掌心烈焰：攻击并灼烧。","攻击 9 / 生命 6。反抗能力者·第4层。掌心烈焰：攻击。"],
  ["foe-fire_el","desc","攻击 10 / 生命 7。变异·第4层。攻击并灼烧。","攻击 10 / 生命 7。变异·第4层。攻击。"],
  ["tt-crystal","desc","在背包中才能使用，可以复原最多 3 张卡牌。","地图背包：从消耗区复原最多3张卡牌；战斗：从本场消耗牌复原最多3张回到手牌。对应消耗区为空时不可使用。"],
  ["tt6-chestdraw","name","熔断双箱","熔断物资箱"],
];
// 2026-10-21 反馈#1/#5（老板实测 12 条）：影噬 rarity 稀有→史诗、神灯第 1 项文案/抉择池改「发现招式」。
// 两卡都在 M 批矩阵（APPROVED_IDS 已含），不走本列表——影噬由 compareMigrationInventories 的
// shadowbugRevision 特例守护，神灯由 isApprovedLampArmorRemoval + helper 的基线文案投影守护。
function approvedProductionFaceBaseline(original) {
  const baseline = approvedRevisionBaseline(original);
  for (const [id, field, previous, current] of APPROVED_PRODUCTION_FACE_REVISIONS) {
    const card = baseline.production.cards.find(row => row.id === id)?.card;
    if (!card || card[field] !== previous) throw new Error(`Unreviewed original ${id}.${field}`);
    card[field] = current;
  }
  return approvedCurrentCatalogBaseline(baseline);
}
const currentBaseline = approvedProductionFaceBaseline(beforeInventory);
const APPROVED_FACE_BY_ID = {
  'cmtn1ntxzoc4': { desc: approvedBatch.flame.desc },
  'tt3-noon-duel': { dmg: 2, dmgType: 'fixed' },
  // 现行规则：本道具主动用于战斗，产卡在使用后的下回合兑现。
  'tt3-mystery-potion': { desc: '仅战斗中使用。使用后，下回合开始时：变成1张随机招式卡牌，使其费用为0。' },
  // 2026-09-29 老板裁决：花瓣法阵 heal 2→3，desc「回复 3」与 before 快照一致故仅 heal 差异。
  'tt3-petal': { heal: 3 },
  // 2026-10-02 老板拍板：自然形态改名满月形态并转牧师职业卡（id 不变，存档/卡库按 id 追踪；rules 仍由 M 批测试守护）。
  'tt3-nature-form': { cls: '牧师', name: '满月形态', rarity: '职业', unrandom: true },
};
const APPROVED_RULES_BY_ID = Object.fromEntries([
  ...MIGRATED_IDS.map(id => [id, HEAL_RULES]),
  ...ALL_M_BATCH_IDS.map(id => [id, null]),
  ['cmtn1ntxzoc4', approvedBatch.flame.rules],
  ['tt3-mystery-potion', approvedExecution['tt3-mystery-potion'].rules],
  ['tt7-ironphalanx', { version: 1, battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [{ op: 'armor', amount: 10 },
      { op: 'acquire', n: 5, pool: { kind: '随机' }, dest: 'deck', act: 'costMinusOne' }] } }],
]);
// Captured read-only at the beginning of the second window, not during the first export.
const SYNC_SOURCE_SHA256 = 'd2f38387dd0c49ca90628aeea5334790286de906838b34e6c7aece0652511244';
const BEFORE_SHA256 = { json: 'c8016a81a58add42b484b3f8045714d8bde01238896f07f1984bcd31038a7d07',
  md: '6730c9696fa79c9cb2d5bbec5d685c3af9383bb30aaf753af15ba3f0d3ceb706' };
const clone = value => JSON.parse(JSON.stringify(value));
const VERIFIED_EVIDENCE = Object.fromEntries(MIGRATED_IDS.map(id => [id, {
  consumerStatus: { status: 'verified-scoped', scope: 'current migrated catalogue copy; map backpack only',
    mapBag: { kind: 'structured', references: ['game/src/hub/game.bag.js:26 useStructuredBagRule',
      'game/src/hub/game.bag.js:73 useOwnedCard', 'game/src/hub/game.bag.js:707 inspectStack',
      'game/src/hub/game.bag.js:743 useDetailCard', 'game/src/run/game.run.scenes.js:265 grantEventCard'] },
    battleBag: { kind: 'legacy-text', modes: ['ordinary', 'BOSS'], reference: 'game/src/battle/battle.bag.js:44 useItem' },
    battleHand: { kind: 'excluded-from-normal-start', references: ['game/src/battle/battle.lifecycle.js:240',
      'game/src/battle/battle.lifecycle.js:254', 'game/src/battle/battle.lifecycle.js:295'] }, base: 'unknown' },
  textStatus: { status: 'mixed', mapBag: 'heal field consumed; rewritten description does not change healing or consumption',
    battleBag: 'ordinary/BOSS bag still consumes description healing; no migration',
    oldCopies: 'old two-point STARTERS/run copies retain their original legacy text behavior',
    wholeCardDescriptionIndependent: false },
  testReferences: { status: 'verified-scoped', references: [
    { path: 'tests/e8-card-migration.test.js:199', test: `${id} acquired production copy matches old map use and ignores rewritten desc`,
      scope: 'actual grantEventCard copy and showBackpack UI-bound callback, mocked session/UI host; HP 50/98/100, rewritten/no-heal/99-heal description, repeat UID' },
    { path: 'tests/e8-card-migration.test.js:216', test: `${id} preserves BOSS rejection and text-based battle bag behavior` },
    { path: 'tests/e8-card-migration.test.js:177', test: 'retains actual STARTERS and pre-existing run two-point copies in the real map bag' },
    { path: 'tests/e8-card-migration.test.js:237', test: 'does not rewrite an existing run copy when the catalogue gains rules' },
  ], validation: { command: 'npx vitest run tests/e8-card-migration.test.js tests/e6-card-rules-capability.test.js --no-file-parallelism',
    result: '2 files / 49 tests passed', reportedBy: 'E8 commander; 2026-09-27 17:48 Asia/Shanghai',
    independentlyCheckedHere: 'source paths and test assertions; no additional effect test rerun or browser acceptance' } },
}]));
let boot, e6, inventory;

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)), clear: () => values.clear(),
  };
}

async function initialize(order) {
  vi.resetModules();
  const storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('SDT', { Icons: { img: () => '', TYPE_ART: {} } });
  expect(window.localStorage).toBe(storage);
  expect(globalThis.localStorage).toBe(storage);
  expect(storage.length).toBe(0);
  const { KEY } = await import('../game/src/cards/cards.js');
  const { dataSlice } = await import('../game/src/cards/cards.data.js');
  const Cards = window.SDT.Cards;
  const sources = [];
  const addSources = (cards, reference, kind = 'resolvedDefinition') => cards.forEach((card, index) => {
    if (card?.id) sources.push({ id: card.id, kind, reference: `${reference}[${index}]` });
  });
  for (const [key, value] of Object.entries(dataSlice)) {
    if (Array.isArray(value)) addSources(value, `game/src/cards/cards.data.js:dataSlice.${key}`);
  }
  addSources([Cards.SHA], 'game/src/cards/cards.rules.js:rulesSlice.SHA');
  addSources(Cards.STARTERS, 'game/src/cards/cards.rules.js:rulesSlice.STARTERS');
  addSources(Cards.CARDS_SYNC, 'game/data/cards-sync.json:cards', 'cardsSync');
  const cardsSync = clone(Cards.CARDS_SYNC);
  let before = clone(Cards.all());
  expect(before).toEqual([]);
  const stages = [];
  for (const name of order) {
    Cards[name]();
    const after = clone(Cards.all());
    stages.push(describeStage(name, before, after));
    before = after;
  }
  expect(JSON.parse(storage.getItem(KEY))).toEqual(before);
  expect(Cards.CARDS_SYNC).toEqual(cardsSync);
  return { production: before, cardsSync, stages, sources, storage };
}

function compareOrders(left, right) {
  const old = new Map(right.production.map(card => [card.id, card]));
  const current = new Map(left.production.map(card => [card.id, card]));
  const bootOnly = [...current.keys()].filter(id => !old.has(id)).sort();
  const e6Only = [...old.keys()].filter(id => !current.has(id)).sort();
  const changed = [...current.keys()].filter(id => old.has(id)
    && JSON.stringify(current.get(id)) !== JSON.stringify(old.get(id))).sort();
  return { bootOrder: BOOT_ORDER, e6Order: E6_ORDER, bootCount: current.size, e6Count: old.size,
    equivalent: !bootOnly.length && !e6Only.length && !changed.length, bootOnly, e6Only, changed,
    e6Counts: { withRules: right.production.filter(card => card.rules !== undefined).length,
      withoutRules: right.production.filter(card => card.rules === undefined).length },
    e6InitStages: right.stages };
}

beforeAll(async () => {
  boot = await initialize(BOOT_ORDER);
  const beforeSecondRun = Array.from({ length: boot.storage.length }, (_, i) => boot.storage.key(i))
    .map(key => [key, boot.storage.getItem(key)]);
  e6 = await initialize(E6_ORDER);
  expect(e6.storage).not.toBe(boot.storage);
  expect(Array.from({ length: boot.storage.length }, (_, i) => boot.storage.key(i))
    .map(key => [key, boot.storage.getItem(key)])).toEqual(beforeSecondRun);
  inventory = buildCardInventory({ ...boot, verifiedEvidence: VERIFIED_EVIDENCE, metadata: {
    storageKind: 'isolated in-memory Storage; fresh module cache and SDT per run', initOrder: BOOT_ORDER,
    initOrderSource: 'game/src/game.boot.js:647-651', comparisonSource: 'first-window E6 order captured in catalog-before.json; current E6 test now uses boot order',
    orderComparison: compareOrders(boot, e6),
    limitations: ['No browser/player storage access', 'Only three approved IDs have scoped consumer/text/effect-test evidence',
      'Source references are observed resolved definitions, not a complete override provenance chain',
      'Capability is battle-entry only; bag-only rules do not add onPlay coverage; unreviewed consumers remain unknown'],
  } });
});

afterAll(() => vi.unstubAllGlobals());

describe('E8 isolated production inventory', () => {
  it('exports every initialized card and the separate immutable CARDS_SYNC source with complete classifications', () => {
    assertInventoryComplete(inventory, boot);
    expect(inventory.production.counts.total).toBeGreaterThan(0);
    expect(inventory.cardsSync.counts.total).toBeGreaterThan(0);
    for (const scope of ['production', 'cardsSync']) {
      expect(inventory[scope].cards.filter(row => !row.schema.ok || !row.capability.ok)).toEqual([]);
      expect(inventory.checks.missingClassifications[scope].missing).toBe(0);
      const unreviewed = inventory[scope].cards.filter(row => scope !== 'production' || !MIGRATED_IDS.includes(row.id));
      expect(inventory.checks.missingClassifications[scope].unknownCards).toBe(unreviewed.length);
      expect(unreviewed.every(row => row.unknowns.includes('consumerStatus')
        && row.unknowns.includes('textStatus') && row.unknowns.includes('testReferences'))).toBe(true);
    }
    const { equivalent, bootOnly, e6Only, changed } = inventory.metadata.orderComparison;
    console.info('E8 inventory counts', JSON.stringify({ production: inventory.production.counts,
      cardsSync: inventory.cardsSync.counts, orderComparison: { equivalent, bootOnly, e6Only, changed } }));
  });

  it('fails on duplicate/missing IDs, omitted entries, counts and missing classifications', () => {
    expect(describeStage('JSON key order', [{ id: 'same', cost: 1 }], [{ cost: 1, id: 'same' }]).changed).toEqual([]);
    const first = boot.production[0];
    expect(() => describeStage('duplicate', [], [first, first])).toThrow('duplicate ID');
    expect(() => describeStage('missing', [], [{}])).toThrow('missing stable ID');
    const omitted = clone(inventory);
    omitted.production.cards.pop();
    expect(() => assertInventoryComplete(omitted, boot)).toThrow('omitted or unexpected IDs');
    const unbalanced = clone(inventory);
    unbalanced.cardsSync.counts.total++;
    expect(() => assertInventoryComplete(unbalanced, boot)).toThrow('count imbalance');
    const missing = clone(inventory);
    delete missing.production.cards[0].consumerStatus;
    expect(() => assertInventoryComplete(missing, boot)).toThrow('missing classification');
    const stageGap = clone(inventory);
    stageGap.production.initStages[0].added.pop();
    expect(() => assertInventoryComplete(stageGap, boot)).toThrow('count imbalance');
  });

  it('changes only approved migrations and the exact backupcell draw/refill revision', () => {
    const approvedIds = APPROVED_IDS;
    expect(M_BATCH_ONPLAY_IDS.every(id => ALL_M_BATCH_IDS.includes(id))).toBe(true);
    const comparison = compareMigrationInventories(currentBaseline, inventory, approvedIds, HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID);
    expect(comparison.addedIds.slice().sort()).toEqual(approvedBatch.additions.map(card => card.id).sort());
    expect(comparison.changedIds.sort()).toEqual([...approvedIds].sort());
    const unexpected = clone(inventory);
    unexpected.production.cards.find(row => row.id === MIGRATED_IDS[0]).card.heal++;
    expect(() => compareMigrationInventories(currentBaseline, unexpected, approvedIds, HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID))
      .toThrow('changed beyond approved rules addition');
    const changedSync = clone(inventory);
    changedSync.cardsSync.cards[0].card.desc += 'changed';
    expect(() => compareMigrationInventories(currentBaseline, changedSync, approvedIds, HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID))
      .toThrow('CARDS_SYNC card fields changed');
  });

  it('本批只允许14个精确新ID，新增卡的任何字段漂移、漏卡和未知新增均拒绝', () => {
    expect(approvedBatch.additions.map(card => card.id).sort()).toEqual([
      'tt13-astrolabe','tt13-bitter-rain','tt13-chaos-deck','tt13-flame-staff',
      'tt13-guard','tt13-magazine','tt13-mercy','tt13-mind-control','tt13-poor-meal','tt13-scale-armor',
      'tt13-snipe','tt13-soul-contract','tt13-spring','tt13-stellar-divination',
    ]);
    const compare = changed => compareMigrationInventories(currentBaseline, changed, APPROVED_IDS,
      HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID);
    for (const approved of approvedBatch.additions) {
      for (const mutate of [card => { card.cost++; }, card => { card.desc += '额外效果'; },
        card => { card.rules = {}; }, card => { card.unknown = true; }]) {
        const changed = clone(inventory); mutate(changed.production.cards.find(row => row.id === approved.id).card);
        expect(() => compare(changed)).toThrow(`${approved.id} differs from approved new card`);
      }
    }
    const unknown = clone(inventory); unknown.production.cards.push({ id:'tt13-unknown', card:{ id:'tt13-unknown' } });
    expect(() => compare(unknown)).toThrow('card IDs changed');
    const missing = clone(inventory); missing.production.cards = missing.production.cards.filter(row => row.id !== 'tt13-spring');
    expect(() => compare(missing)).toThrow('card IDs changed');
  });

  it('火焰形态仅批准精确旧规则到新文案与宿主，数值/规则/额外字段漂移拒绝', () => {
    for (const mutate of [card => { card.cost++; }, card => { card.desc += '额外效果'; },
      card => { card.rules.triggers.onPlay[0].amount = 9; }, card => { card.unknown = true; }]) {
      const changed = clone(inventory); mutate(changed.production.cards.find(row => row.id === approvedBatch.flame.id).card);
      expect(() => compareMigrationInventories(currentBaseline, changed, APPROVED_IDS,
        HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID)).toThrow('cmtn1ntxzoc4 changed beyond approved rules addition');
    }
    const changedBefore = clone(currentBaseline); changedBefore.production.cards.find(row => row.id === approvedBatch.flame.id).card.cost++;
    expect(() => compareMigrationInventories(changedBefore, inventory, APPROVED_IDS,
      HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID)).toThrow('cmtn1ntxzoc4 changed beyond approved rules addition');
  });

  it('铁甲阵仅将洗入牌库的获取动作由费用归零改为费用减1', () => {
    const current = inventory.production.cards.find(row => row.id === 'tt7-ironphalanx').card;
    expect(current.rules).toEqual(APPROVED_RULES_BY_ID['tt7-ironphalanx']);
    const reverted = clone(inventory);
    reverted.production.cards.find(row => row.id === 'tt7-ironphalanx').card.rules.triggers.onPlay[1].act = 'zeroCost';
    expect(() => compareMigrationInventories(currentBaseline, reverted, APPROVED_IDS,
      HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID))
      .toThrow('missing=tt7-ironphalanx');
    for (const mutate of [
      card => { card.rules.triggers.onPlay[1].dest = 'hand'; },
      card => { card.rules.triggers.onPlay[1].n = 4; },
      card => { card.desc += '额外效果'; },
      card => { card.cost++; },
      card => { card.extra = true; },
    ]) {
      const changed = clone(inventory);
      mutate(changed.production.cards.find(row => row.id === 'tt7-ironphalanx').card);
      expect(() => compareMigrationInventories(currentBaseline, changed, APPROVED_IDS,
        HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID))
        .toThrow('tt7-ironphalanx changed beyond approved rules addition');
    }
  });

  it('五条生产修订精确锁定旧值与新值，规则、费用、回退旧文案或额外字段均拒绝', () => {
    for (const [id, field, previous] of APPROVED_PRODUCTION_FACE_REVISIONS) {
      const current = inventory.production.cards.find(row => row.id === id).card;
      expect(current).toEqual(currentBaseline.production.cards.find(row => row.id === id).card);
      for (const mutate of [
        card => { card[field] = previous; }, card => { card[field] += '额外说明'; },
        card => { card.cost++; }, card => { card.rules = { version:1 }; }, card => { card.extra = true; },
      ]) {
        const changed = clone(inventory);
        mutate(changed.production.cards.find(row => row.id === id).card);
        expect(() => compareMigrationInventories(currentBaseline, changed, APPROVED_IDS,
          HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID)).toThrow('changed IDs differ from approved IDs');
      }
    }
  });

  it('事件与腐化之种只接受精确批准字段，回退、扩效与额外字段均拒绝', () => {
    for (const [id, field, previous, current] of APPROVED_1018_PRODUCTION_REVISIONS) {
      expect(inventory.production.cards.find(row => row.id === id).card[field]).toBe(currentApprovedFieldValue(id,field,current));
      for (const mutate of [
        card => { if (previous === undefined) delete card[field]; else card[field] = previous; },
        card => { card[field] = current + '额外效果'; },
        card => { card.cost++; }, card => { card.extra = true; },
      ]) {
        const changed = clone(inventory);
        mutate(changed.production.cards.find(row => row.id === id).card);
        expect(() => compareMigrationInventories(currentBaseline, changed, APPROVED_IDS,
          HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID)).toThrow();
      }
      const wrongBefore = clone(beforeInventory);
      wrongBefore.production.cards.find(row => row.id === id).card[field] = '未经批准的旧值';
      expect(() => approvedRevisionBaseline(wrongBefore)).toThrow(`Unreviewed original ${id}.${field}`);
    }
  });

  it('神秘药水只接受主动战斗使用的新文案与精确延迟产卡声明，改写和扩效拒绝', () => {
    const previous = currentBaseline.production.cards.find(row => row.id === 'tt3-mystery-potion').card;
    expect(previous.desc).toBe('回合开始时：变成1张随机招式卡牌，使其费用为0。');
    const current = inventory.production.cards.find(row => row.id === 'tt3-mystery-potion').card;
    expect(current.desc).toBe(APPROVED_FACE_BY_ID['tt3-mystery-potion'].desc);
    expect(current.rules).toEqual(APPROVED_RULES_BY_ID['tt3-mystery-potion']);
    for (const mutate of [
      card => { card.desc = previous.desc; }, card => { card.desc += '额外效果'; }, card => { card.cost++; },
      card => { card.rules.battle.hosted = ['other-choice']; }, card => { card.extra = true; },
    ]) {
      const changed = clone(inventory);
      mutate(changed.production.cards.find(row => row.id === 'tt3-mystery-potion').card);
      expect(() => compareMigrationInventories(currentBaseline, changed, APPROVED_IDS,
        HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID)).toThrow('tt3-mystery-potion changed beyond approved rules addition');
    }
  });

  it('后备能源只批准术语修订与固定抽牌回满规则，费用、其他字段及扩效均拒绝', () => {
    const previous = currentBaseline.production.cards.find(row => row.id === 'tt12-backupcell').card;
    const current = inventory.production.cards.find(row => row.id === 'tt12-backupcell').card;
    expect(isApprovedBackupcellRevision(previous, current)).toBe(true);
    for (const mutate of [
      card => { card.desc += '额外效果'; }, card => { card.cost++; },
      card => { card.draw++; }, card => { card.name += '改'; },
      card => { card.rules.version++; },
      card => { card.rules.battle.costModifiers[0].amount = 2; },
      card => { card.rules.battle.target.side = 'self'; },
      card => { card.rules.battle.target.area = true; },
      card => { delete card.rules.triggers; },
      card => { card.rules.triggers.onPlay.pop(); },
      card => { card.rules.triggers.onPlay.reverse(); },
      card => { card.rules.triggers.onPlay[0] = { op: 'draw', amount: 2 }; },
      card => { card.rules.triggers.onPlay[1] = { op: 'energy', n: 9 }; },
      card => { card.rules.triggers.onPlay[1].n = 9; },
      card => { card.rules.triggers.onPlay.push({ op: 'energy', n: 1 }); },
      card => { card.rules.triggers.onTurnStart = [{ op: 'refillEnergy' }]; },
      card => { card.extra = true; }, card => { card.id = 'another-card'; },
    ]) {
      const changed = clone(current);
      mutate(changed);
      expect(isApprovedBackupcellRevision(previous, changed)).toBe(false);
      const changedInventory = clone(inventory);
      changedInventory.production.cards.find(row => row.id === 'tt12-backupcell').card = changed;
      expect(() => compareMigrationInventories(currentBaseline, changedInventory, APPROVED_IDS,
        HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID)).toThrow();
    }
    for (const mutate of [
      card => { card.desc += '其他旧文案'; }, card => { card.cost++; },
      card => { card.rules.battle.costModifiers[0].amount = 2; },
      card => { card.rules.triggers = { onPlay: [] }; }, card => { card.extra = true; },
    ]) {
      const changedBefore = clone(previous);
      mutate(changedBefore);
      expect(isApprovedBackupcellRevision(changedBefore, current)).toBe(false);
    }
    const changed = clone(inventory);
    changed.production.cards.find(row => row.id === 'tt12-backupcell').card.cost++;
    expect(() => compareMigrationInventories(currentBaseline, changed, APPROVED_IDS,
      HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID)).toThrow('changed IDs differ from approved IDs');
  });

  it('影噬只批准稀有到史诗及精确既有 M3 声明，其他卡面与规则漂移拒绝', () => {
    const compare = (baseline, changed) => compareMigrationInventories(baseline, changed, APPROVED_IDS,
      HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID);
    expect(() => compare(currentBaseline, inventory)).not.toThrow();
    for (const mutate of [
      card => { card.rarity = '传说'; }, card => { card.cost++; }, card => { card.desc += '额外'; },
      card => { card.rules.triggers.onPlay[0].capTo = 0; },
      card => { card.rules.triggers.onPlay.push({ op: 'armor', amount: 1 }); },
      card => { card.unknown = true; },
    ]) {
      const changed = clone(inventory);
      mutate(changed.production.cards.find(row => row.id === 'tt3sp-shadowbug').card);
      expect(() => compare(currentBaseline, changed)).toThrow('tt3sp-shadowbug changed beyond approved rules addition');
    }
    for (const mutate of [card => { card.rarity = '古朴'; }, card => { card.rules = {}; }]) {
      const changedBefore = clone(currentBaseline);
      mutate(changedBefore.production.cards.find(row => row.id === 'tt3sp-shadowbug').card);
      expect(() => compare(changedBefore, inventory)).toThrow('tt3sp-shadowbug changed beyond approved rules addition');
    }
  });

  it('神灯只批准已知生产副本的 armor:5 删除及精确 M11 声明', () => {
    for (const change of [
      card => { card.armor = 0; }, card => { card.armor = 5; }, card => { card.armor = 7; },
      card => { card.armor = undefined; }, card => { card.desc += '自定义'; },
      card => { card.cost++; }, card => { card.rules.battle.hosted = ['other-choice']; },
      card => { card.rules.triggers.onPlay[0].options[0].ops[0].pool.kind = '随机'; },
      card => { card.rules.triggers.onPlay[0].options[2].ops[1].amount = 6; },
    ]) {
      const changed = clone(inventory);
      change(changed.production.cards.find(row => row.id === 'tt3-magic-lamp').card);
      expect(() => compareMigrationInventories(currentBaseline, changed, APPROVED_IDS,
        HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID))
        .toThrow('tt3-magic-lamp changed beyond approved rules addition');
    }
    for (const change of [
      card => { card.armor = 7; }, card => { card.armor = '5'; },
      card => { card.desc = '获得 5 点护甲。'; }, card => { card.name = '自定义神灯'; },
    ]) {
      const changedBefore = clone(currentBaseline);
      change(changedBefore.production.cards.find(row => row.id === 'tt3-magic-lamp').card);
      expect(() => compareMigrationInventories(changedBefore, inventory, APPROVED_IDS,
        HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID))
        .toThrow('tt3-magic-lamp changed beyond approved rules addition');
    }
  });

  it('accepts only an explicit after generation selector; before evidence is frozen', () => {
    expect(['', 'after']).toContain(process.env.SDT_E8_WRITE_INVENTORY || '');
  });

  it('explicitly generates only after evidence', async context => {
    if (process.env.SDT_E8_WRITE_INVENTORY !== 'after') context.skip('证据写入需显式SDT_E8_WRITE_INVENTORY=after；默认只读');
    const { execFileSync } = await import('node:child_process');
    const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const { resolve, join } = await import('node:path');
    const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
    const output = clone(inventory);
    output.metadata.generatedAt = new Date().toISOString();
    output.metadata.head = git(['rev-parse', 'HEAD']);
    output.metadata.upstreamDelta = git(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
    output.metadata.upstreamDeltaMeaning = 'local-only remote-only; local upstream reference, no fetch';
    output.metadata.phase = 'after';
    output.metadata.command = '$env:SDT_E8_WRITE_INVENTORY="after"; npx vitest run tests/e8-card-inventory.test.js --no-file-parallelism';
    assertInventoryComplete(output, boot);
    output.checks.migration = compareMigrationInventories(beforeInventory, output, APPROVED_IDS, HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID);
    const directory = resolve('docs/evidence/e8-card-migration-2026-09-27');
    const fileHash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
    for (const extension of ['json', 'md']) {
      expect(fileHash(join(directory, `catalog-before.${extension}`))).toBe(BEFORE_SHA256[extension]);
    }
    const sourceHash = fileHash(resolve('game/data/cards-sync.json'));
    expect(sourceHash).toBe(SYNC_SOURCE_SHA256);
    output.metadata.cardsSyncSource = { path: 'game/data/cards-sync.json', sha256: sourceHash,
      baselineSha256: SYNC_SOURCE_SHA256, baselineScope: 'read-only capture at start of second window; not first-window capture',
      baselineRecordedAt: '2026-09-27T09:38:49Z',
      bytesUnchanged: true };
    output.metadata.frozenBeforeSha256 = BEFORE_SHA256;
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'catalog-after.json'), JSON.stringify(output, null, 2) + '\n');
    writeFileSync(join(directory, 'catalog-after.md'), renderCardInventory(output));
  });
});
