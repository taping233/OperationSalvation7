import { spawnSync } from 'node:child_process';
import { writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const levels = ['info', 'low', 'moderate', 'high', 'critical'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;

export function parseAudit(stdout, status) {
  if (![0, 1].includes(status)) throw new Error('npm audit did not complete (expected exit 0 or 1)');
  if (Buffer.byteLength(stdout) > 1024 * 1024) throw new Error('audit JSON exceeds 1 MiB');
  let report;
  try { report = JSON.parse(stdout); } catch { throw new Error('npm audit returned invalid JSON'); }
  if (!object(report) || 'error' in report || report.auditReportVersion !== 2
    || !object(report.vulnerabilities) || !object(report.metadata)
    || !object(report.metadata.vulnerabilities) || !object(report.metadata.dependencies)
    || !count(report.metadata.dependencies.total)) throw new Error('npm audit success schema missing');
  const totals = report.metadata.vulnerabilities;
  if (![...levels, 'total'].every(key => count(totals[key]))
    || levels.reduce((sum, key) => sum + totals[key], 0) !== totals.total) throw new Error('invalid vulnerability counts');
  const observed = Object.fromEntries(levels.map(key => [key, 0]));
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    if (!object(entry) || entry.name !== name || !levels.includes(entry.severity)
      || typeof entry.isDirect !== 'boolean' || typeof entry.range !== 'string'
      || !Array.isArray(entry.via) || !Array.isArray(entry.nodes) || !Array.isArray(entry.effects)
      || !entry.nodes.every(value => typeof value === 'string')
      || !entry.effects.every(value => typeof value === 'string')
      || !(typeof entry.fixAvailable === 'boolean' || (object(entry.fixAvailable)
        && typeof entry.fixAvailable.name === 'string' && typeof entry.fixAvailable.version === 'string'
        && typeof entry.fixAvailable.isSemVerMajor === 'boolean'))) throw new Error('invalid vulnerability detail');
    for (const via of entry.via) {
      if (typeof via === 'string') continue;
      if (!object(via) || typeof via.name !== 'string' || typeof via.dependency !== 'string'
        || typeof via.title !== 'string' || typeof via.range !== 'string'
        || !levels.includes(via.severity) || !count(via.source)
        || typeof via.url !== 'string') throw new Error('invalid advisory detail');
      const url = new URL(via.url);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid public advisory URL');
    }
    observed[entry.severity]++;
  }
  if (!levels.every(key => observed[key] === totals[key])
    || (status === 0) !== (totals.total === 0)) throw new Error('exit/count mismatch');
  const dependencies = {};
  for (const key of ['prod', 'dev', 'optional', 'peer', 'peerOptional', 'total']) {
    if (key in report.metadata.dependencies) {
      if (!count(report.metadata.dependencies[key])) throw new Error('invalid dependency count');
      dependencies[key] = report.metadata.dependencies[key];
    }
  }
  const vulnerabilities = Object.fromEntries(Object.entries(report.vulnerabilities).map(([name, entry]) => {
    const via = entry.via.map(value => {
      if (typeof value === 'string') return value;
      const advisory = Object.fromEntries(['source', 'name', 'dependency', 'title', 'url', 'severity', 'range']
        .map(key => [key, value[key]]));
      if ('cwe' in value) {
        if (!Array.isArray(value.cwe) || !value.cwe.every(item => typeof item === 'string')) throw new Error('invalid advisory CWE');
        advisory.cwe = value.cwe;
      }
      if ('cvss' in value) {
        if (!object(value.cvss) || !Number.isFinite(value.cvss.score) || value.cvss.score < 0 || value.cvss.score > 10
          || !(value.cvss.vectorString === null || typeof value.cvss.vectorString === 'string')) throw new Error('invalid advisory CVSS');
        advisory.cvss = { score: value.cvss.score, vectorString: value.cvss.vectorString };
      }
      return advisory;
    });
    const fixAvailable = typeof entry.fixAvailable === 'boolean' ? entry.fixAvailable
      : Object.fromEntries(['name', 'version', 'isSemVerMajor'].map(key => [key, entry.fixAvailable[key]]));
    return [name, { name, severity: entry.severity, isDirect: entry.isDirect, range: entry.range,
      via, nodes: entry.nodes, effects: entry.effects, fixAvailable }];
  }));
  // Persist only validated public audit fields; discard unknown fields at every object level.
  return { auditReportVersion: 2, vulnerabilities,
    metadata: { vulnerabilities: Object.fromEntries([...levels, 'total'].map(key => [key, totals[key]])), dependencies } };
}

export function collectAudit(outputFile, summaryFile, { run = spawnSync, emit = value => process.stdout.write(value) } = {}) {
  const result = run('npm', ['audit', '--package-lock-only', '--ignore-scripts', '--json',
    '--registry=https://registry.npmjs.org/', '--audit-level=info'], {
    encoding: 'utf8', timeout: 120_000, maxBuffer: 1024 * 1024,
  });
  if (result.error || result.signal) throw new Error('npm audit transport/process failed; no diagnostic artifact written');
  const report = parseAudit(result.stdout, result.status);
  const serialized = JSON.stringify(report, null, 2) + '\n';
  if (Buffer.byteLength(serialized) > 1024 * 1024) throw new Error('diagnostic artifact exceeds 1 MiB');
  writeFileSync(outputFile, serialized, { flag: 'wx' });
  const counts = report.metadata.vulnerabilities;
  const message = `Dependency audit diagnostics collected: ${counts.total} vulnerabilities (${levels.map(key => `${key}=${counts[key]}`).join(', ')}). Collection is not security acceptance; no fixes applied.`;
  if (counts.total) emit(`::warning::${message}\n`);
  else emit(message + '\n');
  if (summaryFile) appendFileSync(summaryFile, `### Dependency audit diagnostics\n\n${message}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('diagnostic output file required');
    collectAudit(process.argv[2], process.env.GITHUB_STEP_SUMMARY);
  } catch (error) {
    // Do not print raw npm stderr/JSON, environment, registry credentials or URLs.
    process.stderr.write(`Dependency audit diagnostics FAILED: ${error.message}\n`);
    process.exitCode = 1;
  }
}
