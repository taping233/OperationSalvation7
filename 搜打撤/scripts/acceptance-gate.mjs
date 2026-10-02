#!/usr/bin/env node
// Fast, explicitly partial local gate. CI and phase closeout keep the full suite.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { analyzeModule } from './architecture-graph.mjs';

const SCRIPT_PATH = process.argv[1] && /acceptance-gate\.mjs$/.test(process.argv[1])
  ? path.resolve(process.argv[1]) : null;
const PROJECT_ROOT = SCRIPT_PATH ? path.resolve(path.dirname(SCRIPT_PATH), '..') : process.cwd();
const REPO_ROOT = path.resolve(PROJECT_ROOT, '..');
const GUARDS = ['tests/architecture-boundaries.test.js', 'tests/contracts.test.js'];
const TEST_LIMIT = 30;
const NEAR_LIMIT = 12;
const AGENT_TOOL_TESTS = new Map([
  ['game/tools/agent-compare.mjs', ['tests/agent-compare-provenance.test.js']],
  ['game/tools/agent-compare-provenance.mjs', ['tests/agent-compare-provenance.test.js']],
  ['game/tools/agent-run-provenance.mjs', ['tests/agent-run-provenance.test.js']],
]);
// Known project workflow tools have direct contracts; unknown scripts still require full validation.
export const WORKFLOW_TESTS = new Map([
  ['scripts/workflow.mjs', ['tests/workflow-cli-integration.test.js', 'tests/workflow-tools.test.js', 'tests/workflow-task.test.js']],
  ['scripts/workflow-task.mjs', ['tests/workflow-task.test.js']],
  ['scripts/workflow-evidence.mjs', ['tests/workflow-scope.test.js', 'tests/workflow-tools.test.js']],
  ['scripts/workflow-dependencies.mjs', ['tests/workflow-dependencies.test.js', 'tests/workflow-scope.test.js']],
  ['scripts/workflow-status.mjs', ['tests/workflow-handoff.test.js', 'tests/workflow-tools.test.js']],
  ['scripts/handoff-brief.mjs', ['tests/workflow-handoff.test.js']],
  ['scripts/workflow-ledger.mjs', ['tests/workflow-tools.test.js', 'tests/workflow-task.test.js']],
  ['scripts/workflow-browser.mjs', ['tests/workflow-browser.test.js']],
  ['scripts/workflow-memory.mjs', ['tests/workflow-memory.test.js', 'tests/workflow-handoff.test.js']],
  ['scripts/workflow-staged.mjs', ['tests/workflow-staged.test.js']],
  ['scripts/index-validation.mjs', ['tests/workflow-index.test.js', 'tests/workflow-cli-integration.test.js']],
  ['scripts/page-snapshot.mjs', ['tests/workflow-cli-integration.test.js']],
  ['scripts/workflow-archive.mjs', ['tests/workflow-tools.test.js']],
  ['scripts/acceptance-gate.mjs', ['tests/acceptance-gate.test.js']],
  ['scripts/impact-query.mjs', ['tests/impact-query.test.js']],
  ['scripts/architecture-graph.mjs', ['tests/architecture-boundaries.test.js', 'tests/contracts.test.js']],
  ['scripts/generate-compendium.mjs', ['tests/compendium.test.js']],
  ['scripts/sync-cards-from-live.mjs', ['tests/sync-cards-from-live.test.js', 'tests/schema-op-coverage.test.js', 'tests/contracts.test.js']],
]);
// R2（2026-10-01 拍板）：明确不配专属映射的脚本——回退脚本契约测试+引用搜索+哨兵，不再全量。
// 登记在这里的脚本已被 scripts-contract.test.js 的映射守卫覆盖（防新脚本无声漏网）。
export const EXEMPT_SCRIPTS = new Set([
  'scripts/asset-audit.cjs',            // 手动资产审计报告工具
  'scripts/check-syntax.mjs',           // 门内静态检查自身；语法契约由契约测试覆盖
  'scripts/check-types.mjs',            // 门内静态检查自身（7 tsc 配置）
  'scripts/check-version.cjs',          // 版本核对小工具
  'scripts/compile-narrative.mjs',      // 门内剧情编译步骤自身
  'scripts/doc-retirement-candidates.mjs', // 手动文档退役候选报告
  'scripts/electron-gpu-info.cjs',      // 桌面版冻结域工具
  'scripts/electron-title-smoke.mjs',   // 桌面版冻结域工具
  'scripts/esm-convert.mjs',            // 一次性迁移工具
  'scripts/esm-fix-setters.mjs',        // 一次性迁移工具
  'scripts/iab-drive.mjs',              // 内置浏览器驱动（手动验收路径）
  'scripts/perf-benchmark.cjs',         // 手动性能基准
  'scripts/perf-budget.cjs',            // build 后置步骤（build 链路自带验证）
  'scripts/perf-ledger-capture.mjs',    // 手动性能台账采集
  'scripts/setup-commit-gate.mjs',      // 一次性 hooks 安装工具
  'scripts/validate-data.mjs',          // 门内数据校验自身
  'scripts/web-up.mjs',                 // 起服工具（幂等已实机验证）
]);
export const SCRIPT_CONTRACT_TEST = 'tests/scripts-contract.test.js';
// 剧情源文件没有 JS 模块依赖图可走：定向到全书生成对比，编译错误由门内剧情编译步骤兜底。
const NARRATIVE_TESTS = ['tests/compendium.test.js'];
export const DIRTY_SCAN_ROOTS = ['搜打撤/game/src', '搜打撤/game/tools', '搜打撤/tests'];
const FULL_SOURCE = [
  /^game\/src\/(main|boot-order|game\.boot)\.js$/,
  /^game\/src\/core\//,
  /^game\/src\/hub\/(base|game\.storage|game\.bag\.settle|battle-settlement)/,
  /^game\/src\/hub\/game\.store\.js$/,
  /^game\/src\/run\/game\.session/,
  /^game\/src\/battle\/(battle\.core|battle\.engine|battle\.runtime)/,
  /^game\/src\/battle\/core\/battle\.(core|engine)\.js$/,
  /^game\/src\/battle\/runtime\/battle\.runtime(?:\.[\w-]+)?\.js$/,
  /^game\/src\/cards\/cards\.sync/,
  /^game\/src\/generated\//,
];

