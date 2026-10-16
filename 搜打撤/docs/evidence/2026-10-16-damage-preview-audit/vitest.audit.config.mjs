// Isolated audit runner: no production Vite config, browser, build, or battle session.
export default {
  cacheDir: 'docs/evidence/2026-10-16-damage-preview-audit/.vite-cache',
  test: {
    environment: 'node',
    include: ['docs/evidence/2026-10-16-damage-preview-audit/repro.test.js'],
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    cache: false,
  },
};
