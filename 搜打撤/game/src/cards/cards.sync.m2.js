// @ts-check
/* M2 卡牌规则化数据迁移批 D3（2026-09-27）：B-M1 现集批次剩余 S 级卡迁结构化 rules，共 16 张。
 * definitions 内联手写，字段风格与 cards.sync.js ensureA3* / cards.sync.m1.js 一致（version:1 /
 * onPlay 有序 ops）；canonical 整卡取实际定版（TABLETOP7/10/11/12 + CARDS_SYNC，m1 先例：
 * 不另存一份可漂移数值表）。
 *
 * 迁移口径（逐卡对照矩阵 docs/M-BATCH-MATRIX.md B-M1 行 + 工作区现场 schema/capability/执行器）：
 *   cc-chase-slash    攻（+0），每打出一张其他武术费用-1 → damage + battle.costModifiers
 *                     martialPlayedDiscount amount:1（消费端 battle.card-cost.js:36 做减法，
 *                     amount 为正整数折扣步长——矩阵草案的 -1 过不了 schema 正整数校验）；
 *   tt2-comboarrow    攻（-1），上一张武术则 0 费 → damage + previousCardTypeFree type:'武术'；
 *   tt2-forestarrow   攻（-1），+3 甲 → damage + armor amount:3（字面量，M1 混合目标放行）；
 *   tt2-piercearrow   同 forestarrow 同构（获得 3 点护甲）；
 *   tt2-swiftarrow    攻（-1），抽 1 → damage + draw amount:1（amountField 锚定不得与 damage
 *                     混排，字面量与卡面 draw 字段一致仍满足 declaresField 契约——A3 先例）；
 *   tt7-fullstrike    攻（+5），抽 1 → 同 swiftarrow 同构；
 *   tt7-throwblade    攻（-3），附加流血，抽 1 → damage + curse bleed stacks:1 + draw amount:1；
 *   cc-demon          4′，损失 2 点生命 → damage(amountField:'dmg', spell) + heal selfDamage:2
 *                     （执行器 heal 分支「自伤不是治疗」注释即点名恶魔之力，battle.resolution.js heal 段）；
 *   cmtn28jv33wx      随机获取 3 张卡牌 → acquire n:3 pool:'随机' dest:'hand'（A3 生命箭同款）；
 *   tt12-breakthrough 随机获取 0/1/2 费招式各 1 张 → 三段 acquire（A3 基础开发 '0费招式' 名词
 *                     同款；A3 时「三段费用无键」被排除，M1 acquire 落地后可迁）；
 *   tt12-sporewall    2 层中毒 + 自身 6 甲 → curse poison stacks:2 + armor amount:6（字面量混合放行）；
 *   tt3-firm-barrier  延长冰冻 1 回合，抽 1 → curse freeze duration:1 + extend:1（extend 走
 *                     「只延长不施加」语义，duration 仅为 schema 计时诅咒必填、不参与施加——
 *                     执行器 extend 分支注释点名坚冰结界）+ draw amount:1；
 *   tt3-flame-storm   全体敌人每人一次火球（实作 4 点法伤全体）→ damage amount:4 allEnemies；
 *   tt3-nature-form   本局能量上限 +1 → energyCap n:1（A3 energize 同款 SELF）；
 *   tt3-toxin         1 层中毒，抽 1 → curse poison stacks:1 + draw amount:1；
 *   tt7-silence       沉默 1 回合，抽 1 → curse silence duration:1 + draw amount:1。
 *
 * 跳过 10 张（逐条原因见 docs/M2-D3-RESULT.md，此处仅摘要）：
 *   tt3-fatal-pierce（破甲在宿主受流血门条件生效，curse op 无 cond 键，迁后行为偏差）、
 *   tt7-ghostblade（cond.foeStatus 值域限七诅咒键，'stealth' 被 schema 拒——敌侧键
 *   status.stealth 已核实存在，卡在 schema 值域白名单，T5）、
 *   cc-poison-burst / tt3sp-flowerzhen（宿主为纯引爆/纯翻倍，结构化 curse 强制施加毒层，行为偏差）、
 *   tt12-felguard / tt12-raydragon / tt7-holyheal / tt3sp-bloodstorm（卡面 infuse:1/2，
 *   schema 禁 onPlay 保留 card.infuse，注能门无 schema 表达，T11；bloodstorm 另有
 *   recast 仅 on:'kill' 一层缺口）、
 *   tt12-freezeray（foeFullHp 近似「未曾受伤」会被回满血敌人误判——远古龙尊每回合回血 10，
 *   误判情形实锤，口径需拍板，T2）、
 *   tt7-arcanebolt（存储卡被 ensureEffectFields 动态补 draw 字段，与源表定版不可深相等；
 *   内联手写补丁快照违背 m1「不另存可漂移数值表」先例）。
 *
 * 保守回填语义（照抄 ensureM1OnplayRules 先例）：只处理指定 ID；仅当无自有 rules 且整卡与
 * canonical 深相等才回填；marker 一次性；异常/缺定义/缺卡/存写异常保守退出不标记；不原地改
 * 热缓存对象（写时复制）；先校验（schema + capability 双门）后保存；成功后复读确认。
 * 接线：本函数不自行接入启动链——由主指挥统一在 cards.js ensure 层与 ensureA3* / ensureM1 同位调用。 */
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

