import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as descriptionModule from '../game/src/cards/card-description-text.js';
import { registerBattleValueProvider } from '../game/src/cards/battle-value-context.js';
import { createCardDescriptionRenderer } from '../game/src/cards/card-description-links.js';

vi.mock('../game/src/cards/card-description-text.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, displayCardDescription: vi.fn(actual.displayCardDescription) };
});
let Cards, UI;
beforeAll(async () => {
  window.SDT.Icons ||= { img: () => '', TYPE_ART: {} };
  window.SDT.Icons.TYPE_ART ||= {};
  window.SDT.Sound = { sfx() {} };
  await import('../game/src/cards/cards.js');
  Cards = window.SDT.Cards;
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
  ({ UI } = await import('../game/src/ui/ui.js'));
});
const cardFor = id => structuredClone(Cards.all().find(card => card.id === id));
const zoom = () => document.getElementById('cardZoom');
const copy = () => zoom().querySelector('.cz-card .hsc-desc').textContent;
const plain = html => { const node = document.createElement('div'); node.innerHTML = html; return node; };
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><button id="origin">查看详情</button></div>';
  UI.el.overlay = document.getElementById('overlay');
});
afterEach(() => { zoom()?._closeCardZoom(true); document.body.classList.remove('zoom-open'); });

it('real non-photo UI.showCardZoom resolves its replacement description once with live bonus changes', () => {
  const card = cardFor('tt3-ice-spike');
  let values = { active: true, atk: 5, spellPower: 2 };
  const provider = vi.fn(() => values);
  const previous = registerBattleValueProvider(provider);
  const rows = [];
  function open(label) {
    provider.mockClear(); descriptionModule.displayCardDescription.mockClear();
    // No resolver injection or showCardZoom mock: exercise its default real renderer.
    UI.showCardZoom(card, { returnFocus: document.getElementById('origin') });
    rows.push({ label, description: copy(), provider: provider.mock.calls.length,
      normalization: descriptionModule.displayCardDescription.mock.calls.length });
  }
  try {
    open('cold'); open('reopen');
    values = { ...values, spellPower: 4 }; open('bonus-change');
    values = { ...values, spellPower: 2 }; open('bonus-return');
    values = { ...values, active: false }; open('inactive');
    values = { ...values, active: true }; open('reactivated');
    console.log('linked-zoom-operation-counts', JSON.stringify(rows));
    expect(rows.map(row => row.description)).toEqual([
      '造成 4 点法术伤害；对目标附加冰冻。', '造成 4 点法术伤害；对目标附加冰冻。',
      '造成 6 点法术伤害；对目标附加冰冻。', '造成 4 点法术伤害；对目标附加冰冻。',
      '造成 2 点法术伤害；对目标附加冰冻。', '造成 4 点法术伤害；对目标附加冰冻。',
    ]);
    // One cardHTML description and one replacement renderer description per open.
    expect(rows.map(row => row.provider)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(rows.map(row => row.normalization)).toEqual([2, 2, 2, 2, 2, 2]);
  } finally { registerBattleValueProvider(previous); }
});

it('real reference navigation and back preserve links and refresh live values with the same renderer', () => {
  const card = cardFor('tt7-twinfireball'), target = cardFor('tt3-fireball');
  const descriptionRenderer = createCardDescriptionRenderer([card, target]);
  const options = { descriptionRenderer, descriptionQuery: '火球', returnFocus: document.getElementById('origin') };
  let values = { active: true, atk: 5, spellPower: 2 };
  const previous = registerBattleValueProvider(() => values);
  try {
    UI.showCardZoom(card, options);
    expect(copy()).toBe('造成 6 点法术伤害；将 2 张「火球」置入你的手牌。');
    const link = zoom().querySelector('[data-card-reference="tt3-fireball"]');
    expect(link.textContent).toBe('火球'); expect(link.querySelector('mark').textContent).toBe('火球');
    link.click();
    expect(zoom().querySelector('.hsc-name').textContent).toBe('火球');
    values = { ...values, spellPower: 4 };
    zoom().querySelector('.cz-reference-back').click();
    expect(copy()).toBe('造成 8 点法术伤害；将 2 张「火球」置入你的手牌。');
    values = { ...values, spellPower: 2 }; UI.showCardZoom(card, options);
    expect(copy()).toBe('造成 6 点法术伤害；将 2 张「火球」置入你的手牌。');
    values = { ...values, active: false }; UI.showCardZoom(card, options);
    expect(copy()).toBe('造成 4 点法术伤害；将 2 张「火球」置入你的手牌。');
    values = { ...values, active: true }; UI.showCardZoom(card, options);
    expect(copy()).toBe('造成 6 点法术伤害；将 2 张「火球」置入你的手牌。');
    zoom()._closeCardZoom(true);
    expect(UI.el.overlay.inert).toBe(false);
    expect(document.activeElement.id).toBe('origin');
  } finally { registerBattleValueProvider(previous); }
});

it('linked renderer keeps ID/structured rules, custom text, protected numeric names and escaping', () => {
  const bandage = cardFor('tt3-bandage');
  bandage.heal = 7; bandage.armor = 11;
  const reference = { id: 'numeric-reference', name: '护甲2', desc: '', type: '法术' };
  const renderer = createCardDescriptionRenderer([bandage, reference]);
  const provider = vi.fn(() => ({ active: true, atk: 5, spellPower: 2 }));
  const previous = registerBattleValueProvider(provider);
  try {
    expect(plain(renderer.render(bandage.desc, bandage.id)).textContent).toBe('你回复 7 点生命，并获得 11 点护甲。');
    bandage.armor = 13;
    expect(plain(renderer.render(bandage.desc, bandage.id)).textContent).toBe('你回复 7 点生命，并获得 13 点护甲。');
    expect(plain(renderer.render('你回复 30 点生命，并获得 3 点护甲。', bandage.id)).textContent).toBe('你回复 30 点生命，并获得 3 点护甲。');
    expect(plain(renderer.render(bandage.desc, 'different-id')).textContent).toBe(bandage.desc);
    const raw = '造成 2 点法术伤害；获得「护甲2」。<img src=x onerror=alert(1)> & "单引号\'"';
    provider.mockClear(); descriptionModule.displayCardDescription.mockClear();
    const node = plain(renderer.render(raw, 'custom-card', '护甲2'));
    console.log('linked-fragment-operation-counts', JSON.stringify({ provider: provider.mock.calls.length, normalization: descriptionModule.displayCardDescription.mock.calls.length }));
    expect(provider).toHaveBeenCalledTimes(1);
    expect(descriptionModule.displayCardDescription).toHaveBeenCalledTimes(1);
    expect(node.textContent).toBe('造成 4 点法术伤害；获得「护甲2」。<img src=x onerror=alert(1)> & "单引号\'"');
    const link = node.querySelector('[data-card-reference="numeric-reference"]');
    expect(link.textContent).toBe('护甲2'); expect(link.querySelector('.d-num,.d-term')).toBeNull();
    expect(link.querySelector('mark').textContent).toBe('护甲2');
    expect(node.querySelector('img,script,iframe')).toBeNull();
    expect([...node.querySelectorAll('.d-num')].map(part => part.textContent)).toEqual(['4', '1']);
  } finally { registerBattleValueProvider(previous); }
});
