/* ============================================================
 * agent-evolve.mjs —— 进化策略(ES)优化器：学权重向量 W（09-26 架构升级③）
 *
 * 方法（简化 ES/CMA 精神，无梯度——黑盒优化正好配固定 seed 的配对评估）：
 *   种群中心 μ = 当前最优权重 → 对每个数值叶子加 N(0, σ²·|w|²) 扰动 →
 *   每个个体在**固定 seed 底**上跑 --runs 局 → fitness 排序 → 保留 top →
 *   μ ← 精英均值，σ ← σ·decay（探索随代数收窄）
 *
 * fitness = 撤离率×100 + 均层×10 + 通局×50 − 弃局率×200（弃局重罚=硬约束内化）
 *
 * 用法（vite-node）：
 *   npx vite-node game/tools/agent-evolve.mjs --gens 2 --pop 6 --runs 20 --seed-base 77001
 *   npx vite-node game/tools/agent-evolve.mjs --gens 1 --pop 4 --runs 15 --sigma 0.08
 *
 * 产物：output/agent-evolve/best-weights.json（可 --weights 注入回 batch）
 *      + 每代个体明细 + 追加 agent-ledger（exp=e1/e2...）
 *
 * 实验纪律（playbook）：
 *   - 扰动排除根因常数（geo.ban / base.extractLocked）——修根因产物不可被进化腐蚀
 *   - fitness 内置弃局重罚 → 硬约束不靠人守
 *   - 同一 seed 底（配对）→ 个体间差异=策略差异，噪声最小
 * ============================================================ */
import { mkdirSync, writeFileSync, readFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_WEIGHTS } from '../src/agent/agent.weights.js';
import { SeededRandomService } from '../src/core/random.js';

// ---------- CLI ----------
const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const GENS = Math.max(1, parseInt(argOf('gens', '2'), 10) || 2);
const POP = Math.max(4, parseInt(argOf('pop', '6'), 10) || 6);
const RUNS = Math.max(5, parseInt(argOf('runs', '20'), 10) || 20);
const SEED_BASE = parseInt(argOf('seed-base', '77001'), 10) || 77001;
const SIGMA = parseFloat(argOf('sigma', '0.15')) || 0.15;
const DECAY = parseFloat(argOf('sigma-decay', '0.85')) || 0.85;
const EXPLORE = Math.max(1, parseInt(argOf('explore', '3'), 10) || 3);   // 每代探索者个数
const OUT = resolve(process.cwd(), argOf('out', 'output/agent-evolve/'));
mkdirSync(OUT, { recursive: true });

// 扰动禁区：修根因产物（结构性常数）不参与进化
const FROZEN_KEYS = new Set(['geo.ban', 'base.extractLocked']);
// 扰动幅度按叶子量级缩放；0 值给一个绝对步长避免永远不动
const step = (path, v) => FROZEN_KEYS.has(path) ? 0 : (Math.abs(v) > 1 ? Math.abs(v) : 1);

const rng = new SeededRandomService(parseInt(argOf('evolve-seed', '20260926'), 10) || 20260926);
const gauss = () => {
  const u = Math.max(1e-12, rng.random('evolve'));
  const v = rng.random('evolve');
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

function perturb(weights, sigma, path = '') {
  const out = {};
  for (const [k, v] of Object.entries(weights)) {
    const p = path ? `${path}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = perturb(v, sigma, p);
    } else if (typeof v === 'number') {
      out[k] = v + gauss() * sigma * step(p, v);
    } else out[k] = v;
  }
  return out;
}
function diffOnly(base, cand, path = '') {
  const out = {};
  for (const [k, v] of Object.entries(cand)) {
    const p = path ? `${path}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const d = diffOnly(base[k] || {}, v, p);
      if (Object.keys(d).length) out[k] = d;
    } else if (v !== base[k]) out[k] = v;
  }
  return out;
}

// ---------- 评估：跑一次 batch 并读 fitness ----------
function evaluate(weights, tag) {
  const dir = resolve(OUT, `eval-${tag}`);
  const wFile = resolve(OUT, `w-${tag}.json`);
  writeFileSync(wFile, JSON.stringify(weights), 'utf8');
  const res = spawnSync(process.execPath, [
    resolve(process.cwd(), 'node_modules/vite-node/vite-node.mjs'),
    resolve(process.cwd(), 'game/tools/agent-batch.mjs'),
    '--runs', String(RUNS), '--policy', 'strategic',
    '--seed-base', String(SEED_BASE), '--timeout', '30',
    '--weights', wFile, '--out', dir,
  ], { encoding: 'utf8', cwd: process.cwd() });
  const summaryPath = resolve(dir, 'summary.json');
  if (!existsSync(summaryPath)) {
    console.error(`[evolve] ${tag} 批跑失败:`, (res.stderr || res.stdout || '').slice(-400));
    return { fitness: -1e9 };
  }
  const s = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const o = s.overall;
  const abandonRate = (o.outcomes.abandon || 0) / o.runs;
  const fitness = o.extractRate * 100 + o.avgLayer * 10 + o.clearRate * 50 - abandonRate * 200;
  return {
    fitness, extract: o.extractRate, clear: o.clearRate,
    avgLayer: o.avgLayer, abandon: Math.round(abandonRate * 1000) / 10,
    avgRunMs: s.meta.avgRunMs, dir, wFile,
  };
}

