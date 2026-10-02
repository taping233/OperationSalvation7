// Reviewable shipping plan. Applying still requires the user's separate commit authorization.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseUnclaimedPaths, extractRegistryTokens } from './registry-paths.mjs';
import { planForPaths } from './gate-plan.mjs';
import { readLedger } from './workflow-ledger.mjs';
import { gateInputScope, inspectGateReceipt } from './workflow-gate-receipt.mjs';

const CODE_ROOTS = ['game/', 'tests/', 'scripts/', 'narrative/'];
const CODE_FILES = ['package.json', 'package-lock.json', 'vite.config.js'];
const DOC_ROOTS = ['docs/', '.github/'];
const DOC_FILES = ['README.md', 'AGENTS.md', '.gitignore', '.gitattributes'];
// 会话中间文件/构建产物模式：永不自动入库（提示人工处置）。
// __try_* 模式不限层级（去前导 / 锚定）：根目录探针与子目录探针都要命中（实测坑：/\/__try_…$/ 漏根目录）。
const EXCLUDE_PATTERNS = [/^\.sfx-work\//, /^nul$/i, /\.tmp$/i, /__try_.*\.json$/, /^\.zcode\//, /^code-map\//];
const EVIDENCE_BINARY = /\.(?:wav|mp3|ogg|flac|mp4|webm|zip|7z|tar|ttf|otf|woff2?)$/i;
const sha = value => createHash('sha256').update(value).digest('hex');
const within = (file, root) => file === root.replace(/\/$/, '') || file.startsWith(root.replace(/\/$/, '') + '/');

function git(root, args, options = {}) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
}

function statusEntries(repoRoot) {
  // porcelain -z：每条记录一个 NUL 结尾，记录内是「XY<空格>path」（--no-renames 下无 R 的双 NUL 特例）。
  const out = git(repoRoot, ['status', '--porcelain', '-z', '--no-renames', '--untracked-files=all']);
  return out.split('\0')
    .filter(Boolean)
    .map(record => ({ status: record.slice(0, 2), path: record.slice(3) }))
    .filter(entry => entry.path);
}

function toProjectPath(value) {
  const normalized = value.replaceAll('\\', '/');
  return normalized.startsWith('搜打撤/') ? normalized.slice('搜打撤/'.length) : normalized;
}

function classify(projectPath) {
  if (CODE_ROOTS.some(root => projectPath.startsWith(root)) || CODE_FILES.includes(projectPath)) return 'code';
  if (DOC_ROOTS.some(root => projectPath.startsWith(root)) || DOC_FILES.includes(projectPath)) return 'docs';
  return 'unknown';
}

