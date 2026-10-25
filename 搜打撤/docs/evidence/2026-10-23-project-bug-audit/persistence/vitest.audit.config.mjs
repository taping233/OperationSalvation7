import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  root: process.cwd(), environment: 'jsdom', pool: 'forks', maxWorkers: 1, minWorkers: 1,
  testTimeout: 20000,
  include: ['docs/evidence/2026-10-23-project-bug-audit/persistence/probes.test.js'],
} });
