import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tscPath = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
const configs = [
  'jsconfig.framework-boundaries.json',
  // Battle command/receipt contracts only; the legacy factory body is outside strict checking.
  'jsconfig.framework-ports.json',
  'jsconfig.json',
  'jsconfig.battle-settlement.json',
  'jsconfig.battle-snapshot.json',
  'jsconfig.card-rules.json',
  'jsconfig.strict-foundations.json',
  // Checks only the new selection-flow external ports via its fixture; its legacy runtime body is not strict-checked.
  'jsconfig.strict-selection.json',
  // Strict-checks pure hand-selection/discovery rules, not the legacy battle runtime integration.
  'jsconfig.strict-hand-selection.json',
  // DEBT-2 strict 扩面第一批（10-02）：ui 域四文件纯注释级达标，tsc 门常驻。
  'jsconfig.strict-ui.json',
];

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

process.exitCode = failed ? 1 : 0;
