import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const run = args => {
  const start = performance.now();
  const result = spawnSync(process.execPath, ['scripts/workflow.mjs', 'status', ...args], {
    cwd: root, encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return { ...result, ms: Math.round(performance.now() - start) };
};
const boundary = run(['--paths', '../AGENTS.md', '--json']);
assert.notEqual(boundary.status, 0);
assert.match(boundary.stdout, /任务范围路径必须位于项目内/);
const samples = [];
const scopes = ['README.md,docs/development.md', 'docs/WORKFLOW-TOOLS.md,tests/docs-consistency.test.js', 'docs/README.md,docs/quality-gates.md'];
for (let i = 0; i < scopes.length; i++) {
  for (const mode of i % 2 ? ['scoped', 'global'] : ['global', 'scoped']) {
    const result = run(['--json', ...(mode === 'scoped' ? ['--paths', scopes[i]] : [])]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const data = JSON.parse(result.stdout);
    if (mode === 'scoped') {
      assert.deepEqual(data.scope.paths, scopes[i].split(','));
      assert(data.registry.rows.some(row => row.cells[0].includes('WF-flow-practice')), '自有相关编辑占用必须保留');
    }
    samples.push({ round: i + 1, mode, paths: scopes[i], ms: result.ms, chars: result.stdout.length,
      changes: data.changes.length, editing: data.registry.rows.map(row => row.cells[0]),
      omitted: data.omitted, outputSha256: createHash('sha256').update(result.stdout).digest('hex') });
  }
}
const report = { at: new Date().toISOString(), boundary: { exitCode: boundary.status, output: boundary.stdout }, samples,
  limits: ['3组同机实测；顺序部分反转，非随机试验；只比较接手输出与命令耗时，不推断整个开发任务提速'] };
writeFileSync(path.join(directory, 'scope-samples.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(samples.map(({ round, mode, ms, chars, changes }) => ({ round, mode, ms, chars, changes }))) + '\n');
