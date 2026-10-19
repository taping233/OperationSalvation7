import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['tests/battle-hand-selection-rules.test.js', 'tests/tools/hand-selection.property.test.js'], pool: 'forks', minWorkers: 1, maxWorkers: 1, testTimeout: 20000 },
});
