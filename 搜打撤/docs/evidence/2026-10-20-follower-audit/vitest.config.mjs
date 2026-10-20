import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['docs/evidence/2026-10-20-follower-audit/probe.test.js'],
    pool: 'forks', maxWorkers: 1, minWorkers: 1, testTimeout: 10000,
  },
});
