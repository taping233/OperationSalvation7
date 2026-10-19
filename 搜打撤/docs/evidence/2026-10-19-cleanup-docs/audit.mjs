import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = process.cwd();
const evidence = path.dirname(fileURLToPath(import.meta.url));
const read = file => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const cleanup = JSON.parse(read('docs/evidence/2026-10-19-unused-cleanup/deletion-plan.json'));
const temp = JSON.parse(read('docs/evidence/2026-10-19-temp-cleanup/plan.json'));
const delivery = JSON.parse(read('docs/evidence/2026-10-19-old-delivery-cleanup/receipt.json'));
const retiredFiles = new Set(cleanup.files.map(f => f.path));
for (const file of delivery.approvedDeletedFiles) retiredFiles.add(file.path);
const retiredDirectories = [...temp.directories.map(d => d.path), 'game/assets/portraits/frames/wu/rig-v1', 'game/art-source/characters/wu-battle-rig-20261019'];
const paths = [...retiredFiles, ...retiredDirectories];
const skipped = [], files = [];
function walk(directory) {
  let entries;
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
  catch (error) { skipped.push({ path:directory,reason:error.code }); return; }
  for (const entry of entries) {
    const file = path.join(directory, entry.name).replaceAll('\\','/');
    if (entry.isSymbolicLink()) { skipped.push({path:file,reason:'link'}); continue; }
    if (entry.isDirectory()) {
      if (['node_modules','.git','.tmp','tmp','dist','win-unpacked'].includes(entry.name)) { skipped.push({path:file,reason:'generated-or-temporary'}); continue; }
      walk(file);
    } else if (file.endsWith('.md')) files.push(file);
  }
}
for (const dir of ['docs','game','tools','scripts']) walk(dir);
for (const file of fs.readdirSync(root)) if (file.endsWith('.md')) files.push(file);
for (const file of fs.readdirSync(path.resolve(root,'..'))) if (file.endsWith('.md')) files.push('../'+file);
const uniqueFiles = [...new Set(files)].filter(f => !f.startsWith('docs/evidence/2026-10-19-cleanup-docs/'));
const isHistory = file => /^(?:docs\/(?:evidence\/(?!README\.md$)|archive\/|previews\/)|game\/art-source\/)/.test(file)
  || /(?:^|\/)(?:originals|baseline|snapshot|runtime-copy|before)(?:\/|$)/.test(file);
const related = value => {
  const normalized = value.replaceAll('\\','/');
  const relative = path.relative(root, path.resolve(root, normalized)).replaceAll('\\','/');
  return [...retiredFiles].includes(relative) || retiredDirectories.some(p => relative === p || relative.startsWith(p+'/'));
};
const results = [], brokenCurrentLinks = [], brokenHistoricalLinks = [];
for (const file of uniqueFiles) {
  const source = read(file);
  const normalized = source.replaceAll('\\','/');
  const hits = paths.filter(p => {
    const aliases = [p];
    if (p.startsWith('game/assets/')) aliases.push(p.slice('game/'.length),p.slice('game/assets/'.length));
    if (p.startsWith('game/art-source/')) aliases.push(p.slice('game/'.length));
    return aliases.some(value => normalized.includes(value));
  });
  const shortNames = ['sound.bank.js','sound.scape.js','sound.ui-samples.js','base-framework-v6.css','base-home-v3.css'].filter(p => source.includes(p));
  const linkedRetired = [];
  const linkSource = source.replace(/```[\s\S]*?```/g,'').replace(/`[^`]*`/g,'');
  for (const match of linkSource.matchAll(/!?\[[^\]]*\]\(\s*(<[^>]*>|[^\s)]+)(?:\s+[^)]*)?\)/g)) {
    let destination = match[1].replace(/^<|>$/g,'').split('#')[0].split('?')[0];
    if (!destination || /^(?:[a-z]+:|\/\/)/i.test(destination) || destination.includes('>')) continue;
    try { destination = decodeURIComponent(destination); } catch { /* Literal path remains usable. */ }
    const resolved = path.resolve(path.dirname(path.resolve(file)), destination);
    if (related(resolved)) linkedRetired.push({destination,exists:fs.existsSync(resolved)});
    if (!fs.existsSync(resolved)) {
      const item={file,destination,cleanupRelated:related(resolved)};
      (isHistory(file)?brokenHistoricalLinks:brokenCurrentLinks).push(item);
    }
  }
  if (hits.length || shortNames.length || linkedRetired.length) results.push({file,historical:isHistory(file),hits,shortNames,linkedRetired});
}
const report = { scannedMarkdown:uniqueFiles.length,skipped,results,brokenCurrentLinks,brokenHistoricalLinks };
fs.writeFileSync(path.join(evidence,'audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scannedMarkdown:report.scannedMarkdown,skippedDirectories:skipped.length,currentAffected:results.filter(r=>!r.historical),historicalAffectedCount:results.filter(r=>r.historical).length,brokenCurrentLinks,brokenHistoricalLinks:brokenHistoricalLinks.length},null,2));
