export default {
  test: {
    root: process.cwd(),
    environment: 'jsdom',
    include: ['docs/evidence/2026-10-16-skull-sword-start-audit/skull-sword.audit.test.js', 'tests/boss-equip-select.test.js', 'tests/battle-card-inspection.test.js'],
    testTimeout: 20000,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
  },
};
