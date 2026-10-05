import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, realpathSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { dependencyScope } from './workflow-dependencies.mjs';
import { isGateRelevantPath } from './gate-plan.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const STATE = new Set(['docs/PARALLEL-REGISTRY.md', 'docs/PENDING.md', 'docs/STATUS.md']);
const slash = value => value.replaceAll('\\', '/');
export const DEPENDENCY_CACHES = new Set(['.cache', '.eslintcache', '.vite', '.vite-temp', '.vitest']);

// Hash installed bytes, not just versions. ESLint's disposable cache is not a dependency input.
export function dependencyBytes(root, { destination } = {}) {
  const digest = createHash('sha256');
  const modules = path.join(root, 'node_modules');
  function binLink(file, key) {
    const target = readlinkSync(file), resolved = path.resolve(path.dirname(file), target);
    const relative = path.relative(modules, resolved), parts = relative.split(path.sep);
    // npm's POSIX executable shims are relative .bin -> package file links.
    // Package/workspace directory links and chained links do not prove installed bytes.
    if (!key.startsWith('.bin/') || key.slice(5).includes('/') || !slash(target).startsWith('../')
      || path.isAbsolute(target) || relative === '' || path.isAbsolute(relative) || parts.includes('..')
      || parts.length < 2 || parts[0].startsWith('.') || DEPENDENCY_CACHES.has(parts[0])) {
      throw new Error('依赖字节证据不接受非受控 .bin 链接：' + key);
    }
    let current = modules;
    for (let index = 0; index < parts.length; index++) {
      current = path.join(current, parts[index]);
      const info = lstatSync(current);
      if (info.isSymbolicLink() || (index === parts.length - 1 ? !info.isFile() : !info.isDirectory())) {
        throw new Error('依赖 .bin 链接目标必须是无链接路径内的普通文件：' + key);
      }
    }
    return target;
  }
  function visit(directory, relative = '') {
    if (destination) mkdirSync(path.join(destination, relative), { recursive: true });
    for (const info of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = info.name;
      const file = path.join(directory, name), key = relative ? relative + '/' + name : name;
      if (!relative && DEPENDENCY_CACHES.has(name)) continue;
      if (info.isSymbolicLink()) {
        const target = binLink(file, key);
        digest.update(JSON.stringify([key, 'symlink', target]) + '\n');
        if (destination) symlinkSync(target, path.join(destination, key), 'file');
        continue;
      }
      if (info.isDirectory()) visit(file, key);
      else if (info.isFile()) {
        const bytes = readFileSync(file), mode = process.platform === 'win32' ? 0 : statSync(file).mode & 0o111;
        digest.update(JSON.stringify([key, mode, bytes.length]) + '\n').update(bytes);
        if (destination) {
          const target = path.join(destination, key);
          writeFileSync(target, bytes, { flag: 'wx' });
          if (process.platform !== 'win32') chmodSync(target, statSync(file).mode & 0o777);
        }
      }
      else throw new Error('依赖字节证据不接受特殊文件：' + key);
    }
  }
  visit(modules);
  return digest.digest('hex');
}

const isDocument = file => file.startsWith('docs/') || /(?:^|\/)(?:README|AGENTS)\.md$/.test(file);
const isMedia = file => /\.(?:png|jpe?g|webp|gif|svg|mp3|ogg|wav|mp4|webm|zip|woff2?|ttf|otf)$/i.test(file);
export function gateInputScope(root, plan, gate) {
  // These two shipped sentinels read the code graph, runtime contracts and launchers.
  // Unknown tests with opaque file/process input remain conservative.
  const tests = gate.tests.filter(file => !['tests/architecture-boundaries.test.js', 'tests/contracts.test.js'].includes(file)
    || /docs[\\/]|README|AGENTS|\.md\b/.test(readFileSync(path.join(root, file), 'utf8')));
  const closure = tests.length ? dependencyScope(root, tests) : { mode: 'targeted', files: [], reason: '仅明确代码哨兵' };
  const allDocuments = gate.mode === 'full' || closure.mode !== 'targeted';
  const projectFiles = plan.entries.map(entry => plan.prefix && entry.file.startsWith(plan.prefix + '/')
    ? entry.file.slice(plan.prefix.length + 1) : (plan.prefix ? '../' + entry.file : entry.file));
  const relatedFiles = allDocuments ? plan.entries.map(entry => plan.prefix && entry.file.startsWith(plan.prefix + '/')
    ? entry.file.slice(plan.prefix.length + 1) : (plan.prefix ? '../' + entry.file : entry.file)).filter(isDocument)
    : [...(closure.files ?? []), ...(closure.existence ?? [])].filter(isDocument);
  return { code: 'project', documents: allDocuments ? 'project' : 'targeted',
    relatedFiles: [...new Set([...relatedFiles, 'docs/asset-audit-debt.json'])].filter(file => !STATE.has(file) && !file.startsWith('docs/evidence/')).sort(),
    media: gate.mode === 'full' || closure.mode !== 'targeted' ? 'project' : 'targeted',
    // Every quick/full gate audits the complete asset tree, including old debt.
    mediaFiles: [...new Set([...(closure.files ?? []).filter(isMedia),
      ...projectFiles.filter(file => file.startsWith('game/assets/') && isMedia(file))])].sort(),
    existence: [...new Set([...(closure.existence ?? []), 'docs/asset-audit-debt.json'])].sort(),
    inventories: closure.inventories ?? [], reason: closure.reason };
}

