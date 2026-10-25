import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { allowsTermTip } from '../game/src/ui/term-tip-policy.js';
import { richResolvedDescription } from '../game/src/cards/cards.view.js';
import { createCardZoomContent } from '../game/src/ui/card-zoom-content.js';

beforeAll(async () => { await import('../game/src/ui/term-tips.js'); });
afterEach(() => {
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  document.querySelectorAll('[data-passive-fixture]').forEach(node => node.remove());
  vi.restoreAllMocks();
});

describe('card terms show delegated help', () => {
  it.each(['hs-card', 'card-rules-copy', 'cz-photo-info', 'pv-desc'])('shows hover and touch help in %s', async className => {
    const surface = document.createElement('button');
    surface.type = 'button'; surface.className = className; surface.dataset.passiveFixture = '';
    surface.innerHTML = '<span data-term="poison">中毒</span>';
    document.body.append(surface);
    const word = surface.firstElementChild, activate = vi.fn(); surface.addEventListener('click', activate);
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ width:80, height:20 }]);
    expect(allowsTermTip(word)).toBe(true);
    const hover = new Event('pointerover', { bubbles:true }); word.dispatchEvent(hover);
    await vi.dynamicImportSettled();
    const panel = document.getElementById('sdt-term-tip');
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('中毒');
    word.click(); expect(activate).not.toHaveBeenCalled();
    const press = new Event('pointerdown', { bubbles:true });
    Object.assign(press, { pointerId:7, pointerType:'touch', button:0 });
    word.dispatchEvent(press);
    expect(panel.hidden).toBe(false);
    const release = new Event('pointerup', { bubbles:true });
    Object.assign(release, { pointerId:7 });
    document.dispatchEvent(release);
    expect(panel.hidden).toBe(true);
    const enter = new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true });
    word.dispatchEvent(enter); expect(enter.defaultPrevented).toBe(true);
  });

  it('marks armor break as an explainable term', () => {
    expect(richResolvedDescription('附加破甲，持续 1 回合。')).toContain('data-term="abreak"');
  });

  it('keeps standalone battle status and equipment controls eligible for their own help', () => {
    const root = document.createElement('div'); root.dataset.passiveFixture = '';
    root.innerHTML = '<span class="bt-buff" data-term="poison">中毒</span><button data-ui-tip data-ui-tip-text="发动装备">护符</button>';
    document.body.append(root);
    expect(allowsTermTip(root.firstElementChild)).toBe(true);
    expect(allowsTermTip(root.lastElementChild)).toBe(true);
  });

  it('renders the original card rules without the removed side explanation panel', () => {
    const root = document.createElement('div'), card = { id:'read-card', name:'规则牌', type:'法术', desc:'造成2点法术伤害，并施加中毒。' };
    const description = { render:value => value };
    const content = createCardZoomContent(card, { hideNote:true }, description, {
      readCards:() => ({ cardHTML:() => '<article class="hs-card"><div class="hsc-desc"></div></article>' }), readArt:() => null,
    });
    content.fill(root);
    expect(root.querySelector('.hsc-desc').textContent).toBe(card.desc);
    expect(root.querySelector('.card-tip-group,.card-rule-tip,[aria-label="相关规则"]')).toBeNull();
  });
});
