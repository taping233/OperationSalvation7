import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hash } from './workflow-ledger.mjs';
import { currentDocuments, filesUnder, git } from './workflow-status.mjs';
import { dependencyScope } from './workflow-dependencies.mjs';

export const WATCHED = ['game/src', 'game/data', 'game/css', 'game/tools', 'tests', 'scripts', 'narrative'];
export const STATE_FILES = ['docs/PARALLEL-REGISTRY.md', 'docs/PENDING.md', 'docs/STATUS.md'];

function groupForFile(file) {
  const normalized = file.replaceAll('\\', '/');
  if (STATE_FILES.includes(normalized) || /^docs\/evidence\/[^/]+\/task\.json$/.test(normalized)) return 'state';
  if (normalized.startsWith('docs/') || ['README.md', 'AGENTS.md'].includes(normalized)) return 'docs';
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

export function fingerprint(root, { documents = false, roots } = {}) {
  const selection = roots?.length ? dependencyScope(root, roots) : { mode: 'project', roots: [], reason: '完整项目范围' };
  const files = selection.mode === 'targeted' ? [...selection.files] : [...WATCHED.flatMap(directory => filesUnder(root, directory))];
  files.push(...STATE_FILES.filter(file => existsSync(path.join(root, file))),
    ...stateTaskFiles(root));
  if (documents) {
    files.push(...currentDocuments(root), ...filesUnder(root, 'docs/archive').filter(file => /\.(?:md|json|html|js|css)$/.test(file)));
    if (existsSync(path.join(root, 'README.md'))) files.push('README.md');
  }
  if (selection.mode === 'project' && existsSync(path.join(root, 'game'))) {
    for (const entry of readdirSync(path.join(root, 'game'), { withFileTypes: true })) {
      if (entry.isFile() && /\.(?:html|js|json)$/.test(entry.name)) files.push('game/' + entry.name);
    }
  }
  for (const file of ['package.json', 'package-lock.json', 'vite.config.js', 'vite.config.mjs', 'vitest.config.js',
    'vitest.config.mjs', 'eslint.config.js', 'eslint.config.mjs']) if (existsSync(path.join(root, file))) files.push(file);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && /^(?:ts|js)config.*\.json$/.test(entry.name)) files.push(entry.name);
  }
  const manifest = [...new Set(files)].sort().map(file => ({ file, sha256: hash(readFileSync(path.join(root, file))) }));
  const dependencies = {};
  for (const name of ['vitest', 'vite', 'typescript', 'eslint', 'jsdom', 'acorn', 'acorn-walk']) {
    const location = path.join(root, 'node_modules', name, 'package.json');
    dependencies[name] = existsSync(location) ? JSON.parse(readFileSync(location, 'utf8')).version : null;
  }
  const environment = { node: process.version, platform: process.platform, arch: process.arch, dependencies,
    ci: process.env.CI ?? null, nodeOptions: process.env.NODE_OPTIONS ?? null,
    forceFullTests: process.env.FORCE_FULL_TESTS ?? null };
  return { sha256: hash(JSON.stringify({ manifest, environment })), manifest, environment, documents, selection,
    groups: scopeGroups({ manifest, environment }),
    limits: ['未监控图片/声音、node_modules 字节、浏览器与机器负载；匹配只表示候选证据，不自动免验'] };
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
  if (tests) return ['scripts/acceptance-gate.mjs', '--target-tests', ...tests];
  if (paths) return ['scripts/acceptance-gate.mjs', '--paths', ...paths, '--run'];
  if (suite) return ['node_modules/vitest/vitest.mjs', 'run', '--reporter=dot', '--silent'];
  return ['scripts/acceptance-gate.mjs', '--paths', 'scripts/acceptance-gate.mjs', '--run'];
}

export async function runCheck(root, options) {
  safeId(options.task);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date ?? '')) throw new Error('日期必须为 YYYY-MM-DD');
  const args = checkArguments(options);
  let validation = { mode: options.suite ? 'suite' : 'targeted', executed: true, tests: options.tests ?? [] };
  if (!options.tests && !options.suite) {
    const preview = spawnSync(process.execPath, [...args.filter(arg => arg !== '--run'), '--plan', '--json'],
      { cwd: root, encoding: 'utf8' });
    if (preview.status === 0) {
      const selected = JSON.parse(preview.stdout);
      validation = { mode: selected.mode, executed: selected.mode !== 'skip', tests: selected.tests, reasons: selected.reasons };
    } else validation = { mode: 'invalid-plan', executed: false, tests: [] };
  }
  const directory = path.join(root, 'docs/evidence', options.date + '-' + options.task);
  mkdirSync(directory, { recursive: true });
  const id = new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID().slice(0, 8);
  const logPath = path.join(directory, id + '.log');
  const reportPath = path.join(directory, id + '.json');
  const selectedRoots = options.tests ?? (validation.mode === 'quick' ? [...(validation.tests ?? []), ...(options.paths ?? [])] : undefined);
  const scope = { documents: Boolean(options.full || options.suite || options.paths
    || options.tests?.some(file => /docs-consistency|workflow-cli-integration|workflow-index/.test(file))), roots: selectedRoots };
  const before = fingerprint(root, scope);
  const startedAt = new Date().toISOString();
  const head = git(root, ['rev-parse', 'HEAD']);
  const status = git(root, ['status', '--short']);
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
  const report = { schemaVersion: 1, task: options.task, kind: 'automated-local-check', command: [process.execPath, ...args],
    cwd: root, startedAt, endedAt: new Date().toISOString(), head, statusBefore: status,
    statusAfter: git(root, ['status', '--short']), before, after, ...execution, validation,
    outcome: execution.exitCode !== 0 ? 'failed' : validation.mode === 'skip' ? 'skip' : 'passed',
    log: path.relative(root, logPath).replaceAll('\\', '/'), logSha256: hash(readFileSync(logPath)),
    limits: ['仅本命令覆盖范围；没有 build、实页、真实 hover、玩家存档或远端 CI 验收', ...after.limits] };
  report.freshness = freshness(report, after);
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return { report: path.relative(root, reportPath).replaceAll('\\', '/'), exitCode: execution.exitCode,
    outcome: report.outcome, validation, freshness: report.freshness };
}