function frozenInputEvidence(plan, scope) {
  const files = plan.entries.map(entry => plan.prefix && entry.file.startsWith(plan.prefix + '/')
    ? entry.file.slice(plan.prefix.length + 1) : plan.prefix ? '../' + entry.file : entry.file);
  const exists = file => files.some(candidate => candidate === file || candidate.startsWith(file.replace(/\/$/, '') + '/'));
  return { existence: (scope.existence ?? []).map(file => ({ file, present: exists(file) })),
    inventories: (scope.inventories ?? []).map(descriptor => {
      const directory = descriptor.directory + '/', members = new Map();
      for (const file of files) {
        if (!file.startsWith(directory)) continue;
        const rest = file.slice(directory.length), name = rest.split('/')[0], isDirectory = rest.includes('/');
        if (descriptor.kind === 'source-domains' ? isDirectory && name !== 'generated'
          : descriptor.kind === 'workflow-batches' ? isDirectory && /^(?:lean-)?workflow-/.test(name)
            : !isDirectory && name.endsWith('.md') || descriptor.recursive && isDirectory && !/^(?:archive|evidence|previews|modules)$/.test(name)) {
          members.set(name, { name, directory: isDirectory });
        }
      }
      return { directory: descriptor.directory, members: [...members.values()].sort((a, b) => a.name.localeCompare(b.name)) };
    }) };
}

export function gateReceipt(plan, gate, dependenciesSha256, scope) {
  if (!scope) throw new Error('冻结验收证据缺少明确输入范围');
  const entries = plan.entries.filter(entry => {
    const projectFile = plan.prefix && entry.file.startsWith(plan.prefix + '/')
      ? entry.file.slice(plan.prefix.length + 1) : plan.prefix ? '../' + entry.file : entry.file;
    if (STATE.has(projectFile) || projectFile.startsWith('docs/evidence/')) return false;
    if (projectFile.startsWith('game/assets/')) return true;
    if (isDocument(projectFile)) return scope.documents === 'project' || scope.relatedFiles.includes(projectFile);
    if (isMedia(projectFile)) return scope.media === 'project' || scope.mediaFiles.includes(projectFile);
    return true;
  }).map(({ file, mode, object, stage }) => ({ file, mode, object, stage })).sort((a, b) => a.file.localeCompare(b.file));
  const changes = plan.changes.filter(entry => isGateRelevantPath(entry.path))
    .map(({ path: file, status }) => ({ file, status })).sort((a, b) => a.file.localeCompare(b.file));
  return { schemaVersion: 1, entriesSha256: sha(JSON.stringify(entries)), changesSha256: sha(JSON.stringify(changes)),
    packageJsonBaselineSha256: plan.packageJsonBaselineSha256 ?? null,
    scope,
    externalInputs: frozenInputEvidence(plan, scope),
    gate: { mode: gate.mode, tests: [...gate.tests].sort() }, dependenciesSha256,
    environment: { node: process.version, platform: process.platform, arch: process.arch,
      ci: process.env.CI ?? null, nodeOptions: process.env.NODE_OPTIONS ?? null,
      forceFullTests: process.env.FORCE_FULL_TESTS ?? null } };
}

