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
const TEST_LIMIT = 20;
const NEAR_LIMIT = 12;
const AGENT_TOOL_TESTS = new Map([
  ['game/tools/agent-compare.mjs', ['tests/agent-compare-provenance.test.js']],
  ['game/tools/agent-compare-provenance.mjs', ['tests/agent-compare-provenance.test.js']],
  ['game/tools/agent-run-provenance.mjs', ['tests/agent-run-provenance.test.js']],
]);
// Known project workflow tools have direct contracts; unknown scripts still require full validation.
const WORKFLOW_TESTS = new Map([
  ['scripts/workflow.mjs', ['tests/workflow-cli-integration.test.js', 'tests/workflow-tools.test.js', 'tests/workflow-task.test.js']],
  ['scripts/workflow-task.mjs', ['tests/workflow-task.test.js']],
  ['scripts/workflow-evidence.mjs', ['tests/workflow-scope.test.js', 'tests/workflow-tools.test.js']],
  ['scripts/workflow-status.mjs', ['tests/workflow-handoff.test.js', 'tests/workflow-tools.test.js']],
  ['scripts/handoff-brief.mjs', ['tests/workflow-handoff.test.js']],
  ['scripts/workflow-ledger.mjs', ['tests/workflow-tools.test.js', 'tests/workflow-task.test.js']],
  ['scripts/workflow-browser.mjs', ['tests/workflow-browser.test.js']],
  ['scripts/workflow-memory.mjs', ['tests/workflow-memory.test.js', 'tests/workflow-handoff.test.js']],
  ['scripts/workflow-staged.mjs', ['tests/workflow-staged.test.js']],
  ['scripts/index-validation.mjs', ['tests/workflow-index.test.js', 'tests/workflow-cli-integration.test.js']],
  ['scripts/page-snapshot.mjs', ['tests/workflow-cli-integration.test.js']],
  ['scripts/workflow-archive.mjs', ['tests/workflow-tools.test.js']],
]);
export const DIRTY_SCAN_ROOTS = ['搜打撤/game/src', '搜打撤/game/tools', '搜打撤/tests'];
const FULL_SOURCE = [
  /^game\/src\/(main|boot-order|game\.boot)\.js$/,
  /^game\/src\/core\//,
  /^game\/src\/hub\/(base|game\.storage|game\.bag\.settle|battle-settlement)/,
  /^game\/src\/hub\/game\.store\.js$/,
  /^game\/src\/run\/game\.session/,
  /^game\/src\/battle\/(battle\.core|battle\.engine|battle\.runtime)/,
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

function walkJs(relativeDir) {
  const result = [];
  const visit = dir => {
    for (const entry of readdirSync(path.join(PROJECT_ROOT, dir), { withFileTypes: true })) {
      const next = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) visit(next);
      else if (next.endsWith('.js')) result.push(next);
    }
  };
  visit(relativeDir);
  return result;
}

