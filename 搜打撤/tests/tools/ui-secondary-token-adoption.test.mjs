import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

const load = async name => postcss.parse(await readFile(`game/css/${name}.css`, 'utf8'));
const tokens = await load('secondary-ui-tokens');
const shop = await load('expedition-shop');
const battle = await load('battle-secondary-overlay');
function values(root, selector) {
  const result = {};
  root.walkRules(selector, rule => rule.walkDecls(decl => { result[decl.prop] = decl.value; }));
  return result;
}
const palette = {};
tokens.walkDecls(decl => { palette[decl.prop] = decl.value; });
const resolve = value => value.startsWith('var(') ? palette[value.slice(4, -1)] : value;
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels.reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
}
function contrast(a, b) {
  const [low, high] = [luminance(resolve(a)), luminance(resolve(b))].sort((x, y) => x - y);
  return (high + .05) / (low + .05);
}

test('merchant explicitly consumes shared text and boundary roles, retaining warm currency', () => {
  assert.ok(tokens.nodes.some(node => node.selector?.includes('.shop-pg.sc-shop')));
  const root = values(shop, '#overlay .shop-pg.sc-shop');
  assert.equal(root['--shop-ink'], 'var(--ui-ink)');
  assert.equal(root['--shop-muted'], 'var(--ui-muted)');
  assert.equal(root['--shop-line'], 'var(--ui-line)');
  assert.equal(root['--shop-gold'], '#e0c98c');
  assert.match(root['background-image'], /shop-cardstyle-approved-1011.webp/);
});

test('merchant return pairs readable foreground and background for normal and hover states', () => {
  const normal = values(shop, '#overlay .shop-pg.sc-shop .shop-back');
  const hover = values(shop, '#overlay .shop-pg.sc-shop .shop-back:hover:not(:disabled)');
  for (const state of [normal, hover]) assert.ok(contrast(state.color, state.background) >= 4.5);
  shop.walkRules(rule => {
    assert.ok(!(rule.selector.includes(':is(.shop-back,') && rule.selector.includes(':hover')),
      'Do not restore the shared dark-background hover without its paired foreground');
  });
});

test('battle dialog uses semantic text and action tokens without resizing card art', () => {
  const prefix = 'body #overlay .battle-decision.battle-decision-unified.battle-secondary-panel';
  assert.equal(values(battle, `${prefix} .battle-decision-head h3`)['font-size'], 'var(--ui-text-dialog-title)');
  const action = values(battle, `${prefix} .battle-decision-actions .ov-btn`);
  assert.equal(action['font-size'], 'var(--ui-text-body)');
  assert.equal(action['min-height'], 'var(--ui-control-compact)');
  assert.equal(values(battle, `${prefix} .battle-discover-slot`).width, '240px');
});