function ledgerRows(root, kind) {
  if (!existsSync(path.join(root, 'docs', kind === 'registry' ? 'PARALLEL-REGISTRY.md' : 'PENDING.md'))) return [];
  try { return readLedger(root, kind).rows; }
  catch (error) {
    // Tiny fixtures may contain only the unowned table. A malformed existing active table is never ignored.
    const file = kind === 'registry' ? 'PARALLEL-REGISTRY.md' : 'PENDING.md';
    const text = readFileSync(path.join(root, 'docs', file), 'utf8');
    if (/^## (?:活跃登记|活账)/m.test(text)) throw error;
    return [];
  }
}

function pendingPaths(root) {
  return ledgerRows(root, 'pending').filter(row => row.isOpen).flatMap(row =>
    [...row.cells.join(' ').matchAll(/`([^`]+)`/g)].map(match => match[1]).filter(value =>
      /^[\w./-]+\//.test(value) && !value.includes('..')).map(value => toProjectPath(value)));
}

function unfinishedPaths(root) {
  const paths = ledgerRows(root, 'registry').filter(row => row.isBlocking).flatMap(row => extractRegistryTokens(row.cells[1]));
  const evidence = path.join(root, 'docs/evidence');
  if (!existsSync(evidence)) return paths;
  // Persistent doing/planned tasks complement the human registry; small completed fixes need no new record.
  for (const entry of readdirSync(evidence, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const file = path.join(evidence, entry.name, 'task.json');
    if (!existsSync(file)) continue;
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) throw new Error('任务记录不可安全核对：' + file);
    const task = JSON.parse(readFileSync(file, 'utf8'));
    if (['doing', 'planned'].includes(task.stage)) paths.push('docs/evidence/' + entry.name + '/', ...(task.paths ?? []));
  }
  return paths;
}

function fileState(repoRoot, relative) {
  const target = path.join(repoRoot, relative);
  if (!existsSync(target)) return { path: relative, absent: true };
  const stat = lstatSync(target);
  if (!stat.isFile()) throw new Error('不支持目录链接或特殊文件：' + relative);
  return { path: relative, sha256: sha(readFileSync(target)), mode: stat.mode, mtimeMs: stat.mtimeMs };
}

function indexState(repoRoot) {
  return sha(git(repoRoot, ['ls-files', '--stage', '-z']));
}

function indexOutside(repoRoot, paths) {
  return sha(git(repoRoot, ['ls-files', '--stage', '-z']).split('\0').filter(Boolean)
    .filter(entry => !paths.includes(entry.slice(entry.indexOf('\t') + 1))).join('\0'));
}

function governanceState(root) {
  const files = ['docs/PARALLEL-REGISTRY.md', 'docs/PENDING.md'];
  const evidence = path.join(root, 'docs/evidence');
  if (existsSync(evidence)) for (const entry of readdirSync(evidence, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) files.push('docs/evidence/' + entry.name + '/task.json');
  }
  return files.sort().filter(file => existsSync(path.join(root, file)))
    .map(file => ({ file, sha256: sha(readFileSync(path.join(root, file))) }));
}

function sourceState(repoRoot, paths) { return paths.map(file => fileState(repoRoot, file)); }
function stagedPaths(repoRoot) { return git(repoRoot, ['diff', '--cached', '--name-only', '--no-renames', '-z']).split('\0').filter(Boolean); }

/** Defaults to all eligible completed changes; excluded/in-flight content remains visible in the plan. */
export function planShip(projectRoot, { message, paths, receipt } = {}) {
  const repoRoot = path.resolve(projectRoot, '..');
  const checkedReceipt = receipt ? inspectGateReceipt(projectRoot, receipt, { repo: repoRoot }) : null;
  const { report: receiptReport, ...receiptValidity } = checkedReceipt ?? { status: 'not-provided', eligible: false,
    reasonCode: 'RECEIPT_NOT_PROVIDED', reason: '未请求复用报告，提交时运行原门禁', strictCurrentCheck: 'commit-gate' };
  const entries = statusEntries(repoRoot);
  const unclaimedHits = [];
  const registryPath = path.join(projectRoot, 'docs', 'PARALLEL-REGISTRY.md');
  let unclaimed = [];
  if (existsSync(registryPath)) {
    unclaimed = parseUnclaimedPaths(readFileSync(registryPath, 'utf8'));
  }

  const editing = unfinishedPaths(projectRoot), decisions = pendingPaths(projectRoot);
  const selected = paths?.map(toProjectPath);
  const buckets = { code: [], docs: [], unknown: [], excluded: [], inProgress: [] };
  for (const entry of entries) {
    const project = toProjectPath(entry.path);
    const repoRelative = entry.path;
    if (selected && !selected.some(p => within(project, p))) { buckets.excluded.push(repoRelative); continue; }
    const evidenceFile = project.startsWith('docs/evidence/');
    if (EXCLUDE_PATTERNS.some(pattern => pattern.test(project))
      || (evidenceFile && (EVIDENCE_BINARY.test(project)
        || (existsSync(path.join(repoRoot, repoRelative)) && lstatSync(path.join(repoRoot, repoRelative)).size > 1024 * 1024)))
      || (entry.status === '??' && decisions.some(p => within(project, p)))) { buckets.excluded.push(repoRelative); continue; }
    if (unclaimed.some(u => within(repoRelative, u))) {
      unclaimedHits.push(repoRelative);
      continue;
    }
    if (editing.some(p => within(project, toProjectPath(p)))) { buckets.inProgress.push(repoRelative); continue; }
    const kind = classify(project);
    buckets[kind].push(repoRelative);
  }

  const gate = planForPaths(buckets.code.map(toProjectPath), { root: projectRoot });
  const expectFull = gate.mode === 'full';
  let coupledDocs = [];
  if (buckets.code.length) {
    const entries = git(repoRoot, ['ls-files', '--stage', '-z']).split('\0').filter(Boolean).map(value => {
      const match = /^(\d+) ([a-f0-9]+) (\d+)\t([\s\S]+)$/.exec(value);
      if (!match) throw new Error('index 输出不可解析');
      return { mode: match[1], object: match[2], stage: Number(match[3]), file: match[4] };
    });
    const scope = checkedReceipt?.eligible ? receiptReport.gateReceipt.scope
      : gateInputScope(projectRoot, { entries, prefix: path.relative(repoRoot, projectRoot).replaceAll('\\', '/') }, gate);
    if (!scope) throw new Error('冻结报告缺少输入范围，不能据此分组');
    coupledDocs = buckets.docs.filter(file => scope.documents === 'project'
      ? !toProjectPath(file).startsWith('docs/evidence/') && !['docs/PARALLEL-REGISTRY.md', 'docs/PENDING.md', 'docs/STATUS.md'].includes(toProjectPath(file))
      : scope.relatedFiles.includes(toProjectPath(file)));
    // Tests that read documentation must see the code and those inputs in the same committed snapshot.
    buckets.code.push(...coupledDocs);
    buckets.docs = buckets.docs.filter(file => !coupledDocs.includes(file));
  }

  const commits = [];
  if (buckets.code.length) {
    commits.push({
      scope: 'code',
      paths: buckets.code,
      message: message
        ? message
        : `chore(vite): 收官代码与检查（${buckets.code.length} 文件）`,
    });
  }
  if (buckets.docs.length) {
    commits.push({
      scope: 'docs',
      paths: buckets.docs,
      message: `docs(vite): 收官落库（ship 一条龙）——文档/证据 ${buckets.docs.length} 文件`,
    });
  }

  const registryReminders = ledgerRows(projectRoot, 'registry')
    .filter(row => row.state === 'complete-uncommitted').map(row => row.cells[0]);

  const allPaths = commits.flatMap(commit => commit.paths);
  const foreignStaged = stagedPaths(repoRoot).filter(file => !allPaths.includes(file));
  const blocked = checkedReceipt && !checkedReceipt.eligible ? checkedReceipt.reason
    : unclaimedHits.length ? `staged 预检命中 REGISTRY 无主物品，先认领/排除：${unclaimedHits.join('、')}`
    : foreignStaged.length ? `index 含计划外内容，保留现场并由归属会话处理：${foreignStaged.join('、')}` : null;
  const status = blocked ? 'blocked' : commits.length ? 'ready' : 'noop';
  const reasonCode = checkedReceipt && !checkedReceipt.eligible ? checkedReceipt.reasonCode
    : unclaimedHits.length ? 'SHIP_UNCLAIMED_PATHS' : foreignStaged.length ? 'SHIP_FOREIGN_STAGED'
      : commits.length ? 'SHIP_READY' : 'SHIP_NO_CHANGES';
  const baseline = { head: git(repoRoot, ['rev-parse', 'HEAD']).trim(), index: indexState(repoRoot),
    sources: sourceState(repoRoot, allPaths), governance: governanceState(projectRoot) };
  return {
    schemaVersion: 2, ok: status === 'ready', blocked, status, reasonCode,
    blockedPaths: [...new Set([...unclaimedHits, ...foreignStaged])], foreignStaged, receiptValidity,
    nextAction: status === 'ready' ? 'review-plan-and-confirm-commit-authorization'
      : status === 'noop' ? 'no-action' : checkedReceipt && !checkedReceipt.eligible ? 'obtain-valid-frozen-receipt-and-replan' : 'coordinate-blocked-paths-and-replan',
    commits,
    unknownPaths: buckets.unknown,
    excludedPaths: buckets.excluded,
    inProgressPaths: buckets.inProgress,
    baseline, planSha256: sha(JSON.stringify({ commits, baseline, receipt: receipt ?? null, receiptFingerprint: checkedReceipt?.reportSha256 ?? null })),
    receipt: receipt ?? null, receiptFingerprint: checkedReceipt?.reportSha256 ?? null,
    gate,
    coupledDocs,
    expectFull,
    registryReminders,
    hints: [
      '预览不改 index；已有明确提交授权后才执行 --apply --expect <planSha256>。',
      '按共同验收范围分组，代码与文档各一笔；编辑中、待决目录和中间文件保留现场。',
      expectFull ? '代码笔计划 full；先看选中原因，不固定假定耗时。' : '代码笔计划 ' + gate.mode + '。',
      buckets.unknown.length ? `未识别路径不入库，人工决定：${buckets.unknown.join('、')}` : '',
    ].filter(Boolean),
  };
}

/** 执行落库：逐笔 add+commit（pre-commit 门禁照常生效），返回逐笔结果。 */
export function applyShip(projectRoot, plan, { expectedSha256, receipt = plan?.receipt } = {}) {
  const repoRoot = path.resolve(projectRoot, '..');
  const results = [], completedPaths = new Set();
  let currentScope = null, reasonCode = 'SHIP_APPLY_FAILED';
  const reject = (code, message) => { reasonCode = code; throw new Error(message); };
  try {
  if (!plan?.ok) reject('SHIP_PLAN_BLOCKED', plan?.blocked || '计划为空或被阻断，先看 plan');
  if (expectedSha256 !== plan.planSha256) reject('SHIP_PLAN_EXPECT_REQUIRED', '必须提供已核对计划的 --expect planSha256');
  if (receipt !== plan.receipt) reject('SHIP_PLAN_CHANGED', '复用报告不属于已确认计划');
  if (receipt) {
    const checked = inspectGateReceipt(projectRoot, receipt, { repo: repoRoot });
    if (!checked.eligible) reject(checked.reasonCode, checked.reason);
    if (checked.reportSha256 !== plan.receiptFingerprint) reject('SHIP_PLAN_CHANGED', '冻结报告在预览后已变化；未暂存或提交');
  }
  const paths = plan.commits.flatMap(commit => commit.paths);
  const current = { head: git(repoRoot, ['rev-parse', 'HEAD']).trim(), index: indexState(repoRoot),
    sources: sourceState(repoRoot, paths), governance: governanceState(projectRoot) };
  if (JSON.stringify(current) !== JSON.stringify(plan.baseline)) reject('SHIP_BASELINE_CHANGED', 'HEAD/index/文件/占用在预览后已变化，重新预览；未暂存或提交');
  if (sha(JSON.stringify({ commits: plan.commits, baseline: plan.baseline, receipt: plan.receipt ?? null, receiptFingerprint: plan.receiptFingerprint ?? null })) !== plan.planSha256) reject('SHIP_PLAN_CHANGED', '提交计划内容已变化');
  let expectedIndex = plan.baseline.index, expectedHead = plan.baseline.head;
  for (const commit of plan.commits) {
    currentScope = commit.scope;
    reasonCode = 'SHIP_GROUP_STATE_CHANGED';
    if (indexState(repoRoot) !== expectedIndex || git(repoRoot, ['rev-parse', 'HEAD']).trim() !== expectedHead
      || JSON.stringify(governanceState(projectRoot)) !== JSON.stringify(plan.baseline.governance)) {
      reject('SHIP_GROUP_STATE_CHANGED', '组间 index/HEAD/任务或待决状态发生变化；保留现场，停止后续提交');
    }
    const expectedSources = plan.baseline.sources.filter(item => commit.paths.includes(item.path));
    if (JSON.stringify(sourceState(repoRoot, commit.paths)) !== JSON.stringify(expectedSources)) reject('SHIP_SOURCE_CHANGED', '待提交文件发生变化；保留已完成提交和 index，停止后续步骤');
    const extras = stagedPaths(repoRoot).filter(file => !paths.includes(file));
    if (extras.length) reject('SHIP_FOREIGN_STAGED', '本笔提交前 index 出现计划外内容，保留现场：' + extras.join('、'));
    const unaffected = indexOutside(repoRoot, commit.paths);
    reasonCode = 'SHIP_STAGE_FAILED';
    git(repoRoot, ['add', '--', ...commit.paths]);
    if (indexOutside(repoRoot, commit.paths) !== unaffected) reject('SHIP_STAGE_CONCURRENT', '暂存期间其他 index 内容变化，未提交；保留现场');
    if (stagedPaths(repoRoot).some(file => !paths.includes(file))) reject('SHIP_STAGE_CONCURRENT', '暂存期间 index 出现计划外内容，未提交；保留现场');
    const env = { ...process.env };
    delete env.GATE_MANIFEST_OK; delete env.SKIP_FULL_TESTS; delete env.GATE_RECEIPT;
    if (receipt && commit.scope === 'code') env.GATE_RECEIPT = path.resolve(projectRoot, receipt);
    const preparedIndex = indexState(repoRoot);
    if (JSON.stringify(sourceState(repoRoot, commit.paths)) !== JSON.stringify(expectedSources)) reject('SHIP_SOURCE_CHANGED', '暂存后待提交文件发生变化，未提交；保留现场');
    // --only commits this reviewed group; already-staged later groups remain in the caller's index.
    reasonCode = 'SHIP_COMMIT_FAILED';
    const out = git(repoRoot, ['commit', '--only', '-m', commit.message, '--', ...commit.paths], { env });
    const reportedCommit = [...out.matchAll(/^\[[^\]\r\n]*\s([a-f0-9]{7,64})\]/gm)].at(-1)?.[1] ?? null;
    const result = { scope: commit.scope, commit: reportedCommit, files: commit.paths.length, commitOutput: out.trim().split('\n').slice(-2).join(' | ') };
    results.push(result);
    for (const file of commit.paths) completedPaths.add(file);
    reasonCode = 'SHIP_COMMIT_CONCURRENT';
    const nextHead = git(repoRoot, ['rev-parse', 'HEAD']).trim();
    result.commit = git(repoRoot, ['rev-parse', reportedCommit ?? nextHead]).trim();
    if (indexState(repoRoot) !== preparedIndex) reject('SHIP_COMMIT_CONCURRENT', '提交期间 index 内容发生并发变化；本笔已完成，保留现场并停止后续提交');
    if (git(repoRoot, ['rev-parse', nextHead + '^']).trim() !== expectedHead) reject('SHIP_COMMIT_CONCURRENT', '提交期间 HEAD 发生并发变化；保留现场并停止后续提交');
    expectedIndex = preparedIndex; expectedHead = nextHead;
  }
  return { ok: true, status: 'completed', reasonCode: 'SHIP_COMPLETED', results, registryReminders: plan.registryReminders, nextAction: 'review-and-close-records' };
  } catch (error) {
    const recoveryErrors = [];
    const read = (label, operation, fallback) => { try { return operation(); } catch (failure) { recoveryErrors.push(label + ': ' + failure.message); return fallback; } };
    const failure = error instanceof Error ? error : new Error(String(error));
    failure.details = { completed: results.map(({ scope, commit }) => ({ scope, commit })), currentScope,
      currentHEAD: read('HEAD', () => git(repoRoot, ['rev-parse', 'HEAD']).trim(), null),
      stagedRemaining: read('index', () => stagedPaths(repoRoot), []),
      remainingPaths: (plan?.commits ?? []).flatMap(commit => commit.paths ?? []).filter(file => !completedPaths.has(file)),
      reasonCode, nextAction: 'inspect-preserved-state-and-replan', recoveryErrors };
    throw failure;
  }
}
