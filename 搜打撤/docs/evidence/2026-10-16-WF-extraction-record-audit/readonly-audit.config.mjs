// Standalone audit-only target; does not invoke build, pretest, or the full test suite.
import { fileURLToPath } from 'node:url';
export default {
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  test: { environment: 'jsdom', include: ['docs/evidence/2026-10-16-WF-extraction-record-audit/readonly-audit.test.js'], fileParallelism: false, testTimeout: 20000 },
};
