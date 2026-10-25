import fs from 'node:fs';
import path from 'node:path';
import base from '../scopes/batch2/baseline.config.mjs';

const root = process.cwd();
const frozenRoot = path.join(root, 'node_modules/.cache/project-lean10-1024/before');
const loadedLog = path.join(root, 'node_modules/.cache/lean10-integration-baseline-loaded.jsonl');
const seen = new Set();
function frozenGameFile(file) {
  if (!file) return null;
  const clean = file.split('?')[0];
  const relative = path.relative(root, clean);
  if (!relative.startsWith(`game${path.sep}`) || !/\.(?:js|css)$/.test(relative)) return null;
  const frozen = path.join(frozenRoot, relative);
  return fs.existsSync(frozen) ? { relative, frozen, original:clean } : null;
}

export default {
  ...base,
  cacheDir:path.join(root, 'node_modules/.cache/lean10-integration-baseline-vite'),
  plugins:[...(base.plugins || []), {
    name:'lean10-frozen-game-module-source', enforce:'pre',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return;
      const file = frozenGameFile(path.resolve(path.dirname(importer.split('?')[0]), source));
      if (file) return file.original;
    },
    load(id) {
      if (/[?&](?:url|raw)(?:&|$)/.test(id)) return;
      const file = frozenGameFile(id);
      if (!file) return;
      if (!seen.has(file.relative)) {
        seen.add(file.relative);
        fs.appendFileSync(loadedLog, JSON.stringify({ file:file.relative }) + '\n');
      }
      return fs.readFileSync(file.frozen, 'utf8');
    },
  }],
};
