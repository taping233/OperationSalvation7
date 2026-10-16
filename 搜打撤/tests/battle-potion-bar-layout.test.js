import { readFileSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Parse every linked sheet in actual load order, including the late runtime sheet.
// jsdom has no layout engine, so this checks the relevant declaration cascade only.
const index = new DOMParser().parseFromString(readFileSync('game/index.html', 'utf8'), 'text/html');
const stylesheetPaths = [...index.querySelectorAll('link[rel="stylesheet"]')]
  .map(link => path.join('game', link.getAttribute('href')));
const motionLoader = readFileSync('game/src/ui/motion-transitions.js', 'utf8');
const motionSheet = /new URL\('([^']+\.css)'/.exec(motionLoader)?.[1];
if (!motionSheet) throw new Error('Runtime motion stylesheet was not resolved');
stylesheetPaths.push(path.normalize(path.join('game/src/ui', motionSheet)));
function loadSheet(file, ancestors = []) {
  if (ancestors.includes(file)) throw new Error(`Cyclic stylesheet import: ${file}`);
  const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
  const imported = [];
  let sawRule = false;
  for (const node of root.nodes) {
    if (node.type === 'rule') sawRule = true;
    if (node.type !== 'atrule' || node.name !== 'import') continue;
    const target = /^(?:url\(\s*['"]?([^'")]+)['"]?\s*\)|['"]([^'"]+)['"])\s*$/.exec(node.params);
    if (!target || sawRule) throw new Error(`Stylesheet import needs explicit coverage: ${file} ${node.params}`);
    imported.push(...loadSheet(path.normalize(path.join(path.dirname(file), target[1] || target[2])), [...ancestors, file]));
  }
  return [...imported, { file, root }];
}
const sheets = stylesheetPaths.flatMap(file => loadSheet(file));
const barSelector = '#overlay .battle-stage.sts>.bt-potions';
const tipSelector = '#overlay .battle-stage.sts .bt-potion-tip';

function resolvedSelectors(rule) {
  let parent = rule.parent;
  while (parent && parent.type !== 'root' && parent.type !== 'rule') parent = parent.parent;
  if (!parent || parent.type === 'root') return rule.selectors;
  return resolvedSelectors(parent).flatMap(outer => rule.selectors.map(inner =>
    inner.includes('&') ? inner.replaceAll('&', outer) : `${outer} ${inner}`));
}

function specificity(selector) {
  // All matching position/transform selectors are simple in the current sheets.
  // Fail explicitly if that changes instead of silently misranking a functional pseudo.
  if (/[:&|]/.test(selector)) throw new Error(`Unsupported matching cascade selector: ${selector}`);
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]/g) || []).length;
  const types = selector.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|\*/g, '').match(/[a-zA-Z][\w-]*/g)?.length || 0;
  return [ids, classes, types];
}

function cascade(element, property, { withoutReset = false } = {}) {
  const matches = [];
  let order = 0;
  for (const { file, root } of sheets) {
    root.walkDecls(property, declaration => {
      order++;
      const rule = declaration.parent;
      if (rule.type !== 'rule') return;
      let ancestor = rule.parent;
      while (ancestor && ancestor.type !== 'root') {
        // Animation frames are not ordinary cascade declarations. There are no
        // conditional rules matching these properties; refuse to ignore a new one.
        if (ancestor.type === 'atrule' && /keyframes$/i.test(ancestor.name)) return;
        ancestor = ancestor.parent;
      }
      for (const selector of resolvedSelectors(rule)) {
        if (!element.matches(selector)) continue;
        if (rule.parent.type !== 'root') {
          throw new Error(`Conditional/nested matching cascade needs explicit coverage: ${file}:${rule.source.start.line} ${selector}`);
        }
        if (withoutReset && file === 'game/css/battle-stage.css'
          && [barSelector, tipSelector].includes(selector) && property === 'transform') continue;
        matches.push({ file, selector, value: declaration.value, weight: [Number(!!declaration.important), ...specificity(selector), order] });
      }
    });
  }
  matches.sort((a, b) => {
    for (let i = 0; i < a.weight.length; i++) if (a.weight[i] !== b.weight[i]) return a.weight[i] - b.weight[i];
    return 0;
  });
  return { matches, winner: matches.at(-1) };
}

beforeEach(() => {
  document.body.innerHTML = '<div id="overlay" class="room-view"><div class="card room battle"><div id="ovBody"><div class="battle-stage sts"><div class="bt-potions"><span class="bt-potions-label">道具</span><div class="bt-potion" role="button">恢复药水</div><div class="bt-potion-tip">回复生命并获得能量</div></div></div></div></div></div>';
});
afterEach(() => { document.body.innerHTML = ''; });

describe('battle potion left-anchor cascade', () => {
  it('overrides the original centered bar transform in the complete loaded cascade', () => {
    const bar = document.querySelector('.bt-potions');
    const transform = cascade(bar, 'transform');
    expect(transform.matches).toContainEqual(expect.objectContaining({ file: 'game/css/battle.css', value: 'translateX(-50%)' }));
    expect(transform.winner).toMatchObject({ file: 'game/css/battle-stage.css', selector: barSelector, value: 'none' });
    expect(cascade(bar, 'left').winner.value).toBe('62px');
    expect(cascade(bar, 'max-width').winner.value).toBe('420px');
  });

  it('keeps the visible tooltip anchored to the bar instead of half its own width left', () => {
    const tip = document.querySelector('.bt-potion-tip');
    expect(cascade(tip, 'transform').matches).toContainEqual(expect.objectContaining({ file: 'game/css/battle.css', value: 'translateX(-50%)' }));
    expect(cascade(tip, 'transform').winner).toMatchObject({ file: 'game/css/battle-stage.css', selector: tipSelector, value: 'none' });
    expect(cascade(tip, 'left').winner.value).toBe('0');
  });

  it('retains the more specific reset when the later runtime hidden-tip rule matches', () => {
    const tip = document.querySelector('.bt-potion-tip');
    tip.hidden = true;
    const transform = cascade(tip, 'transform');
    expect(transform.matches).toContainEqual(expect.objectContaining({ file: 'game/css/motion-transitions.css', value: 'translateY(4px)' }));
    expect(transform.winner).toMatchObject({ file: 'game/css/battle-stage.css', selector: tipSelector, value: 'none' });
    expect(cascade(tip, 'display').winner.value).toBe('none');
  });

  it('reproduces both original horizontal offsets when only the canonical resets are removed', () => {
    for (const selector of ['.bt-potions', '.bt-potion-tip']) {
      expect(cascade(document.querySelector(selector), 'transform', { withoutReset: true }).winner)
        .toMatchObject({ file: 'game/css/battle.css', value: 'translateX(-50%)' });
    }
  });
});
