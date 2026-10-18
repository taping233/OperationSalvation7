import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const baselines = new Map(['battle.layers.js', 'battle.infusion-view.js', 'battle.view.js'].map(name => [
  `/game/src/battle/view/${name}`, new URL(`./baseline/${name}.txt`, import.meta.url),
]));

export default defineConfig({
  root,
  plugins: [{
    name: 'battle-page-perf-original-bytes', enforce: 'pre',
    load(id) {
      const normalized = id.replaceAll('\\', '/').split('?')[0];
      for (const [suffix, file] of baselines) if (normalized.endsWith(suffix)) return readFileSync(file, 'utf8');
    },
  }],
  test: {
    environment: 'jsdom', include: ['tests/page-perf-battle.test.js'],
    maxWorkers: 1, minWorkers: 1, pool: 'forks',
    env: { BATTLE_PAGE_PERF_BASELINE: '1' },
  },
});
