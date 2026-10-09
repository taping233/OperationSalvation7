import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, table } from '../../../scripts/workflow-ledger.mjs';
import { classifyLedgerRow, parseActiveRegistry } from '../../../scripts/registry-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const archived = 'docs/archive/WF-ledger-context-1009/originals/docs/';
const targets = ['PARALLEL-REGISTRY.md', 'PENDING.md'];
const clean = text => text.replaceAll('|', '／').replace(/\r?\n/g, ' ').trim();
const short = text => clean(text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[\[\]`*_]/g, '')).slice(0, 70);
const plans = [];
for (const name of targets) {
  const file = `docs/${name}`;
  const original = readFileSync(path.join(root, file), 'utf8');
  const snapshot = readFileSync(path.join(root, archived, name), 'utf8');
  if (original !== snapshot) throw new Error(`${name} changed after snapshot; regenerate the plan`);
  let content, preserved, rows;
  const href = `archive/WF-ledger-context-1009/originals/docs/${name}`;
  if (name === 'PARALLEL-REGISTRY.md') {
    const marker = '## 近期已释放';
    const cut = original.indexOf(marker);
    if (cut < 0) throw new Error('Missing released section');
    const prefix = original.slice(0, cut);
    const historical = original.slice(cut + marker.length);
    const ids = new Map();
    for (const line of historical.split(/\r?\n/)) {
      for (const match of line.matchAll(/WF-[a-zA-Z0-9-]+/g)) {
        if (!ids.has(match[0])) ids.set(match[0], short(line));
      }
    }
    const index = [...ids].map(([id, title]) => `| Friday（历史记录 ${id}） | ${title} | [原文](${href}#近期已释放) | 历史状态与归属见原文 |`);
    content = prefix + marker + '\n\n此段索引已释放记录；完整路径、归属、结果与授权原文保存在[10-09 整理前快照](' + href + '#近期已释放)。当前编辑与服务占用仍由上方活跃登记维护。\n\n'
      + '| 会话 / 任务 | 查阅线索 | 来源 | 状态说明 |\n|---|---|---|---|\n' + index.join('\n') + '\n';
    preserved = JSON.stringify(parseActiveRegistry(original, { includeSettled: true })) === JSON.stringify(parseActiveRegistry(content, { includeSettled: true }));
    rows = index.length;
  } else {
    const active = table(original, '活账');
    const closed = table(original, '已决记录');
    const resolved = active.rows.filter(row => classifyLedgerRow(row, 'pending').state === 'resolved');
    if ([...active.rows, ...closed.rows].some(row => row.cells.length !== 5)) throw new Error('Unexpected pending row shape');
    const remove = new Set(resolved.map(row => row.index));
    const lines = active.lines.filter((_, i) => !remove.has(i));
    const cut = lines.findIndex(line => line.startsWith('## 已决记录'));
    if (cut < 0) throw new Error('Missing decisions section');
    const histories = [...resolved, ...closed.rows];
    const index = histories.map(row => {
      const [id, matter, date, , status] = row.cells;
      return `| ${id} | ${short(matter)} | ${clean(date)} | [完整决定与来源](${href}) | ${clean(status)} |`;
    });
    content = lines.slice(0, cut).join('\n') + '\n## 已决记录（不计入活账）\n\n这里保留编号与原登记状态；决定、实施详情和原来源见[整理前快照](' + href + ')。原备注仍为“待专项”等状态的记录，按其来源核对后续任务。\n\n'
      + '| # | 历史事项 | 提出 / 记录 | 来源 | 原备注 |\n|---|---|---|---|---|\n' + index.join('\n') + '\n';
    const openLines = text => table(text, '活账').rows.filter(row => classifyLedgerRow(row, 'pending').state === 'open').map(row => row.line);
    preserved = JSON.stringify(openLines(original)) === JSON.stringify(openLines(content));
    rows = index.length;
  }
  if (!preserved) throw new Error(`${name} changed active claims`);
  const preview = name.replace('.md', '-preview.md');
  writeFileSync(path.join(here, preview), content, 'utf8');
  plans.push({ file, expectedSha256: hash(original), preview, previewSha256: hash(content),
    bytesBefore: Buffer.byteLength(original), bytesAfter: Buffer.byteLength(content), preservedActive: preserved, historyIndexRows: rows });
}
writeFileSync(path.join(here, 'ledger-plan.json'), JSON.stringify({ plans, method: 'preserve-original-copy-then-revise-history-index' }, null, 2) + '\n');
console.log(JSON.stringify(plans));
