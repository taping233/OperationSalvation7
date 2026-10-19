// Provenance for private build artifacts. Does not turn a budget failure into a pass.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function writeBuildProvenance({ outDir, sourceSha, runId, budgetOutcome, fontLicenseDir }) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha || '')) throw new Error('Exact source commit SHA required');
  if (!/^\d+$/.test(runId || '')) throw new Error('Workflow run ID required');
  if (!['success', 'failure'].includes(budgetOutcome)) throw new Error('Completed budget outcome required');
  const root = path.resolve(outDir);
  if (lstatSync(root).isSymbolicLink() || !lstatSync(root).isDirectory()) throw new Error('Build root must be a regular directory');
  const digest = buffer => createHash('sha256').update(buffer).digest('hex');
  const files = [];
  function visit(relative) {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Build artifact cannot contain symlinks: ' + file);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && file !== 'build-provenance.json') {
        const bytes = readFileSync(path.join(root, file));
        files.push({ path: file, bytes: bytes.length, sha256: digest(bytes) });
      }
    }
  }
  visit('');
  if (!files.some(file => file.path === 'index.html') || !files.some(file => file.path.startsWith('assets/js/'))) throw new Error('Missing build entry or JavaScript assets');
  const licenses = readdirSync(fontLicenseDir).filter(name => /^LICENSE(?:[-_].+)?\.(?:txt|md)$/i.test(name));
  if (!licenses.length) throw new Error('Source font license notices missing');
  for (const name of licenses) {
    const source = readFileSync(path.join(fontLicenseDir, name));
    const bundled = files.find(file => file.path === 'assets/fonts/' + name);
    if (!bundled || bundled.sha256 !== digest(source)) throw new Error('Missing or changed font license: ' + name);
  }
  const result = { schemaVersion: 1, sourceSha, runId, generatedAt: new Date().toISOString(), build: 'success',
    performanceBudget: budgetOutcome, tests: 'separate CI workflow; verify its result for this SHA',
    intendedUse: 'Private review artifact; build success is not full CI or real-page acceptance',
    fileCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    notices: files.filter(file => /(?:license|notice)/i.test(path.posix.basename(file.path))).map(file => file.path),
    files: files.sort((a, b) => a.path.localeCompare(b.path)) };
  writeFileSync(path.join(root, 'build-provenance.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = writeBuildProvenance({ outDir: 'desktop-app/game', fontLicenseDir: 'game/assets/fonts',
      sourceSha: process.env.SOURCE_SHA, runId: process.env.WORKFLOW_RUN_ID, budgetOutcome: process.env.BUDGET_OUTCOME });
    console.log(JSON.stringify({ sourceSha: result.sourceSha, files: result.fileCount, bytes: result.totalBytes, performanceBudget: result.performanceBudget }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
