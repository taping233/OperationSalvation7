import { migrateCharacterProgress } from '../core/characters.js';

// 纯存档模型：默认值与读取规范化共用；不拥有活动档位，不读写存储。
// 初始基地：新档案从零开始，资源全靠对局搬回与成就奖励
export function createBaseState() {
  return {
    wood: 0, rations: 0,
    keys: 0,        // 真实钥匙储备（仓库钥匙材料卡「使用」后折入；宝藏大门计数）
    bagUp: 0, safeUp: 0,
    stashUp: 0,     // 仓库扩建等级（每次 +3 张容量）
    coins: 0,       // 储备币：卖出仓库物品所得（Item 18：只用于孵蛋/建设，不进局）
    nestUnlocked: false,   // 经典生命研究所：钥匙开门（消耗 KEY_NEEDED 把真实储备）后永久通行
    runes: [],      // 仓库符文 [{kind,name,rarity,attrs,desc}]（每块占 1 仓库格）
    nestBagUp: 0,   // 符文背包升级次数（10 + n 格，上限 25）
    eggPity: 0,     // 宠物蛋硬保底：连续未实际加入蛋的宝箱奖励次数（第 150 次保底，加入蛋归零）
    stash: [],      // 卡牌仓库 [{card, count}]——出发时自选携带；「初始攻击」不可入库
    pocket: [],     // 基地消耗区 [{card, count}]，用钥匙复原后才回仓库
    pets: {},       // 已拥有宠物 [宠物id] => { lv, ts }（宠物蛋孵化；初始宠物旺财自动获得）
    petSel: null,   // 当前携带的宠物 id（出发携带效果 / 安全格数量随之变化）
    collection: {}, // 收藏图鉴 [卡牌id] => { name, rarity, ts }（[[icon:sparkles]]收藏中的物品）
    // ---- 局外成长（v0.9 职业熟练度与成就） ----
    selMode: 'standard',    // 上次出发的玩法（standard / elite；旧档残留的 casual 读取时回落 standard）
    classes: {},            // [职业名] => { lv, xp }（与卡牌库职业表同源）
    stats: {
      nestBossKills: [], reviveKills: 0, turnMovesMax: 0, battleEquipsMax: 0,
      extracts: 0, deaths: 0, kills: 0, actions: 0,
      playSeconds: 0,      // 该档累计实际对局时间；旧档由默认值安全补齐
      bossKills: [],        // 击败过的 BOSS 名
      bestRunCoins: 0, stashTotal: 0,
    },
    achClaimed: {},         // [成就id] => true（已领奖）
    // ---- 职业收藏室（2026-09-09）：收藏里程碑领奖记录 + 收藏经验结算标记 ----
    collClaimed: {},        // [收藏里程碑id] => true（每个一次性奖励只能领一次）
    collXp: {},             // [卡牌id] => true（收藏经验已结算，取消重藏不重复发放）
    // ---- 卡背（v0.21）：backs 解锁表 + backSel 当前装备；默认卡背恒解锁 ----
    backs: /** @type {Record<string, boolean>} */ ({ classic: true }),
    backSel: 'classic',
    // ---- 模块化基地字段（M01 v1） ----
    // 旧收藏、职业经验与仓库仍保留在原字段；这里不复制其真源。
    home: { owned: {}, placements: [], displays: [] },
    appearance: { characterSkins: {}, selectedSkins: {} },
    goals: { tracked: [], presets: {} },
    story: { flags: {}, outcomes: {} },
    // M01 内部提交元数据；领域模块通过 readBase/commitBase 使用，不直接修改。
    _m01: { revision: 0, requests: {} },
  };
}

// 深合并默认值：老存档缺字段时补齐（不覆盖已有进度）
function mergeDef(dst, src) {
  Object.keys(src).forEach(k => {
    if (dst[k] === undefined) dst[k] = src[k];
    else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) &&
             dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) {
      mergeDef(dst[k], src[k]);
    }
  });
  return dst;
}

