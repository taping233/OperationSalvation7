import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hash } from './workflow-ledger.mjs';
import { currentDocuments, filesUnder, git } from './workflow-status.mjs';
import { dependencyScope, inputInventory } from './workflow-dependencies.mjs';
import { toProjectPath } from './gate-plan.mjs';

const WATCHED = ['game/src', 'game/data', 'game/css', 'game/tools', 'tests', 'scripts', 'narrative'];
const STATE_FILES = ['docs/PARALLEL-REGISTRY.md', 'docs/PENDING.md', 'docs/STATUS.md'];

function groupForFile(file) {
  const normalized = file.replaceAll('\\', '/');
  if (normalized === 'docs/asset-audit-debt.json') return 'code';
  if (STATE_FILES.includes(normalized) || /^docs\/evidence\/[^/]+\/task\.json$/.test(normalized)) return 'state';
  if (normalized.startsWith('docs/') || ['README.md', 'AGENTS.md', '../AGENTS.md'].includes(normalized)) return 'docs';
  return 'code';
}

function scopeGroups(snapshot) {
  if (!Array.isArray(snapshot.manifest) || !snapshot.environment || typeof snapshot.environment !== 'object'
    || snapshot.manifest.some(entry => typeof entry.file !== 'string' || typeof entry.sha256 !== 'string')) return null;
  const grouped = { code: [], docs: [], state: [] };
  for (const entry of [...snapshot.manifest].sort((a, b) => a.file.localeCompare(b.file))) grouped[groupForFile(entry.file)].push(entry);
  return { ...Object.fromEntries(Object.entries(grouped).map(([name, entries]) => [name, hash(JSON.stringify(entries))])),
    environment: hash(JSON.stringify(snapshot.environment)) };
}

function stateTaskFiles(root) {
  const evidence = path.join(root, 'docs/evidence');
  if (!existsSync(evidence)) return [];
  return readdirSync(evidence, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry =>
    'docs/evidence/' + entry.name + '/task.json').filter(file => existsSync(path.join(root, file)));
}

function coversDocuments(snapshot) {
  return snapshot.documents === true || snapshot.manifest?.some(entry => groupForFile(entry.file) === 'docs');
}

export function safeId(value) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(value ?? '')) throw new Error('任务编号须为 1–80 位字母、数字、连字符');
  return value;
}

