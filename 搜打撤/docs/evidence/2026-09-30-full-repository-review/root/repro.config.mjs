import { defineConfig } from 'vitest/config';
export default defineConfig({ cacheDir: 'docs/evidence/2026-09-30-full-repository-review/root/cache',
  test: { root: process.cwd(), environment: 'jsdom', cache: false, fileParallelism: false,
    include: ['docs/evidence/2026-09-30-full-repository-review/root/*.test.js'] } });
