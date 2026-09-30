/* ============================================================
 * agent-evolve.mjs —— 进化策略(ES)优化器：学权重向量 W（09-26 架构升级③）
 *
 * 方法（简化 ES/CMA 精神，无梯度——黑盒优化正好配固定 seed 的配对评估）：
 *   种群中心 μ = 当前最优权重 → 对每个数值叶子加 N(0, σ²·|w|²) 扰动 →
 *   每个个体在**固定 seed 底**上跑 --runs 局 → fitness 排序 → 保留 top →
 *   μ ← 精英均值，σ ← σ·decay（探索随代数收窄）
 *
 * fitness = **同 seed 底逐局配对 Δ**（个体 − 基线，per-seed：extract+100/clear+50/
 *   层×10/abandon−200 求差）——09-26 诊断：裸 fitness 的 100 局噪声 ±5pp > 扰动信号，
 *   精英选择在挑噪声；配对把 map/掉落噪声逐局抵消
 *   + 弃局>5% 硬过滤判负（09-26 r1 教训：罚项单独守不住，8%弃局个体 fitness 仍最高）
 *
 * 用法（vite-node）：
 *   npx vite-node game/tools/agent-evolve.mjs --gens 2 --pop 6 --runs 20 --seed-base 77001
 *   npx vite-node game/tools/agent-evolve.mjs --gens 1 --pop 4 --runs 15 --sigma 0.08
 *
 * 产物：output/agent-evolve/best-weights.json（可 --weights 注入回 batch）
 *      + 每代个体明细 + 追加 agent-ledger（exp=e1/e2...）
 *
 * 监督（09-26 补强）：内建 墙钟（spawnSync timeout=局数×35s+引导120s）+ 任何一环
 *   异常即停车归因（exit 3）+ progress.jsonl 实时进度（stdout 被管道缓冲时也能看）。
 *   进程级监督器另开一个进程：node game/tools/agent-supervise.mjs --dir <out 目录>
 *   （盯文件活动停滞/eval 超评/进程消失，异常杀进程+写归因报告）
 *
 * 实验纪律（playbook）：
 *   - 扰动排除根因常数（geo.ban / base.extractLocked）——修根因产物不可被进化腐蚀
 *   - 硬约束双闸：弃局罚项 + >5% 判负过滤（罚项单闸已被 r1 实测击穿）
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
// σ 默认 0.06（09-26 r1 诊断：0.15 的扰动幅度 > 100 局评估噪声能分辨的信号，
// 6 个体里 5 个净变差——步长必须小于信噪比允许的量级）
const SIGMA = parseFloat(argOf('sigma', '0.06')) || 0.06;
const DECAY = parseFloat(argOf('sigma-decay', '0.85')) || 0.85;
const EXPLORE = Math.max(1, parseInt(argOf('explore', '3'), 10) || 3);   // 每代探索者个数
// —— 09-26 训练策略升级：分簇进化 + σ 自适应 ——
// --cluster auto=按代轮换目标簇（默认）| all=全空间均匀扰动（旧行为）| 簇名=固定该簇
const CLUSTER = argOf('cluster', 'auto');
const CLUSTER_KEYS = Object.keys(DEFAULT_WEIGHTS);
if (CLUSTER !== 'auto' && CLUSTER !== 'all' && !CLUSTER_KEYS.includes(CLUSTER)) {
  console.error(`[evolve] --cluster 必须是 auto | all | ${CLUSTER_KEYS.join('/')}`);
  process.exit(2);
}
// σ 自适应（1/5 成功法则）：合规改善率 >20% → 步长放大 SIGMA_GROW；否则收窄 DECAY。
// 替代固定 0.85 衰减——信号强时别急着收窄，信号弱时果断收敛。夹 [SIGMA_MIN, SIGMA_MAX] 防爆
const SIGMA_GROW = parseFloat(argOf('sigma-grow', '1.18')) || 1.18;
const SIGMA_MIN = parseFloat(argOf('sigma-min', '0.01')) || 0.01;
const SIGMA_MAX = parseFloat(argOf('sigma-max', '0.25')) || 0.25;
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

function perturb(weights, sigma, path = '', scope = null) {
  const out = {};
  for (const [k, v] of Object.entries(weights)) {
    const p = path ? `${path}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = perturb(v, sigma, p, scope);
    } else if (typeof v === 'number') {
      // 分簇模式（09-26 训练策略升级）：只扰动目标簇叶子，其余保持中心值——
      // 58 维空间 pop 4-6 全均匀扰动的采样密度太稀（r1 诊断：6 扰动 5 降），
      // 聚焦单簇把同等预算的采样密度提高一个量级
      if (scope && !p.startsWith(scope + '.')) { out[k] = v; continue; }
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

// ---------- 配对 fitness（09-26 诊断）----------
// 根因：个体各跑各的裸撤离率排序，100 局噪声 ±5pp > 扰动真实效应 → 精英选择在挑噪声
// （r1 实证：fitness 最高的 i3 是拿弃局 8% 换的假优势）。改同 seed 底逐局配对：
// 个体与基线同地图同掉落，per-seed 分值逐局相减，map/战斗噪声抵消。
// 分值口径（消融原则，一次只改一个变量）：
//   extract 口径（旧行为）：extract +100 / clear +50 / 层×10 / abandon -200 / timeout -300
//   layers 口径（09-26 老板定：先层数后撤离）：层×40 主导，撤离/通关 +40 同价——
//     旧口径 extract+100 >> 层×10 是「层推不动」的信号失衡：深一层收益太小，精英
//     选择永远偏向撤离率微调。层主导后深一层 = 撤离同价（撤离本就发生在深层）
// timeout 罚两口径共用：弃局是策略止损（-200），超时是卡死故障（-300）
const OBJECTIVE = argOf('objective', 'extract');
if (OBJECTIVE !== 'extract' && OBJECTIVE !== 'layers') {
  console.error(`[evolve] --objective 必须是 extract | layers`);
  process.exit(2);
}
const seedScore = (r) => {
  let s;
  if (OBJECTIVE === 'layers') {
    s = (r.maxLayer || 0) * 40;
    if (r.outcome === 'extract' || r.outcome === 'clear') s += 40;
  } else {
    s = (r.maxLayer || 0) * 10;
    if (r.outcome === 'extract') s += 100;
    else if (r.outcome === 'clear') s += 50;
  }
  if (r.outcome === 'abandon') s -= (r.stopReason === 'timeout' ? 300 : 200);
  return s;
};
let BASE_SEEDS = null;   // 基线逐局分值表（g0 评估时建立，个体全部对它配对）
function readSeedScores(dir) {
  try {
    const m = new Map();
    for (const line of readFileSync(resolve(dir, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean)) {
      const r = JSON.parse(line);
      if (r.seed != null) m.set(r.seed, seedScore(r));
    }
    return m.size ? m : null;
  } catch { return null; }
}
// ---------- 评估：跑一次 batch 并读 fitness ----------
// 异常停车（09-26 老板要的监督层）：批跑挂死有墙钟兜底，任何一环不正常
// 就地打印归因并退出整个训练——宁可停，不要带伤跑完一整轮再回头查
const BUDGET_MS = () => (RUNS * 35 + 120) * 1000;   // 单局35s预算(含30s超时余量)+引导120s
function abortEval(tag, reason, t0, res, extra = '') {
  console.error(`[evolve] ✗ 评估 ${tag} 异常停车: ${reason}`);
  console.error(`  耗时 ${Math.round((Date.now() - t0) / 1000)}s / 预算 ${BUDGET_MS() / 1000}s`);
  if (res?.error) console.error(`  spawn 错误: ${res.error.code || res.error.message} killed=${res.killed}`);
  const tail = (s) => (s || '').split('\n').filter(Boolean).slice(-8).join('\n    ');
  if (res?.stderr) console.error(`  stderr 尾:\n    ${tail(res.stderr)}`);
  if (res?.stdout) console.error(`  stdout 尾:\n    ${tail(res.stdout)}`);
  if (extra) console.error(`  ${extra}`);
  try { appendFileSync(resolve(OUT, 'progress.jsonl'), JSON.stringify({ ts: new Date().toISOString(), tag, phase: 'abort', reason }) + '\n'); } catch { /* 忽略 */ }
  console.error('[evolve] 已停车——先归因再重启（产物在，可复跑未完成的代）');
  process.exit(3);
}
function evaluate(weights, tag) {
  const dir = resolve(OUT, `eval-${tag}`);
  const wFile = resolve(OUT, `w-${tag}.json`);
  writeFileSync(wFile, JSON.stringify(weights), 'utf8');
  const t0 = Date.now();
  try { appendFileSync(resolve(OUT, 'progress.jsonl'), JSON.stringify({ ts: new Date().toISOString(), tag, phase: 'start' }) + '\n'); } catch { /* 忽略 */ }
  const res = spawnSync(process.execPath, [
    resolve(process.cwd(), 'node_modules/vite-node/vite-node.mjs'),
    resolve(process.cwd(), 'game/tools/agent-batch.mjs'),
    '--runs', String(RUNS), '--policy', 'strategic',
    '--seed-base', String(SEED_BASE), '--timeout', '30',
    '--weights', wFile, '--out', dir,
  ], { encoding: 'utf8', cwd: process.cwd(), timeout: BUDGET_MS(), maxBuffer: 64 * 1024 * 1024 });
  if (res.error) abortEval(tag, res.error.code === 'ETIMEDOUT' ? '批跑超墙钟（挂死/慢死螺旋）' : '批跑 spawn 失败', t0, res);
  const summaryPath = resolve(dir, 'summary.json');
  if (!existsSync(summaryPath)) abortEval(tag, '批跑结束但没写出 summary.json', t0, res, `产物目录: ${dir}`);
  let s;
  try { s = JSON.parse(readFileSync(summaryPath, 'utf8')); }
  catch (e) { abortEval(tag, `summary.json 解析失败: ${e.message}`, t0, res); }
  const o = s.overall;
  // 超时局独立口径（09-26）：timeout 是卡死故障不是策略弃局——弃局率里剔除、
  // 单独按 −300/局 罚（seedScore 同款），旧 summary 无 timeoutRuns 字段按 0 兼容
  const timeoutRate = ((s.meta && s.meta.timeoutRuns) || 0) / o.runs;
  const abandonRate = ((o.outcomes.abandon || 0) / o.runs) - timeoutRate;
  // 注意 extractRate/clearRate 是百分数（60 = 60%），layers 口径要 /100 才与层×40 同量纲
  const fitnessRaw = OBJECTIVE === 'layers'
    ? o.avgLayer * 40 + (o.extractRate / 100) * 40 + (o.clearRate / 100) * 40 - abandonRate * 200 - timeoutRate * 300
    : o.extractRate * 100 + o.avgLayer * 10 + o.clearRate * 50 - abandonRate * 200 - timeoutRate * 300;
  const candSeeds = readSeedScores(dir);
  let fitness = fitnessRaw;
  let paired = null;
  if (tag === 'g0' || !BASE_SEEDS) {
    BASE_SEEDS = candSeeds;          // 首个评估（g0=基线 μ）建立配对参照
    fitness = 0;                     // 自己对自己 Δ=0；后续个体全部朝这个基准比
  } else if (candSeeds) {
    let delta = 0, win = 0, loss = 0, tie = 0, skip = 0;
    for (const [seed, bs] of BASE_SEEDS) {
      if (!candSeeds.has(seed)) { skip++; continue; }
      const d = candSeeds.get(seed) - bs;
      delta += d;
      if (d > 0) win++; else if (d < 0) loss++; else tie++;
    }
    fitness = delta;
    paired = { win, loss, tie, skip };
  }
  const r = {
    fitness, fitnessRaw, paired,
    extract: o.extractRate, clear: o.clearRate,
    avgLayer: o.avgLayer, abandon: Math.round(abandonRate * 1000) / 10,
    timeout: Math.round(timeoutRate * 1000) / 10,
    // 硬约束判负标记（09-26 r1 实测：罚项单独守不住——弃局 8% 的个体 fitness 仍全场最高
    // 并当选 best）。>5% 即失去资格：不进精英、不当 best、不许 steering μ。
    // 超时率并入硬约束（09-26）：卡死是比弃局更重的故障信号
    hard: abandonRate > 0.05 || timeoutRate > 0.05,
    avgRunMs: s.meta.avgRunMs, dir, wFile,
  };
  try { appendFileSync(resolve(OUT, 'progress.jsonl'), JSON.stringify({ ts: new Date().toISOString(), tag, phase: 'done', ms: Date.now() - t0, fitness, fitnessRaw, paired, extract: r.extract, abandon: r.abandon }) + '\n'); } catch { /* 忽略 */ }
  return r;
}

