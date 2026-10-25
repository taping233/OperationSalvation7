import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'jsdom',maxWorkers:1,minWorkers:1,
  include:['docs/evidence/2026-10-23-project-bug-audit/slot-entry.audit.test.js']}});