/** Cheap report precheck. It proves provenance/shape only, never current index/dependency eligibility. */
export function inspectGateReceipt(root, file, { repo = path.resolve(root, '..') } = {}) {
  const invalid = (reasonCode, reason) => ({ eligible: false, status: 'invalid', reasonCode, reason,
    strictCurrentCheck: 'commit-gate' });
  function evidencePath(value, extension) {
    if (typeof value !== 'string' || !value) throw new Error('报告或日志路径缺失');
    const location = path.resolve(root, value), relative = slash(path.relative(root, location));
    if (!relative.startsWith('docs/evidence/') || relative.split('/').includes('..') || extension && !relative.endsWith(extension)) throw new Error('复用报告/日志必须在项目 docs/evidence 内');
    if (existsSync(location)) {
      const physical = slash(path.relative(realpathSync(root), realpathSync(location)));
      if (!physical.startsWith('docs/evidence/')) throw new Error('报告/日志路径穿越到项目 evidence 外');
    }
    return { location, relative };
  }
  let source;
  try { source = evidencePath(file, '.json'); } catch (error) { return invalid('RECEIPT_PATH_INVALID', error.message); }
  if (!existsSync(source.location)) return invalid('RECEIPT_MISSING', '冻结报告不存在');
  let report, raw;
  try { raw = readFileSync(source.location, 'utf8'); report = JSON.parse(raw); }
  catch (error) { return invalid('RECEIPT_JSON_INVALID', '冻结报告 JSON 不可读取：' + error.message); }
  if (report?.outcome === 'skip' || report?.gate?.mode === 'skip') return invalid('RECEIPT_SKIPPED', '报告未执行验收，skip 不是通过证据');
  if (['failed', 'blocked', 'invalidated', 'cleanup-failed'].includes(report?.outcome)) return invalid('RECEIPT_FAILED', '冻结报告失败或失效，不是通过证据');
  const scope = report?.gateReceipt?.scope;
  const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  if (report?.schemaVersion !== 1 || report.kind !== 'staged-snapshot-check' || report.outcome !== 'passed' || report.exitCode !== 0
    || report.commandExitCode !== 0 || report.signal || report.error || report.cleanupError || !report.endedAt
    || !scope || !['targeted', 'project'].includes(scope.documents) || !Array.isArray(scope.relatedFiles)
    || scope.relatedFiles.some(value => typeof value !== 'string') || !['quick', 'full'].includes(report.gate?.mode)
    || report.gateReceipt.schemaVersion !== 1 || !digest(report.gateReceipt.entriesSha256)
    || !digest(report.gateReceipt.changesSha256) || !digest(report.gateReceipt.dependenciesSha256)
    || !report.gateReceipt.environment || typeof report.gateReceipt.environment.node !== 'string'
    || !Array.isArray(report.gate.tests) || report.gate.tests.some(value => typeof value !== 'string')
    || report.gateReceipt.gate?.mode !== report.gate.mode || !Array.isArray(report.gateReceipt.gate?.tests)
    || JSON.stringify([...report.gateReceipt.gate.tests].sort()) !== JSON.stringify([...report.gate.tests].sort())
    || report.started === false || report.validation && (report.validation.executed !== true || report.validation.passed !== true || report.validation.reusableReceipt !== true)
    || typeof report.plan?.root !== 'string' || typeof report.plan?.repo !== 'string'
    || report.gitView?.isolatedMetadata !== true || report.plan.dependencies?.ok !== true || report.dependenciesAfterCopy?.ok !== true
    || !digest(report.plan?.indexSha256) || !digest(report.snapshotIndexExpectedSha256)
    || report.indexAfterSha256 !== report.plan?.indexSha256
    || report.snapshotIndexContentSha256 !== report.snapshotIndexExpectedSha256
    || !Array.isArray(report.snapshotTrackedMutations) || report.snapshotTrackedMutations.length) {
    return invalid('RECEIPT_STRUCTURE_INVALID', '报告不是完整成功且未改写的冻结 index 验收证据');
  }
  if (path.resolve(report.plan.root) !== path.resolve(root) || path.resolve(report.plan.repo) !== path.resolve(repo)) {
    return invalid('RECEIPT_WORKSPACE_MISMATCH', '报告属于其他工作区');
  }
  try {
    const log = evidencePath(report.log);
    if (!existsSync(log.location) || sha(readFileSync(log.location)) !== report.logSha256) return invalid('RECEIPT_LOG_INVALID', '验收日志缺失或已变化');
  } catch (error) { return invalid('RECEIPT_LOG_INVALID', error.message); }
  return { eligible: true, status: 'prechecked', reasonCode: 'RECEIPT_PRECHECKED',
    reason: '仅报告来源、结构与日志预检通过；当前 index/依赖/环境仍由提交门核对',
    strictCurrentCheck: 'commit-gate', reportPath: source.relative, reportSha256: sha(raw), report };
}

export function verifyGateReceipt(root, file, plan) {
  const checked = inspectGateReceipt(root, file, { repo: plan.repo });
  if (!checked.eligible) throw new Error(checked.reason);
  const { report, reportPath: relative } = checked;
  if (plan.blocked.length) throw new Error(plan.blocked.join('\n'));
  const current = gateReceipt(plan, report.gate, dependencyBytes(root), report.gateReceipt.scope);
  if (JSON.stringify(current) !== JSON.stringify(report.gateReceipt)) {
    throw new Error('冻结源码/index、变更范围、依赖字节或验收环境已变化，须重新隔离验收');
  }
  if (indexContentHash(plan.repo) !== plan.indexSha256) throw new Error('证据复用核对期间 index 已变化');
  return { report: relative, mode: report.gate.mode, tests: report.gate.tests,
    limits: ['仅复用已验冻结 index；工作树在途内容、build、浏览器与远端 CI 未验证', '台账与证据目录变化不影响代码证据，仍须单独核对提交边界'] };
}

// index 逻辑内容（mode+blob+path）哈希，Buffer 直哈希避免编码歧义：并发 git status/add 的
// stat-only 刷新会改写 index 文件字节但逻辑内容不变，按文件字节判定会把可复用验收误报
// invalidated（10-03 实测 STAGED_INVALIDATED）。workflow-staged 的 indexHash 与本文件复用校验同源。
export function indexContentHash(repo, env = {}) {
  const base = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_NAMESPACE']) delete base[key];
  const listing = execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files', '--stage', '-z'],
    { cwd: repo, env: { ...base, GIT_OPTIONAL_LOCKS: '0', ...env }, maxBuffer: 128 * 1024 * 1024 });
  return createHash('sha256').update(listing).digest('hex');
}