// ---------- 主循环 ----------
console.log(`[evolve] gens=${GENS} pop=${POP} runs/run=${RUNS} seedBase=${SEED_BASE} σ=${SIGMA} 目标=${OBJECTIVE} 簇=${CLUSTER}${CLUSTER === 'auto' ? `（${CLUSTER_KEYS.join('/')} 轮换）` : ''}`);
let mu = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS));
let sigma = SIGMA;
const history = [];

// 代0：基线（μ 本体）
const base = evaluate(mu, 'g0');
console.log(`[evolve] g0 baseline raw=${base.fitnessRaw?.toFixed(1)}（配对基准Δ=0，配对局数=${BASE_SEEDS ? BASE_SEEDS.size : '?'}） 撤离=${base.extract}% 均层=${base.avgLayer} 弃=${base.abandon}%${base.timeout ? ` 超时=${base.timeout}%` : ''}`);
let best = { w: mu, ...base, gen: 0 };

for (let g = 1; g <= GENS; g++) {
  const candidates = [];
  // 精英直通（elitism：上一代最优参与本代竞争，防退化）
  if (g > 1) candidates.push({ tag: `g${g}-elite`, w: best.w, elite: true });
  // 分簇进化（09-26）：auto=按代轮换目标簇；all=全空间均匀扰动（旧行为）；簇名=固定
  const targetCluster = CLUSTER === 'all' ? null
    : CLUSTER === 'auto' ? CLUSTER_KEYS[(g - 1) % CLUSTER_KEYS.length]
    : CLUSTER;
  const nPerturb = POP - candidates.length;
  const nFocus = targetCluster ? Math.max(1, nPerturb - EXPLORE) : nPerturb;
  for (let i = 0; i < nFocus; i++) {
    candidates.push({ tag: `g${g}-i${candidates.length}`, w: perturb(mu, sigma, '', targetCluster), cluster: targetCluster });
  }
  for (let i = 0; i < nPerturb - nFocus; i++) {
    candidates.push({ tag: `g${g}-i${candidates.length}`, w: perturb(mu, sigma), cluster: null });
  }
  if (g === 1) console.log(`[evolve] 第1代目标簇=${targetCluster || '全空间'}（聚焦${nFocus}+探索${nPerturb - nFocus}）`);
  const results = candidates.map((c) => {
    const r = evaluate(c.w, c.tag);
    const pw = r.paired ? ` 配对赢${r.paired.win}/输${r.paired.loss}/平${r.paired.tie}${r.paired.skip ? `/弃${r.paired.skip}` : ''}` : '';
    console.log(`[evolve] ${c.tag} Δ配对=${r.fitness?.toFixed(1)} raw=${r.fitnessRaw?.toFixed(1)}${pw} 撤离=${r.extract}% 均层=${r.avgLayer} 弃=${r.abandon}%${r.timeout ? ` 超时=${r.timeout}%` : ''}${r.hard ? ' ⚠硬约束' : ''}`);
    return { ...c, ...r };
  }).sort((a, b) => b.fitness - a.fitness);

  history.push({ gen: g, sigma, cluster: targetCluster || 'all', results: results.map(r => ({ tag: r.tag, fitness: r.fitness, extract: r.extract, abandon: r.abandon, hard: !!r.hard })) });
  // 硬约束过滤在罚项之上再加一道闸（playbook：弃局>5% 直接毙，不看 fitness）
  const compliant = results.filter(r => Number.isFinite(r.fitness) && !r.hard);
  if (!compliant.length) { console.log(`[evolve] 第${g}代无合规个体（全部弃局>5%），停止`); break; }
  const elite = compliant.slice(0, 2);
  if (elite[0].fitness > best.fitness) best = { w: elite[0].w, ...elite[0], gen: g };
  // 精英均值 → 新中心（带探索者的多样性信号，仅收窄不跳变）
  mu = JSON.parse(JSON.stringify(elite[0].w));
  if (elite.length > 1) {
    for (const [k, v] of Object.entries(elite[1].w)) {
      if (v && typeof v === 'object') Object.assign(mu[k], v);
      else if (typeof v === 'number') mu[k] = (mu[k] + v) / 2;
    }
  }
  // σ 自适应（1/5 成功法则，09-26 替代固定 0.85 衰减）：合规个体改善率 >20% 说明
  // 当前区域还有信号，放大步长往深探；≤20% 信号弱，按 DECAY 收窄收敛
  const improved = compliant.filter(r => r.fitness > 0).length;
  const successRate = improved / Math.max(1, compliant.length);
  const grow = successRate > 0.2;
  const prevSigma = sigma;
  sigma = Math.min(SIGMA_MAX, Math.max(SIGMA_MIN, sigma * (grow ? SIGMA_GROW : DECAY)));
  console.log(`[evolve] 第${g}代最优 fitness=${elite[0].fitness.toFixed(1)}（best累计=${best.fitness.toFixed(1)}）σ ${prevSigma.toFixed(3)}→${sigma.toFixed(3)}（成功率${Math.round(successRate * 100)}% → ${grow ? '放大' : '收窄'}）`);
}

