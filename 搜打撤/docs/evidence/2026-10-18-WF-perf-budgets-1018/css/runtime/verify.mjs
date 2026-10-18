import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = new URL('./', import.meta.url);
const root = new URL('../../../../../', import.meta.url);
const json = path => JSON.parse(readFileSync(new URL(path, here), 'utf8'));
const baseline = json('baseline.json');
const shared = json('shared.json');
assert.deepEqual([baseline.firstCalls, baseline.reentryCalls], [8, 7]);
assert.deepEqual([shared.firstCalls, shared.reentryCalls], [1, 1]);
assert.deepEqual(baseline.initial, shared.initial);
assert.deepEqual(baseline.refreshed, shared.refreshed);
assert.equal(shared.initial.length, 4);
assert.equal(shared.refreshed.length, 3);
assert(shared.refreshed.every(html => html.includes('能量不足')));
assert.equal(baseline.stableHoverFrameCalls, 0);
assert.equal(shared.stableHoverFrameCalls, 0);
assert.equal(baseline.submitted, 0);
assert.equal(shared.submitted, 0);
const targeted = json('targeted-final.json');
assert.equal(targeted.numPassedTests, 36);
assert.equal(targeted.numFailedTests, 0);
assert.equal(targeted.numPendingTests, 0);
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const files = [
  'game/src/battle/view/battle.aim.js',
  'game/src/battle/view/battle.hover.js',
  'tests/battle-area-hover-snapshot.test.js',
  'tests/battle-drag-reference.test.js',
].map(path => ({ path, sha256: sha256(new URL(path, root)) }));
const before = ['battle.aim.js.before.txt', 'battle.hover.js.before.txt', 'battle-drag-reference.test.js.before.txt']
  .map(path => ({ path, sha256: sha256(new URL(path, here)) }));
const report = {
  date: '2026-10-18',
  scope: 'One synchronous AOE hover transition; actual aim/hover view modules with mocked core availability/context in jsdom',
  initialSnapshotRequests: { before: baseline.firstCalls, after: shared.firstCalls },
  reentrySnapshotRequests: { before: baseline.reentryCalls, after: shared.reentryCalls },
  previewOuterHTMLIdentical: true,
  initialPreviewCount: 4, reentryPreviewCount: 3,
  stableHoverFrameSnapshotRequests: 0, submittedCardPlays: 0,
  targeted: { passed: targeted.numPassedTests, failed: targeted.numFailedTests, pending: targeted.numPendingTests },
  files, before,
  browserValidation: 'Delegated to parent on current-window built-in browser, isolated copy port 5319; not performed by this subagent',
};
writeFileSync(new URL('verification.json', here), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ passed: report.targeted.passed, htmlIdentical: report.previewOuterHTMLIdentical, evidence: fileURLToPath(here) }));
