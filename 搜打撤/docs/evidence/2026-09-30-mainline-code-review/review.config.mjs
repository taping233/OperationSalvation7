import { defineConfig } from 'vitest/config';
export default defineConfig({
  cacheDir: 'docs/evidence/2026-09-30-mainline-code-review/cache',
  test: {
    root: process.cwd(), environment: 'jsdom',
    include: ['docs/evidence/2026-09-30-mainline-code-review/repro.test.js'],
    fileParallelism: false, cache: false,
  },
});
