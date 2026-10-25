import { defineConfig } from 'vitest/config';
export default defineConfig({ test:{
  include:['docs/evidence/2026-10-23-project-bug-audit/expedition/*.audit.test.js'],
  environment:'jsdom', maxWorkers:1, minWorkers:1,
} });
