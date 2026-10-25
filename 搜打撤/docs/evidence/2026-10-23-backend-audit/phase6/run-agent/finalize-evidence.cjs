const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../../..');
const before = path.join(__dirname, 'runtime-asset-redundancy-review.mjs.before');
const after = path.join(__dirname, 'runtime-asset-redundancy-review.mjs.after');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function diff(args) {
  const result = spawnSync('git', ['diff', '--no-index', ...args, '--', before, after], { cwd: root, encoding: 'utf8' });
  if (result.error || ![0, 1].includes(result.status)) throw result.error || new Error(result.stderr);
  return result.stdout;
}
const counts = diff(['--numstat']).split('\t');
if (+counts[0] !== 22 || +counts[1] !== 30) throw new Error('Unexpected own patch line count');
fs.writeFileSync(path.join(__dirname, 'runtime-asset-redundancy-review.mjs.diff'), diff([]));
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'before.json'), 'utf8'));
const equivalence = JSON.parse(fs.readFileSync(path.join(__dirname, 'template-equivalence.json'), 'utf8'));
const parallel = JSON.parse(fs.readFileSync(path.join(__dirname, 'parallel-observed.json'), 'utf8'));
const current = fs.readFileSync(path.join(root, 'scripts/runtime-asset-redundancy-review.mjs'));
if (hash(current) !== parallel.observedSharedSourceSha256) throw new Error('Shared source changed after separate current/own-after inspection');
const report = { file: baseline.file, added: +counts[0], deleted: +counts[1], netLinesRemoved: +counts[1] - +counts[0],
  beforeBytes: equivalence.beforeBytes, afterBytes: equivalence.afterBytes, savedBytes: equivalence.savedBytes,
  beforeSha256: baseline.sha256, ownAfterSha256: equivalence.sourceAfterSha256, observedSharedSourceSha256: hash(current),
  ownPatchOnly: true, concurrentFingerprintChangesExcluded: parallel.concurrentFingerprintChanges,
  concurrentOwner: parallel.owner, concurrentOwnerRegistry: parallel.registryReference,
  expandedReviewSha256: equivalence.expandedReviewAfterSha256, candidateCount: equivalence.candidates,
  verification: { staticASTDataOrder: 'passed', original90TemplateByteEquality: 'passed', protectedMetadataWithinOwnPatch: 'unchanged',
    sharedSourceVersusOwnAfter: 'exactly the two reported external opaqueConsumers fingerprints', sourceSyntax: 'passed', scopedDiffWhitespace: 'passed',
    tests: 'not run per instruction', build: 'not run', browser: 'not run', commit: 'not created', inspectedTargetModuleExecution: 'none' } };
fs.writeFileSync(path.join(__dirname, 'changes.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
