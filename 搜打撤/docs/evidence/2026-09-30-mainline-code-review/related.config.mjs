import { defineConfig } from 'vitest/config';
export default defineConfig({
  cacheDir: 'docs/evidence/2026-09-30-mainline-code-review/cache-related',
  define: { __BUILD_VERSION__: JSON.stringify('review') },
  test: { root: process.cwd(), environment: 'jsdom', cache: false,
    include: [
      'tests/e5-session-recovery.test.js', 'tests/save-prev-fallback.test.js',
      'tests/terminal-recovery-matrix.test.js', 'tests/extraction-session-resume.test.js',
      'tests/extraction-settlement.test.js', 'tests/battle-resolution.test.js',
      'tests/battle-settlement-recovery.test.js', 'tests/contracts.test.js',
      'tests/architecture-boundaries.test.js',
    ],
  },
});
