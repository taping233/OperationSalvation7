import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import stylelint from 'stylelint';
import config from '../../stylelint.config.mjs';

async function lint(code, file = 'container-store.css') {
  const result = await stylelint.lint({ code, codeFilename: path.resolve('game/css', file), config });
  return { errored: result.errored, warnings: result.results[0].warnings };
}

test('raw size is advisory in the secondary UI design domain', async () => {
  const result = await lint('.caption { font-size:18px; }');
  assert.equal(result.errored, false);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].severity, 'warning');
});

test('font shorthand is also audited', async () => {
  assert.equal((await lint('.caption { font:500 38px/1 sans-serif; }')).warnings.length, 1);
});

test('semantic size, layout pixels and intentional theme colors remain valid', async () => {
  assert.deepEqual((await lint('.caption { font-size:var(--ui-text-label); width:300px; gap:10px; color:#97a9b9; }')).warnings, []);
});

test('other themes and the token source may define raw sizes', async () => {
  for (const file of ['battle.css', 'secondary-ui-tokens.css']) {
    assert.deepEqual((await lint('.caption { font-size:18px; --ui-text-label:18px; }', file)).warnings, []);
  }
});

test('invalid hex and property mistakes are blocking errors', async () => {
  const result = await lint('.caption { color:#zzzzzz; font-siz:18px; }');
  assert.equal(result.errored, true);
  assert.deepEqual(result.warnings.map(item => item.rule).sort(), ['color-no-invalid-hex', 'property-no-unknown']);
});

test('container label reuses the existing 18px semantic token', async () => {
  const { readFile } = await import('node:fs/promises');
  const { default: postcss } = await import('postcss');
  const tokens = postcss.parse(await readFile('game/css/secondary-ui-tokens.css', 'utf8'));
  const container = postcss.parse(await readFile('game/css/container-store.css', 'utf8'));
  const values = [];
  tokens.walkDecls('--ui-text-label', decl => values.push(decl.value));
  assert.deepEqual(values, ['18px']);
  const labels = [];
  container.walkRules('& .container-column-head span', rule => {
    if (rule.parent.selector !== '#overlay .collection-workspace[data-collection-variant="container"]') return;
    rule.walkDecls('font-size', decl => labels.push(decl.value));
  });
  assert.deepEqual(labels, ['var(--ui-text-label)']);
});