// ---------- 主循环 ----------
console.log(`[evolve] gens=${GENS} pop=${POP} runs/run=${RUNS} seedBase=${SEED_BASE} σ=${SIGMA} explore=${EXPLORE}/gen`);
let mu = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS));
let sigma = SIGMA;
const history = [];

// 代0：基线（μ 本体）
const base = evaluate(mu, 'g0');
console.log(`[evolve] g0 baseline fitness=${base.fitness.toFixed(1)} 撤离=${base.extract}% 均层=${base.avgLayer} 弃=${base.abandon}%`);
let best = { w: mu, ...base, gen: 0 };

for (let g = 1; g <= GENS; g++) {
  const candidates = [];
  // 精英直通（elitism：上一代最优参与本代竞争，防退化）
  if (g > 1) candidates.push({ tag: `g${g}-elite`, w: best.w, elite: true });
  for (let i = candidates.length; i < POP; i++) {
    candidates.push({ tag: `g${g}-i${i}`, w: perturb(mu, sigma) });
  }
  const results = candidates.map((c) => {
    const r = evaluate(c.w, c.tag);
    console.log(`[evolve] ${c.tag} fitness=${r.fitness?.toFixed(1)} 撤离=${r.extract}% 均层=${r.avgLayer} 弃=${r.abandon}%`);
    return { ...c, ...r };
  }).sort((a, b) => b.fitness - a.fitness);

  const elite = results.filter(r => Number.isFinite(r.fitness)).slice(0, 2);
  history.push({ gen: g, sigma, results: results.map(r => ({ tag: r.tag, fitness: r.fitness, extract: r.extract, abandon: r.abandon })) });
  if (!elite.length) { console.log(`[evolve] 第${g}代全失败，停止`); break; }
  if (elite[0].fitness > best.fitness) best = { w: elite[0].w, ...elite[0], gen: g };
  // 精英均值 → 新中心（带探索者的多样性信号，仅收窄不跳变）
  mu = JSON.parse(JSON.stringify(elite[0].w));
  if (elite.length > 1) {
    for (const [k, v] of Object.entries(elite[1].w)) {
      if (v && typeof v === 'object') Object.assign(mu[k], v);
      else if (typeof v === 'number') mu[k] = (mu[k] + v) / 2;
    }
  }
  sigma *= DECAY;
  console.log(`[evolve] 第${g}代最优 fitness=${elite[0].fitness.toFixed(1)}（best累计=${best.fitness.toFixed(1)}）σ→${sigma.toFixed(3)}`);
}

// ---------- 产物 ----------
const bestDiff = diffOnly(DEFAULT_WEIGHTS, best.w);
writeFileSync(resolve(OUT, 'best-weights.json'), JSON.stringify(bestDiff, null, 2), 'utf8');
writeFileSync(resolve(OUT, 'history.json'), JSON.stringify(history, null, 2), 'utf8');
console.log(`[evolve] 最优: gen=${best.gen} fitness=${best.fitness?.toFixed(1)} 撤离=${best.extract}% 均层=${best.avgLayer} 弃=${best.abandon}%`);
console.log(`[evolve] best-weights.json 改动叶子数=${Object.keys(bestDiff).length ? JSON.stringify(bestDiff).length : 0}B → ${resolve(OUT, 'best-weights.json')}`);

// 台账
try {
  appendFileSync(resolve(process.cwd(), 'output/agent-ledger.jsonl'),
    JSON.stringify({
      ts: new Date().toISOString(), exp: `e${GENS}`, hypothesis: `ES进化W（pop${POP}×${GENS}代×${RUNS}局，σ${SIGMA}→${sigma.toFixed(3)}）`,
      seedBase: SEED_BASE, split: 'tuning', policy: 'strategic', runs: RUNS,
      metrics: { extract: best.extract, avgLayer: best.avgLayer, abandon: best.abandon, avgRunMs: best.avgRunMs },
      p: null, verdict: best.fitness > base.fitness ? 'candidate' : 'discard',
      note: `baseline fitness=${base.fitness?.toFixed(1)} → best=${best.fitness?.toFixed(1)}；需 T配对+V终验才 promote`,
    }) + '\n');
} catch { /* 台账失败不阻塞 */ }
