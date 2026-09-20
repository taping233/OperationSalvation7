import { sdtDefine } from './sdt-facade.js';
import { migrateCharacterProgress } from './characters.js';

import { Random } from './random.js';
import { DATA } from './data-loader.js';

  const SLOT_KEY = (i) => 'sdt-base-v2-slot' + i;
  const LEGACY_KEY = 'sdt-base-v1';   // 旧版全局基地（v0.20 及之前），启动时迁移
  // 坏档备份键：解析失败时原串转存于此（基地是跨局数据，损坏比对局档更严重）
  const CORRUPT_KEY = (i) => 'sdt-base-' + i + '-corrupt';
  // 基地 schema 版本：破坏性变更时 +1 并在 BASE_MIGRATIONS 补纯函数迁移
  const BASE_VERSION = 2;
  const BASE_MIGRATIONS = {
    // 0→1：首个显式版本，字段缺省由 mergeDef/adopt 兜底，盖章即可
    // 1→2：保险升级改为宠物升级（2026-09-09 需求#2）——旧 safeUp 折算成初始宠物汪汪狗的等级
    1: (s) => {
      s.pets = (s.pets && typeof s.pets === 'object') ? s.pets : {};
      if (!Object.keys(s.pets).length) {
        s.pets.dog = { lv: Math.max(1, Math.min(5, 1 + (s.safeUp || 0))), ts: Date.now() };
      }
      if (!s.petSel || !s.pets[s.petSel]) s.petSel = Object.keys(s.pets)[0] || 'dog';
      return s;
    },
  };

  // ---------- 宠物（2026-09-09 需求 #2/#4/#14）----------
  // 初始宠物汪汪狗进入基地自动获得；其余只能用宠物蛋 + 50 币在仓库孵化（随机、不重复）。
  // effect 字段在「携带」该宠物时生效（见 game.session newRun / chests / shop / safeCap）。
  // 数据外置 game/data/pets.json（2026-09-11 架构批次 2：中央数据源）。
  const PET_EGG_ID = DATA.pets.eggId;
  const HATCH_COST = DATA.pets.hatchCost;          // 孵化消耗的储备币
  const PET_LEVEL_MAX = DATA.pets.levelMax;
  const PET_UP_COSTS = DATA.pets.upCosts;          // 升到 Lv.2/3/4/5 各需的口粮（递增）
  const PETS = DATA.pets.list;
  const petById = (id) => PETS.find(p => p.id === id) || null;
  const petLevel = (id) => Math.max(1, Math.min(PET_LEVEL_MAX, (data.pets[id] && data.pets[id].lv) || 1));
  const ownedPets = () => Object.keys(data.pets || {});
  // 当前携带的宠物（出发后各效果按此生效）；没有宠物时返回 null
  const carriedPet = () => petById(data.petSel) || null;
  const issues = {};   // 档位 -> 'corrupt' | 'tooNew'，供 UI 查询
  const rules = () => window.SDT.MAP.rules;
  // 基地成长接音（迭代评审 09-20）：升级成功=levelup；base.js 无 UI/Sound 静态导入，
  // 循 window.SDT 晚读惯例（同 :41 MAP），失败分支不播 deny（调用层 UI 已有 deny 职责）
  const sfxLevelup = () => { if (window.SDT && window.SDT.Sound) window.SDT.Sound.sfx('levelup'); };
  // 「初始攻击」初始牌：能进消耗口袋（对局中复原用），但永远不入卡牌仓库
  const isSha = (card) => !!card && (card.id === 'starter-attack' ||
    (card.id === undefined && card.name === '初始攻击'));

  // 初始基地：新档案从零开始，资源全靠对局搬回与成就奖励
  function def() {
    return {
      wood: 0, rations: 0,
      keys: 0,        // 真实钥匙储备（仓库钥匙材料卡「使用」后折入；宝藏大门计数）
      bagUp: 0, safeUp: 0,
      stashUp: 0,     // 仓库扩建等级（每次 +3 张容量）
      coins: 0,       // 储备币：卖出仓库物品所得（Item 18：只用于孵蛋/建设，不进局）
      nestUnlocked: false,   // 龙巢：击败一图首脑并成功撤离后解锁
      runes: [],      // 仓库符文 [{kind,name,rarity,attrs,desc}]（每块占 1 仓库格）
      nestBagUp: 0,   // 符文背包升级次数（10 + n 格，上限 25）
      eggPity: 0,     // 宠物蛋软保底：连续未出蛋的开箱次数（出蛋归零，2026-09-19 老板定向）
      stash: [],      // 卡牌仓库 [{card, count}]——出发时自选携带；「初始攻击」不可入库
      pocket: [],     // 基地消耗口袋 [{card, count}]，用钥匙复原后才回仓库
      pets: {},       // 已拥有宠物 [宠物id] => { lv, ts }（宠物蛋孵化；初始宠物汪汪狗自动获得）
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
      backs: { classic: true },
      backSel: 'classic',
    };
  }

  let slot = null;      // 当前游玩的档位（1..5）；标题界面未选档时为 null
  let data = def();

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

  // 把原始 JSON 补齐为完整基地数据（读取 / 概览共用）
  function adopt(raw) {
    const d = Object.assign(def(), raw, {
      stash: Array.isArray(raw.stash) ? raw.stash : [],
      pocket: Array.isArray(raw.pocket) ? raw.pocket : [],
      collection: (raw.collection && typeof raw.collection === 'object') ? raw.collection : {},
      collClaimed: (raw.collClaimed && typeof raw.collClaimed === 'object') ? raw.collClaimed : {},
      collXp: (raw.collXp && typeof raw.collXp === 'object') ? raw.collXp : {},
    });
    mergeDef(d, def());
    if (!Array.isArray(d.stats.bossKills)) d.stats.bossKills = [];
    if (!Array.isArray(d.stats.nestBossKills)) d.stats.nestBossKills = [];
    if (typeof d.stats.reviveKills !== 'number') d.stats.reviveKills = 0;
    if (typeof d.stats.turnMovesMax !== 'number') d.stats.turnMovesMax = 0;
    if (typeof d.stats.battleEquipsMax !== 'number') d.stats.battleEquipsMax = 0;
    if (!Array.isArray(d.runes)) d.runes = [];
    if (typeof d.nestBagUp !== 'number') d.nestBagUp = 0;
    if (typeof d.nestUnlocked !== 'boolean') d.nestUnlocked = false;
    if (!d.backs || typeof d.backs !== 'object') d.backs = { classic: true };
    d.backs.classic = true;   // 默认卡背永远可用
    if (!d.backSel || !d.backs[d.backSel]) d.backSel = 'classic';
    return migrateCharacterProgress(d);
  }

  // peek 指纹缓存（同 game.storage readCache 思路，2026-09-08 性能）：选档页每次打开
  // peek×5，基地档含全量卡牌/收藏数据，逐槽 JSON.parse 不便宜。raw 串指纹失配自动
  // 重解析，绕过 write 直写 localStorage（旧代码/另一标签页）也不会读到脏缓存。
  const peekCache = new Map();

  function parseRaw(i) {
    let raw = null;
    try { raw = localStorage.getItem(SLOT_KEY(i)); } catch (e) { return null; }
    if (raw == null) { peekCache.delete(i); return null; }
    const hit = peekCache.get(i);
    if (hit && hit.raw === raw) return hit.parsed;
    let s;
    try { s = JSON.parse(raw); }
    catch (e) { return _corrupt(i, raw); }
    if (!s || typeof s !== 'object') return _corrupt(i, raw);
    const v = +s.version || 0;
    if (v > BASE_VERSION) {
      // 存档完好但来自更新的版本：原样保留不碰，拒绝读取
      issues[i] = 'tooNew';
      console.warn(`[base] 档位 ${i} 基地版本(${v})新于当前游戏(${BASE_VERSION})，拒绝读取`);
      return null;
    }
    let mv = v;
    while (mv < BASE_VERSION) {
      const m = BASE_MIGRATIONS[mv];
      if (m) s = m(s);
      mv++;
      s.version = mv;
    }
    peekCache.set(i, { raw, parsed: s });
    return s;
  }
  // 坏档处理：原串备份到 corrupt 键后返回 null（原键不动，玩家决定是否覆盖重开）
  function _corrupt(i, raw) {
    issues[i] = 'corrupt';
    try { localStorage.setItem(CORRUPT_KEY(i), raw); } catch (e) { /* 存储不可用 */ }
    console.warn(`[base] 档位 ${i} 基地数据损坏，原串已备份到 ${CORRUPT_KEY(i)}`);
    return null;
  }
  function issue(i) { return issues[i] || null; }

  // 启动迁移：旧全局基地 → 每一个已有对局存档的档位（都没有则给档位 1）
  function migrateLegacy(existingSlots) {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (!legacy) return;
      const targets = (Array.isArray(existingSlots) && existingSlots.length) ? existingSlots : [1];
      targets.forEach(i => {
        if (!localStorage.getItem(SLOT_KEY(i))) localStorage.setItem(SLOT_KEY(i), legacy);
      });
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) { /* 存储不可用时静默 */ }
  }

  // 进入档位：加载该档独立的基地数据（没有则用初始值 = 新档案）
  function use(s) {
    slot = s;
    const raw = parseRaw(s);
    data = raw ? adopt(raw) : def();
    ensureStarterPet();
    return data;
  }

  // 初始宠物「汪汪狗」进入基地自动获得（需求 #4）；老档迁移也走这里兜底
  function ensureStarterPet() {
    if (!data.pets || typeof data.pets !== 'object') data.pets = {};
    if (!data.pets.dog) data.pets.dog = { lv: 1, ts: Date.now() };
    if (!data.petSel || !data.pets[data.petSel]) data.petSel = 'dog';
  }

  // 写失败警示去重（迭代评审 09-20 G-P1）：失败连击只提示一次，成功即复位——
  // 玩家腾出存储空间后的下一次失败会立即再报（有「已恢复」信号）
  let saveWarned = false;
  function save() {
    if (!slot) return true;   // 未选档不落盘（标题界面的数据只读）
    try {
      localStorage.setItem(SLOT_KEY(slot), JSON.stringify({ ...data, version: BASE_VERSION }));
      delete issues[slot];
      saveWarned = false;
      try { localStorage.removeItem(CORRUPT_KEY(slot)); } catch (e) { /* 无关紧要 */ }
      return true;
    } catch (e) {
      // 写失败不再静默：仓库配额满时玩家以为卡牌已入库，重开档无声丢失。
      // base.js 无 UI 静态导入，循 window.SDT 晚读惯例（同 rules()）
      if (!saveWarned) {
        saveWarned = true;
        try { if (window.SDT && window.SDT.UI) window.SDT.UI.log('[[icon:cross]] 基地存档写入失败（存储空间可能已满），入库/升级可能未保存', 'warn'); } catch (e2) { /* 门面未就绪 */ }
      }
      return false;
    }
  }

  // 重开档位：基地回到初始状态（覆盖开新档 / 空档开新档时调用）
  // 新档案仓库预置 5 张随机卡牌（按稀有度权重抽取，不重复），让第一局就有牌可带
  function reset(s) {
    slot = s;
    data = def();
    ensureStarterPet();
    seedStarterStash();
    save();
  }

  function seedStarterStash() {
    const C = window.SDT.Cards;
    if (!C || typeof C.all !== 'function') return;
    // 2026-09-19 老板拍板：新手预置 5 张只发武术/法术（招式开局，道具/装备/资源靠局内获取）
    const pool = C.all().filter(c =>
      c.rarity !== '衍生' && c.name !== '初始攻击' && C.isRandomObtainable(c) &&
      (c.type === '武术' || c.type === '法术'));
    if (!pool.length) return;
    const weights = C.SHOP_WEIGHTS ? Object.entries(C.SHOP_WEIGHTS) : null;
    const totalW = weights ? weights.reduce((a, b) => a + b[1], 0) : 0;
    const taken = new Set();
    let guard = 0;
    while (stashUsed() < 5 && guard++ < 200) {
      let card = null;
      if (weights) {
        for (let t = 0; t < 30 && !card; t++) {
          let roll = Random.random('card') * totalW, rar = null;
          for (const [r, w] of weights) { roll -= w; if (roll <= 0) { rar = r; break; } }
          if (!rar) rar = weights[0][0];
          const sub = pool.filter(c => c.rarity === rar && !taken.has(c.id));
          if (sub.length) card = sub[Math.floor(Random.random('card') * sub.length)];
        }
      }
      if (!card) {
        const sub = pool.filter(c => !taken.has(c.id));
        if (!sub.length) break;
        card = sub[Math.floor(Random.random('card') * sub.length)];
      }
      taken.add(card.id);
      data.stash.push({ card: { ...card }, count: 1 });
    }
  }

  // 只读概览：读取某档位的基地数据但不切换当前档位（选档界面展示用）
  function peek(i) { const raw = parseRaw(i); return raw ? adopt(raw) : null; }

  // 删除某档位的基地数据
  function wipe(i) { try { localStorage.removeItem(SLOT_KEY(i)); } catch (e) { /* 静默 */ } }
  const hasSlot = (i) => { try { return !!localStorage.getItem(SLOT_KEY(i)); } catch (e) { return false; } };

  // ---------- 卡背（v0.21） ----------
  const isBackUnlocked = (id) => !!(data.backs && data.backs[id]);
  function unlockBack(id) {
    if (!data.backs) data.backs = {};
    if (data.backs[id]) return false;
    data.backs[id] = true;
    save();
    return true;
  }
  function setBack(id) {
    if (!isBackUnlocked(id)) return false;
    data.backSel = id;
    save();
    return true;
  }
  // 当前装备的卡背 id（异常时回退默认）
  const backSel = () => (isBackUnlocked(data.backSel) ? data.backSel : 'classic');

  // ---------- 容量与升级 ----------
  const bagCap = () => Math.min(rules().bagMax, rules().bagSize + data.bagUp);
  // 安全（保护）格容量：由「携带宠物」的等级决定（2026-09-09 需求 #2/#4）——
  // Lv.N 提供 safeStart+N-1 格（上限 6），小企鹅咕嘎额外 +2（范围 4-8）
  const safeCap = () => {
    const pet = carriedPet();
    const lv = pet ? petLevel(pet.id) : 1;
    const bonus = (pet && pet.effect && pet.effect.safeBonus) || 0;
    return Math.min(rules().safeMax, rules().safeStart + lv - 1) + bonus;
  };
  // 卡牌仓库容量：按张计（每张卡占 1 格容量），同名堆叠不省容量
  const stashCap = () => Math.min(rules().stashMax,
    rules().stashStart + data.stashUp * rules().stashUpgradeSlots);
  const stashUsed = () => (data.runes ? data.runes.length : 0) + data.stash.reduce((a, b) => a + (b.count || 0), 0);   // 符文也占仓库格（Item 17 龙巢）
  const stashRoom = () => Math.max(0, stashCap() - stashUsed());
  const canUpgradeBag = () => data.bagUp < rules().bagMax - rules().bagSize &&
    data.wood >= rules().bagUpgradeWood;
  // 保险升级改为宠物升级（需求 #2/#14）：每个宠物单独升级，口粮递增 2-3-4-5，上限 Lv.5
  const petUpCost = (id) => PET_UP_COSTS[Math.min(petLevel(id), PET_LEVEL_MAX) - 1];
  const canUpgradePet = (id) => !!data.pets[id] && petLevel(id) < PET_LEVEL_MAX &&
    data.rations >= petUpCost(id);
  const canUpgradeStash = () => stashCap() < rules().stashMax &&
    data.wood >= rules().stashUpgradeWood;

  function upgradeBag() {
    if (!canUpgradeBag()) return false;
    data.wood -= rules().bagUpgradeWood;
    data.bagUp++;
    save();
    sfxLevelup();
    return true;
  }

  function upgradePet(id) {
    if (!canUpgradePet(id)) return false;
    data.rations -= petUpCost(id);
    data.pets[id].lv = petLevel(id) + 1;
    save();
    sfxLevelup();
    return true;
  }

  function upgradeStash() {
    if (!canUpgradeStash()) return false;
    data.wood -= rules().stashUpgradeWood;
    // Item 17：仓库 50 格以后，每格额外消耗 2 符文（龙巢产出）
    if (stashCap() >= (rules().stashRuneSlotFrom || 50)) {
      if ((data.runes || []).length < (rules().stashRuneSlotCost || 2)) return false;
      data.runes.splice(0, rules().stashRuneSlotCost || 2);
    }
    data.stashUp++;
    save();
    sfxLevelup();
    return true;
  }

  // 龙巢：符文背包升级（2 符文 + 5 币升级 1 格，10 → 25）
  function nestBagCap() { return 10 + (data.nestBagUp || 0); }
  function canUpgradeNestBag() { return nestBagCap() < 25 && (data.runes || []).length >= 2 && data.coins >= 5; }
  function upgradeNestBag() {
    if (!canUpgradeNestBag()) return false;
    data.runes.splice(0, 2);
    data.coins -= 5;
    data.nestBagUp = (data.nestBagUp || 0) + 1;
    save();
    sfxLevelup();
    return true;
  }

  // ---------- 运回结算 ----------
  // 物资入库：只收木材/口粮（基地升级资源），其余物资按撤离战利品计分不落库
  function deposit(items) {
    (items || []).forEach(it => {
      if (it.name === '木材') data.wood += it.count || 1;
      else if (it.name === '口粮') data.rations += it.count || 1;
    });
    save();
  }

  // 卡牌入库（同名堆叠）。toPocket = true 时进基地消耗口袋（待钥匙复原）。
  // 「初始攻击」不进卡牌仓库；需求 #6：职业卡与初始牌不进消耗口袋（撤离回收时直接消散）。
  function depositCards(cards, toPocket) {
    const list = toPocket ? data.pocket : data.stash;
    (cards || []).forEach(c => {
      if (isSha(c.card)) return;
      if (toPocket && c.card.rarity === '职业') return;
      const stack = list.find(x => x.card.name === c.card.name);
      if (stack) stack.count += c.count || 1;
      else list.push({ card: { ...c.card }, count: c.count || 1 });
    });
    save();
  }

  // ---------- 消耗口袋复原（需求 #1/#11）：在仓库中使用钥匙，按稀有度计价 ----------
  // 古朴 1 / 稀有 2 / 史诗 3 / 传说 4；整堆复原 = 单张价 × 张数。钥匙不足则无法复原。
  const POCKET_KEY_COST = { '古朴': 1, '稀有': 2, '史诗': 3, '传说': 4 };
  const pocketKeyCost = (stack) => {
    if (!stack) return 0;
    const per = POCKET_KEY_COST[stack.card.rarity] || 1;
    return per * (stack.count || 1);
  };

  // 复原：消耗口袋 → 卡牌仓库（消耗数量不等的钥匙）。
  // 返回 true=成功；'sha'=初始牌无需入库（已销毁，每局自动重带）；
  // 'full'=仓库容量不足；'nokey'=钥匙不足（cost 里带所需数量）；false=无效序号
  function restore(i) {
    const stack = data.pocket[i];
    if (!stack) return false;
    if (isSha(stack.card)) {
      data.pocket.splice(i, 1);   // 「初始攻击」每局自动带 5 张，无需保存
      save();
      return 'sha';
    }
    const cost = pocketKeyCost(stack);
    if ((data.keys || 0) < cost) return { why: 'nokey', cost };
    const room = stashRoom();
    if (room < (stack.count || 1)) return 'full';
    data.pocket.splice(i, 1);
    data.keys -= cost;
    depositCards([stack]);
    return true;
  }

  // ---------- 宠物操作（需求 #2/#4）----------
  // 携带宠物：出发携带效果与安全格数量随之切换
  function setPet(id) {
    if (!data.pets[id]) return false;
    data.petSel = id;
    save();
    return true;
  }
  // 孵化：仓库中的 1 张宠物蛋 + 50 币 → 随机获得 1 只未拥有的宠物
  function hatchPet() {
    const i = data.stash.findIndex(x => x.card.id === PET_EGG_ID);
    if (i < 0) return { ok: false, why: 'noegg' };
    if ((data.coins || 0) < HATCH_COST) return { ok: false, why: 'poor' };
    const unowned = PETS.filter(p => !data.pets[p.id]);
    if (!unowned.length) return { ok: false, why: 'all' };
    const pet = unowned[Math.floor(Random.random('pet') * unowned.length)];
    const stack = data.stash[i];
    stack.count -= 1;
    if (stack.count <= 0) data.stash.splice(i, 1);
    data.coins -= HATCH_COST;
    data.pets[pet.id] = { lv: 1, ts: Date.now() };
    if (!data.petSel) data.petSel = pet.id;
    save();
    return { ok: true, pet };
  }

  // 按名从仓库取出 n 张（出发准备页选择携带时用）；返回实际取出的张数
  function takeStashCards(name, n) {
    const i = data.stash.findIndex(x => x.card.name === name);
    if (i < 0 || n <= 0) return 0;
    const stack = data.stash[i];
    const take = Math.min(n, stack.count || 0);
    stack.count -= take;
    if (stack.count <= 0) data.stash.splice(i, 1);
    save();
    return take;
  }

  // ---------- 仓库物品操作：卖出 / 收藏 ----------
  // 材料卡判定（设计者 2026-09-08 定版）：资源类型中的 木材/口粮/钥匙 是「材料」——
  // 可在仓库直接使用折入真实物资，但不可卖出换币；货币类资源卡（金币/银币/钻石等）仍可出售。
  const MATERIAL_KINDS = [
    { re: /木材/, kind: 'wood', label: '木材', icon: 'wood' },
    { re: /口粮/, kind: 'rations', label: '口粮', icon: 'bread' },
    { re: /钥匙/, kind: 'keys', label: '钥匙', icon: 'key' },
  ];
  const materialInfo = (card) => {
    if (!card || card.type !== '资源') return null;
    return MATERIAL_KINDS.find(m => m.re.test(card.name || '')) || null;
  };
  // 每张卡折入的数量：描述「×N」优先，缺省 1
  const materialAmount = (card) => {
    const m = String(card.desc || '').match(/×\s*(\d+)/);
    return m ? +m[1] : 1;
  };

  // 使用仓库材料卡：折入真实物资（木材/口粮/钥匙）。all = true 时整堆使用。
  function useStashMaterial(name, all) {
    const i = data.stash.findIndex(x => x.card.name === name);
    if (i < 0) return { ok: false, why: 'empty' };
    const stack = data.stash[i];
    const info = materialInfo(stack.card);
    if (!info) return { ok: false, why: 'notmaterial' };
    const per = materialAmount(stack.card);
    const qty = all ? (stack.count || 1) : 1;
    stack.count -= qty;
    if (stack.count <= 0) data.stash.splice(i, 1);
    const total = per * qty;
    if (info.kind === 'keys') data.keys = (data.keys || 0) + total;
    else data[info.kind] += total;
    save();
    return { ok: true, qty, total, label: info.label,
      msg: `[[icon:${info.icon}]] 使用【<b>${name}</b>】×${qty}，折入<b>${info.label} ×${total}</b>` };
  }

  // 卖出仓库中某卡牌堆的 n 张（[[icon:sparkles]]收藏中的堆受保护，需先取消收藏；
  // 材料卡不可卖出换币）。返回 { ok, msg, coins } 或 { ok:false, why }
  function sellStashCards(name, n) {
    const i = data.stash.findIndex(x => x.card.name === name);
    if (i < 0) return { ok: false, why: 'empty' };
    const stack = data.stash[i];
    if (data.collection[stack.card.id]) return { ok: false, why: 'collected' };
    if (materialInfo(stack.card)) return { ok: false, why: 'material' };
    const price = window.SDT.Cards.sellPrice(stack.card);
    const qty = Math.min(Math.max(1, n || 1), stack.count || 1);
    stack.count -= qty;
    if (stack.count <= 0) data.stash.splice(i, 1);
    data.coins += price * qty;
    save();
    return { ok: true, qty, coins: price * qty,
      msg: `[[icon:coin]] 卖出【<b>${name}</b>】×${qty}，+ ${price * qty} 币（储备 ${data.coins}）` };
  }

  // 收藏 / 取消收藏（图鉴记录 = [[icon:sparkles]]标记本身；收藏中的堆不可卖出）
  function collectToggle(card) {
    if (!card || !card.id) return false;
    if (data.collection[card.id]) {
      delete data.collection[card.id];
      save();
      return false;   // 现在未收藏
    }
    data.collection[card.id] = { name: card.name, rarity: card.rarity || '?', ts: Date.now() };
    save();
    return true;      // 现在已收藏
  }
  const isCollected = (card) => !!card && !!card.id && !!data.collection[card.id];

  // ---------- 宝藏大门 ----------
  // 钥匙计数：真实钥匙储备 + 仓库里的钥匙类卡牌（「一串钥匙」= 2 把，其余钥匙 = 1 把）
  const KEY_NEEDED = 10;
  // 钥匙计数（迭代评审 09-20 B-P1）：数量读 desc 的「×N」标记——「三把钥匙」「两把钥匙」
  // 改名后按卡名/「一串」识别只计 1，与卡面「钥匙 ×3」矛盾；与 materialAmount 同款解析，
  // 无 ×N 标记（「一把钥匙」）按 1 计；中文数词不参与解析（×N 只认数字，无 NaN 静默路径）
  const keyCount = () => (data.keys || 0) + data.stash.reduce((a, b) => {
    if (!/钥匙/.test(b.card.name || '')) return a;
    const m = String(b.card.desc || '').match(/×\s*(\d+)/);
    return a + (m ? +m[1] : 1) * (b.count || 0);
  }, 0);

  sdtDefine('Base', {
    SLOT_KEY, LEGACY_KEY,
    migrateLegacy, use, save, reset, peek, wipe, hasSlot,
    issue, CORRUPT_KEY, BASE_VERSION,
    get slot() { return slot; },
    get data() { return data; },
    bagCap, safeCap, stashCap, stashUsed, stashRoom,
    canUpgradeBag, canUpgradePet, canUpgradeStash, upgradeBag, upgradePet, upgradeStash,
    nestBagCap, canUpgradeNestBag, upgradeNestBag,
    petUpCost, petLevel, PET_LEVEL_MAX, PET_UP_COSTS,
    deposit, depositCards, restore, pocketKeyCost, takeStashCards,
    sellStashCards, collectToggle, isCollected,
    useStashMaterial, materialInfo, materialAmount,
    keyCount, KEY_NEEDED,
    isSha,
    isBackUnlocked, unlockBack, setBack, backSel,
    // —— 宠物（2026-09-09 需求 #2/#4）——
    PETS, petById, ownedPets, carriedPet, setPet, hatchPet, HATCH_COST, PET_EGG_ID,
  });

export { bagCap, hasSlot, safeCap };
