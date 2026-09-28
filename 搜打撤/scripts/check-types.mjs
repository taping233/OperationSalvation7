import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tscPath = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
const configs = [
  'jsconfig.json',
  'jsconfig.battle-settlement.json',
  'jsconfig.battle-snapshot.json',
  'jsconfig.card-rules.json',
  'jsconfig.strict-foundations.json',
  // Checks only the new selection-flow external ports via its fixture; its legacy runtime body is not strict-checked.
  'jsconfig.strict-selection.json',
  'jsconfig.strict-hand-selection.json',
];

let failed = false;
for (const config of configs) {
  process.stdout.write(`Type-checking ${config}\n`);
  const result = spawnSync(process.execPath, [tscPath, '--noEmit', '-p', config, '--pretty', 'false'], {
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    failed = true;
  } else if (result.status !== 0) {
    failed = true;
  }
}

process.exitCode = failed ? 1 : 0;
