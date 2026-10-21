import { fileURLToPath } from 'node:url';
const replace = (source, before, after) => {
  if (!source.includes(before)) throw new Error(`Instrumentation anchor missing: ${before}`);
  return source.replace(before, after);
};
export default {
  root: fileURLToPath(new URL('./搜打撤/', import.meta.url)),
  resolve: { preserveSymlinks: true }, cacheDir: fileURLToPath(new URL('./.vite-instrumented', import.meta.url)),
  plugins: [{ name: 'count-production-hover-calls', enforce: 'pre', transform(source, id) {
    const count = key => `globalThis.__previewHandCounts && globalThis.__previewHandCounts.${key}++;`;
    if (id.endsWith('/battle.card-inspection.domain.js')) {
      source = replace(source, 'const findCardInState = (state, uid) => {', `const findCardInState = (state, uid) => { ${count('lookups')}`);
      source = replace(source, 'const effCostOf = (card, uid) => {', `const effCostOf = (card, uid) => { ${count('cost')}`);
    } else if (id.endsWith('/card-rules.capability.js')) {
      source = replace(source, 'export function inspectCardRuleCapability(card) {', `export function inspectCardRuleCapability(card) { ${count('capability')}`);
    } else if (id.endsWith('/battle.card-play.domain.js')) {
      source = replace(source, 'readState().hand.map(u => {', '(globalThis.__previewHandCounts && globalThis.__previewHandCounts.handProjection++, readState().hand).map(u => {');
    } else return;
    return { code: source, map: null };
  } }],
  test: { environment: 'jsdom', testTimeout: 20000, pool: 'forks', maxWorkers: 1, minWorkers: 1, include: ['tests/battle-area-hover-hand-context.test.js'] },
};
