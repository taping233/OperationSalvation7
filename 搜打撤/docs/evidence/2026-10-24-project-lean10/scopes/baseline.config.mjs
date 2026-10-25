import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from '../../../../vite.config.js';

const root = process.cwd();
const cache = path.join(root, 'node_modules/.cache/project-lean10-css-test-before');
export default {
  ...base,
  plugins: [...(base.plugins || []), {
    name: 'lean-css-original-test-source', enforce: 'pre',
    load(id) {
      const relative = path.relative(root, id.split('?')[0]);
      if (!relative.startsWith(`tests${path.sep}`)) return;
      const frozen = path.join(cache, relative);
      if (fs.existsSync(frozen)) return fs.readFileSync(frozen, 'utf8');
    },
  }],
  test: { ...base.test,
    setupFiles: [...(base.test.setupFiles || []), fileURLToPath(new URL('./baseline.setup.mjs', import.meta.url))],
  },
};
