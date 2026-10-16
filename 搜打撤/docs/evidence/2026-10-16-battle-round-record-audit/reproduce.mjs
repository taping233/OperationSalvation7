// Run from any directory: node <this-file>.
// Executes the standalone regression file through the project's existing Vitest.
// Source imports need Vite's JSON handling; plain Node import was not applicable.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const result = spawnSync(process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', 'tests/battle-round-recording.test.js', '--reporter=verbose'],
  { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
