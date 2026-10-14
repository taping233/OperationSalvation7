import { validateCardRules } from '../../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../../game/src/cards/card-rules.capability.js';
import { isApprovedLampArmorRemoval } from './card-catalog-approved-revisions.js';

const clone = value => JSON.parse(JSON.stringify(value));
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const equal = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));
const classificationKeys = ['sourceDefinitions', 'consumerStatus', 'textStatus', 'testReferences'];

function indexed(cards, label) {
  const result = new Map();
  for (const card of cards) {
    if (typeof card?.id !== 'string' || !card.id.trim()) throw new Error(`${label}: missing stable ID`);
    if (result.has(card.id)) throw new Error(`${label}: duplicate ID ${card.id}`);
    result.set(card.id, card);
  }
  return result;
}

export function describeStage(name, before, after) {
  const old = indexed(before, `${name}/before`);
  const next = indexed(after, `${name}/after`);
  const added = [...next.keys()].filter(id => !old.has(id));
  const removed = [...old.keys()].filter(id => !next.has(id));
  const changed = [...next.keys()].filter(id => old.has(id) && !equal(old.get(id), next.get(id)))
    .map(id => ({ id, fields: [...new Set([...Object.keys(old.get(id)), ...Object.keys(next.get(id))])]
      .filter(key => !equal(old.get(id)[key], next.get(id)[key])).sort() }));
  return { name, beforeCount: before.length, afterCount: after.length, added, removed, changed };
}

function operationEntries(value, path = 'rules') {
  if (!value || typeof value !== 'object') return [];
  return [
    ...(typeof value.op === 'string' ? [{ path, op: value.op }] : []),
    ...Object.entries(value).flatMap(([key, child]) => operationEntries(child, `${path}.${key}`)),
  ];
}

function summarize(rows) {
  const count = values => Object.fromEntries([...new Set(values)].sort()
    .map(value => [value, values.filter(item => item === value).length]));
  return {
    total: rows.length, withRules: rows.filter(row => row.hasRules).length,
    withoutRules: rows.filter(row => !row.hasRules).length,
    schema: count(rows.map(row => row.schema.ok ? 'valid' : 'invalid')),
    schemaPending: rows.filter(row => row.schema.pending.length > 0).length,
    capability: count(rows.map(row => row.capability.kind)),
    domains: count(rows.flatMap(row => row.domains)),
    triggers: count(rows.flatMap(row => row.triggers)),
    ops: count(rows.flatMap(row => row.ops.map(entry => entry.op))),
  };
}

function rowsFor(cards, sources, stages, scope, verifiedEvidence = {}) {
  indexed(cards, scope);
  return cards.map(card => {
    const definitions = sources.filter(source => source.id === card.id)
      .map(source => Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'id')));
    const sourceDefinitions = definitions.length ? { status: 'observed', references: definitions }
      : { status: 'unknown', references: [] };
    const row = {
      id: card.id, name: card.name ?? null, type: card.type ?? null, desc: card.desc ?? null,
      card: clone(card), sourceDefinitions,
      observedInitChanges: stages.flatMap(stage => [
        ...(stage.added.includes(card.id) ? [{ stage: stage.name, kind: 'added' }] : []),
        ...stage.changed.filter(change => change.id === card.id)
          .map(change => ({ stage: stage.name, kind: 'changed', fields: change.fields })),
      ]),
      hasRules: card.rules !== undefined, schema: validateCardRules(card),
      capability: inspectCardRuleCapability(card),
      domains: Object.keys(card.rules || {}).filter(key => key !== 'version').sort(),
      triggers: Object.keys(card.rules?.triggers || {}).sort(), ops: operationEntries(card.rules),
      consumerStatus: { status: 'unknown', battle: 'unknown', base: 'unknown', bag: 'unknown' },
      textStatus: { status: 'unknown' }, testReferences: { status: 'unknown', references: [] },
    };
    for (const key of ['consumerStatus', 'textStatus', 'testReferences']) {
      if (verifiedEvidence[card.id]?.[key]) row[key] = clone(verifiedEvidence[card.id][key]);
    }
    row.unknowns = classificationKeys.filter(key => row[key].status === 'unknown');
    return row;
  }).sort((left, right) => left.id.localeCompare(right.id, 'en'));
}

