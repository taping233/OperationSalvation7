// Manual frozen-source verification only. Default CI tests never load this evidence suite.
export default {
  test: {
    root: process.cwd(), environment: 'jsdom', maxWorkers: 1, minWorkers: 1,
    include: ['docs/evidence/2026-10-24-WF-code-lean-stage1-1024/ui/differential-*.vitest.js'],
  },
};
