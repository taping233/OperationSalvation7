// @vitest-environment node
import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { transform } from 'esbuild';
import { componentScopesPlugin, expandComponentScopes } from '../scripts/css-component-scopes.mjs';

const declarations = rule => rule.nodes.map(node => node.type === 'comment'
  ? ['comment', node.text] : [node.prop, node.value, node.important || false]);
function facts(css) {
  const rows = [];
  postcss.parse(css).walkRules(rule => {
    const conditions = [];
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type === 'atrule') conditions.unshift([parent.name, parent.params]);
    }
    rows.push([conditions, rule.selector, declarations(rule)]);
  });
  return rows;
}

const source = `/*! @license retained */
@layer skin {
  @media (min-width: 1px) {
    #overlay .battle-stage.sts {
      /* prior rule */
      & .sts-me,\n      & .sts-ally { display:block; display:flex; color: var(--ink) !important; }
      /* later rule */
      &.ready { background:url("../art/example.webp"); }
      &::before { content:"&"; opacity:.5; }
      & { --label: "原画"; }
    }
  }
}
@keyframes unchanged { from { opacity:0; } to { opacity:1; } }`;
const flat = source.replace('#overlay .battle-stage.sts {', '')
  .replaceAll('& .sts-', '#overlay .battle-stage.sts .sts-')
  .replace('&.ready', '#overlay .battle-stage.sts.ready')
  .replace('&::before', '#overlay .battle-stage.sts::before')
  .replace('& { --label', '#overlay .battle-stage.sts { --label')
  .replace('    }\n  }\n}', '  }\n}');

describe('finite CSS component scopes', () => {
  it('round-trips rule order, selector lists, conditions, fallbacks, important, values and comments', () => {
    const result = expandComponentScopes(source, { from: 'example.css' });
    expect(facts(result)).toEqual(facts(flat));
    const comments = css => {
      const values = [];
      postcss.parse(css).walkComments(node => values.push(node.text));
      return values;
    };
    expect(comments(result)).toEqual(comments(source));
    expect(result).toContain('&"');
    expect(result).toContain('../art/example.webp');
    expect(expandComponentScopes(result)).toBe(result);
  });

  it('preserves flat CSS byte for byte, including keyframes and attribute ampersands', () => {
    const css = ':root { --a: 1; }\r\n[data-label="&"]::before { content: "&"; }\r\n'
      + '@-webkit-keyframes keep { 0%, 50% { opacity: 0; } to { opacity: 1; } }';
    expect(expandComponentScopes(css)).toBe(css);
  });

  it('leaves flat source-map annotations untouched without reading or parsing their maps', () => {
    for (const annotation of ['data:application/json;base64,e30=', 'missing-original.css.map']) {
      const css = `.flat { color: red; } /*# sourceMappingURL=${annotation} */`;
      expect(expandComponentScopes(css, { from:'assets/flat.css' })).toBe(css);
    }
  });

  it('keeps a single complex functional prefix without changing its selector-list specificity', async () => {
    const nested = ':is(#id, .a):where(.safe):has(> .child) { & .one, & .two {color:red} }';
    const expected = ':is(#id, .a):where(.safe):has(> .child) .one, :is(#id, .a):where(.safe):has(> .child) .two {color:red}';
    const options = { loader: 'css', target: 'chrome105', minify: true };
    expect((await transform(expandComponentScopes(nested), options)).code)
      .toBe((await transform(expected, options)).code);
  });

  it.each(['.a, #id', '.a::before', '.a:before', '.a:after', '.a:first-line', '.a:first-letter', ':is(.a::after, .b)', '.a:\\62 efore'])(
    'preserves an unknown parent and rejects it during strict plan auditing: %s', parent => {
      const css = `${parent} { & .child { color:red; } }`;
      expect(expandComponentScopes(css)).toBe(css);
      expect(() => expandComponentScopes(css, { from: 'unsafe.css', strict: true }))
        .toThrow(/Unsupported component scope/);
    },
  );

  it.each([
    '.a { color:red; & .b {color:blue} }',
    '.a { .b {color:red} }',
    '.a { &:is(&) {color:red} }',
    '.a { &div {color:red} }',
    '.a { @media (width > 1px) { & .b {color:red} } }',
    '.a { & .b { & .c {color:red} } }',
    '& .a {color:red}',
    '@nest .a & {color:red}',
    '@keyframes unsafe { from { & {opacity:0} } }',
  ])('passes existing native nesting through and rejects new unsupported scope plans: %s', css => {
    expect(expandComponentScopes(css)).toBe(css);
    expect(() => expandComponentScopes(css, { strict: true })).toThrow(/Unsupported component scope/);
  });

  it('does not partially mutate a plugin input if a later scope is invalid', async () => {
    const css = '.a { & .b { color:red } } .bad, #id { & .child { color:blue } }';
    const root = postcss.parse(css);
    await expect(postcss([componentScopesPlugin({ strict: true })]).process(root, { from: 'unsafe.css', map: false }))
      .rejects.toThrow(/exactly one selector/);
    expect(root.toString()).toBe(css);
  });

  it('expands a safe sibling without taking over existing mixed or multilevel nesting', async () => {
    const legacy = '.old { color:red; & .child {color:blue} }\n'
      + '.deep { & .middle { & .leaf {color:green} } }';
    const css = legacy + '\n.new { & .child {color:black} }';
    const expected = legacy + '\n.new .child {color:black}';
    expect(expandComponentScopes(css)).toBe(expected);
    expect((await postcss([componentScopesPlugin()]).process(css, { from: undefined })).css).toBe(expected);
  });

  it.each([false, true])('expands in the PostCSS/dev path with source maps=%s', async enabled => {
    const result = await postcss([componentScopesPlugin()]).process(source, {
      from: 'game/css/example.css', to: 'served.css', map: enabled ? { inline: false } : false,
    });
    expect(facts(result.css)).toEqual(facts(flat));
    expect(!!result.map).toBe(enabled);
    const oldBrowser = await transform(result.css, { loader: 'css', target: 'chrome105', minifySyntax: false });
    expect(oldBrowser.warnings).toEqual([]);
    expect(facts(oldBrowser.code).map(row => row[1]).some(selector => selector.startsWith('&'))).toBe(false);
  });

  it('the standalone expansion has no minification or source-map switch', () => {
    // Call this before an asset minifier can return early for debug/disabled modes.
    for (const build of [{ cssMinify:false }, { sourcemap:true }, { sourcemap:'hidden' }]) {
      const css = expandComponentScopes(source, { from:'runtime.css', ...build });
      expect(facts(css)).toEqual(facts(flat));
    }
  });
});