// 字段级类型兜底（2026-09-24 F1，口径同对局档读取的字段级默认值兜底）：
// JSON 合法但容器字段被写坏（字符串/数字/null/数组）时弃用原值回落默认并 console.warn
// 留痕，不让 adopt/peek 在严格模式下抛 TypeError 卡死选档页；缺字段（undefined）
// 不算损坏，仍由 mergeDef 补齐默认。
const isPlainObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
function normalizeObjField(d, key, fallback) {
  const v = d[key];
  if (v === undefined || isPlainObj(v)) return;
  console.warn(`[base] 存档字段 ${key} 类型损坏（${v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v}），已回落默认值`);
  d[key] = fallback;
}

// 把原始 JSON 补齐为完整基地数据（读取 / 概览共用）
export function normalizeBaseState(raw) {
  const defaults = createBaseState();
  const d = Object.assign({}, defaults, raw, {
    stash: Array.isArray(raw.stash) ? raw.stash : [],
    pocket: Array.isArray(raw.pocket) ? raw.pocket : [],
  });
  // F1（2026-09-24）：容器字段类型兜底。stats/characters/classes/pets/home 等在
  // peek/use/终局提交全链路被解引用或赋属性，写坏即 TypeError（JSON 语法坏已有
  // corrupt 备份口径，这里补齐「JSON 合法但字段类型坏」的缺口：可读、可渲染、不写回）。
  // 字符串 id 写入数组不会进入 JSON；领取/收藏记录必须保留为对象字典。
  for (const key of ['stats', 'characters', 'classes', 'pets', 'home', 'appearance',
    'goals', 'story', 'achClaimed', 'collection', 'collClaimed', 'collXp', 'backs']) {
    normalizeObjField(d, key, defaults[key] || {});
  }
  // A valid progress dictionary can still contain an invalid individual record.
  // Remove those before legacy migration so intact old class progress can fill it.
  for (const group of ['characters', 'classes']) {
    for (const [id, progress] of Object.entries(d[group] || {})) {
      if (!isPlainObj(progress)) {
        console.warn(`[base] 存档字段 ${group}.${id} 类型损坏，已回落默认进度`);
        delete d[group][id];
      } else {
        if (!Number.isInteger(progress.lv) || progress.lv < 1) progress.lv = 1;
        if (!Number.isFinite(progress.xp) || progress.xp < 0) progress.xp = 0;
      }
    }
  }
  for (const [id, pet] of Object.entries(d.pets)) {
    if (!isPlainObj(pet)) {
      console.warn(`[base] 存档字段 pets.${id} 类型损坏，已忽略无效记录`);
      delete d.pets[id];
    } else if (!Number.isInteger(pet.lv) || pet.lv < 1) pet.lv = 1;
  }
  mergeDef(d, defaults);
  if (!Array.isArray(d.stats.bossKills)) d.stats.bossKills = [];
  if (!Array.isArray(d.stats.nestBossKills)) d.stats.nestBossKills = [];
  if (typeof d.stats.reviveKills !== 'number') d.stats.reviveKills = 0;
  if (typeof d.stats.turnMovesMax !== 'number') d.stats.turnMovesMax = 0;
  if (typeof d.stats.battleEquipsMax !== 'number') d.stats.battleEquipsMax = 0;
  if (!Array.isArray(d.runes)) d.runes = [];
  if (typeof d.nestBagUp !== 'number') d.nestBagUp = 0;
  if (typeof d.nestUnlocked !== 'boolean') d.nestUnlocked = false;
  d.backs.classic = true;   // 默认卡背永远可用
  if (!d.backSel || !d.backs[d.backSel]) d.backSel = 'classic';
  if (!isPlainObj(d._m01)) d._m01 = { revision: 0, requests: {} };
  if (!Number.isInteger(d._m01.revision) || d._m01.revision < 0) d._m01.revision = 0;
  if (!d._m01.requests || typeof d._m01.requests !== 'object' || Array.isArray(d._m01.requests)) d._m01.requests = {};
  return migrateCharacterProgress(d);
}

