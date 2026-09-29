// @ts-check
/* M 批保守回填骨架工厂（2026-09-29 重构）：cards.sync.m1-m11 的入口函数原为逐字复制的
 * 同一骨架，本文件把骨架收敛为 createRuleBackfiller；各批次文件只保留 definitions 数据
 * 与批次参数。迁移数据行为与骨架复制期逐批等价（m1-m11 数据测试守护），日志统一为
 * `${label} rule migration` 前缀。
 *
 * 保守回填语义（m1 原文）：只处理指定 ID；仅当无自有 rules 且整卡与 canonical 深相等才回填；
 * marker 一次性；异常/缺定义/缺卡/存写异常保守退出不标记；不原地改热缓存对象（写时复制）；
 * 先校验（schema + capability 双门）后保存；成功后复读确认。 */
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

// E8/m1 同款深相等：键集一致（与键序无关）+ 逐值递归；原始类型走严格相等。
export function sameSnapshot(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && left.length !== right.length) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(right, key) && sameSnapshot(left[key], right[key]));
}

/**
 * M 批回填骨架工厂。生产无参调用（window.SDT.Cards + localStorage）；deps 仅测试注入用。
 * 任何失败路径都不写 marker，下次启动重试。
 *
 * @param {{
 *   label: string,
 *   markerKey: string,
 *   definitions: Map<string, { rules: object } & Record<string, unknown>>,
 *   canonicalTableById?: Map<string, string>,
 *   canonicalOrder?: string[],
 *   faceFieldsById?: Map<string, string[]>,
 * }} spec
 *   - faceFieldsById（可选，m5 形态）：id → definition 上点名的卡面字段；深相等校验通过后、
 *     双门校验前，以 definition 上字段值覆盖卡面（用于 canonical 本身缺定版值的场景）；
 *   - previousRulesById（可选，m3 v3 修正先例）：id → 本批早期版本的 rules 快照。整卡
 *     （canonical 卡面 + 该旧版 rules）精确匹配的存档视为「本批旧版产物」而非玩家改动，
 *     允许重写为当前 definition.rules。
 */
export function createRuleBackfiller({ label, markerKey, definitions, canonicalTableById, canonicalOrder, faceFieldsById, previousRulesById }) {
  if (!label || !markerKey || !(definitions instanceof Map)) {
    throw new Error('backfiller: label/markerKey/definitions required');
  }
  if (!canonicalTableById && !canonicalOrder) {
    throw new Error(`backfiller(${label}): canonical source required`);
  }
  const resolveCanonical = canonicalOrder
    ? (library, id) => {
        for (const tableName of canonicalOrder) {
          const found = library[tableName]?.find?.(card => card?.id === id);
          if (found) return found;
        }
        return null;
      }
    : (library, id) => {
        const tableName = canonicalTableById.get(id);
        const table = library[tableName];
        return Array.isArray(table) ? table.find(card => card && card.id === id) : null;
      };

  return function ensureBatch(deps = {}) {
    const storage = deps.storage !== undefined ? deps.storage
      : (typeof localStorage !== 'undefined' ? localStorage : null);
    const library = deps.library !== undefined ? deps.library
      : (typeof window !== 'undefined' ? window.SDT?.Cards : null);
    const storeKey = deps.storeKey ?? KEY;
    try {
      if (!storage || !library) return;
      if (storage.getItem(markerKey) === '1') return;

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
        const found = resolveCanonical(library, id);
        if (!found) {
          console.error(`[cards] ${label} rule migration canonical missing: ${id}`);
          return;
        }
        canonicalById.set(id, found);
      }

      const foundIds = new Set();
      let dirty = false;
      const nextCards = library.all().map(card => {
        // definitions 值为「卡形部分定义」（{ rules, ...faceFieldsById 点名卡面字段? }）。
        const definition = definitions.get(card.id);
        if (!definition) return card;
        foundIds.add(card.id);
        // 已有自有 rules（含玩家制作坊产出）/整卡与定版有出入（改名/改字段/旧批次副本）→ 保守跳过；
        // 例外：与 previousRulesById 旧版快照精确匹配（卡面仍为 canonical）→ 视为本批旧版产物，允许修正重写。
        const previousRules = previousRulesById?.get(card.id);
        const previousMigration = previousRules !== undefined
          && sameSnapshot(card, { ...canonicalById.get(card.id), rules: previousRules });
        if (Object.prototype.hasOwnProperty.call(card, 'rules') && !previousMigration) return card;
        if (!previousMigration && !sameSnapshot(card, canonicalById.get(card.id))) return card;
        const nextCard = { ...card };
        for (const field of faceFieldsById?.get(card.id) ?? []) {
          if (definition[field] !== undefined) nextCard[field] = definition[field];
        }
        nextCard.rules = definition.rules;
        // 先校验后保存：schema 形状 + capability 生产能力门双保险，任一失败抛错整体退出不标记。
        const validation = validateCardRules(nextCard);
        if (!validation.ok) {
          throw new Error(`${label} rule migration validation failed for ${card.id}: `
            + validation.errors.map(err => `${err.path}: ${err.message}`).join('; '));
        }
        const capability = inspectCardRuleCapability(nextCard);
        if (!capability.ok) {
          throw new Error(`${label} rule migration capability unsupported for ${card.id}: `
            + capability.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
        }
        dirty = true;
        return nextCard;
      });

      // 库内目标卡必须齐备（A3 foundIds 先例）：缺卡说明播种链未跑完，不标记、下次重试。
      if (foundIds.size !== definitions.size) {
        console.error(`[cards] ${label} rule migration cards missing:`,
          [...definitions.keys()].filter(id => !foundIds.has(id)));
        return;
      }

      if (dirty) {
        // 保存 false / 抛错都不盖章；盖章前复读确认没有异常替换库串（E8 先例）。
        let saved = false;
        try { saved = library.saveAll(nextCards); }
        catch (error) {
          console.error(`[cards] ${label} rule migration save failed; marker was not written:`, error);
          return;
        }
        if (!saved) {
          console.error(`[cards] ${label} rule migration save returned false; marker was not written.`);
          return;
        }
        if (storage.getItem(storeKey) !== JSON.stringify(nextCards)) return;
      } else if (storage.getItem(storeKey) !== raw) {
        return;
      }
      storage.setItem(markerKey, '1');
    } catch (error) {
      console.error(`[cards] ${label} rule migration failed; marker was not written:`,
        error && error.message ? error.message : error);
    }
  };
}
