import { afterEach, expect, it } from 'vitest';
import { readCompiledCssSource } from './helpers/css-source.js';
import { matchesCssSelector } from './helpers/css-match.js';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { compare, selectorSpecificity } from '@csstools/selector-specificity';

const css = name => postcss.parse(readCompiledCssSource(`game/css/${name}.css`));
const inventory = css('expedition-inventory');
const cards = css('card-state-motion');
const selection = css('selection-state-motion');
const cardFace = css('card-layout-selected');

afterEach(() => { document.body.replaceChildren(); document.body.className = ''; });

// Resolve just the conflicting declarations using the real host selectors and
// CSS specificity. jsdom's computed style does not implement the full cascade.
function winner(sheets, element, property, systemReduce = false) {
  const candidates = [];
  for (const sheet of sheets) sheet.walkRules(rule => {
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== 'atrule') continue;
      if (parent.name !== 'media') return;
      if (parent.params.includes('prefers-reduced-motion: reduce') && !systemReduce) return;
      if (parent.params.includes('prefers-reduced-motion: no-preference') && systemReduce) return;
    }
    const declarations = rule.nodes.filter(declaration => declaration.type === 'decl'
      && (declaration.prop === property || (property === 'transition-property' && declaration.prop === 'transition')));
    if (!declarations.length) return;
    const selectors = selectorParser().astSync(rule.selector).nodes;
    for (const selector of selectors) {
      // Exercise the authored hover state without synthesising browser events.
      const target = selector.toString().replace(/:hover\b/g, '');
      if (!matchesCssSelector(element, target)) continue;
      for (const declaration of declarations) {
        candidates.push({ value: declaration.value, important: !!declaration.important,
          specificity: selectorSpecificity(selector), order: candidates.length });
      }
    }
  });
  return candidates.sort((a, b) => Number(a.important) - Number(b.important)
    || compare(a.specificity, b.specificity) || a.order - b.order).at(-1)?.value;
}

function mount() {
  document.body.innerHTML = '<div id="overlay"><div class="card bag-page"><div class="bag-v2"><nav class="bag-rail" data-selection-motion="zone"><button class="bag-rz on">背包</button></nav><div class="bag-tools" data-selection-motion="filter"><button class="bag-pill on">全部</button></div><button class="bag-tile card-face" data-card-state-motion="true">卡牌</button></div></div></div>';
  return { tile: document.querySelector('.bag-tile'), controls: [...document.querySelectorAll('.bag-rz,.bag-pill')] };
}

it('keeps CSS transform transitions off motion-owned bag cards regardless of sheet order', () => {
  const { tile } = mount();
  for (const sheets of [[cards, inventory], [inventory, cards]]) {
    const value = winner(sheets, tile, 'transition-property');
    expect(value).toBeDefined();
    expect(value).not.toContain('transform');
  }
});

it('lets the selection plate own movement instead of the inventory hover lift', () => {
  const { controls } = mount();
  for (const sheets of [[selection, inventory], [inventory, selection]]) for (const control of controls) {
    expect(winner(sheets, control, 'transform')).toBe('none');
    expect(winner(sheets, control, 'transition-property')).not.toContain('transform');
  }
});

it.each(['setting', 'system'])('removes inventory transitions and hover movement for the %s reduced-motion preference', preference => {
  const { controls } = mount();
  document.body.classList.toggle('reduce-motion', preference === 'setting');
  for (const sheets of [[selection, inventory], [inventory, selection]]) for (const control of controls) {
    expect(winner(sheets, control, 'transition-property', preference === 'system')).toBe('none');
    expect(winner(sheets, control, 'transform', preference === 'system')).toBe('none');
  }
});

it.each(['is-temporary', 'is-transforming', 'is-temporary is-transforming'])(
  'stops the %s aura for both reduced-motion preferences while preserving its static identity', state => {
    document.body.innerHTML = `<div class="hs-card ${state}" data-card-layout="split"><span class="hsc-state-aura"></span></div>`;
    const aura = document.querySelector('.hsc-state-aura');
    const material = (systemReduce = false) => ['background', 'opacity', 'filter']
      .map(property => winner([cardFace], aura, property, systemReduce));
    const still = material();
    expect(winner([cardFace], aura, 'animation')).toContain('card-state-breathe');
    document.body.classList.add('reduce-motion');
    expect(winner([cardFace], aura, 'animation')).toBe('none');
    expect(material()).toEqual(still);
    document.body.classList.remove('reduce-motion');
    expect(winner([cardFace], aura, 'animation', true)).toBe('none');
    expect(material(true)).toEqual(still);
  }
);