function reverseImports() {
  const files = [...walkJs('game/src'), ...walkJs('tests')];
  const fileSet = new Set(files);
  const reverse = new Map();
  for (const filename of files) {
    const source = readFileSync(path.join(PROJECT_ROOT, filename), 'utf8');
    const imports = analyzeModule(source, filename).imports;
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

export function planForPaths(inputPaths) {
  const paths = [...new Set(inputPaths.map(toProjectPath))].sort();
  const relevant = paths.filter(p => p.startsWith('game/src/') || p.startsWith('game/data/')
    || p.startsWith('game/tools/') || p.startsWith('tests/') || p.startsWith('scripts/') || p.startsWith('narrative/')
    || p === 'package.json' || p === 'package-lock.json' || p === 'vite.config.js');
  if (!relevant.length) return { mode: 'skip', paths, reasons: ['没有验收门路径变更'], tests: [] };

  const reasons = [];
  const tests = new Set();
  const source = relevant.filter(p => p.startsWith('game/src/'));
  const tools = relevant.filter(p => p.startsWith('game/tools/'));
  const scripts = relevant.filter(p => p.startsWith('scripts/'));
  const changedTests = relevant.filter(p => p.startsWith('tests/') && p.endsWith('.test.js'));
  for (const test of changedTests) tests.add(test);
  if (changedTests.some(test => !existsSync(path.join(PROJECT_ROOT, test)))) {
    reasons.push('测试文件被删除或当前路径不可用');
  }

  if (relevant.some(p => p.startsWith('game/data/')
    || p.startsWith('narrative/') || ['package.json', 'package-lock.json', 'vite.config.js'].includes(p))) {
    reasons.push('数据、工具或测试配置变更需要全量测试');
  }
  for (const script of scripts) {
    const mapped = WORKFLOW_TESTS.get(script);
    if (!mapped || !existsSync(path.join(PROJECT_ROOT, script)) || mapped.some(test => !existsSync(path.join(PROJECT_ROOT, test)))) {
      reasons.push(script + ' 无完整直接契约，回退全量');
    } else for (const test of mapped) tests.add(test);
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
  if (relevant.some(p => p.startsWith('tests/') && !p.endsWith('.test.js'))) {
    reasons.push('测试依赖或 fixture 变更需要全量测试');
  }
  if (source.some(p => !p.endsWith('.js') || FULL_SOURCE.some(pattern => pattern.test(p)))) {
    reasons.push('公共状态、启动、规则或迁移边界变更需要全量测试');
  }
  if (reasons.length) return { mode: 'full', paths: relevant, reasons, tests: [] };

  if (source.length) {
    let graph;
    try { graph = reverseImports(); }
    catch (error) {
      return { mode: 'full', paths: relevant, reasons: ['依赖图解析失败：' + error.message], tests: [] };
    }
    for (const file of source) {
      if (!graph.fileSet.has(file)) {
        reasons.push(file + ' 已删除或不是可解析的源码文件');
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
  if (reasons.some(reason => reason.includes('没有可确认') || reason.includes('已删除'))) {
    return { mode: 'full', paths: relevant, reasons, tests: [] };
  }
  if (tests.size > TEST_LIMIT) {
    return { mode: 'full', paths: relevant, reasons: ['定向测试超过 ' + TEST_LIMIT + ' 个文件'], tests: [] };
  }
  if (!tests.size) {
    return { mode: 'full', paths: relevant, reasons: ['变更未找到可运行的定向测试'], tests: [] };
  }
  return { mode: 'quick', paths: relevant, reasons, tests: [...tests].sort() };
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

function stagedChanges() {
  const entries = parseStagedStatus(gitPathFields(['diff', '--cached', '--name-status', '--no-renames', '-z']));
  const paths = entries.map(entry => entry.path);
  const stagedRelevant = paths.map(toProjectPath).filter(isRelevant);
  if (stagedRelevant.length) {
    const dirty = [...gitPathFields(['diff', '--name-only', '--no-renames', '-z']),
      ...gitPathFields(['ls-files', '--others', '--exclude-standard', '-z']),
      ...gitPathFields(['ls-files', '--others', '--ignored', '--exclude-standard', '-z',
        '--', ...DIRTY_SCAN_ROOTS])]
      .map(toProjectPath).filter(isRelevant);
    if (dirty.length) {
      throw new Error('存在未暂存的 Vite 源码/工具/测试/配置，无法用工作树验证暂存快照：'
        + [...new Set(dirty)].slice(0, 8).join(', '));
    }
  }
  return { paths, needsFull: entries.some(entry => !['A', 'M'].includes(entry.status)) };
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
    runNodeCaptured(['node_modules/eslint/bin/eslint.js', 'game/src', 'tests', 'scripts/acceptance-gate.mjs'], 'ESLint'),
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
  const paths = pathIndex >= 0 ? args.slice(pathIndex + 1).filter(a => !a.startsWith('--')) : staged.paths;
  if (pathIndex >= 0 && !paths.length) throw new Error('--paths 后必须给出至少一个项目内路径');
  if (pathIndex >= 0) {
    for (const value of paths) {
      const relative = toProjectPath(value);
      if (!existsSync(path.join(PROJECT_ROOT, relative))) throw new Error('路径不存在：' + value);
    }
  }
  const plan = planForPaths(paths);
  if (staged?.needsFull && plan.mode !== 'skip') {
    plan.mode = 'full';
    plan.tests = [];
    plan.reasons.push('暂存包含删除、类型变化或重命名，回退完整测试');
  }
  printPlan(plan);
  if (!args.includes('--run') || plan.mode === 'skip') return;
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
  try { main(); }
  catch (error) { console.error('[gate] FAIL：' + error.message); process.exitCode = 1; }
}
