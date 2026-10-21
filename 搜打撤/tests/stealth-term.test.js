import { afterEach, describe, expect, it, vi } from 'vitest';
import { descRich } from '../game/src/cards/cards.view.js';
afterEach(() => vi.restoreAllMocks());

describe('潜行卡面词条', () => {
  it('潜匿与破隐说明都接入独立讲解，点击词条不触发卡牌', async () => {
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ x:0, y:0, width:80, height:20 }]);
    document.body.innerHTML = `<button id="card">${descRich('进入潜行状态 1 回合；潜行状态下的下一次攻击伤害翻倍。')}</button>`;
    const terms = [...document.querySelectorAll('[data-term="stealth"]')];
    expect(terms).toHaveLength(2);
    let cardClicks = 0;
    document.querySelector('#card').addEventListener('click', () => cardClicks++);
    terms[0].dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    terms[0].click();
    expect(cardClicks).toBe(0); // Capture protection also holds before the first renderer arrives.
    await vi.dynamicImportSettled();
    const tip = document.querySelector('[role="tooltip"]');
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toContain('潜行');
    expect(tip.textContent).toContain('无法成为被攻击对象；造成伤害会破除潜行。');
    terms[0].click();
    expect(cardClicks).toBe(0);
    document.body.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(tip.hidden).toBe(true);
  });
});
