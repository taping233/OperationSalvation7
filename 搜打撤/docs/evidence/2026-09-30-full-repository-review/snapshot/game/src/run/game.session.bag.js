/* game.session.bag.js —— 背包 / 库存 / 局内经济（自 game.session.js 拆出，2026-09-25）。
 * 物资与卡牌混占背包格、安全格独立计容、珍珠盒扩格、同名叠放上限、卡牌 zone 断言、
 * 发币与拾取入包、卡库快照克隆刷新。依赖内核（game）与模式（modeCfg 金币倍率），
 * 被存档（assertZones）、终局结算（抢运统计）与基地背包模块消费。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { game } from './game.session.kernel.js';
import { modeCfg } from './game.session.modes.js';

// ---------- 背包容量（基地扩建后生效）----------
// 物资与卡牌混占背包格：同名物资/同名卡牌各堆叠 1 格；
// 安全格独立计容（基地用口粮升级），消耗口袋不占格（无限容量）。
// 珍珠盒（Q5 老板定向）：每持有 1 个额外扩容 9 格，扩出来的格子只能放资源卡。
export const PEARL_BOX_ID = 'tt2-pearlbox';
const PEARL_BOX_SLOTS = 9;
const pearlBonus = () => (game.ownedCards || []).filter(o => o.card && o.card.id === PEARL_BOX_ID).length * PEARL_BOX_SLOTS;
export const bagCap = () => SDT.Base.bagCap() + pearlBonus();
// 背包能否再收一张卡：基础格内任意类型；珍珠盒扩出来的格子仅资源卡（卡面「容纳所有类型的资源卡牌」）
export const canAcceptCard = (card) => {
  if (!card) return false;
  const used = usedSlots();
  if (used < SDT.Base.bagCap()) return true;
  return card.type === '资源' && used < bagCap();
};
export const safeCap = () => SDT.Base.safeCap();
// ---------- 背包叠放上限（2026-09-09 需求 #7）----------
// 同名卡牌最多 3 张占 1 格（「初始攻击」与「火球」可叠 5 张），第 4 张起另占一格。
export const stackCapOf = (card) => {
  const n = card && card.name;
  if (n === '初始攻击' || n === '火球') return 5;
  return 3;
};
export function cardStacks(safe) {
  // 先按卡名聚合，再按叠放上限切分成多格（同名可能占多格，#7）
  // 2026-09-10 留言 #29：存入珍珠盒的资源卡（o.stored）不占背包格——从堆叠统计里排除，
  // 背包格渲染与容量口径（usedSlots/canAcceptCard）随之自动生效
  const map = new Map();
  game.ownedCards.forEach(o => {
    if (o.stored) return;
    if (!!o.safe !== !!safe) return;
    const key = o.card.name;
    if (!map.has(key)) map.set(key, { card: o.card, uids: [] });
    map.get(key).uids.push(o.uid);
  });
  const out = [];
  map.forEach(({ card, uids }) => {
    const cap = stackCapOf(card);
    for (let i = 0; i < uids.length; i += cap) {
      out.push({ card, count: Math.min(cap, uids.length - i), uids: uids.slice(i, i + cap) });
    }
  });
  return out;
}
export function usedSlots() { return game.inventory.length + cardStacks(false).length; }
export function safeUsed() { return cardStacks(true).length; }
// 卡牌 zone 一致性断言（card-game：一张卡同一时刻只应属于一个 zone）。
// dev 模式下在存档前跑：uid 重复 / 卡牌同时带 safe 与 brought 以外矛盾标记即报错。
export function assertZones() {
  if (!game.devMode) return;
  const seen = new Set();
  game.ownedCards.forEach(o => {
    if (seen.has(o.uid)) console.error('[zone] uid 重复（卡牌同时存在于两个实例）：', o.uid, o.card && o.card.name);
    seen.add(o.uid);
    if (o.safe && o.brought && o.brought !== 1) {
      console.error('[zone] 卡牌同时标记 safe 与异常 brought：', o.uid, o.card && o.card.name);
    }
  });
  // 消耗口袋与身上卡不共享 uid（usedPocket 存 {card,count} 聚合，无 uid，天然隔离）
  game.usedPocket.forEach(p => {
    if (p && p.uid) console.error('[zone] usedPocket 条目不应携带 uid：', p.uid, p.card && p.card.name);
  });
}

game.bagCap = bagCap;
game.canAcceptCard = canAcceptCard;   // 珍珠盒扩格的资源限制（Q5）
game.stackCapOf = stackCapOf;
game.safeCap = safeCap;
game.usedSlots = usedSlots;
game.safeUsed = safeUsed;
game.gainCoins = gainCoins;   // 宝箱等模块发币（含飘字与日志）

game.addItem = function (tpl, n) {
  n = n || 1;
  // 同名物品堆叠占一格；背包上限 bagCap() 格（基地可扩建）
  let slot = game.inventory.find(it => it.name === tpl.name && it.tier === (tpl.tier || 'C'));
  if (!slot && usedSlots() >= bagCap()) {
    SDT.Sound.sfx('deny');
    UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格，可在基地用木材扩建），无法获得 <b>${tpl.name}</b>`, 'warn');
    return null;
  }
  if (!slot) {
    slot = { name: tpl.name, value: tpl.value || 0, tier: tpl.tier || 'C', count: 0 };
    game.inventory.push(slot);
  }
  slot.count += n;
  UI.log(`获得 <b>${tpl.name}${slot.count > 1 ? ` ×${slot.count}` : ''}</b>（价值 ${(tpl.value || 0) * slot.count}）`, 'loot');
  UI.refresh(game);
  return slot;
};

export function gainCoins(n) {
  // 精英突袭等模式的金币倍率（战斗掉落 / 格子币全部生效）
  n = Math.max(1, Math.round(n * (modeCfg().coinMul || 1)));
  game.coins += n;
  SDT.Sound.sfx('coin');
  UI.log(`获得 <b>${n}</b> 币（现有 ${game.coins}）`, 'coin');
}

// 按现行卡库刷新背包/仓库里的卡牌快照克隆（2026-09-10 留言 #22/#37）。
// 卡面数值与描述以卡库为准；下划线开头的运行时字段（法师锦囊 _pouch 等）是局内状态，原样保留。
export function refreshCardClones(cards) {
  if (!Array.isArray(cards) || !SDT.Cards || typeof SDT.Cards.all !== 'function') return 0;
  const libById = new Map(SDT.Cards.all().map(c => [c.id, c]));
  let n = 0;
  cards.forEach(card => {
    if (!card || !card.id) return;
    const lib = libById.get(card.id);
    if (!lib) return;
    const keep = {};
    Object.keys(card).forEach(k => { if (k.startsWith('_')) keep[k] = card[k]; });
    const fresh = { ...lib, ...keep };
    // 字段级比较：有实际变化才替换并计数，避免无谓的存档抖动
    if (JSON.stringify(fresh) !== JSON.stringify(card)) { Object.keys(card).forEach(k => delete card[k]); Object.assign(card, fresh); n++; }
  });
  return n;
}
