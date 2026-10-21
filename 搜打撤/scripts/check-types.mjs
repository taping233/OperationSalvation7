import { spawn } from 'node:child_process';
import { auditTypeCoverage, TYPE_CONFIGS } from './check-type-coverage.mjs';
import { fileURLToPath } from 'node:url';

const tscPath = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
const configs = TYPE_CONFIGS;

// configs 清单中的配置彼此独立：并行跑，按原顺序汇报，任何失败都让整体退出非零。
function runConfig(config) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [tscPath, '--noEmit', '-p', config, '--pretty', 'false'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk.toString('utf8'); });
    child.stderr.on('data', chunk => { output += chunk.toString('utf8'); });
    child.on('error', error => resolve({ config, ok: false, output: error.message }));
    child.on('close', code => resolve({ config, ok: code === 0, output }));
  });
}

const results = await Promise.all(configs.map(runConfig));
let failed = false;
for (const result of results) {
  process.stdout.write(`Type-checking ${result.config}\n`);
  if (result.output) process.stdout.write(result.output);
  if (!result.ok) failed = true;
}

const coverage = await auditTypeCoverage();
const missing = coverage.files.filter(file => !file.checkedBy.length);
process.stdout.write(`Implementation type coverage: ${coverage.implementationChecked}/${coverage.denominator}; strict: ${coverage.strictChecked}/${coverage.denominator}\n`);
if (missing.length) {
  process.stderr.write(`Unchecked implementation files:\n${missing.map(file => file.file).join('\n')}\n`);
  failed = true;
}
process.exitCode = failed ? 1 : 0;
