import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dependencyBytes, gateInputScope, gateReceipt, indexContentHash } from './workflow-gate-receipt.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const slash = value => value.replaceAll('\\', '/');
const LIMITS = ['仅验证 Git index 快照，不含未暂存/未跟踪内容；不含 build、浏览器、远端 CI',
  '项目外暂存路径仅列出，不由 Vite 验收门验证；临时 Git 元数据/index 独立，对象只读引用源对象库',
  '依赖核对暂存 npm 锁及安装版本；成功报告另锁依赖字节，排除工具缓存目录',
  '依赖复制到临时目录，检查配置与工具仅采用 index 中版本；未暂存工具修正不自动带入'];

function gitEnvironment(extra = {}) {
  const environment = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_NAMESPACE']) delete environment[key];
  delete environment.GATE_RECEIPT;
  return { ...environment, GIT_OPTIONAL_LOCKS: '0', ...extra };
}
function git(root, args, env = {}) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root,
    env: gitEnvironment(env), maxBuffer: 128 * 1024 * 1024 });
}
function indexFile(repo, env = {}) {
  const file = git(repo, ['rev-parse', '--git-path', 'index'], env).toString().trim();
  return path.resolve(repo, file);
}
// 内容哈希（见 workflow-gate-receipt.indexContentHash）：并发 git 操作的 stat-only 刷新不构成内容变化。
function indexHash(repo, env = {}) { return indexContentHash(repo, env); }
function safeRelative(file) {
  if (!file || file.includes('\\') || file.includes(':') || file.split('/').some(part => !part || part === '..' || part === '.' || part.toLowerCase() === '.git')) {
    throw new Error('不安全的 index 路径：' + file);
  }
}
function records(repo, env = {}) {
  return git(repo, ['ls-files', '--stage', '-z'], env).toString('utf8').split('\0').filter(Boolean).map(record => {
    const match = /^(\d+) ([a-f0-9]+) (\d+)\t([\s\S]+)$/.exec(record);
    if (!match) throw new Error('Git index 输出不完整');
    const [, mode, object, stage, file] = match;
    safeRelative(file);
    return { mode, object, stage: Number(stage), file };
  });
}
function showJson(repo, file, env = {}) { return JSON.parse(git(repo, ['show', ':' + file], env).toString('utf8')); }
function installedEvidence(root, lock) {
  const problems = [], versions = {};
  const hidden = path.join(root, 'node_modules/.package-lock.json');
  if (lock.lockfileVersion < 2 || !lock.packages) return { ok: false, problems: ['暂存锁不是可核对的 npm v2/v3 锁'], versions };
  if (!existsSync(hidden)) return { ok: false, problems: ['已安装依赖缺少 node_modules/.package-lock.json'], versions };
  const installed = JSON.parse(readFileSync(hidden, 'utf8'));
  const wanted = Object.entries(lock.packages).filter(([file]) => file.startsWith('node_modules/'));
  const incompatible = list => Array.isArray(list) && (list.includes('!' + process.platform) || (!list.includes(process.platform) && !list.every(value => value.startsWith('!'))));
  for (const [file, entry] of wanted) {
    safeRelative(file);
    if (entry.link) { problems.push(file + ' 是链接依赖'); continue; }
    if (entry.optional && (incompatible(entry.os) || (Array.isArray(entry.cpu) && !entry.cpu.includes(process.arch)))) continue;
    const found = installed.packages?.[file];
    const packageFile = path.join(root, file, 'package.json');
    if (!found || !existsSync(packageFile)) { problems.push(file + ' 未安装'); continue; }
    if (lstatSync(path.join(root, file)).isSymbolicLink()) { problems.push(file + ' 是目录链接'); continue; }
    const actual = JSON.parse(readFileSync(packageFile, 'utf8')).version;
    versions[file] = actual;
    if (found.version !== entry.version || actual !== entry.version || found.integrity !== entry.integrity || found.resolved !== entry.resolved) problems.push(file + ' 与暂存锁不匹配');
  }
  for (const file of Object.keys(installed.packages ?? {})) {
    if (file.startsWith('node_modules/') && !lock.packages[file]) problems.push(file + ' 是暂存锁外的安装包');
  }
  return { ok: problems.length === 0, problems, versions, installedLockSha256: sha(readFileSync(hidden)),
    stagedLockSha256: sha(JSON.stringify(lock)), node: process.version, platform: process.platform, arch: process.arch };
}

