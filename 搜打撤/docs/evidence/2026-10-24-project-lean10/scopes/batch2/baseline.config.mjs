import fs from 'node:fs';
import path from 'node:path';
import base from '../baseline.config.mjs';

const root = process.cwd();
const cache = path.join(root, 'node_modules/.cache/project-lean10-css-test-before-batch2');
export default { ...base, plugins: [...base.plugins, {
  name: 'lean-css-batch2-original-test-source', enforce: 'pre',
  load(id) {
    const relative = path.relative(root, id.split('?')[0]);
    if (!relative.startsWith(`tests${path.sep}`)) return;
    const frozen = path.join(cache, relative);
    if (fs.existsSync(frozen)) return fs.readFileSync(frozen, 'utf8');
  },
}] };
