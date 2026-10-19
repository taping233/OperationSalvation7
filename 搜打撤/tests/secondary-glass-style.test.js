import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const css = name => postcss.parse(readFileSync(`game/css/${name}.css`, 'utf8'));
const declaration = (name, selector, prop) => {
  let value;
  css(name).walkRules(rule => {
    if (rule.selector === selector) rule.walkDecls(prop, decl => { value = decl.value; });
  });
  return value;
};
const panel = 'body #overlay .battle-decision.battle-decision-unified.battle-secondary-panel';

describe('secondary glass and unboxed capacity presentation contracts', () => {
  it('shares one scoped material across floating and legacy discovery surfaces', () => {
    const tokens = css('secondary-ui-tokens');
    const material = [];
    tokens.walkDecls('--ui-glass-surface', d => material.push(d));
    expect(material).toHaveLength(1);
    expect(material[0].value).toBe('rgba(21,33,44,.5)');
    expect(material[0].parent.selector).toContain('.battle-secondary-panel');
    expect(material[0].parent.selector).not.toContain(':root');
    expect(declaration('battle-secondary-overlay', panel, '--feedback-panel')).toBe('var(--ui-glass-surface)');
    const legacy = 'body #overlay .card.discover:has(.battle-decision[data-decision-kind="discover"])';
    expect(declaration('battle-discover', legacy, 'background')).toBe('var(--ui-glass-surface)');
    expect(declaration('battle-discover', legacy, 'backdrop-filter')).toBe('blur(var(--ui-glass-blur))');
  });
  it('keeps the full-screen shield clear and adds blur only to the content surface', () => {
    expect(declaration('battle-secondary-overlay', 'body #overlay .battle-secondary-layer', 'background')).toBe('transparent');
    expect(declaration('battle-secondary-overlay', panel, 'backdrop-filter')).toBe('blur(var(--ui-glass-blur))');
    expect(declaration('battle-secondary-overlay', 'body #overlay .card.card:has(> #ovBody > .battle-secondary-layer)', 'backdrop-filter')).toBe('none');
  });
  it('removes nested opaque panels while retaining clear action and hover cues', () => {
    for (const child of ['.choice-opt', '.battle-decision-inspect']) {
      expect(declaration('battle-secondary-overlay', `${panel} ${child}`, 'background')).toBe('transparent');
      expect(declaration('battle-secondary-overlay', `${panel} ${child}`, 'backdrop-filter')).toBeUndefined();
    }
    expect(declaration('battle-secondary-overlay', 'body #overlay .battle-secondary-panel .infusion-source', 'background')).toBe('transparent');
    expect(declaration('battle-secondary-overlay', `${panel} .battle-decision-actions .ov-btn.ok`, 'background')).toBe('var(--ui-blue)');
    const blue = [];
    css('secondary-ui-tokens').walkDecls('--ui-blue', decl => blue.push(decl));
    expect(blue).toHaveLength(1);
    expect(blue[0].value).toBe('#b6cbd7');
    expect(blue[0].parent.selector).toContain('.battle-secondary-panel');
    expect(declaration('battle-secondary-overlay', `${panel} .choice-opt:is(:hover,:focus-visible)`, 'background')).toBe('#b6cbd714');
  });
  it('removes the capacity chip box at its source, without hiding capacity content', () => {
    const selector = 'body #overlay .card.bag-page .bag-v2 .bag-capchip';
    for (const [prop, value] of [['background', 'none'], ['border', '0'], ['padding', '0'], ['box-shadow', 'none']]) {
      expect(declaration('expedition-inventory', selector, prop)).toBe(value);
    }
    expect(declaration('expedition-inventory', selector, 'backdrop-filter')).toBeUndefined();
    expect(declaration('expedition-inventory', selector, 'display')).toBe('flex');
    expect(readFileSync('game/css/bag-design-system.css', 'utf8')).not.toContain(':is(.bag-rail,.bag-board,.bag-capchip)');
    expect(declaration('bag-design-system', 'body #overlay .card.bag-page .bag-v2.ui-design-system .bag-count-summary', 'display')).toBeUndefined();
  });
  it('loads material definitions directly before component rules', () => {
    for (const name of ['battle-secondary-overlay', 'battle-discover']) {
      const first = css(name).nodes[0];
      expect(first.type).toBe('atrule');
      expect(first.name).toBe('import');
      expect(first.params).toContain('secondary-ui-tokens.css');
    }
  });
});
