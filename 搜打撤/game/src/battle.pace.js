/* 战斗演示倍率（迭代评审 09-20 敌方阶段 2× 档）：
 * 单一倍率同步缩放四处演出时长——敌方行动步进（battle.core）、攻击序列帧（battle.frames）、
 * 前摇/弹道/彩闪演出（battle.view）、飘字错峰（battle.feedback）——只缩演出不缩逻辑判定。
 * 此前 1× 下敌方步进 420ms 已与 600ms 攻击序列互相截断，若 2× 只缩步进会三层叠影；
 * reduceMotion（减动效）路径不受影响：动画本就被跳过，倍率只作用于仍在播的时长。 */
const KEY = 'sdt-battle-pace';
const ALLOWED = [1, 2];
let pace = 1;
try {
  const v = parseInt(localStorage.getItem(KEY), 10);
  if (ALLOWED.includes(v)) pace = v;
} catch (e) { /* 隐私模式等：保持默认 1× */ }

function getPace() { return pace; }

function setPace(v) {
  if (!ALLOWED.includes(v)) return;
  pace = v;
  try { localStorage.setItem(KEY, String(v)); } catch (e) { /* 同上 */ }
}

// 时长换算：2× 时减半；80ms 下限防定时器过密与动画闪跳
function demoMs(ms) {
  return Math.max(80, Math.round((Number(ms) || 0) / pace));
}

export { getPace, setPace, demoMs };
