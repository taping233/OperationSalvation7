import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { validateDocumentation } from '../snapshot/scripts/index-validation.mjs';
const out = path.resolve('docs/evidence/2026-09-30-full-repository-review/root');
const fixture = path.join(out, 'link-fixture');
fs.mkdirSync(path.join(fixture, 'docs'), { recursive: true });
fs.writeFileSync(path.join(fixture, 'docs/README.md'), '# Fixture\n\n[missing](missing.md)\n');
const result = validateDocumentation(fixture);
const wrongTestPredicate = result.findings.some(item => item.kind === 'broken-link');
assert.equal(wrongTestPredicate, false);
assert.ok(result.findings.some(item => item.kind === 'missing-relative-link'));
const evidence = { fixtureOnly: true, actualKinds: result.findings.map(item => item.kind),
  actualMissingLinks: result.findings.filter(item => item.kind === 'missing-relative-link').length,
  currentTestClaimsNoBrokenLinks: !wrongTestPredicate,
  file: 'tests/workflow-cli-integration.test.js', line: 24 };
fs.writeFileSync(path.join(out, 'test-gap-result.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
