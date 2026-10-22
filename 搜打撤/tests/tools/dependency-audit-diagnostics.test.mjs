import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseAudit, collectAudit } from '../../scripts/dependency-audit-diagnostics.mjs';
const fixture = () => ({ auditReportVersion: 2, vulnerabilities: {}, metadata: {
  vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 }, dependencies: { total: 1 },
} });
const affected = () => {
  const report = fixture();
  report.metadata.vulnerabilities.high = report.metadata.vulnerabilities.total = 1;
  report.vulnerabilities.example = { name: 'example', severity: 'high', isDirect: true,
    range: '<2', via: [{ name: 'example', dependency: 'example', title: 'Fixture only', severity: 'high',
      source: 1, url: 'https://github.com/advisories/GHSA-fixture', range: '<2' }],
    nodes: ['node_modules/example'], effects: [], fixAvailable: { name: 'example', version: '2.0.0', isSemVerMajor: true } };
  return report;
};
test('valid empty audit exit 0 and affected audit exit 1 are collection, not security acceptance', () => {
  assert.equal(parseAudit(JSON.stringify(fixture()), 0).metadata.vulnerabilities.total, 0);
  assert.equal(parseAudit(JSON.stringify(affected()), 1).metadata.vulnerabilities.total, 1);
});
test('network error, invalid JSON, missing metadata and unsupported exit fail', () => {
  for (const [text, status] of [['{', 1], [JSON.stringify({ error: { code: 'EAI_AGAIN' } }), 1],
    ['{}', 0], [JSON.stringify(fixture()), 2], [JSON.stringify(fixture()), null]]) {
    assert.throws(() => parseAudit(text, status));
  }
});
test('error field, false counts, missing detail and exit/count mismatches fail', () => {
  const withError = fixture(); withError.error = null;
  const badCount = affected(); badCount.metadata.vulnerabilities.total = 2;
  const noDetail = affected(); noDetail.vulnerabilities = {};
  const credentialURL = affected(); const url = new URL('https://example.com/');
  url.username = 'fixture'; url.password = 'fixture'; credentialURL.vulnerabilities.example.via[0].url = url.href;
  for (const [report, status] of [[withError, 0], [badCount, 1], [noDetail, 1],
    [credentialURL, 1], [affected(), 0], [fixture(), 1]]) assert.throws(() => parseAudit(JSON.stringify(report), status));
});
test('oversized output fails without persistence', () => {
  assert.throws(() => parseAudit(' '.repeat(1024 * 1024 + 1), 0));
});

function workspace(fn) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dependency-audit-fixture-'));
  try { fn(path.join(dir, 'audit.json'), path.join(dir, 'summary.md')); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}
test('collector fails transport, signal, malformed or error JSON without artifacts or summary', () => {
  const results = [
    { error: new Error('fixture transport failure'), status: null, stdout: '' },
    { signal: 'SIGTERM', status: null, stdout: '' },
    { status: 1, stdout: '{' },
    { status: 1, stdout: JSON.stringify({ error: { code: 'EAI_AGAIN' } }) },
    { status: 2, stdout: JSON.stringify(fixture()) },
  ];
  for (const result of results) workspace((output, summary) => {
    let emitted = '';
    assert.throws(() => collectAudit(output, summary, { run: () => result, emit: value => { emitted += value; } }));
    assert.equal(existsSync(output), false); assert.equal(existsSync(summary), false); assert.equal(emitted, '');
  });
});
test('collector never overwrites existing output', () => workspace((output, summary) => {
  writeFileSync(output, 'retained evidence');
  assert.throws(() => collectAudit(output, summary, {
    run: () => ({ status: 0, stdout: JSON.stringify(fixture()) }), emit: () => assert.fail('unexpected success message'),
  }), { code: 'EEXIST' });
  assert.equal(readFileSync(output, 'utf8'), 'retained evidence'); assert.equal(existsSync(summary), false);
}));
test('collector pins official audit endpoint and info threshold; affected success warns, projects fields', () => workspace((output, summary) => {
  const report = affected(); report.unknown = 'discard'; report.metadata.unknown = 'discard';
  report.vulnerabilities.example.unknown = 'discard';
  report.vulnerabilities.example.via[0].unknown = 'discard';
  report.vulnerabilities.example.fixAvailable.unknown = 'discard';
  let emitted = '';
  collectAudit(output, summary, { run: (command, args, options) => {
    assert.equal(command, 'npm');
    assert.deepEqual(args, ['audit', '--package-lock-only', '--ignore-scripts', '--json',
      '--registry=https://registry.npmjs.org/', '--audit-level=info']);
    assert.equal(options.timeout, 120000); assert.equal(options.maxBuffer, 1024 * 1024);
    return { status: 1, stdout: JSON.stringify(report), stderr: 'fixture stderr must not persist' };
  }, emit: value => { emitted += value; } });
  const saved = readFileSync(output, 'utf8');
  assert.equal(saved.includes('discard'), false); assert.equal(saved.includes('stderr'), false);
  assert.equal(JSON.parse(saved).metadata.vulnerabilities.total, 1);
  assert.match(emitted, /^::warning::/); assert.match(emitted, /not security acceptance; no fixes applied/);
  assert.match(readFileSync(summary, 'utf8'), /not security acceptance/);
}));
test('collector handles valid zero-vulnerability report without calling it a security pass', () => workspace((output, summary) => {
  let emitted = '';
  collectAudit(output, summary, { run: () => ({ status: 0, stdout: JSON.stringify(fixture()) }), emit: value => { emitted += value; } });
  assert.equal(JSON.parse(readFileSync(output, 'utf8')).metadata.vulnerabilities.total, 0);
  assert.equal(emitted.includes('::warning::'), false); assert.match(emitted, /not security acceptance/);
}));
