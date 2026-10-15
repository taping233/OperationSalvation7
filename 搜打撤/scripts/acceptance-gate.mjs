#!/usr/bin/env node
// Fast, explicitly partial local gate. CI and phase closeout keep the full suite.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planForPaths as selectPlan, reverseImports as readGraph, toProjectPath as normalizeProjectPath, packageJsonScriptsOnlyDiff, scriptsLocalRefs, isGateRelevantPath } from './gate-plan.mjs';
import { parseUnclaimedPaths } from './registry-paths.mjs';

const SCRIPT_PATH = process.argv[1] && /acceptance-gate\.mjs$/.test(process.argv[1])
  ? path.resolve(process.argv[1]) : null;
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(PROJECT_ROOT, '..');
export const DIRTY_SCAN_ROOTS = ['搜打撤/game/src', '搜打撤/game/tools', '搜打撤/tests'];
export { WORKFLOW_TESTS, EXEMPT_SCRIPTS, SCRIPT_CONTRACT_TEST, packageJsonScriptsOnlyDiff } from './gate-plan.mjs';
export { parseUnclaimedPaths } from './registry-paths.mjs';
export function planForPaths(paths, options = {}) { return selectPlan(paths, { ...options, root: options.root ?? PROJECT_ROOT }); }
export function reverseImports(root = PROJECT_ROOT) { return readGraph(root); }
const toProjectPath = value => normalizeProjectPath(value, PROJECT_ROOT);

