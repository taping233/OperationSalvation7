/* ============================================================
 * agent-supervise.mjs —— 训练监督器（09-26 老板要的异常停车器）
 *
 * 盯两样：①产物目录文件活动（停滞 = 事件循环卡死/批跑挂起）
 *        ②目标进程存活（消失但无产物 = 崩溃/被杀）
 * 异常 → 杀进程树 + 现场取证写 <dir>/SUPERVISOR-<时间戳>.log + exit 1
 *
 * 用法：
 *   node game/tools/agent-supervise.mjs --dir output/agent-evolve-r1 \
 *     [--pattern agent-evolve.mjs] [--stall 480] [--eval-max 900] \
 *     [--max 3600] [--interval 30] [--grace 120] [--kill 0]
 *
 * 判定：
 *   STALL         训练进程在、但产物目录 stall 秒无任何文件活动
 *   EVAL-OVERRUN  某个 eval-* 目录超 eval-max 秒仍未出 summary.json
 *                 （防"慢死螺旋"：单局 30s 超时连环触发、活动仍在但永不结束）
 *   VANISHED      训练进程消失但没有本监督窗口新写且有效的最终权重/历史产物
 *   MAX-TIME      超过总时长 max
 *
 * 进程匹配锚点 = 产物目录名（--key），且 cmdline 必须同时命中
 * --pattern 或 agent-batch.mjs，且只认 node.exe 进程（09-26 收窄：bash/npx/cmd
 * 包装壳不再计入，训练结束后的壳残留不会让 alive 恒真）——不会误杀别人跑的同名工具。
 * 异常杀进程用 taskkill /T 杀整棵树（Stop-Process 单杀会留孤儿 batch 继续跑）。
 * ============================================================ */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DIR_ARG = argOf('dir', '');
if (!DIR_ARG) { console.error('[supervise] 必填 --dir <产物目录>'); process.exit(2); }
const DIR = resolve(process.cwd(), DIR_ARG);
const PATTERN = argOf('pattern', 'agent-evolve.mjs');
const KEY = argOf('key', DIR.split(/[\\/]/).pop());
const STALL = (parseFloat(argOf('stall', '480')) || 480) * 1000;
const EVAL_MAX = (parseFloat(argOf('eval-max', '900')) || 900) * 1000;
const MAX = (parseFloat(argOf('max', '3600')) || 3600) * 1000;
const INTERVAL = (parseFloat(argOf('interval', '30')) || 30) * 1000;
const GRACE = (parseFloat(argOf('grace', '120')) || 120) * 1000;
const KILL = argOf('kill', '1') !== '0';
// 进程匹配串要进 PowerShell 单引号字面量，只允许安全字符（防注入/防转义炸）
for (const [name, v] of [['pattern', PATTERN], ['key', KEY]]) {
  if (!/^[\w.\-]+$/.test(v)) { console.error(`[supervise] --${name} 含非法字符: ${v}`); process.exit(2); }
}

const start = Date.now();
const evalSeen = new Map();   // evalDir 目录 → 首次发现无 summary 的时刻
const beats = [];             // 心跳历史（进归因报告）

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = (d = new Date()) => d.toISOString().replace('T', ' ').slice(0, 19);

function walk(dir) {
  let newest = 0, count = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let ents; try { ents = readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const p = join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else { count++; try { const m = statSync(p).mtimeMs; if (m > newest) newest = m; } catch { /* 忽略 */ } }
    }
  }
  return { newest, count };
}

