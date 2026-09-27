/* ============================================================
 * agent-ledger.mjs —— 实验台账（ML 式迭代方法论的实验跟踪件，类 MLflow/W&B）
 *
 * 用法：
 *   node game/tools/agent-ledger.mjs add --exp r11 --seed-base 77001 \
 *     --hypothesis "商店保底买药提高残血存活" --tuning output/agent-t11 \
 *     --verify output/agent-v11 --p 0.031 --verdict promote
 *   node game/tools/agent-ledger.mjs list [--n 20]
 *
 * 台账文件：搜打撤/output/agent-ledger.jsonl（一行一实验，只追加不改写）
 * 字段口径：
 *   exp        实验编号（rN，与迭代轮次对应）
 *   hypothesis 假设（一句话，改了什么、为什么该有效）
 *   seedBase   配对 seed 底（T 调参集与 V 验收集可各一条）
 *   split      tuning（T 训练/调参）| verify（V 留出验收集）
 *   metrics    该次跑的裸指标（撤离/均层/弃局/均耗时）
 *   p          配对符号检验 p 值（agent-compare.mjs 产出，配对才有）
 *   verdict    promote（上位）| discard（早停丢弃）| hold（进验收集待判）| baseline（基线登记）
 * ============================================================ */
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const LEDGER = resolve(process.cwd(), 'output/agent-ledger.jsonl');
const [cmd, ...rest] = process.argv.slice(2);
const argOf = (name, dflt = '') => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : dflt;
};

if (cmd === 'add') {
  const summaryPath = argOf('tuning') && existsSync(resolve(argOf('tuning'), 'summary.json'))
    ? resolve(argOf('tuning'), 'summary.json')
    : (argOf('verify') && existsSync(resolve(argOf('verify'), 'summary.json'))
      ? resolve(argOf('verify'), 'summary.json') : '');
  const summary = summaryPath ? JSON.parse(readFileSync(summaryPath, 'utf8')) : null;
  const rec = {
    ts: new Date().toISOString(),
    exp: argOf('exp'),
    hypothesis: argOf('hypothesis'),
    seedBase: argOf('seed-base') ? Number(argOf('seed-base')) : null,
    split: argOf('split', 'tuning'),
    policy: summary?.meta?.policy ?? argOf('policy', 'strategic'),
    runs: summary?.meta?.runs ?? null,
    metrics: summary ? {
      extract: summary.overall.extractRate,
      death: summary.overall.deathRate,
      abandon: summary.overall.outcomes.abandon,
      avgLayer: summary.overall.avgLayer,
      avgRunMs: summary.meta.avgRunMs,
    } : null,
    p: argOf('p') ? Number(argOf('p')) : null,
    verdict: argOf('verdict', 'hold'),
    note: argOf('note'),
  };
  appendFileSync(LEDGER, JSON.stringify(rec) + '\n');
  console.log(`[ledger] 已记 ${rec.exp} (${rec.split}/${rec.verdict}) → ${LEDGER}`);
} else if (cmd === 'list') {
  if (!existsSync(LEDGER)) { console.log('[ledger] 空'); process.exit(0); }
  const rows = readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const n = Number(argOf('n', '20'));
  const tagFilter = argOf('tag');   // --tag smoke 只看冒烟/标记记录；默认过滤掉 smoke（正式视图）
  const KNOWN = new Set(['promote', 'discard', 'hold', 'baseline']);
  for (const r of rows.slice(-n)) {
    if (r.verdict && !KNOWN.has(r.verdict)) console.error(`⚠ ${r.exp} verdict="${r.verdict}" 不在口径枚举（promote/discard/hold/baseline）——查写入方`);
    if (tagFilter) { if ((r.tag || '') !== tagFilter) continue; }
    else if (r.tag === 'smoke') continue;   // 正式视图不显示冒烟记录
    const m = r.metrics ? `撤离${r.metrics.extract}% 均层${r.metrics.avgLayer} 弃${r.metrics.abandon} ${r.metrics.avgRunMs}ms` : '—';
    const tag = r.tag ? ` [${r.tag}]` : '';
    console.log(`${r.ts.slice(5, 16)} ${String(r.exp).padEnd(6)} ${String(r.split).padEnd(8)} ${String(r.verdict).padEnd(9)} p=${r.p ?? '—'} ${m}${tag}  ${r.hypothesis}`);
  }
} else {
  console.error('用法: agent-ledger.mjs add|list ...');
  process.exit(1);
}