function stagedPackageJsonScriptsOnly(paths, frozen = false) {
  const projectPaths = paths.map(toProjectPath);
  if (!projectPaths.includes('package.json')) return false;
  if (!existsSync(path.join(PROJECT_ROOT, 'package.json'))) return false;
  const head = spawnSync('git', ['-C', REPO_ROOT, 'show', 'HEAD:搜打撤/package.json'],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (head.status !== 0) return false;
  const staged = spawnSync('git', ['-C', REPO_ROOT, 'show', ':搜打撤/package.json'],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const current = frozen && staged.status === 0 ? staged.stdout : readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8');
  if (!packageJsonScriptsOnlyDiff(head.stdout, current)) return false;
  const refs = scriptsLocalRefs(JSON.parse(current).scripts);
  return refs.every(ref => existsSync(path.join(PROJECT_ROOT, ref)));
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

function formatDirtyReport(groups) {
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
    if (dirtyCount && !process.env.GATE_MANIFEST_OK) {
      // GATE_MANIFEST_OK 与无主阻断共用同一显式逃生口：他人无主在途改动既不能 add 也不能 stash，
      // 已老板拍板且冻结 index 经 check:staged:isolate 另行验证时，凭此放行（显式+留痕，非静默绕过）。
      throw new Error('存在未暂存/未跟踪/被忽略的 Vite 源码/工具/测试/配置，无法用工作树验证暂存快照'
        + '（未暂存先 add 或 stash；未跟踪属本次就 add，不属就移走；被忽略文件检查是否 ignore 产物挡路；'
        + '无主在途不可动且已 isolate 验证+老板拍板时 GATE_MANIFEST_OK=1 显式放行）：\n'
        + formatDirtyReport(groups).join('\n'));
    }
  }
  // needsFull 只对 T（typechange）生效：R（rename）在上方 --no-renames 输出里被拆成 A+D 组合，
  // 由组合分支兜住——测试改名→「缺失测试」全量；源码改名（引用未同改）→新文件无 importer 全量；
  // 改名+引用同改→语义等价删除+新增（D 走引用哨兵、A 走定向），安全（2026-10-01 演练实证）。
  return { paths, needsFull: entries.some(entry => entry.status === 'T') };
}

function isRelevant(p) {
  return isGateRelevantPath(p);
}

// Hook 的 repo-local Git 环境只属于门进程；Vitest 的临时仓库必须选择自己的索引/对象目录。
// 保留门进程原环境，提交前后的 stagedChanges 继续核对真实 commit index。
export function vitestEnvironment(env = process.env) {
  const childEnv = { ...env };
  const localGitVars = execFileSync('git', ['rev-parse', '--local-env-vars'],
    { cwd: REPO_ROOT, encoding: 'utf8' }).trim().split('\n');
  for (const key of localGitVars) delete childEnv[key];
  delete childEnv.GATE_MANIFEST_OK;
  return childEnv;
}

function runNode(args, label, opts = {}) {
  process.stdout.write('[gate] ' + label + '\n');
  const result = spawnSync(process.execPath, args, { cwd: PROJECT_ROOT, stdio: 'inherit', env: opts.env });
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
    runNodeCaptured(['node_modules/eslint/bin/eslint.js', 'game/src', 'tests', 'scripts', 'game/tools', '*config.{js,mjs,cjs}',
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
  const explicitFull = args.includes('--full');
  const forceFull = args.includes('--force-full');
  if (explicitFull && (args.includes('--paths') || args.includes('--staged') || args.includes('--target-tests'))) throw new Error('--full 不能与 --paths、--staged、--target-tests 混用');
  if (forceFull && (explicitFull || args.includes('--target-tests') || (!args.includes('--staged') && !args.includes('--paths')))) throw new Error('--force-full 只允许与 --staged 或 --paths 混用');
  const receiptIndex = args.indexOf('--reuse');
  const receipt = receiptIndex >= 0 ? args[receiptIndex + 1] : process.env.GATE_RECEIPT;
  if (receiptIndex >= 0 && (!receipt || receipt.startsWith('--'))) throw new Error('--reuse 必须指定冻结 index 报告');
  if (receipt) {
    if (explicitFull || forceFull) throw new Error('显式完整门不能以冻结 quick 证据代替');
    if (!args.includes('--staged') || !args.includes('--run')) throw new Error('证据复用只允许 --staged --run');
    const { stagedPlan } = await import('./workflow-staged.mjs');
    const { verifyGateReceipt } = await import('./workflow-gate-receipt.mjs');
    const frozen = stagedPlan(PROJECT_ROOT, { commitIndex: true });
    checkCommitBoundary([...frozen.changes.map(entry => entry.file), ...frozen.outsideProject.map(entry => entry.file)]);
    const reused = verifyGateReceipt(PROJECT_ROOT, receipt, frozen);
    process.stdout.write('[gate] REUSED：' + reused.report + '（' + reused.mode + '，冻结 index 证据核对通过）\n');
    return;
  }
  if (args[0] === '--target-tests') {
    const tests = args.slice(1).map(toProjectPath);
    if (!tests.length) throw new Error('test:target 必须指定至少一个 tests/*.test.js 文件');
    for (const test of tests) {
      if (!test.startsWith('tests/') || !test.endsWith('.test.js')
        || !existsSync(path.join(PROJECT_ROOT, test))) throw new Error('无效测试文件：' + test);
    }
    runNode(['node_modules/vitest/vitest.mjs', 'run', ...tests, '--reporter=dot'], '指定 Vitest', { env: vitestEnvironment() });
    return;
  }
  const pathIndex = args.indexOf('--paths');
  if (pathIndex < 0 && !args.includes('--staged') && !explicitFull) {
    throw new Error('用法：acceptance-gate.mjs --full|--staged|--paths <路径...> --plan|--run');
  }
  const staged = pathIndex < 0 && !explicitFull ? stagedChanges() : null;
  if (staged) checkCommitBoundary(staged.paths);  // R1 提交边界守卫：无主物品阻断（26a5254 事故防线）
  // R6：--paths 统一接受空格与逗号分隔（与 workflow verify 的逗号风格互通）。
  const rawPaths = pathIndex >= 0 ? args.slice(pathIndex + 1).filter(a => !a.startsWith('--')) : null;
  const paths = pathIndex >= 0
    ? rawPaths.flatMap(a => a.split(',').map(s => s.trim()).filter(Boolean)) : staged?.paths ?? [];
  if (pathIndex >= 0 && !paths.length) throw new Error('--paths 后必须给出至少一个项目内路径');
  if (pathIndex >= 0) {
    for (const value of paths) {
      const relative = toProjectPath(value);
      if (!existsSync(path.join(PROJECT_ROOT, relative))) throw new Error('路径不存在：' + value);
    }
  }
  const plan = explicitFull ? { mode: 'full', paths: [], tests: [], reasons: ['显式完整门：剧情编译、静态检查与完整 Vitest 套件'] }
    : planForPaths(paths, { packageJsonScriptsOnly: stagedPackageJsonScriptsOnly(paths, Boolean(staged)) });
  if (forceFull && paths.length) {
    plan.mode = 'full';
    plan.tests = [];
    plan.reasons.push('强制完整选择：保留暂存边界、混树守卫、剧情编译与静态检查');
  }
  if (staged?.needsFull && plan.mode !== 'skip') {
    plan.mode = 'full';
    plan.tests = [];
    plan.reasons.push('暂存包含类型变化（file↔symlink 等），回退完整测试；改名场景由 A+D 组合分支兜住，纯删除按 A 档走定向+架构哨兵');
  }
  if (args.includes('--json')) process.stdout.write(JSON.stringify(plan) + '\n');
  else printPlan(plan);
  if (!args.includes('--run')) return;
  if (plan.mode === 'skip') {
    // 资产审计指纹按工作树字节登记，隔离副本按 index 对象字节生成（CRLF 归一为 LF），staged 门内必漂移误杀——只在真实工作树门执行，CI 兜底。
    if (!staged) runNode(['scripts/asset-audit.cjs', '--check', '--paths-json', JSON.stringify(plan.paths)], '增量素材检查');
    // 纯文档/样式/图片提交的本地门只剩文档一致性守卫：跳过 Vitest 但不裸放行。
    runNode(['scripts/workflow.mjs', 'docs'], '文档一致性守卫');
    return;
  }
  runNode(['scripts/compile-narrative.mjs'], '剧情编译');
  if (staged) stagedChanges();
  await runStaticChecks();
  // 理由同上：隔离副本字节口径与审计指纹不匹配，staged 门跳过，工作树门与 CI 兜底。
  if (!staged) runNode(['scripts/asset-audit.cjs', '--check', '--paths-json', JSON.stringify(plan.paths)], '增量素材检查');
  const testArgs = ['node_modules/vitest/vitest.mjs', 'run',
    ...(plan.mode === 'quick' ? plan.tests : []), '--reporter=dot', '--silent'];
  if (plan.mode === 'full' || plan.tests.length) {
    // 逃生口只在门进程内生效：Vitest 夹具会经 {...process.env} 继承它，导致混树/无主拒绝
    // 测试被无声放行（10-03 实测泄漏事故）——只对子进程剔除，门进程保留给两次 stagedChanges 复核。
    const childEnv = vitestEnvironment();
    runNode(testArgs, plan.mode === 'quick' ? '定向 Vitest（完整测试留给 CI/阶段收尾）' : '全量 Vitest', { env: childEnv });
  }
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
