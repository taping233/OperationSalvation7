// Read-only production-module audit. No production Vite config, browser or build.
export default {
  cacheDir: 'docs/evidence/2026-10-16-reward-atomicity-audit/.vite-cache',
  test: { environment: 'jsdom', include: ['docs/evidence/2026-10-16-reward-atomicity-audit/repro.test.js'], pool: 'forks', maxWorkers: 1, minWorkers: 1, cache: false },
};
