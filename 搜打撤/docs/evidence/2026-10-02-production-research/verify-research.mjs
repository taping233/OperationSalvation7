import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const write = process.argv.includes('--write');
const output = path.join(here, 'verification.json');
const read = p => JSON.parse(fs.readFileSync(path.join(here, p), 'utf8'));
const sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const relative = p => path.relative(root, p).replaceAll('\\', '/');
const errors = [];
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : e.isFile() ? [p] : [];
  });
}
function fingerprints(label, entries) {
  const mismatches = [];
  for (const e of entries) {
    const file = e.path || e.file;
    if (!fs.existsSync(path.join(root, file)) || sha(path.join(root, file)) !== e.sha256) mismatches.push(file);
  }
  if (mismatches.length) errors.push({ label, mismatches });
  return { checked: entries.length, mismatches };
}
function imageInfo(p) {
  const b = fs.readFileSync(p);
  if (b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return { format: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      while (b[i] === 0xff) i++;
      const marker = b[i++];
      if (marker === 0xda || marker === 0xd9) break;
      const length = b.readUInt16BE(i);
      if ([0xc0, 0xc1, 0xc2].includes(marker)) return { format: 'jpeg', width: b.readUInt16BE(i + 5), height: b.readUInt16BE(i + 3) };
      i += length;
    }
  }
  throw new Error(`Unsupported screenshot bytes: ${p}`);
}
const sourceChecks = {
  engineering: fingerprints('engineering', read('diagnosis/engineering/measurements.json').hashManifest),
  gameplay: fingerprints('gameplay', read('diagnosis/gameplay/source-snapshot.json').sources),
  experience: fingerprints('experience', read('diagnosis/experience/source-snapshot.json').snapshot),
  experienceAdditional: fingerprints('experienceAdditional', Object.entries(read('diagnosis/experience/findings.json').additionalSourceHashes).map(([path, sha256]) => ({ path, sha256 }))),
  memoryProbe: fingerprints('memoryProbe', read('diagnosis/gameplay/probe.json').sources),
};

const browserDir = path.join(here, 'diagnosis/browser');
// Preserve original capture bytes and the already imported snapshot. Correctly
// suffixed copies are byte-identical, not rendered or edited derivatives.
if (write) for (const p of files(browserDir).filter(p => p.endsWith('.png'))) {
  if (imageInfo(p).format === 'jpeg') fs.copyFileSync(p, p.replace(/\.png$/, '.jpg'));
}
const browserManifest = { recordedAt: new Date().toISOString(), acquisition: 'Codex cua built-in browser; normal input and current-window screenshot/AX/DOM reads; no synthetic game events or storage mutation',
  files: files(browserDir).filter(p => /\.(png|jpg|txt|json)$/.test(p) && !p.endsWith('evidence-manifest.json')).map(p => ({ path: relative(p), bytes: fs.statSync(p).size, sha256: sha(p),
    ...(/\.(png|jpg)$/.test(p) ? { ...imageInfo(p), gitPolicy: 'local-only', ...(p.endsWith('.jpg') ? { byteIdenticalTo: relative(p.replace(/\.jpg$/, '.png')) } : { originalCapture: true }) } : {}) })) };
if (write) fs.writeFileSync(path.join(browserDir, 'evidence-manifest.json'), JSON.stringify(browserManifest, null, 2) + '\n');
const pngs = browserManifest.files.filter(p => p.path.endsWith('.png'));
if (pngs.some(p => p.width !== 1183 || p.height !== 764)) errors.push('unexpected screenshot viewport');
const imageFiles = browserManifest.files.filter(p => p.format);
const ignored = execFileSync('git', ['check-ignore', '--', ...imageFiles.map(p => p.path)], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).length;
if (ignored !== imageFiles.length) errors.push('browser screenshots not all ignored');
if (imageFiles.filter(p => p.byteIdenticalTo).some(p => p.sha256 !== sha(path.join(root, p.byteIdenticalTo)))) errors.push('correct-extension image copy differs');

