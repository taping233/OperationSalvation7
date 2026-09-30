import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { hash, readLedger, table } from './workflow-ledger.mjs';
import { discoverMemory } from './workflow-memory.mjs';

export function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024 }).trim();
}

export function commitReferences(text) {
  return [...new Set(text.match(/(?<![\w-])[0-9a-f]{7,40}(?![\w-])/g) ?? [])];
}

export function filesUnder(root, relative) {
  const result = [];
  const visit = directory => {
    if (!existsSync(path.join(root, directory))) return;
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const next = path.posix.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(next);
      else if (entry.isFile()) result.push(next);
    }
  };
  visit(relative);
  return result.sort();
}

export function currentDocuments(root) {
  const top = readdirSync(path.join(root, 'docs'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md')).map(entry => 'docs/' + entry.name);
  return [...top, ...filesUnder(root, 'docs/production').filter(file => file.endsWith('.md'))].sort();
}

export function findExisting(root, query, limit = 20, history = false) {
  if (!query?.trim()) throw new Error('请提供 --query 关键词');
  const files = history ? filesUnder(root, 'docs/archive') : [
    ...filesUnder(root, 'scripts'), ...filesUnder(root, 'tests'), ...filesUnder(root, 'game/src'), ...currentDocuments(root),
  ];
  const matches = [];
  let total = 0;
  for (const file of files.filter(file => /\.(?:md|js|mjs|cjs)$/.test(file))) {
    const lines = readFileSync(path.join(root, file), 'utf8').split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      if (!lines[index].toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue;
      total++;
      if (matches.length < limit) matches.push({ file, line: index + 1, excerpt: lines[index].slice(0, 180) });
    }
  }
  return { query, scope: history ? 'history' : 'current-code-and-docs', total, matches, truncated: total > matches.length };
}

export function findSweepCandidates(root, { maxAgeDays = 2, now = new Date() } = {}) {
  const terminals = new Set(['complete-uncommitted', 'partial']);
  let activeKeys = new Set();
  try {
    activeKeys = new Set(readLedger(root, 'registry').rows.map(row => row.key).filter(Boolean));
  } catch { /* 登记簿缺失时只按任务记录判定 */ }
  const candidates = [];
  for (const file of filesUnder(root, 'docs/evidence')) {
    if (path.posix.basename(file) !== 'task.json') continue;
    let task;
    try { task = JSON.parse(readFileSync(path.join(root, file), 'utf8')); }
    catch { candidates.push({ file, problem: 'task.json 无法解析，需人工核对' }); continue; }
    if (!task?.id || terminals.has(task.stage)) continue;
    const updated = Date.parse(task.updatedAt ?? '');
    const ageDays = Number.isFinite(updated) ? Math.round((now.getTime() - updated) / 8640000) / 10 : null;
    if (ageDays !== null && ageDays < maxAgeDays) continue;
    candidates.push({
      file, id: task.id, stage: task.stage, owner: task.owner ?? null,
      ageDays: ageDays ?? 'updatedAt 缺失或非法',
      registryKey: 'WF-' + task.id,
      registryActive: activeKeys.has('WF-' + task.id),
      suggestion: '归属会话确认后 task close partial + ledger close；登记仍活跃先核实会话是否真中断',
    });
  }
  return { schemaVersion: 1, maxAgeDays, candidateCount: candidates.length, candidates,
    limits: ['只读检测，不自动写入；处置走既有 task close 与 ledger close 双确认',
      '活跃会话的 doing 任务超过阈值也会列出，处置前先核实；默认阈值 2 天'] };
}

export function ledgerWarnings(rows, kind) {
  const warnings = [];
  const keys = new Set();
  for (const row of rows) {
    if (row.key && keys.has(row.key)) warnings.push({ code: 'duplicate-id', kind, key: row.key, message: '编号重复，需人工核对' });
    if (row.key) keys.add(row.key);
  }
  if (kind === 'registry') {
    for (let i = 0; i < rows.length; i++) {
      const paths = rows[i].cells[1].match(/(?:game|scripts|tests|docs)\/[\w./-]+\.(?:md|js|mjs|cjs|json|css)/g) ?? [];
      for (const file of new Set(paths)) for (let j = i + 1; j < rows.length; j++) {
        if (rows[j].cells[1].includes(file)) warnings.push({ code: 'overlapping-path', file,
          owners: [rows[i].cells[0], rows[j].cells[0]], message: '可能重叠；已划线释放的路径也需人工核对' });
      }
    }
  }
  return warnings;
}

function normalizedPath(root, value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('任务范围路径不能为空');
  let relative = path.isAbsolute(value) ? path.relative(root, value) : value;
  relative = relative.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (!relative || relative.split('/').some(part => part === '..' || part === '.') || relative.includes(':') || relative.includes('\0')) throw new Error('任务范围路径必须位于项目内');
  return relative;
}
function within(file, scope) {
  const left = file.replaceAll('\\', '/').toLocaleLowerCase(), right = scope.toLocaleLowerCase();
  return left === right || left.startsWith(right + '/');
}
function regexEscape(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function mentionsTask(text, task) {
  if (!task) return false;
  return [task, task.startsWith('WF-') ? task.slice(3) : 'WF-' + task]
    .some(value => new RegExp(`(?<![\\p{L}\\p{N}_-])${regexEscape(value)}(?![\\p{L}\\p{N}_-])`, 'u').test(text));
}
function mentionsPath(text, scopes) {
  const normalized = text.replaceAll('\\', '/').toLocaleLowerCase();
  for (const scope of scopes) {
    const needle = scope.toLocaleLowerCase();
    if (new RegExp(`(?<![\\p{L}\\p{N}_./-])${regexEscape(needle)}(?=$|[/\\s,，、;；:：）)\\]\\x60*])`, 'u').test(normalized)) return true;
    // Explicit directory reservations apply to descendants. Do not mistake
    // cards2 for cards or a prose mention of scripts/a.js for all scripts.
    for (let parent = path.posix.dirname(needle); parent !== '.'; parent = path.posix.dirname(parent)) {
      if (new RegExp(`(?<![\\p{L}\\p{N}_./-])${regexEscape(parent)}/?(?=$|[\\s,，、;；:：）)\\]\\x60])`, 'u').test(normalized)) return true;
    }
  }
  return false;
}
function workingChanges(root) {
  const prefix = git(root, ['rev-parse', '--show-prefix']).replace(/\/$/, '');
  const raw = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
  const fields = raw.split('\0'), entries = [];
  const relative = value => prefix ? path.posix.relative(prefix, value) : value;
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (!field) continue;
    const status = field.slice(0, 2), file = relative(field.slice(3));
    const originalPath = /[RC]/.test(status) ? relative(fields[++index]) : undefined;
    entries.push({ status, path: file, ...(originalPath ? { originalPath } : {}) });
  }
  return entries;
}
function taskMetadata(root) {
  const base = 'docs/evidence', entries = [], skipped = [];
  if (!existsSync(path.join(root, base))) return { entries, skipped };
  if (lstatSync(path.join(root, base)).isSymbolicLink()) return { entries, skipped: [base] };
  for (const directory of readdirSync(path.join(root, base), { withFileTypes: true })) {
    if (!directory.isDirectory() || directory.isSymbolicLink() || !/^\d{4}-\d{2}-\d{2}-/.test(directory.name)) continue;
    const file = `${base}/${directory.name}/task.json`, absolute = path.join(root, file);
    if (!existsSync(absolute)) continue;
    const info = lstatSync(absolute);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 64 * 1024) { skipped.push(file); continue; }
    try {
      const record = JSON.parse(readFileSync(absolute, 'utf8'));
      if (!record || typeof record.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(record.id) || !Array.isArray(record.paths)
        || !record.paths.every(item => typeof item === 'string') || typeof record.updatedAt !== 'string') { skipped.push(file); continue; }
      entries.push({ file, record });
    } catch { skipped.push(file); }
  }
  return { entries: entries.sort((a, b) => b.record.updatedAt.localeCompare(a.record.updatedAt) || a.file.localeCompare(b.file)), skipped };
}

export function handoff(root, options = {}) {
  const registry = readLedger(root, 'registry');
  const pending = readLedger(root, 'pending');
  const source = readFileSync(path.join(root, registry.file), 'utf8');
  const unowned = table(source, '无主物品').rows.map(row => row.cells);
  const warnings = [...ledgerWarnings(registry.rows, 'registry'), ...ledgerWarnings(pending.rows, 'pending')];
  for (const row of registry.rows) {
    const pointers = row.cells.join(' ').match(/(?:game|scripts|tests|docs)\/[\w./-]+\.(?:md|js|mjs|cjs|json|css)\b/g) ?? [];
    for (const file of new Set(pointers)) if (!existsSync(path.join(root, file))) {
      warnings.push({ code: 'missing-pointer', file, owner: row.cells[0], message: '活跃行的明确文件路径不可达；不自动修改历史路径或归属' });
    }
  }
  for (const ledger of [registry, pending]) {
    // History is a reference, not today's state: examine only active rows.
    const text = ledger.rows.map(row => row.cells.join(' ')).join('\n');
    for (const commit of commitReferences(text)) {
      try { git(root, ['merge-base', '--is-ancestor', commit, 'HEAD']); }
      catch { warnings.push({ code: 'unconfirmed-commit', file: ledger.file, commit, message: '引用提交未确认在 HEAD，不能据此判断交付' }); }
    }
  }
  for (const row of registry.rows) {
    if (!/未入 HEAD|未提交/.test(row.cells.join(' '))) continue;
    for (const commit of commitReferences(row.cells.join(' '))) {
      try {
        git(root, ['merge-base', '--is-ancestor', commit, 'HEAD']);
        warnings.push({ code: 'status-review', owner: row.cells[0], commit, message: '本行含未提交描述及已入 HEAD 提交；可能为不同切片，请核对而非自动销账' });
      } catch { /* Already reported as unconfirmed above. */ }
    }
  }
  const metadata = taskMetadata(root), task = options.task;
  if (task !== undefined && (typeof task !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(task))) throw new Error('任务编号无效');
  const matchingTasks = task ? metadata.entries.filter(item => mentionsTask(item.record.id, task)) : [];
  const taskRecord = task ? matchingTasks.length === 1 ? { status: 'found', ...matchingTasks[0] }
    : { status: matchingTasks.length ? 'ambiguous' : 'not-found', id: task, matches: matchingTasks.map(item => item.file) } : null;
  const requestedPaths = options.paths ?? [];
  if (!Array.isArray(requestedPaths)) throw new Error('paths 必须是路径列表');
  const scopes = [...new Set([...requestedPaths, ...(taskRecord?.status === 'found' ? taskRecord.record.paths : [])].map(item => normalizedPath(root, item)))];
  const scoped = Boolean(task || scopes.length), relevant = text => !scoped || mentionsTask(text, task) || mentionsPath(text, scopes);
  const selectedRegistry = registry.rows.filter(row => relevant(row.cells.join(' ')));
  const selectedPending = pending.rows.filter(row => relevant(row.cells.join(' ')));
  const selectedUnowned = unowned.filter(cells => relevant(cells.join(' ')));
  const allChanges = workingChanges(root), changes = allChanges.filter(change => !scoped || scopes.some(scope => within(change.path, scope) || (change.originalPath && within(change.originalPath, scope))));
  const selectedWarnings = warnings.filter(warning => !scoped || relevant(JSON.stringify(warning))
    || selectedRegistry.some(row => JSON.stringify(warning).includes(row.cells[0]))
    || (warning.kind === 'pending' && selectedPending.some(row => row.key === warning.key))
    || (warning.commit && [...selectedRegistry, ...selectedPending].some(row => commitReferences(row.cells.join(' ')).includes(warning.commit))));
  const evidenceTasks = task ? matchingTasks : metadata.entries.filter(item => !scoped || item.record.paths.some(file => scopes.some(scope => within(file, scope) || within(scope, file))));
  const evidence = evidenceTasks.map(item => ({ task: item.record.id, file: item.file, directory: path.posix.dirname(item.file),
    ...(existsSync(path.join(root, path.posix.dirname(item.file), 'README.md')) ? { readme: path.posix.dirname(item.file) + '/README.md' } : {}),
    status: 'candidate-only', note: '只提供证据入口；范围/指纹/环境需 workflow evidence 核对' }));
  const counts = { changes: allChanges.length, registry: registry.rows.length, pending: pending.rows.length, unowned: unowned.length,
    warnings: warnings.length, tasks: metadata.entries.length, skippedTaskMetadata: metadata.skipped.length };
  const omitted = { changes: counts.changes - changes.length, registry: counts.registry - selectedRegistry.length,
    pending: counts.pending - selectedPending.length, unowned: counts.unowned - selectedUnowned.length, warnings: counts.warnings - selectedWarnings.length,
    evidence: metadata.entries.length - evidenceTasks.length, recentTasks: metadata.entries.length - Math.min(3, scoped ? evidenceTasks.length : metadata.entries.length) };
  return { schemaVersion: 1, at: new Date().toISOString(), head: git(root, ['rev-parse', 'HEAD']),
    recent: git(root, ['log', '-3', '--oneline']).split('\n'), status: changes.map(change => `${change.status} ${change.path}${change.originalPath ? ' <- ' + change.originalPath : ''}`).join('\n'),
    registry: { ...registry, rows: selectedRegistry }, pending: { ...pending, rows: selectedPending }, unowned: selectedUnowned,
    warnings: selectedWarnings, memory: discoverMemory(root), changes, scope: { mode: scoped ? 'task-or-paths' : 'global-summary', task: task ?? null, paths: scopes },
    taskRecord, recentTasks: (scoped ? evidenceTasks : metadata.entries).slice(0, 3).map(item => ({ file: item.file, id: item.record.id, owner: item.record.owner, stage: item.record.stage, updatedAt: item.record.updatedAt })),
    evidence, counts, omitted, skippedTaskMetadata: metadata.skipped,
    limits: ['远端未 fetch', '留言与实页未核验', '只提示，不修改台账/释放占用', '定向摘要省略其他范围；不代表全局无问题', '只读小任务元数据，不解析日志或验收报告；证据入口不是复用批准'] };
}

export function formatHandoff(report) {
  const clip = (value, size = 120) => String(value ?? '').replaceAll('\n', ' ').slice(0, size);
  const lines = [`接手：${report.scope.task ?? (report.scope.paths.length ? report.scope.paths.join(', ') : '全局摘要')}｜HEAD ${report.head.slice(0, 10)}`,
    `相关变更 ${report.changes.length}（省略 ${report.omitted.changes}）；占用 ${report.registry.rows.length}（省略 ${report.omitted.registry}）；待拍板 ${report.pending.rows.length}（省略 ${report.omitted.pending}）；疑点 ${report.warnings.length}（省略 ${report.omitted.warnings}）`];
  if (report.taskRecord) lines.push(`任务记录：${report.taskRecord.status}${report.taskRecord.file ? '｜' + report.taskRecord.file : '｜' + report.taskRecord.id}`);
  if (report.counts.skippedTaskMetadata) lines.push(`任务元数据跳过 ${report.counts.skippedTaskMetadata} 项（无效/过大/链接），不能据此推断任务不存在；详情 --json`);
  for (const change of report.changes.slice(0, 3)) lines.push(`变更 ${change.status} ${clip(change.path)}`);
  if (report.changes.length > 3) lines.push(`另 ${report.changes.length - 3} 条相关变更用 --json 查看`);
  for (const row of report.registry.rows.slice(0, 2)) lines.push(`占用 ${clip(row.cells[0], 60)}｜${clip(row.cells[4], 75)}`);
  for (const row of report.pending.rows.slice(0, 2)) lines.push(`拍板 ${row.key}｜${clip(row.cells[1])}`);
  for (const warning of report.warnings.slice(0, 2)) lines.push(`疑点 ${warning.code}｜${clip(warning.file ?? warning.owner ?? warning.key ?? warning.message)}`);
  for (const item of report.evidence.slice(0, 2)) lines.push(`证据候选 ${item.readme ?? item.file}`);
  if (!report.scope.task && !report.scope.paths.length) for (const item of report.recentTasks.slice(0, 2)) lines.push(`近期 ${item.id}｜${item.stage ?? '未注明阶段'}｜${item.file}`);
  lines.push(`显示省略：占用 ${Math.max(0, report.registry.rows.length - 2)}／拍板 ${Math.max(0, report.pending.rows.length - 2)}／疑点 ${Math.max(0, report.warnings.length - 2)}／证据 ${Math.max(0, report.evidence.length - 2)}；无主 ${report.unowned.length}（范围外省略 ${report.omitted.unowned}，勿动）`);
  lines.push(`入口：${report.registry.file}；${report.pending.file}；docs/WORKFLOW-TOOLS.md；记忆按需 npm run memory:discover`);
  lines.push('限制：省略范围不代表无问题；证据仅入口，未核复用资格；远端/留言/实页未核验。完整相关详情用 --json。');
  return lines.join('\n');
}

export function duplicateDocuments(root) {
  const byHash = new Map();
  for (const file of currentDocuments(root)) {
    const digest = hash(readFileSync(path.join(root, file)));
    if (!byHash.has(digest)) byHash.set(digest, []);
    byHash.get(digest).push(file);
  }
  return [...byHash.entries()].filter(([, files]) => files.length > 1).map(([sha256, files]) => ({ sha256, files }));
}
