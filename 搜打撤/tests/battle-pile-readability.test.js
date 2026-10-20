import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ entries:new Map(), snapshot:null }));
vi.mock('../game/src/battle/core/battle.core.js', () => ({
  commands: {
    closeBag:vi.fn(), useItem:vi.fn(), closeGrave:vi.fn(), closeDeckView:vi.fn(),
    selectDeckCard:vi.fn(), confirmDeck:vi.fn(), cancelDeck:vi.fn(),
  },
  getSnapshot:() => fixture.snapshot,
  AFFIX_META:{}, R:() => ({ battleEnergy:2 }),
  findEffectiveCard:uid => fixture.entries.get(uid),
}));
const actions = new Map();
const UI = {
  el:{}, act:(name, action) => actions.set(name, action), refresh() {},
  showOverlay(_title, html) { this.el.ovBody.innerHTML = html; },
};
window.SDT = { UI, Cards:{ cardHTML:card => `<div class="hs-card" data-card-id="${card.id}">${card.name}</div>` } };
const { renderDeckPileView, renderGrave } = await import('../game/src/battle/view/battle.overlays.js');

const source = readFileSync('game/css/battle-hand-overhaul.css', 'utf8');
const css = postcss.parse(source);
const scope = 'body #overlay .battle-decision[data-decision-kind="pile"]';
const shell = 'body #overlay .card:has(.battle-decision[data-decision-kind="pile"])';
function values(selector, narrow = false) {
  const result = {};
  css.walkRules(rule => {
    if (!rule.selector.split(',').map(value => value.trim()).includes(selector)) return;
    const inNarrowRule = rule.parent.type === 'atrule' && rule.parent.params === '(max-width:900px)';
    if (inNarrowRule !== narrow) return;
    rule.walkDecls(declaration => { result[declaration.prop] = declaration.value; });
  });
  return result;
}

beforeEach(() => {
  actions.clear(); fixture.entries.clear();
  document.body.innerHTML = '<div id="overlay"><div class="card"><div id="ovBody"></div></div></div>';
  UI.el.ovBody = document.getElementById('ovBody');
  const first = { id:'pile-short', name:'短规则牌', type:'武术', cost:1, desc:'造成 2 点攻击伤害。' };
  const second = { id:'pile-long', name:'长规则牌', type:'装备', cost:2, desc:`对战开始时：${'完整规则需要逐行读完。\n'.repeat(90)}最后一行也必须保留。` };
  fixture.entries.set('first', { uid:'first', card:first });
  fixture.entries.set('duplicate', { uid:'duplicate', card:first });
  fixture.entries.set('second', { uid:'second', card:second });
  fixture.snapshot = {
    battleToken:1, mode:'boss', opts:{ isBoss:true }, turn:1, energy:2, maxEnergy:2,
    drawPile:['first', 'duplicate', 'second'], consumedPile:['first', 'duplicate', 'second'], grave:[],
  };
});

