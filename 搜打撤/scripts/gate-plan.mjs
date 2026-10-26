// Root-scoped test selection and module graph; no command execution or receipt verification.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { analyzeModule } from './architecture-graph.mjs';

function requiredRoot(root) {
  if (typeof root !== 'string' || !root || !path.isAbsolute(root)) throw new Error('planner 必须显式提供绝对项目 root');
  return path.resolve(root);
}

const GUARDS = ['tests/architecture-boundaries.test.js', 'tests/contracts.test.js'];
const TEST_LIMIT = 30;
const NEAR_LIMIT = 12;
const AGENT_TOOL_TESTS = new Map([
  ['game/tools/agent-compare.mjs', ['tests/agent-compare-provenance.test.js']],
  ['game/tools/agent-compare-provenance.mjs', ['tests/agent-compare-provenance.test.js']],
  ['game/tools/agent-run-provenance.mjs', ['tests/agent-run-provenance.test.js']],
]);
// Known tools have direct contracts; other scripts retain contract/reference/sentinel fallback.
export const WORKFLOW_TESTS = new Map([
  ['scripts/test-changed.mjs', ['tests/test-changed.test.js', 'tests/acceptance-gate.test.js']],
  ['scripts/test-timing-reporter.mjs', ['tests/test-timing-reporter.test.js']],
  ['scripts/asset-manifest-source.mjs', ['tests/asset-manifest-source.test.js']],
  ['scripts/css-component-scopes.mjs', ['tests/css-component-scopes.test.js']],
  ['scripts/dependency-audit-diagnostics.mjs', ['tests/dependency-audit-diagnostics.test.js']],
  ['scripts/check-type-coverage.mjs', ['tests/type-coverage.test.js', 'tests/workflow-cli-integration.test.js']],
  ['scripts/build-artifact-manifest.mjs', ['tests/build-artifact-manifest.test.js']],
  ['scripts/video-review.mjs', ['tests/video-review.test.js']],
  ['scripts/runtime-trace-alignment.mjs', ['tests/runtime-trace-alignment.test.js']],
  ['scripts/workflow.mjs', ['tests/workflow-cli-integration.test.js', 'tests/workflow-tools.test.js', 'tests/workflow-task.test.js']],
  ['scripts/workflow-task.mjs', ['tests/workflow-task.test.js']],
  ['scripts/workflow-task-input.mjs', ['tests/workflow-task-input.test.js', 'tests/docs-consistency.test.js', 'tests/workflow-cli-integration.test.js']],
  ['scripts/workflow-doctor.mjs', ['tests/workflow-doctor.test.js', 'tests/workflow-cli-integration.test.js']],
  ['scripts/workflow-evidence.mjs', ['tests/workflow-scope.test.js', 'tests/workflow-tools.test.js', 'tests/workflow-change-review.test.js']],
  ['scripts/workflow-change-advice.mjs', ['tests/workflow-change-review.test.js']],
  ['scripts/workflow-change-review.mjs', ['tests/workflow-change-review.test.js']],
  ['scripts/workflow-dependencies.mjs', ['tests/workflow-dependencies.test.js', 'tests/workflow-scope.test.js']],
  ['scripts/workflow-status.mjs', ['tests/workflow-handoff.test.js', 'tests/workflow-tools.test.js']],
  ['scripts/handoff-brief.mjs', ['tests/workflow-handoff.test.js']],
  ['scripts/workflow-ledger.mjs', ['tests/workflow-tools.test.js', 'tests/workflow-task.test.js']],
  ['scripts/registry-paths.mjs', ['tests/workflow-handoff.test.js', 'tests/impact-query.test.js', 'tests/acceptance-gate.test.js']],
  ['scripts/gate-plan.mjs', ['tests/acceptance-gate.test.js', 'tests/impact-query.test.js', 'tests/quality-config.test.js']],
  ['scripts/workflow-browser.mjs', ['tests/workflow-browser.test.js']],
  ['scripts/visible-playback.mjs', ['tests/visible-playback.test.js']],
  ['scripts/workflow-memory.mjs', ['tests/workflow-memory.test.js', 'tests/workflow-handoff.test.js']],
  ['scripts/workflow-staged.mjs', ['tests/workflow-staged.test.js']],
  ['scripts/workflow-gate-receipt.mjs', ['tests/workflow-gate-receipt.test.js', 'tests/workflow-staged.test.js']],
  ['scripts/workflow-ship.mjs', ['tests/workflow-ship.test.js']],
  ['scripts/index-validation.mjs', ['tests/workflow-index.test.js', 'tests/workflow-cli-integration.test.js']],
  ['scripts/workflow-archive.mjs', ['tests/workflow-tools.test.js']],
  ['scripts/acceptance-gate.mjs', ['tests/acceptance-gate.test.js']],
  ['scripts/impact-query.mjs', ['tests/impact-query.test.js']],
  ['scripts/architecture-graph.mjs', ['tests/architecture-boundaries.test.js', 'tests/contracts.test.js']],
  ['scripts/generate-compendium.mjs', ['tests/compendium.test.js']],
  ['scripts/asset-audit.cjs', ['tests/asset-audit.test.js']],
  ['scripts/asset-audit-lib.cjs', ['tests/asset-audit.test.js']],
  ['scripts/runtime-asset-aliases.mjs', ['tests/runtime-asset-aliases.test.js', 'tests/rations-thumbnail-alias.test.js']],
  ['scripts/runtime-asset-publication.mjs', ['tests/runtime-asset-publication.test.js', 'tests/rations-thumbnail-alias.test.js']],
  ['scripts/runtime-asset-redundancy.mjs', ['tests/runtime-asset-redundancy.test.js', 'tests/runtime-asset-redundancy-plugin.test.js']],
  ['scripts/runtime-asset-redundancy-review.mjs', ['tests/runtime-asset-redundancy.test.js', 'tests/runtime-asset-redundancy-plugin.test.js']],
  ['scripts/css-asset-minification.mjs', ['tests/css-asset-minification.test.js']],
  ['scripts/css-redundancy-audit.mjs', ['tests/css-redundancy-audit.test.js']],
  ['scripts/sync-cards-from-live.mjs', ['tests/sync-cards-from-live.test.js', 'tests/schema-op-coverage.test.js', 'tests/contracts.test.js']],
]);
// R2（2026-10-01 拍板）：明确不配专属映射的脚本——回退脚本契约测试+引用搜索+哨兵，不再全量。
// 登记在这里的脚本已被 scripts-contract.test.js 的映射守卫覆盖（防新脚本无声漏网）。
export const EXEMPT_SCRIPTS = new Set([
  'scripts/check-syntax.mjs',           // 门内静态检查自身；语法契约由契约测试覆盖
  'scripts/check-types.mjs',            // 门内静态检查自身；配置以该脚本 configs 清单为准
  'scripts/check-version.cjs',          // 版本核对小工具
  'scripts/compile-narrative.mjs',      // 门内剧情编译步骤自身
  'scripts/doc-retirement-candidates.mjs', // 手动文档退役候选报告
  'scripts/electron-gpu-info.cjs',      // 桌面版冻结域工具
  'scripts/electron-title-smoke.mjs',   // 桌面版冻结域工具
  'scripts/iab-drive.mjs',              // 内置浏览器驱动（手动验收路径）
  'scripts/perf-benchmark.cjs',         // 手动性能基准
  'scripts/perf-budget.cjs',            // build 后置步骤（build 链路自带验证）
  'scripts/perf-ledger-capture.mjs',    // 手动性能台账采集
  'scripts/setup-commit-gate.mjs',      // 一次性 hooks 安装工具
  'scripts/validate-data.mjs',          // 门内数据校验自身
  'scripts/web-up.mjs',                 // 起服工具（幂等已实机验证）
]);
export const SCRIPT_CONTRACT_TEST = 'tests/scripts-contract.test.js';
// Changes to checks themselves must not silently skip the checks they control.
function isQualityConfigPath(p) {
  return /^(?:eslint|vitest|vite|jsconfig|tsconfig)(?:\.[^/]+)?\.(?:js|mjs|cjs|json)$/.test(p)
    || p === '.githooks/pre-commit';
}
export function isGateRelevantPath(p) {
  return ['game/src/', 'game/data/', 'game/tools/', 'game/assets/', 'tests/', 'scripts/', 'narrative/'].some(prefix => p.startsWith(prefix))
    || ['package.json', 'package-lock.json', 'vite.config.js', 'docs/asset-audit-debt.json'].includes(p) || isQualityConfigPath(p);
}
// 剧情源文件没有 JS 模块依赖图可走：定向到全书生成对比，编译错误由门内剧情编译步骤兜底。
const NARRATIVE_TESTS = ['tests/compendium.test.js'];
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

