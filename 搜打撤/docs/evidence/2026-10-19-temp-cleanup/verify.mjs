import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd();
const evidence = 'docs/evidence/2026-10-19-temp-cleanup';
const planBytes = fs.readFileSync(evidence + '/plan.json');
const plan = JSON.parse(planBytes);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (plan.directories.length !== 10 || plan.files !== 20230) throw Error('Approved scope differs');
const inventoryBytes = fs.readFileSync(plan.localInventory.path);
if (hash(inventoryBytes) !== plan.localInventory.sha256) throw Error('Approved inventory changed');
const inventory = JSON.parse(inventoryBytes);
const previous = new Map(inventory.map(f => [f.path, f]));
const verified = [];
const metadata = [];
function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = absolute.replaceAll('\\', '/');
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw Error('Linked path: ' + relative);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else {
      const expected = previous.get(relative);
      if (!expected || stat.size !== expected.bytes) throw Error('Added/changed file: ' + relative);
      const actual = { path: relative, bytes: stat.size, sha256: hash(fs.readFileSync(absolute)) };
      if (actual.sha256 !== expected.sha256) throw Error('Content changed: ' + relative);
      files.push(actual);
      metadata.push({ path: relative, bytes: stat.size, mtimeMs: stat.mtimeMs });
    }
  }
  return files;
}
for (const target of plan.directories) {
  const resolved = fs.realpathSync(target.path);
  if (resolved !== path.resolve(target.path) || !resolved.startsWith(path.join(root, '.tmp') + path.sep)) throw Error('Unsafe deletion target');
  const files = walk(target.path).sort((a,b) => a.path.localeCompare(b.path));
  if (files.length !== target.files || hash(JSON.stringify(files)) !== target.treeSha256) throw Error('Approved directory tree changed: ' + target.path);
  verified.push({ ...target, absolutePath: resolved });
  console.log('Verified: ' + target.path + ' (' + files.length + ' files)');
}
for (const file of plan.retainedPortableExes) {
  const bytes = fs.readFileSync(file.path);
  if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw Error('Retained EXE changed: ' + file.path);
}
const kept = '.tmp/exe-stability-1018/delivery/win-unpacked';
if (!fs.existsSync(kept)) throw Error('Retained latest unpacked delivery missing');
const disk = fs.statfsSync(root);
const report = { ok:true, checkedAt:new Date().toISOString(), planSha256:hash(planBytes), directories:verified, files:metadata,
  retainedPortableExes:plan.retainedPortableExes, retainedUnpackedDirectory:kept, bytes:plan.bytes, freeBytesBefore:disk.bavail*disk.bsize };
fs.writeFileSync('.tmp/cleanup-plan-1019/verified.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:true,directories:verified.length,files:metadata.length,retainedExes:plan.retainedPortableExes.length,bytes:plan.bytes}));