// ---------- 产物 ----------
const bestDiff = diffOnly(DEFAULT_WEIGHTS, best.w);
writeFileSync(resolve(OUT, 'best-weights.json'), JSON.stringify(bestDiff, null, 2), 'utf8');
writeFileSync(resolve(OUT, 'history.json'), JSON.stringify(history, null, 2), 'utf8');
console.log(`[evolve] 最优: gen=${best.gen} Δ配对=${best.fitness?.toFixed(1)} raw=${best.fitnessRaw?.toFixed(1)} 撤离=${best.extract}% 均层=${best.avgLayer} 弃=${best.abandon}%${best.timeout ? ` 超时=${best.timeout}%` : ''}${best.hard ? ' ⚠违约束(弃局/超时>5%)不可回注' : ''}`);
console.log(`[evolve] best-weights.json 改动叶子数=${Object.keys(bestDiff).length ? JSON.stringify(bestDiff).length : 0}B → ${resolve(OUT, 'best-weights.json')}`);

// 台账（--ledger-tag smoke 时 tag=smoke：冒烟/调试跑不污染正式台账，ledger list 可过滤）
const LEDGER_TAG = argOf('ledger-tag', '');
try {
  appendFileSync(resolve(process.cwd(), 'output/agent-ledger.jsonl'),
    JSON.stringify({
      ts: new Date().toISOString(), exp: `e${GENS}-${Date.now().toString(36)}`, hypothesis: `ES进化W·${OBJECTIVE}目标（pop${POP}×${GENS}代×${RUNS}局，σ${SIGMA}→${sigma.toFixed(3)}，簇=${CLUSTER}）`,
      seedBase: SEED_BASE, split: 'tuning', policy: 'strategic', runs: RUNS,
      metrics: { extract: best.extract, avgLayer: best.avgLayer, abandon: best.abandon, timeout: best.timeout, avgRunMs: best.avgRunMs },
      p: null, verdict: (best.fitness > base.fitness && !best.hard) ? 'hold' : 'discard',
      tag: LEDGER_TAG || undefined,
      note: `baseline raw=${base.fitnessRaw?.toFixed(1)} → best Δ配对=${best.fitness?.toFixed(1)} raw=${best.fitnessRaw?.toFixed(1)}${best.hard ? '（best 违弃局硬约束，判 discard）' : ''}；需 T配对+V终验才 promote`,
    }) + '\n');
} catch { /* 台账失败不阻塞 */ }

// 产物与台账全部落盘后强制退出：产物写完靠事件循环排空自然退出时，vite-node/jsdom
// 的残留句柄会挂住进程（09-26 实证：主流程跑完后零 CPU 挂 60 分钟，supervise 只能
// 按 STALL 收尸）。此处逻辑已终结，直接退，不等待任何句柄。
process.exit(0);
