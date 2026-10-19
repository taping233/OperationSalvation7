const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = process.cwd();
const evidence = path.join(root, 'docs/evidence/2026-10-19-wu-animation-revert');
const plan = JSON.parse(fs.readFileSync(path.join(evidence, 'plan.json')));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const headBytes = file => cp.execFileSync('git', ['show', 'HEAD:搜打撤/' + file], { maxBuffer: 8 * 1024 * 1024 });
const dirs = ['game/assets/portraits/frames/wu/rig-v1', 'game/art-source/characters/wu-battle-rig-20261019'];
const deletionFiles = [];
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (fs.lstatSync(file).isSymbolicLink()) throw Error('Refuse linked deletion: ' + file);
    if (entry.isDirectory()) inspect(file);
    else deletionFiles.push({ path: path.relative(root, file), bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) });
  }
}
for (const dir of dirs) {
  const absolute = path.resolve(root, dir);
  if (absolute !== fs.realpathSync(absolute) || !absolute.startsWith(root + path.sep)) throw Error('Unsafe deletion target: ' + absolute);
  if (!plan.deleteDirectories.some(p => p.path === absolute)) throw Error('Unapproved deletion: ' + absolute);
  inspect(absolute);
}
const planned = plan.deletions.map(p => path.normalize(p)).sort();
if (JSON.stringify(deletionFiles.map(f => f.path).sort()) !== JSON.stringify(planned)) throw Error('Deletion inventory changed');
const restores = plan.files.map(item => {
  if (sha(fs.readFileSync(item.file)) !== item.currentSha256) throw Error('Runtime changed after approval: ' + item.file);
  const previous = headBytes(item.file);
  const backup = fs.readFileSync(item.backup);
  const equal = item.file.endsWith('.json') ? JSON.stringify(JSON.parse(previous)) === JSON.stringify(JSON.parse(backup)) : previous.equals(backup);
  if (!equal || sha(backup) !== item.previousSha256) throw Error('Previous version mismatch: ' + item.file);
  return { path: item.file, bytes: previous, sha256: sha(previous) };
});
const manifestPath = 'game/assets/asset-manifest.json';
const manifestBefore = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBefore);
const previousManifest = JSON.parse(headBytes(manifestPath));
const restoredPaths = new Set(restores.map(f => f.path.replace('game/assets/', '')));
const related = entry => restoredPaths.has(entry.path) || entry.path.startsWith('portraits/frames/wu/rig-v1/');
const unrelatedBefore = manifest.assets.filter(e => !related(e));
const newEntries = manifest.assets.filter(e => e.path.startsWith('portraits/frames/wu/rig-v1/'));
if (newEntries.length !== plan.newManifestEntries) throw Error('Manifest additions changed');
const oldEntries = previousManifest.assets.filter(e => restoredPaths.has(e.path));
const oldMap = new Map(oldEntries.map(e => [e.path, e]));
manifest.assets = manifest.assets.filter(e => !related(e) || oldMap.has(e.path)).map(e => oldMap.get(e.path) || e);
if (JSON.stringify(manifest.assets.filter(e => !related(e))) !== JSON.stringify(unrelatedBefore)) throw Error('Unrelated manifest entries changed');
manifest.count = manifest.assets.length;
const beforeReceipt = { authorizedDirectories: dirs.map(d => path.resolve(root, d)), deletedFiles: deletionFiles, restores: restores.map(({bytes, ...f}) => f), removedManifestEntries: newEntries.map(e => e.path), unrelatedEntriesPreserved: unrelatedBefore.length, startedAt: new Date().toISOString() };
fs.writeFileSync(path.join(evidence, 'execution-plan.json'), JSON.stringify(beforeReceipt, null, 2) + '\n', { flag: 'wx' });
for (const file of restores) fs.writeFileSync(file.path, file.bytes);
if (!fs.readFileSync(manifestPath).equals(manifestBefore)) throw Error('Manifest changed concurrently');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
for (const dir of dirs) fs.rmSync(path.resolve(root, dir), { recursive: true });
for (const file of restores) if (sha(fs.readFileSync(file.path)) !== file.sha256) throw Error('Restored hash mismatch');
const animation = JSON.parse(fs.readFileSync(restores.find(f => f.path.endsWith('.json')).path));
const frames = [...new Set(Object.values(animation.sequences).flat())];
for (const frame of frames) if (!fs.existsSync(path.join(root, 'game/assets/portraits/frames/wu', frame + '.webp'))) throw Error('Missing old frame: ' + frame);
const receipt = { ...beforeReceipt, ok: true, endedAt: new Date().toISOString(), removedDirectoriesAbsent: dirs.every(d => !fs.existsSync(d)), restoredFrameReferences: frames.length, animationCounts: Object.fromEntries(Object.entries(animation.sequences).map(([action, list]) => [action, list.length])) };
fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ok: receipt.ok, removedFiles: deletionFiles.length, removedDirectoriesAbsent: receipt.removedDirectoriesAbsent, restoredFrameReferences: frames.length, animationCounts: receipt.animationCounts, unrelatedEntriesPreserved: unrelatedBefore.length }));
