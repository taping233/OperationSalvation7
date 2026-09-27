/* ============================================================
 * agent-compare.mjs —— 配对检验工具（ML 式迭代方法论的核心统计件）
 *
 * 用法：
 *   node game/tools/agent-compare.mjs <challenger runs.jsonl> <champion runs.jsonl>
 *
 * 两份 runs.jsonl 必须同 --seed-base（配对前提：同一局地图/掉落/战斗）。
 * 按 seed join 后逐局比较，输出：
 *   - 配对胜负表（challenger 赢/输/平）+ 符号检验双侧 p 值（二项精确检验）
 *   - 裸指标对照（撤离率/均层/弃局率——没有配对敏感度高，仅参考）
 *   - 差异分桶（哪个 outcome 转移贡献最大 = ML 的 confusion 增量分析）
 *
 * 判决口径（方法论定版）：
 *   p < 0.05 且方向为正 → challenger 显著更优，可挑战 champion
 *   弃局率 challenger > 5% → 直接毙（硬约束，不看 p 值）
 *   其余 → 不显著，丢弃假设（早停，省算力）
 * ============================================================ */
import { readFileSync } from 'node:fs';

const [challengerPath, championPath] = process.argv.slice(2);
if (!challengerPath || !championPath) {
  console.error('用法: node game/tools/agent-compare.mjs <challenger runs.jsonl> <champion runs.jsonl>');
  process.exit(1);
}

const load = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const challenger = load(challengerPath);
const champion = load(championPath);

// ---------- 对齐校验（09-26 补）：配对前提靠人肉纪律是隐患，这里把违规变显式警告 ----------
// seed 重复会静默吃样本（Map 取后一条）；两侧 runs 数不等会悄悄缩小有效 n——都该让人看见
const dupWarn = (rs, name) => {
  const seen = new Map();
  for (const r of rs) seen.set(r.seed, (seen.get(r.seed) || 0) + 1);
  const dups = [...seen.entries()].filter(([, c]) => c > 1);
  if (dups.length) console.error(`⚠ ${name} 侧有 ${dups.length} 个重复 seed（${dups.slice(0, 3).map(([s, c]) => `${s}×${c}`).join(' ')}...），配对只取其一`);
  return dups.length;
};
const dupC = dupWarn(challenger, 'challenger');
const dupH = dupWarn(champion, 'champion');
if (challenger.length !== champion.length) {
  console.error(`⚠ 两侧局数不等（challenger ${challenger.length} vs champion ${champion.length}）——有效样本取小侧，统计口径与标准轮（100 局）不一致时慎下 promote 结论`);
}
const seedOf = (r) => r.seed;
if (challenger.some((r) => r.seed == null) || champion.some((r) => r.seed == null)) {
  console.error('⚠ 存在 seed=null 的局（跑批时未带 --seed-base？）——这些局不参与配对');
}

const bySeed = new Map(champion.map((r) => [r.seed, r]));
const pairs = challenger.filter((r) => r.seed != null && bySeed.has(r.seed)).map((r) => [r, bySeed.get(r.seed)]);
if (!pairs.length) {
  console.error('没有任何共同 seed——两侧必须用同一 --seed-base 才能配对');
  process.exit(1);
}
const pairRate = (pairs.length / Math.min(challenger.length, champion.length)) * 100;
if (pairRate < 100) console.error(`⚠ 配对率 ${pairRate.toFixed(1)}%（${pairs.length}/${Math.min(challenger.length, champion.length)}）——有局没配上，先查两侧 --seed-base/--runs 是否一致`);

// 局面价值标量：撤离/通关 > 死得深 > 死得浅 > 弃局 > 超时（超时=卡死故障，09-26 起严格垫底）
const VALUE = { clear: 4, extract: 3, death: 2, abandon: 0 };
const layerOf = (r) => r.maxLayer ?? 0;
const isTimeout = (r) => r.outcome === 'abandon' && r.stopReason === 'timeout';
const score = (r) => (VALUE[r.outcome] ?? 0) * 100 + layerOf(r) * 10 - (isTimeout(r) ? 100 : 0);

let win = 0;
let loss = 0;
let tie = 0;
const transitions = new Map();
for (const [c, h] of pairs) {
  const d = score(c) - score(h);
  if (d > 0) win += 1;
  else if (d < 0) loss += 1;
    else tie += 1;
  const key = `${h.outcome}→${c.outcome}`;
  transitions.set(key, (transitions.get(key) || 0) + 1);
}