describe('shared deck and consumed-pile reading surface', () => {
  it('limits the larger shell and readable typography to pile decisions', () => {
    const start = source.indexOf('/* 牌库与消耗牌共用阅读尺寸');
    const end = source.indexOf('body #overlay .battle-decision[data-decision-kind="bag"]', start);
    const patch = postcss.parse(source.slice(start, end));
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    patch.walkRules(rule => expect(rule.selector).toContain('[data-decision-kind="pile"]'));
    expect(values(shell)).toMatchObject({ width:'min(1680px,94%)', height:'94%', 'max-width':'94%', 'max-height':'94%', 'min-width':'0' });
    expect(values(`${scope} .battle-decision-head h3`)['font-size']).toBe('34px');
    expect(values(`${scope} .battle-decision-inspect-rules`)['font-size']).toBe('var(--card-copy-size,24px)');
    expect(24 * 1188 / 1920).toBeGreaterThan(14);
    expect(parseFloat(values(`${scope} .battle-decision-actions .ov-btn`)['min-height']) * 1188 / 1920).toBeGreaterThan(36);
  });

  it('fits exactly three 320px card tracks beside a readable rules column at the approved layout', () => {
    expect(values(`${scope} .battle-pile-layout`)).toMatchObject({ 'grid-template-columns':'minmax(0,1fr) minmax(400px,30%)', gap:'32px' });
    expect(values(`${scope} .bt-gy-list`)).toMatchObject({ 'grid-template-columns':'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap:'28px', overflow:'visible' });
    expect(values(`${scope} .battle-pile-card`)).toMatchObject({ width:'320px', 'max-width':'100%', 'min-width':'0', padding:'0' });
    expect(values(`${scope} .battle-pile-card .hs-card`)).toMatchObject({ width:'100%', 'max-width':'100%', 'font-size':'32px' });
    const innerWidth = 1680 - 2 - 60 - 17;
    const listWidth = innerWidth - Math.max(400, innerWidth * .3) - 32;
    expect(3 * 320 + 2 * 28).toBeLessThanOrEqual(listWidth);
    expect(4 * 320 + 3 * 28).toBeGreaterThan(listWidth);
  });

  it('keeps long rules scrollable in the middle and gives keyboard-focused cards safe scroll margins', () => {
    expect(values(scope)).toMatchObject({ flex:'1 1 auto', height:'100%', 'max-height':'none' });
    expect(values(`${scope} .battle-decision-content`)).toMatchObject({ flex:'1 1 auto', overflow:'auto', 'scroll-padding':'16px', 'min-width':'0' });
    expect(values(`${scope} .battle-decision-inspect`)).toMatchObject({
      'max-height':'calc(var(--game-layout-height,100vh) * .94 - 332px)', overflow:'auto', 'overflow-wrap':'anywhere', 'scroll-padding':'12px',
    });
    expect(values(`${scope} .battle-pile-card`)['scroll-margin']).toBe('16px');
    expect(values(`${scope} .battle-decision-inspect-rules`)['overflow-wrap']).toBe('anywhere');
    const rule = values(`${scope} .battle-decision-inspect-rules`);
    expect(rule['line-clamp']).toBeUndefined(); expect(rule['-webkit-line-clamp']).toBeUndefined();
  });

  it('removes the rules-column minimum and nested scrolling in narrow windows', () => {
    expect(values(`${scope} .battle-pile-layout`, true)['grid-template-columns']).toBe('minmax(0,1fr)');
    expect(values(`${scope} .battle-decision-inspect`, true)).toMatchObject({ position:'static', 'max-height':'none', overflow:'visible' });
    expect(values(`${scope} .battle-decision-actions .ov-btn`, true)).toMatchObject({ 'min-width':'0', width:'100%' });
    expect(values(`${scope} .battle-decision-head`)['flex-wrap']).toBe('wrap');
    expect(values(`${scope} .battle-decision-head > span`)['white-space']).toBe('normal');
  });

  it.each([
    ['deck', renderDeckPileView, 'btDeckBack'],
    ['grave', renderGrave, 'btGraveBack'],
  ])('preserves %s grouping, full text, focused inspection and the fixed return action', (_kind, render, backAction) => {
    const before = JSON.stringify(fixture.snapshot);
    render(fixture.snapshot);
    const root = UI.el.ovBody.querySelector('.battle-decision[data-decision-kind="pile"]');
    const cards = [...root.querySelectorAll('.battle-pile-card')];
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('.bt-count').textContent).toBe('×2');
    expect(root.querySelector('.battle-decision-actions').contains(root.querySelector(`[data-act="${backAction}"]`))).toBe(true);
    expect(root.querySelector('.battle-decision-content').contains(root.querySelector(`[data-act="${backAction}"]`))).toBe(false);
    cards[1].focus(); actions.get('btInspectPile')(cards[1].dataset);
    expect(document.activeElement).toBe(cards[1]);
    expect(cards[1].getAttribute('aria-pressed')).toBe('true');
    expect(cards[0].getAttribute('aria-pressed')).toBe('false');
    expect(root.querySelector('.battle-decision-inspect-rules').textContent).toBe(fixture.entries.get('second').card.desc);
    expect(root.querySelector('.battle-decision-inspect .ov-note').textContent).toContain('仅在 BOSS 战编入本场牌库');
    cards[0].focus(); actions.get('btInspectPile')(cards[0].dataset);
    expect(document.activeElement).toBe(cards[0]);
    expect(root.querySelector('.battle-decision-inspect h4').textContent).toBe('短规则牌');
    expect(JSON.stringify(fixture.snapshot)).toBe(before);
  });
});
