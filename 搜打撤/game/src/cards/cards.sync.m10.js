// @ts-check
/* M10（2026-09-27）：B-M3 装备剩余 hosted 批，共 11 张。
 * Hosted 名称必须同时匹配固定 id 注册表与 canonical description；battle.hosted 执行适配由
 * battle.hosted.js 提供，玩家保存卡的自定义描述不参与宿主分派。
 * M7 已迁 tt3-master-staff / tt3-twinwater-mail，故此批不重复声明。
 */
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

const MARKER_KEY = 'sdt-cards-m10-hosted-equipment-v1-seeded';
const hostedRuleById = new Map([
  ['tt2-frostsword', 'frost-sword'],
  ['tt3-crimson-pouch', 'crimson-pouch'],
  ['tt3-fate-wheel', 'fate-wheel'],
  ['tt3eq-boiler', 'boiler'],
  ['tt3-azure-sword', 'azure-sword'],
  ['tt3-chaos-eye', 'chaos-eye'],
  ['tt3-immortal-blade', 'immortal-blade'],
  ['tt3-silver-runesword', 'silver-runesword'],
  ['tt3-sapper-bomb', 'sapper-bomb'],
  ['tt3-wolf-bow', 'wolf-bow'],
  ['tt3-reverse-bow', 'reverse-bow'],
]);
const definitions = new Map([...hostedRuleById].map(([id, name]) => [id, {
  rules: { version: 1, battle: { hosted: [name] } },
}]));
const CANONICAL_TABLE_BY_ID = new Map([...hostedRuleById.keys()].map(id => [id, 'TABLETOP10']));

function sameSnapshot(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && left.length !== right.length) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(right, key) && sameSnapshot(left[key], right[key]));
}

/**
 * Conservative M10 backfill from current TABLETOP10 canonical rows.
 * @param {{ storage?: Storage | null, library?: any, storeKey?: string }} [deps]
 */
export function ensureM10HostedEquipmentRules(deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const library = deps.library !== undefined ? deps.library
    : (typeof window !== 'undefined' ? window.SDT?.Cards : null);
  const storeKey = deps.storeKey ?? KEY;
  try {
    if (!storage || !library || storage.getItem(MARKER_KEY) === '1') return;
    const raw = storage.getItem(storeKey);
    if (raw == null) return;
    const storedCards = JSON.parse(raw);
    if (!Array.isArray(storedCards) || !storedCards.length || storedCards.some(card =>
      !card || typeof card !== 'object' || Array.isArray(card) || typeof card.id !== 'string' || !card.id)) return;
    if (new Set(storedCards.map(card => card.id)).size !== storedCards.length) return;
    if (!sameSnapshot(library.all(), storedCards)) return;

    const canonicalById = new Map();
    for (const [id, tableName] of CANONICAL_TABLE_BY_ID) {
      const table = library[tableName];
      const found = Array.isArray(table) ? table.find(card => card?.id === id) : null;
      if (!found) return;
      canonicalById.set(id, found);
    }

    const foundIds = new Set();
    let dirty = false;
    const nextCards = library.all().map(card => {
      const definition = definitions.get(card.id);
      if (!definition) return card;
      foundIds.add(card.id);
      if (Object.prototype.hasOwnProperty.call(card, 'rules') ||
          !sameSnapshot(card, canonicalById.get(card.id))) return card;
      const nextCard = { ...card, rules: definition.rules };
      const validation = validateCardRules(nextCard);
      if (!validation.ok) throw new Error(`M10 schema rejected ${card.id}: ${JSON.stringify(validation.errors)}`);
      const capability = inspectCardRuleCapability(nextCard);
      if (!capability.ok) throw new Error(`M10 capability rejected ${card.id}: ${JSON.stringify(capability.issues)}`);
      dirty = true;
      return nextCard;
    });
    if (foundIds.size !== definitions.size) return;

    if (dirty) {
      let saved = false;
      try { saved = library.saveAll(nextCards); } catch { return; }
      if (!saved || storage.getItem(storeKey) !== JSON.stringify(nextCards)) return;
    } else if (storage.getItem(storeKey) !== raw) return;
    storage.setItem(MARKER_KEY, '1');
  } catch (error) {
    console.error('[cards] M10 hosted equipment migration failed; marker was not written:', error);
  }
}

export const M10_HOSTED_EQUIPMENT_MARKER_KEY = MARKER_KEY;
