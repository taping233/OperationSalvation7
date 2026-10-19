import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const evidence = 'docs/evidence/2026-10-19-cleanup-docs';
const beforeBytes = fs.readFileSync(evidence+'/audit.json');
if (!fs.existsSync(evidence+'/before.json')) fs.writeFileSync(evidence+'/before.json',beforeBytes);
const report = JSON.parse(beforeBytes);
const selected = new Map();
for (const entry of report.results.filter(r => r.historical && r.file.startsWith('docs/evidence/'))) {
  if (/2026-10-19-(temp-cleanup|unused-cleanup|wu-animation-revert|wu-battle-rig)/.test(entry.file)
    || /(?:^|\/)(originals|baseline|snapshot|preserved|runtime-copy|before)\//.test(entry.file)) continue;
  const top = entry.file.split('/').slice(0,3).join('/')+'/README.md';
  const file = fs.existsSync(top) ? top : entry.file;
  if (!selected.has(file)) selected.set(file,[]);
  selected.get(file).push(entry.file);
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const amendments = [];
for (const [file, affected] of selected) {
  const original = fs.readFileSync(file);
  if (original.includes(Buffer.from('<!-- cleanup-status-20261019 -->'))) throw Error('Already annotated: '+file);
  const newline = original.indexOf(10);
  const split = newline < 0 ? original.length : newline+1;
  const eol = original.includes(Buffer.from('\r\n')) ? '\r\n' : '\n';
  const link = path.relative(path.dirname(file),'docs/CLEANUP-STATUS.md').replaceAll('\\','/');
  const note = Buffer.from(eol+'<!-- cleanup-status-20261019 -->'+eol
    +'> 2026-10-19清理后提示：本报告及本目录附件记录当时状态，其中提及的旧资源、旧音频实现或旧交付路径可能已按批准清单删除。“保留原文件/保留旧包”不代表今天仍可访问。当前保留包、替代入口与执行回执见[清理后状态]('+link+')；下文历史验收结论与原始内容保持。'+eol+eol);
  const updated = Buffer.concat([original.subarray(0,split),note,original.subarray(split)]);
  const reconstructed = Buffer.concat([updated.subarray(0,split),updated.subarray(split+note.length)]);
  if (!reconstructed.equals(original)) throw Error('Historical body changed: '+file);
  fs.writeFileSync(file,updated);
  amendments.push({file,affectedReports:affected,originalSha256:hash(original),updatedSha256:hash(updated),insertionOffset:split,insertionBytes:note.length,historicalBodyPreserved:true});
}
fs.writeFileSync(evidence+'/historical-amendments.json',JSON.stringify({amendments,rawSnapshotsAndArchiveOriginalsUnchanged:true},null,2)+'\n');
console.log(JSON.stringify({amendedEntrypoints:amendments.length,coveredReports:amendments.reduce((s,a)=>s+a.affectedReports.length,0),historicalBodiesPreserved:amendments.every(a=>a.historicalBodyPreserved)}));
