import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { beginnerGuideHTML, beginnerGuidePageCount } from '../game/src/ui/beginner-guide.js';
import guide from '../game/data/beginner-guide.json';
import { readCssSource } from './helpers/css-source.js';
const ast = postcss.parse(readCssSource(resolve('game/css/beginner-guide.css'), 'utf8'));
function values(selector) {
  const result = {};
  ast.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(d => { result[d.prop] = d.value; }); });
  return result;
}
describe('guide reading and disclosure layout', () => {
  it('keeps body readable at the shared game canvas scale', () => {
    const body = values('.beginner-guide .bg-step p');
    const heading = values('.beginner-guide .bg-step h3');
    expect(parseFloat(body['font-size'])).toBeGreaterThanOrEqual(18);
    expect(parseFloat(body['line-height'])).toBeGreaterThanOrEqual(1.7);
    expect(parseFloat(heading['font-size'])).toBeGreaterThan(parseFloat(body['font-size']));
    expect(values('.beginner-guide .bg-page')['overflow-y']).toBe('auto');
    expect(values('.beginner-guide .bg-pager').flex).toBe('none');
  });
  it('keeps expandable rules in the reading column rather than the tip label', () => {
    const root = document.createElement('div');
    root.innerHTML = beginnerGuideHTML(0);
    const details = root.querySelector('details.bg-more');
    expect(details.parentElement.classList.contains('bg-copy')).toBe(true);
    expect(details.closest('.bg-tip')).toBeNull();
    expect(details.querySelector('summary').textContent).toBe('档位与整备');
    expect(values('.beginner-guide .bg-copy')['min-width']).toBe('0');
  });
  it('retains all six page contents and the real expandable preparation rules', () => {
    expect(beginnerGuidePageCount()).toBe(6);
    for (let page = 0; page < 6; page++) {
      const root = document.createElement('div');
      root.innerHTML = beginnerGuideHTML(page);
      expect(root.querySelectorAll('.bg-step').length).toBeGreaterThan(0);
      expect(root.querySelector('.bg-pager')).not.toBeNull();
      const details = root.querySelector('details.bg-more');
      expect(details.querySelector('summary').textContent).toBe(guide.pages[page].moreTitle);
      for (const note of guide.pages[page].notes) expect(details.textContent).toContain(note.text);
      expect(details.textContent.length).toBeGreaterThan(50);
    }
  });
});