export function stagedPlan(root, options = {}) {
  root = path.resolve(root);
  const repo = git(root, ['rev-parse', '--show-toplevel']).toString('utf8').trim();
  const prefix = slash(path.relative(repo, root));
  if (prefix.startsWith('../')) throw new Error('项目根不在仓库中');
  // git commit --only supplies its actual commit view in GIT_INDEX_FILE. Only the
  // submission caller opts in; standalone isolation continues to ignore inherited Git overrides.
  const environment = options.commitIndex && process.env.GIT_INDEX_FILE
    ? { GIT_INDEX_FILE: path.resolve(repo, process.env.GIT_INDEX_FILE) } : {};
  const before = indexHash(repo, environment), entries = records(repo, environment), blocked = [];
  if (process.env.NODE_OPTIONS) blocked.push('NODE_OPTIONS 存在，无法排除外部加载器/预载脚本；请先明确环境后再验收');
  for (const entry of entries) {
    if (entry.stage !== 0) blocked.push('index 有未解决冲突：' + entry.file);
    if (!['100644', '100755'].includes(entry.mode)) blocked.push('不支持 symlink/gitlink：' + entry.file);
    if (entry.file.split('/').includes('node_modules')) blocked.push('index 不得跟踪 node_modules：' + entry.file);
  }
  const fields = git(repo, ['diff', '--cached', '--name-status', '--no-renames', '-z'], environment).toString('utf8').split('\0').filter(Boolean);
  if (fields.length % 2) throw new Error('暂存变更输出不完整');
  const allChanges = [];
  for (let i = 0; i < fields.length; i += 2) allChanges.push({ status: fields[i], file: fields[i + 1] });
  const changes = allChanges.filter(({ file }) => !prefix || file.startsWith(prefix + '/')).map(entry => ({ ...entry,
    path: prefix ? entry.file.slice(prefix.length + 1) : entry.file }));
  let dependencies = { ok: false, problems: [], versions: {} };
  let packageJsonBaselineSha256 = null;
  try {
    const packageFile = prefix ? prefix + '/package.json' : 'package.json';
    const lockFile = prefix ? prefix + '/package-lock.json' : 'package-lock.json';
    const pkg = showJson(repo, packageFile, environment), lock = showJson(repo, lockFile, environment);
    if (changes.some(change => change.path === 'package.json')) {
      packageJsonBaselineSha256 = sha(git(repo, ['show', 'HEAD:' + packageFile], environment));
    }
    for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      if (JSON.stringify(pkg[key] ?? {}) !== JSON.stringify(lock.packages?.['']?.[key] ?? {})) blocked.push('暂存 package.json 与锁根 ' + key + ' 不匹配');
    }
    dependencies = installedEvidence(root, lock);
    blocked.push(...dependencies.problems);
  } catch (error) { blocked.push('无法证明依赖相符：' + error.message); }
  if (before !== indexHash(repo, environment)) blocked.push('计划期间 index 已变化');
  return { schemaVersion: 1, kind: 'staged-snapshot-plan', root, repo, prefix, indexSha256: before,
    changes, outsideProject: allChanges.filter(entry => !changes.some(change => change.file === entry.file)),
    entries, dependencies, packageJsonBaselineSha256, blocked, mode: changes.length ? 'pending-snapshot-selection' : 'skip',
    validation: { executed: false, passed: false, reusableReceipt: false,
      reason: blocked.length ? 'STAGED_PLAN_BLOCKED' : changes.length ? 'STAGED_PLAN_ONLY' : 'STAGED_EMPTY_INDEX' },
    nextAction: blocked.length ? 'resolve-plan-blockers' : changes.length ? 'run-frozen-index-validation' : 'select-completed-range-and-review-stage-plan', limits: LIMITS };
}

