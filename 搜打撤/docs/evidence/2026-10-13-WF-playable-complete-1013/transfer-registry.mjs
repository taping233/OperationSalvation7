// One-time, reviewable transfer of ended chats. The byte-identical source is archived first.
import { createHash } from 'node:crypto';
import { existsSync, openSync, closeSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { table } from '../../../scripts/workflow-ledger.mjs';
import { classifyLedgerRow } from '../../../scripts/registry-paths.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const current = path.join(project, 'docs/PARALLEL-REGISTRY.md');
const archive = path.join(project, 'docs/archive/WF-playable-takeover-1013/originals/docs/PARALLEL-REGISTRY.md');
const owner = 'WF-playable-complete-1013';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
const applying = args.includes('--apply');
const expected = args[args.indexOf('--expect') + 1];
if (!existsSync(archive)) throw new Error('缺少原文归档');
const source = readFileSync(current);
const archived = readFileSync(archive);
const beforeSha256 = hash(source);
if (hash(archived) !== beforeSha256) throw new Error('现行台账已偏离归档，重新审阅后另建快照');
if (applying && (!expected || expected !== beforeSha256)) throw new Error('缺少匹配的 --expect SHA256');

const text = source.toString('utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const active = table(text, '活跃登记');
const ended = active.rows.filter(row => row.cells.length === 5
  && classifyLedgerRow(row, 'registry').state === 'editing'
  && !row.cells[0].includes(owner));
if (ended.length === 0) throw new Error('没有可移交的旧编辑行');
const fourColumn = active.rows.filter(row => row.cells.length === 4);
if (active.rows.some(row => ![4, 5].includes(row.cells.length))
  || fourColumn.some(row => !/^\d\d-\d\d$/.test(row.cells[2]) || !/完成未提交|编辑释放/.test(row.cells[3]))) {
  throw new Error('活跃表含无法判定的列数/状态，拒绝批量移交');
}
const own = active.rows.filter(row => row.cells[0].includes(owner));
if (own.length !== 1 || classifyLedgerRow(own[0], 'registry').state !== 'editing') throw new Error('接管行缺失或状态不符');

const lines = [...active.lines];
const transferred = ended.map(row => {
  const cells = [...row.cells];
  cells[4] = `已释放（老板确认原聊天结束；${owner} 接管待核；原状态：${cells[4]}）`;
  return '| ' + cells.join(' | ') + ' |';
});
for (const row of [...ended].sort((a, b) => b.index - a.index)) lines.splice(row.index, 1);
for (const row of fourColumn) {
  const index = lines.indexOf(row.line);
  if (index < 0) throw new Error('四列历史行已变化');
  const [session, territory, date, status] = row.cells;
  lines[index] = '| ' + [session, territory, '事项见原状态；接管时补齐列', date, status].join(' | ') + ' |';
}
const ownIndex = lines.findIndex(line => line.includes(`（Codex 完整版收拢与安全提交 ${owner}）`));
if (ownIndex < 0) throw new Error('找不到接管登记行');
const ownCells = lines[ownIndex].trim().slice(1, -1).split('|').map(cell => cell.trim());
if (ownCells.length !== 5) throw new Error('接管行结构变化');
ownCells[1] = `game/；tests/；scripts/；docs/；narrative/；本表自有行；原属地快照 docs/archive/WF-playable-takeover-1013/`;
ownCells[4] = '编辑中；老板确认所有旧聊天结束，本聊天接管全部未提交成果并逐项核验；旧会话已销账，服务身份待复核；不擅停/推送/发布';
lines[ownIndex] = '| ' + ownCells.join(' | ') + ' |';
const released = table(lines.join('\n'), '近期已释放');
lines.splice(released.insertion, 0, ...transferred);
const output = lines.join(eol);
const afterActive = table(output, '活跃登记');
const afterReleased = table(output, '近期已释放');
if (afterActive.rows.length !== active.rows.length - ended.length
  || afterReleased.rows.length !== table(text, '近期已释放').rows.length + ended.length) {
  throw new Error('移交后行数不守恒');
}
const result = {
  beforeSha256, afterSha256: hash(output), transferred: ended.length, normalizedFourColumn: fourColumn.length,
  remainingActive: afterActive.rows.length, transferredSessions: ended.map(row => row.cells[0]),
  archive: path.relative(project, archive).replaceAll('\\', '/'),
};
if (applying) {
  const lock = current + '.workflow-lock';
  const fd = openSync(lock, 'wx');
  try {
    if (hash(readFileSync(current)) !== beforeSha256) throw new Error('台账在预览后变化');
    writeFileSync(current, output);
    if (hash(readFileSync(current)) !== result.afterSha256) throw new Error('写入后哈希不符');
  } finally {
    closeSync(fd);
    unlinkSync(lock);
  }
}
console.log(JSON.stringify({ ok: true, mode: applying ? 'applied' : 'plan', ...result }));
