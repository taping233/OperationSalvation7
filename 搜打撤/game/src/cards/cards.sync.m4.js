// @ts-check
/* M4 卡牌规则化数据迁移批 D6（2026-09-27）：B-M3 装备批（27 张派工，实迁 2 张）。
 * definitions 内联手写，字段风格与 cards.sync.m1/m2.js 一致；canonical 整卡取 TABLETOP10
 * 定版（同 id 双引用取后表，m1/m2 先例：旧批同名卡已被 TABLETOP10 定版覆盖）。
 *
 * 迁移口径（逐卡对照矩阵 docs/M-BATCH-MATRIX.md B-M3 行 + 工作区现场 schema/capability/执行器；
 * 装备域消费点 battle.equipment.js registerEquip / syncCurseCondEquips + battle.triggers.m2.js）：
 *   tt3-deep-diary  深海咒印「自身处于诅咒状态时，获得 2 点攻击力且法伤 +2」→
 *                   equip.passive.cond.hasCurse + aura {atk:2, spellPower:2}。
 *                   单源性：穿戴文本路径 gate.curseCond（effect-steps.gates.js）对装备只提示不
 *                   结算数值（HALT）；syncCurseCondEquips 的 rules 分支命中后 return，短路
 *                   desc 正则旧读法——rules 迁入即收编，无双算。
 *                   行为修复：desc 正则旧读法的攻加成提取式（/攻\s*\+\s*\d/）匹配不到
 *                   「获得 2 点攻击力」，文本版诅咒期间只 +2 法伤；rules 版按卡面 2/2 全生效。
 *   tt3-deep-seal   深海印记「诅咒状态下，攻 +2，法伤 +2」→ 同款 rules（矩阵陷阱 T6：两卡
 *                   同草案同测，防漂移）。文本正则旧读法本就正确，迁移前后数值一致。
 *
 * 跳过 25 张（逐卡原因见 docs/archive/card-migration-2026-09-27/M4-D6-RESULT.md，此处按缺口归组摘要）：
 *   穿戴/光环双算 4 张（tt3-longsword / tt3-staff / tt3-grass-armor / tt3-silver-runesword /
 *   tt8-archdemon）——rules.equip 消费不抑制文本：hasStructuredOnPlay 只认 triggers.onPlay
 *   （battle.resolution.js），desc immediate 句（+1 攻 / 法伤+1 / 获得5点护甲 / 获得3张重斩…）
 *   照常结算，与 aura/onEquip 叠加即双算；
 *   消耗触发双算 4 张（tt2-wreck / tt3-azure-sword / tt3-sapper-bomb / tt7-arcanescroll）——
 *   fireConsumeTriggers（battle.engine.js）对 rules.triggers.onConsume 与 consumeTriggerTexts
 *   文本提取无条件并存，迁移即每次消耗结算两遍；
 *   主动技能死数据 8 张（tt3-light-mail / tt3-holy-staff / tt12-raygun / tt2-treasuremap /
 *   tt3-crimson-pouch / tt3-fate-wheel / tt3eq-boiler / tt3-reverse-bow）——desc 带
 *   「主动技能：」时 useEquipSkill 走文本（battle.equipment.js 的 !text 门），rules.equip.skill
 *   仅对无技能文本装备生效，迁入即死数据；其中 4 张另有个别表达缺口（见结果文档）；
 *   时点触发双路径 3 张（tt3-blooddrinker / tt3-master-staff / tt3-wolf-bow）——文本宿主
 *   （打出侧 killAtkUp 登记 / turnStart 句 registerTurnStartText）与 rules 触发器
 *   （registerCard 登记 + runner）并存双算；equip 域键集亦无 onTurnStart；
 *   开战被动双读法 3 张（tt3-chaos-eye / tt7-talisman / tt3-immortal-blade）——迎战路径
 *   applyBattleStartPassives 只走文本（rules.equip.battleStart 死数据），战斗中穿戴补发又与
 *   文本叠加；chaos-eye 另有矩阵陷阱 T3：deckCapBonus() 读 desc 文本与 rules deckCap op
 *   双读法，收编点在 battle.lifecycle.js（本批禁改执行器）；
 *   表达缺口 2 张（tt2-frostsword / tt3-twinwater-mail）——「对冰冻伤害+2」「冰冻后+3甲」
 *   无 schema 键（EQUIP_AURA_KEYS 仅 atk/spellPower/focus；cond 仅 hasCurse/vsFreeze，
 *   且 vsFreeze 无结构化消费点）。
 *
 * 保守回填语义（照抄 ensureM1OnplayRules / ensureM2OnplayRules 先例）：只处理指定 ID；仅当
 * 无自有 rules 且整卡与 canonical 深相等才回填；marker 一次性；异常/缺定义/缺卡/存写异常
 * 保守退出不标记；不原地改热缓存对象（写时复制）；先校验（schema + capability 双门）后
 * 保存；成功后复读确认。
 * 接线：本函数不自行接入启动链——由主指挥统一在 cards.js ensure 层与 ensureA3* / ensureM1 /
 * ensureM2 同位调用。 */
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

