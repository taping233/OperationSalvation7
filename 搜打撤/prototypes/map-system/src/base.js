import { migrateCharacterProgress } from './characters.js';

import { Random } from './random.js';

  const SLOT_KEY = (i) => 'sdt-base-v2-slot' + i;
  const LEGACY_KEY = 'sdt-base-v1';   // 旧版全局基地（v0.20 及之前），启动时迁移
  // 坏档备份键：解析失败时原串转存于此（基地是跨局数据，损坏比对局档更严重）
  const CORRUPT_KEY = (i) => 'sdt-base-' + i + '-corrupt';
  // 基地 schema 版本：破坏性变更时 +1 并在 BASE_MIGRATIONS 补纯函数迁移
  const BASE_VERSION = 1;
  const BASE_MIGRATIONS = {
    // 0→1：首个显式版本，字段缺省由 mergeDef/adopt 兜底，盖章即可
  };
  const issues = {};   // 档位 -> 'corrupt' | 'tooNew'，供 UI 查询
  const rules = () => window.SDT.MAP.rules;
  // 「初始攻击」初始牌：能进消耗口袋（对局中复原用），但永远不入卡牌仓库
  const isSha = (card) => !!card && (card.id === 'builtin-sha' ||
    (card.id === undefined && card.name === '初始攻击'));

  // 初始基地：新档案从零开始，资源全靠对局搬回与成就奖励
  function def() {
    return {
      wood: 0, rations: 0,
      bagUp: 0, safeUp: 0,
      stashUp: 0,     // 仓库扩建等级（每次 +3 张容量）
      coins: 0,       // 储备币：卖出仓库物品所得，出发时随身带走
      stash: [],      // 卡牌仓库 [{card, count}]——出发时自选携带；「初始攻击」不可入库
      pocket: [],     // 基地消耗口袋 [{card, count}]，复原后才回仓库
      collection: {}, // 收藏图鉴 [卡牌id] => { name, rarity, ts }（[[icon:sparkles]]收藏中的物品）
      // ---- 局外成长（v0.9 职业熟练度与成就） ----
      selMode: 'standard',    // 上次出发的玩法（standard / elite / casual）
      classes: {},            // [职业名] => { lv, xp }（与卡牌库职业表同源）
      stats: {
        extracts: 0, deaths: 0, kills: 0, actions: 0,
        playSeconds: 0,      // 该档累计实际对局时间；旧档由默认值安全补齐
        bossKills: [],        // 击败过的 BOSS 名
        bestRunCoins: 0, stashTotal: 0,
      },
      achClaimed: {},         // [成就id] => true（已领奖）
      // ---- 卡背（v0.21）：backs 解锁表 + backSel 当前装备；默认卡背恒解锁 ----
      backs: { classic: true },
      backSel: 'classic',
    };
  }

  let slot = null;      // 当前游玩的档位（1..3）；标题界面未选档时为 null
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
    });
    mergeDef(d, def());
    if (!Array.isArray(d.stats.bossKills)) d.stats.bossKills = [];
    if (!d.backs || typeof d.backs !== 'object') d.backs = { classic: true };
    d.backs.classic = true;   // 默认卡背永远可用
    if (!d.backSel || !d.backs[d.backSel]) d.backSel = 'classic';
    return migrateCharacterProgress(d);
  }

  function parseRaw(i) {
    let raw = null;
    try { raw = localStorage.getItem(SLOT_KEY(i)); } catch (e) { return null; }
    if (raw == null) return null;
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
    return data;
  }

  function save() {
    if (!slot) return;   // 未选档不落盘（标题界面的数据只读）
    try {
      localStorage.setItem(SLOT_KEY(slot), JSON.stringify({ ...data, version: BASE_VERSION }));
      delete issues[slot];
      try { localStorage.removeItem(CORRUPT_KEY(slot)); } catch (e) { /* 无关紧要 */ }
    } catch (e) { /* 静默 */ }
  }

  // 重开档位：基地回到初始状态（覆盖开新档 / 空档开新档时调用）
  // 新档案仓库预置 5 张随机卡牌（按稀有度权重抽取，不重复），让第一局就有牌可带
  function reset(s) {
    slot = s;
    data = def();
    seedStarterStash();
    save();
  }

  function seedStarterStash() {
    const C = window.SDT.Cards;
    if (!C || typeof C.all !== 'function') return;
    const pool = C.all().filter(c =>
      c.rarity !== '衍生' && c.name !== '初始攻击' && C.isRandomObtainable(c));
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
  const safeCap = () => Math.min(rules().safeMax, rules().safeStart + data.safeUp);
  // 卡牌仓库容量：按张计（每张卡占 1 格容量），同名堆叠不省容量
  const stashCap = () => Math.min(rules().stashMax,
    rules().stashStart + data.stashUp * rules().stashUpgradeSlots);
  const stashUsed = () => data.stash.reduce((a, b) => a + (b.count || 0), 0);
  const stashRoom = () => Math.max(0, stashCap() - stashUsed());
  const canUpgradeBag = () => data.bagUp < rules().bagMax - rules().bagSize &&
    data.wood >= rules().bagUpgradeWood;
  const canUpgradeSafe = () => data.safeUp < rules().safeMax - rules().safeStart &&
    data.rations >= rules().safeUpgradeRations;
  const canUpgradeStash = () => stashCap() < rules().stashMax &&
    data.wood >= rules().stashUpgradeWood;

  function upgradeBag() {
    if (!canUpgradeBag()) return false;
    data.wood -= rules().bagUpgradeWood;
    data.bagUp++;
    save();
    return true;
  }

  function upgradeSafe() {
    if (!canUpgradeSafe()) return false;
    data.rations -= rules().safeUpgradeRations;
    data.safeUp++;
    save();
    return true;
  }

  function upgradeStash() {
    if (!canUpgradeStash()) return false;
    data.wood -= rules().stashUpgradeWood;
    data.stashUp++;
    save();
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

  // 卡牌入库（同名堆叠）。toPocket = true 时进基地消耗口袋（仍待复原）。
  // 「初始攻击」不会进入卡牌仓库（初始牌每局自动携带；容量由交互层用 stashRoom() 把关）。
  function depositCards(cards, toPocket) {
    const list = toPocket ? data.pocket : data.stash;
    (cards || []).forEach(c => {
      if (!toPocket && isSha(c.card)) return;
      const stack = list.find(x => x.card.name === c.card.name);
      if (stack) stack.count += c.count || 1;
      else list.push({ card: { ...c.card }, count: c.count || 1 });
    });
    save();
  }

  // 复原：消耗口袋 → 卡牌仓库。
  // 返回 true=成功；'sha'=初始牌无需入库（已销毁，每局自动重带）；'full'=仓库容量不足；false=无效序号
  function restore(i) {
    const stack = data.pocket[i];
    if (!stack) return false;
    if (isSha(stack.card)) {
      data.pocket.splice(i, 1);   // 「初始攻击」每局自动带 5 张，无需保存
      save();
      return 'sha';
    }
    const room = stashRoom();
    if (room < (stack.count || 1)) return 'full';
    data.pocket.splice(i, 1);
    depositCards([stack]);
    return true;
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
  // 卖出仓库中某卡牌堆的 n 张（[[icon:sparkles]]收藏中的堆受保护，需先取消收藏）。
  // 返回 { ok, msg, coins } 或 { ok:false, why }
  function sellStashCards(name, n) {
    const i = data.stash.findIndex(x => x.card.name === name);
    if (i < 0) return { ok: false, why: 'empty' };
    const stack = data.stash[i];
    if (data.collection[stack.card.id]) return { ok: false, why: 'collected' };
    const price = window.SDT.Cards.sellPrice(stack.card);
    const qty = Math.min(Math.max(1, n || 1), stack.count || 1);
    stack.count -= qty;
    if (stack.count <= 0) data.stash.splice(i, 1);
    data.coins += price * qty;
    save();
    return { ok: true, qty, coins: price * qty,
      msg: `[[icon:coin]] 卖出【<b>${name}</b>】×${qty}，+ ${price * qty} 币（储备 ${data.coins}）` };
  }

  // 卖出基地储备资源（wood / rations）：价值即币
  function sellRaw(kind, all) {
    const item = kind === 'wood' ? window.SDT.MAP.items.wood : window.SDT.MAP.items.rations;
    const qty = all ? data[kind] : Math.min(1, data[kind]);
    if (qty <= 0) return { ok: false, why: 'empty' };
    data[kind] -= qty;
    data.coins += item.value * qty;
    save();
    return { ok: true, qty, coins: item.value * qty,
      msg: `[[icon:coin]] 卖出【<b>${item.name}</b>】×${qty}，+ ${item.value * qty} 币（储备 ${data.coins}）` };
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

  // ---------- 储备币 ----------
  // 出发时把储备币全部带走（本局开局币的一部分）
  function takeReserveCoins() {
    const c = data.coins || 0;
    data.coins = 0;
    save();
    return c;
  }

  // ---------- 宝藏大门 ----------
  // 钥匙计数：仓库里的钥匙类卡牌（「一串钥匙」= 2 把，其余钥匙 = 1 把）
  const KEY_NEEDED = 10;
  const keyCount = () => data.stash.reduce((a, b) => {
    if (!/钥匙/.test(b.card.name || '')) return a;
    return a + (/一串/.test(b.card.name) ? 2 : 1) * (b.count || 0);
  }, 0);

  window.SDT = window.SDT || {};
  window.SDT.Base = {
    SLOT_KEY, LEGACY_KEY,
    migrateLegacy, use, save, reset, peek, wipe, hasSlot,
    issue, CORRUPT_KEY, BASE_VERSION,
    get slot() { return slot; },
    get data() { return data; },
    bagCap, safeCap, stashCap, stashUsed, stashRoom,
    canUpgradeBag, canUpgradeSafe, canUpgradeStash,
    upgradeBag, upgradeSafe, upgradeStash,
    deposit, depositCards, restore, takeStashCards,
    sellStashCards, sellRaw, collectToggle, isCollected, takeReserveCoins,
    keyCount, KEY_NEEDED,
    isSha,
    isBackUnlocked, unlockBack, setBack, backSel,
  };

export { bagCap, hasSlot, safeCap };
