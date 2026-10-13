import { beforeAll, describe, expect, it } from 'vitest';
import { displayCardDescription } from '../game/src/cards/card-description-text.js';
import { descRich, cardHTML } from '../game/src/cards/cards.view.js';
import { createCardDescriptionRenderer } from '../game/src/cards/card-description-links.js';
import { sourceCardLibrary } from '../scripts/sync-cards-from-live.mjs';

let cards, Cards;
beforeAll(async () => {
  window.SDT.Icons ||= { img: () => '', TYPE_ART: {} };
  window.SDT.Icons.TYPE_ART ||= {};
  await import('../game/src/cards/cards.js');
  Cards = window.SDT.Cards;
  Cards.ensureStarters();
  Cards.ensureSha();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
  cards = Cards.all();
});
const textContent = html => {
  const node = document.createElement('div');
  node.innerHTML = html;
  return node.textContent;
};
const get = id => cards.find(card => card.id === id);

describe('卡牌展示文案与结算文本隔离', () => {
  it('明确护甲损失、费用归属、受伤判断和受益人', () => {
    expect(displayCardDescription(get('tt7-bulwark').desc, 'tt7-bulwark')).toContain('你失去 4 点护甲');
    expect(displayCardDescription(get('tt12-hitechrd').desc, 'tt12-hitechrd')).toContain('所选卡牌的费用减少 1 点');
    expect(displayCardDescription(get('tt12-freezeray').desc, 'tt12-freezeray')).toContain('目标在受到本次伤害前未受伤');
    expect(displayCardDescription(get('tt3-bandage').desc, 'tt3-bandage')).toBe('你回复 3 点生命，并获得 3 点护甲。');
  });

  it('同一原文在不同 ID 下只更新已审阅的卡，玩家改文案时原样返回', () => {
    const raw = get('tt3-bandage').desc;
    expect(displayCardDescription(raw, 'custom-bandage')).toBe(raw);
    expect(displayCardDescription('回复 30 点生命。', 'tt3-bandage')).toBe('回复 30 点生命。');
    expect(displayCardDescription(null, 'tt3-bandage')).toBe('');
    const formatted = displayCardDescription(raw, 'tt3-bandage');
    expect(displayCardDescription(formatted, 'tt3-bandage')).toBe(formatted);
  });

  it('共同入口使用同一文案，源卡、费用、规则与卡库存储保持原字节', () => {
    const library = sourceCardLibrary();
    const before = JSON.stringify(library);
    const storage = localStorage.getItem('sdt-cards');
    for (const card of library) {
      Object.freeze(card);
      const expected = displayCardDescription(card.desc, card.id);
      expect(textContent(descRich(card.desc, card.id)), card.id).toBe(expected);
      const holder = document.createElement('div');
      holder.innerHTML = cardHTML(card);
      expect(holder.querySelector('.hsc-desc')?.textContent, card.id).toBe(expected);
    }
    expect(JSON.stringify(library)).toBe(before);
    expect(localStorage.getItem('sdt-cards')).toBe(storage);
  });

  it('战斗费用与伤害角标覆盖不改写展示原文或卡牌', () => {
    const card = Object.freeze({ ...get('cc-demon') });
    const before = JSON.stringify(card);
    const html = cardHTML(card, 'sm', { costOverride: { v: 0 }, dmgOverride: { bonus: 2 } });
    const holder = document.createElement('div');
    holder.innerHTML = html;
    expect(holder.querySelector('.hsc-cost')?.textContent).toBe('0');
    expect(holder.querySelector('.hsc-dmg b')?.textContent).toContain('9');
    expect(holder.querySelector('.hsc-desc')?.textContent).toBe('造成 7 点法术伤害；你损失 2 点生命。');
    expect(JSON.stringify(card)).toBe(before);
  });

  it('按新的显示文字计算长文案密度', () => {
    const card = get('tt3-fatal-pierce');
    const holder = document.createElement('div');
    holder.innerHTML = cardHTML(card);
    expect(holder.querySelector('.hs-card').dataset.ruleDensity).toBe('dense');
    expect(holder.querySelector('.hsc-desc').classList.contains('xlong')).toBe(true);
  });
});

describe('照相馆引用与搜索文案', () => {
  it('先统一文案，再保护卡名链接和数字高亮；详情与大图共用结果', () => {
    const renderer = createCardDescriptionRenderer(cards);
    const card = get('tt7-twinfireball');
    const html = renderer.render(card.desc, card.id, '火球');
    const holder = document.createElement('div');
    holder.innerHTML = html;
    expect(holder.textContent).toBe('造成 4 点法术伤害；将 2 张「火球」置入你的手牌。');
    expect(holder.querySelector('[data-card-reference="tt3-fireball"]')?.textContent).toBe('火球');
    expect(holder.querySelector('.studio-search-sentence mark')?.textContent).toBe('火球');
  });

  it('已统一的分句再次渲染不丢失目标与新增主语', () => {
    const renderer = createCardDescriptionRenderer(cards);
    const text = displayCardDescription(get('tt12-freezeray').desc, 'tt12-freezeray').split('；')[1];
    expect(textContent(renderer.render(text, 'tt12-freezeray', '目标'))).toBe(text);
  });

  it('改写卡牌和自定义 HTML 仍保持转义，引用保护不被统一模块改写', () => {
    const renderer = createCardDescriptionRenderer(cards);
    const raw = '<img src=x onerror=alert(1)>获得「火球」';
    const holder = document.createElement('div');
    holder.innerHTML = renderer.render(raw, 'tt7-twinfireball');
    expect(holder.querySelector('img')).toBeNull();
    expect(holder.textContent).toBe(raw);
    expect(holder.querySelector('[data-card-reference="tt3-fireball"]')?.textContent).toBe('火球');
  });
});
