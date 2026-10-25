import postcss from 'postcss';
import { expect, it } from 'vitest';
import { readCssSource } from './helpers/css-source.js';

it('resets the legacy bottom anchor so the top-anchored infusion chip keeps its content height', () => {
  const css = postcss.parse(readCssSource('game/css/battle-stage.css', 'utf8'));
  const declarations = {};
  css.walkRules('#overlay .battle-stage.sts .bt-infchip', rule => {
    rule.walkDecls(decl => { declarations[decl.prop] = decl.value; });
  });
  expect(declarations.top).toBe('56px');
  expect(declarations.bottom).toBe('auto');
  expect(declarations['min-height']).toBe('40px');
});
