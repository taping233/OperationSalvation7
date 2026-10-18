import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const shared = process.env.SDT_HOVER_EXPERIMENT === 'shared';
export default defineConfig({
  root,
  plugins: [{
    name: 'read-only-hover-experiment', enforce: 'pre',
    load(id) {
      const normalized = id.replaceAll('\\', '/').split('?')[0];
      if (!normalized.endsWith('/game/src/battle/view/battle.aim.js') && !normalized.endsWith('/game/src/battle/view/battle.hover.js')) return;
      const before = normalized.endsWith('/battle.aim.js') ? './battle.aim.js.before.txt' : './battle.hover.js.before.txt';
      const source = readFileSync(new URL(before, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
      if (!shared) return source;
      if (normalized.endsWith('/battle.hover.js')) return source
        .replace('uid, card, interactionMode) {', 'uid, card, interactionMode, hoverSnapshot = null) {')
        .replace('const snapshot = getSnapshot();', 'const snapshot = hoverSnapshot || getSnapshot();');
      const original = `a.stage.querySelectorAll('.bt-foe[data-eidx]').forEach(el => {\n              const idx = +el.dataset.eidx;\n              if (!getSnapshot().foes[idx]?.dead) showFoePreview(el, idx, a.uid, a.card, 'drag');\n            });`;
      const changed = `const hoverSnapshot = getSnapshot();\n            a.stage.querySelectorAll('.bt-foe[data-eidx]').forEach(el => {\n              const idx = +el.dataset.eidx;\n              if (!hoverSnapshot.foes[idx]?.dead) showFoePreview(el, idx, a.uid, a.card, 'drag', hoverSnapshot);\n            });`;
      if (!source.includes(original)) throw new Error('AOE preview source changed; review experiment before replay');
      return source.replace(original, changed);
    },
  }],
  test: { environment: 'jsdom', include: ['docs/evidence/2026-10-18-WF-perf-budgets-1018/css/runtime/hover.test.js'], maxWorkers: 1, minWorkers: 1, pool: 'forks' },
});
