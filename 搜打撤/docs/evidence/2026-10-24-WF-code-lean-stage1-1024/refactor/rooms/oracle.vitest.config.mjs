import { defineConfig } from 'vitest/config';
export default defineConfig({ test:{ environment:'jsdom', include:['docs/evidence/2026-10-24-WF-code-lean-stage1-1024/refactor/rooms/oracle.test.js','docs/evidence/2026-10-24-WF-code-lean-stage1-1024/refactor/rooms/existing-failures.test.js'], pool:'forks', minWorkers:1, maxWorkers:1, testTimeout:30000 } });
