import { defineConfig } from 'vitest/config';
export default defineConfig({ test:{ root:process.cwd(), environment:'jsdom', include:['docs/evidence/2026-10-16-run-lifecycle-audit/known-loss-probe.test.js'], pool:'forks' } });