function captured(args, cwd, log, json, extraEnv = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: gitEnvironment(extraEnv) });
    let stdout = '', started = false;
    child.once('spawn', () => { started = true; });
    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      appendFileSync(log, chunk); (json ? process.stderr : process.stdout).write(chunk);
    });
    child.once('error', error => resolve({ exitCode: null, error: error.message, started }));
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal, stdout, started }));
  });
}

async function exportBlobs(repo, entries, snapshot) {
  // Read immutable index object IDs directly. checkout filters/unstaged .gitattributes cannot leak into the export.
  const child = spawn('git', ['cat-file', '--batch'], { cwd: repo, shell: false,
    env: gitEnvironment(), stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error('index blob 导出失败：' + stderr)));
  });
  child.stdin.end(entries.map(entry => entry.object).join('\n') + '\n');
  let buffer = Buffer.alloc(0), current = 0, size = null;
  for await (const chunk of child.stdout) {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      if (size === null) {
        const newline = buffer.indexOf(10);
        if (newline < 0) break;
        const header = /^(\w+) blob (\d+)$/.exec(buffer.subarray(0, newline).toString());
        if (!header || header[1] !== entries[current]?.object) throw new Error('非预期的 index blob');
        size = Number(header[2]); buffer = buffer.subarray(newline + 1);
      }
      if (buffer.length < size + 1) break;
      const target = path.join(snapshot, entries[current].file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, buffer.subarray(0, size), { flag: 'wx' });
      if (entries[current].mode === '100755') chmodSync(target, 0o755);
      buffer = buffer.subarray(size + 1); size = null; current += 1;
    }
  }
  await completion;
  if (current !== entries.length || buffer.length || size !== null) throw new Error('index blob 导出不完整');
}

function createSnapshotGit(repo, snapshot, frozenIndex) {
  const objectFormat = git(repo, ['rev-parse', '--show-object-format']).toString().trim();
  const head = git(repo, ['rev-parse', 'HEAD']).toString().trim();
  const common = path.resolve(repo, git(repo, ['rev-parse', '--git-common-dir']).toString().trim());
  git(snapshot, ['init', '-q', '--object-format=' + objectFormat]);
  git(snapshot, ['config', '--local', 'core.autocrlf', 'false']);
  git(snapshot, ['config', '--local', 'core.hooksPath', path.join(snapshot, '.git/no-hooks')]);
  const info = path.join(snapshot, '.git/objects/info');
  mkdirSync(info, { recursive: true });
  writeFileSync(path.join(info, 'alternates'), slash(path.join(common, 'objects')) + '\n', { flag: 'wx' });
  git(snapshot, ['update-ref', 'HEAD', head]);
  writeFileSync(path.join(snapshot, '.git/index'), readFileSync(frozenIndex), { flag: 'wx' });
  return { isolatedMetadata: true, head, objectFormat, indexSha256: indexHash(snapshot), objects: 'read-only-alternate' };
}

