// Local metadata and bytes only. Never imports or runs downloaded sources.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const writeReport = process.argv.includes('--write-report');
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(dir, entry.name);
    assert(!entry.isSymbolicLink(), 'Unexpected symlink: ' + absolute);
    return entry.isDirectory() ? walk(absolute) : [{ path: path.relative(root, absolute).replaceAll('\\', '/'), absolute, bytes: fs.statSync(absolute).size }];
  });
}
function resolveLocal(name) {
  const absolute = path.resolve(root, name);
  assert(!path.isAbsolute(name) && !name.split(/[\\/]/).includes('..') && absolute.startsWith(root + path.sep), 'Path escaped library: ' + name);
  return absolute;
}
function https(url, label) {
  try { assert(new URL(url).protocol === 'https:', 'Non-HTTPS ' + label); }
  catch { assert(false, 'Invalid URL: ' + label); }
}
const catalog = read('catalog.json');
const manifest = read('download-manifest.json');
const physical = walk(root);
for (const file of physical.filter(f => f.path.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(file.absolute, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { assert(false, 'JSON parse: ' + file.path + ' / ' + error.message); }
}
const expectedCategories = ['ai-production', 'art-audio', 'developer-retrospective', 'game-evaluation', 'open-source', 'studio-process', 'tools', 'ui-accessibility'];
const ids = new Set(), urls = new Set(), manifestPaths = new Set();
const required = ['id', 'title', 'category', 'author', 'url', 'sourceType', 'qualityReason', 'projectFit', 'limitations', 'license', 'licenseUrl', 'useStatus', 'takeaways', 'localFiles', 'bytes', 'sha256', 'downloaded', 'verifiedScope', 'downloadCompleteness', 'linkReview'];
for (const record of catalog) {
  for (const key of required) assert(Object.hasOwn(record, key), record.id + ' missing ' + key);
  assert(!ids.has(record.id), 'Duplicate ID: ' + record.id); ids.add(record.id);
  const normalizedUrl = record.url.replace(/\/$/, '');
  assert(!urls.has(normalizedUrl), 'Duplicate URL: ' + record.url); urls.add(normalizedUrl);
  assert(expectedCategories.includes(record.category), 'Invalid category: ' + record.id);
  assert(['reference-only', 'evaluate', 'usable'].includes(record.useStatus), 'Invalid useStatus: ' + record.id);
  assert(typeof record.downloaded === 'boolean' && record.downloaded === (record.localFiles.length > 0), 'downloaded/localFiles mismatch: ' + record.id);
  assert(record.takeaways.length >= 2 && record.takeaways.length <= 4, 'Takeaway count: ' + record.id);
  assert(record.takeaways.every(t => typeof t === 'string' && t.trim()), 'Empty takeaway: ' + record.id);
  https(record.url, record.id);
  if (record.licenseUrl) https(record.licenseUrl, record.id + ' license');
  else assert(record.useStatus === 'reference-only', 'Reusable candidate needs license URL: ' + record.id);
  const files = manifest.files.filter(f => f.id === record.id);
  assert(JSON.stringify([...record.localFiles].sort()) === JSON.stringify(files.map(f => f.path).sort()), 'Catalog/manifest paths: ' + record.id);
  assert(record.bytes === files.reduce((sum, f) => sum + f.bytes, 0), 'Catalog bytes: ' + record.id);
  if (files.length) {
    assert(record.sha256 && typeof record.sha256 === 'object', 'Catalog hash map: ' + record.id);
    for (const file of files) assert(record.sha256?.[file.path] === file.sha256, 'Catalog SHA: ' + file.path);
    assert(Object.keys(record.sha256 || {}).length === files.length, 'Catalog SHA keys: ' + record.id);
  } else assert(record.sha256 === null, 'No-download SHA must be null: ' + record.id);
}
assert(catalog.length === 38, 'Core count changed from retained 38');
for (const category of expectedCategories) assert(catalog.some(r => r.category === category), 'Missing category: ' + category);
for (const file of manifest.files) {
  assert(ids.has(file.id), 'Unknown manifest ID: ' + file.id);
  assert(!manifestPaths.has(file.path.toLowerCase()), 'Duplicate manifest path: ' + file.path); manifestPaths.add(file.path.toLowerCase());
  assert(['downloaded', 'extracted', 'generated'].includes(file.status), 'Unexpected success status: ' + file.path);
  assert(file.executed === false && file.license, 'Execution/license boundary: ' + file.path);
  assert(file.commit || file.version, 'Missing pinned commit/version/source date: ' + file.path);
  https(file.url, file.path);
  const absolute = resolveLocal(file.path);
  assert(fs.existsSync(absolute), 'Missing payload: ' + file.path);
  if (fs.existsSync(absolute)) {
    const bytes = fs.readFileSync(absolute);
    assert(bytes.length === file.bytes && file.bytes > 0, 'Payload size: ' + file.path);
    assert(digest(bytes) === file.sha256, 'Payload SHA256: ' + file.path);
  }
  if (file.extractedFrom) assert(fs.existsSync(resolveLocal(file.extractedFrom)), 'Missing source archive: ' + file.path);
}
assert(manifest.failures.length === 3, 'Must retain 3 rot.js failures');
for (const failure of manifest.failures) {
  assert(failure.id === 'rot-js' && failure.status === 'failed' && failure.bytes === 0 && failure.sha256 === null && failure.executed === false && failure.error, 'Malformed failure: ' + failure.path);
  assert(!manifestPaths.has(failure.path.toLowerCase()) && !fs.existsSync(resolveLocal(failure.path)), 'Failure incorrectly owned: ' + failure.path);
}
for (const file of physical.filter(f => f.path.startsWith('downloads/') || f.path.startsWith('assets-ui/downloads/'))) assert(manifestPaths.has(file.path.toLowerCase()), 'Unmanifested payload: ' + file.path);
for (const id of ['howler', 'jsfxr', 'seedrandom', 'rot-js']) {
  const record = catalog.find(r => r.id === id);
  assert(read('downloads/' + id + '/package.json').version === record.version, 'Pinned package version: ' + id);
}
const licenseChecks = [
  ['downloads/howler/LICENSE.md', 'Permission is hereby granted'],
  ['downloads/jsfxr/UNLICENSE', 'public domain'],
  ['downloads/seedrandom/seedrandom.js', 'Permission is hereby granted'],
  ['downloads/rot-js/license.txt', 'Redistribution and use'],
  ['downloads/2048/readable/LICENSE.txt', 'The MIT License'],
  ['assets-ui/downloads/selected/License.txt', 'Creative Commons Zero'],
  ['assets-ui/downloads/game-icons/ATTRIBUTION.txt', 'CC BY 3.0']
];
for (const [file, phrase] of licenseChecks) assert(fs.readFileSync(path.join(root, file), 'utf8').includes(phrase), 'Local license evidence: ' + file);
// Compare preserved groups by identity, original source and takeaways. Categories
// and ownership fields were intentionally normalized only in the core catalog.
const excluded = new Set(read('selection-notes.json').excludedFromCoreCatalog.map(r => r.id));
const original = ['first-party/records.json', 'assets-ui/records.json', 'tools/records.json'].flatMap(read);
const complete = read('tools/complete-game-record.json');
const groups = original.concat(Array.isArray(complete) ? complete : [complete]).filter(r => !excluded.has(r.id));
assert(new Set(groups.map(r => r.id)).size === catalog.length, 'Original/core retained IDs mismatch');
for (const record of catalog) {
  const old = groups.find(r => r.id === record.id);
  const retainedTakeaways = record.originalTakeaways || record.takeaways;
  assert(old && old.url === record.url && old.title === record.title && JSON.stringify(old.takeaways) === JSON.stringify(retainedTakeaways), 'Original source changed: ' + record.id);
  if (record.originalTakeaways) assert(record.supplementalReview?.url && (record.supplementalReview?.pages?.length || record.supplementalReview?.locators?.length), 'Supplemental reading needs source/pages/paragraphs: ' + record.id);
  if (record.deepRead) {
    assert(record.deepRead.method && record.deepRead.nextExperiment && record.deepRead.locators.length, 'Incomplete deep-read method card: ' + record.id);
    const note = fs.readFileSync(resolveLocal(record.deepRead.path), 'utf8');
    assert(note.includes('id="' + record.deepRead.anchor + '"'), 'Deep-read anchor missing: ' + record.id);
  }
}
// Built-in ZIP inspection; decompressed bytes are compared, never executed.
function zipEntries(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0 || bytes.readUInt32LE(end) !== 0x06054b50) throw new Error('Missing ZIP directory: ' + file);
  const count = bytes.readUInt16LE(end + 10), entries = [];
  let cursor = bytes.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP central entry');
    const nameLength = bytes.readUInt16LE(cursor + 28), extra = bytes.readUInt16LE(cursor + 30), comment = bytes.readUInt16LE(cursor + 32);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const method = bytes.readUInt16LE(cursor + 10), compressed = bytes.readUInt32LE(cursor + 20), length = bytes.readUInt32LE(cursor + 24), local = bytes.readUInt32LE(cursor + 42);
    assert(length < 20_000_000, 'Oversized ZIP entry: ' + name);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const packed = bytes.subarray(start, start + compressed);
    const content = method === 0 ? packed : method === 8 ? zlib.inflateRawSync(packed, { maxOutputLength: 20_000_000 }) : null;
    assert(content && content.length === length, 'ZIP content length/method: ' + name);
    entries.push({ path: name, bytes: length, sha256: content ? digest(content) : null });
    cursor += 46 + nameLength + extra + comment;
  }
  return entries;
}
const archiveStats = [];
for (const archive of manifest.files.filter(f => f.path.endsWith('.zip'))) {
  const entries = zipEntries(archive.path);
  archiveStats.push({ path: archive.path, entries: entries.length, expandedBytes: entries.reduce((sum, f) => sum + f.bytes, 0), audioFiles: entries.filter(e => /\.(ogg|wav|mp3)$/i.test(e.path)).length });
  for (const extracted of manifest.files.filter(f => f.id === archive.id && f.status === 'extracted')) {
    const expected = extracted.archiveEntry || entries.find(e => e.path.endsWith('/' + path.posix.basename(extracted.path)) || e.path === path.posix.basename(extracted.path))?.path;
    const entry = entries.find(e => e.path === expected);
    assert(entry && entry.bytes === extracted.bytes && entry.sha256 === extracted.sha256, 'Extracted/archive mismatch: ' + extracted.path);
  }
  if (archive.id === '2048-reference') assert(JSON.stringify(entries.map(({ path, bytes }) => ({ path, bytes }))) === JSON.stringify(read('tools/2048-archive-inventory.json')), '2048 archive inventory mismatch');
  if (archive.id === 'kenney-interface-sounds') assert(entries.filter(e => /\.ogg$/i.test(e.path)).length === 100, 'Expected 100 Kenney OGG files');
}
const ignored = spawnSync('git', ['check-ignore', '--stdin'], { cwd: root, input: manifest.files.map(f => path.join(root, f.path)).join('\n') + '\n', encoding: 'utf8' });
assert(ignored.status === 0 && ignored.stdout.trim().split(/\r?\n/).length === manifest.files.length, 'All raw payload must remain ignored');
const study = read('source-study/study.json');
const studyFiles = read('source-study/download-manifest.json');
assert(study.version === '1.15.1' && study.commit === '1ba4240b7a928ddf0ffb772717bf1d433cd63804' && study.thirdPartyCodeExecuted === false, 'Brogue fixed version/execution boundary');
const studyEntries = zipEntries(studyFiles.find(f => f.status === 'downloaded').path);
assert(JSON.stringify(studyEntries.map(({ path, bytes }) => ({ path, bytes }))) === JSON.stringify(read(study.archiveInventory)), 'Brogue complete archive inventory');
for (const file of studyFiles) {
  assert(!manifestPaths.has(file.path.toLowerCase()), 'Duplicate supplemental payload path: ' + file.path); manifestPaths.add(file.path.toLowerCase());
  const bytes = fs.readFileSync(resolveLocal(file.path));
  assert(bytes.length === file.bytes && digest(bytes) === file.sha256, 'Brogue payload size/SHA: ' + file.path);
  assert(file.commit === study.commit && file.version === study.version && file.executed === false && file.license, 'Brogue provenance: ' + file.path);
  https(file.url, file.path);
  if (file.status === 'extracted') {
    const entry = studyEntries.find(e => e.path === file.archiveEntry);
    assert(entry?.bytes === file.bytes && entry?.sha256 === file.sha256, 'Brogue extracted/archive mismatch: ' + file.path);
  }
}
for (const file of physical.filter(f => f.path.startsWith('source-study/downloads/'))) assert(manifestPaths.has(file.path.toLowerCase()), 'Unmanifested Brogue payload: ' + file.path);
const studyIgnored = spawnSync('git', ['check-ignore', '--stdin'], { cwd: root, input: studyFiles.map(f => path.join(root, f.path)).join('\n') + '\n', encoding: 'utf8' });
assert(studyIgnored.status === 0 && studyIgnored.stdout.trim().split(/\r?\n/).length === studyFiles.length, 'Brogue raw payload ignored');
assert(fs.readFileSync(resolveLocal('source-study/downloads/readable/bin/assets/LICENSE.txt'), 'utf8').includes('Attribution-ShareAlike 4.0'), 'Brogue tiles art license boundary');
assert(fs.readFileSync(resolveLocal('source-study/downloads/readable/src/brogue/Movement.c'), 'utf8').includes('either version 3'), 'Brogue source license header');
const indie = read('indie-games/records.json');
assert(indie.records.length === indie.count && indie.count === 24 && new Set(indie.records.map(r => r.id)).size === indie.count, 'Independent-game comparison count/IDs');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const embedded = html.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/);
assert(embedded && JSON.stringify(JSON.parse(embedded[1])) === JSON.stringify({ catalog, files: manifest.files, failures: manifest.failures }), 'Embedded offline data stale');
for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) { try { new vm.Script(script[1]); } catch (error) { assert(false, 'Index script syntax: ' + error.message); } }
assert(!html.includes('__LIBRARY_DATA__') && !/<(?:script|link|img)[^>]+(?:src|href)="https?:/i.test(html), 'Unexpected external page dependency');
const memoryReport = read('index-memory-validation.json');
assert(memoryReport.result === 'passed' && memoryReport.indexSha256 === digest(Buffer.from(html)), 'Offline memory interaction report missing, failed or stale');
assert(!fs.readFileSync(path.join(root, 'README.md'), 'utf8').trimEnd().endsWith('`n'), 'README literal backtick-n remains');
const stats = {
  records: catalog.length,
  categories: expectedCategories.map(category => ({ category, count: catalog.filter(r => r.category === category).length })),
  downloadedRecords: catalog.filter(r => r.downloaded).length,
  notDownloadedRecords: catalog.filter(r => !r.downloaded).length,
  useStatuses: Object.fromEntries(['reference-only', 'evaluate', 'usable'].map(s => [s, catalog.filter(r => r.useStatus === s).length])),
  successfulFiles: manifest.files.length, failures: manifest.failures.length,
  downloadedBytes: manifest.files.filter(f => f.status === 'downloaded').reduce((s, f) => s + f.bytes, 0),
  storedPayloadBytes: manifest.files.reduce((s, f) => s + f.bytes, 0),
  libraryFiles: physical.length, libraryBytes: physical.reduce((s, f) => s + f.bytes, 0),
  archives: archiveStats, sha256FilesVerified: manifest.files.length, thirdPartyCodeExecuted: false,
  deepReadMethodCards: catalog.filter(r => r.deepRead).length,
  supplementalSourceStudies: 1,
  supplementalSuccessfulFiles: studyFiles.length,
  supplementalDownloadedBytes: studyFiles.filter(f => f.status === 'downloaded').reduce((s, f) => s + f.bytes, 0),
  supplementalStoredPayloadBytes: studyFiles.reduce((s, f) => s + f.bytes, 0),
  combinedSha256FilesVerified: manifest.files.length + studyFiles.length,
  independentGameComparisons: indie.count,
  independentGameDeepCases: indie.deepCount,
  supplementalArchive: { path: studyFiles[0].path, entries: studyEntries.length, expandedBytes: studyEntries.reduce((s, e) => s + e.bytes, 0) }
};
stats.combinedDownloadedBytes = stats.downloadedBytes + stats.supplementalDownloadedBytes;
stats.combinedStoredPayloadBytes = stats.storedPayloadBytes + stats.supplementalStoredPayloadBytes;
for (const key of ['records', 'successfulFiles', 'failures', 'downloadedBytes', 'storedPayloadBytes']) assert(stats[key] === manifest.stats[key], 'Manifest stats mismatch: ' + key);
assert(JSON.stringify(stats.categories) === JSON.stringify(manifest.stats.categories), 'Manifest category counts stale');
assert(stats.libraryBytes < 20_000_000_000, 'Library exceeds conservative 20GB decimal limit');
const report = {
  validatedAt: new Date().toISOString(), result: errors.length ? 'failed' : 'passed',
  checks: ['all physical JSON parsed', '38 retained sources / eight categories / unique IDs and URLs', 'required fields / 2-4 original takeaways', 'normalized catalog classification and original-group identity', 'catalog localFiles, summed bytes and per-file SHA match manifest', 'all 40 core payload paths, bytes and SHA256', 'Brogue fixed complete archive, 9 extracted readers, all 10 supplemental hashes and AGPL/art declarations', '24 independent-game comparison IDs and counts; evidence remains separate from core sources', 'four deep-read method cards with exact document anchors and source locators', 'pinned package versions and local license evidence', 'ZIP directory inventory and extracted-content hashes', 'all raw payload ignored; no unmanifested payload', '3 failed downloads absent and not counted as ownership', 'embedded catalog/manifest identical; inline script parses; no external assets', 'jsdom memory filters and local paths passed for current index hash (not rendered/browser acceptance)', 'README literal backtick-n removed', 'recursive complete-library size below 20GB'],
  stats,
  sizeDefinition: { libraryBytes: 'Sum of every physical file recursively under library, including indie-games and source-study, hidden .gitignore, ignored ZIP/audio/SVG/source downloads, extracted files, generated attribution, group records, catalog, manifest, scripts/template, index.html and this validation.json; directory metadata and ZIP virtual entries are excluded, archived bytes are counted once and extracted duplicates separately.', downloadedBytes: 'Core download-manifest status=downloaded only; excludes extracted/generated copies and independent source-study.', storedPayloadBytes: 'Sum of core downloaded/extracted/generated manifest files; excludes metadata/scripts/index and independent source-study.', combinedDownloadedBytes: 'Core downloadedBytes plus source-study downloaded ZIP bytes.', combinedStoredPayloadBytes: 'Core storedPayloadBytes plus all supplemental source-study manifest files.', hardLimitBytes: 20_000_000_000 },
  limits: ['Specific source/permission pages selectively re-opened; other source evidence reused from assigned researchers, no universal reachability claim', 'Slay the Spire official slide text and Into the Breach selected design-method pages checked; no chart pixel inspection; remaining two GDC talks description-only; full videos unverified', 'Riot/Xbox method articles and GameDevBench v1 key methods deep-read; proposed project experiments not executed; GameDevBench narrative/Table 2 numerical discrepancies retained', 'selected sounds not auditioned; SVGs not visually rendered', '2048 source MIT verified; embedded fonts and brand/image reuse unverified', 'rot.js subset incomplete and not standalone runnable', 'no downloaded code executed; no game changes/build/tests/save writes/services', 'Built-in browser rejected file URL (HTTP/HTTPS-only URL safety policy); no workaround or service used. jsdom memory checks passed, but rendered page, real browser input and browser file-link handling remain unverified.'],
  browserAcceptance: memoryReport.browserAcceptance,
  basis: 'Root handoff HEAD c6ee206840; retained 38-source evidence; metadata and bytes rechecked in this run.',
  errors
};
if (writeReport) {
  const output = path.join(root, 'validation.json');
  // Fixed point includes this report's own changing digit lengths in total bytes.
  const baseBytes = physical.filter(f => f.path !== 'validation.json').reduce((s, f) => s + f.bytes, 0);
  for (let i = 0; i < 10; i++) {
    const text = JSON.stringify(report, null, 2) + '\n';
    const total = baseBytes + Buffer.byteLength(text);
    if (report.stats.libraryBytes === total) { fs.writeFileSync(output, text); break; }
    report.stats.libraryBytes = total;
    if (i === 9) throw new Error('Report size did not converge');
  }
}
console.log(JSON.stringify({ result: report.result, stats: report.stats, errors }, null, 2));
if (errors.length) process.exitCode = 1;
