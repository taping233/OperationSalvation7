import { beforeAll, expect, it, vi } from 'vitest';
import * as descriptionModule from '../game/src/cards/card-description-text.js';
import { registerBattleValueProvider } from '../game/src/cards/battle-value-context.js';
import { cardHTML, descRich } from '../game/src/cards/cards.view.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';

vi.mock('../game/src/cards/card-description-text.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, displayCardDescription: vi.fn(actual.displayCardDescription) };
});

let Cards;
beforeAll(async () => {
  window.SDT.Icons ||= { img: () => '', TYPE_ART: {} };
  window.SDT.Icons.TYPE_ART ||= {};
  await import('../game/src/cards/cards.js');
  Cards = window.SDT.Cards;
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});
const byId = id => structuredClone(Cards.all().find(card => card.id === id));
const plain = html => {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return holder;
};

it('a legal normal-battle spell resolves once through public cardHTML: cold, warm, changed bonus, inactive', () => {
  const card = byId('tt3-ice-spike');
  expect(card.type).toBe('法术');
  expect(card.dmg).toBe(2);
  expect(inspectCardRuleCapability(card).ok).toBe(true);
  const before = JSON.stringify(card);
  let values = { active: true, atk: 5, spellPower: 2 };
  const provider = vi.fn(() => values);
  const previous = registerBattleValueProvider(provider);
  const rows = [];
  function render(label, bonus) {
    provider.mockClear(); descriptionModule.displayCardDescription.mockClear();
    const html = Cards.cardHTML(card, 'sm', bonus > 0 ? { dmgOverride: { bonus } } : {});
    const holder = plain(html);
    rows.push({ label, provider: provider.mock.calls.length, normalization: descriptionModule.displayCardDescription.mock.calls.length,
      description: holder.querySelector('.hsc-desc').textContent, badge: holder.querySelector('.hsc-dmg b').textContent });
    return html;
  }
  try {
    const cold = render('cold', 2);
    const warm = render('warm', 2);
    values = { ...values, spellPower: 4 };
    render('bonus-change', 4);
    values = { ...values, active: false };
    render('inactive', 0);
    // Counts are deterministic operations, not a timing benchmark.
    console.log('description-operation-counts', JSON.stringify(rows));
    expect(warm).toBe(cold);
    expect(rows.map(row => row.description)).toEqual([
      '造成 4 点法术伤害；对目标附加冰冻。',
      '造成 4 点法术伤害；对目标附加冰冻。',
      '造成 6 点法术伤害；对目标附加冰冻。',
      '造成 2 点法术伤害；对目标附加冰冻。',
    ]);
    expect(rows.map(row => row.badge)).toEqual(["4'", "4'", "6'", "2'"]);
    expect(rows.map(row => row.provider)).toEqual([1, 1, 1, 1]);
    expect(rows.map(row => row.normalization)).toEqual([1, 1, 1, 1]);
    expect(JSON.stringify(card)).toBe(before);
  } finally { registerBattleValueProvider(previous); }
});

it('public descRich still resolves raw/id/card input once and preserves structured fields', () => {
  const card = byId('tt3-bandage');
  card.heal = 7; card.armor = 11;
  const previous = registerBattleValueProvider(() => ({ active: true, atk: 5, spellPower: 2 }));
  try {
    descriptionModule.displayCardDescription.mockClear();
    expect(plain(descRich(card.desc, card.id, card)).textContent).toBe('你回复 7 点生命，并获得 11 点护甲。');
    expect(descriptionModule.displayCardDescription).toHaveBeenCalledTimes(1);
    const spell = byId('tt3-ice-spike');
    expect(plain(descRich(spell.desc, spell.id, spell)).textContent).toBe('造成 4 点法术伤害；对目标附加冰冻。');
  } finally { registerBattleValueProvider(previous); }
});

it('cardHTML retains escaping and numeric/term highlighting when rendering resolved text', () => {
  const card = byId('tt3-ice-spike');
  card.desc = '<img src=x onerror=alert(1)> & "单引号\'"；造成 2 点法术伤害。';
  const previous = registerBattleValueProvider(() => ({ active: true, atk: 5, spellPower: 2 }));
  try {
    const holder = plain(cardHTML(card, 'sm'));
    const description = holder.querySelector('.hsc-desc');
    expect(description.textContent).toBe('<img src=x onerror=alert(1)> & "单引号\'"；造成 4 点法术伤害。');
    expect(description.querySelector('img, script, iframe')).toBeNull();
    expect([...description.querySelectorAll('.d-num')].map(node => node.textContent)).toEqual(['1', '4']);
    expect(description.querySelector('.d-term').textContent).toBe('法术伤害');
  } finally { registerBattleValueProvider(previous); }
});

it('identical card and options refresh from provider values and reuse prior variants after return/reactivation', () => {
  const card = byId('tt3-ice-spike');
  const opts = {};
  let values = { active: true, atk: 5, spellPower: 2 };
  const provider = vi.fn(() => values);
  const previous = registerBattleValueProvider(provider);
  const rows = [];
  function render(label) {
    provider.mockClear(); descriptionModule.displayCardDescription.mockClear();
    const html = cardHTML(card, 'sm', opts);
    rows.push({ label, provider: provider.mock.calls.length, normalization: descriptionModule.displayCardDescription.mock.calls.length,
      description: plain(html).querySelector('.hsc-desc').textContent });
    return html;
  }
  try {
    const initial = render('same-opts-cold');
    values = { ...values, spellPower: 4 };
    const increased = render('same-opts-bonus-change');
    values = { ...values, spellPower: 2 };
    const restored = render('same-opts-bonus-return');
    values = { ...values, active: false };
    render('same-opts-inactive');
    values = { ...values, active: true };
    const reactivated = render('same-opts-reactivated');
    console.log('description-same-options-counts', JSON.stringify(rows));
    expect(increased).not.toBe(initial);
    expect(restored).toBe(initial);
    expect(reactivated).toBe(initial);
    expect(rows.map(row => row.description)).toEqual([
      '造成 4 点法术伤害；对目标附加冰冻。',
      '造成 6 点法术伤害；对目标附加冰冻。',
      '造成 4 点法术伤害；对目标附加冰冻。',
      '造成 2 点法术伤害；对目标附加冰冻。',
      '造成 4 点法术伤害；对目标附加冰冻。',
    ]);
    expect(rows.map(row => row.provider)).toEqual([1, 1, 1, 1, 1]);
    expect(rows.map(row => row.normalization)).toEqual([1, 1, 1, 1, 1]);
  } finally { registerBattleValueProvider(previous); }
});