export function toProjectPath(value, root) {
  root = requiredRoot(root);
  let result = value.replaceAll('\\', '/').replace(/^\.\//, '');
  if (path.isAbsolute(value)) {
    result = path.relative(root, path.resolve(value)).replaceAll('\\', '/');
  }
  if (result.startsWith('搜打撤/')) result = result.slice('搜打撤/'.length);
  const normalized = path.relative(root, path.resolve(root, result)).replaceAll('\\', '/');
  if (normalized.startsWith('../') || normalized === '..' || path.isAbsolute(normalized)) {
    throw new Error('路径不在 Vite 项目内：' + value);
  }
  return normalized;
}

function walkJs(root, relativeDir, extensions = ['.js']) {
  const result = [];
  const visit = dir => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const next = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) visit(next);
      else if (extensions.some(ext => next.endsWith(ext))) result.push(next);
    }
  };
  visit(relativeDir);
  return result;
}

// 导出复用：影响面查询（scripts/impact-query.mjs）与 quick 门同源同口径，不另建解析。
export function reverseImports(root) {
  root = requiredRoot(root);
  const files = [...walkJs(root, 'game/src'), ...walkJs(root, 'tests'), ...walkJs(root, 'game/data', ['.json'])];
  const fileSet = new Set(files);
  const reverse = new Map();
  for (const filename of files) {
    const source = readFileSync(path.join(root, filename), 'utf8');
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
  const visited = new Map([[filename, 0]]);
  const queue = [[filename, 0]];
  while (queue.length) {
    const [current, distance] = queue.shift();
    if (distance >= hops) continue;
    for (const importer of reverse.get(current) || []) {
      const helper = importer.startsWith('tests/') && !importer.endsWith('.test.js');
      const nextDistance = distance + (helper ? 0 : 1);
      if (visited.has(importer) && visited.get(importer) <= nextDistance) continue;
      visited.set(importer, nextDistance);
      if (importer.startsWith('tests/') && importer.endsWith('.test.js')) found.add(importer);
      // Test fixtures are transparent adapters, not another production impact hop.
      else if (helper || importer.startsWith('game/src/')) queue.push([importer, nextDistance]);
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

export function scriptsLocalRefs(scripts) {
  const refs = new Set();
  for (const command of Object.values(scripts || {})) {
    for (const token of String(command).split(/\s+/)) {
      if (/^(scripts|game\/tools)\//.test(token) || /\.(mjs|cjs)$/.test(token)) refs.add(token);
    }
  }
  return [...refs];
}

export function planForPaths(inputPaths, options = {}) {
  const root = requiredRoot(options.root);
  const paths = [...new Set(inputPaths.map(value => toProjectPath(value, root)))].sort();
  const relevant = paths.filter(isGateRelevantPath);
  if (!relevant.length) return { mode: 'skip', paths, reasons: ['没有验收门路径变更'], tests: [] };
  if (relevant.every(p => p.startsWith('game/assets/'))) {
    return { mode: 'quick', paths, reasons: ['纯资产变更：运行编译、静态检查与增量素材检查，跳过 Vitest'], tests: [] };
  }

  const reasons = [];
  if (relevant.some(isQualityConfigPath)) reasons.push('质量配置或提交钩子变更需要完整静态检查与全量测试');
  const tests = new Set();
  if (relevant.includes('docs/asset-audit-debt.json')) tests.add('tests/asset-audit.test.js');
  const source = relevant.filter(p => p.startsWith('game/src/'));
  const dataFiles = relevant.filter(p => p.startsWith('game/data/'));
  const tools = relevant.filter(p => p.startsWith('game/tools/'));
  const scripts = relevant.filter(p => p.startsWith('scripts/'));
  const changedTests = relevant.filter(p => p.startsWith('tests/') && p.endsWith('.test.js'));
  for (const test of changedTests) {
    if (existsSync(path.join(root, test))) tests.add(test);
  }
  if (changedTests.some(test => !existsSync(path.join(root, test)))) {
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
    if (mapped && existsSync(path.join(root, script))
      && mapped.every(test => existsSync(path.join(root, test)))) {
      for (const test of mapped) tests.add(test);
      continue;
    }
    // R2：未映射/豁免/被删脚本回退轻契约（语法+映射守卫）+ 引用搜索 + 哨兵，不再整体全量；
    // 新脚本漏映射由 scripts-contract.test.js 守卫标红，倒逼显式登记。说明延后注入（reasons 非空=全量信号）。
    if (existsSync(path.join(root, SCRIPT_CONTRACT_TEST))) tests.add(SCRIPT_CONTRACT_TEST);
    else reasons.push(SCRIPT_CONTRACT_TEST + ' 缺失，脚本回退下限失效');
    const name = path.posix.basename(script);
    const consumers = walkJs(root, 'tests').filter(candidate => candidate.endsWith('.test.js')
      && readFileSync(path.join(root, candidate), 'utf8').includes(name));
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
    if (!existsSync(path.join(root, tool)) || mappedTests.some(test => !existsSync(path.join(root, test)))) {
      reasons.push(tool + ' 或其定向测试已删除/不可用，回退完整测试');
      continue;
    }
    for (const test of mappedTests) tests.add(test);
  }
  for (const support of relevant.filter(p => p.startsWith('tests/') && !p.endsWith('.test.js'))) {
    const name = path.posix.basename(support);
    const consumers = walkJs(root, 'tests').filter(candidate => candidate.endsWith('.test.js')
      && readFileSync(path.join(root, candidate), 'utf8').includes(name));
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
    try { graph = reverseImports(root); }
    catch (error) {
      return { mode: 'full', paths: relevant, reasons: ['依赖图解析失败：' + error.message], tests: [] };
    }
    for (const file of graphTargets) {
      if (!graph.fileSet.has(file)) {
        // 删除/缺失文件：引用它的测试就是回归网（悬空 import 会当场失败），不再整体回退全量。
        const name = path.posix.basename(file);
        const referenced = walkJs(root, 'tests').filter(candidate => candidate.endsWith('.test.js')
          && readFileSync(path.join(root, candidate), 'utf8').includes(name));
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