export async function runStaged(root, options = {}) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(options.task ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(options.date ?? '')) {
    throw new Error('隔离验收须指定有效 task 和 YYYY-MM-DD date');
  }
  const plan = stagedPlan(root);
  const evidence = path.join(plan.root, 'docs/evidence', options.date + '-' + options.task);
  mkdirSync(evidence, { recursive: true });
  const id = new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID().slice(0, 8);
  const log = path.join(evidence, id + '-staged.log'), reportFile = path.join(evidence, id + '-staged.json');
  writeFileSync(log, '', { flag: 'wx' });
  const report = { schemaVersion: 1, kind: 'staged-snapshot-check', task: options.task,
    startedAt: new Date().toISOString(), plan, outcome: 'blocked', exitCode: 1, limits: LIMITS };
  let temp;
  try {
    if (plan.blocked.length) throw new Error(plan.blocked.join('\n'));
    if (!plan.changes.length) { report.outcome = 'skip'; report.exitCode = 0; }
    else {
      temp = mkdtempSync(path.join(os.tmpdir(), 'sdt-staged-'));
      report.snapshotDirectory = temp;
      const isolatedIndex = path.join(temp, 'index');
      writeFileSync(isolatedIndex, readFileSync(indexFile(plan.repo)), { flag: 'wx' });
      if (indexHash(plan.repo, { GIT_INDEX_FILE: isolatedIndex }) !== plan.indexSha256 || indexHash(plan.repo) !== plan.indexSha256) throw new Error('导出前 index 已变化');
      const snapshot = path.join(temp, 'snapshot');
      mkdirSync(snapshot);
      const frozenEntries = records(plan.repo, { GIT_INDEX_FILE: isolatedIndex });
      await exportBlobs(plan.repo, frozenEntries, snapshot);
      report.gitView = createSnapshotGit(plan.repo, snapshot, isolatedIndex);
      const project = path.join(snapshot, plan.prefix);
      const dependenciesBefore = dependencyBytes(plan.root, { destination: path.join(project, 'node_modules') });
      const lock = JSON.parse(readFileSync(path.join(project, 'package-lock.json'), 'utf8'));
      report.dependenciesAfterCopy = installedEvidence(project, lock);
      if (!report.dependenciesAfterCopy.ok || JSON.stringify(report.dependenciesAfterCopy.versions) !== JSON.stringify(plan.dependencies.versions)) throw new Error('复制后依赖证据变化');
      const selection = await captured(['scripts/acceptance-gate.mjs', '--staged', '--plan', '--json'], project, log, options.json);
      if (selection.exitCode !== 0) throw new Error('快照验收计划选择失败');
      report.gate = JSON.parse(selection.stdout);
      if (indexHash(plan.repo) !== plan.indexSha256) throw new Error('运行前 index 已变化');
      if (report.gate.mode === 'skip') {
        report.outcome = 'skip'; report.exitCode = 0;
        report.limits = [...LIMITS, '计划无相关验收路径，未执行检查，不代表完整验收通过'];
      } else {
        report.command = [process.execPath, 'scripts/acceptance-gate.mjs', '--staged', '--run'];
        // SDT_STAGED_SNAPSHOT：告知测试当前处于隔离快照（按 index 字节落盘，文本 LF 化）；依赖检出态字节的断言据此跳过，工作树门与 CI 覆盖。
        const execution = await captured(report.command.slice(1), project, log, options.json,
          { SDT_STAGED_SNAPSHOT: '1' });
        delete execution.stdout;
        Object.assign(report, execution);
        report.commandExitCode = execution.exitCode;
        report.exitCode = execution.exitCode ?? 1;
        report.outcome = execution.exitCode === 0 ? 'passed' : 'failed';
      }
      report.indexAfterSha256 = indexHash(plan.repo);
      if (report.indexAfterSha256 !== plan.indexSha256) { report.outcome = 'invalidated'; report.exitCode = 1; report.error = '验收期间源 index 已变化'; }
      report.snapshotIndexAfterSha256 = indexHash(snapshot);
      report.snapshotIndexExpectedSha256 = sha(JSON.stringify(frozenEntries));
      report.snapshotIndexContentSha256 = sha(JSON.stringify(records(snapshot)));
      if (report.snapshotIndexContentSha256 !== report.snapshotIndexExpectedSha256) {
        report.outcome = 'invalidated'; report.exitCode = 1; report.error = '检查改写了冻结快照 index';
      }
      report.snapshotTrackedMutations = frozenEntries.filter(entry => {
        const file = path.join(snapshot, entry.file);
        if (!existsSync(file) || !lstatSync(file).isFile()) return true;
        const bytes = readFileSync(file);
        return createHash(entry.object.length === 64 ? 'sha256' : 'sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex') !== entry.object;
      }).map(entry => entry.file);
      if (report.snapshotTrackedMutations.length) {
        report.outcome = 'invalidated'; report.exitCode = 1;
        report.error = '检查改写了快照中的暂存文件，结果不能代表原 index';
      }
      if (dependencyBytes(plan.root) !== dependenciesBefore || dependencyBytes(project) !== dependenciesBefore) {
        report.outcome = 'invalidated'; report.exitCode = 1; report.error = '验收期间源或快照依赖字节变化';
      }
      if (report.outcome === 'passed') report.gateReceipt = gateReceipt(plan, report.gate, dependenciesBefore,
        gateInputScope(project, plan, report.gate));
    }
  } catch (error) {
    report.error = error.message;
    if (report.outcome === 'passed' || report.outcome === 'skip') { report.outcome = 'failed'; report.exitCode = 1; }
    appendFileSync(log, error.message + '\n');
  }
  finally {
    try {
      report.indexAfterSha256 = indexHash(plan.repo);
      if (report.indexAfterSha256 !== plan.indexSha256) { report.outcome = 'invalidated'; report.exitCode = 1; report.error = '期间源 index 已变化'; }
    } catch (error) { report.outcome = 'invalidated'; report.exitCode = 1; report.error = '结束时 index 无法核对：' + error.message; }
    if (temp && !options.keepSnapshot) {
      try {
        const resolved = realpathSync(temp);
        const relative = path.relative(realpathSync(os.tmpdir()), resolved);
        if (!relative.startsWith('sdt-staged-') || relative.includes(path.sep) || path.isAbsolute(relative) || !lstatSync(temp).isDirectory()) {
          report.outcome = 'cleanup-failed'; report.exitCode = 1; report.cleanupError = '拒绝清理非自有 temp';
        } else {
          rmSync(resolved, { recursive: true, force: true });
          if (existsSync(resolved) && process.platform === 'win32') {
            execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
              'Remove-Item -LiteralPath $env:SDT_STAGED_CLEANUP_PATH -Recurse -Force -ErrorAction Stop'], {
              env: { ...process.env, SDT_STAGED_CLEANUP_PATH: resolved }, stdio: 'pipe' });
          }
          report.snapshotRemoved = !existsSync(resolved);
          if (!report.snapshotRemoved) {
            report.outcome = 'cleanup-failed'; report.exitCode = 1; report.cleanupError = '自有 temp 清理未完成：' + resolved;
          }
        }
      } catch (error) {
        report.outcome = 'cleanup-failed'; report.exitCode = 1;
        report.cleanupError = error.message;
      }
    }
    report.endedAt = new Date().toISOString();
    report.log = slash(path.relative(plan.root, log));
    report.logSha256 = sha(readFileSync(log));
    const passed = report.outcome === 'passed' && report.exitCode === 0 && !report.error && !report.signal;
    report.validation = { executed: Boolean(report.command) && report.started !== false, passed,
      reusableReceipt: passed && Boolean(report.gateReceipt),
      reason: passed ? 'STAGED_PASSED' : report.outcome === 'skip' ? plan.changes.length ? 'STAGED_SKIPPED' : 'STAGED_EMPTY_INDEX'
        : report.outcome === 'invalidated' ? 'STAGED_INVALIDATED' : report.outcome === 'cleanup-failed' ? 'STAGED_CLEANUP_FAILED'
          : report.outcome === 'blocked' ? 'STAGED_PLAN_BLOCKED' : 'STAGED_FAILED' };
    report.nextAction = passed ? 'review-ship-plan-with-receipt' : report.outcome === 'skip'
      ? plan.changes.length ? 'validate-selected-non-gate-changes' : 'select-completed-range-and-review-stage-plan'
      : 'inspect-preserved-state-and-revalidate';
    writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  return { report: slash(path.relative(plan.root, reportFile)), exitCode: report.exitCode, outcome: report.outcome,
    plan: report.gate ?? plan, validation: report.validation, nextAction: report.nextAction };
}
