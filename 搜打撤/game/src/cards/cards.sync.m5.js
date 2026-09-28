// @ts-check
/* M5 卡牌规则化数据迁移批 D7（2026-09-27）：B-M4 延迟/持续/形态批（15 张中迁 6 跳 9，
 * 逐卡依据见 docs/archive/card-migration-2026-09-27/M5-D7-RESULT.md；矩阵草案 docs/M-BATCH-MATRIX.md B-M4 行）。
 * definitions 内联手写，字段风格与 cards.sync.js ensureA3* / cards.sync.m1.js / m2.js 一致；
 * canonical 整卡取实际定版（TABLETOP10/11 + CARDS_SYNC，m1/m2 先例：不另存可漂移数值表）。
 *
 * 迁移口径（逐卡对照工作区现场 schema/capability/执行件：battle.triggers.m2.js runner、
 * effect-steps.m2.js、battle.resolution.js schedule 分支、battle.engine.js triggerOps/onDraw 挂点）：
 *   tt3-wave-slash   破浪斩：攻（+3），下回合无法抽牌 → onPlay[damage amountField:'dmg' +
 *                    noDrawNext]（noDrawNext op 无参，effect-steps.m2.js resolveNoDrawNext
 *                    注释点名破浪斩，runtime 旗标 enemy-phase 回合管线消费）；
 *   tt3-noon-duel    正午决战：下回合开始时连开四枪（每枪 2 点固定伤害）→ onPlay[damage
 *                    amountField:'dmg' schedule:'nextTurnStart' hits:{count:4}]（resolution
 *                    damage 分支 schedule 段走 delayed 管线 triggerOps 通道，下回合开始由
 *                    engine processDelayed 以第一存活敌结算）；卡面 dmg:0 且无 dmgType，与
 *                    「每枪造成2点固定伤害」冲突——按 A3 canonicalFieldsById 先例
 *                    （cards.sync.js ensureTT7MultiHitRules 改写 dmg/dmgType）以描述定版值
 *                    改写卡面 dmg:2 / dmgType:'fixed'，否则 damage op 的卡面一致性门必拒；
 *   tt8-curse1-4     禁咒 I-IV（tt8-hero-warlock 衍生）：「抽到时施放」→ triggers.onDraw
 *                    （engine drawCards 结构化分支：抽到即结算、不占手牌、进弃牌堆，目标=第一
 *                    存活敌，与文本 parts.onDraw 同门互斥不双结算）——
 *                      禁咒I   夺取 1 点攻击力 → stealAtk amount:1（effect-steps.m2.js 注释
 *                              点名禁咒口径，duration 缺省 1，enemy-phase _stealRestore 归还）；
 *                      禁咒II  冰冻 → curse freeze duration:1（CURSE_META「1 回合无法行动」）；
 *                      禁咒III 中毒，流血 → curse poison stacks:1 + curse bleed stacks:1；
 *                      禁咒IV  沉默 1 回合 → curse silence duration:1。
 *
 * 纯触发器卡的 onPlay: [] 空容器：resolver 文本路径全部挂在 !hasStructuredOnPlay 上
 * （battle.resolution.js），空 onPlay 键即文本抑制标记（schema/capability 对空数组合法，
 * exec-play 剥离后结算为无操作）。禁咒卡面无 dmg/draw/heal 字段，空键合法。
 *
 * 跳过 9 张（逐条原因见 docs/archive/card-migration-2026-09-27/M5-D7-RESULT.md，此处仅摘要）：
 *   tt7-swordimmortal 剑仙形态 / tt3-petal 花瓣法阵（纯 onTurnStart 卡的抑制键死锁：
 *               文本宿主与结构化 runner 会双结算——剑仙形态 immediate 句命中
 *               buff.swordForm 正则设永久旗标（enemy-phase 每回合抽 1）、花瓣 turnStart 句
 *               进 registerTurnStart 队列（left=3）——须带空 onPlay 键抑制；但 schema 对
 *               onPlay 空数组仍执行卡面一致性门，两卡 face draw:1 / heal:2 非零被拒
 *               （"onPlay must declare card.draw/heal"）。卡面字段归零属破坏卡面语义的
 *               改写，超出数据迁移授权；待契约扩键（textSuppressed 标记 / 空数组豁免
 *               卡面门）或卡面定版去字段后可迁）、
 *   cmtn1wnhhym 江湖救急-改（acquire dest:'hand' 无 decay act，capability 拒；临时卡回合开始
 *               消耗生命周期无结构化表达，且宿主已有 id 专支 battle.resolution.js consumeTemps，
 *               迁 rules 反而双结算）、
 *   cmtn233trmeg 不朽斩（keepInHand/noInfuse 自指无 schema 位置：handOps 仅存在于 draw op 且
 *               capability 只放行 consumeHand/dumpHand；宿主 exec-play desc 正则已承载）、
 *   cmtn2jc142dj 刀剑形态（handOps copyRandom 键位有但解释器未消费，SUPPORTED_HAND_OPS 不含）、
 *   cmtn1r10xnl1 黑暗形态（registerRule 白名单 REGISTER_RULE_KEYS 无 'discoverPlus'）、
 *   tt7-elementstorm 元素风暴（registerRule 白名单无 'doubleNextSpell'，宿主 nextSpellTwice 承载）、
 *   tt7-provoke 扰敌（敌对敌攻击域无 op，schema/capability 均无 foeFight 类表达）、
 *   tt2-apollo 阿猫的礼物（onAcquire 不在 TRIGGER_KEYS，触发器集无获取时点）。
 *
 * 保守回填语义（照抄 ensureM1OnplayRules / ensureM2OnplayRules 先例）：只处理指定 ID；仅当
 * 无自有 rules 且整卡与 canonical 深相等才回填；marker 一次性；异常/缺定义/缺卡/存写异常
 * 保守退出不标记；不原地改热缓存对象（写时复制）；先校验（schema + capability 双门）后保存；
 * 成功后复读确认。唯一例外：FACE_FIELDS_BY_ID 的定版卡面改写发生在深相等校验之后、校验之前
 * （A3 canonicalFieldsById 同位同语义）。
 * 接线：本函数不自行接入启动链——由主指挥统一在 cards.js ensure 层与 ensureA3* / ensureM1 /
 * ensureM2 同位调用。 */
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

