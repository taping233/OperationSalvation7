export default {
  test: {
    environment: 'jsdom',
    include: ['docs/evidence/2026-09-30-full-repository-review/battle_cards/*.repro.test.js'],
    reporters: ['verbose'],
    testTimeout: 10000,
    cache: false,
  },
};
