/* 手牌视图适配：只处理分组与布局，不读写战斗状态。 */

function groupHandCards(entries, infusing = null) {
  const groups = [];
  const push = (entry) => {
    const found = groups.find(group => group.card.name === entry.card.name && group.card.desc === entry.card.desc);
    if (found) found.uids.push(entry.uid);
    else groups.push({ card: entry.card, uids: [entry.uid], self: false });
  };
  if (infusing) {
    entries.forEach(entry => { if (entry.uid !== infusing.uid) push(entry); });
    const main = entries.find(entry => entry.uid === infusing.uid);
    if (main) groups.push({ card: main.card, uids: [main.uid], self: true });
  } else entries.forEach(push);
  return groups;
}

/* —— 扇形手牌（2026-09-09 重做：整排圆弧 + 超员整体缩小，不再分行）——
   输出每张牌相对手牌锚点（容器中轴、底部基线）的目标位：
   x/y 单位 px（正值向右/向下），rot 单位度，scale 为整排缩小系数。
   数值按 250px 宽卡牌口径标定，UNIT 等比换算到本作卡宽（.hs-card.sm @16px = 160px）。
   SPREAD 加宽横向间距 = 减少重叠（老板 09-09 要求：卡更大、重叠更少）。
   1~10 张用标定表（中心牌最高、两侧渐宽渐垂的圆弧）；>10 张切参数弧：间距收紧 + 整排继续缩小。 */
const CARD_W = 160;
const UNIT = CARD_W / 250;
const SPREAD = 1.18; // 横向间距加宽系数（只作用于 x；y 保持原弧深避免边缘牌下沉过多）
const Y_BIAS = 0;    // 不加基线偏移：边缘牌下沉量由锚点高度（.bt-slot bottom）兜住，避免底部被裁
const MAX_ROT = 11;
// [x, y] 标定表（y 负 = 高于基线）；角度由朝向公式给出（边缘夹角随张数增大）
const FAN10 = [
  [[0, -50]],
  [[-100, -50], [100, -50]],
  [[-180, -55], [0, -59], [180, -55]],
  [[-240, -25], [-80, -50], [80, -50], [240, -25]],
  [[-340, 10], [-170, -30], [0, -50], [170, -30], [340, 10]],
  [[-460, 13], [-273, -25], [-90, -50], [90, -50], [273, -25], [460, 13]],
  [[-534, 18], [-365, -14], [-189, -39], [0, -50], [189, -39], [365, -14], [534, 18]],
  [[-565, 28], [-400, -14], [-231, -39], [-80, -50], [80, -50], [231, -39], [400, -14], [565, 28]],
  [[-600, 37], [-445, -2], [-300, -29], [-150, -45], [0, -50], [150, -45], [300, -29], [445, -2], [600, 37]],
  [[-610, 38], [-472, 5], [-340, -21], [-200, -41], [-64, -50], [64, -50], [200, -41], [340, -21], [472, 5], [610, 38]],
];
// 张数 → 整排缩放：≤9 张原大，10 张起每多 1 张缩 0.04，>14 张继续缩到 0.6 下限
function rowScale(n) {
  if (n <= 9) return 1;   // 2026-09-12 紧凑手牌：重叠观感轻，起缩点 7→9
  if (n <= 14) return +(1 - (n - 9) * 0.04).toFixed(2);
  return Math.max(0.6, +(0.8 - (n - 14) * 0.03).toFixed(2));
}

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

export { groupHandCards, fanLayout };
