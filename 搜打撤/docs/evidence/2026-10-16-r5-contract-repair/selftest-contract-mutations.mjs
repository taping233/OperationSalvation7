import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(evidenceDir, '../../..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'r5-selftest-contract-'));
const copy = relative => {
  const destination = path.join(sandbox, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(path.join(root, relative), destination, { recursive: true });
};
for (const relative of ['game/selftest.js', 'game/src', 'game/data/map.json', 'game/data/scenes.json', 'narrative/events.ink']) copy(relative);
fs.writeFileSync(path.join(sandbox, 'package.json'), '{"type":"module"}\n');
fs.symlinkSync(path.join(root, 'node_modules'), path.join(sandbox, 'node_modules'), 'dir');

const target = path.join(sandbox, 'game/src/hub/game.bag.settle.js');
const source = fs.readFileSync(target, 'utf8');
const tail = "settlement.phase = 'saving';\n      return await settle();";
if (source.split(tail).length !== 2) throw new Error('Expected exactly one direct reward-settlement tail');
const cases = [
  ['baseline', source, 0],
  ['comment-reworded', source.replace('// Item 16：BOSS 战后不再强制整理背包', '// 领奖完成后提交本次战斗'), 0],
  ['wrong-save-phase', source.replace(tail, "settlement.phase = 'rewardsReady';\n      return await settle();"), 1],
  ['missing-await', source.replace(tail, "settlement.phase = 'saving';\n      return settle();"), 1],
  ['bypassed-settlement', source.replace(tail, "settlement.phase = 'saving';\n      return true;"), 1],
  ['cleanup-reintroduced', source.replace(tail, "settlement.phase = 'saving';\n      showBossPackCleanup();\n      return await settle();"), 1],
];
const results = [];
for (const [name, mutated, expectedExit] of cases) {
  if (name !== 'baseline' && mutated === source) throw new Error(`Mutation ${name} did not change the fixture`);
  fs.writeFileSync(target, mutated);
  const result = spawnSync(process.execPath, ['game/selftest.js'], { cwd: sandbox, encoding: 'utf8', timeout: 20000 });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  fs.writeFileSync(path.join(evidenceDir, `mutation-${name}.log`), output);
  const passed = !result.error && result.status === expectedExit
    && (expectedExit === 0 ? output.includes('全部通过') : /✘ BOSS·胜利领奖完成后直接保存结算/.test(output));
  results.push({ name, expectedExit, actualExit: result.status, passed,
    contracts: output.split('\n').filter(line => /BOSS·胜利领奖完成|BOSS·整理背包页已彻底/.test(line)) });
}
const report = { checkedAt: new Date().toISOString(), sandbox, results };
fs.writeFileSync(path.join(evidenceDir, 'selftest-contract-mutations.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(results.every(result => result.passed) ? 0 : 1);
