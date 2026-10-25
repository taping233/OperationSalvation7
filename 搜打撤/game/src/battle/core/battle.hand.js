import { isStarterAttackIdentity } from '../../cards/card-legacy-battle-policy.js';
import { liveCardOptions } from '../../cards/card-state-presentation.js';
/* 手牌视图适配：只处理分组与布局，不读写战斗状态。 */

function groupHandCards(entries, infusing = null) {
  const groups = [];
  const byKey = new Map();
  const stackKey = card => card && card.id
    ? `id:${card.id}|${card.cost}|${card.desc || ''}`
    : `legacy:${card?.name || ''}|${card?.type || ''}|${card?.cost || 0}|${card?.desc || ''}`;
  const push = (entry) => {
    const face = entry.card._presentation || {};
    const cost = liveCardOptions(entry.card)?.costOverride;
    const presentation = cost || face.temporary || face.transforming || face.transformed || face.originName;
    const key = stackKey(entry.card) + (presentation ? '|' + JSON.stringify([cost?.v, cost?.base,
      !!face.temporary, !!face.transforming, !!face.transformed, face.originName]) : '');
    const found = byKey.get(key);
    if (found) found.uids.push(entry.uid);
    else {
      const group = { key, card: entry.card, uids: [entry.uid], self: false, ...(cost ? {costOverride:cost} : {}) };
      byKey.set(key, group);
      groups.push(group);
    }
  };
  if (infusing) {
    entries.forEach(entry => { if (entry.uid !== infusing.uid) push(entry); });
    const main = entries.find(entry => entry.uid === infusing.uid);
    if (main) groups.push({ key: stackKey(main.card), card: main.card, uids: [main.uid], self: true });
  } else entries.forEach(push);
  return groups;
}

/* —— 扇形手牌（2026-09-09 重做：整排圆弧 + 超员整体缩小，不再分行）——
   输出每张牌相对手牌锚点（容器中轴、底部基线）的目标位：
   x/y 单位 px（正值向右/向下），rot 单位度，scale 为整排缩小系数。
   数值按 250px 宽卡牌口径标定，UNIT 等比换算到本作卡宽（.hs-card.sm @16px = 160px）。
   SPREAD 加宽横向间距 = 减少重叠（老板 09-09 要求：卡更大、重叠更少）。
   1~10 张用标定表（中心牌最高、两侧渐宽渐垂的圆弧）；>10 张切参数弧：间距收紧 + 整排继续缩小。 */

/* —— 平行手牌（2026-09-13 留言：不再扇形，平行排布 + 卡面 1/3 沉底 + 安全区内不遮能量/按键）——
   间距随张数收紧（重叠度增加）；超过 14 张自动分两行（第二行叠在第一行上方）。
   返回值结构不变（x/y/rot/scale），视图的 CSS 变量补间链零改动。 */
function fanLayout(index, count) {
  const n = Math.max(1, count | 0);
  const i = Math.min(n - 1, Math.max(0, index | 0));
  // 分行：>14 张切两行，行内张数对半（第二行叠在上方，y 上移一个沉底补偿量）
  const rows = n > 14 ? 2 : 1;
  const perRow = rows === 1 ? n : Math.ceil(n / 2);
  const row = rows === 1 ? 0 : (i < perRow ? 0 : 1);
  const idxInRow = row === 0 ? i : i - perRow;
  const cntInRow = row === 0 ? perRow : n - perRow;
  // 行内间距：张数越多间距越小（重叠度增加）
  const step = cntInRow <= 5 ? 128 : cntInRow <= 8 ? 104 : cntInRow <= 11 ? 84 : 70;
  const x = (idxInRow - (cntInRow - 1) / 2) * step;
  const y = row === 1 ? -150 : 0;   // 第二行抬高（与第一行错开且不遮能量/按键）
  return { x: +x.toFixed(1), y, rot: 0, scale: 1 };
}

/* —— 初始攻击恒置顶最左（2026-10-02 老板：「初始攻击」在手牌中永远显示在手牌区第一栏最左边）——
   只改渲染权重：初始攻击最前，招式在装备之前（同类保持入手顺序、
   组间保持入手相对顺序），hand 数组语义顺序与牌局动画逻辑零改动；
   注能主卡（self 组）不参与排序、保持居尾展示。 */
const isStarterAttackCard = isStarterAttackIdentity;
const handGroupRank = group => group.self ? 5 : isStarterAttackCard(group.card) ? 0
  : ['武术', '法术'].includes(group.card?.type) ? 1 : group.card?.type === '装备' ? 4 : 2;
function orderHandGroups(groups) {
  return groups.slice().sort((a, b) => handGroupRank(a) - handGroupRank(b));
}

export { groupHandCards, fanLayout, orderHandGroups };

// 每回合按类别保留槽号；复制/合并与费用变化按UID继承旧槽，新组追加在同类末尾。
export function createStableHandSlots() {
  let epoch = null, slots = [];
  return (groups, token, turn) => {
    const nextEpoch = `${token}:${turn}`;
    if (nextEpoch !== epoch) { epoch = nextEpoch; slots = []; }
    const assigned = new Set();
    const result = groups.map(group => {
      let index = slots.findIndex((slot, i) => !assigned.has(i) && (slot.key === group.key || slot.uids.some(uid => group.uids.includes(uid))));
      if (index < 0) index = slots.length;
      slots[index] = { key: group.key, uids: group.uids.slice(), rank:handGroupRank(group) };
      assigned.add(index);
      return { ...group, displaySlot: index };
    });
    // 各类内部保留旧槽和空位；新抽到的招式也排在装备之前。
    const ordered = slots.map((slot, index) => ({ index, rank:slot.rank })).sort((a,b) => a.rank - b.rank || a.index - b.index);
    const positions = new Map(ordered.map((slot, index) => [slot.index, index]));
    return { groups: result.map(group => ({ ...group, displaySlot:positions.get(group.displaySlot) }))
      .sort((a,b) => a.displaySlot - b.displaySlot), count: slots.length };
  };
}
