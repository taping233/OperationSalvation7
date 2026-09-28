// @ts-check
/* M3 卡牌规则化数据迁移批 D5（2026-09-27）：B-M2 onPlay 扩展批次，共迁 24 张（派单 33 张扣 9 跳过）。
 * definitions 内联手写，字段风格与 cards.sync.m1.js / cards.sync.m2.js 一致（version:1 /
 * onPlay 有序 ops）；canonical 整卡取实际定版（CARDS_SYNC / TABLETOP10 / 11 / 12，m1/m2 先例：
 * 不另存一份可漂移数值表；同 id 多表引用取「最后写入的定版」——与 catalog-after 实测逐卡深相等比对确认）。
 *
 * 迁移口径（逐卡对照矩阵 docs/M-BATCH-MATRIX.md B-M2 行 + 工作区现场 schema/capability/执行器，
 * 全部 24 张先过 validateCardRules + inspectCardRuleCapability 双门再定稿）：
 *   cc-cursed-blade   攻（+3），附加手牌招式的全部诅咒 → damage + curse source:'handMoves'
 *                     （执行器按卡面默认量逐诅咒施加，resolution curse 分支 source 手牌聚合）；
 *   cc-last-stand     攻（+3），末张手牌触发 2 次 → damage + recast:{on:'lastHand',times:2}；
 *   cc-rapid-fire     每打出一张其他招式造成 2 点固定伤 → damage amount:2（=卡面 dmg）+
 *                     hits:{perPlayedMoves:true}（段数=本回合已打出招式数，结算后自增口径）；
 *   cmtn0xt0zr7       5 点固定伤，击杀 +2 币 → damage amount:5 + onKill:{coins:2}；
 *   tt2-jianghu       发现 1 张其它职业卡并直接施放 → acquire n:1 pool{kind:'其它职业'}
 *                     dest:'discover' act:'play'（parsePoolNoun 其它职业池 + 发现面板原生 act）；
 *   tt2-turtlearmor   消耗 1 张装备牌 +10 甲 → armor amount:10 + consumeEquip:true（付不出则无效）；
 *   tt3-dig-treasure  牌库底发现 1 张牌，获等同其价格的护甲 → acquire n:1 pool{kind:'牌库底'} +
 *                     armor priceOf:'discovered'（锚定发现牌价格）；
 *   tt3-fly-arrowhawk 攻（+3），触发的流血伤害翻倍 → damage + registerRule bleedAmp；
 *   tt3-purify-arrow  攻（-1），净化自身 → damage（负攻词条需 dmgType attack）+ cleanse self；
 *   tt3sp-shadowbug   偷取 1 名敌人攻击力至 1 点 → stealAtk capTo:1（缺省 1 回合后归还）；
 *   tt3wu-shike       降 1 名敌人 2 攻持续 3 回合，附加流血 → curse atkDown amount:2 duration:3 +
 *                     curse bleed stacks:1（atkDown 计时型必填 amount/duration，与 stacks 互斥）；
 *   tt7-armup         从牌库抽 2 张装备牌 → draw amount:2 filter{type:'装备'}
 *                     （BOSS 战 deckDraw 定向，普通战降级获得初始攻击——执行器既有口径）；
 *   cmtn1epgt20j      发现一张注能卡，使其无需注能 → acquire n:1 pool{kind:'注能'} dest:'hand'
 *                     act:'noInfuse'（文本先例为随机直发入手，非发现面板——执行器注释点名）；
 *   cmtn1p9vb5au      发现一种形态并释放 → acquire n:1 pool{kind:'形态'} dest:'discover' act:'play'；
 *   tt12-chargeray    5 点法伤，每注能过 1 张 +2 → damage amount:5 + perInfusedInHand:2；
 *   tt3-holy-water    回复 5 点生命并净化自身 → heal amountField:'heal' + cleanse self；
 *   tt3-thunderblast  7 点法伤，墓地每 1 张法术 +1 → damage amount:7 + graveyard{type:'法术',perCard:1}；
 *   tt7-bladebloom    发现并直接施放 1 张，获取剩下两张 → acquire n:3 dest:'discover' act:'playKeep'
 *                     （SPEC §二.6「施放 1 张其余入手」=本卡口径，随机通用池）；
 *   tt7-burnharvest   5 点法伤，受法伤加成翻倍 → damage amount:5 + spellPowerMul:2；
 *   tt7-maxsupply     抽牌直到 4 张手牌 → draw untilHandN:4；
 *   tt7-recruit       召唤步兵（4-4）×2 抵挡伤害 → summon name/atk/hp/count + taunt:true
 *                     （engine summonAlly 随从位，taunt 为随从位自带语义）；
 *   tt3sp-devour      消灭 1 名攻 4 及以下小怪 → execute cap{atk:4} count:1（SPEC §二.5 同款）；
 *   tt3sp-magicoil    发现 1 瓶药水并直接释放 → acquire n:1 pool{kind:'药水'} dest:'discover' act:'play'；
 *   tt3sp-shadowshot  3 点法伤，对手身负诅咒时额外施放 1 次 → 两段 damage amount:3（=卡面 dmg）：
 *                     基础段无条件 + 条件段 cond{anyCurse:true}（recast 仅 on kill/lastHand，
 *                     条件重施以「无条件段+条件段」等价表达——未诅咒 3 点 / 诅咒 6 点，与卡面一致）。
 *
 * 跳过 9 张（逐条原因见 docs/archive/card-migration-2026-09-27/M3-D5-RESULT.md，此处仅摘要）：
 *   cmtn0pbkmnvc 流光照影（「每层诅咒释放一次初始攻击」需 execute 携带 what 键，键集无 what，
 *                execute 域语义是消灭低攻目标，与文本路径专支 release.curseLayers 错配）、
 *   tt7-goldencicada 金蝉脱壳（ensureEffectFields 按描述运行时注入 draw:3，存储卡与源表不可深相等，
 *                m2 tt7-arcanebolt 同款；内联手写补丁快照违背「不另存可漂移数值表」先例）、
 *   tt7-marchrush 急行军（recast 键仅挂 damage op，本牌只有抽牌+护甲无伤害段承载「效果触发2次」）、
 *   tt7-demonbreaker 破甲重斩（卡面 armor:4 触发「onPlay must declare card.armor」字段一致性契约，
 *                补 armor op 会把击杀奖励错成即时加甲）、
 *   tt3-qi-wave 气功波（卡面缺 dmgType 字段，damage 交叉契约要求 supported dmgType 必拒）、
 *   tt3-grope 摸索（衍生 draw:2=区间下限触发 declaresField，range 源不算声明字段，amount:2 丢随机）、
 *   tt7-abysscurse 深渊诅咒（卡面 draw:1 触发 declaresField，perCurseKinds 源不算声明字段，
 *                amount:1 与 perCurseKinds 五源选一互斥）、
 *   tt7-meteorstrong 星陨之力（卡面 infuse:2 禁入 onPlay，T11；且「施放 3 次火球」需 execute.what）、
 *   tt3sp-silverthorn 镭射（卡面 infuse:1 禁入 onPlay，T11；infuseBonus 执行器已接线但过不了 schema 门）。
 *
 * 保守回填语义（照抄 ensureM1OnplayRules / ensureM2OnplayRules 先例）：只处理指定 ID；仅当无自有 rules
 * 且整卡与 canonical 深相等才回填；marker 一次性；异常/缺定义/缺卡/存写异常保守退出不标记；不原地改
 * 热缓存对象（写时复制）；先校验（schema + capability 双门）后保存；成功后复读确认。
 * 接线：本函数不自行接入启动链——由主指挥统一在 cards.js ensure 层与 ensureA3* / ensureM1 / ensureM2 同位调用。 */
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

