import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pages = read('pages/pages.json');
const systems = read('systems/systems.json');
const resources = read('systems/resources.json');
const workbook = read('workbook/verification.json');
const issues = [];
const expected = { pages: 110, variants: 55, systems: 19, resources: 25, tools: 12, functionFamilies: 79 };
const actual = { pages: pages.pages.length, variants: pages.variants.length, systems: systems.systems.length, resources: resources.resources.length, tools: resources.tools.length, functionFamilies: systems.functionCoverage.length };
for (const key of Object.keys(expected)) if (expected[key] !== actual[key]) issues.push(`count: ${key}`);
for (const [file, digest] of Object.entries(workbook.inputHashes)) {
  if (sha(path.join(root, file)) !== digest) issues.push(`stale workbook: ${file}`);
}
if (sha(workbook.finalPath) !== workbook.sha256) issues.push('workbook output hash mismatch');
const byId = new Map(systems.systems.map(item => [item.id, item]));
const visiting = new Set(), visited = new Set(), order = [];
function visit(id) {
  if (visited.has(id)) return;
  if (visiting.has(id)) throw new Error(`dependency cycle: ${id}`);
  if (!byId.has(id)) throw new Error(`missing dependency: ${id}`);
  visiting.add(id);
  for (const dep of byId.get(id).dependencies) visit(dep);
  visiting.delete(id); visited.add(id); order.push(id);
}
for (const id of byId.keys()) visit(id);
for (const items of [pages.pages, pages.variants, systems.systems, resources.resources]) {
  if (new Set(items.map(item => item.id)).size !== items.length) issues.push('duplicate IDs');
}
const pageIds = new Set(pages.pages.map(item => item.id));
for (const item of pages.variants) if (!pageIds.has(item.parentId)) issues.push(`variant parent: ${item.id}`);
const resourceIds = new Set([...resources.resources, ...resources.uiRequestLinks].map(item => item.id));
for (const item of [...pages.pages, ...pages.variants, ...systems.systems]) {
  for (const id of item.resourceIds) if (!resourceIds.has(id)) issues.push(`resource ${item.id}: ${id}`);
}
const documents = ['README.md', '总体改造计划.md', 'pages/UI-PAGE-PLAN.md', 'systems/SYSTEM-PLAN.md', 'systems/RESOURCE-TOOLS.md'];
let localLinks = 0;
for (const file of documents) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim().replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^(?:https?:|mailto:|app:|codex:)/i.test(target)) continue;
    target = decodeURIComponent(target);
    localLinks++;
    // The manifest is written by this verification run.
    if (target === 'delivery-validation.json') continue;
    if (!fs.existsSync(path.resolve(root, path.dirname(file), target))) issues.push(`link ${file}: ${target}`);
  }
}
function measure(directory) {
  let bytes = 0, files = 0;
  const skippedLinks = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) { skippedLinks.push(path.relative(directory, file)); continue; }
      if (stat.isDirectory()) walk(file);
      else { bytes += stat.size; files++; }
    }
  }
  walk(directory);
  return { files, bytes, skippedLinks };
}
const librarySize = measure(path.resolve(root, '../library'));
if (librarySize.bytes > 20 * 1024 ** 3) issues.push('library exceeds 20 GiB');
const report = {
  checkedAt: new Date().toISOString(), passed: !issues.length, actual,
  checks: { inputHashesMatchWorkbook: !issues.some(x => x.startsWith('stale')), workbookHashMatches: !issues.includes('workbook output hash mismatch'), hardDependenciesAcyclic: true, localLinksChecked: localLinks, libraryWithin20GiB: librarySize.bytes <= 20 * 1024 ** 3 },
  topologicalOrder: order,
  workbook: { path: path.relative(root, workbook.finalPath), bytes: fs.statSync(workbook.finalPath).size, sha256: sha(workbook.finalPath) },
  rootVisualSpotReview: ['workbook/qa/总体计划.png', 'workbook/qa/美术_战斗结算.png', 'workbook/qa/资源与参考.png'],
  librarySize, researchDirectorySizeBeforeFinalMetadata: measure(path.resolve(root, '..')),
  limits: ['No Excel application session; reused all-sheet rendering and native ZIP/XML verification.', 'No remote-link re-fetch; this pass checks local delivery integrity.', 'Not a gameplay, full visual, audio, or motion acceptance run.'], issues
};
fs.writeFileSync(path.join(root, 'delivery-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (issues.length) process.exitCode = 1;