function psProcs() {
  // 命中条件：node.exe 进程 且 cmdline 含 (pattern 或 批跑器) 且含产物目录锚点。
  // 09-26 收窄：以前按 cmdline 子串匹配，bash→npx→cmd→vite-node 一条链每层算一个
  // "进程"（实测一条训练链被数成 9）——训练正常结束后残留的包装壳让 alive 恒真，
  // VANISHED 判定永远触发不了。只认 node.exe：包装壳退出不影响存活判定。
  // 排除自己（supervise 也是 node）+ 排除含 agent-supervise.mjs 的进程——supervise 的
  // cmdline 带着 '--pattern agent-evolve.mjs' 字样会自匹配；枚举用的 powershell 进程
  // 被 Name=node.exe 条件天然排除。
  const script = [
    '$ErrorActionPreference="Stop"',
    `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and ($_.CommandLine -like '*${PATTERN}*' -or $_.CommandLine -like '*agent-batch.mjs*') -and $_.CommandLine -like '*${KEY}*' -and $_.CommandLine -notlike '*agent-supervise.mjs*' -and $_.ProcessId -ne ${process.pid} } | ForEach-Object { [PSCustomObject]@{ pid=$_.ProcessId; cmd=$_.CommandLine.Substring(0,[Math]::Min(200,$_.CommandLine.Length)) } } | ConvertTo-Json -Compress`,
  ].join('\n');
  try {
    const res = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 20000 });
    if (res.error) throw res.error;
    if (res.status !== 0 || res.signal) {
      throw new Error(`PowerShell 查询失败（status=${res.status} signal=${res.signal || 'none'}）`);
    }
    const out = (res.stdout || '').trim();
    if (!out) return [];
    const j = JSON.parse(out);
    return Array.isArray(j) ? j : [j];
  } catch (e) {
    console.error(`[supervise] 进程枚举失败(下次重试): ${e.message}`);
    return null;   // null = 查询失败，不当成"没进程"
  }
}

// evolve only writes these two files after its generation loop. Without a run ID,
// this proves fresh final artifacts in this supervision window, not their producer.
// Equal/older timestamps are inconclusive and are rejected conservatively.
function freshFinalArtifacts(now) {
  try {
    const weightsPath = join(DIR, 'best-weights.json');
    const historyPath = join(DIR, 'history.json');
    for (const file of [weightsPath, historyPath]) {
      const stamp = statSync(file).mtimeMs;
      if (!Number.isFinite(stamp) || stamp <= start || stamp > now) return false;
    }
    const weights = JSON.parse(readFileSync(weightsPath, 'utf8'));
    const validWeights = value => value !== null && typeof value === 'object' && !Array.isArray(value)
      && Object.values(value).every(leaf => typeof leaf === 'number' ? Number.isFinite(leaf) : validWeights(leaf));
    if (!validWeights(weights)) return false; // An empty diff is a valid unchanged baseline.
    const history = JSON.parse(readFileSync(historyPath, 'utf8'));
    return Array.isArray(history) && history.length > 0 && history.every(entry =>
      Number.isInteger(entry?.gen) && entry.gen > 0 && Number.isFinite(entry.sigma)
      && typeof entry.cluster === 'string' && Array.isArray(entry.results) && entry.results.length > 0
      && entry.results.every(result => typeof result?.tag === 'string' && Number.isFinite(result.fitness)
        && Number.isFinite(result.extract) && Number.isFinite(result.abandon) && typeof result.hard === 'boolean'));
  } catch { return false; }
}

function tailFile(p, n = 30) {
  try {
    const lines = readFileSync(p, 'utf8').split('\n');
    return lines.slice(-n).join('\n');
  } catch { return '(无)'; }
}