export function fingerprint(root, { documents = false, roots, assets = false } = {}) {
  const selection = roots?.length ? dependencyScope(root, roots) : { mode: 'project', roots: [], reason: '完整项目范围' };
  const files = selection.mode === 'targeted' ? [...selection.files] : [...WATCHED.flatMap(directory => filesUnder(root, directory))];
  if (selection.mode !== 'targeted' || !selection.contracts?.length || !selection.contracts.every(contract => contract.kind === 'fixture')) {
    files.push(...STATE_FILES.filter(file => existsSync(path.join(root, file))), ...stateTaskFiles(root));
  }
  const allDocuments = documents && selection.mode === 'project';
  if (allDocuments) {
    files.push(...currentDocuments(root), ...filesUnder(root, 'docs/archive').filter(file => /\.(?:md|json|html|js|css)$/.test(file)));
    if (existsSync(path.join(root, 'README.md'))) files.push('README.md');
  }
  if (selection.mode === 'project' && existsSync(path.join(root, 'game'))) {
    for (const entry of readdirSync(path.join(root, 'game'), { withFileTypes: true })) {
      if (entry.isFile() && /\.(?:html|js|json)$/.test(entry.name)) files.push('game/' + entry.name);
    }
  }
  for (const file of ['package.json', 'package-lock.json', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs', 'vitest.config.js',
    'vitest.config.mjs', 'vitest.config.cjs', 'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', '.githooks/pre-commit']) {
    if (existsSync(path.join(root, file))) files.push(file);
  }
  if (assets) files.push(...filesUnder(root, 'game/assets'),
    ...['docs/asset-audit-debt.json'].filter(file => existsSync(path.join(root, file))));
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && /^(?:ts|js)config.*\.json$/.test(entry.name)) files.push(entry.name);
  }
  const manifest = [...new Set(files)].sort().map(file => ({ file, sha256: hash(readFileSync(path.join(root, file))) }));
  if (assets) {
    const inventory = [];
    const visit = directory => {
      if (!existsSync(path.join(root, directory))) return;
      for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
        const file = directory + '/' + entry.name;
        inventory.push({ file, kind: entry.isSymbolicLink() ? 'link' : entry.isDirectory() ? 'directory' : 'file',
          ...(entry.isSymbolicLink() ? { target: readlinkSync(path.join(root, file)) } : {}) });
        if (entry.isDirectory() && !entry.isSymbolicLink()) visit(file);
      }
    };
    visit('game/assets');
    inventory.sort((a, b) => a.file.localeCompare(b.file));
    manifest.push({ file: 'game/assets/', kind: 'inventory', sha256: hash(JSON.stringify(inventory)) },
      { file: 'docs/asset-audit-debt.json', kind: 'existence', sha256: hash(existsSync(path.join(root, 'docs/asset-audit-debt.json')) ? 'present' : 'absent') });
  }
  for (const file of selection.existence ?? []) if (!files.includes(file)) {
    manifest.push({ file, kind: 'existence', sha256: hash(existsSync(path.join(root, file)) ? 'present' : 'absent') });
  }
  for (const descriptor of selection.inventories ?? []) manifest.push({ file: descriptor.directory + '/', kind: 'inventory',
    sha256: hash(JSON.stringify(inputInventory(root, descriptor))) });
  manifest.sort((a, b) => a.file.localeCompare(b.file) || (a.kind ?? '').localeCompare(b.kind ?? ''));
  const dependencies = {};
  for (const name of ['vitest', 'vite', 'typescript', 'eslint', 'jsdom', 'acorn', 'acorn-walk']) {
    const location = path.join(root, 'node_modules', name, 'package.json');
    dependencies[name] = existsSync(location) ? JSON.parse(readFileSync(location, 'utf8')).version : null;
  }
  const environment = { node: process.version, platform: process.platform, arch: process.arch, dependencies,
    ci: process.env.CI ?? null, nodeOptions: process.env.NODE_OPTIONS ?? null,
    forceFullTests: process.env.FORCE_FULL_TESTS ?? null };
  const coversDocs = allDocuments || manifest.some(entry => groupForFile(entry.file) === 'docs');
  return { sha256: hash(JSON.stringify({ manifest, environment })), manifest, environment, documents: coversDocs, assets, selection,
    groups: scopeGroups({ manifest, environment }),
    limits: [(assets ? '已锁资产字节与目录；未监控其他图片/声音' : '未监控图片/声音') + '、node_modules 字节、浏览器与机器负载；匹配只表示候选证据，不自动免验'] };
}

export function freshness(report, current) {
  if (report.schemaVersion !== 1 || !report.before || !report.after) throw new Error('不是受支持的验收报告');
  if (report.outcome === 'skip' || report.validation?.mode === 'skip' || report.validation?.executed === false) {
    return { eligibleForReview: false, codeEligibleForReview: false, result: 'skipped',
      parts: {}, recheck: ['validation'], limits: [...(current.limits ?? []), '未执行检查，不是通过证据'] };
  }
  const failed = report.exitCode !== 0 || Boolean(report.signal || report.error);
  const invalid = Boolean(report.before.error || report.after.error || current.error);
  // Derive groups from schema-1 manifests too; stored hashes alone cannot justify dropping scope.
  const before = scopeGroups(report.before), after = scopeGroups(report.after), now = scopeGroups(current);
  if (!before || !after || !now) {
    const changed = report.before.sha256 !== report.after.sha256;
    const matches = Boolean(report.after.sha256) && report.after.sha256 === current.sha256;
    const eligibleForReview = !failed && !invalid && !changed && matches;
    return { eligibleForReview, codeEligibleForReview: eligibleForReview,
      result: failed ? 'failed' : invalid ? 'unverifiable' : changed ? 'changed-during-check' : matches ? 'candidate' : 'stale',
      parts: Object.fromEntries(['code', 'docs', 'state', 'environment'].map(name => [name,
        { status: eligibleForReview ? 'legacy-match' : 'unknown', eligibleForReview }])),
      recheck: eligibleForReview ? [] : ['code', 'docs', 'environment'],
      limits: [...(current.limits ?? []), '旧报告缺少可重新分组的 manifest/环境，只能保守比较整体指纹'] };
  }
  const parts = {};
  for (const name of ['code', 'docs', 'state', 'environment']) {
    const covered = name !== 'docs' || Boolean(coversDocuments(report.before) || coversDocuments(report.after));
    const unavailable = name === 'docs' && covered && !coversDocuments(current);
    const changedDuringCheck = before[name] !== after[name];
    const changedSinceCheck = after[name] !== now[name];
    parts[name] = { before: before[name], after: after[name], current: now[name], covered,
      changedDuringCheck, changedSinceCheck,
      status: !covered ? 'not-covered' : failed ? 'failed' : invalid || unavailable ? 'unverifiable'
        : changedDuringCheck ? 'changed-during-check' : changedSinceCheck ? 'stale' : 'candidate',
      eligibleForReview: covered && !failed && !invalid && !unavailable && !changedDuringCheck && !changedSinceCheck };
  }
  const codeEligibleForReview = parts.code.eligibleForReview && parts.environment.eligibleForReview;
  const docsChanged = parts.docs.covered && !parts.docs.eligibleForReview;
  const stateChanged = parts.state.changedDuringCheck || parts.state.changedSinceCheck;
  const codeChangedDuringCheck = parts.code.changedDuringCheck || parts.environment.changedDuringCheck;
  const recheck = [];
  if (!codeEligibleForReview) recheck.push('code');
  if (invalid || parts.environment.changedDuringCheck || parts.environment.changedSinceCheck) recheck.push('environment');
  if (parts.docs.covered && !parts.docs.eligibleForReview) recheck.push('docs');
  if (stateChanged) recheck.push('state');
  return { eligibleForReview: codeEligibleForReview && !docsChanged, codeEligibleForReview,
    result: failed ? 'failed' : invalid ? 'unverifiable' : codeChangedDuringCheck ? 'changed-during-check'
      : !codeEligibleForReview || docsChanged ? 'stale' : stateChanged ? 'state-changed' : 'candidate',
    parts, recheck, limits: current.limits };
}

