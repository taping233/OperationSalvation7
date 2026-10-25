// @vitest-environment node
import { describe, expect, it } from 'vitest';
import selectorParser from 'postcss-selector-parser';
import { selectorSpecificity } from '@csstools/selector-specificity';
import { createCssReachability } from './helpers/css-reachability.js';

const dead = 'fixture-retired', otherDead = 'fixture-other-retired';
const { required, retire } = createCssReachability([dead, otherDead]);
const requiresDeadDOM = selector => selectorParser().astSync(selector).nodes
  .some(branch => branch.nodes.flatMap(required).length > 0);

describe('retired DOM selector proof', () => {
  it('ignores exclusions and retains a reachable alternative in is, where and has', () => {
    for (const selector of [
      `:not(.${dead})`, `:not(:is(.${dead}, .${otherDead}))`,
      `:is(.fixture-live, .${dead})`, `:where(.${dead}, .fixture-live)`,
      `:has(> .${dead}, > .fixture-live)`, `:is(:not(.${dead}), .${otherDead})`,
    ]) expect(requiresDeadDOM(selector), selector).toBe(false);
  });

  it('requires a missing positive node when every alternative needs retired DOM', () => {
    for (const selector of [
      `.${dead} .fixture-live`, `:has(> .${dead})`,
      `:is(.${dead}, .${otherDead})`, `:where(.${dead}, :has(.${otherDead}))`,
    ]) expect(requiresDeadDOM(selector), selector).toBe(true);
  });

  it('preserves is/has/not interiors, live declaration order and important flags', () => {
    const source = `/*before*/.${dead}{color:red!important;/*inside*/}`
      + `.fixture-live,.${dead}{color:blue;display:grid}`
      + `.fixture-live:is(#fixture-live,.${dead}){border:1px solid;}`
      + `.fixture-live:has(.fixture-child,.${dead}):not(.${otherDead}){opacity:.7!important;}`;
    const output = retire(source, 'fixture.css').after;
    expect(output).toContain('/*before*//*inside*/');
    expect(output).toContain('.fixture-live{color:blue;display:grid}');
    expect(output).toContain(`:is(#fixture-live,.${dead})`);
    expect(output).toContain(`:has(.fixture-child,.${dead}):not(.${otherDead})`);
    expect(output).toContain('opacity:.7!important;');
    expect(output).not.toContain('color:red!important');
  });

  it('keeps surviving native scopes instead of expanding them back into flat CSS', () => {
    const source = `.fixture-scope{& .fixture-live{color:blue}& .${dead}{color:red}}`;
    expect(retire(source, 'fixture.css').after)
      .toBe('.fixture-scope{& .fixture-live{color:blue}}');
  });

  it('does not lower the specificity of live alternatives inside is or has', () => {
    const live = `.fixture-live:is(#fixture-high,.${dead}):has(.fixture-child,.${otherDead})`;
    const source = `#${dead},${live}{color:blue}`;
    const output = retire(source, 'fixture.css').after;
    const actual = selectorParser().astSync(output.slice(0, output.indexOf('{'))).first;
    expect(actual.toString()).toBe(live);
    expect(selectorSpecificity(actual)).toEqual(selectorSpecificity(selectorParser().astSync(live).first));
  });

  it('retains conditional scope, repeated fallbacks, declaration priority and unknown pseudo functions', () => {
    const source = `@media(min-width:1px){.fixture-live,.${dead}{display:-webkit-box;display:flex!important;color:blue}}`
      + `.fixture-live:nth-child(2n of .${dead}){opacity:.5}`;
    const output = retire(source, 'fixture.css').after;
    expect(output).toContain('@media(min-width:1px){.fixture-live{display:-webkit-box;display:flex!important;color:blue}}');
    expect(output).toContain(`:nth-child(2n of .${dead})`);
  });
});
