/* ============================================================
 * agent.turbo.js —— 快进开关（Agent 链路的演出短路总闸）
 *
 * turbo 开启时战斗演出等待（battle.clock）、移动动画（game.run.flow moveTo）、
 * 节点过场与搜索揭晓（game.run.scenes）直接落到终态——只跳演出不跳逻辑判定，
 * 与 vitest 的 isTestRuntime 短路同款手法。玩法语义零改动。
 *
 * 本文件是叶子模块：不 import 任何项目模块，供 battle/run 域安全引用。
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