const all = files(here);
let parsedJson = 0;
for (const p of all.filter(p => p.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(p, 'utf8')); parsedJson++; }
  catch (e) { errors.push({ json: relative(p), message: e.message }); }
}
let localLinks = 0;
for (const p of all.filter(p => p.endsWith('.md') && !p.includes(`${path.sep}raw${path.sep}`) && !p.includes(`${path.sep}downloads${path.sep}`))) {
  const text = fs.readFileSync(p, 'utf8');
  for (const m of text.matchAll(/\[[^\]\n]+\]\(([^\)\n]+)\)/g)) {
    const href = m[1].replace(/^<|>$/g, '').split('#')[0];
    if (!href || /^[a-z]+:/i.test(href)) continue;
    const target = path.resolve(path.dirname(p), decodeURIComponent(href));
    localLinks++;
    if (!fs.existsSync(target) && !(write && target === output)) errors.push({ markdown: relative(p), brokenLink: href });
  }
}
const libraryFiles = files(path.join(here, 'library'));
const libraryBytes = libraryFiles.reduce((n, p) => n + fs.statSync(p).size, 0);
const library = read('library/validation.json');
const memory = read('library/index-memory-validation.json');
if (library.result !== 'passed') errors.push('library validation not passed');
if (libraryBytes !== library.stats.libraryBytes || libraryFiles.length !== library.stats.libraryFiles) errors.push('library exact directory size differs from validation');
if (libraryBytes > 20_000_000_000) errors.push('library exceeds 20GB');
const probe = read('diagnosis/gameplay/probe.json');
if (probe.A.settledXp !== 20 || probe.B.settledXp !== 60 || probe.observed.extraMoves !== 20) errors.push('report probe numbers mismatch');
const metadata = read('diagnosis/browser/browser-metadata.json');
const result = { checkedAt: new Date().toISOString(), result: errors.length ? 'failed' : 'passed', sourceChecks,
  researchFiles: { jsonParsed: parsedJson, localMarkdownLinksChecked: localLinks },
  library: { records: library.stats.records, files: libraryFiles.length, bytes: libraryBytes, payloadShaVerified: library.stats.combinedSha256FilesVerified || library.stats.sha256FilesVerified,
    recordedValidation: 'library/validation.json', indexMemoryValidation: 'library/index-memory-validation.json', memoryResult: memory.result || memory.status },
  firstPassBrowser: { origin: metadata.url, viewport: metadata.viewport, originalCaptures: pngs.length, imageFilesIncludingCorrectExtensionCopies: imageFiles.length, ignoredImageFiles: ignored,
    evidenceManifest: 'diagnosis/browser/evidence-manifest.json', snapshotImport: 'browser-ea0418df-c518-47dc-8dd0-00dfb323119d-snapshot.json',
    scope: 'One normal first-layer supply + battle + reward + consumption tutorial + return to map; no full run/extraction/audio/refresh recovery' },
  counterEvidenceReview: ['Extraction probe invokes real functions but isolates legal-exit and persisted-transaction prerequisites', 'Global time/action/save paths reviewed; no per-step resource deduction found in these paths', 'Main-map common extraction result exists; lab ending is separate', 'Generic click/battle sounds and BGM exist; cue gaps are not silence or listening evidence', 'Current normal battle and tutorial disprove absent basic click loop', '31/249 strict file ratio is not effective type coverage'],
  limits: ['Source hashes support reuse, not test passage', 'Historical 100-seed map evidence is memory geometry only', 'No build/game full test/install/downloaded-code execution', 'Library file URL browser navigation was security-policy blocked; jsdom is not browser/visual acceptance', 'Remote refs/CI not refreshed or checked'], errors };
const assisted=read('diagnosis/browser-assisted/final-trace.json'), recovered=read('diagnosis/browser-assisted/23-after-reload.json');
result.assistedBrowser={evidence:'diagnosis/browser-assisted/evidence-manifest.json',viewport:assisted.viewport,ordinaryDebugWins:assisted.trace.interventions.filter(x=>x.kind==='ordinary-battle-force-win').length,bossDebugWins:assisted.trace.interventions.filter(x=>x.kind==='boss-force-win').length,outcome:recovered.runs[0]?.outcome,runActiveAfterReload:recovered.obs.run.active,warehouseAfterReload:'22/25 from 24-stash-after-reload.txt',scope:'Legal four-layer movement, altar, boss gate/deck, assisted boss victory, extraction, warehouse and reload; not natural completion'};
if(recovered.obs.run.active||recovered.runs[0]?.outcome!=='clear')throw Error('Assisted closure mismatch');
if (write) fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exitCode = errors.length ? 1 : 0;
