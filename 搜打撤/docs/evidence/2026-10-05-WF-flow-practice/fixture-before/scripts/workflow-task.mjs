import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hash } from './workflow-ledger.mjs';

const terminal = new Set(['complete-uncommitted', 'partial']);
const editable = new Set(['goal', 'paths', 'doneWhen', 'stage', 'checks', 'unverified', 'doneWhenConfirmed']);

function taskFile({ id, date }) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(id ?? '')) throw new Error('任务编号须为 1–80 位字母、数字、连字符');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('日期必须为有效 YYYY-MM-DD');
  return `docs/evidence/${date}-${id}/task.json`;
}

function safePath(root, file) {
  if (typeof file !== 'string' || !file.trim() || path.isAbsolute(file) || file.includes('\\') || file.split('/').some(part => part === '..') || /[\r\n\0]/.test(file)) throw new Error('路径必须为项目内相对路径');
  const target = path.resolve(root, file);
  const relative = path.relative(path.resolve(root), target);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('路径越出项目边界');
  let current = path.resolve(root);
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('路径不得穿越符号链接');
  }
  return target;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} 必须为非空文字`);
  return value.trim();
}
function list(value, name, required = false) {
  if (!Array.isArray(value) || (required && !value.length)) throw new Error(`${name} 必须为${required ? '非空' : ''}文字数组`);
  return value.map(item => text(item, name));
}

function checksAt(root, checks) {
  if (!Array.isArray(checks)) throw new Error('checks 必须为明确检查数组');
  return checks.map(check => {
    if (!check || !['manual', 'report'].includes(check.kind) || !['passed', 'failed', 'unverified'].includes(check.result)) throw new Error('检查须声明 kind manual/report 与 result passed/failed/unverified');
    if (check.kind === 'manual') return { kind: 'manual', description: text(check.description, '检查说明'), result: check.result };
    const reportPath = safePath(root, check.report);
    if (!check.report.startsWith('docs/evidence/') || !check.report.endsWith('.json')) throw new Error('检查报告必须在 docs/evidence/ 下');
    const raw = readFileSync(reportPath, 'utf8');
    const report = JSON.parse(raw);
    if (check.result === 'passed' && !passedReport(root, report)) throw new Error('passed 检查报告未证明实际执行且稳定通过');
    return { kind: 'report', report: check.report, result: check.result, sha256: hash(raw), verification: 'recorded-result-only-not-current-freshness' };
  });
}

function passedReport(root, report) {
  if (report.exitCode !== 0 || report.signal || report.error || ['skip', 'blocked', 'invalidated', 'cleanup-failed'].includes(report.outcome)) return false;
  if (report.kind === 'staged-snapshot-check') {
    const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
    return report.outcome === 'passed' && report.commandExitCode === 0 && ['quick', 'full'].includes(report.gate?.mode)
      && validHash(report.plan?.indexSha256) && report.plan.indexSha256 === report.indexAfterSha256
      && report.plan.dependencies?.ok === true && report.dependenciesAfterCopy?.ok === true
      && report.gitView?.isolatedMetadata === true && validHash(report.gitView.indexSha256)
      && report.gitView.indexSha256 === report.snapshotIndexAfterSha256
      && Array.isArray(report.snapshotTrackedMutations) && report.snapshotTrackedMutations.length === 0
      && report.snapshotRemoved === true;
  }
  if (report.kind !== 'automated-local-check' || !stableRun(report)) return false;
  if (report.validation) return report.validation.executed === true && ['targeted', 'quick', 'full', 'suite'].includes(report.validation.mode);
  if (!report.log || !report.logSha256) return false;
  const bytes = readFileSync(safePath(root, report.log));
  if (hash(bytes) !== report.logSha256) return false;
  const output = bytes.toString('utf8');
  return !/模式：skip/.test(output) && (/\[gate\] PASS：(?:full|quick)/.test(output)
    || /Test Files\s+.*passed/.test(output));
}

function stableRun(report) {
  const { before, after } = report;
  if (!before || !after || before.error || after.error) return false;
  const stableScope = snapshot => {
    if (!Array.isArray(snapshot.manifest) || !snapshot.environment || snapshot.manifest.some(entry => typeof entry.file !== 'string' || typeof entry.sha256 !== 'string')) return null;
    const manifest = snapshot.manifest.filter(entry => !['docs/PARALLEL-REGISTRY.md', 'docs/PENDING.md', 'docs/STATUS.md'].includes(entry.file)
      && !/^docs\/evidence\/[^/]+\/task\.json$/.test(entry.file)).sort((a, b) => a.file.localeCompare(b.file));
    return hash(JSON.stringify({ manifest, environment: snapshot.environment }));
  };
  const left = stableScope(before), right = stableScope(after);
  // State-only changes do not negate a successful check; old ungrouped reports stay conservative.
  return left && right ? left === right : Boolean(before.sha256) && before.sha256 === after.sha256;
}

export function readTask(root, identity) {
  const file = taskFile(identity);
  const target = safePath(root, file);
  if (!existsSync(target)) return { file, sha256: 'absent', task: null };
  const raw = readFileSync(target, 'utf8');
  const task = JSON.parse(raw);
  if (task.id !== identity.id || task.date !== identity.date || task.schemaVersion !== 1) throw new Error('任务文件身份不匹配');
  return { file, sha256: hash(raw), task };
}

export function planTask(root, { action, id, date, owner, input }) {
  if (!['start', 'update', 'close'].includes(action)) throw new Error('操作仅支持 start/update/close');
  owner = text(owner, 'owner');
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !editable.has(key))) throw new Error('input 含未知字段或试图修改任务身份');
  const before = readTask(root, { id, date });
  if (action === 'start' && before.task) throw new Error('任务已存在，不得覆盖或重复建设');
  if (action === 'start' && summarizeTasks(root, { id }).tasks.length) throw new Error('任务编号已存在于其他日期，不得重复建设');
  if (action !== 'start' && !before.task) throw new Error('任务不存在，请先 start');
  if (before.task && before.task.owner !== owner) throw new Error('负责人不匹配，不得改其他会话任务');
  if (before.task && terminal.has(before.task.stage)) throw new Error('任务已收官，不自动重开；请明确新任务范围');
  const merged = { ...before.task, ...input };
  const task = { schemaVersion: 1, id, date, owner, goal: text(merged.goal, 'goal'),
    paths: list(merged.paths, 'paths', true), doneWhen: list(merged.doneWhen, 'doneWhen', true),
    stage: merged.stage ?? 'planned', checks: Object.hasOwn(input, 'checks') ? checksAt(root, input.checks) : before.task?.checks ?? [], unverified: list(merged.unverified ?? [], 'unverified'),
    updatedAt: new Date().toISOString() };
  task.paths.forEach(file => safePath(root, file));
  if (action !== 'close' && !['planned', 'doing'].includes(task.stage)) throw new Error('终态必须通过 close 明确收官');
  if (action === 'close') {
    if (!terminal.has(input.stage) || !Object.hasOwn(input, 'checks') || !Object.hasOwn(input, 'unverified')) throw new Error('close 必须明确终态、checks 与 unverified');
    if (task.stage === 'complete-uncommitted' && input.doneWhenConfirmed !== true) throw new Error('完成须负责人明确 doneWhenConfirmed，不能以 exit0 自动判断');
    task.closure = { kind: 'manual', doneWhenConfirmed: input.doneWhenConfirmed === true, statement: '负责人按 doneWhen 判断；检查结果不自动证明作品完成' };
  }
  return { file: before.file, action, expectedSha256: before.sha256, before: before.task, task,
    content: JSON.stringify(task, null, 2) + '\n', limits: ['预览不写入', '仅任务执行记录；不更新 REGISTRY、STATUS 或需求规格', '手工声明不是独立验收；报告结果未核对当前 freshness'] };
}

export function applyTask(root, plan, expectedSha256) {
  if (!expectedSha256) throw new Error('必须提供预览时的 --expect SHA256（新任务为 absent，单会话可用 auto）');
  if (expectedSha256 !== plan.expectedSha256) throw new Error('任务在预览后已变化（或 SHA 抄写有误），重新预览，未写入');
  const task = JSON.parse(plan.content);
  if (plan.file !== taskFile(task) || task.owner !== plan.task.owner || task.id !== plan.task.id) throw new Error('任务计划身份不匹配');
  const target = safePath(root, plan.file);
  mkdirSync(path.dirname(target), { recursive: true });
  const lock = target + '.workflow-lock';
  const temporary = target + '.' + randomUUID() + '.workflow-tmp';
  let descriptor;
  const unchanged = () => {
    const latest = readTask(root, task);
    if (latest.sha256 !== expectedSha256) throw new Error('任务已变化，重新预览，未写入');
    if (latest.task && latest.task.owner !== task.owner) throw new Error('负责人不匹配');
    if (plan.action === 'close') for (const check of task.checks.filter(item => item.kind === 'report')) {
      if (hash(readFileSync(safePath(root, check.report), 'utf8')) !== check.sha256) throw new Error('检查报告已变化，重新预览，未写入');
    }
  };
  try {
    descriptor = openSync(lock, 'wx');
    unchanged();
    if (expectedSha256 === 'absent') writeFileSync(target, plan.content, { flag: 'wx' });
    else {
      writeFileSync(temporary, plan.content, { flag: 'wx' });
      unchanged();
      renameSync(temporary, target);
    }
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
      if (existsSync(temporary)) unlinkSync(temporary);
      unlinkSync(lock);
    }
  }
  return { file: plan.file, sha256: hash(plan.content), action: plan.action, task };
}

export function summarizeTasks(root, { id, owner } = {}) {
  const directory = safePath(root, 'docs/evidence');
  const tasks = [];
  if (existsSync(directory)) for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const identity = entry.name.match(/^(\d{4}-\d{2}-\d{2})-([a-zA-Z0-9][a-zA-Z0-9-]{0,79})$/);
    if (!entry.isDirectory() || entry.isSymbolicLink() || !identity || !existsSync(path.join(directory, entry.name, 'task.json'))) continue;
    const record = readTask(root, { date: identity[1], id: identity[2] });
    if ((!id || record.task.id === id) && (!owner || record.task.owner === owner)) tasks.push(record);
  }
  return { tasks: tasks.sort((a, b) => b.task.updatedAt.localeCompare(a.task.updatedAt)), limits: ['只读从 task.json 生成；不创建第二份状态台账'] };
}
