/* 照相馆照片陈列道具（拆分自 game.cardslib.js，行为原样保留）：
   缩略图档位、按卡牌稳定 id 生成的落影、馆内藏品编号。均为纯函数/常量。 */

// 卡面小图开关（2026-09-13 老板反馈「卡牌库很卡」）：库页网格与悬停预览里的插画区
// 最大只到 215×165 CSS px，原图 896 宽等于 4 倍以上过采样，245 张全量解码要 918MB，
// 滚动时解码缓存反复驱逐重解码。改取 448 宽缩略图（assets/thumbs，见 art.js cardIcon）。
// 放大看卡面（libInspect → showCardZoom）不传 low，仍是原图。
export const LIB_ART = { low: true };

// 照片陈列差异按卡牌稳定 id 生成：同一张卡每次打开保持同一磨损与落影，
// 不用原生随机函数，避免筛选/重绘时整面墙不断跳位。
function photoUnit(seed, salt) {
  let hash = (2166136261 ^ salt) >>> 0;
  const text = String(seed || 'card');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash / 0xffffffff;
}

export function photoStyle(card, index) {
  const seed = card.id || card.name || index;
  const between = (salt, min, max) => min + photoUnit(seed, salt) * (max - min);
  // 落影角度/虚实随卡不同，按卡牌 id 稳定生成，筛选重绘不跳位。
  // （悬挂微倾/3D 侧倾 2026-09-23 拍板删除：网格不齐损害清晰度）
  return [
    `--i:${index}`,
    `--photo-shadow-x:${between(23, -3, 3).toFixed(1)}px`,
    `--photo-shadow-y:${between(37, 14, 22).toFixed(1)}px`,
    `--photo-shadow-blur:${between(41, 24, 34).toFixed(1)}px`,
  ].join(';');
}

// 馆内藏品编号：按卡牌稳定 id 哈希成两位数，同一张卡每次进馆都是同一个号（批次四）
export function photoNo(id) {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 10 + h % 90;
}
