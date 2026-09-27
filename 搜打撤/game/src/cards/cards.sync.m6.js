// @ts-check
/* M6 卡牌规则化数据迁移批 D8（2026-09-27）：B-M6 bag 道具批——13 张药水/通行证/烟雾弹道具
 * 预写结构化 rules.bag.use（M-BATCH-CONTRACT-SPEC §二.13 键位设计 + M-BATCH-MATRIX 道具章逐卡草案）。
 * definitions 内联手写，风格与 E8 bag.use 先例一致（version:1 / rules.bag.use 有序 ops，
 * 参照 cards.js ensureBagUseRules 的 tt3-savior-elixir `bag.use[{op:'heal',amountField:'heal'}]`）。
 *
 * 逐卡口径（id / 草案依据）：
 *   tt3-blue-potion      恢复药水   heal（amountField:'heal'）+ energy n:1 两段（矩阵道具章草案）；
 *   tt3-demon-potion     法力药水   blessing spellUp stacks:2 duration:1（「持续 1 回合」= duration）；
 *   tt3-houyi-potion     狂暴药水   blessing atkUp stacks:2 duration:1（与 demon-potion 同构）；
 *   tt3-iceheart-potion  冰冻药水   curse freeze duration:1（敌方指向由宿主 itemTargetSideFor 承担）；
 *   tt3-mind-potion      精神药水   draw amountField:'draw'（draw:2；地图侧无牌可抽，消费端需 battle-only 作用域）；
 *   tt3-mixed-potion     流血药水   damage amount:2 + curse bleed（bag.use 参数白名单无 dmgType，固定伤）；
 *   tt3-python-potion    火焰药水   damage amount:2 target:'allEnemies'（同上，法伤口径由消费端定）；
 *   tt3-turnabout-potion 剧毒药水   curse poison stacks:1 target:'allEnemies'（SPEC §二.13 表达例同款）；
 *   tt3sp-doom           TNT        execute cap:{atk:5} count:2（按 SPEC §二.5 已定版键位，含 BOSS 排除）；
 *   cmtmvq6ss84l         员工通行证A acquire pool:{kind:'classAbility'}（直授版；与 tt-token-color 同名不同 id，陷阱 T8 不合并）；
 *   tt-token-gold        员工通行证B acquire pool:{kind:'legendary'}（棱彩排除由池谓词 isRandomObtainable 承担）；
 *   tt4-shine-token      员工通行证C discover count:1 pool:{kind:'legendary'}（「发现」≠直接获得，交互域）；
 *   tt4-smoke-bomb       烟雾弹     flee（SPEC §二.13 提案名 escape，此处按矩阵定名 flee，实现批定版二选一；
 *                                   BOSS 战禁用现由宿主 ITEM_BOSS_FLEE_PATTERN 正则承担，迁移后消费端改读 rules）。
 *
 * 双门现状（2026-09-27 实测）：并行 M3 批已放行 bag.use 扩展 op——schema BAG_SUPPORTED_OPS
 * 十一种（heal/restoreConsumed/energy/blessing/curse/draw/damage/execute/acquire/discover/flee，
 * card-rules.schema.js BAG_OP_KEYS 参数白名单）+ capability 同名收口（card-rules.capability.js）。
 * 本批十三张全部过双门（damage 参数白名单无 dmgType——bag 域伤害为固定伤口径，数据已按白名单收敛）。
 * 消费端（battle.bag.js useItem 文本路径 / game.bag.js useStructuredBagRule 单 op heal）收编在途：
 * 回填器仍沿用 m1 保守语义——先校验后保存，任何失败路径抛错整体退出不标记、库内数据不动。
 * 注意接线时序：rules.bag.use 一旦落库，地图侧结构化分支优先于 id/文本分支，消费端 bag.use
 * 分派必须与本批接线同批或先收编，否则通行证/回复类道具的地图使用会被短路（详见 M6-D8-RESULT）。
 *
 * 保守回填语义（照抄 ensureM1OnplayRules / ensureA3* / ensureE8FixedHealRules 先例）：只处理
 * 指定 ID；仅当无自有 rules 且整卡与 canonical 深相等才回填；marker 一次性；异常/缺定义/缺卡/
 * 存写异常保守退出不标记；不原地改热缓存对象（写时复制）；先校验（schema + capability 双门）
 * 后保存；成功后复读确认。接线：本函数不自行接入启动链——由主指挥统一在 cards.js ensure 层
 * 与 ensureA3* / ensureM1OnplayRules 同位调用。 */
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

const M6_MARKER_KEY = 'sdt-cards-m6-bag-rules-v1-seeded';

// definitions 值与 A3/m1 同为「卡形部分定义」（{ rules: {...} }），回填只取其 .rules。
const BAG = (use) => ({ rules: { version: 1, bag: { use } } });

