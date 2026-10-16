// Read-only Acorn import graph contrast, no bundler or Vite hook.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(path.resolve('package.json'));
const { parse } = require('acorn');
const root = process.cwd();
const facade = path.resolve('game/src/hub/game.hub.js');
const currentFacade = fs.readFileSync(facade, 'utf8');
if (!currentFacade.includes("from './departure.selection-state.js'")) throw new Error('Expected facade selection import not found');
// Handoff confirmed these two tracked sources had no pre-existing diff. Keep
// every other current worker's source unchanged in both graph comparisons.
const prefix = execFileSync('git', ['rev-parse', '--show-prefix'], { encoding: 'utf8' }).trim();
const originals = new Map(['game/src/hub/game.hub.js', 'game/src/hub/game.hub.depart.js']
  .map(file => [path.resolve(file), execFileSync('git', ['show', `HEAD:${prefix}${file}`], { encoding: 'utf8' })]));
const html = fs.readFileSync('game/index.html', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const entries = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(m => path.resolve('game', m[1]));
function graph(overrides = new Map()) {
  const nodes = new Map();
  const visit = file => {
    if (nodes.has(file) || !file.endsWith('.js')) return;
    const code = overrides.get(file) ?? fs.readFileSync(file, 'utf8');
    nodes.set(file, { path: path.relative(root, file).replaceAll('\\', '/'), bytes: Buffer.byteLength(code) });
    for (const node of parse(code, { ecmaVersion: 'latest', sourceType: 'module' }).body) {
      if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)
        || !node.source?.value.startsWith('.')) continue;
      visit(path.resolve(path.dirname(file), node.source.value));
    }
  };
  entries.forEach(visit);
  return nodes;
}
const before = graph(originals), after = graph();
const removed = [...before].filter(([file]) => !after.has(file)).map(([, node]) => node);
const added = [...after].filter(([file]) => !before.has(file)).map(([, node]) => node);
process.stdout.write(JSON.stringify({
  checkedAt: new Date().toISOString(),
  method: 'Current source closure compared with the two edited hub files at HEAD, verified unchanged at handoff. Every other worker source is current in both graphs; no source writes, bundler or tree-shaking',
  entries: entries.map(file => path.relative(root, file)),
  beforeModules: before.size, afterModules: after.size,
  removed, added,
  sourceBytesRemoved: removed.reduce((sum, node) => sum + node.bytes, 0),
  sourceBytesAdded: added.reduce((sum, node) => sum + node.bytes, 0),
  departureInInitialGraph: after.has(path.resolve('game/src/hub/game.hub.depart.js')),
  runtimeInInitialGraph: after.has(path.resolve('game/src/hub/game.hub.runtime.js')),
  measuredBundleSavings: null,
  limitation: 'This proves source reachability only; production compressed bytes require the parent integrated build',
}, null, 2) + '\n');