function toProjectPath(value) {
  let result = value.replaceAll('\\', '/').replace(/^\.\//, '');
  if (path.isAbsolute(value)) {
    result = path.relative(PROJECT_ROOT, path.resolve(value)).replaceAll('\\', '/');
  }
  if (result.startsWith('搜打撤/')) result = result.slice('搜打撤/'.length);
  const normalized = path.relative(PROJECT_ROOT, path.resolve(PROJECT_ROOT, result)).replaceAll('\\', '/');
  if (normalized.startsWith('../') || normalized === '..' || path.isAbsolute(normalized)) {
    throw new Error('路径不在 Vite 项目内：' + value);
  }
  return normalized;
}

function walkJs(relativeDir, extensions = ['.js']) {
  const result = [];
  const visit = dir => {
    for (const entry of readdirSync(path.join(PROJECT_ROOT, dir), { withFileTypes: true })) {
      const next = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) visit(next);
      else if (extensions.some(ext => next.endsWith(ext))) result.push(next);
    }
  };
  visit(relativeDir);
  return result;
}

// 导出复用：影响面查询（scripts/impact-query.mjs）与 quick 门同源同口径，不另建解析。
export function reverseImports() {
  const files = [...walkJs('game/src'), ...walkJs('tests'), ...walkJs('game/data', ['.json'])];
  const fileSet = new Set(files);
  const reverse = new Map();
  for (const filename of files) {
    const source = readFileSync(path.join(PROJECT_ROOT, filename), 'utf8');
    // JSON 数据文件是叶子节点：不被静态解析，只作为 JS import 的目标参与反向图。
    const imports = filename.endsWith('.json') ? [] : analyzeModule(source, filename).imports;
    for (const { specifier } of imports) {
      if (!specifier.startsWith('.')) continue;
      const target = path.posix.normalize(path.posix.join(
        path.posix.dirname(filename), specifier.split(/[?#]/)[0],
      ));
      if (!fileSet.has(target)) continue;
      if (!reverse.has(target)) reverse.set(target, new Set());
      reverse.get(target).add(filename);
    }
  }
  return { fileSet, reverse };
}

function nearbyTests(filename, reverse, hops) {
  const found = new Set();
  const visited = new Set([filename]);
  const queue = [[filename, 0]];
  while (queue.length) {
    const [current, distance] = queue.shift();
    if (distance >= hops) continue;
    for (const importer of reverse.get(current) || []) {
      if (visited.has(importer)) continue;
      visited.add(importer);
      if (importer.startsWith('tests/') && importer.endsWith('.test.js')) found.add(importer);
      else if (importer.startsWith('game/src/')) queue.push([importer, distance + 1]);
    }
  }
  return [...found].sort();
}

// 仅 scripts 段变更不触依赖树与运行时代码：剔除 scripts 后其余字段逐字节一致才算豁免。
export function packageJsonScriptsOnlyDiff(headText, currentText) {
  const withoutScripts = text => {
    const parsed = JSON.parse(text);
    delete parsed.scripts;
    return JSON.stringify(parsed);
  };
  return withoutScripts(headText) === withoutScripts(currentText);
}

function scriptsLocalRefs(scripts) {
  const refs = new Set();
  for (const command of Object.values(scripts || {})) {
    for (const token of String(command).split(/\s+/)) {
      if (/^(scripts|game\/tools)\//.test(token) || /\.(mjs|cjs)$/.test(token)) refs.add(token);
    }
  }
  return [...refs];
}

function stagedPackageJsonScriptsOnly(paths) {
  const projectPaths = paths.map(toProjectPath);
  if (!projectPaths.includes('package.json')) return false;
  if (!existsSync(path.join(PROJECT_ROOT, 'package.json'))) return false;
  const head = spawnSync('git', ['-C', REPO_ROOT, 'show', 'HEAD:搜打撤/package.json'],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (head.status !== 0) return false;
  const current = readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8');
  if (!packageJsonScriptsOnlyDiff(head.stdout, current)) return false;
  const refs = scriptsLocalRefs(JSON.parse(current).scripts);
  return refs.every(ref => existsSync(path.join(PROJECT_ROOT, ref)));
}

export function planForPaths(inputPaths, options = {}) {
  const paths = [...new Set(inputPaths.map(toProjectPath))].sort();
  const relevant = paths.filter(p => p.startsWith('game/src/') || p.startsWith('game/data/')
    || p.startsWith('game/tools/') || p.startsWith('tests/') || p.startsWith('scripts/') || p.startsWith('narrative/')
    || p === 'package.json' || p === 'package-lock.json' || p === 'vite.config.js');
  if (!relevant.length) return { mode: 'skip', paths, reasons: ['没有验收门路径变更'], tests: [] };

  const reasons = [];
  const tests = new Set();
  const source = relevant.filter(p => p.startsWith('game/src/'));
  const dataFiles = relevant.filter(p => p.startsWith('game/data/'));
  const tools = relevant.filter(p => p.startsWith('game/tools/'));
  const scripts = relevant.filter(p => p.startsWith('scripts/'));
  const changedTests = relevant.filter(p => p.startsWith('tests/') && p.endsWith('.test.js'));
  for (const test of changedTests) {
    if (existsSync(path.join(PROJECT_ROOT, test))) tests.add(test);
  }
  if (changedTests.some(test => !existsSync(path.join(PROJECT_ROOT, test)))) {
    reasons.push('被删除或缺失的测试文件不参与定向选择');
  }

  const configFull = relevant.filter(p => ['package.json', 'vite.config.js'].includes(p));
  const pkgScriptsOnly = options.packageJsonScriptsOnly === true && !relevant.includes('package-lock.json');
  if (configFull.some(p => p !== 'package.json' || !pkgScriptsOnly)) {
    reasons.push('包或构建配置变更需要全量测试');
  }
  if (relevant.some(p => p.startsWith('narrative/'))) {
    for (const test of NARRATIVE_TESTS) tests.add(test);
  }
  const scriptNotes = [];
  for (const script of scripts) {
    const mapped = WORKFLOW_TESTS.get(script);
    if (mapped && existsSync(path.join(PROJECT_ROOT, script))
      && mapped.every(test => existsSync(path.join(PROJECT_ROOT, test)))) {
      for (const test of mapped) tests.add(test);
      continue;
    }
    // R2：未映射/豁免/被删脚本回退轻契约（语法+映射守卫）+ 引用搜索 + 哨兵，不再整体全量；
    // 新脚本漏映射由 scripts-contract.test.js 守卫标红，倒逼显式登记。说明延后注入（reasons 非空=全量信号）。
    if (existsSync(path.join(PROJECT_ROOT, SCRIPT_CONTRACT_TEST))) tests.add(SCRIPT_CONTRACT_TEST);
    else reasons.push(SCRIPT_CONTRACT_TEST + ' 缺失，脚本回退下限失效');
    const name = path.posix.basename(script);
    const consumers = walkJs('tests').filter(candidate => candidate.endsWith('.test.js')
      && readFileSync(path.join(PROJECT_ROOT, candidate), 'utf8').includes(name));
    for (const consumer of consumers) tests.add(consumer);
    for (const guard of GUARDS) tests.add(guard);
    scriptNotes.push(script + ' 无专属映射，回退脚本契约测试+引用搜索+架构哨兵' + (consumers.length ? '' : '（无测试引用它）'));
  }
  for (const tool of tools) {
    const mappedTests = AGENT_TOOL_TESTS.get(tool);
    if (!tool.startsWith('game/tools/agent-') || !mappedTests) {
      reasons.push(tool + ' 没有对应的安全定向测试，回退完整测试');
      continue;
    }
    if (!existsSync(path.join(PROJECT_ROOT, tool)) || mappedTests.some(test => !existsSync(path.join(PROJECT_ROOT, test)))) {
      reasons.push(tool + ' 或其定向测试已删除/不可用，回退完整测试');
      continue;
    }
    for (const test of mappedTests) tests.add(test);
  }
  for (const support of relevant.filter(p => p.startsWith('tests/') && !p.endsWith('.test.js'))) {
    const name = path.posix.basename(support);
    const consumers = walkJs('tests').filter(candidate => candidate.endsWith('.test.js')
      && readFileSync(path.join(PROJECT_ROOT, candidate), 'utf8').includes(name));
    if (!consumers.length) reasons.push(support + ' 没有引用它的测试，无法定向');
    else for (const consumer of consumers) tests.add(consumer);
  }
  if (source.some(p => !p.endsWith('.js') || FULL_SOURCE.some(pattern => pattern.test(p)))) {
    reasons.push('公共状态、启动、规则或迁移边界变更需要全量测试');
  }
  if (reasons.length) return { mode: 'full', paths: relevant, reasons, tests: [] };
  reasons.push(...scriptNotes);

  if (relevant.includes('package-lock.json') && !configFull.length) {
    for (const guard of GUARDS) tests.add(guard);
    reasons.push('lockfile 单独变化只运行架构哨兵');
  }
  if (pkgScriptsOnly && !reasons.length) {
    for (const guard of GUARDS) tests.add(guard);
    reasons.push('package.json 仅 scripts 段变更：运行架构哨兵，scripts 引用校验已通过');
  }

  const graphTargets = [...source, ...dataFiles];
  if (graphTargets.length) {
    let graph;
    try { graph = reverseImports(); }
    catch (error) {
      return { mode: 'full', paths: relevant, reasons: ['依赖图解析失败：' + error.message], tests: [] };
    }
    for (const file of graphTargets) {
      if (!graph.fileSet.has(file)) {
        // 删除/缺失文件：引用它的测试就是回归网（悬空 import 会当场失败），不再整体回退全量。
        const name = path.posix.basename(file);
        const referenced = walkJs('tests').filter(candidate => candidate.endsWith('.test.js')
          && readFileSync(path.join(PROJECT_ROOT, candidate), 'utf8').includes(name));
        if (referenced.length) for (const test of referenced) tests.add(test);
        else reasons.push(file + ' 已删除且无测试引用，仅运行架构哨兵');
        continue;
      }
      const direct = nearbyTests(file, graph.reverse, 1);
      const near = nearbyTests(file, graph.reverse, 2);
      const chosen = near.length > 0 && near.length <= NEAR_LIMIT ? near : direct;
      if (!chosen.length) reasons.push(file + ' 没有可确认的邻近测试');
      else for (const test of chosen) tests.add(test);
      if (near.length > NEAR_LIMIT && direct.length) {
        reasons.push(file + ' 影响面较广，快速门只运行直接测试；完整门由 CI/阶段收尾承担');
      }
    }
    for (const guard of GUARDS) tests.add(guard);
  }
  if (reasons.some(reason => reason.includes('没有可确认'))) {
    return { mode: 'full', paths: relevant, reasons: [], tests: [] };
  }
  if (tests.size > TEST_LIMIT) {
    return { mode: 'full', paths: relevant, reasons: ['定向测试超过 ' + TEST_LIMIT + ' 个文件'], tests: [] };
  }
  if (!tests.size) {
    return { mode: 'full', paths: relevant, reasons: ['变更未找到可运行的定向测试'], tests: [] };
  }
  return { mode: 'quick', paths: relevant, reasons, tests: [...tests].sort() };
}

export function parseUnclaimedPaths(registryText) {
  // R1（2026-10-01 拍板）：无主物品表第一列反引号内的路径 token；~~删除线~~行已处置，跳过。
  const paths = [];
  const section = registryText.split('## 无主物品')[1]?.split(/\n## /)[0] ?? '';
  for (const line of section.split('\n')) {
    const cell = line.match(/^\|\s*(~~)?([^|]*)/);
    if (!cell || cell[1] || cell[2].includes('物品') || cell[2].startsWith('---')) continue;
    for (const match of cell[2].matchAll(/`([^`]+)`/g)) {
      const candidate = match[1].trim();
      if (candidate.includes('/')) paths.push(candidate);
    }
  }
  return paths;
}

function checkCommitBoundary(repoPaths) {
  if (process.env.GATE_MANIFEST_OK) return;
  const registryPath = path.join(PROJECT_ROOT, 'docs/PARALLEL-REGISTRY.md');
  if (!existsSync(registryPath)) return;
  const unclaimed = parseUnclaimedPaths(readFileSync(registryPath, 'utf8'));
  if (!unclaimed.length) return;
  const hits = repoPaths.filter(p => unclaimed.some(u => p === u || p.startsWith(u) || u.startsWith(p)));
  if (hits.length) {
    throw new Error('staged 命中 REGISTRY 无主物品（等认领/老板处置，勿随本次提交带库——26a5254 事故形态）：\n'
      + hits.map(p => '  ' + p).join('\n')
      + '\n认领/排除后再提交；确属误报或已有老板拍板时 GATE_MANIFEST_OK=1 显式放行。');
  }
}

function gitPathFields(args) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: REPO_ROOT })
    .toString('utf8').split('\0').filter(Boolean);
}

export function parseStagedStatus(fields) {
  if (fields.length % 2 !== 0) throw new Error('Git 暂存状态输出不完整，不能确认提交内容');
  const entries = [];
  for (let i = 0; i < fields.length; i += 2) entries.push({ status: fields[i], path: fields[i + 1] });
  return entries;
}

export function formatDirtyReport(groups) {
  const labels = [
    ['unstaged', '未暂存改动'],
    ['untracked', '未跟踪新文件'],
    ['ignored', '被忽略文件'],
  ];
  const lines = [];
  for (const [key, label] of labels) {
    for (const file of groups[key] || []) lines.push(`  [${label}] ${file}`);
  }
  const LIMIT = 12;
  return lines.length > LIMIT ? [...lines.slice(0, LIMIT), `  …等共 ${lines.length} 项`] : lines;
}

function stagedChanges() {
  const entries = parseStagedStatus(gitPathFields(['diff', '--cached', '--name-status', '--no-renames', '-z']));
  const paths = entries.map(entry => entry.path);
  const stagedRelevant = paths.map(toProjectPath).filter(isRelevant);
  if (stagedRelevant.length) {
    const groups = {
      unstaged: gitPathFields(['diff', '--name-only', '--no-renames', '-z']),
      untracked: gitPathFields(['ls-files', '--others', '--exclude-standard', '-z']),
      ignored: gitPathFields(['ls-files', '--others', '--ignored', '--exclude-standard', '-z',
        '--', ...DIRTY_SCAN_ROOTS]),
    };
    for (const key of Object.keys(groups)) {
      groups[key] = [...new Set(groups[key].map(toProjectPath).filter(isRelevant))];
    }
    const dirtyCount = groups.unstaged.length + groups.untracked.length + groups.ignored.length;
    if (dirtyCount) {
      throw new Error('存在未暂存/未跟踪/被忽略的 Vite 源码/工具/测试/配置，无法用工作树验证暂存快照'
        + '（未暂存先 add 或 stash；未跟踪属本次就 add，不属就移走；被忽略文件检查是否 ignore 产物挡路）：\n'
        + formatDirtyReport(groups).join('\n'));
    }
  }
  // needsFull 只对 T（typechange）生效：R（rename）在上方 --no-renames 输出里被拆成 A+D 组合，
  // 由组合分支兜住——测试改名→「缺失测试」全量；源码改名（引用未同改）→新文件无 importer 全量；
  // 改名+引用同改→语义等价删除+新增（D 走引用哨兵、A 走定向），安全（2026-10-01 演练实证）。
  return { paths, needsFull: entries.some(entry => entry.status === 'T') };
}

function isRelevant(p) {
  return p.startsWith('game/src/') || p.startsWith('game/data/') || p.startsWith('game/tools/') || p.startsWith('tests/')
    || p.startsWith('scripts/') || p.startsWith('narrative/')
    || ['package.json', 'package-lock.json', 'vite.config.js'].includes(p);
}

function runNode(args, label) {
  process.stdout.write('[gate] ' + label + '\n');
  const result = spawnSync(process.execPath, args, { cwd: PROJECT_ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(label + ' 失败（exit ' + result.status + '）');
}

function runNodeCaptured(args, label) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: PROJECT_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk.toString('utf8'); });
    child.stderr.on('data', chunk => { output += chunk.toString('utf8'); });
    child.on('error', error => resolve({ label, ok: false, output: String(error) }));
    child.on('close', code => resolve({ label, ok: code === 0, output }));
  });
}

async function runStaticChecks() {
  process.stdout.write('[gate] 静态检查并行：语法 / 数据 / 类型 / ESLint\n');
  const results = await Promise.all([
    runNodeCaptured(['scripts/check-syntax.mjs'], '语法检查'),
    runNodeCaptured(['scripts/validate-data.mjs'], '内容数据检查'),
    runNodeCaptured(['scripts/check-types.mjs'], '类型契约检查'),
    runNodeCaptured(['node_modules/eslint/bin/eslint.js', 'game/src', 'tests', 'scripts/acceptance-gate.mjs',
      '--cache', '--cache-location', 'node_modules/.cache/eslint/.eslintcache'], 'ESLint'),
  ]);
  for (const result of results) {
    process.stdout.write('[gate] ' + result.label + '：' + (result.ok ? 'OK' : 'FAIL') + '\n');
    if (result.output.trim()) process.stdout.write(result.output + '\n');
  }
  const failed = results.filter(result => !result.ok);
  if (failed.length) throw new Error(failed.map(result => result.label).join('、') + ' 失败');
}

function printPlan(plan) {
  process.stdout.write('[gate] 模式：' + plan.mode + '\n');
  for (const p of plan.paths) process.stdout.write('[gate] 变更：' + p + '\n');
  for (const reason of plan.reasons) process.stdout.write('[gate] 说明：' + reason + '\n');
  for (const test of plan.tests) process.stdout.write('[gate] 测试：' + test + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--target-tests') {
    const tests = args.slice(1).map(toProjectPath);
    if (!tests.length) throw new Error('test:target 必须指定至少一个 tests/*.test.js 文件');
    for (const test of tests) {
      if (!test.startsWith('tests/') || !test.endsWith('.test.js')
        || !existsSync(path.join(PROJECT_ROOT, test))) throw new Error('无效测试文件：' + test);
    }
    runNode(['node_modules/vitest/vitest.mjs', 'run', ...tests, '--reporter=dot'], '指定 Vitest');
    return;
  }
  const pathIndex = args.indexOf('--paths');
  if (pathIndex < 0 && !args.includes('--staged')) {
    throw new Error('用法：acceptance-gate.mjs --staged|--paths <路径...> --plan|--run');
  }
  const staged = pathIndex < 0 ? stagedChanges() : null;
  if (staged) checkCommitBoundary(staged.paths);  // R1 提交边界守卫：无主物品阻断（26a5254 事故防线）
  // R6：--paths 统一接受空格与逗号分隔（与 workflow verify 的逗号风格互通）。
  const rawPaths = pathIndex >= 0 ? args.slice(pathIndex + 1).filter(a => !a.startsWith('--')) : null;
  const paths = pathIndex >= 0
    ? rawPaths.flatMap(a => a.split(',').map(s => s.trim()).filter(Boolean)) : staged.paths;
  if (pathIndex >= 0 && !paths.length) throw new Error('--paths 后必须给出至少一个项目内路径');
  if (pathIndex >= 0) {
    for (const value of paths) {
      const relative = toProjectPath(value);
      if (!existsSync(path.join(PROJECT_ROOT, relative))) throw new Error('路径不存在：' + value);
    }
  }
  const plan = planForPaths(paths, { packageJsonScriptsOnly: stagedPackageJsonScriptsOnly(paths) });
  if (staged?.needsFull && plan.mode !== 'skip') {
    plan.mode = 'full';
    plan.tests = [];
    plan.reasons.push('暂存包含类型变化（file↔symlink 等），回退完整测试；改名场景由 A+D 组合分支兜住，纯删除按 A 档走定向+架构哨兵');
  }
  if (args.includes('--json')) process.stdout.write(JSON.stringify(plan) + '\n');
  else printPlan(plan);
  if (!args.includes('--run')) return;
  if (plan.mode === 'skip') {
    // 纯文档/样式/图片提交的本地门只剩文档一致性守卫：跳过 Vitest 但不裸放行。
    runNode(['scripts/workflow.mjs', 'docs'], '文档一致性守卫');
    return;
  }
  runNode(['scripts/compile-narrative.mjs'], '剧情编译');
  if (staged) stagedChanges();
  await runStaticChecks();
  const testArgs = ['node_modules/vitest/vitest.mjs', 'run',
    ...(plan.mode === 'quick' ? plan.tests : []), '--reporter=dot', '--silent'];
  runNode(testArgs, plan.mode === 'quick' ? '定向 Vitest（完整测试留给 CI/阶段收尾）' : '全量 Vitest');
  if (staged) stagedChanges();
  process.stdout.write('[gate] PASS：' + plan.mode + ' 验收完成\n');
}

if (SCRIPT_PATH) {
  // main 是 async：同步 try/catch 捕不到 rejection，必须挂 catch 才能输出 [gate] FAIL 而非裸堆栈。
  main().catch(error => {
    console.error('[gate] FAIL：' + error.message);
    process.exitCode = 1;
  });
}
