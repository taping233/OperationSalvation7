import postcss from 'postcss';
import { expect, it } from 'vitest';
import { readCssSource } from './helpers/css-source.js';

const declarations = (file, selector) => {
  const result = {};
  postcss.parse(readCssSource(file, 'utf8')).walkRules(rule => {
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
  const file = 'game/css/room-rewards.css', host = 'body #overlay .card .room-reward';
  expect(declarations(file, `${host}.reward-replica`)).toMatchObject({ height:'100%', 'min-height':'0', overflow:'hidden' });
  expect(declarations(file, `${host} .reward-main`)).toMatchObject({ 'grid-row':'2', 'min-height':'0', overflow:'hidden' });
  expect(declarations(file, `${host} .reward-stage`)).toMatchObject({ 'min-height':'0', overflow:'auto' });
  expect(declarations(file, `${host} .reward-foot.room-footer`)).toMatchObject({display:'grid','grid-template-columns':'minmax(0,1fr) auto'});
  expect(declarations(file, `${host} .loot-actions .reward-claim`)['min-width']).toBe('160px');
});
it('overview and standalone cards share the same bounded reward frame', () => {
  expect(declarations('game/css/room-rewards.css', 'body #overlay .card .room-reward.reward-replica')).toMatchObject({ height:'100%','max-height':'100%',overflow:'hidden' });
  expect(declarations('game/css/chest-reward-overview.css', 'body #overlay .card .cqo-frame .cqp-scroll')).toMatchObject({flex:'1','min-height':'0',overflow:'hidden'});
});