const M3_MARKER_KEY = 'sdt-cards-m3-onplay-rules-v3-seeded';

const R = (battle, onPlay) => ({ rules: { version: 1, battle, triggers: { onPlay } } });
const ENEMY_ONE = { target: { side: 'enemy', area: false } };
const SELF = { target: { side: 'self', area: false } };
const dmgField = () => ({ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' });
// 获取卡（灵能召唤/千变万化/永恒绽放/药水魔法/挖宝/江湖救急）：acquire 走池名词直透 parsePoolNoun。
const acquire = (n, kind, dest, act) => ({ op: 'acquire', n, pool: { kind }, dest, ...(act ? { act } : {}) });

// id → 结构化 rules（有序 ops：伤害 → 诅咒 → 自身域效果/获取）。字面量 amount 与卡面字段一致。
const definitions = new Map([
  ['cc-cursed-blade', R(ENEMY_ONE, [
    dmgField(),
    // 手牌招式诅咒聚合：按卡面默认量逐诅咒施加，同种只取一次（执行器 curse 分支）
    { op: 'curse', source: 'handMoves', target: 'chosenEnemy' },
  ])],
  ['cc-last-stand', R(ENEMY_ONE, [{ ...dmgField(), recast: { on: 'lastHand', times: 1 } }])],
  ['cc-rapid-fire', R(ENEMY_ONE, [
    { op: 'damage', amount: 2, target: 'chosenEnemy', hits: { perPlayedMoves: true } },
  ])],
  ['cmtn0xt0zr7', R(ENEMY_ONE, [
    { op: 'damage', amount: 5, target: 'chosenEnemy', onKill: { coins: 2 } },
  ])],
  ['tt2-jianghu', R(SELF, [acquire(1, '其它职业', 'discover', 'play')])],
  ['tt2-turtlearmor', R({ ...SELF, requirements: [{ kind: 'handCards', count: 1, type: '装备' }] },
    [{ op: 'armor', amount: 10 }])],
  ['tt3-dig-treasure', R(SELF, [
    acquire(1, '牌库底', 'discover'),
    // 护甲锚定发现牌价格（普通战无牌库时发现池降级随机，执行器既有口径）
    { op: 'armor', priceOf: 'discovered' },
  ])],
  ['tt3-fly-arrowhawk', R(ENEMY_ONE, [dmgField(), { op: 'registerRule', rule: 'bleedAmp' }])],
  ['tt3-purify-arrow', R(ENEMY_ONE, [dmgField(), { op: 'cleanse', target: 'self' }])],
  ['tt3sp-shadowbug', R(ENEMY_ONE, [{ op: 'stealAtk', capTo: 1, target: 'chosenEnemy' }])],
  ['tt3wu-shike', R(ENEMY_ONE, [
    { op: 'curse', curse: 'atkDown', amount: 2, duration: 3, target: 'chosenEnemy' },
    { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
  ])],
  ['tt7-armup', R(SELF, [{ op: 'draw', amount: 2, filter: { type: '装备' } }])],
  ['cmtn1epgt20j', R(SELF, [acquire(1, '注能', 'hand', 'noInfuse')])],
  ['cmtn1p9vb5au', R(SELF, [acquire(1, '形态', 'discover', 'play')])],
  ['tt12-chargeray', R(ENEMY_ONE, [
    { op: 'damage', amount: 5, target: 'chosenEnemy', perInfusedInHand: 2 },
  ])],
  ['tt3-holy-water', R(SELF, [
    { op: 'heal', amountField: 'heal' },
    { op: 'cleanse', target: 'self' },
  ])],
  ['tt3-thunderblast', R(ENEMY_ONE, [
    { op: 'damage', amount: 7, target: 'chosenEnemy', graveyard: { type: '法术', perCard: 1 } },
  ])],
  ['tt7-bladebloom', R(SELF, [acquire(3, '随机', 'discover', 'playKeep')])],
  ['tt7-burnharvest', R(ENEMY_ONE, [
    { op: 'damage', amount: 5, target: 'chosenEnemy', spellPowerMul: 2 },
  ])],
  ['tt7-maxsupply', R(SELF, [{ op: 'draw', untilHandN: 4 }])],
  ['tt7-recruit', R(SELF, [{ op: 'summon', name: '步兵', atk: 4, hp: 4, count: 2, taunt: true }])],
  ['tt3sp-devour', R(ENEMY_ONE, [{ op: 'execute', cap: { atk: 4 }, count: 1 }])],
  ['tt3sp-magicoil', R(SELF, [acquire(1, '药水', 'discover', 'play')])],
  ['tt3sp-shadowshot', R(ENEMY_ONE, [
    // 基础段无条件 3 点；条件段=「对手身负诅咒时额外施放 1 次」（anyCurse 门，见文件头口径注）
    { op: 'damage', amount: 3, target: 'chosenEnemy' },
    { op: 'damage', amount: 3, target: 'chosenEnemy', cond: { anyCurse: true } },
  ])],
]);

// canonical 源表：id → SDT.Cards 上的定版数组名。同 id 多表引用取「最后写入的定版」：
// 4 张 cc-/治愈 在实机覆盖批次 cards-sync.json（m2 cc-chase-slash 同款）；其余为 TABLETOP
// 定版（10/11/12；TABLETOP2/3/7 旧批次同名卡已被 TABLETOP10 按 id 整卡覆盖，m1 先例）。
const CANONICAL_TABLE_BY_ID = new Map([
  ['cc-cursed-blade', 'CARDS_SYNC'],
  ['cc-last-stand', 'CARDS_SYNC'],
  ['cc-rapid-fire', 'CARDS_SYNC'],
  ['tt3-holy-water', 'CARDS_SYNC'],
  ['tt2-jianghu', 'TABLETOP10'],
  ['tt2-turtlearmor', 'TABLETOP10'],
  ['tt3-dig-treasure', 'TABLETOP10'],
  ['tt3-fly-arrowhawk', 'TABLETOP10'],
  ['tt3-purify-arrow', 'TABLETOP10'],
  ['tt3sp-shadowbug', 'TABLETOP10'],
  ['tt3wu-shike', 'TABLETOP10'],
  ['tt7-armup', 'TABLETOP10'],
  ['cmtn1epgt20j', 'TABLETOP10'],
  ['tt7-bladebloom', 'TABLETOP10'],
  ['tt7-burnharvest', 'TABLETOP10'],
  ['tt7-recruit', 'TABLETOP10'],
  ['tt3sp-devour', 'TABLETOP10'],
  ['tt3sp-magicoil', 'TABLETOP10'],
  ['tt3sp-shadowshot', 'TABLETOP10'],
  ['tt3-thunderblast', 'TABLETOP10'],
  ['cmtn0xt0zr7', 'TABLETOP11'],
  ['cmtn1p9vb5au', 'TABLETOP11'],
  ['tt7-maxsupply', 'TABLETOP11'],
  ['tt12-chargeray', 'TABLETOP12'],
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
 * M3 批回填入口。生产无参调用（window.SDT.Cards + localStorage，与 ensureA3* / ensureM1 / ensureM2
 * 同环境）；deps 仅测试注入用。任何失败路径都不写 marker，下次启动重试。
 * @param {{ storage?: Storage | null, library?: any, storeKey?: string }} [deps]
 */
export function ensureM3OnplayRules(deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const library = deps.library !== undefined ? deps.library
    : (typeof window !== 'undefined' ? window.SDT?.Cards : null);
  const storeKey = deps.storeKey ?? KEY;
  try {
    if (!storage || !library) return;
    if (storage.getItem(M3_MARKER_KEY) === '1') return;

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
        console.error(`[cards] M3 rule migration canonical missing: ${id} @ ${tableName}`);
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
      const canonical = canonicalById.get(card.id);
      const previousTurtle = card.id === 'tt2-turtlearmor' && sameSnapshot(card,
        { ...canonical, ...R(SELF, [{ op: 'armor', amount: 10, consumeEquip: true }]) });
      const previousLastStand = card.id === 'cc-last-stand' && sameSnapshot(card,
        { ...canonical, ...R(ENEMY_ONE, [{ ...dmgField(), recast: { on: 'lastHand', times: 2 } }]) });
      const previousMigration = previousTurtle || previousLastStand;
      if (Object.prototype.hasOwnProperty.call(card, 'rules') && !previousMigration) return card;
      if (!previousMigration && !sameSnapshot(card, canonical)) return card;
      const nextCard = { ...card, rules: definition.rules };
      // 先校验后保存：schema 形状 + capability 生产能力门双保险，任一失败抛错整体退出不标记。
      const validation = validateCardRules(nextCard);
      if (!validation.ok) {
        throw new Error(`M3 rule migration validation failed for ${card.id}: `
          + validation.errors.map(err => `${err.path}: ${err.message}`).join('; '));
      }
      const capability = inspectCardRuleCapability(nextCard);
      if (!capability.ok) {
        throw new Error(`M3 rule migration capability unsupported for ${card.id}: `
          + capability.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
      }
      dirty = true;
      return nextCard;
    });

    // 库内 24 张卡必须齐备（A3 foundIds 先例）：缺卡说明播种链未跑完，不标记、下次重试。
    if (foundIds.size !== definitions.size) {
      console.error('[cards] M3 rule migration cards missing:',
        [...definitions.keys()].filter(id => !foundIds.has(id)));
      return;
    }

    if (dirty) {
      // 保存 false / 抛错都不盖章；盖章前复读确认没有异常替换库串（E8 先例）。
      let saved = false;
      try { saved = library.saveAll(nextCards); }
      catch (error) {
        console.error('[cards] M3 rule migration save failed; marker was not written:', error);
        return;
      }
      if (!saved) {
        console.error('[cards] M3 rule migration save returned false; marker was not written.');
        return;
      }
      if (storage.getItem(storeKey) !== JSON.stringify(nextCards)) return;
    } else if (storage.getItem(storeKey) !== raw) {
      return;
    }
    storage.setItem(M3_MARKER_KEY, '1');
  } catch (error) {
    console.error('[cards] M3 rule migration failed; marker was not written:',
      error && error.message ? error.message : error);
  }
}
