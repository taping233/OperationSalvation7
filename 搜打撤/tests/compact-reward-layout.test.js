import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { expect, it } from 'vitest';

const declarations = (file, selector) => {
  const result = {};
  postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => {
    if (rule.selectors.includes(selector)) rule.walkDecls(decl => { result[decl.prop] = decl.value; });
  });
  return result;
};
it('map and reward share a shrinkable viewport that reserves the expedition toolbar without focus scrolling', () => {
  expect(declarations('game/css/base.css', '#app')).toMatchObject({ display:'flex', 'flex-direction':'column', height:'100%' });
  // Non-scrollable overflow no longer zeroes the flex automatic minimum size.
  // An explicit floor lets the canvas shrink above the sidebar in both states.
  expect(declarations('game/css/overlays.css', '#viewport')).toMatchObject({ flex:'1', 'min-height':'0', overflow:'clip' });
});
it('compact picker reserves toolbar and footer while its card region can shrink and scroll', () => {
  const file = 'game/css/chest-reward-overview.css';
  const host = 'body #overlay .card .cqo-frame .cqp-dialog';
  expect(declarations(file, `${host}:has(.reward-compact)`)).toMatchObject({ 'max-height':'100%', flex:'none' });
  expect(declarations(file, `${host} .reward-compact`)).toMatchObject({ height:'0', flex:'1 1 0', 'grid-template-rows':'auto minmax(0,1fr) auto' });
  expect(declarations(file, `${host} .reward-stage`)).toMatchObject({ 'min-height':'0', overflow:'auto' });
  expect(declarations(file, `${host} .reward-compact .reward-objects`)['align-content']).toBe('safe center');
  expect(declarations(file, `${host} .reward-compact .reward-foot`)).toMatchObject({ 'flex-wrap':'wrap' });
  expect(declarations(file, `${host} .reward-compact .loot-actions .reward-claim`)['min-width']).toBe('160px');
});
it('standalone compact rewards retain an explicit bounded height rather than the nested flex slot', () => {
  expect(declarations('game/css/chest-reward-overview.css', 'body #overlay .card:has(.reward-standalone-picker) .reward-standalone-picker.reward-compact')).toMatchObject({ height:'min(720px,calc(100% - 64px))', flex:'0 1 auto' });
});
