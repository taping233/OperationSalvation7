import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cardFramePresentation } from '../game/src/cards/card-frame-presentation.js';
import { dataSlice } from '../game/src/cards/cards.data.js';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
window.SDT ||= { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');
let cards;
beforeAll(() => {
  cards = window.SDT.Cards;
  window.SDT.Icons ||= { img: () => '' };
  window.SDT.Icons.TYPE_ART = cards.TYPE_ART;
});
const render = (card, options) => {
  const node = document.createElement('div');
  node.innerHTML = cards.cardHTML(card, 'sm', options);
  return node.firstElementChild;
};
const sample = overrides => ({ id: 'shared-face', name: '测试牌', type: '法术', rarity: '古朴', cost: 2, desc: '造成 4 点伤害。', ...overrides });

describe('shared card presentation', () => {
  it('keeps the cost overlay above the frame and hides resource costs in every mode', () => {
    const root = render(sample());
    const layer = root.querySelector('.hsc-cost-layer');
    expect(layer.parentElement).toBe(root);
    expect(layer.style.cssText).toBe(root.querySelector('.hsc-face').style.cssText);
    expect(layer.querySelector('.hsc-cost').textContent).toBe('2');
    const resource = sample({ type: '资源', cost: 2 });
    for (const options of [undefined, {hideCost:false}, {costOverride:{v:1,base:2}}]) {
      expect(render(resource,options).querySelector('.hsc-cost-layer')).toBeNull();
    }
  });
  it('gives legendary cards quiet gold light without changing prismatic effects', () => {
    const gold = render(sample({rarity:'传说'}));
    expect(gold.querySelector('.hsc-gold-halo')).not.toBeNull();
    expect(gold.querySelector('.hsc-gold-beam')).not.toBeNull();
    expect(gold.querySelector('.hsc-prism-halo')).toBeNull();
    const prism = render(sample({rarity:'棱彩'}));
    expect(prism.querySelector('.hsc-prism-halo')).not.toBeNull();
    expect(prism.querySelector('.rv-beam')).not.toBeNull();
    expect(prism.querySelector('.hsc-gold-halo')).toBeNull();
  });
  it('keeps card-face layout and materials out of individual page stylesheets', () => {
    const overrides = [];
    for (const entry of fs.readdirSync('game/css', { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.css') || entry.name === 'card-layout-selected.css') continue;
      const file = path.join(entry.parentPath || entry.path, entry.name);
      postcss.parse(fs.readFileSync(file, 'utf8')).walkRules(rule => {
        if (/\.hsc-(?:name|desc|type|cost|frame|copy|prism)/.test(rule.selector)) overrides.push(file + ': ' + rule.selector);
      });
    }
    expect(overrides).toEqual([]);
  });
  it('renders every seeded catalog entry through the shared presentation contract', () => {
    const catalog = [...new Map(Object.values(dataSlice).flatMap(entries => Array.isArray(entries) ? entries : []).map(card => [card.id, card])).values()];
    const lookup = vi.spyOn(cards, 'all').mockReturnValue(catalog);
    try {
      for (const card of catalog) {
        const root = render(card);
        expect(root.dataset.cardLayout, card.id).toBe('split');
        expect(root.querySelector('.hsc-frame').getAttribute('src'), card.id).toContain('ui/card-frames/paper-1015/');
        expect(root.querySelector('.hsc-desc').textContent, card.id).not.toContain('[object Object]');
      }
    } finally { lookup.mockRestore(); }
  });
  it.each(['武术','法术','生物','道具','装备','事件','能力卡','资源'])('%s uses the same artwork, transition label, rules body and frame contract', type => {
    const root = render(sample({ id: 'face-' + type, type }));
    expect(root.dataset.cardLayout).toBe('split');
    expect(root.querySelector('.hsc-art')).not.toBeNull();
    expect(root.querySelector('.hsc-type-primary').textContent).toBe(type);
    expect(root.querySelector('.hsc-type').parentElement).toBe(root.querySelector('.hsc-face'));
    expect(root.querySelector('.hsc-frame').parentElement).toBe(root);
    expect(root.querySelector('.hsc-name').parentElement).toBe(root.querySelector('.hsc-copy'));
    expect(root.querySelector('.hsc-desc').parentElement).toBe(root.querySelector('.hsc-copy'));
    expect(root.querySelector('.hsc-frame').getAttribute('src')).toContain('assets/ui/card-frames/paper-1015/');
  });
  it.each([
    ['初始',null,'initial'],['古朴',null,'common'],['稀有',null,'rare'],['史诗',null,'epic'],
    ['传说',null,'legendary'],['衍生',null,'token'],['棱彩','侠客','prism'],
    ['职业','侠客','wu'],['职业','战士','heixiang'],['职业','法师','baita'],
    ['职业','牧师','xingyue'],['职业','降临者','changwuyu'],['职业',null,'neutral'],
  ])('%s / %s resolves to %s without changing image proportions', (rarity, cls, expected) => {
    const frame = cardFramePresentation(rarity, cls);
    expect(frame.key).toBe(expected);
    expect(frame.width / frame.height).toBe(2 / 3);
    expect(frame.src).toContain('/' + expected + '.webp');
  });
  it('uses effective rarity for ability cards and their derivatives', () => {
    const hero = sample({ id: 'ability-source', type: '能力卡', rarity: '职业', cls: '侠客', hero: true });
    const lookup = vi.spyOn(cards, 'all').mockReturnValue([hero]);
    try {
      for (const card of [hero, sample({ id: 'ability-token', rarity: '衍生', tokenOf: hero.id })]) {
        const root = render(card);
        expect(root.dataset.rarity).toBe('棱彩');
        expect(root.dataset.frame).toBe('prism');
        expect(root.querySelector('.hsc-prism-halo')).not.toBeNull();
      }
    } finally { lookup.mockRestore(); }
  });
  it('preserves modified costs and the existing hide-cost restriction', () => {
    const root = render(sample(), { costOverride: { v: 1, base: 2 } });
    expect(root.querySelector('.hsc-cost.mod-down').textContent).toBe('1');
    expect(render(sample({ type:'道具' }), { hideCost:true }).querySelector('.hsc-cost')).toBeNull();
    expect(render(sample(), { hideCost:true }).querySelector('.hsc-cost')).not.toBeNull();
  });
  it('keeps full custom rules and escapes their literal contents', () => {
    const card = sample({ name:'<svg onload="bad()">', desc:'<img src=x onerror="bad()">' + '长规则。'.repeat(40) });
    const root = render(card);
    expect(root.querySelector('svg,script,img[onerror]')).toBeNull();
    expect(root.querySelector('.hsc-name').textContent).toBe(card.name);
    expect(root.querySelector('.hsc-desc').textContent).toBe(card.desc);
    expect(root.querySelector('.hsc-desc').tabIndex).toBe(0);
    expect(cardFramePresentation('constructor', '__proto__').key).toBe('initial');
    expect(cardFramePresentation('职业', '__proto__').key).toBe('neutral');
  });
});
