import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const hash = value => createHash('sha256').update(value).digest('hex');
export const LEDGERS = {
  registry: { file: 'docs/PARALLEL-REGISTRY.md', active: '活跃登记', closed: '近期已释放', columns: 5, closedColumns: 4 },
  pending: { file: 'docs/PENDING.md', active: '活账', closed: '已决记录', columns: 5, closedColumns: 5 },
};

export function table(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex(line => line.startsWith('## ') && line.slice(3).startsWith(heading));
  if (start < 0) throw new Error('找不到台账章节：' + heading);
  let end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  if (end < 0) end = lines.length;
  const rows = [];
  let insertion = -1;
  for (let index = start + 1; index < end; index++) {
    const line = lines[index];
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().slice(1, -1).split('|').map(cell => cell.trim());
    if (cells.every(cell => /^[-:\s]+$/.test(cell))) { insertion = index + 1; continue; }
    if (insertion >= 0) rows.push({ index, cells, line });
  }
  if (insertion < 0) throw new Error('台账缺少表头分隔行：' + heading);
  return { lines, rows, insertion };
}

function identifier(cells, kind) {
  return kind === 'pending' ? cells[0].replaceAll('~', '') : cells[0].match(/WF-[a-zA-Z0-9-]+/)?.[0];
}

export function readLedger(root, kind) {
  const config = LEDGERS[kind];
  if (!config) throw new Error('台账仅支持 registry / pending');
  const markdown = readFileSync(path.join(root, config.file), 'utf8');
  return { file: config.file, sha256: hash(markdown), rows: table(markdown, config.active).rows.map(row => ({ key: identifier(row.cells, kind) ?? null, cells: row.cells })) };
}

export function planLedger(root, { kind, action, key, owner, cells }) {
  const config = LEDGERS[kind];
  if (!config) throw new Error('台账仅支持 registry / pending');
  if (!['add', 'update', 'close'].includes(action)) throw new Error('操作仅支持 add / update / close');
  if (!Array.isArray(cells) || cells.length !== (action === 'close' ? config.closedColumns : config.columns)
    || cells.some((cell, index) => typeof cell !== 'string' || /[|\r\n]/.test(cell)
      || (!cell.trim() && !(kind === 'pending' && index === 4)))) {
    throw new Error('单元格数量不符、为空或含表格分隔符/换行');
  }
  if (kind === 'registry' && !/^WF-[a-zA-Z0-9-]+$/.test(key ?? '')) throw new Error('登记需要稳定 WF- 任务编号');
  if (kind === 'pending' && !/^\d+$/.test(key ?? '')) throw new Error('待拍板编号必须为数字');
  if (identifier(cells, kind) !== key) throw new Error('第一列必须保留任务编号');
  if (kind === 'registry' && (!owner || !cells[0].startsWith(owner + '（'))) throw new Error('第一列须为 owner（任务说明 WF-编号）');
  const markdown = readFileSync(path.join(root, config.file), 'utf8');
  const active = table(markdown, config.active);
  const all = [active, table(markdown, config.closed)];
  const matches = all.flatMap(section => section.rows).filter(row => identifier(row.cells, kind) === key);
  const row = active.rows.find(candidate => identifier(candidate.cells, kind) === key);
  if (action === 'add' && matches.length) throw new Error('编号已存在，不得重复登记');
  if (action !== 'add' && (!row || matches.length !== 1)) throw new Error('活账编号缺失或不唯一');
  if (row && kind === 'registry' && !row.cells[0].startsWith(owner + '（')) throw new Error('负责人不匹配，不得改其他会话');
  const replacement = '| ' + cells.join(' | ') + ' |';
  const lines = [...active.lines];
  if (action === 'update') lines[row.index] = replacement;
  else if (action === 'add') lines.splice(active.insertion, 0, replacement);
  else {
    lines.splice(row.index, 1);
    const closed = table(lines.join('\n'), config.closed);
    lines.splice(closed.insertion, 0, replacement);
  }
  return { file: config.file, expectedSha256: hash(markdown), action, key, before: row?.line ?? null,
    after: replacement, content: lines.join(markdown.includes('\r\n') ? '\r\n' : '\n') };
}

// Cooperative writer lock + optimistic revision check. External editors do not honor this lock;
// callers still need the project's file ownership agreement, and must not edit concurrently.
export function applyLedger(root, plan, expectedSha256) {
  if (!expectedSha256) throw new Error('必须提供预览时的 --expect SHA256（单会话可用 auto）');
  if (expectedSha256 !== plan.expectedSha256) throw new Error('台账在预览后已变化（或 SHA 抄写有误），重新预览，未写入');
  if (!Object.values(LEDGERS).some(config => config.file === plan.file)) throw new Error('禁止写入非台账文件');
  const target = path.join(root, plan.file);
  const lock = target + '.workflow-lock';
  const temporary = target + '.' + randomUUID() + '.workflow-tmp';
  let fd;
  try {
    fd = openSync(lock, 'wx');
    if (hash(readFileSync(target, 'utf8')) !== expectedSha256) throw new Error('台账已变化，重新预览，未写入');
    writeFileSync(temporary, plan.content, { flag: 'wx' });
    if (hash(readFileSync(target, 'utf8')) !== expectedSha256) throw new Error('台账已变化，重新预览，未写入');
    renameSync(temporary, target);
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
      if (existsSync(temporary)) unlinkSync(temporary);
      unlinkSync(lock);
    }
  }
  return { file: plan.file, sha256: hash(plan.content), action: plan.action, key: plan.key };
}
