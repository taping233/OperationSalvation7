import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const compilerPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/typescript/bin/tsc');

export const TYPE_CONFIGS = [
  'jsconfig.framework-boundaries.json', 'jsconfig.framework-ports.json', 'jsconfig.json',
  'jsconfig.battle-settlement.json', 'jsconfig.battle-snapshot.json', 'jsconfig.card-rules.json',
  'jsconfig.strict-foundations.json', 'jsconfig.strict-selection.json',
  'jsconfig.strict-hand-selection.json', 'jsconfig.strict-ui.json', 'jsconfig.runtime.json',
];
const slash = value => value.replaceAll('\\', '/');
function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(p) : [p];
  });
}

// A deliberately invalid, unique assignment is appended in an isolated source copy.
// An import or a files/include entry alone does not prove implementation checking:
// only the compiler's actual TS2322 at the probe line counts as coverage.
export async function auditTypeCoverage({ configs = TYPE_CONFIGS, root = process.cwd() } = {}) {
  const sources = filesUnder(path.join(root, 'game/src')).filter(p => /\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/.test(p) && !/\.d\.[cm]?ts$/.test(p));
  fs.mkdirSync(path.join(root, '.tmp'), {recursive:true});
  const temp = fs.mkdtempSync(path.join(root, '.tmp/type-coverage-'));
  for (const dir of ['game/src', 'game/data', 'tests']) {
    for (const source of filesUnder(path.join(root, dir))) {
      const destination = path.join(temp, path.relative(root, source));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, fs.readFileSync(source));
    }
  }
  const probes = new Map();
  for (const file of sources) {
    const relative = slash(path.relative(root, file));
    const text = fs.readFileSync(file, 'utf8');
    const line = text.split('\n').length + 1;
    probes.set(relative, line);
    const probe = /\.[cm]?tsx?$/.test(file)
      ? '\nconst __runtime_type_coverage_probe__: number = "coverage-must-fail";\n'
      : '\n/** @type {number} */ const __runtime_type_coverage_probe__ = "coverage-must-fail";\n';
    fs.appendFileSync(path.join(temp, relative), probe);
  }
  const configResults = [];
  for (const config of configs) {
    fs.copyFileSync(path.join(root, config), path.join(temp, config));
    const parsed = spawnSync(process.execPath, [compilerPath, '-p', config, '--showConfig'], { cwd: temp, encoding: 'utf8', maxBuffer: 32e6 });
    if (parsed.status !== 0) throw new Error(`Cannot inspect ${config}: ${parsed.stdout}${parsed.stderr}`);
    const resolved = JSON.parse(parsed.stdout);
    const options = resolved.compilerOptions;
    if (config === 'jsconfig.runtime.json' && options.checkJs !== true) throw new Error('Runtime implementation baseline requires checkJs: true');
    const run = spawnSync(process.execPath, [compilerPath, '-p', config, '--pretty', 'false', '--listFiles'], { cwd: temp, encoding: 'utf8', maxBuffer: 64e6 });
    if (run.error || run.signal) throw run.error || new Error(`${config}: ${run.signal}`);
    fs.writeFileSync(path.join(temp, config + '.diagnostics.txt'), run.stdout + run.stderr);
    const checked = new Set();
    const loaded = new Set();
    for (const line of run.stdout.split(/\r?\n/)) {
      const relative = slash(path.relative(temp, line.trim()));
      if (probes.has(relative)) loaded.add(relative);
      const match = line.match(/(?:^|\/)(game\/src\/[^()]+)\((\d+),\d+\): error TS2322:/);
      if (match && probes.get(match[1]) === Number(match[2])) checked.add(match[1]);
    }
    configResults.push({ config, strict: options.strict === true, checkJs: options.checkJs === true, checked: [...checked].sort(), loaded: [...loaded].sort(),
      interfaceFixtures: (resolved.files || []).filter(file => /tests\/.*(?:fixture|types).*\.tsx?$/.test(slash(file))) });
  }
  const files = [...probes.keys()].sort().map(file => {
    const actual = configResults.filter(c => c.checked.includes(file));
    return { file, checkedBy: actual.map(c => c.config), strictBy: actual.filter(c => c.strict).map(c => c.config),
      uncheckedDependencyBy: configResults.filter(c => c.loaded.includes(file) && !c.checked.includes(file)).map(c => c.config) };
  });
  return { denominator: files.length, implementationChecked: files.filter(f => f.checkedBy.length).length,
    strictChecked: files.filter(f => f.strictBy.length).length,
    excluded: [], configs: configResults, files, probeDirectory: slash(path.relative(root, temp)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const report = await auditTypeCoverage();
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0) fs.writeFileSync(process.argv[outputIndex + 1], JSON.stringify(report, null, 2) + '\n');
  const missing = report.files.filter(f => !f.checkedBy.length);
  console.log(JSON.stringify({ denominator: report.denominator, implementationChecked: report.implementationChecked,
    strictChecked: report.strictChecked, missing: missing.map(f => f.file) }, null, 2));
  process.exitCode = missing.length ? 1 : 0;
}
