// @ts-check
/* M7 装备收编（2026-09-27）：仅迁当前 schema、capability 与运行时执行器均可完整消费的卡。
 * canonical 直接从 TABLETOP10/11 读取，按实际运行时定版深相等；不依赖旧 TABLETOP3 行。
 * rules.equip 是装备文本效果的单源开关，因此每张卡必须覆盖其当前 canonical 描述全部效果。
 * 其余复杂装备与阻塞原因见 docs/M7-RESULT.md。
 */
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

const MARKER_KEY = 'sdt-cards-m7-equip-rules-v1-seeded';
const equip = value => ({ rules: { version: 1, equip: value } });
// pure trigger 装备也要声明 no-op onEquip，使 M3 suppressText 生效；schema 不接受空 equip 对象，
// 空 ops 数组是合法、无行为的单源标记，避免旧装备文本路径与 trigger runner 双结算。
const equipTrigger = value => ({ rules: { version: 1, equip: { onEquip: [] }, triggers: value } });

const definitions = new Map([
  ['tt3-longsword', equip({ passive: { aura: { atk: 1 } } })],
  ['tt3-staff', equip({ passive: { aura: { spellPower: 1 } } })],
  ['tt3-grass-armor', equip({ onEquip: [{ op: 'armor', amountField: 'armor' }] })],
  ['tt3-light-mail', equip({ skill: { oncePerBattle: true, ops: [{ op: 'draw', amountField: 'draw' }] } })],
  ['tt3-holy-staff', equip({ skill: { oncePerBattle: true, ops: [
    { op: 'cleanse', target: 'self' }, { op: 'heal', amountField: 'heal' },
  ] } })],
  ['tt2-treasuremap', equip({ skill: { oncePerBattle: true, ops: [
    { op: 'acquire', n: 1, pool: { kind: '搜索大宝箱' }, dest: 'deck' },
    { op: 'draw', amountField: 'draw' },
  ] } })],
  ['tt12-raygun', equip({ skill: { oncePerBattle: true, ops: [
    { op: 'acquire', n: 1, pool: { kind: '射线' }, dest: 'discover', act: 'play' },
  ] } })],
  ['tt7-talisman', equip({ battleStart: [{ op: 'draw', amountField: 'draw' }] })],
  ['tt3-blooddrinker', equipTrigger({ onKill: [{ op: 'blessing', key: 'atkUp', stacks: 1 }] })],
  ['tt3-master-staff', equipTrigger({ onTurnStart: [{ op: 'blessing', key: 'spellUp', stacks: 1 }] })],
  ['tt3-twinwater-mail', equipTrigger({ onFreezeDealt: [{ op: 'armor', amountField: 'armor' }] })],
  ['tt2-apollo', equipTrigger({ onAcquire: [
    { op: 'energy', n: 1 }, { op: 'acquire', n: 1, pool: { kind: '随机' },
      filter: { exceptIds: ['tt2-apollo'] }, dest: 'hand' },
  ] })],
  ['tt2-wreck', equipTrigger({ onConsume: [{ op: 'acquire', n: 2, pool: { kind: '随机' }, dest: 'hand' }] })],
  ['tt8-archdemon', equip({
    passive: { aura: { atk: 1 } },
    onEquip: [{ op: 'acquire', n: 3, pool: { kind: '重斩' }, dest: 'hand' }],
  })],
  ['tt7-arcanescroll', equipTrigger({ onConsume: [{ op: 'draw', amountField: 'draw' }] })],
]);

const CANONICAL_TABLE_BY_ID = new Map([
  ['tt3-longsword', 'TABLETOP10'], ['tt3-staff', 'TABLETOP10'],
  ['tt3-grass-armor', 'TABLETOP10'], ['tt3-light-mail', 'TABLETOP10'],
  ['tt3-holy-staff', 'TABLETOP10'], ['tt8-archdemon', 'TABLETOP11'],
  ['tt8-archdemon', 'TABLETOP10'], ['tt2-treasuremap', 'TABLETOP11'],
  ['tt7-arcanescroll', 'TABLETOP11'], ['tt7-talisman', 'TABLETOP11'],
  ['tt3-blooddrinker', 'TABLETOP10'], ['tt3-master-staff', 'TABLETOP10'],
  ['tt3-twinwater-mail', 'TABLETOP10'],
  ['tt2-apollo', 'TABLETOP10'], ['tt2-wreck', 'TABLETOP10'],
  ['tt12-raygun', 'TABLETOP12'],
]);

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
 * 保守回填入口：指定卡、无自有 rules、运行时卡面与 canonical 整卡深相等才写入。
 * 任一验证/持久化条件失败时不盖 marker；deps 仅供定向测试注入。
 * @param {{ storage?: Storage | null, library?: any, storeKey?: string }} [deps]
 */
export function ensureM7EquipRules(deps = {}) {
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
      if (!validation.ok) throw new Error(`M7 schema rejected ${card.id}: ${JSON.stringify(validation.errors)}`);
      const capability = inspectCardRuleCapability(nextCard);
      if (!capability.ok) throw new Error(`M7 capability rejected ${card.id}: ${JSON.stringify(capability.issues)}`);
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
    console.error('[cards] M7 equipment migration failed; marker was not written:', error);
  }
}

export const M7_EQUIP_MARKER_KEY = MARKER_KEY;
