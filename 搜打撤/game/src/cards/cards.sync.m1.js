// @ts-check
/* M1 卡牌规则化数据迁移批 D1（2026-09-27）：现集批次——当前 schema/capability 已支持能力的
 * legacy 卡迁结构化 rules，共 4 张：starter-attack / tt3-skewer / tt8-dragonblade / tt7-livingwater。
 * definitions 内联手写，字段风格与 cards.sync.js ensureA3* 回填定义一致（version:1 / onPlay 有序 ops）；
 * canonical 整卡取实际 TABLETOP10/11 定版（E8 ensureE8FixedHealRules 先例：不另存一份可漂移数值表）。
 *
 * 迁移口径（逐卡对照 capability 实际支持集 + schema battle.target 交叉契约）：
 *   starter-attack  攻（+0）：造成等同于攻击力的伤害 → damage amountField:'dmg'（attack 型由
 *                   Combat.dealDamage 并入攻击力，card.dmg=0 即纯攻击力，B1 tt2-shoot 同款）；
 *   tt3-skewer      攻（+2），附加破甲持续 1 回合 → damage + curse abreak duration:1（B5 frost-slash 同款）；
 *   tt8-dragonblade 攻+6，附加破甲与 1 层流血 → damage + curse abreak + curse bleed（破甲无回合词，
 *                   文本路径默认 2 回合——battle.engine.js CURSE 解析表 def:2，故 duration:2）；
 *   tt7-livingwater 抽 5 张牌 → draw amountField:'draw'（SELF，B1 tt7-ironcharge 同款）。
 *
 * 跳过 8 张——混合目标契约缺口：battle.target 是卡级单值，heal/armor/draw 强制 side:'self'
 * （card-rules.schema.js 交叉契约），damage/curse 选定敌强制 side:'enemy'，无法同卡表达：
 *   tt2-forestarrow / tt2-piercearrow（伤害+自护甲；前者 A3 已显式排除）、
 *   tt2-swiftarrow / tt7-fullstrike / tt7-arcanebolt（伤害+自抽牌）、
 *   tt7-throwblade（伤害+流血可表达，但抽牌自益无法同卡声明）、
 *   tt3-toxin / tt12-sporewall（A3 排除清单已点名「毒药+抽牌 / 孢子城墙+护甲」）。
 *
 * 保守回填语义（照抄 ensureA3* / ensureE8FixedHealRules 先例）：只处理指定 ID；仅当无自有 rules
 * 且整卡与 canonical 深相等才回填；marker 一次性；异常/缺定义/缺卡/存写异常保守退出不标记；
 * 不原地改热缓存对象（写时复制）；先校验（schema + capability 双门）后保存；成功后复读确认。
 * 接线：本函数不自行接入启动链——由主指挥统一在 cards.js ensure 层与 ensureA3* 同位调用。 */
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

const M1_MARKER_KEY = 'sdt-cards-m1-onplay-rules-v1-seeded';

const R = (battle, onPlay) => ({ rules: { version: 1, battle, triggers: { onPlay } } });
const ENEMY_ONE = { target: { side: 'enemy', area: false } };
const SELF = { target: { side: 'self', area: false } };
const dmgOne = () => R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }]);

// id → 结构化 rules（有序 ops）。四张卡的全部卡面字段（dmg/draw 等）已在 TABLETOP 定版中存在，
// 无需 A3 的字段回填（extraFieldsById），definitions 只携带 rules。
const definitions = new Map([
  ['starter-attack', dmgOne()],
  ['tt3-skewer', R(ENEMY_ONE, [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'curse', curse: 'abreak', duration: 1, target: 'chosenEnemy' },   // 持续 1 回合
  ])],
  ['tt8-dragonblade', R(ENEMY_ONE, [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'curse', curse: 'abreak', duration: 2, target: 'chosenEnemy' },   // 无回合词 → 文本路径默认 2 回合
    { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
  ])],
  ['tt7-livingwater', R(SELF, [{ op: 'draw', amountField: 'draw' }])],
]);

// canonical 源表：id → SDT.Cards 上的 TABLETOP 定版数组名（这 4 个 id 均不在 cards-sync，
// TABLETOP10/11 内联对象即定版真身；tt3-skewer / tt8-dragonblade 的旧批次同名卡已被
// TABLETOP10 定版覆盖，与 E8 产线观测一致）。
const CANONICAL_TABLE_BY_ID = new Map([
  ['starter-attack', 'TABLETOP10'],
  ['tt3-skewer', 'TABLETOP10'],
  ['tt8-dragonblade', 'TABLETOP10'],
  ['tt7-livingwater', 'TABLETOP11'],
]);

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
 * M1 批回填入口。生产无参调用（window.SDT.Cards + localStorage，与 ensureA3* 同环境）；
 * deps 仅测试注入用。任何失败路径都不写 marker，下次启动重试。
 * @param {{ storage?: Storage | null, library?: any, storeKey?: string }} [deps]
 */
export function ensureM1OnplayRules(deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const library = deps.library !== undefined ? deps.library
    : (typeof window !== 'undefined' ? window.SDT?.Cards : null);
  const storeKey = deps.storeKey ?? KEY;
  try {
    if (!storage || !library) return;
    if (storage.getItem(M1_MARKER_KEY) === '1') return;

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
    for (const [id, tableName] of CANONICAL_TABLE_BY_ID) {
      const table = library[tableName];
      const found = Array.isArray(table) ? table.find(card => card && card.id === id) : null;
      if (!found) {
        console.error(`[cards] M1 rule migration canonical missing: ${id} @ ${tableName}`);
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
        throw new Error(`M1 rule migration validation failed for ${card.id}: `
          + validation.errors.map(err => `${err.path}: ${err.message}`).join('; '));
      }
      const capability = inspectCardRuleCapability(nextCard);
      if (!capability.ok) {
        throw new Error(`M1 rule migration capability unsupported for ${card.id}: `
          + capability.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
      }
      dirty = true;
      return nextCard;
    });

    // 库内四张卡必须齐备（A3 foundIds 先例）：缺卡说明播种链未跑完，不标记、下次重试。
    if (foundIds.size !== definitions.size) {
      console.error('[cards] M1 rule migration cards missing:',
        [...definitions.keys()].filter(id => !foundIds.has(id)));
      return;
    }

    if (dirty) {
      // 保存 false / 抛错都不盖章；盖章前复读确认没有异常替换库串（E8 先例）。
      let saved = false;
      try { saved = library.saveAll(nextCards); }
      catch (error) {
        console.error('[cards] M1 rule migration save failed; marker was not written:', error);
        return;
      }
      if (!saved) {
        console.error('[cards] M1 rule migration save returned false; marker was not written.');
        return;
      }
      if (storage.getItem(storeKey) !== JSON.stringify(nextCards)) return;
    } else if (storage.getItem(storeKey) !== raw) {
      return;
    }
    storage.setItem(M1_MARKER_KEY, '1');
  } catch (error) {
    console.error('[cards] M1 rule migration failed; marker was not written:',
      error && error.message ? error.message : error);
  }
}
