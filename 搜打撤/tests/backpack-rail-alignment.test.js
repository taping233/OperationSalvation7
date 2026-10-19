import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { pageHTML } from '../game/src/hub/game.bag.view2.js';

const css = postcss.parse(readFileSync('game/css/expedition-inventory.css', 'utf8'));
const feedback = postcss.parse(readFileSync('game/css/feedback-1018.css', 'utf8'));
const rail = 'body #overlay .card.bag-page .bag-v2 .bag-rail';
const exit = 'body #overlay#overlay#overlay .card.bag-page .bag-v2 .bag-rail > .archive-back';
const declarations = selector => {
  const result = {};
  css.walkRules(selector, rule => rule.walkDecls(({ prop, value }) => { result[prop] = value; }));
  return result;
};

describe('backpack rail owns its in-flow exit geometry', () => {
  it('keeps the exit as the first rail child with its original action', () => {
    window.SDT = { UI: { helpBtn: () => '' } };
    const template = document.createElement('template');
    template.innerHTML = pageHTML({ bagZone:'bag', bagFilter:'all', cap:16, baseCap:16,
      total:0, safeUsedN:0, sCap:2, pkN:0, used:0, coins:0, fragments:0, tiles:[] });
    const nav = template.content.querySelector('.bag-rail');
    expect(nav.firstElementChild.matches('button.archive-back[data-act="closeBag"]')).toBe(true);
    expect(nav.firstElementChild.getAttribute('aria-label')).toBe('关闭背包');
    expect(nav.querySelectorAll('[data-act="bagZone"]')).toHaveLength(3);
  });

  it('overrides the shared three-ID absolute positioning only inside the backpack rail', () => {
    const shared = readFileSync('game/css/archive-back.css', 'utf8');
    expect(shared).toContain('#overlay#overlay#overlay');
    expect(declarations(exit)).toMatchObject({ position:'static', inset:'auto', flex:'none',
      margin:'0 0 20px', width:'64px', height:'64px' });
    // Equal ID count plus the scoped classes outranks the shared .archive-back rule,
    // regardless of which stylesheet is loaded first. Actual geometry needs browser QA.
    expect(exit.match(/#overlay/g)).toHaveLength(3);
    expect(exit).toContain('.card.bag-page .bag-v2 .bag-rail > .archive-back');
  });

  it('removes the old floating-button gap and keeps every control within the rail width', () => {
    expect(declarations(rail)).toMatchObject({ display:'flex', 'flex-direction':'column',
      'align-items':'center', gap:'16px', padding:'20px 10px', 'box-sizing':'border-box' });
    const shell = declarations('body #overlay .card.bag-page .bag-v2 .bag-shell');
    const zone = declarations('body #overlay .card.bag-page .bag-v2 .bag-rz');
    expect(shell['grid-template-columns']).toBe('112px minmax(0, 1fr)');
    const innerWidth = 112 - 2 * 10 - 2; // rail padding and 1px borders
    expect(parseFloat(zone.width)).toBeLessThanOrEqual(innerWidth);
    expect(parseFloat(declarations(exit).width)).toBeLessThanOrEqual(innerWidth);
    const duplicate = [];
    feedback.walkRules(rule => { if (rule.selector.includes('.bag-rail')) duplicate.push(rule.selector); });
    expect(duplicate).toEqual([]);
  });
});
