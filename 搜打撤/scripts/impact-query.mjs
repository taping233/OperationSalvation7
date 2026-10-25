#!/usr/bin/env node
/* ============================================================
 * impact-query.mjs —— 影响面查询（npm run impact）
 *
 * 目的：agent / 会话动手前一条命令答清四件事——
 *   1. 撞没撞并行会话属地（解析 PARALLEL-REGISTRY 活跃登记）；
 *   2. 谁引用我（反向依赖闭包：直接 + 传递，覆盖 src/tests/scripts/tools）；
 *   3. 该跑哪些测试、quick 还是 full（复用 gate-plan planForPaths，
 *      与 quick 门同口径，不另立判断）；
 *   4. 现成验证命令（test:target / workflow verify，可直接复制执行）。
 *
 * 用法：
 *   npm run impact -- game/src/hub/game.shop.js          # 文本报告
 *   npm run impact -- game/src/agent tests/x.test.js --json
 *   node scripts/impact-query.mjs <路径...> [--json] [--all]
 *
 * 定位：只读自助查询，不是流程关卡——不改任何文件、不强制登记；
 *       编辑属地重叠提示协调；完成未提交保留归属，不阻断。
 * ============================================================ */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { planForPaths, reverseImports, toProjectPath } from './gate-plan.mjs';
import { parseActiveRegistry, registryHits } from './registry-paths.mjs';
export { extractRegistryTokens, parseActiveRegistry, pathOverlaps, registryHits } from './registry-paths.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 路径归一：与 acceptance-gate toProjectPath 同口径（反斜杠/搜打撤前缀/绝对路径）。 */
export function normalizePath(value, root = PROJECT_ROOT) { return toProjectPath(value, root).replace(/\/+$/, ''); }

function scanLooseEdges(root = PROJECT_ROOT) {
  const edges = new Map(); // target -> Set(importer)
  const roots = ['scripts', 'game/tools'];
  const visit = dir => {
    let entries;
    try { entries = readdirSync(path.join(root, dir), { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const rel = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) visit(rel);
      else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) {
        const source = readFileSync(path.join(root, rel), 'utf8');
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
  for (const directory of roots) visit(directory);
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
export function impactQuery(inputPaths, { root = PROJECT_ROOT } = {}) {
  const paths = [...new Set(inputPaths.map(value => normalizePath(value, root)))].sort();
  // 路径不存在只提示不阻断（机制不过严口径）：拼错路径的可见性交给调用方核对，回退计划仍完整输出。
  const missingPaths = paths.filter(p => !existsSync(path.join(root, p)));
  const registryText = existsSync(path.join(root, 'docs/PARALLEL-REGISTRY.md')) ? readFileSync(path.join(root, 'docs/PARALLEL-REGISTRY.md'), 'utf8') : '';
  const auditRows = parseActiveRegistry(registryText, { includeSettled: true });
  const rows = auditRows.filter(row => row.isOpen);
  const graph = reverseImports(root);
  // 目录查询展开为图内文件（反向图是文件级，目录不展开会漏全部引用者）
  const expanded = [];
  for (const p of paths) {
    const under = [...graph.fileSet].filter(f => f.startsWith(p + '/'));
    if (under.length && !graph.fileSet.has(p)) expanded.push(...under);
    else expanded.push(p);
  }
  const closure = reverseClosure([...new Set(expanded)], graph, scanLooseEdges(root));
  const plan = planForPaths(paths, { root });
  const commands = { targeted: '', verify: `npm run --silent workflow -- verify --paths ${paths.join(',')} --plan` };
  if (plan.mode === 'quick' && plan.tests.length) {
    commands.targeted = `npm run test:target -- ${plan.tests.join(' ')}`;
  }
  return { paths, missingPaths, registry: { activeRowCount: rows.length, editingRowCount: rows.filter(row => row.isBlocking).length,
    completedRowCount: rows.filter(row => row.state === 'complete-uncommitted').length,
    settledRowCount: auditRows.length - rows.length, hits: registryHits(paths, rows), rows,
    auditRows: auditRows.filter(row => !row.isOpen) }, reverse: closure, plan, commands };
}

const truncate = (list, limit, all) => {
  const shown = all || list.length <= limit ? list : list.slice(0, limit);
  const suffix = (!all && list.length > limit) ? ` …（共 ${list.length}，--all 看全量）` : '';
  return shown.length ? shown.join('、') + suffix : '（无）';
};

/** 文本渲染：给人/终端直接读。 */
export function formatImpact(report) {
  const { paths, missingPaths, registry, reverse, plan, commands } = report;
  const lines = [];
  lines.push(`影响面：${paths.join('  ')}`);
  if (missingPaths?.length) {
    lines.push(`── ⚠ 路径不存在：${missingPaths.join('、')}（可能是拼错路径；已按无映射回退口径出计划，动手前先核对）`);
  }
  const editingHits = registry.hits.filter(hit => hit.state !== 'complete-uncommitted');
  const protectedHits = registry.hits.filter(hit => hit.state === 'complete-uncommitted');
  lines.push(editingHits.length
    ? `── 并行属地：⚠ 编辑重叠 ${editingHits.length} 处，动手前先协调——`
    : `── 并行属地：无编辑冲突（编辑占用 ${registry.editingRowCount ?? registry.activeRowCount} 行已核对）`);
  for (const hit of editingHits) lines.push(`   ⚠ ${hit.session}｜状态 ${hit.status}｜重叠 ${hit.matched.join('、')}`);
  for (const hit of protectedHits) lines.push(`   未提交归属保护 ${hit.session}｜${hit.matched.join('、')}｜编辑已结束，保留已有完成改动`);
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
