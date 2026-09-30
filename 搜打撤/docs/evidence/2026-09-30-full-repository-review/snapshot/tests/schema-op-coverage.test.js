/* Schema op 清单 × resolution 运行时清单差集守卫（find-D-0100 D-2，2026-09-29 夜班 U7）。
 *
 * 背景：battle.resolution.js:997-999 对未知 onPlay op `throw new TypeError(...)`，且该 throw
 * 发生在能量已扣、卡已离手、前序 op 已落账之后（半结算态，无回滚）。schema 入口
 * （card-rules.capability.js OPERATION_TARGETS + card-rules.schema.js 逐 op 键校验）理论上使它
 * 不可达；一旦两份清单失配，红的就是玩家结算期。本测试把这条防线搬到测试层：
 * 「卡库 schema 实际用到的 op ⊆ resolution 运行时可处理的 op」，差集非空时列出差异 op 与卡 id。
 *
 * 运行时 op 全集摸底结论（2026-09-29，resolution.js 是唯一结构化 op 分派层）：
 * - 循环 1（沉默门前，仅 damage）：battle.resolution.js:585 `op !== 'damage' continue`；
 *   schedule 段转 delayed triggerOps（:590-591）。
 * - 循环 2（沉默门后）：battle.resolution.js:873-996 逐 op if 链（status freeze/discover/curse/
 *   foeFight/copyRandom/stealAtk/noDrawNext/extraTurn/execute/summon/registerRule/acquire/
 *   cleanse/coins/blessing/energy/energyCap/maxHp/deckCap）+ :997-999 兜底 throw
 *   （heal/armor/draw 三元清单；draw 另有五源缺失 throw :1073-1077）。
 * - 全部结构化入口最终合成 triggers.onPlay 回流同一循环：直接 onPlay（resolution.js:513）；
 *   delayed triggerOps（battle.engine.js:426 合成卡）；登记型 8 时点（battle.triggers.m2.js:17
 *   TRIGGER_POINTS → resolveOps 合成卡）；装备域（battle.triggers.m2.js:135 resolveEquipOps）；
 *   bag.use 带 schedule 的 op（battle.bag.js:128 → triggerOps，回流时 schedule 已剥除）。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sourceCardLibrary } from '../scripts/sync-cards-from-live.mjs';

// resolution.js 运行时可处理 op 全集（与上述分支逐字对齐；运行时增删分支时必须同步此处，
// 「运行时清单自检」用例会在漂移时红）。
const RESOLUTION_HANDLED_OPS = new Set([
  'damage', 'status', 'discover', 'curse', 'foeFight', 'copyRandom', 'stealAtk',
  'noDrawNext', 'extraTurn', 'execute', 'summon', 'registerRule', 'acquire',
  'cleanse', 'coins', 'blessing', 'energy', 'energyCap', 'maxHp', 'deckCap',
  'heal', 'armor', 'draw',
]);

// capability 表含 transform（card-rules.capability.js OPERATION_TARGETS），但被入口显式拒绝
//（"no battle resolver branch is connected"，capability.js onPlay 与通用清单两处）——
// 携带它的卡根本打不出，无半结算风险，不参与差集比对。
const ENTRY_REJECTED_OPS = new Set(['transform']);

// onPlay 直喂（resolution.js:513）+ battle.triggers.m2.js:17 登记型 8 时点（resolveOps 合成回流）。
const OP_CONTAINERS = ['onPlay', 'onTurnStart', 'onTurnEnd', 'onBattleStart', 'onKill',
  'onDamaged', 'onPlayCard', 'onFreezeDealt', 'onAcquire'];

/** @param {readonly { op: string, path: string }[]} found @param {unknown} ops @param {string} path */
function pushOpList(found, ops, path) {
  if (!Array.isArray(ops)) return;
  ops.forEach((operation, index) => {
    if (operation && typeof operation === 'object' && typeof /** @type {any} */ (operation).op === 'string') {
      found.push({ op: /** @type {any} */ (operation).op, path: `${path}[${index}]` });
    }
  });
}

/** 收集一张卡全部会回流 resolution 循环的结构化 op。
 * @param {any} card @returns {{ op: string, path: string }[]} */
function collectResolverOps(card) {
  /** @type {{ op: string, path: string }[]} */
  const found = [];
  const rules = card?.rules;
  if (!rules || typeof rules !== 'object') return found;
  const triggers = rules.triggers;
  if (triggers && typeof triggers === 'object') {
    for (const point of OP_CONTAINERS) pushOpList(found, triggers[point], `rules.triggers.${point}`);
  }
  const equip = rules.equip;
  if (equip && typeof equip === 'object') {
    for (const point of ['onEquip', 'battleStart']) pushOpList(found, equip[point], `rules.equip.${point}`);
    pushOpList(found, equip.skill?.ops, 'rules.equip.skill.ops');
  }
  const bagUse = rules.bag?.use;
  if (Array.isArray(bagUse)) {
    bagUse.forEach((operation, index) => {
      // 仅带 schedule 的 bag op 经 triggerOps 回流 resolution 循环（battle.bag.js:126-130）；
      // 不带 schedule 的由 battle.bag 自有分派器消费（BAG_SUPPORTED_OPS），不在本守卫射程。
      if (operation && typeof operation === 'object' && typeof operation.op === 'string' &&
          operation.schedule !== undefined) {
        found.push({ op: operation.op, path: `rules.bag.use[${index}]` });
      }
    });
  }
  return found;
}

describe('schema op 清单 × resolution 运行时清单（D-2 半结算守卫）', () => {
  const library = sourceCardLibrary();

  it('运行时清单自检：RESOLUTION_HANDLED_OPS 每个 op 在 battle.resolution.js 都有真实分支', () => {
    const source = readFileSync(resolve(process.cwd(), 'game/src/battle/core/battle.resolution.js'), 'utf8');
    const missing = [...RESOLUTION_HANDLED_OPS].filter(op =>
      !source.includes(`operation.op === '${op}'`) &&
      // damage 的循环 1 入口是 continue 形态（op !== 'damage'）
      !source.includes(`operation.op !== '${op}'`) &&
      !( ['heal', 'armor', 'draw'].includes(op) &&
         source.includes("['heal', 'armor', 'draw'].includes(operation.op)")));
    expect(missing,
      `RESOLUTION_HANDLED_OPS 与 battle.resolution.js 源码漂移：以下 op 的运行时分支已不存在或改名，请同步本测试清单：${missing.join(', ')}`)
      .toEqual([]);
  });

  it('卡库 schema 用到的 op 全部可被 resolution 运行时处理（差集为空）', () => {
    /** @type {Map<string, Set<string>>} */
    const used = new Map();
    for (const card of library) {
      for (const { op } of collectResolverOps(card)) {
        if (ENTRY_REJECTED_OPS.has(op)) continue;
        if (!used.has(op)) used.set(op, new Set());
        used.get(op).add(String(card?.id || '<missing id>'));
      }
    }
    const diff = [...used.keys()].filter(op => !RESOLUTION_HANDLED_OPS.has(op));
    const detail = diff.map(op => `  ${op} → ${[...(used.get(op) || [])].sort().join(', ')}`).join('\n');
    expect(diff,
      `schema 使用了 resolution 运行时无法处理的 op（这些卡打出到该段时会在 battle.resolution.js:997 半结算 throw）。\n` +
      `修复方向二选一：给 resolution 补分支，或从 schema/能力表移除该 op。\n差异清单：\n${detail}`)
      .toEqual([]);
  });
});