export function checkArguments({ tests, paths, full, suite }) {
  if (Number(Boolean(tests)) + Number(Boolean(paths)) + Number(Boolean(full)) + Number(Boolean(suite)) !== 1) throw new Error('必须且只能选 --tests、--paths、--full 或 --suite');
  for (const list of [tests, paths]) if (list && (!Array.isArray(list) || !list.length || list.some(item => typeof item !== 'string' || !item.trim()))) throw new Error('测试/路径列表不能为空');
  if (tests) return ['scripts/acceptance-gate.mjs', '--target-tests', ...tests];
  if (paths) return ['scripts/acceptance-gate.mjs', '--paths', ...paths, '--run'];
  if (suite) return ['node_modules/vitest/vitest.mjs', 'run', '--reporter=dot', '--silent'];
  return ['scripts/acceptance-gate.mjs', '--full', '--run'];
}

/** Read-only selection before fingerprints, evidence files or execution. */
export function previewCheck(root, options) {
  checkArguments(options);
  const normalized = { ...options };
  for (const key of ['tests', 'paths']) if (options[key]) {
    normalized[key] = options[key].map(file => toProjectPath(file, root));
    for (const file of normalized[key]) {
      if (!existsSync(path.join(root, file))) throw new Error('路径不存在：' + file);
      if (key === 'tests' && (!file.startsWith('tests/') || !file.endsWith('.test.js') || !statSync(path.join(root, file)).isFile())) throw new Error('无效测试文件：' + file);
    }
  }
  const args = checkArguments(normalized);
  const executable = path.join(root, args[0]);
  if (!existsSync(executable) || !statSync(executable).isFile()) throw new Error('验证入口不存在：' + args[0]);
  let selection;
  if (normalized.tests) selection = { mode: 'targeted', paths: [], tests: normalized.tests, reasons: ['显式测试列表'] };
  else if (normalized.suite) selection = { mode: 'suite', paths: [], tests: [], reasons: ['显式完整 Vitest 套件；不包含静态门'] };
  else {
    const result = spawnSync(process.execPath, [...args.filter(arg => arg !== '--run'), '--plan', '--json'], { cwd: root, encoding: 'utf8', timeout: 15000 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('验证预检失败：' + (result.stderr || result.stdout || `exit ${result.status}`).trim());
    selection = JSON.parse(result.stdout);
    if (!['quick', 'full', 'skip'].includes(selection.mode) || !Array.isArray(selection.tests)) throw new Error('验证入口返回无效选择计划');
    if (normalized.full && selection.mode !== 'full') throw new Error('显式完整门预检未返回 full，拒绝降级执行');
  }
  return { dryRun: true, command: [process.execPath, ...args], selection,
    limits: ['只读预检，未运行检查；实际执行仍重新核对；测试覆盖范围由负责人确认'] };
}

/** Git metadata is optional only for a proven non-repository; never invent HEAD/index. */
export function repositoryContext(root) {
  const probe = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' });
  if (probe.error) throw probe.error;
  if (probe.status !== 0) {
    let marker = false;
    for (let directory = path.resolve(root); ; directory = path.dirname(directory)) {
      try {
        const location = path.join(directory, '.git'), entry = lstatSync(location);
        // Sandbox mount placeholders in ancestors are not repository metadata.
        if (directory === path.resolve(root) || !entry.isDirectory() || existsSync(path.join(location, 'HEAD'))) marker = true;
      }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (path.dirname(directory) === directory) break;
    }
    const diagnostic = (probe.stderr || probe.stdout || '').trim();
    if (probe.status === 128 && /not a git repository/i.test(diagnostic)
      && !marker && !['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY', 'GIT_INDEX_FILE'].some(key => process.env[key])) {
      return { mode: 'snapshot', head: null, status: null, reusableReceipt: false,
        reason: '当前目录没有可用 Git 仓库；仅核验显式输入与文件指纹，不代表 HEAD/index/CI。' };
    }
    throw new Error('Git 元数据读取失败，不能按无仓库降级：' + diagnostic);
  }
  return { mode: 'git', head: git(root, ['rev-parse', 'HEAD']), status: git(root, ['status', '--short']),
    reusableReceipt: false, reason: '工作区检查候选；冻结 index 证据仍走 workflow staged。' };
}

export async function runCheck(root, options) {
  safeId(options.task);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date ?? '')) throw new Error('日期必须为 YYYY-MM-DD');
  const preview = previewCheck(root, options);
  const repositoryBefore = repositoryContext(root);
  const args = preview.command.slice(1);
  const validation = { ...preview.selection, executed: preview.selection.mode !== 'skip' };
  const directory = path.join(root, 'docs/evidence', options.date + '-' + options.task);
  mkdirSync(directory, { recursive: true });
  const id = new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID().slice(0, 8);
  const logPath = path.join(directory, id + '.log');
  const reportPath = path.join(directory, id + '.json');
  const selectedRoots = options.tests ?? (validation.mode === 'quick' ? [...(validation.tests ?? []), ...(options.paths ?? [])] : undefined);
  const scope = { assets: Boolean((options.paths || options.full) && validation.mode !== 'skip'), documents: Boolean(options.full || options.suite
    || options.tests?.some(file => /docs-consistency|workflow-cli-integration|workflow-index/.test(file))), roots: selectedRoots };
  const before = fingerprint(root, scope);
  const startedAt = new Date().toISOString();
  writeFileSync(logPath, '', { flag: 'wx' });
  const execution = await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: root, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on('data', data => { appendFileSync(logPath, data); (options.json ? process.stderr : output).write(data); });
    }
    child.on('error', error => resolve({ exitCode: null, signal: null, error: error.message }));
    child.on('close', (exitCode, signal) => resolve({ exitCode, signal, error: null }));
  });
  let after;
  try { after = fingerprint(root, scope); }
  catch (error) { after = { sha256: null, manifest: [], environment: null, documents: scope.documents,
    error: error.message, limits: ['结束指纹采集失败，不可复用'] }; }
  let repositoryAfter;
  try { repositoryAfter = repositoryContext(root); }
  catch (error) { repositoryAfter = { mode: 'unavailable', head: null, status: null, error: error.message, reusableReceipt: false }; }
  const report = { schemaVersion: 1, task: options.task, kind: 'automated-local-check', command: [process.execPath, ...args],
    cwd: root, startedAt, endedAt: new Date().toISOString(), head: repositoryBefore.head, statusBefore: repositoryBefore.status,
    statusAfter: repositoryAfter.status, repository: { before: repositoryBefore, after: repositoryAfter }, reusableReceipt: false, before, after, ...execution, validation,
    outcome: execution.exitCode !== 0 ? 'failed' : validation.mode === 'skip' ? 'skip' : 'passed',
    log: path.relative(root, logPath).replaceAll('\\', '/'), logSha256: hash(readFileSync(logPath)),
    limits: [repositoryBefore.reason, '仅本命令覆盖范围；没有 build、实页、真实 hover、玩家存档或远端 CI 验收', ...after.limits] };
  report.freshness = freshness(report, after);
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return { report: path.relative(root, reportPath).replaceAll('\\', '/'), exitCode: execution.exitCode,
    outcome: report.outcome, validation, freshness: report.freshness };
}