export function assertInventoryComplete(inventory, expected) {
  for (const scope of ['production', 'cardsSync']) {
    const { cards, counts } = inventory[scope];
    const ids = [...indexed(cards, scope).keys()].sort();
    const expectedIds = [...indexed(expected[scope], `${scope}/expected`).keys()].sort();
    if (!equal(ids, expectedIds)) throw new Error(`${scope}: omitted or unexpected IDs`);
    if (!equal(counts, summarize(cards))) throw new Error(`${scope}: count imbalance`);
    for (const row of cards) for (const key of classificationKeys) {
      if (!row[key]?.status) throw new Error(`${scope}/${row.id}: missing classification ${key}`);
    }
  }
  let count = 0;
  const live = new Set();
  for (const stage of inventory.production.initStages) {
    if (stage.beforeCount !== count) throw new Error(`${stage.name}: discontinuous count`);
    for (const id of stage.removed) {
      if (!live.delete(id)) throw new Error(`${stage.name}: removing absent ID ${id}`);
    }
    for (const id of stage.added) {
      if (live.has(id)) throw new Error(`${stage.name}: adding existing ID ${id}`);
      live.add(id);
    }
    if (stage.changed.some(change => !live.has(change.id))) throw new Error(`${stage.name}: changed absent ID`);
    count += stage.added.length - stage.removed.length;
    if (count !== stage.afterCount || live.size !== count) throw new Error(`${stage.name}: count imbalance`);
  }
  if (!equal([...live].sort(), expected.production.map(card => card.id).sort())) {
    throw new Error('production: initialization omitted IDs');
  }
}

export function buildCardInventory({ production, cardsSync, stages, sources, metadata, verifiedEvidence }) {
  const productionRows = rowsFor(production, sources, stages, 'production', verifiedEvidence);
  const syncRows = rowsFor(cardsSync, sources.filter(source => source.kind === 'cardsSync'), [], 'cardsSync');
  const inventory = {
    metadata: clone(metadata),
    production: { counts: summarize(productionRows), initStages: clone(stages), cards: productionRows },
    cardsSync: { counts: summarize(syncRows), cards: syncRows },
    checks: { duplicateIds: 0, omittedIds: 0, countImbalances: 0,
      missingClassifications: Object.fromEntries([['production', productionRows], ['cardsSync', syncRows]]
        .map(([scope, rows]) => [scope, { missing: 0,
          unknownCards: rows.filter(row => row.unknowns.length).length,
          unknownByField: Object.fromEntries(classificationKeys.map(key =>
            [key, rows.filter(row => row[key].status === 'unknown').length])) }])) },
  };
  assertInventoryComplete(inventory, { production, cardsSync });
  return inventory;
}

export function compareMigrationInventories(before, after, approvedIds, expectedRules, expectedRulesById, expectedFaceById = {}) {
  const previous = before.production.cards.map(row => row.card);
  const current = after.production.cards.map(row => row.card);
  const delta = describeStage('E8 approved migration', previous, current);
  if (delta.added.length || delta.removed.length) throw new Error('migration: card IDs changed');
  if (!equal(delta.changed.map(row => row.id).sort(), [...approvedIds].sort())) {
    const actual = new Set(delta.changed.map(row => row.id));
    const expected = new Set(approvedIds);
    throw new Error('migration: changed IDs differ from approved IDs; extra=' +
      [...actual].filter(id => !expected.has(id)).join(',') + '; missing=' +
      [...expected].filter(id => !actual.has(id)).join(','));
  }
  const oldById = indexed(previous, 'before');
  const nextById = indexed(current, 'after');
  const changes = delta.changed.map(({ id, fields }) => {
    const oldCard = oldById.get(id);
    const nextCard = nextById.get(id);
    // 期望规则表优先；值为 null 表示该卡 rules 内容由其批次测试守护，这里只锁「仅新增 rules 字段」。
    const expected = expectedRulesById ? (id in expectedRulesById ? expectedRulesById[id] : expectedRules) : expectedRules;
    const expectedFace = expectedFaceById[id] || {};
    const lampRemoval = id === 'tt3-magic-lamp';
    const expectedFields = ['rules', ...Object.keys(expectedFace), ...(lampRemoval ? ['armor'] : [])].sort();
    if (oldCard.rules !== undefined || !equal(fields, expectedFields)
      || (lampRemoval && !isApprovedLampArmorRemoval(oldCard, nextCard))
      || Object.entries(expectedFace).some(([key, value]) => !equal(nextCard[key], value))
      || (expected !== null && !equal(nextCard.rules, expected))) {
      throw new Error(`migration: ${id} changed beyond approved rules addition`);
    }
    return { id, fields, before: clone(oldCard), after: clone(nextCard) };
  });
  const syncBefore = before.cardsSync.cards.map(row => row.card);
  const syncAfter = after.cardsSync.cards.map(row => row.card);
  if (!equal(syncBefore, syncAfter)) throw new Error('migration: CARDS_SYNC card fields changed');
  return { beforeCount: previous.length, afterCount: current.length, addedIds: delta.added,
    removedIds: delta.removed, changedIds: changes.map(change => change.id), changes, cardsSyncCardsUnchanged: true };
}

