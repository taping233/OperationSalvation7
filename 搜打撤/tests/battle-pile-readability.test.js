import postcss from 'postcss';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCssSource } from './helpers/css-source.js';

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
  showCardZoom:vi.fn(),
};
window.SDT = { UI, Cards:{ cardHTML:(card,size) => `<div class="hs-card" data-card-id="${card.id}" data-size="${size}">${card.name}<div class="hsc-desc" tabindex="0">${card.desc}</div></div>` } };
const { renderDeckPileView, renderGrave } = await import('../game/src/battle/view/battle.overlays.js');

const source = readCssSource('game/css/battle-pile-view.css', 'utf8');
const css = postcss.parse(source);
const scope = 'body #overlay .battle-decision.battle-decision-unified[data-decision-kind="pile"]';
const panel = `${scope}:has([data-battle-pile-view])`;
function values(selector) {
  const result = {};
  css.walkRules(rule => {
    if (!rule.selector.split(',').map(value => value.trim()).includes(selector)) return;
    if (rule.parent.type === 'atrule') return;
    rule.walkDecls(declaration => { result[declaration.prop] = declaration.value; });
  });
  return result;
}

beforeEach(() => {
  actions.clear(); fixture.entries.clear();
  UI.showCardZoom.mockClear();
  document.body.innerHTML = '<div id="overlay"><div class="card"><div id="ovBody"></div></div></div>';
  UI.el.ovBody = document.getElementById('ovBody');
  UI.el.overlay = document.getElementById('overlay');
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
  it('scopes the centered full-card surface and retained battlefield treatment to pile views', () => {
    css.walkRules(rule => expect(rule.selector).toContain('[data-battle-pile-view]'));
    expect(values(panel)).toMatchObject({ width:'1700px', height:'900px', 'max-width':'100%', 'max-height':'100%', 'min-width':'0', 'min-height':'0' });
    expect(values(`${panel} .battle-decision-head h3`).font).toContain('36px');
    expect(values('body #overlay:has([data-battle-pile-view]) #ovBody > .battle-stage.sts')).toMatchObject({ filter:'blur(7px)', opacity:'.72' });
    expect(values('body #overlay .battle-secondary-layer:has([data-battle-pile-view])::before').background).toBe('#050d1766');
  });

  it('centers full-width card tracks without reserving a duplicate rules sidebar', () => {
    expect(values(`${scope} [data-battle-pile-view] .battle-pile-grid`)).toMatchObject({ 'grid-template-columns':'repeat(auto-fit,280px)', 'justify-content':'center', 'justify-items':'center', gap:'36px 40px' });
    expect(values(`${scope} [data-battle-pile-view] .battle-pile-card`)).toMatchObject({ width:'280px', padding:'0', 'max-width':'none' });
    expect(values(`${scope} [data-battle-pile-view] .battle-pile-card > .hs-card`)).toMatchObject({ width:'280px', 'font-size':'24px', 'pointer-events':'none' });
    expect(source).not.toContain('.battle-decision-inspect');
  });

  it('scrolls the grid independently while the title and return remain outside it', () => {
    expect(values(`${panel} .battle-decision-content`)).toMatchObject({ flex:'1 1 auto', overflow:'hidden', 'min-height':'0' });
    expect(values(`${scope} [data-battle-pile-view] .battle-pile-grid`)).toMatchObject({ 'overflow-y':'auto', 'overflow-x':'hidden', 'overscroll-behavior':'contain' });
    expect(values(`${scope} [data-battle-pile-view] .battle-pile-card`)['scroll-margin-block']).toBe('14px');
    expect(values(`${panel} .battle-decision-actions`).flex).toBe('none');
    expect(values(`${panel} .battle-pile-back`)).toMatchObject({ 'min-width':'180px', 'min-height':'60px' });
  });

  it('keeps quantity and keyboard focus clear without adding motion for reduced-motion users', () => {
    expect(values('body #overlay [data-battle-pile-view] .battle-pile-count')).toMatchObject({ position:'absolute', top:'10px', right:'12px', 'pointer-events':'none' });
    expect(values(`${scope} [data-battle-pile-view] .battle-pile-card:focus-visible`).outline).toBe('3px solid #c5e3ed');
    expect(values('body.reduce-motion #overlay [data-battle-pile-view] .battle-pile-card').transition).toBe('none');
  });

  it.each([
    ['deck', renderDeckPileView, 'btDeckBack'],
    ['grave', renderGrave, 'btGraveBack'],
  ])('preserves %s grouping, full text, focused inspection and the fixed return action', (_kind, render, backAction) => {
    const before = JSON.stringify(fixture.snapshot);
    render(fixture.snapshot);
    const root = UI.el.ovBody.querySelector('.battle-decision[data-decision-kind="pile"]');
    const cards = [...root.querySelectorAll('.battle-pile-card')];
    expect(cards).toHaveLength(_kind==='deck'?3:2);
    const short=cards.find(button=>button.querySelector('[data-card-id="pile-short"]'));
    const long=cards.find(button=>button.querySelector('[data-card-id="pile-long"]'));
    if(_kind==='grave') expect(short.querySelector('.battle-pile-count').textContent).toBe('×2');
    else expect(short.querySelector('.battle-pile-count')).toBeNull();
    expect(cards.every(button=>button.querySelector('.hs-card').dataset.size==='lg')).toBe(true);
    expect(cards.every(button=>button.querySelector('[tabindex]').tabIndex===-1)).toBe(true);
    expect(root.querySelector('.battle-pile-total').textContent).toBe('3 张');
    expect(root.querySelector('.battle-decision-inspect')).toBeNull();
    expect(root.querySelector('.battle-decision-actions').contains(root.querySelector(`[data-act="${backAction}"]`))).toBe(true);
    expect(root.querySelector('.battle-decision-content').contains(root.querySelector(`[data-act="${backAction}"]`))).toBe(false);
    long.focus(); actions.get('btDecisionInspect')(long.dataset);
    expect(document.activeElement).toBe(long);
    expect(UI.showCardZoom).toHaveBeenLastCalledWith(fixture.entries.get('second').card,expect.objectContaining({returnFocus:long,items:expect.any(Array),index:expect.any(Number)}));
    expect(long.querySelector('.hsc-desc').textContent).toBe(fixture.entries.get('second').card.desc);
    short.focus(); actions.get('btDecisionInspect')(short.dataset);
    expect(UI.showCardZoom).toHaveBeenLastCalledWith(fixture.entries.get('first').card,expect.objectContaining({returnFocus:short,items:expect.any(Array),index:expect.any(Number)}));
    expect(UI.el.ovBody.querySelector('.battle-decision')).toBe(root);
    expect(JSON.stringify(fixture.snapshot)).toBe(before);
  });
});
