// @ts-check
// M9：命名宿主规则 + 银河之旅；完整 canonical 深相等，双门校验，保存复读后 marker。
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

const M9_MARKER_KEY = 'sdt-cards-m9-hosted-rules-v1-seeded';
export const M9_HOSTED_BY_ID = {
  "tt7-imitate": "imitate",
  "cc-mana-surge": "mana-surge",
  "cc-rot-seed": "rot-seed",
  "cmtn1lbhbqi4": "charge-fireball",
  "tt7-stratagem": "pouch-container",
  "tt2-pearlbox": "pearl-container",
  "tt2-venomstaff": "venom-staff",
  "tt3-element-seal": "element-seal",
  "tt3eq-mistbox": "cost-swap",
  "tt7-darkfort": "dark-fort",
  "tt7-naturestaff": "nature-staff",
  "tt8-demonslay": "ranger-chain",
  "tt8-heavensword": "ranger-chain",
  "tt8-abyss-sovereign": "sovereign",
  "tt8-hero-assassin": "assassin",
  "tt8-hero-descender": "consume-fireball",
  "tt8-hero-sealer": "seal-chain",
  "tt8-hero-summoner": "gate-choices",
  "tt8-hero-warrior": "kill-transform",
  "tt3-mystery-potion": "mystery-potion",
  "tt8-hero-guardian": "guardian",
  "tt8-hero-mage": "mage",
  "tt8-hero-priest": "priest",
  "tt8-hero-ranger": "ranger",
  "tt8-hero-sword": "sword",
  "tt8-hero-warlock": "warlock"
};
const definitions = new Map(Object.entries(M9_HOSTED_BY_ID).map(([id, name]) =>
  [id, { rules: { version: 1, battle: { hosted: [name],
    ...(id === 'tt8-hero-sealer' ? { requirements: [{ kind: 'unplayable' }] } : {}) } } }]));
definitions.set('tt5-galaxy-voyage', { rules: { version: 1,
  battle: { target: { side: 'self', area: false } },
  triggers: { onPlay: [{ op: 'registerRule', rule: 'meleeCost1' }] } } });

// 优先实机同步，其次最新 TABLETOP11/10；从源定义取 canonical，不读玩家当前卡面。
function canonicalCard(library, id) {
  for (const name of ['CARDS_SYNC', 'TABLETOP11', 'TABLETOP10']) {
    const card = library[name]?.find(entry => entry && typeof entry === 'object' && entry.id === id);
    if (card) return card;
  }
  return null;
}

// E8 同款深相等：键集一致（与键序无关）+ 逐值递归；原始类型走严格相等。
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
 * M9 批回填入口。生产无参调用（window.SDT.Cards + localStorage，与 ensureA3* 同环境）；
 * deps 仅测试注入用。任何失败路径都不写 marker，下次启动重试。
 * @param {{ storage?: Storage | null, library?: any, storeKey?: string }} [deps]
 */
export function ensureM9HostedRules(deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const library = deps.library !== undefined ? deps.library
    : (typeof window !== 'undefined' ? window.SDT?.Cards : null);
  const storeKey = deps.storeKey ?? KEY;
  try {
    if (!storage || !library) return;
    if (storage.getItem(M9_MARKER_KEY) === '1') return;

    // all() 在读失败时可能降级并缓存 []；独立证明原库有效，避免把降级当成功（E8 先例）。
    const raw = storage.getItem(storeKey);
    if (raw == null) return;
    const storedCards = JSON.parse(raw);
    if (!Array.isArray(storedCards) || storedCards.length === 0) return;
    if (storedCards.some(card => !card || typeof card !== 'object' || Array.isArray(card)
      || typeof card.id !== 'string' || !card.id)) return;
    if (new Set(storedCards.map(card => card.id)).size !== storedCards.length) return;
    // 热缓存必须与原库一致——绝不迁移未保存的修改（E8 先例）。
    if (!sameSnapshot(library.all(), storedCards)) return;

    // canonical 定版缺一即整体退出（A3 缺定义先例：报错且不标记，下次启动重试）。
    const canonicalById = new Map();
    for (const id of definitions.keys()) {
      const found = canonicalCard(library, id);
      if (!found) {
        console.error(`[cards] M9 rule migration canonical missing: ${id}`);
        return;
      }
      canonicalById.set(id, found);
    }

    const foundIds = new Set();
    let dirty = false;
    const nextCards = library.all().map(card => {
      // definitions 值与 A3 同为「卡形部分定义」（{ rules: {...} }），回填只取其 .rules。
      const definition = definitions.get(card.id);
      if (!definition) return card;
      foundIds.add(card.id);
      // 已有自有 rules（含玩家制作坊产出）/整卡与定版有出入（改名/改字段/旧批次副本）→ 保守跳过。
      if (Object.prototype.hasOwnProperty.call(card, 'rules')) return card;
      if (!sameSnapshot(card, canonicalById.get(card.id))) return card;
      const nextCard = { ...card, rules: definition.rules };
      // 先校验后保存：schema 形状 + capability 生产能力门双保险，任一失败抛错整体退出不标记。
      const validation = validateCardRules(nextCard);
      if (!validation.ok) {
        throw new Error(`M9 rule migration validation failed for ${card.id}: `
          + validation.errors.map(err => `${err.path}: ${err.message}`).join('; '));
      }
      const capability = inspectCardRuleCapability(nextCard);
      if (!capability.ok) {
        throw new Error(`M9 rule migration capability unsupported for ${card.id}: `
          + capability.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
      }
      dirty = true;
      return nextCard;
    });

    // 库内目标卡必须齐备（A3 foundIds 先例）：缺卡说明播种链未跑完，不标记、下次重试。
    if (foundIds.size !== definitions.size) {
      console.error('[cards] M9 rule migration cards missing:',
        [...definitions.keys()].filter(id => !foundIds.has(id)));
      return;
    }

    if (dirty) {
      // 保存 false / 抛错都不盖章；盖章前复读确认没有异常替换库串（E8 先例）。
      let saved = false;
      try { saved = library.saveAll(nextCards); }
      catch (error) {
        console.error('[cards] M9 rule migration save failed; marker was not written:', error);
        return;
      }
      if (!saved) {
        console.error('[cards] M9 rule migration save returned false; marker was not written.');
        return;
      }
      if (storage.getItem(storeKey) !== JSON.stringify(nextCards)) return;
    } else if (storage.getItem(storeKey) !== raw) {
      return;
    }
    storage.setItem(M9_MARKER_KEY, '1');
  } catch (error) {
    console.error('[cards] M9 rule migration failed; marker was not written:',
      error && error.message ? error.message : error);
  }
}
