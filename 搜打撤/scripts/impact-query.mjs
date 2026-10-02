#!/usr/bin/env node
/* ============================================================
 * impact-query.mjs —— 影响面查询（npm run impact）
 *
 * 目的：agent / 会话动手前一条命令答清四件事——
 *   1. 撞没撞并行会话属地（解析 PARALLEL-REGISTRY 活跃登记）；
 *   2. 谁引用我（反向依赖闭包：直接 + 传递，覆盖 src/tests/scripts/tools）；
 *   3. 该跑哪些测试、quick 还是 full（复用 acceptance-gate planForPaths，
 *      与 quick 门同口径，不另立判断）；
 *   4. 现成验证命令（test:target / workflow verify，可直接复制执行）。
 *
 * 用法：
 *   npm run impact -- game/src/hub/game.shop.js          # 文本报告
 *   npm run impact -- game/src/agent tests/x.test.js --json
 *   node scripts/impact-query.mjs <路径...> [--json] [--all]
 *
 * 定位：只读自助查询，不是流程关卡——不改任何文件、不强制登记；
 *       属地命中只提示「先协调」，不阻断。
 * ============================================================ */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { planForPaths, reverseImports } from './acceptance-gate.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_PATH = path.join(PROJECT_ROOT, 'docs', 'PARALLEL-REGISTRY.md');