function fail(reason, detail) {
  console.error(`[supervise] ✗ 异常停车 ${reason}: ${detail}`);
  const procs = psProcs();
  const w = walk(DIR);
  const evals = [];
  try {
    for (const name of readdirSync(DIR)) {
      if (!name.startsWith('eval-')) continue;
      const d = join(DIR, name);
      const hasSummary = existsSync(join(d, 'summary.json'));
      const probe = join(d, 'probe.log');
      const errors = join(d, 'errors.log');
      evals.push({ name, hasSummary, probeTail: existsSync(probe) ? tailFile(probe, 25) : '(无)', errTail: existsSync(errors) ? tailFile(errors, 25) : '(无)' });
    }
  } catch { /* 忽略 */ }
  const report = [
    `# 训练监督器归因报告  ${ts()}`,
    `- 判定: ${reason} — ${detail}`,
    `- 启动于 ${ts(new Date(start))}，已运行 ${Math.round((Date.now() - start) / 1000)}s`,
    `- 产物目录: ${DIR}（文件 ${w.count} 个，最新活动 ${w.newest ? ts(new Date(w.newest)) : '无'}）`,
    `- 匹配锚点 key=${KEY} pattern=${PATTERN}；kill=${KILL}`,
    ``,
    `## 心跳历史（最近10条）`,
    beats.slice(-10).join('\n') || '(无)',
    ``,
    `## 进程现场${procs === null ? '（枚举失败）' : ''}`,
    procs && procs.length ? procs.map((p) => `- pid=${p.pid} ${p.cmd}`).join('\n') : '(无)',
    ``,
    `## eval 目录`,
    ...evals.map((e) => `- ${e.name} summary=${e.hasSummary ? '有' : '无'}`),
    ``,
    ...evals.flatMap((e) => [
      `### ${e.name} probe.log 尾`, '```', e.probeTail, '```',
      ...(e.errTail !== '(无)' ? [`### ${e.name} errors.log 尾`, '```', e.errTail, '```'] : []),
    ]),
  ].join('\n');
  const reportPath = join(DIR, `SUPERVISOR-${Date.now().toString(36)}.log`);
  try { writeFileSync(reportPath, report, 'utf8'); } catch { /* 忽略 */ }
  let killed = 0;
  if (KILL && procs) {
    for (const p of procs) {
      // taskkill /T 杀整棵进程树（vite-node→batch 子进程链一锅端）：
      // Stop-Process 单杀父进程，子 batch 会成孤儿继续跑——等于没杀干净
      const r = spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { encoding: 'utf8', timeout: 15000 });
      if (!r.error && r.status === 0 && !r.signal) killed++;
    }
  }
  console.error(`[supervise] 已杀进程 ${killed}/${procs ? procs.length : '?'}；归因报告: ${reportPath}`);
  process.exit(1);
}

console.log(`[supervise] 盯 ${DIR} | pattern=${PATTERN} key=${KEY} | 停滞${STALL / 1000}s 超评${EVAL_MAX / 1000}s 总限${MAX / 1000}s`);

while (true) {
  const now = Date.now();
  if (now - start > MAX) fail('MAX-TIME', `总时长超过 ${MAX / 1000}s，训练仍未结束`);

  const w = walk(DIR);
  const procs = psProcs();       // null = 枚举失败，本轮跳过存活判定
  const alive = procs ? procs.length > 0 : true;
  const lastAct = w.newest || start;
  const beat = `${ts()} 文件=${w.count} 最新活动=${Math.round((now - lastAct) / 1000)}s前 进程=${procs === null ? '?' : procs.length}`;
  beats.push(beat);
  console.log(`[supervise] ${beat}`);

  // eval 超评检测（无 summary 的 eval 目录按首次发现时刻计时）
  try {
    const seen = new Set();
    for (const name of readdirSync(DIR)) {
      if (!name.startsWith('eval-')) continue;
      const d = join(DIR, name);
      if (existsSync(join(d, 'summary.json'))) { evalSeen.delete(d); continue; }
      seen.add(d);
      if (!evalSeen.has(d)) evalSeen.set(d, now);
      const age = now - evalSeen.get(d);
      if (age > EVAL_MAX) fail('EVAL-OVERRUN', `eval 目录 ${name} 已 ${Math.round(age / 1000)}s 未出 summary.json（正常单评估约 ${Math.round(EVAL_MAX / 3000)}s 内）`);
    }
    for (const d of [...evalSeen.keys()]) if (!seen.has(d)) evalSeen.delete(d);
  } catch { /* dir 可能瞬时不存在 */ }

  if (alive) {
    if (now - lastAct > STALL) fail('STALL', `训练进程在，但产物目录已 ${Math.round((now - lastAct) / 1000)}s 无文件活动（事件循环卡死/批跑挂起嫌疑）`);
  } else if (now - start < GRACE) {
    // 启动宽限期内没进程 = 尚未起来，继续等
  } else if (freshFinalArtifacts(now)) {
    console.log(`[supervise] ✓ 匹配进程已退出，本监督窗口新写的权重/历史产物有效；未证明同次训练归属，监督结束`);
    process.exit(0);
  } else {
    fail('VANISHED', '训练进程消失但最终权重/历史产物缺失、无效或不属于本监督时间窗口（异常退出/被杀/旧产物）');
  }
  await sleep(INTERVAL);
}
