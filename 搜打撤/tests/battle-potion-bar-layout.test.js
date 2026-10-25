import { readFileSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readCompiledCssSource } from './helpers/css-source.js';
import { matchesCssSelector } from './helpers/css-match.js';
import selectorParser from 'postcss-selector-parser';
import { selectorSpecificity } from '@csstools/selector-specificity';

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
  file = file.replaceAll('\\', '/');
  if (ancestors.includes(file)) throw new Error(`Cyclic stylesheet import: ${file}`);
  const root = postcss.parse(readCompiledCssSource(file), { from: file });
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
const barSelector = '#overlay .battle-stage.sts>.sts-topbar>.bt-potions';


function resolvedSelectors(rule) {
  let parent = rule.parent;
  while (parent && parent.type !== 'root' && parent.type !== 'rule') parent = parent.parent;
  if (!parent || parent.type === 'root') return rule.selectors;
  return resolvedSelectors(parent).flatMap(outer => rule.selectors.map(inner =>
    inner.includes('&') ? inner.replaceAll('&', outer) : `${outer} ${inner}`));
}

function specificity(selector) {
  const {a,b,c}=selectorSpecificity(selectorParser().astSync(selector).first);
  return [a,b,c];
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
        // Pseudo-elements style generated boxes, never the element itself.
        if (/::[\w-]+/.test(selector)) continue;
        if (!matchesCssSelector(element, selectorParser().astSync(selector).first)) continue;
        if (rule.parent.type !== 'root') {
          throw new Error(`Conditional/nested matching cascade needs explicit coverage: ${file}:${rule.source.start.line} ${selector}`);
        }
        if (withoutReset && file === 'game/css/battle-stage.css'
          && selector.replaceAll(/\s*>\s*/g,'>')===barSelector && property === 'transform') continue;
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
  document.body.innerHTML = '<div id="overlay" class="room-view"><div class="card room battle"><div id="ovBody"><div class="battle-stage sts"><div class="sts-topbar"><div class="bt-potions"><span class="bt-potions-label">道具</span><div class="bt-potion" role="button">恢复药水</div></div></div></div></div></div></div>';
});
afterEach(() => { document.body.innerHTML = ''; });

describe('battle potion left-anchor cascade', () => {
  it('keeps count and label light on the dark item surfaces', () => {
    const potion = document.querySelector('.bt-potion');
    potion.innerHTML += '<span class="bt-potion-n">×3</span>';

    for (const selector of ['.bt-potion-n', '.bt-potions-label']) {
      expect(cascade(document.querySelector(selector), 'color').winner).toMatchObject({file:'game/css/battle-stage.css',value:'#fff'});
    }
    const label = document.querySelector('.bt-potions-label');
    expect(cascade(label, 'background').winner.value).toBe('#090c10');
    expect(cascade(label, 'text-shadow').winner.value).toBe('none');
  });

  it('overrides the original centered bar transform in the complete loaded cascade', () => {
    const bar = document.querySelector('.bt-potions');
    const transform = cascade(bar, 'transform');
    expect(transform.matches).toContainEqual(expect.objectContaining({ file: 'game/css/battle.css', value: 'translateX(-50%)' }));
    expect(transform.winner).toMatchObject({ file: 'game/css/battle-stage.css', value: 'none' });
    expect(cascade(bar, 'left').winner.value).toBe('0');
    expect(cascade(bar, 'position').winner.value).toBe('relative');
    expect(cascade(bar, 'grid-row').winner.value).toBe('2');
    expect(cascade(bar, 'max-width').winner.value).toBe('420px');
  });





  it('reproduces the original bar offset when its canonical reset is removed', () => {
    for (const selector of ['.bt-potions']) {
      expect(cascade(document.querySelector(selector), 'transform', { withoutReset: true }).winner)
        .toMatchObject({ file: 'game/css/battle.css', value: 'translateX(-50%)' });
    }
  });
});
