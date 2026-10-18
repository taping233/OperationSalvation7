import { defineConfig } from 'vite';
import fs from 'node:fs';
export default defineConfig({
  plugins: [{ name: 'map-baseline', enforce: 'pre', load(id) {
    if (id.endsWith('/game/src/core/renderer.js?deepbaseline')) return fs.readFileSync(new URL('./renderer.baseline.txt', import.meta.url), 'utf8');
  } }],
  test: { environment: 'jsdom', include: ['.tmp/deep-perf-1018/map/profile.test.js'], maxWorkers: 1, minWorkers: 1, pool: 'forks', testTimeout: 120000 },
});
