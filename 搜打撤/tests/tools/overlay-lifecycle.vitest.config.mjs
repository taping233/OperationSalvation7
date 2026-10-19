import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'jsdom', include: ['tests/tools/overlay-lifecycle.property.test.js'], pool: 'forks', minWorkers: 1, maxWorkers: 1, testTimeout: 20000 },
});
