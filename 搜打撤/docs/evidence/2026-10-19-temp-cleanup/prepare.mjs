import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd();
const evidence = 'docs/evidence/2026-10-19-temp-cleanup';
const local = '.tmp/cleanup-plan-1019';
fs.mkdirSync(local, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const targets = [
  '.tmp/exe-stability-1018/extracted',
  '.tmp/exe-review-1018/extracted',
  '.tmp/clean-exe-1016/project/desktop-app/node_modules',
  '.tmp/clean-exe-1016/project/builder-cache',
  '.tmp/page-perf-1018/delivery/win-unpacked',
  '.tmp/deep-perf-1018/delivery/win-unpacked',
  '.tmp/startup-fix-1018/delivery/win-unpacked',
  '.tmp/exe-errors-1018/delivery/win-unpacked',
  '.tmp/exe-errors-1018/delivery-fixed/win-unpacked',
  '.tmp/exe-refresh-1018/delivery/win-unpacked',
];
function inventory(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (fs.lstatSync(file).isSymbolicLink()) throw Error('Linked path: ' + file);
    if (entry.isDirectory()) files.push(...inventory(file));
    else { const bytes = fs.readFileSync(file); files.push({ path: file.replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes) }); }
  }
  return files;
}
const entries = [];
const allFiles = [];
for (const target of targets) {
  const resolved = fs.realpathSync(target);
  if (resolved !== path.resolve(target) || !resolved.startsWith(path.join(root, '.tmp') + path.sep)) throw Error('Unsafe target');
  const files = inventory(target).sort((a,b) => a.path.localeCompare(b.path));
  allFiles.push(...files);
  entries.push({ path: target, files: files.length, bytes: files.reduce((s,f) => s+f.bytes,0), treeSha256: hash(JSON.stringify(files)) });
}
const retained = [];
for (const dir of ['.tmp/page-perf-1018/delivery', '.tmp/deep-perf-1018/delivery', '.tmp/startup-fix-1018/delivery', '.tmp/exe-errors-1018/delivery-fixed', '.tmp/exe-refresh-1018/delivery', '.tmp/exe-stability-1018/delivery']) {
  const exes = fs.readdirSync(dir).filter(f => f.endsWith('.exe'));
  if (!exes.length) throw Error('No retained portable EXE: ' + dir);
  for (const name of exes) { const file = path.join(dir, name); const bytes = fs.readFileSync(file); retained.push({ path:file.replaceAll('\\','/'), bytes:bytes.length, sha256:hash(bytes) }); }
}
const duplicates = [];
for (const [removed, kept] of [['.tmp/exe-stability-1018/extracted','.tmp/exe-stability-1018/delivery/win-unpacked'],['.tmp/exe-review-1018/extracted','.tmp/exe-refresh-1018/delivery/win-unpacked']]) {
  const a = allFiles.filter(f => f.path.startsWith(removed+'/')).map(f => ({...f,path:f.path.slice(removed.length)}));
  const b = inventory(kept).map(f => ({...f,path:f.path.slice(kept.length)})).sort((a,b)=>a.path.localeCompare(b.path));
  if (JSON.stringify(a)!==JSON.stringify(b)) throw Error('Expected duplicate differs: '+removed);
  duplicates.push({ removed, duplicateOf:kept, verifiedFiles:a.length });
}
const inventoryBytes = Buffer.from(JSON.stringify(allFiles,null,2)+'\n');
fs.writeFileSync(local+'/inventory.json',inventoryBytes);
const report = { status:'awaiting-exact-path-approval', generatedAt:new Date().toISOString(), files:allFiles.length, bytes:entries.reduce((s,e)=>s+e.bytes,0), directories:entries, retainedPortableExes:retained, duplicates,
  localInventory:{path:local+'/inventory.json',bytes:inventoryBytes.length,sha256:hash(inventoryBytes),method:'Run this prepare.mjs read-only hash inventory; no deletion performed'},
  retainedDirectories:['.tmp/page-motion-1019','.tmp/perf-budgets-1018','.tmp/music-workstation','.tmp/imagegen','.tmp/tools','.tmp/nai','.tmp/exe-stability-1018/delivery/win-unpacked'],
  reason:'Remove obsolete unpacked build output and reinstallable caches; preserve portable EXEs, source snapshots, art/music originals and logs.' };
fs.writeFileSync(evidence+'/plan.json',JSON.stringify(report,null,2)+'\n');
let md='# 临时目录待删清单\n\n尚未执行删除。'+entries.length+'个精确目录，共'+(report.bytes/1e9).toFixed(2)+' GB。完整文件SHA256清单留在项目本地，路径与整体SHA见[plan.json](plan.json)。\n\n';
for(const item of entries)md+='- `'+item.path+'`：'+item.files+'文件，'+(item.bytes/1e6).toFixed(1)+' MB。\n';
md+='\n保留6份便携EXE、最新完整解包版、所有源代码快照、生成原件、报告和制作工具。删除后旧便携包仍可运行；被删版本的解包现场和依赖需要重新生成。\n';
fs.writeFileSync(evidence+'/DELETE-LIST.md',md);
console.log(JSON.stringify({directories:entries.length,files:report.files,GB:report.bytes/1e9,retainedPortableExes:retained.length,duplicatePairs:duplicates.length,localInventoryBytes:inventoryBytes.length}));
