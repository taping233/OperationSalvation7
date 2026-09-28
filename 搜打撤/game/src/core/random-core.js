/* ============================================================
 * random-core.js —— RNG 纯函数零依赖件（2026-09-28 代码线收敛）
 *
 * hashSeed + nextRandom（sfc32 风格单步）的唯一权威实现。
 * 刻意不 import sdt-facade：map-generator 等纯数据模块在「测试先整体替换
 * window.SDT」的环境里静态导入本文件时，不得提前触发门面求值
 * （回归实录：map-generator→random→sdt-facade 的边把门面求值提到静态期，
 * r5a/item15 两测试的门面替换假设被打破）。
 * 服务态（命名流/快照/恢复）在 random.js；改这里=改全局随机序列，
 * 必须同步 tests/map-rng-bit-equivalence.test.js 与地图快照契约。
 * ============================================================ */
const UINT32_RANGE = 0x100000000;
const STEP = 0x6D2B79F5;

function hashSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state) {
  const s = (state + STEP) >>> 0;
  let value = s;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { state: s, value: ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE };
}

export { UINT32_RANGE, STEP, hashSeed, nextRandom };