const M4_MARKER_KEY = 'sdt-cards-m4-equip-rules-v1-seeded';

// 诅咒条件被动（深海咒印/深海印记，矩阵 T6 同草案）：身负诅咒 → 攻+2 法伤+2，解除即收回
//（动态核算由 battle.equipment.js syncCurseCondEquips 消费；rules 纯装备域，无 battle/triggers）。
const curseCondAura = () => ({
  rules: {
    version: 1,
    equip: {
      passive: {
        cond: { hasCurse: true },
        aura: { atk: 2, spellPower: 2 },
      },
    },
  },
});

// id → 结构化 rules（卡形部分定义，回填只取其 .rules）。两卡卡面字段已在 TABLETOP 定版中
// 存在，无需 A3 的字段回填（extraFieldsById），definitions 只携带 rules。
const definitions = new Map([
  ['tt3-deep-diary', curseCondAura()],
  ['tt3-deep-seal', curseCondAura()],
]);

// canonical 源表：id → SDT.Cards 上的定版数组名。两卡的 TABLETOP3 旧行（深解印记/深衍日记）
// 已被 TABLETOP10 定版覆盖（同 id 双引用取后表，与 E8 产线观测一致）。
const CANONICAL_TABLE_BY_ID = new Map([
  ['tt3-deep-diary', 'TABLETOP10'],
  ['tt3-deep-seal', 'TABLETOP10'],
]);

// E8/m1/m2 同款深相等：键集一致（与键序无关）+ 逐值递归；原始类型走严格相等。
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
 * M4 批回填入口。生产无参调用（window.SDT.Cards + localStorage，与 ensureA3* / ensureM1 /
 * ensureM2 同环境）；deps 仅测试注入用。任何失败路径都不写 marker，下次启动重试。
 * @param {{ storage?: Storage | null, library?: any, storeKey?: string }} [deps]
 */
export function ensureM4EquipRules(deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const library = deps.library !== undefined ? deps.library
    : (typeof window !== 'undefined' ? window.SDT?.Cards : null);
  const storeKey = deps.storeKey ?? KEY;
  try {
    if (!storage || !library) return;
    if (storage.getItem(M4_MARKER_KEY) === '1') return;

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
        console.error(`[cards] M4 rule migration canonical missing: ${id} @ ${tableName}`);
        return;
      }
      canonicalById.set(id, found);
    }

    const foundIds = new Set();
    let dirty = false;
    const nextCards = library.all().map(card => {
      // definitions 值与 A3/m1/m2 同为「卡形部分定义」（{ rules: {...} }），回填只取其 .rules。
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
        throw new Error(`M4 rule migration validation failed for ${card.id}: `
          + validation.errors.map(err => `${err.path}: ${err.message}`).join('; '));
      }
      const capability = inspectCardRuleCapability(nextCard);
      if (!capability.ok) {
        throw new Error(`M4 rule migration capability unsupported for ${card.id}: `
          + capability.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
      }
      dirty = true;
      return nextCard;
    });

    // 库内两张卡必须齐备（A3 foundIds 先例）：缺卡说明播种链未跑完，不标记、下次重试。
    if (foundIds.size !== definitions.size) {
      console.error('[cards] M4 rule migration cards missing:',
        [...definitions.keys()].filter(id => !foundIds.has(id)));
      return;
    }

    if (dirty) {
      // 保存 false / 抛错都不盖章；盖章前复读确认没有异常替换库串（E8 先例）。
      let saved = false;
      try { saved = library.saveAll(nextCards); }
      catch (error) {
        console.error('[cards] M4 rule migration save failed; marker was not written:', error);
        return;
      }
      if (!saved) {
        console.error('[cards] M4 rule migration save returned false; marker was not written.');
        return;
      }
      if (storage.getItem(storeKey) !== JSON.stringify(nextCards)) return;
    } else if (storage.getItem(storeKey) !== raw) {
      return;
    }
    storage.setItem(M4_MARKER_KEY, '1');
  } catch (error) {
    console.error('[cards] M4 rule migration failed; marker was not written:',
      error && error.message ? error.message : error);
  }
}