export function renderCardInventory(inventory) {
  const escape = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
  const phase = inventory.metadata.phase || 'before';
  const lines = [`# E8 真实初始化全卡清单（${phase === 'after' ? '迁移后' : '迁移前'}）`, '',
    `生成时间：${inventory.metadata.generatedAt}；HEAD：\`${inventory.metadata.head}\`。`, '',
    `本文件由显式生成模式输出；完整原始字段、规则、阶段变化和校验诊断见同目录 catalog-${phase}.json。`, '',
    `存储：${inventory.metadata.storageKind}；顺序：${inventory.metadata.initOrder.join(' → ')}。`, '',
    'sourceDefinitions 仅证明运行时定义按稳定 ID 匹配，不证明最终覆盖来源；observedInitChanges 为外层初始化阶段的实际快照差异。',
    'capability 是 E6 battle-entry 预检，supported 不证明 base/bag 执行、实际消费或完整效果结构化。',
    phase === 'after' ? '仅本批三候选补有范围限定的消费端、文本与测试证据；其余保持 unknown。地图背包迁移不代表战斗背包或 onPlay 迁移，清单生成不等于实页验收。'
      : 'consumerStatus / textStatus / testReferences 未逐卡审计，均明确 unknown。清单生成不等于效果实测或实页验收。', '',
    '## 初始化顺序对照', '', '```json', JSON.stringify(inventory.metadata.orderComparison, null, 2), '```', ''];
  if (inventory.checks.migration) lines.push('## 迁移前后完整字段核对', '', '```json',
    JSON.stringify(inventory.checks.migration, null, 2), '```', '',
    '原始 CARDS_SYNC 文件字节证据：', '', '```json', JSON.stringify(inventory.metadata.cardsSyncSource, null, 2), '```', '');
  if (phase === 'after') lines.push('## 三候选的限定证据', '', '```json',
    JSON.stringify(inventory.production.cards.filter(row => row.testReferences.status !== 'unknown')
      .map(({ id, consumerStatus, textStatus, testReferences }) => ({ id, consumerStatus, textStatus, testReferences })), null, 2),
    '```', '');
  for (const scope of ['production', 'cardsSync']) {
    const section = inventory[scope];
    lines.push(`## ${scope}`, '', '```json', JSON.stringify(section.counts, null, 2), '```', '',
      `分类完整性：${JSON.stringify(inventory.checks.missingClassifications[scope])}`, '',
      '| ID | 名称 | 类型 | rules | schema | capability | 域 | triggers / ops | 定义引用 | 未知分类 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const row of section.cards) lines.push('| ' + [row.id, row.name, row.type, row.hasRules,
      row.schema.ok ? `valid (pending=${row.schema.pending.length})` : 'invalid', row.capability.kind,
      row.domains.join(', '), `${row.triggers.join(', ')} / ${row.ops.map(entry => entry.op).join(', ')}`,
      row.sourceDefinitions.references.map(ref => ref.reference).join('; ') || 'unknown', row.unknowns.join(', ')]
      .map(escape).join(' | ') + ' |');
    lines.push('');
  }
  return lines.join('\n') + '\n';
}
