import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { beginnerGuideHTML, beginnerGuidePageCount } from '../game/src/ui/beginner-guide.js';
const ast = postcss.parse(readFileSync(resolve('game/css/beginner-guide.css'), 'utf8'));
function values(selector) {
  const result = {};
  ast.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(d => { result[d.prop] = d.value; }); });
  return result;
}
describe('guide reading and disclosure layout', () => {
  it('keeps body readable at the shared game canvas scale', () => {
    expect(values('.beginner-guide .bg-step p')['font-size']).toBe('22px');
    expect(values('.beginner-guide .bg-step h3')['font-size']).toBe('24px');
    expect(values('.beginner-guide .bg-copy')['overflow-y']).toBe('auto');
    expect(values('.beginner-guide .bg-pager').flex).toBe('none');
  });
  it('does not squeeze the preparation disclosure into the 32px tip label column', () => {
    expect(values('.beginner-guide details.bg-tip').display).toBe('block');
    expect(values('.beginner-guide details.bg-tip > summary').width).toBe('auto');
    expect(values('.beginner-guide details.bg-tip > summary')['min-height']).toBe('54px');
  });
  it('retains all six page contents and the real expandable preparation rules', () => {
    expect(beginnerGuidePageCount()).toBe(6);
    for (let page = 0; page < 6; page++) {
      const root = document.createElement('div');
      root.innerHTML = beginnerGuideHTML(page);
      expect(root.querySelectorAll('.bg-step').length).toBeGreaterThan(0);
      expect(root.querySelector('.bg-pager')).not.toBeNull();
      if (page === 4) {
        expect(root.querySelector('details.bg-tip summary').textContent).toBe('首脑前准备');
        expect(root.querySelector('details.bg-tip').textContent.length).toBeGreaterThan(50);
      }
    }
  });
});