// 符号检验：n=win+loss 次有效比较中，win 次正向 —— 双侧二项精确检验
const n = win + loss;
const binomTail = (k, nn) => {
  let s = 0;
  for (let i = 0; i <= k; i++) {
    let c = 1;
    for (let j = 1; j <= i; j++) c = (c * (nn - j + 1)) / j;
    s += c * Math.pow(0.5, nn);
  }
  return s;
};
const p = n ? Math.min(1, 2 * binomTail(Math.min(win, loss), n)) : 1;

const rate = (rs, f) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
const metrics = (rs) => ({
  extract: `${(rate(rs, (r) => (r.outcome === 'extract' || r.outcome === 'clear') ? 1 : 0) * 100).toFixed(1)}%`,
  avgLayer: rate(rs, layerOf).toFixed(2),
  abandon: `${(rate(rs, (r) => (r.outcome === 'abandon' && !isTimeout(r)) ? 1 : 0) * 100).toFixed(1)}%`,
  timeout: `${(rate(rs, (r) => isTimeout(r) ? 1 : 0) * 100).toFixed(1)}%`,
  avgValue: rate(rs, (r) => r.carriedValue || 0).toFixed(2),
});

const mc = metrics(challenger.map((r) => r));
const mh = metrics(champion);
const abandonRate = parseFloat(mc.abandon);
const timeoutRate = parseFloat(mc.timeout);

console.log(`配对局数 ${pairs.length}（seed ${pairs[0][0].seed}..）${(dupC || dupH) ? ' · ⚠含重复seed' : ''}`);
console.log(`胜负: challenger 赢 ${win} · 输 ${loss} · 平 ${tie}`);
console.log(`符号检验双侧 p = ${p.toFixed(4)}  →  ${p < 0.05 ? '显著' : '不显著'}`);
console.log('');
console.log('指标        challenger   champion');
for (const k of ['撤离率', '均层', '弃局率', '超时率', '均价值']) {
  const key = { 撤离率: 'extract', 均层: 'avgLayer', 弃局率: 'abandon', 超时率: 'timeout', 均价值: 'avgValue' }[k];
  console.log(`${k.padEnd(10)} ${String(mc[key]).padEnd(12)} ${mh[key]}`);
}
console.log('');
console.log('outcome 转移（champion→challenger）:');
for (const [k, v] of [...transitions].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

// ---------- 检验力（09-26 补）：把"证据不足"与"证据为负"分开，早停不错杀 ----------
// 最小可检测赢率：n 次有效比较下，赢多少局才够 p<0.05——低于这根线的效应这个样本量看不见
const minDetect = (() => {
  if (!n) return null;
  for (let k = 0; k <= n; k++) { if (2 * binomTail(k, n) < 0.05) return { k, ratio: (k / n) * 100 }; }
  return null;
})();
console.log('');
if (minDetect) {
  console.log(`检验力: 有效比较 n=${n}（平局 ${tie} 不计入），显著需赢 ≥${minDetect.k}/${n}（${minDetect.ratio.toFixed(0)}%）——低于此效应此样本量看不见`);
}
// 可翻盘判据：剩余平局若全部倒向 challenger，能否达到显著——能=证据不足可加跑，不能=终局丢弃
const remainder = pairs.length - n;
const canFlip = (() => {
  if (!remainder || !loss) return false;
  const winAll = win + remainder;
  return 2 * binomTail(Math.min(loss, winAll), pairs.length) < 0.05;
})();

// 方法论判决
console.log('');
if (timeoutRate > 5) console.log('判决: 毙 —— 超时率 >5%（卡死/慢死螺旋故障，先查因再谈策略，09-26 硬约束）');
else if (abandonRate > 5) console.log('判决: 毙 —— 弃局率 >5% 硬约束违规（不看 p 值）');
else if (p < 0.05 && win > loss) console.log('判决: 通过 —— 显著更优，可挑战 champion（需过 V 验收集）');
else if (p < 0.05 && loss > win) console.log('判决: 毙 —— 显著更劣');
else if (canFlip) console.log(`判决: 证据不足 —— ${remainder} 局平局若全部倒向 challenger 可达显著（p 会 <0.05），可加跑再判；现样本不下结论`);
else console.log('判决: 不显著 —— 假设丢弃（早停，不升级到验收集；加跑也无法翻盘，属终局性否定）');
