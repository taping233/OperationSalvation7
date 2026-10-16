import base from '../../../vite.config.js';

// Test-only in-memory transform: reproduce the two old UI gates without touching
// the shared source tree, dev server, stored game data, or production build.
export default {
  ...base,
  test: { ...base.test, include: ['tests/safe-pearl-access.test.js'] },
  plugins: [{
    name: 'safe-pearl-old-gate-mutant',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith('/game/src/hub/game.bag.js')) return;
      const mutant = code
        .replace("if (card.id === 'tt2-pearlbox') btns.push", "if (card.id === 'tt2-pearlbox' && !safeFlag) btns.push")
        .replace("if (card.id === 'tt2-pearlbox') bagAct('pearlStoreZoom'", "if (card.id === 'tt2-pearlbox' && !safeFlag) bagAct('pearlStoreZoom'");
      if (mutant === code) throw new Error('Old safe-pearl gate mutant did not match');
      return { code: mutant, map: null };
    },
  }, ...(base.plugins || [])],
};
