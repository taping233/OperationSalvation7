import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const cli = require.resolve('jscpd/run-jscpd.js');
const areas = ['battle', 'ui', 'hub', 'run'];
const requested = process.argv.slice(2);
if (requested.some(area => !areas.includes(area))) throw new Error('Choose battle, ui, hub or run.');
const base = 'node_modules/.cache/redundancy-audit';
const summary = [];
for (const area of requested.length ? requested : areas) {
  const output = path.join(base, area);
  mkdirSync(output, { recursive: true });
  const result = spawnSync(process.execPath, [cli, `game/src/${area}`, '--config', 'tests/tools/redundancy-report.json', '--workers', '1', '--output', output], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw result.error || new Error(result.stderr || `jscpd exited ${result.status}`);
  const report = JSON.parse(readFileSync(path.join(output, 'jscpd-report.json'), 'utf8'));
  summary.push({ area, ...report.statistics.total, candidates: report.duplicates.map(item => ({
    kind: item.kind, lines: item.lines, tokens: item.tokens,
    first: { file: `game/src/${area}/${item.firstFile.name}`, start: item.firstFile.start, end: item.firstFile.end },
    second: { file: `game/src/${area}/${item.secondFile.name}`, start: item.secondFile.start, end: item.secondFile.end },
  })) });
}
writeFileSync(path.join(base, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
