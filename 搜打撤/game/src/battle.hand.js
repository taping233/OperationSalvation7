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
// 张数 → 整排缩放：≤7 张原大，8 张起每多 1 张缩 0.05，>12 张继续缩到 0.5 下限
function rowScale(n) {
  if (n <= 7) return 1;
  if (n <= 12) return +(1 - (n - 7) * 0.05).toFixed(2);
  return Math.max(0.5, +(0.75 - (n - 12) * 0.04).toFixed(2));
}

function fanLayout(index, count) {
  const n = Math.max(1, count | 0);
  const i = Math.min(n - 1, Math.max(0, index | 0));
  const u = n > 1 ? i / (n - 1) - 0.5 : 0;   // -0.5（最左）..0.5（最右）
  const scale = rowScale(n);
  const compress = n <= 10 ? 1 : Math.pow(10 / n, 0.7);   // 超员：收紧横向间距加重叠
  let x, y;
  if (n <= 10) {
    [x, y] = FAN10[n - 1][i];
  } else {
    x = 610 * (2 * u) * compress;
    y = -50 + 88 * (2 * u) * (2 * u) * compress;
  }
  const rot = Math.max(-MAX_ROT, Math.min(MAX_ROT, n * 2 * u * (n <= 10 ? 1 : 0.9)));
  return {
    x: +(x * UNIT * SPREAD).toFixed(1),
    y: +(y * UNIT).toFixed(1),
    rot: +rot.toFixed(2),
    scale,
  };
}

export { groupHandCards, fanLayout };