// id → 结构化 rules.bag.use（有序 ops）。
const definitions = new Map([
  ['tt3-blue-potion', BAG([
    { op: 'heal', amountField: 'heal' },
    { op: 'energy', n: 1 },
  ])],
  ['tt3-demon-potion', BAG([{ op: 'blessing', key: 'spellUp', stacks: 2, duration: 1 }])],
  ['tt3-houyi-potion', BAG([{ op: 'blessing', key: 'atkUp', stacks: 2, duration: 1 }])],
  ['tt3-iceheart-potion', BAG([{ op: 'curse', curse: 'freeze', duration: 1 }])],
  ['tt3-mind-potion', BAG([{ op: 'draw', amountField: 'draw' }])],
  ['tt3-mixed-potion', BAG([
    { op: 'damage', amount: 2 },
    { op: 'curse', curse: 'bleed' },
  ])],
  ['tt3-python-potion', BAG([{ op: 'damage', amount: 2, target: 'allEnemies' }])],
  ['tt3-turnabout-potion', BAG([{ op: 'curse', curse: 'poison', stacks: 1, target: 'allEnemies' }])],
  ['tt3sp-doom', BAG([{ op: 'execute', cap: { atk: 5 }, count: 2 }])],
  ['cmtmvq6ss84l', BAG([{ op: 'acquire', pool: { kind: 'classAbility' } }])],
  ['tt-token-gold', BAG([{ op: 'acquire', pool: { kind: 'legendary' } }])],
  ['tt4-shine-token', BAG([{ op: 'discover', count: 1, pool: { kind: 'legendary' } }])],
  ['tt4-smoke-bomb', BAG([{ op: 'flee' }])],
]);

// canonical 源表：id → SDT.Cards 上的定版数组名。12 张取 TABLETOP10（其中 tt-token-gold /
// tt3sp-doom 两行是 cards-sync 字符串引用，resolveCardCatalog 解析后的对象即定版真身）；
// cmtmvq6ss84l 仅 TABLETOP11 有定义。TABLETOP3/TABLETOP4 里的旧副本（蓝瓶/巨蟒等旧名旧值）
// 与定版深不相等，深相等校验天然挡住，不会写脏。
const CANONICAL_TABLE_BY_ID = new Map([
  ['tt3-blue-potion', 'TABLETOP10'],
  ['tt3-demon-potion', 'TABLETOP10'],
  ['tt3-houyi-potion', 'TABLETOP10'],
  ['tt3-iceheart-potion', 'TABLETOP10'],
  ['tt3-mind-potion', 'TABLETOP10'],
  ['tt3-mixed-potion', 'TABLETOP10'],
  ['tt3-python-potion', 'TABLETOP10'],
  ['tt3-turnabout-potion', 'TABLETOP10'],
  ['tt3sp-doom', 'TABLETOP10'],
  ['tt-token-gold', 'TABLETOP10'],
  ['tt4-shine-token', 'TABLETOP10'],
  ['tt4-smoke-bomb', 'TABLETOP10'],
  ['cmtmvq6ss84l', 'TABLETOP11'],
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
 * M6 批回填入口。生产无参调用（window.SDT.Cards + localStorage，与 ensureA3* 同环境）；
 * deps 仅测试注入用。任何失败路径都不写 marker，下次启动重试。
 * @param {{ storage?: Storage | null, library?: any, storeKey?: string }} [deps]
 */
export function ensureM6BagRules(deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const library = deps.library !== undefined ? deps.library
    : (typeof window !== 'undefined' ? window.SDT?.Cards : null);
  const storeKey = deps.storeKey ?? KEY;
  try {
    if (!storage || !library) return;
    if (storage.getItem(M6_MARKER_KEY) === '1') return;

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
        console.error(`[cards] M6 rule migration canonical missing: ${id} @ ${tableName}`);
        return;
      }
      canonicalById.set(id, found);
    }

    const foundIds = new Set();
    let dirty = false;
    const nextCards = library.all().map(card => {
      const definition = definitions.get(card.id);
      if (!definition) return card;
      foundIds.add(card.id);
      // 已有自有 rules（含玩家制作坊产出）/整卡与定版有出入（改名/改字段/旧批次副本）→ 保守跳过。
      if (Object.prototype.hasOwnProperty.call(card, 'rules')) return card;
      if (!sameSnapshot(card, canonicalById.get(card.id))) return card;
      const nextCard = { ...card, rules: definition.rules };
      // 先校验后保存：schema 形状 + capability 生产能力门双保险，任一失败抛错整体退出不标记
      //（bag.use 扩展 op 在途键未落地时走到这里——数据保持不动，等收编后自动落库）。
      const validation = validateCardRules(nextCard);
      if (!validation.ok) {
        throw new Error(`M6 rule migration validation failed for ${card.id}: `
          + validation.errors.map(err => `${err.path}: ${err.message}`).join('; '));
      }
      const capability = inspectCardRuleCapability(nextCard);
      if (!capability.ok) {
        throw new Error(`M6 rule migration capability unsupported for ${card.id}: `
          + capability.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
      }
      dirty = true;
      return nextCard;
    });

    // 库内十三张卡必须齐备（A3 foundIds 先例）：缺卡说明播种链未跑完，不标记、下次重试。
    if (foundIds.size !== definitions.size) {
      console.error('[cards] M6 rule migration cards missing:',
        [...definitions.keys()].filter(id => !foundIds.has(id)));
      return;
    }

    if (dirty) {
      // 保存 false / 抛错都不盖章；盖章前复读确认没有异常替换库串（E8 先例）。
      let saved = false;
      try { saved = library.saveAll(nextCards); }
      catch (error) {
        console.error('[cards] M6 rule migration save failed; marker was not written:', error);
        return;
      }
      if (!saved) {
        console.error('[cards] M6 rule migration save returned false; marker was not written.');
        return;
      }
      if (storage.getItem(storeKey) !== JSON.stringify(nextCards)) return;
    } else if (storage.getItem(storeKey) !== raw) {
      return;
    }
    storage.setItem(M6_MARKER_KEY, '1');
  } catch (error) {
    console.error('[cards] M6 rule migration failed; marker was not written:',
      error && error.message ? error.message : error);
  }
}