const M5_MARKER_KEY = 'sdt-cards-m5-delayed-rules-v1-seeded';

// id → 定义（{ rules } 或带定版卡面改写字段 + { rules }）；rules 风格与 m1/m2 一致（version:1）。
// 纯触发器卡的 triggers.onPlay: [] 为文本抑制标记（见文件头注释）。
const definitions = new Map([
  // —— onPlay 延迟段（schedule / noDrawNext）——
  ['tt3-wave-slash', {
    rules: {
      version: 1,
      battle: { target: { side: 'enemy', area: false } },
      triggers: {
        onPlay: [
          { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
          { op: 'noDrawNext' },   // 下回合无法抽牌（无参 op）
        ],
      },
    },
  }],
  ['tt3-noon-duel', {
    // 定版卡面改写（A3 canonicalFieldsById 先例）：dmg:0→2、补 dmgType:'fixed'，与「每枪
    // 造成2点固定伤害」对齐——不改写则 damage op 的卡面一致性门（schema）必拒。
    dmg: 2,
    dmgType: 'fixed',
    rules: {
      version: 1,
      battle: { target: { side: 'enemy', area: false } },
      triggers: {
        onPlay: [
          { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', schedule: 'nextTurnStart', hits: { count: 4 } },
        ],
      },
    },
  }],
  // —— 形态 / 持续 N 回合（onTurnStart 触发器）：见文件头跳过清单——剑仙形态 / 花瓣法阵
  // 因抑制键死锁（空 onPlay 键被卡面一致性门拒）本批不迁。
  // —— 禁咒 I-IV（onDraw 抽到即结算，目标=第一存活敌）——
  ['tt8-curse1', {
    rules: {
      version: 1,
      triggers: {
        onDraw: [{ op: 'stealAtk', target: 'chosenEnemy', amount: 1 }],   // duration 缺省 1 回合后归还
        onPlay: [],
      },
    },
  }],
  ['tt8-curse2', {
    rules: {
      version: 1,
      triggers: {
        onDraw: [{ op: 'curse', curse: 'freeze', duration: 1, target: 'chosenEnemy' }],
        onPlay: [],
      },
    },
  }],
  ['tt8-curse3', {
    rules: {
      version: 1,
      triggers: {
        onDraw: [
          { op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy' },
          { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
        ],
        onPlay: [],
      },
    },
  }],
  ['tt8-curse4', {
    rules: {
      version: 1,
      triggers: {
        onDraw: [{ op: 'curse', curse: 'silence', duration: 1, target: 'chosenEnemy' }],
        onPlay: [],
      },
    },
  }],
]);

// 定版卡面改写（A3 canonicalFieldsById 同款语义）：深相等校验通过后、双门校验前，
// 以 definition 上的字段值覆盖卡面。用于卡面与描述定版值相悖且 schema 卡面一致性门
// 强制两值一致的场景：noon-duel（dmg:0/无 dmgType 与「每枪造成2点固定伤害」冲突）。
const FACE_FIELDS_BY_ID = new Map([
  ['tt3-noon-duel', ['dmg', 'dmgType']],
]);

// canonical 源表：id → SDT.Cards 上的定版数组名（TABLETOP 定版同 id 双引用取后表，m1 先例）；
// 禁咒 I-IV 定版真身在实机覆盖批次 cards-sync.json（cards.js 装配为 CARDS_SYNC 表，m2 先例），
// 内容与 TABLETOP10 行逐字一致。
const CANONICAL_TABLE_BY_ID = new Map([
  ['tt3-wave-slash', 'TABLETOP10'],
  ['tt3-noon-duel', 'TABLETOP10'],
  ['tt8-curse1', 'CARDS_SYNC'],
  ['tt8-curse2', 'CARDS_SYNC'],
  ['tt8-curse3', 'CARDS_SYNC'],
  ['tt8-curse4', 'CARDS_SYNC'],
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
 * M5 批回填入口。生产无参调用（window.SDT.Cards + localStorage，与 ensureA3* / ensureM1 /
 * ensureM2 同环境）；deps 仅测试注入用。任何失败路径都不写 marker，下次启动重试。
 * @param {{ storage?: Storage | null, library?: any, storeKey?: string }} [deps]
 */
export function ensureM5DelayedRules(deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const library = deps.library !== undefined ? deps.library
    : (typeof window !== 'undefined' ? window.SDT?.Cards : null);
  const storeKey = deps.storeKey ?? KEY;
  try {
    if (!storage || !library) return;
    if (storage.getItem(M5_MARKER_KEY) === '1') return;

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
        console.error(`[cards] M5 rule migration canonical missing: ${id} @ ${tableName}`);
        return;
      }
      canonicalById.set(id, found);
    }

    const foundIds = new Set();
    let dirty = false;
    const nextCards = library.all().map(card => {
      // definitions 值为「卡形部分定义」（{ rules, ...定版卡面改写字段? }），回填只取其 rules
      // 与 FACE_FIELDS_BY_ID 点名的卡面字段。
      const definition = definitions.get(card.id);
      if (!definition) return card;
      foundIds.add(card.id);
      // 已有自有 rules（含玩家制作坊产出）/整卡与定版有出入（改名/改字段/旧批次副本）→ 保守跳过。
      if (Object.prototype.hasOwnProperty.call(card, 'rules')) return card;
      if (!sameSnapshot(card, canonicalById.get(card.id))) return card;
      const nextCard = { ...card };
      for (const field of FACE_FIELDS_BY_ID.get(card.id) ?? []) {
        if (definition[field] !== undefined) nextCard[field] = definition[field];
      }
      nextCard.rules = definition.rules;
      // 先校验后保存：schema 形状 + capability 生产能力门双保险，任一失败抛错整体退出不标记。
      const validation = validateCardRules(nextCard);
      if (!validation.ok) {
        throw new Error(`M5 rule migration validation failed for ${card.id}: `
          + validation.errors.map(err => `${err.path}: ${err.message}`).join('; '));
      }
      const capability = inspectCardRuleCapability(nextCard);
      if (!capability.ok) {
        throw new Error(`M5 rule migration capability unsupported for ${card.id}: `
          + capability.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
      }
      dirty = true;
      return nextCard;
    });

    // 库内 6 张卡必须齐备（A3 foundIds 先例）：缺卡说明播种链未跑完，不标记、下次重试。
    if (foundIds.size !== definitions.size) {
      console.error('[cards] M5 rule migration cards missing:',
        [...definitions.keys()].filter(id => !foundIds.has(id)));
      return;
    }

    if (dirty) {
      // 保存 false / 抛错都不盖章；盖章前复读确认没有异常替换库串（E8 先例）。
      let saved = false;
      try { saved = library.saveAll(nextCards); }
      catch (error) {
        console.error('[cards] M5 rule migration save failed; marker was not written:', error);
        return;
      }
      if (!saved) {
        console.error('[cards] M5 rule migration save returned false; marker was not written.');
        return;
      }
      if (storage.getItem(storeKey) !== JSON.stringify(nextCards)) return;
    } else if (storage.getItem(storeKey) !== raw) {
      return;
    }
    storage.setItem(M5_MARKER_KEY, '1');
  } catch (error) {
    console.error('[cards] M5 rule migration failed; marker was not written:',
      error && error.message ? error.message : error);
  }
}
