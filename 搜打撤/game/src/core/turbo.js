/* ============================================================
 * turbo.js —— 快进开关（演出短路总闸，全域叶子模块）
 *
 * turbo 开启时战斗演出等待（battle.clock）、移动动画（game.run.flow moveTo）、
 * 节点过场与搜索揭晓（game.run.scenes）直接落到终态——只跳演出不跳逻辑判定，
 * 与 vitest 的 isTestRuntime 短路同款手法。玩法语义零改动。
 *
 * 本文件是叶子模块：不 import 任何项目模块。治理批次 6 自 agent/agent.turbo.js
 * 逐字迁入——演出快进是战斗/流程/基地共用的表现层开关，归属 core 后依赖方向
 * 单一（battle/run/hub/agent → core），battle 域不再依赖 agent 域。
 * ============================================================ */
const KEY = 'sdt-agent-turbo';
let turbo = false;
try {
  turbo = localStorage.getItem(KEY) === '1';
} catch { /* 存储不可用（隐私模式/无头夹具）：保持默认关闭 */ }

function isTurbo() { return turbo; }

function setTurbo(on) {
  turbo = !!on;
  try { localStorage.setItem(KEY, turbo ? '1' : '0'); } catch { /* 同上 */ }
  return turbo;
}

// 演出时长换算：turbo 下归零（调用方原本就是 setTimeout/delay 语义）
function turboMs(ms) { return turbo ? 0 : (Number(ms) || 0); }

export { isTurbo, setTurbo, turboMs };
