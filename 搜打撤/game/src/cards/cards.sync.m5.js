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
 * 2026-09-29 重构：入口骨架收敛到 cards.sync.backfiller.js createRuleBackfiller，
 * 本文件只保留 definitions 数据与批次参数；迁移数据行为不变（m5-data.test.js 守护）。
 * 定版卡面改写（原 FACE_FIELDS_BY_ID）平移为工厂 faceFieldsById 参数，同位同语义：
 * 深相等校验之后、双门校验之前，以 definition 上点名字段值覆盖卡面。 */
import { createRuleBackfiller } from './cards.sync.backfiller.js';

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

export const ensureM5DelayedRules = createRuleBackfiller({
  label: 'M5',
  markerKey: M5_MARKER_KEY,
  definitions,
  canonicalTableById: CANONICAL_TABLE_BY_ID,
  faceFieldsById: FACE_FIELDS_BY_ID,
});
