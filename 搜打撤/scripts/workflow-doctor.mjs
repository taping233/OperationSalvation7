import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { readLedger } from './workflow-ledger.mjs';
import { validateDocumentation } from './index-validation.mjs';

const PACKAGES = ['vite', 'vitest', 'eslint', 'typescript', 'acorn', 'acorn-walk', 'jsdom'];
const ENTRIES = ['scripts/workflow.mjs', 'scripts/acceptance-gate.mjs', 'node_modules/vitest/vitest.mjs',
  'node_modules/eslint/bin/eslint.js', 'node_modules/typescript/bin/tsc'];
const DOCS = ['README.md', 'docs/README.md', 'docs/QUICKSTART.md', 'docs/WORKFLOW-TOOLS.md', 'docs/quality-gates.md'];
const slash = value => value.replaceAll('\\', '/');
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};

function jsonFile(file, limit = 4 * 1024 * 1024) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw new Error('不是可读取的小型普通 JSON 文件');
  return JSON.parse(readFileSync(file, 'utf8'));
}

function defaultProbe({ program, args, cwd }) {
  return spawnSync(program, args, { cwd, encoding: 'utf8', timeout: 2000, windowsHide: true,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, maxBuffer: 64 * 1024 });
}

/** Local, read-only readiness report. No tests, dependency byte scans or automatic repairs. */
export async function doctor(root, { input, paths, tests, staged = false, probe = defaultProbe } = {}) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('doctor 必须显式提供绝对项目 root');
  root = path.resolve(root);
  if (staged && (paths || tests)) throw new Error('doctor --staged 不能与 --paths/--tests 混用');
  const checks = [];
  let project = null, pkg = null, lock = null, repo = null;
  const check = async (id, required, source, run, suggestion) => {
    const started = performance.now();
    try {
      checks.push({ id, required, source, ...await run(), elapsedMs: Math.round(performance.now() - started) });
    } catch (error) {
      checks.push({ id, required, source, status: required ? 'blocked' : 'warning',
        details: { error: String(error.message).split('\n')[0].slice(0, 240), code: error.code ?? null }, suggestion,
        elapsedMs: Math.round(performance.now() - started) });
    }
  };
  const query = (args, allowMissing = false) => {
    const result = probe({ program: 'git', args, cwd: root });
    if (result.error) throw result.error;
    if (allowMissing && result.status === 1) return null;
    if (result.status !== 0) throw new Error(`Git 只读探测失败（exit ${result.status}）`);
    return String(result.stdout ?? '').trim();
  };
  await check('project', true, 'package.json', () => {
    pkg = jsonFile(path.join(root, 'package.json'));
    project = { name: pkg.name, version: pkg.version, root };
    if (pkg.name !== 'codename7-soudache-game' || pkg.type !== 'module') throw new Error('项目身份不符合搜打撤 Vite 工程，核对 root');
    return { status: 'passed', details: project };
  }, '定位搜打撤 Vite 根目录；不初始化或覆盖现有项目');
  await check('node', true, 'current process', () => ({ status: 'passed',
    details: { version: process.version, platform: process.platform, arch: process.arch } }));
  await check('git', true, 'git --version', () => ({ status: 'passed', details: { version: query(['--version']) } }), '确认当前终端能执行 Git；EPERM 应核对执行权限');
  await check('repository', true, 'git rev-parse --show-toplevel', () => {
    repo = query(['rev-parse', '--show-toplevel']);
    if (!repo || !inside(path.resolve(repo), root)) throw new Error('项目 root 不在探测到的 Git 仓库内');
    return { status: 'passed', details: { root: repo, prefix: slash(path.relative(repo, root)) } };
  }, '核对项目与 Git 工作区定位，不创建新仓库');
  await check('npm', false, 'npm --version', () => {
    const command = process.platform === 'win32' ? { program: 'cmd.exe', args: ['/d', '/c', 'npm', '--version'] } : { program: 'npm', args: ['--version'] };
    const result = probe({ ...command, cwd: root });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`npm 只读探测失败（exit ${result.status}）`);
    return { status: 'passed', details: { version: String(result.stdout ?? '').trim() } };
  }, '核对 npm 入口；可先使用现有 Node 直接执行项目脚本');
  await check('lockfile', true, 'package-lock.json', () => {
    lock = jsonFile(path.join(root, 'package-lock.json'));
    if (!lock.packages || !lock.lockfileVersion) throw new Error('锁文件缺少 packages 或 lockfileVersion');
    return { status: 'passed', details: { version: lock.lockfileVersion } };
  }, '核对现有锁文件，安装或修改依赖须沿当前授权');
  await check('dependencies', true, 'node_modules/*/package.json + package-lock.json', () => {
    const names = [...new Set([...PACKAGES, ...Object.keys(pkg?.dependencies ?? {}), ...Object.keys(pkg?.devDependencies ?? {})])];
    const modules = path.join(root, 'node_modules');
    const linked = lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
    const packages = names.map(name => {
      const file = path.join(root, 'node_modules', name, 'package.json');
      const installed = existsSync(file) ? jsonFile(file, 128 * 1024) : null;
      return { name, installed: installed?.version ?? null, locked: lock?.packages?.['node_modules/' + name]?.version ?? null,
        declared: pkg?.devDependencies?.[name] ?? pkg?.dependencies?.[name] ?? null, nodeRange: installed?.engines?.node ?? null };
    });
    const missing = packages.filter(item => !item.installed);
    const mismatched = packages.filter(item => item.installed && item.locked && item.installed !== item.locked);
    return { status: missing.length ? 'blocked' : mismatched.length ? 'warning' : 'passed', details: { packages, nodeModules: { linked, targetReadable: existsSync(modules) },
      missing: missing.map(item => item.name), mismatched: mismatched.map(item => item.name),
      engines: '仅展示已安装依赖声明；不推断所有版本范围兼容性，不扫描依赖字节' },
      ...(missing.length || mismatched.length ? { suggestion: '核对现有 node_modules 与锁文件；缺失项按任务授权补齐' } : {}) };
  }, '核对项目内关键工具及全部直接依赖文件，不执行安装');
  await check('entrypoints', true, 'known local command paths', () => {
    const entries = ENTRIES.map(file => ({ file, present: existsSync(path.join(root, file)) && lstatSync(path.join(root, file)).isFile() }));
    return { status: entries.every(item => item.present) ? 'passed' : 'blocked', details: { entries }, suggestion: '只修复缺失的对应入口；不运行测试或 build' };
  });
  await check('hooks', false, 'core.hooksPath + git --git-path hooks/pre-commit', () => {
    if (!repo) return { status: 'not-checked', details: { reason: '仓库定位不可用，未继续探测 hooks' } };
    const configured = query(['config', '--show-origin', '--get', 'core.hooksPath'], true);
    const raw = query(['rev-parse', '--git-path', 'hooks/pre-commit']);
    const effective = path.resolve(root, raw);
    const expected = path.join(root, '.githooks/pre-commit');
    const same = process.platform === 'win32' ? effective.toLowerCase() === expected.toLowerCase() : effective === expected;
    const scoped = inside(path.resolve(repo), effective);
    const present = scoped && existsSync(effective) && lstatSync(effective).isFile();
    return { status: same && present ? 'passed' : 'warning', details: { configured, effective, expected,
      present: scoped ? present : null, outsideRepository: !scoped },
      ...(same && present ? {} : { suggestion: '核对生效提交钩子；setup-commit-gate 修改共享 Git 配置，须按授权从主工作区处理' }) };
  });
  await check('documentation', true, 'validateDocumentation(root)', () => {
    const missing = DOCS.filter(file => !existsSync(path.join(root, file)));
    const result = validateDocumentation(root);
    const blocking = result.findings.filter(item => !item.review), review = result.findings.filter(item => item.review);
    return { status: missing.length || !result.ok ? 'blocked' : review.length ? 'warning' : 'passed',
      details: { missing, scannedFiles: result.scannedFiles.length, checkedRelativeLinks: result.checkedRelativeLinks, blocking, review },
      suggestion: '仅按文档检查发现修目标链接、预算或契约；人工复核提示不等同阻断' };
  });
  await check('registry', true, 'docs/PARALLEL-REGISTRY.md', () => {
    const ledger = readLedger(root, 'registry');
    return { status: 'info', details: { counts: ledger.counts, editing: ledger.groups.editing.map(row => ({ key: row.key, owner: row.cells[0], territory: row.cells[1] })),
      completed: ledger.groups['complete-uncommitted'].map(row => ({ key: row.key, owner: row.cells[0] })),
      note: '活动占用需按目标协调；完成未提交保护归属，不是系统错误' } };
  });
  await check('pending', true, 'docs/PENDING.md', () => ({ status: 'info', details: { counts: readLedger(root, 'pending').counts,
    note: '有效待决与已决待移行分开，不自动催办或销账' } }));
  await check('evidence', false, input ? 'explicit project evidence input' : 'not requested', () => {
    if (!input) return { status: 'not-checked', details: { currentEligibility: 'not-checked', reason: '未指定报告；没有新报告不构成故障' } };
    const file = path.resolve(root, input), relative = slash(path.relative(root, file));
    if (!inside(root, file) || !relative.startsWith('docs/evidence/') || !relative.endsWith('.json')
      || !inside(realpathSync(root), realpathSync(file))) throw new Error('报告须是当前项目 docs/evidence 内的 JSON 文件');
    const report = jsonFile(file, 1024 * 1024);
    if (!['automated-local-check', 'staged-snapshot-check'].includes(report.kind)) throw new Error('未识别的验收报告类型');
    return { status: 'info', details: { file: relative, kind: report.kind, recordedOutcome: report.outcome ?? null,
      recordedExitCode: report.exitCode ?? null, recordedEndedAt: report.endedAt ?? null,
      recordedMode: report.validation?.mode ?? report.gate?.mode ?? null, currentEligibility: 'not-checked',
      note: '仅记录元数据，未验证日志、当前输入/index、环境或依赖字节；历史通过不等于当前资格' },
      suggestion: '深入资格使用 workflow evidence --input <本报告>；doctor 不生成或承诺证明' };
  });
  if (staged) await check('staged-readiness', true, 'stagedPlan(root)', async () => {
    if (!repo) return { status: 'blocked', details: { canRun: false, mode: 'unavailable',
      executed: false, passed: false, reason: 'Git 仓库不可用；恢复副本不能证明 HEAD/index' },
      suggestion: '在真实 Git 工作区运行 doctor --staged；不初始化恢复副本来冒充原仓库' };
    const { stagedPlan } = await import('./workflow-staged.mjs');
    const plan = stagedPlan(root);
    return { status: plan.blocked.length ? 'blocked' : 'info', details: {
      canRun: plan.blocked.length === 0 && plan.changes.length > 0
        && !checks.some(item => item.required && item.status === 'blocked'), mode: plan.mode,
      executed: false, passed: false, reusableReceipt: false,
      blocked: plan.blocked, changedPaths: plan.changes.map(entry => entry.path),
      dependencyCount: Object.keys(plan.dependencies.versions).length,
      nextAction: plan.nextAction },
      suggestion: '冻结预检只核 index/锁依赖；精确测试选择仍由隔离快照中的现有门决定，未运行测试或实页' };
  }, '修复 Git/index/锁依赖阻塞后重试；不运行完整检查、不自动安装');
  if (paths || tests) await check('selection', true, 'previewCheck(root, options)', async () => {
    const { previewCheck } = await import('./workflow-evidence.mjs');
    const result = previewCheck(root, { paths, tests });
    return { status: 'passed', details: result };
  }, '修正验证路径/测试列表；预览不是执行证据');
  await check('ci', false, 'not queried', () => ({ status: 'not-checked', details: { reason: '未查询远端 CI；无 CI 或无本轮覆盖不构成本地系统错误' } }));
  const summary = Object.fromEntries(['passed', 'warning', 'blocked', 'info', 'not-checked'].map(status => [status, checks.filter(item => item.status === status).length]));
  return { schemaVersion: 1, ok: !checks.some(item => item.required && item.status === 'blocked'), root, project, checks, summary,
    limits: ['只读当前项目管理环境；单项失败隔离，未自动修复或安装', '未运行测试、build、服务或提交，未修改 index/配置/台账',
      '默认核关键工具及全部直接依赖版本与入口；--staged 复用冻结锁检查，不等于依赖字节或 engines 已验证', '未计算整项目指纹；未核当前证明复用资格或远端 CI'] };
}
