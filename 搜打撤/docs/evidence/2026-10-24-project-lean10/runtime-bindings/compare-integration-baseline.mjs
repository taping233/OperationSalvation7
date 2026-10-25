import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const current = JSON.parse(fs.readFileSync('node_modules/.cache/lean10-final-battle.json', 'utf8'));
const before = JSON.parse(fs.readFileSync('node_modules/.cache/lean10-final-battle-baseline.json', 'utf8'));
const files = new Set(before.testResults.map(test => path.basename(test.name)));
const caseKey = (test, assertion) => `${path.basename(test.name)}::${assertion.fullName}`;
const diagnostic = assertion => (assertion.failureMessages?.[0] || '').split('\n')[0].trim();
const cases = report => new Map(report.testResults.filter(test => files.has(path.basename(test.name)))
  .flatMap(test => test.assertionResults.map(assertion => [caseKey(test, assertion), {
    status:assertion.status, error:assertion.status === 'failed' ? diagnostic(assertion) : null,
  }])));
const actual = cases(current), previous = cases(before);
const mismatched = [...new Set([...actual.keys(), ...previous.keys()])].flatMap(name => {
  const now = actual.get(name), old = previous.get(name);
  return JSON.stringify(now) === JSON.stringify(old) ? [] : [{ name, current:now, baseline:old }];
});
const loaded = fs.readFileSync('node_modules/.cache/lean10-integration-baseline-loaded.jsonl', 'utf8')
  .trim().split('\n').map(line => JSON.parse(line).file);
const matches = [...actual].filter(([, result]) => result.status === 'failed')
  .map(([name, result]) => ({ name, error:result.error }));
const summary = {
  baseline:{ files:before.testResults.length, total:before.numTotalTests, passed:before.numPassedTests,
    failed:before.numFailedTests, pending:before.numPendingTests, gameModulesOverridden:new Set(loaded).size },
  comparedCases:actual.size, matchedFailures:matches.length, mismatched, matches,
  comparison:'Same full test name, status and first diagnostic line; stack positions and durations are not compared.',
};
fs.writeFileSync('docs/evidence/2026-10-24-project-lean10/runtime-bindings/integration-baseline-summary.json',
  JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, matches:undefined }));
assert.equal(mismatched.length, 0, 'Baseline behavior differs; investigate before attributing failures to the baseline');
