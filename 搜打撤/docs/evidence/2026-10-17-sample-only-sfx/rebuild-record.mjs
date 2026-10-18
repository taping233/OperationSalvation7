import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Rebuild only the missing evidence from preserved local sources. No audio,
// source code, existing receipts, manifests or historical test claims change.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const at = relative => path.join(root, relative);
const json = relative => JSON.parse(readFileSync(at(relative), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const cues = async relative => (await import(pathToFileURL(at(relative)).href)).SAMPLE_CUES;
const beforePath = 'docs/evidence/2026-10-17-f4ngy-draw/before/sound.samples.catalog.js';
const afterDrawPath = 'docs/evidence/2026-10-17-real-foley-batch/before/sound.samples.catalog.js';
const runtimePath = 'game/src/audio/sound.samples.catalog.js';
const drawReceipt = json('docs/evidence/2026-10-17-f4ngy-draw/receipt.json');
const inventory = json('docs/evidence/2026-10-17-sample-only-sfx/inventory.json');
assert.equal(sha256(readFileSync(at(beforePath))), drawReceipt.before_catalog_sha256);
assert.equal(sha256(readFileSync(at(afterDrawPath))), drawReceipt.new_catalog_sha256);

const before = await cues(beforePath), runtime = await cues(runtimePath);
assert.deepEqual(Object.keys(before), inventory.mapped);
const foleyMapping = json('docs/evidence/2026-10-17-real-foley-batch/mapping.json');
const safeMapping = json('docs/evidence/2026-10-18-safe-slot-foley/mapping.json');
const drawMapping = { files: ['assets/sfx/f4ngy/dealing-card-240777-hq.mp3'], gain: 0.26, group: 'combat' };
assert.deepEqual(runtime, { ...before, draw: drawMapping, ...foleyMapping, ...safeMapping });
for (const cue of Object.values(before)) for (const file of cue.files) assert.ok(existsSync(at(`game/${file}`)), file);

const verifiedFiles = [];
const manifest = json('game/assets/asset-manifest.json');
for (const receiptPath of ['docs/evidence/2026-10-17-real-foley-batch/receipt.json', 'docs/evidence/2026-10-18-safe-slot-foley/receipt.json']) {
  const receipt = json(receiptPath);
  assert.equal(receipt.listening_verified, false);
  for (const file of receipt.files) {
    const bytes = readFileSync(at(`game/assets/${file.path}`));
    assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
    assert.deepEqual(manifest.assets.find(asset => asset.path === file.path), file);
    verifiedFiles.push({ path: `game/assets/${file.path}`, bytes: bytes.length, sha256: sha256(bytes), receipt: receiptPath });
  }
}
const drawBytes = readFileSync(at(`game/${drawMapping.files[0]}`));
assert.equal(sha256(drawBytes), drawReceipt.source_sha256);
assert.equal(sha256(drawBytes), drawReceipt.runtime_sha256);
assert.equal(drawReceipt.ear_reviewed, false);
verifiedFiles.push({ path: `game/${drawMapping.files[0]}`, bytes: drawBytes.length, sha256: sha256(drawBytes), receipt: 'docs/evidence/2026-10-17-f4ngy-draw/receipt.json' });

writeFileSync(new URL('./mapping.json', import.meta.url), `${JSON.stringify(before, null, 2)}\n`, 'utf8');
const verification = {
  reconstructedOn: '2026-10-18',
  status: 'Reconstructed from preserved local files; original README and mapping report absent',
  mappingSource: { path: beforePath, sha256: drawReceipt.before_catalog_sha256, receiptField: 'before_catalog_sha256' },
  afterDrawSource: { path: afterDrawPath, sha256: drawReceipt.new_catalog_sha256, receiptField: 'new_catalog_sha256' },
  runtime: { path: runtimePath, sha256: sha256(readFileSync(at(runtimePath))), events: Object.keys(runtime).length },
  restoredMappingEvents: Object.keys(before).length,
  inventoryKeysMatch: true,
  subsequentChangedEvents: Object.keys(runtime).filter(event => JSON.stringify(runtime[event]) !== JSON.stringify(before[event])),
  verifiedFiles,
  limits: ['No historical test output recovered', 'No original download archive or listening/A-B report recovered', 'Receipt provenance retained; current bytes rechecked against receipt hashes', 'No listening verification performed'],
};
writeFileSync(new URL('./verification-2026-10-18.json', import.meta.url), `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ restoredEvents: verification.restoredMappingEvents, changedEvents: verification.subsequentChangedEvents.length, verifiedAudioFiles: verifiedFiles.length, inventoryKeysMatch: true }));
