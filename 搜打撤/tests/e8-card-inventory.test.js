import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertInventoryComplete, buildCardInventory, compareMigrationInventories, describeStage, renderCardInventory } from './helpers/e8-card-inventory.js';
import beforeInventory from '../docs/evidence/e8-card-migration-2026-09-27/catalog-before.json';
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
const APPROVED_IDS = [...MIGRATED_IDS, ...ALL_M_BATCH_IDS];
const APPROVED_FACE_BY_ID = {
  'tt3-noon-duel': { dmg: 2, dmgType: 'fixed' },
  // 2026-09-29 老板裁决：花瓣法阵 heal 2→3，desc「回复 3」与 before 快照一致故仅 heal 差异。
  'tt3-petal': { heal: 3 },
  // 2026-10-02 老板拍板：自然形态改名满月形态并转牧师职业卡（id 不变，存档/卡库按 id 追踪；rules 仍由 M 批测试守护）。
  'tt3-nature-form': { cls: '牧师', name: '满月形态', rarity: '职业', unrandom: true },
};
const APPROVED_RULES_BY_ID = Object.fromEntries([
  ...MIGRATED_IDS.map(id => [id, HEAL_RULES]),
  ...ALL_M_BATCH_IDS.map(id => [id, null]),
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

  it('changes only approved IDs (E8 bag heal + M batch onPlay) by adding rules, leaving every other full card untouched', () => {
    const approvedIds = APPROVED_IDS;
    expect(M_BATCH_ONPLAY_IDS.every(id => ALL_M_BATCH_IDS.includes(id))).toBe(true);
    const comparison = compareMigrationInventories(beforeInventory, inventory, approvedIds, HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID);
    expect(comparison.changedIds.sort()).toEqual([...approvedIds].sort());
    const unexpected = clone(inventory);
    unexpected.production.cards.find(row => row.id === MIGRATED_IDS[0]).card.heal++;
    expect(() => compareMigrationInventories(beforeInventory, unexpected, approvedIds, HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID))
      .toThrow('changed beyond approved rules addition');
    const changedSync = clone(inventory);
    changedSync.cardsSync.cards[0].card.desc += 'changed';
    expect(() => compareMigrationInventories(beforeInventory, changedSync, approvedIds, HEAL_RULES, APPROVED_RULES_BY_ID, APPROVED_FACE_BY_ID))
      .toThrow('CARDS_SYNC card fields changed');
  });

  it('accepts only an explicit after generation selector; before evidence is frozen', () => {
    expect(['', 'after']).toContain(process.env.SDT_E8_WRITE_INVENTORY || '');
  });

  it.runIf(process.env.SDT_E8_WRITE_INVENTORY === 'after')('explicitly generates only after evidence', async () => {
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
