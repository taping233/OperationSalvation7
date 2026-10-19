import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// Narrow art checks, with no shell command strings and no lost native exit code.
export function runSteps(steps, spawn = spawnSync) {
  const results = [];
  for (const step of steps) {
    const started = Date.now();
    const result = spawn(step.command, step.args, { cwd: step.cwd, encoding: 'utf8', windowsHide: true,
      shell: false, timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
    const exitCode = Number.isInteger(result.status) ? result.status : 1;
    results.push({ name: step.name, exitCode, durationMs: Date.now() - started,
      stdout: result.stdout || '', stderr: result.stderr || '', error: result.error?.message });
    if (exitCode !== 0) return { ok: false, exitCode, steps: results };
  }
  return { ok: true, exitCode: 0, steps: results };
}

function main() {
  const { values } = parseArgs({ options: { help: { type: 'boolean' }, root: { type: 'string' },
    asset: { type: 'string', multiple: true }, test: { type: 'string', multiple: true },
    'paths-json': { type: 'string' }, 'tests-json': { type: 'string', default: '[]' }, report: { type: 'string' } } });
  if (values.help) {
    console.log('node tools/art-check.mjs --asset <asset path> [--test <test file> ...] [--report <project-relative JSON>] [--root <project>]\nStructured callers may use --paths-json and --tests-json. Runs selected asset audit, then specified existing Vitest tests; stops on first failure. No build, git or browser actions.');
    return;
  }
  const root = path.resolve(values.root || fileURLToPath(new URL('..', import.meta.url)));
  const pathInput = JSON.parse(values['paths-json'] || '[]');
  const testInput = JSON.parse(values['tests-json']);
  if (!Array.isArray(pathInput) || !Array.isArray(testInput)) throw new Error('JSON inputs must be arrays');
  const paths = [...pathInput, ...(values.asset || [])];
  const tests = [...testInput, ...(values.test || [])];
  if (!Array.isArray(paths) || !paths.length || !paths.every(item => typeof item === 'string')) throw new Error('Explicit asset paths required');
  if (!Array.isArray(tests) || !tests.every(item => typeof item === 'string' && /^tests\/[\w./-]+\.test\.js$/.test(item) && !item.includes('..'))) throw new Error('Invalid test paths');
  let report;
  if (values.report) {
    report = path.resolve(root, values.report);
    const relative = path.relative(root, report);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Report must stay inside project');
  }
  const steps = [{ name: 'selected-assets', command: process.execPath, cwd: root,
    args: ['scripts/asset-audit.cjs', '--scope', 'selected', '--paths-json', JSON.stringify(paths), '--json'] }];
  if (tests.length) steps.push({ name: 'targeted-tests', command: process.execPath, cwd: root,
    args: ['node_modules/vitest/vitest.mjs', 'run', ...tests] });
  const result = runSteps(steps);
  if (report) { mkdirSync(path.dirname(report), { recursive: true }); writeFileSync(report, JSON.stringify(result, null, 2) + '\n'); }
  console.log(JSON.stringify(result));
  process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, exitCode: 1, error: error.message })); process.exitCode = 1; }
}
