import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import postcss from 'postcss';
import { resolve } from 'node:path';
import { readCssSource } from './helpers/css-source.js';

const css = readCssSource(resolve('game/css/base-framework-v7.css'), 'utf8');
const ast = postcss.parse(css);
describe('base subpage header contrast', () => {
  it.each([
    '.courtyard-zzz > .courtyard-v3-heading',
    '.personnel-v12[data-section="companions"] > .pv12-page-head',
  ])('places the current %s header on the shared reading surface', selector => {
    const rules = [];
    ast.walkRules(rule => { if (rule.selector.includes(selector)) rules.push(rule); });
    expect(rules).toHaveLength(1);
    const values = Object.fromEntries(rules[0].nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
    if(selector.includes('courtyard')){expect(values.display).toBe('none');return;}
    expect(values.background).toBe('var(--base-v12-glass)');
    expect(values['backdrop-filter']).toBe('var(--base-v12-filter)');
    expect(values['min-height']).toBe('64px');
    expect(rules[0].selector).toContain('.base-subpage');
  });
  it('targets the classes emitted by the current courtyard and personnel renderers', () => {
    const courtyard = fs.readFileSync(resolve('game/src/hub/hub.courtyard-v3.js'), 'utf8');
    const personnel = fs.readFileSync(resolve('game/src/hub/hub.personnel.js'), 'utf8');
    expect(courtyard).toContain('courtyard-zzz');
    expect(courtyard).toContain('courtyard-v3-heading');
    expect(personnel).toContain('data-section="companions"');
    expect(personnel).toContain('pv12-page-head');
    expect(css).not.toContain('.courtyard-v12 > .courtyard-v3-heading');
  });
});
