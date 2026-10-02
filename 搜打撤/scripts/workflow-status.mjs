import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { classifyLedgerRow, hash, readLedger, table, withoutReleasedText } from './workflow-ledger.mjs';
import { discoverMemory } from './workflow-memory.mjs';
import { extractRegistryTokens } from './registry-paths.mjs';

export function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024 }).trim();
}

export function commitReferences(text) {
  // Bare dates/counters cannot prove a Git reference. Pure numeric SHAs need explicit commit context.
  const candidates = [...text.matchAll(/(?<![\w-])[0-9a-f]{7,40}(?![\w-])/g)];
  return [...new Set(candidates.filter(match => /[a-f]/.test(match[0])
    || /(?:提交|commit|HEAD|落库)\s*[:：]?\s*`?$/i.test(text.slice(Math.max(0, match.index - 20), match.index)))
    .map(match => match[0]))];
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
    activeKeys = new Set(readLedger(root, 'registry').groups.editing.map(row => row.key).filter(Boolean));
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
    const claims = rows.filter(row => classifyLedgerRow(row, kind).isBlocking);
    for (let i = 0; i < claims.length; i++) {
      const paths = extractRegistryTokens(withoutReleasedText(claims[i].cells[1]));
      for (let j = i + 1; j < claims.length; j++) {
        const other = extractRegistryTokens(withoutReleasedText(claims[j].cells[1]));
        const file = paths.find(token => other.some(scope => within(token, scope) || within(scope, token)));
        if (file) warnings.push({ code: 'overlapping-path', file,
          owners: [claims[i].cells[0], claims[j].cells[0]], message: '编辑属地重叠，先协调当前编辑归属' });
      }
    }
  }
  return warnings;
}

// 登记行失真核对（10-02）：登记是人工动作会滞后/误标——状态与工作树事实对不上浮疑点，只提示不阻断。
// 口径：①状态已落库/释放/归档仍留活跃表 → 提示销账移行；②编辑中/进行中但属地全部无未提交改动
// 且最新 mtime 超 staleMs → 可能登记滞后（实际已收官），核实后再用。属地 token 复用 impact-query 口径。
export function registryStaleness(root, rows, changedPaths, { now = Date.now(), staleMs = 24 * 3600 * 1000 } = {}) {
  const warnings = [];
  const changed = new Set(changedPaths.map(item => item.replaceAll('\\', '/').replace(/^搜打撤\//, '')));
  const freshestUnder = relative => {
    const absolute = path.join(root, relative);
    let freshest = 0;
    const visit = dir => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const next = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(next);
        else { const mtime = lstatSync(next).mtimeMs; if (mtime > freshest) freshest = mtime; }
      }
    };
    visit(absolute);
    return freshest;
  };
  for (const row of rows) {
    const owner = row.cells[0] ?? '', territory = row.cells[1] ?? '', status = row.cells[4] ?? '';
    const { state, isBlocking } = classifyLedgerRow(row, 'registry');
    if (state === 'settled' || state === 'released') {
      warnings.push({ code: 'settled-row-remains', owner, message: '状态已是落库/释放/归档，建议移入「近期已释放」完成销账' });
      continue;
    }
    if (!isBlocking || !/编辑中|进行中/.test(status)) continue;
    const tokens = extractRegistryTokens(withoutReleasedText(territory));
    if (!tokens.length) continue;
    if (tokens.some(token => [...changed].some(file => within(file, token)))) continue;
    let freshest = 0, allReachable = true;
    for (const token of tokens) {
      // Incomplete/shorthand scopes cannot establish that the whole claim is idle.
      if (!existsSync(path.join(root, token))) { allReachable = false; continue; }
      const isFile = lstatSync(path.join(root, token)).isFile();
      const mtime = isFile ? lstatSync(path.join(root, token)).mtimeMs : freshestUnder(token);
      if (mtime > freshest) freshest = mtime;
    }
    if (allReachable && freshest && now - freshest > staleMs) {
      warnings.push({ code: 'stale-claim', owner,
        message: `状态${status.trim() || '活跃'}，但属地无未提交改动且最新 mtime 已 ${Math.round((now - freshest) / 3600000)}h 前静止；可能是登记滞后或已收官，核实后销账或续期` });
    }
  }
  return warnings;
}

// PENDING 活账老化（10-02）：最老五项与超阈值计数，供接手简报提示清账节奏；只统计「提出」列可解析的行。
export function pendingAging(rows, { now = new Date(), alertDays = 7 } = {}) {
  const dated = [];
  for (const row of rows) {
    if (!classifyLedgerRow(row, 'pending').isOpen) continue;
    const match = (row.cells[2] ?? '').match(/(?:(\d{4})-)?(\d{2})-(\d{2})/);
    if (!match) continue;
    const month = Number(match[2]) - 1, day = Number(match[3]);
    let year = match[1] ? Number(match[1]) : now.getFullYear();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    let raised = new Date(Date.UTC(year, month, day));
    if (raised.getUTCMonth() !== month || raised.getUTCDate() !== day) continue;
    if (!match[1] && raised.getTime() > today) raised = new Date(Date.UTC(--year, month, day));
    if (raised.getTime() > today) continue;
    dated.push({ key: row.key ?? row.cells[0] ?? '?', item: (row.cells[1] ?? '').slice(0, 36), ageDays: Math.floor((today - raised.getTime()) / 86400000) });
  }
  dated.sort((a, b) => b.ageDays - a.ageDays);
  return { alertDays, alertCount: dated.filter(item => item.ageDays >= alertDays).length, oldest: dated.slice(0, 5) };
}

// 无主物品表销账核对（10-02）：行的「现象」描述了工作树状态（已暂存/已修改/未跟踪），
// 但所指文件当前已不在任何未提交状态——描述与事实不符即提示销账（sound.js 已入库仍挂「待落库」实例）。
// 已划线行跳过；进程/端口类无文件 token 的行天然不命中。
export function unownedResolution(rows, changedPaths) {
  const warnings = [];
  const changed = new Set(changedPaths.map(item => item.replaceAll('\\', '/')));
  for (const row of rows) {
    const cells = Array.isArray(row) ? row : row.cells;
    const text = cells.join(' ');
    if (text.includes('~~')) continue;
    if (!/已暂存|已修改|未跟踪|改动/.test(cells[1] ?? '')) continue;
    for (const token of extractRegistryTokens(cells[0] + ' ' + (cells[1] ?? ''))) {
      // 台账 token 与 git 变更路径的前缀形态可能不一致（workingChanges 按仓库 prefix 剥离 搜打撤/），
      // 裸名、带前缀两个方向都试过才算「仍处于描述状态」
      const bare = token.replace(/^搜打撤\//, '');
      if (changed.has(token) || changed.has(bare) || changed.has('搜打撤/' + token)) continue;
      warnings.push({ code: 'unowned-stale', owner: cells[0].slice(0, 60),
        message: `现象描述含工作树状态，但 ${token} 当前不在未提交状态；可能已处置未销账，核实后划线` });
      break;
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
  const unowned = table(source, '无主物品').rows.map(row => row.cells).filter(cells => !/^~~/.test(cells[0]));
  const warnings = [...ledgerWarnings(registry.rows, 'registry'), ...ledgerWarnings(pending.rows, 'pending')];
  const aging = pendingAging(pending.rows);
  for (const row of registry.groups.editing) {
    // Abbreviated sibling lists (scripts/{a,b}.mjs、c.mjs) are not exact root paths.
    // Only explicit paths support a missing-file conclusion; preserve the prose in allRows.
    const pointers = extractRegistryTokens(withoutReleasedText(row.cells[1])).filter(file => file.includes('/') && /\.(?:md|js|mjs|cjs|json|css)$/.test(file));
    for (const file of new Set(pointers)) if (!existsSync(path.join(root, file))) {
      warnings.push({ code: 'missing-pointer', file, owner: row.cells[0], message: '活跃行的明确文件路径不可达；不自动修改历史路径或归属' });
    }
  }
  for (const ledger of [registry, pending]) {
    // History is a reference, not today's state: examine only active rows.
    const text = ledger.rows.filter(row => row.isOpen).map(row => withoutReleasedText(row.cells.join(' '))).join('\n');
    for (const commit of commitReferences(text)) {
      try { git(root, ['merge-base', '--is-ancestor', commit, 'HEAD']); }
      catch { warnings.push({ code: 'unconfirmed-commit', file: ledger.file, commit, message: '引用提交未确认在 HEAD，不能据此判断交付' }); }
    }
  }
  for (const row of registry.rows.filter(row => row.isOpen)) {
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
  const registryAudit = registry.rows.filter(row => relevant(row.cells.join(' ')));
  const pendingAudit = pending.rows.filter(row => relevant(row.cells.join(' ')));
  const selectedRegistry = registryAudit.filter(row => row.isBlocking);
  const selectedPending = pendingAudit.filter(row => row.isOpen);
  const completed = registryAudit.filter(row => row.state === 'complete-uncommitted');
  const settled = registryAudit.filter(row => ['settled', 'released'].includes(row.state));
  const selectedUnowned = unowned.filter(cells => relevant(cells.join(' ')));
  const allChanges = workingChanges(root), changes = allChanges.filter(change => !scoped || scopes.some(scope => within(change.path, scope) || (change.originalPath && within(change.originalPath, scope))));
  warnings.push(...registryStaleness(root, registry.rows, allChanges.map(change => change.path)));
  warnings.push(...unownedResolution(unowned, allChanges.map(change => change.originalPath ?? change.path)));
  const auditWarnings = warnings.filter(warning => !scoped || relevant(JSON.stringify(warning))
    || registryAudit.some(row => JSON.stringify(warning).includes(row.cells[0]))
    || (warning.kind === 'pending' && pendingAudit.some(row => row.key === warning.key))
    || (warning.commit && [...registryAudit, ...pendingAudit].some(row => commitReferences(row.cells.join(' ')).includes(warning.commit))));
  const maintenanceCodes = new Set(['settled-row-remains', 'unowned-stale', 'status-review']);
  const actionableWarnings = auditWarnings.filter(warning => !maintenanceCodes.has(warning.code));
  const selectedWarnings = options.details ? auditWarnings : actionableWarnings;
  const evidenceTasks = task ? matchingTasks : metadata.entries.filter(item => !scoped || item.record.paths.some(file => scopes.some(scope => within(file, scope) || within(scope, file))));
  const evidence = evidenceTasks.map(item => ({ task: item.record.id, file: item.file, directory: path.posix.dirname(item.file),
    ...(existsSync(path.join(root, path.posix.dirname(item.file), 'README.md')) ? { readme: path.posix.dirname(item.file) + '/README.md' } : {}),
    status: 'candidate-only', note: '只提供证据入口；范围/指纹/环境需 workflow evidence 核对' }));
  const counts = { changes: allChanges.length, registry: registry.groups.editing.length, pending: pending.groups.open.length, unowned: unowned.length,
    completed: registry.groups['complete-uncommitted'].length, settled: registry.groups.settled.length + registry.groups.released.length,
    resolved: pending.groups.resolved.length, warnings: warnings.length, maintenance: auditWarnings.length - actionableWarnings.length,
    tasks: metadata.entries.length, skippedTaskMetadata: metadata.skipped.length };
  const omitted = { changes: counts.changes - changes.length, registry: counts.registry - selectedRegistry.length,
    pending: counts.pending - selectedPending.length, unowned: counts.unowned - selectedUnowned.length, warnings: counts.warnings - selectedWarnings.length,
    evidence: metadata.entries.length - evidenceTasks.length, recentTasks: metadata.entries.length - Math.min(3, scoped ? evidenceTasks.length : metadata.entries.length) };
  return { schemaVersion: 1, at: new Date().toISOString(), head: git(root, ['rev-parse', 'HEAD']),
    recent: git(root, ['log', '-3', '--oneline']).split('\n'), status: changes.map(change => `${change.status} ${change.path}${change.originalPath ? ' <- ' + change.originalPath : ''}`).join('\n'),
    registry: { ...registry, rows: selectedRegistry, completed, settled, allRows: registryAudit,
      groups: Object.fromEntries(Object.entries(registry.groups).map(([state, rows]) => [state, rows.filter(row => relevant(row.cells.join(' ')))])) },
    pending: { ...pending, rows: selectedPending, resolved: pendingAudit.filter(row => !row.isOpen), allRows: pendingAudit,
      groups: Object.fromEntries(Object.entries(pending.groups).map(([state, rows]) => [state, rows.filter(row => relevant(row.cells.join(' ')))])) }, unowned: selectedUnowned,
    warnings: selectedWarnings, audit: { warnings: auditWarnings }, details: Boolean(options.details), aging,
    memory: options.details ? discoverMemory(root) : null, changes, scope: { mode: scoped ? 'task-or-paths' : 'global-summary', task: task ?? null, paths: scopes },
    taskRecord, recentTasks: (scoped ? evidenceTasks : metadata.entries).slice(0, 3).map(item => ({ file: item.file, id: item.record.id, owner: item.record.owner, stage: item.record.stage, updatedAt: item.record.updatedAt })),
    evidence, counts, omitted, skippedTaskMetadata: metadata.skipped,
    limits: ['远端未 fetch', '留言与实页未核验', '只提示，不修改台账/释放占用', '定向摘要省略其他范围；不代表全局无问题', '只读小任务元数据，不解析日志或验收报告；证据入口不是复用批准'] };
}

export function formatHandoff(report) {
  const clip = (value, size = 120) => String(value ?? '').replaceAll('\n', ' ').slice(0, size);
  const lines = [`接手：${report.scope.task ?? (report.scope.paths.length ? report.scope.paths.join(', ') : '全局摘要')}｜HEAD ${report.head.slice(0, 10)}`,
    `相关变更 ${report.changes.length}（省略 ${report.omitted.changes}）；编辑占用 ${report.registry.rows.length}（省略 ${report.omitted.registry}）；完成未提交 ${report.registry.completed.length}；待拍板 ${report.pending.rows.length}（省略 ${report.omitted.pending}）；疑点 ${report.warnings.length}`];
  if (report.taskRecord) lines.push(`任务记录：${report.taskRecord.status}${report.taskRecord.file ? '｜' + report.taskRecord.file : '｜' + report.taskRecord.id}`);
  if (report.counts.skippedTaskMetadata) lines.push(`任务元数据跳过 ${report.counts.skippedTaskMetadata} 项（无效/过大/链接），不能据此推断任务不存在；详情 --json`);
  for (const change of report.changes.slice(0, 3)) lines.push(`变更 ${change.status} ${clip(change.path)}`);
  if (report.changes.length > 3) lines.push(`另 ${report.changes.length - 3} 条相关变更用 --json 查看`);
  for (const row of report.registry.rows.slice(0, 2)) lines.push(`占用 ${clip(row.cells[0], 60)}｜${clip(row.cells[4], 75)}`);
  for (const row of report.registry.completed.slice(0, 2)) lines.push(`未提交归属 ${clip(row.cells[0], 60)}｜${clip(row.cells[1], 75)}`);
  for (const row of report.pending.rows.slice(0, 2)) lines.push(`拍板 ${row.key}｜${clip(row.cells[1])}`);
  for (const warning of report.warnings.slice(0, 2)) lines.push(`疑点 ${warning.code}｜${clip(warning.file ?? warning.owner ?? warning.key ?? warning.message)}`);
  if (report.aging?.alertCount) {
    const top = report.aging.oldest.slice(0, 3).map(item => `${item.key} ${item.ageDays}天`).join('、');
    lines.push(`活账老化：达 ${report.aging.alertDays} 天 ${report.aging.alertCount} 项｜最老 ${top}（仅提示，不自动降级或销账）`);
  }
  for (const item of report.evidence.slice(0, report.details ? 2 : 1)) lines.push(`证据候选 ${item.readme ?? item.file}`);
  if (report.details && !report.scope.task && !report.scope.paths.length) for (const item of report.recentTasks.slice(0, 2)) lines.push(`近期 ${item.id}｜${item.stage ?? '未注明阶段'}｜${item.file}`);
  lines.push(`维护审计：已落库待移行 ${report.registry.settled.length}／已决待移行 ${report.pending.resolved.length}；无主 ${report.unowned.length}（范围外省略 ${report.omitted.unowned}，勿动）；省略条目用 --json 查看`);
  lines.push(`入口：${report.registry.file}；${report.pending.file}；docs/WORKFLOW-TOOLS.md；记忆按需 npm run memory:discover`);
  lines.push('限制：完成未提交仍保护归属；省略范围不代表无问题；证据仅入口；远端/留言/实页未核验。维护疑点用 --details，完整审计用 --json。');
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
