import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
export default defineConfig({ root, test: { environment: 'jsdom', include: ['docs/evidence/2026-10-16-ui-lifecycle-deep-audit/*.test.js'], pool: 'forks', maxWorkers: 1, minWorkers: 1, testTimeout: 10000 } });
