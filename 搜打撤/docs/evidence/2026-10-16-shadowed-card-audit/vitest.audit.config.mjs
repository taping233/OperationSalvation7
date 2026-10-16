import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root:fileURLToPath(new URL('../../../',import.meta.url)),
  cacheDir:fileURLToPath(new URL('./.vite-cache',import.meta.url)),
  test:{
    environment:'jsdom',
    include:['docs/evidence/2026-10-16-shadowed-card-audit/shadowed-card.audit.test.js'],
    pool:'forks',maxWorkers:1,minWorkers:1,testTimeout:20000,
  },
});
