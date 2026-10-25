import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const sourceRoot = path.join(root, 'game/src/hub');
const cache = path.join(root, 'node_modules/.cache/lean-refactor-1024/before/game/src/hub');
export default {
  plugins: [{
    name:'frozen-library-source',
    resolveId(id) { if (id.startsWith('frozen-library:')) return '\0' + id; },
    load(id) {
      if (!id.startsWith('\0frozen-library:')) return;
      const name = id.slice('\0frozen-library:'.length);
      return fs.readFileSync(path.join(cache, name), 'utf8').replace(/(['"])(\.{1,2}\/[^'"]+)\1/g, (match, quote, relative) => {
        if (relative === './game.cardslib.designer.js') return '"frozen-library:game.cardslib.designer.js"';
        return JSON.stringify(path.resolve(sourceRoot, relative).replaceAll('\\','/'));
      });
    },
  }],
  test:{root,environment:'jsdom',maxWorkers:1,minWorkers:1,
    include:['docs/evidence/2026-10-24-WF-code-lean-stage1-1024/refactor/library/*.vitest.js']},
};