const M2_MARKER_KEY = 'sdt-cards-m2-onplay-rules-v1-seeded';

const R = (battle, onPlay) => ({ rules: { version: 1, battle, triggers: { onPlay } } });
const ENEMY_ONE = { target: { side: 'enemy', area: false } };
const ENEMY_ALL = { target: { side: 'enemy', area: true } };
const SELF = { target: { side: 'self', area: false } };
const dmgOne = () => R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }]);
// 费用修改器卡：R 的 battle 域在 target 之外追加 costModifiers（cc-chase-slash / tt2-comboarrow）。
const withCostModifiers = (costModifiers) => ({
  rules: { version: 1, battle: { target: ENEMY_ONE.target, costModifiers }, triggers: { onPlay: dmgOne().rules.triggers.onPlay } },
});
// 混合目标卡（敌方主体 + 自身域字面量效果 op）：damage/curse 之外追加自身效果 op。
const dmgOneWith = (selfOps) => R(ENEMY_ONE, [...dmgOne().rules.triggers.onPlay, ...selfOps]);
const acquire = (n, kind, dest) => ({ op: 'acquire', n, pool: { kind }, dest });

// id → 结构化 rules（有序 ops：伤害 → 诅咒 → 自身域效果）。全部字面量 amount 与卡面字段一致。
const definitions = new Map([
  ['cc-chase-slash', withCostModifiers([{ kind: 'martialPlayedDiscount', amount: 1 }])],
  ['tt2-comboarrow', withCostModifiers([{ kind: 'previousCardTypeFree', type: '武术' }])],
  ['tt2-forestarrow', dmgOneWith([{ op: 'armor', amount: 3 }])],
  ['tt2-piercearrow', dmgOneWith([{ op: 'armor', amount: 3 }])],
  ['tt2-swiftarrow', dmgOneWith([{ op: 'draw', amount: 1 }])],
  ['tt7-fullstrike', dmgOneWith([{ op: 'draw', amount: 1 }])],
  ['tt7-throwblade', dmgOneWith([
    { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
    { op: 'draw', amount: 1 },
  ])],
  ['cc-demon', dmgOneWith([{ op: 'heal', selfDamage: 2 }])],   // 损失 2 点生命（自伤非治疗）
  ['cmtn28jv33wx', R(SELF, [acquire(3, '随机', 'hand')])],
  ['tt12-breakthrough', R(SELF, [
    acquire(1, '0费招式', 'hand'),
    acquire(1, '1费招式', 'hand'),
    acquire(1, '2费招式', 'hand'),
  ])],
  ['tt12-sporewall', R(ENEMY_ONE, [
    { op: 'curse', curse: 'poison', stacks: 2, target: 'chosenEnemy' },
    { op: 'armor', amount: 6 },
  ])],
  ['tt3-firm-barrier', R(ENEMY_ONE, [
    // duration:1 满足 schema 计时诅咒必填；extend 存在时整体走「只延长不施加」语义
    { op: 'curse', curse: 'freeze', duration: 1, extend: 1, target: 'chosenEnemy' },
    { op: 'draw', amount: 1 },
  ])],
  ['tt3-flame-storm', R(ENEMY_ALL, [{ op: 'damage', amount: 4, target: 'allEnemies' }])],
  ['tt3-nature-form', R(SELF, [{ op: 'energyCap', n: 1 }])],
  ['tt3-toxin', R(ENEMY_ONE, [
    { op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy' },
    { op: 'draw', amount: 1 },
  ])],
  ['tt7-silence', R(ENEMY_ONE, [
    { op: 'curse', curse: 'silence', duration: 1, target: 'chosenEnemy' },
    { op: 'draw', amount: 1 },
  ])],
]);

// canonical 源表：id → SDT.Cards 上的定版数组名。多数为 TABLETOP 定版（同 id 双引用取后表）；
// cc-chase-slash 定版真身在实机覆盖批次 cards-sync.json（cards.js 装配为 CARDS_SYNC 表）。
const CANONICAL_TABLE_BY_ID = new Map([
  ['cc-chase-slash', 'CARDS_SYNC'],
  ['tt2-comboarrow', 'TABLETOP10'],
  ['tt2-forestarrow', 'TABLETOP10'],
  ['tt2-piercearrow', 'TABLETOP10'],
  ['tt2-swiftarrow', 'TABLETOP10'],
  ['tt7-fullstrike', 'TABLETOP10'],
  ['tt7-throwblade', 'TABLETOP10'],
  ['cc-demon', 'TABLETOP7'],
  ['cmtn28jv33wx', 'TABLETOP11'],
  ['tt12-breakthrough', 'TABLETOP12'],
  ['tt12-sporewall', 'TABLETOP12'],
  ['tt3-firm-barrier', 'TABLETOP10'],
  ['tt3-flame-storm', 'TABLETOP11'],
  ['tt3-nature-form', 'TABLETOP10'],
  ['tt3-toxin', 'TABLETOP10'],
  ['tt7-silence', 'TABLETOP10'],
]);

// E8/m1 同款深相等：键集一致（与键序无关）+ 逐值递归；原始类型走严格相等。
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
 * M2 批回填入口。生产无参调用（window.SDT.Cards + localStorage，与 ensureA3* / ensureM1 同环境）；
 * deps 仅测试注入用。任何失败路径都不写 marker，下次启动重试。
 * @param {{ storage?: Storage | null, library?: any, storeKey?: string }} [deps]
 */
export function ensureM2OnplayRules(deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const library = deps.library !== undefined ? deps.library
    : (typeof window !== 'undefined' ? window.SDT?.Cards : null);
  const storeKey = deps.storeKey ?? KEY;
  try {
    if (!storage || !library) return;
    if (storage.getItem(M2_MARKER_KEY) === '1') return;

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
        console.error(`[cards] M2 rule migration canonical missing: ${id} @ ${tableName}`);
        return;
      }
      canonicalById.set(id, found);
    }

    const foundIds = new Set();
    let dirty = false;
    const nextCards = library.all().map(card => {
      // definitions 值为「卡形部分定义」（{ rules: {...} }），回填只取其 .rules。
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
        throw new Error(`M2 rule migration validation failed for ${card.id}: `
          + validation.errors.map(err => `${err.path}: ${err.message}`).join('; '));
      }
      const capability = inspectCardRuleCapability(nextCard);
      if (!capability.ok) {
        throw new Error(`M2 rule migration capability unsupported for ${card.id}: `
          + capability.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
      }
      dirty = true;
      return nextCard;
    });

    // 库内 16 张卡必须齐备（A3 foundIds 先例）：缺卡说明播种链未跑完，不标记、下次重试。
    if (foundIds.size !== definitions.size) {
      console.error('[cards] M2 rule migration cards missing:',
        [...definitions.keys()].filter(id => !foundIds.has(id)));
      return;
    }

    if (dirty) {
      // 保存 false / 抛错都不盖章；盖章前复读确认没有异常替换库串（E8 先例）。
      let saved = false;
      try { saved = library.saveAll(nextCards); }
      catch (error) {
        console.error('[cards] M2 rule migration save failed; marker was not written:', error);
        return;
      }
      if (!saved) {
        console.error('[cards] M2 rule migration save returned false; marker was not written.');
        return;
      }
      if (storage.getItem(storeKey) !== JSON.stringify(nextCards)) return;
    } else if (storage.getItem(storeKey) !== raw) {
      return;
    }
    storage.setItem(M2_MARKER_KEY, '1');
  } catch (error) {
    console.error('[cards] M2 rule migration failed; marker was not written:',
      error && error.message ? error.message : error);
  }
}