/** 路径归一：与 acceptance-gate toProjectPath 同口径（反斜杠/搜打撤前缀/绝对路径）。 */
export function normalizePath(value) {
  let result = value.replaceAll('\\', '/').replace(/^\.\//, '');
  if (path.isAbsolute(value)) {
    result = path.relative(PROJECT_ROOT, path.resolve(value)).replaceAll('\\', '/');
  }
  if (result.startsWith('搜打撤/')) result = result.slice('搜打撤/'.length);
  result = path.posix.normalize(result).replace(/\/+$/, '');
  const rel = path.relative(PROJECT_ROOT, path.resolve(PROJECT_ROOT, result)).replaceAll('\\', '/');
  if (rel.startsWith('../') || rel === '..' || path.isAbsolute(rel)) {
    throw new Error('路径不在 Vite 项目内：' + value);
  }
  return rel;
}

/** 从属地单元格文本提取路径 token（反引号优先，兼容裸路径；丢弃端口/PID/URL 与「不碰」类排除声明）。 */
export function extractRegistryTokens(cellText) {
  const tokens = [];
  const backticked = [...cellText.matchAll(/`([^`]+)`/g)].map(m => ({ text: m[1], dir: m[1].endsWith('/') }));
  const loose = [...cellText.matchAll(/[\w\u4e00-\u9fff.-]+(?:\/[\w\u4e00-\u9fff.-]+)*\/?/g)]
    .map(m => ({ text: m[0], dir: m[0].endsWith('/') }));
  const raw = backticked.length ? backticked : loose;
  for (const { text, dir } of raw) {
    if (/[:*?"<>|]/.test(text)) continue;           // 端口/PID/URL/通配 噪声
    if (/^\d+(?:\/\d+)+$/.test(text)) continue;     // 纯数字斜杠串（如 PID 并列 21272/22356）不是路径
    // 「不碰 / 零改动 xxx」是排除声明不是属地，避免整目录误报撞线
    const at = cellText.indexOf(text);
    if (at > 0 && /不碰|不涉及|零改动|不含/.test(cellText.slice(Math.max(0, at - 6), at))) continue;
    const item = text.replace(/^搜打撤\//, '').replace(/\/+$/, '');
    if (!item || item.length > 200) continue;
    // 目录 token（原文带尾斜杠）直接保留；文件 token 需带 / 或已知扩展名，纯词（PID 等）丢弃
    if (!dir && !item.includes('/') && !/\.(js|mjs|cjs|json|md|css|html|ts)$/.test(item)) continue;
    tokens.push(item);
  }
  return [...new Set(tokens)];
}

/** 解析 PARALLEL-REGISTRY.md 活跃登记表 → [{session, tokens, status, matter}]（已落库/释放/归档行不计）。 */
export function parseActiveRegistry(registryText) {
  const section = registryText.split('## 活跃登记')[1];
  if (!section) return [];
  const body = section.split(/\n## /)[0];
  const rows = [];
  for (const line of body.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*[-—]+/.test(line) || line.startsWith('| 会话')) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 5) continue;
    const [session, territory, matter, , status] = cells;
    if (/已落库|已释放|归档/.test(status)) continue;
    rows.push({ session, status, matter, tokens: extractRegistryTokens(territory) });
  }
  return rows;
}

/** 查询路径 × 属地 token 双向包含（文件∈目录 / 目录∋文件 / 相等）。 */
export function pathOverlaps(p, token) {
  if (p === token) return true;
  if (p.startsWith(token + '/')) return true;   // 查询文件在属地目录内
  if (token.startsWith(p + '/')) return true;   // 查询目录覆盖属地文件（整目录动手=撞线）
  return false;
}

/** 属地命中：rows 中任一 token 与任一查询路径重叠。 */
export function registryHits(paths, rows) {
  const hits = [];
  for (const row of rows) {
    const matched = row.tokens.filter(token => paths.some(p => pathOverlaps(p, token)));
    if (matched.length) hits.push({ session: row.session, status: row.status, matched });
  }
  return hits;
}

/** 松扫描 scripts/ 与 game/tools/（gate 主图只盖 src/tests/data）：正则抓 import 说明符建反向边。 */
export function scanLooseEdges() {
  const edges = new Map(); // target -> Set(importer)
  const roots = ['scripts', 'game/tools'];
  const visit = dir => {
    let entries;
    try { entries = readdirSync(path.join(PROJECT_ROOT, dir), { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const rel = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) visit(rel);
      else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) {
        const source = readFileSync(path.join(PROJECT_ROOT, rel), 'utf8');
        for (const match of source.matchAll(/(?:import|export)[\s\S]{0,120}?['"](\.[^'"]+)['"]/g)) {
          const target = path.posix.normalize(path.posix.join(
            path.posix.dirname(rel), match[1].split(/[?#]/)[0],
          ));
          if (!target.startsWith('../') && target !== rel) {
            if (!edges.has(target)) edges.set(target, new Set());
            edges.get(target).add(rel);
          }
        }
      }
    }
  };
  for (const root of roots) visit(root);
  return edges;
}

/** 反向闭包 BFS：{direct, transitive:[{file, depth}], srcCount, testCount}；graph 优先，loose 边补充。 */
export function reverseClosure(targets, graph, looseEdges) {
  const direct = new Set();
  const depthOf = new Map();
  const visited = new Set(targets);
  let frontier = [...targets];
  for (let depth = 1; frontier.length; depth++) {
    const next = [];
    for (const current of frontier) {
      const importers = new Set([...(graph.reverse.get(current) || []), ...(looseEdges.get(current) || [])]);
      for (const importer of importers) {
        if (visited.has(importer)) continue;
        visited.add(importer);
        if (depth === 1) direct.add(importer);
        else depthOf.set(importer, depth);
        next.push(importer);
      }
    }
    frontier = next;
  }
  const transitive = [...depthOf.entries()]
    .map(([file, depth]) => ({ file, depth }))
    .sort((a, b) => a.depth - b.depth || a.file.localeCompare(b.file));
  const all = [...direct, ...transitive.map(t => t.file)];
  return {
    direct: [...direct].sort(),
    transitive,
    srcCount: all.filter(f => f.startsWith('game/')).length,
    testCount: all.filter(f => f.startsWith('tests/')).length,
  };
}

/** 主查询：{paths, registry:{activeRowCount, hits, rows}, reverse, plan, commands}。 */
export function impactQuery(inputPaths) {
  const paths = [...new Set(inputPaths.map(normalizePath))].sort();
  const registryText = existsSync(REGISTRY_PATH) ? readFileSync(REGISTRY_PATH, 'utf8') : '';
  const rows = parseActiveRegistry(registryText);
  const graph = reverseImports();
  // 目录查询展开为图内文件（反向图是文件级，目录不展开会漏全部引用者）
  const expanded = [];
  for (const p of paths) {
    const under = [...graph.fileSet].filter(f => f.startsWith(p + '/'));
    if (under.length && !graph.fileSet.has(p)) expanded.push(...under);
    else expanded.push(p);
  }
  const closure = reverseClosure([...new Set(expanded)], graph, scanLooseEdges());
  const plan = planForPaths(paths);
  const commands = { targeted: '', verify: `npm run --silent workflow -- verify --paths ${paths.join(',')} --plan` };
  if (plan.mode === 'quick' && plan.tests.length) {
    commands.targeted = `npm run test:target -- ${plan.tests.join(' ')}`;
  }
  return { paths, registry: { activeRowCount: rows.length, hits: registryHits(paths, rows), rows }, reverse: closure, plan, commands };
}

const truncate = (list, limit, all) => {
  const shown = all || list.length <= limit ? list : list.slice(0, limit);
  const suffix = (!all && list.length > limit) ? ` …（共 ${list.length}，--all 看全量）` : '';
  return shown.length ? shown.join('、') + suffix : '（无）';
};

/** 文本渲染：给人/终端直接读。 */
export function formatImpact(report) {
  const { paths, registry, reverse, plan, commands } = report;
  const lines = [];
  lines.push(`影响面：${paths.join('  ')}`);
  lines.push(registry.hits.length
    ? `── 并行属地：⚠ 撞线 ${registry.hits.length} 处，动手前先协调——`
    : `── 并行属地：无冲突（活跃登记 ${registry.activeRowCount} 行已核对）`);
  for (const hit of registry.hits) lines.push(`   ⚠ ${hit.session}｜状态 ${hit.status}｜重叠 ${hit.matched.join('、')}`);
  lines.push(`── 反向依赖（谁引用它）：直接 ${reverse.direct.length}（src ${reverse.srcCount}/tests ${reverse.testCount} 计含传递）`);
  lines.push(`   直接：${truncate(reverse.direct, 10, false)}`);
  if (reverse.transitive.length) {
    lines.push(`   传递：${truncate(reverse.transitive.map(t => `${t.file}(L${t.depth})`), 12, false)}`);
  }
  if (plan.mode === 'skip') {
    lines.push(`── 验证计划：skip（非验收门路径）`);
  } else {
    lines.push(`── 验证计划：${plan.mode}${plan.tests.length ? `（${plan.tests.length} 项定向）` : ''}${plan.reasons.length ? '｜' + plan.reasons.join('；') : ''}`);
    if (plan.tests.length) lines.push(`   ${truncate(plan.tests, 10, false)}`);
  }
  lines.push('── 现成命令：');
  if (commands.targeted) lines.push(`   ${commands.targeted}`);
  lines.push(`   ${commands.verify}`);
  if (plan.mode === 'full') lines.push('   （full：本地可先定向，全量以 CI 为准——见 docs/quality-gates.md）');
  return lines.join('\n');
}

// ---------- CLI ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { json: { type: 'boolean' }, all: { type: 'boolean' } },
    });
    if (!positionals.length) throw new Error('用法：npm run impact -- <路径...> [--json] [--all]');
    const report = impactQuery(positionals);
    if (values.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatImpact(report));
    }
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  }
}
