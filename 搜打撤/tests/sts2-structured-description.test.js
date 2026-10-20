import { beforeAll, describe, expect, it } from 'vitest';
import { displayCardDescription } from '../game/src/cards/card-description-text.js';
import { structuredCardDescription } from '../game/src/cards/structured-card-description.js';
import { descRich, cardHTML } from '../game/src/cards/cards.view.js';
import { createCardDescriptionRenderer } from '../game/src/cards/card-description-links.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { sourceCardLibrary } from '../scripts/sync-cards-from-live.mjs';

let library;
beforeAll(async () => {
  window.SDT.Icons ||= { img: () => '', TYPE_ART: {} };
  window.SDT.Icons.TYPE_ART ||= {};
  await import('../game/src/cards/cards.js');
  const Cards = window.SDT.Cards;
  Cards.ensureStarters();
  Cards.ensureSha();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
  library = sourceCardLibrary();
});
const cardFor = id => structuredClone(library.find(card => card.id === id));
const plain = html => {
  const node = document.createElement('div');
  node.innerHTML = html;
  return node.textContent;
};
const cardCopy = card => {
  const node = document.createElement('div');
  node.innerHTML = cardHTML(card);
  return node.querySelector('.hsc-desc').textContent;
};

describe('简单结构化规则与现行描述同源', () => {
  it('当前卡库和已审阅样本逐字保留，读取不修改卡牌', () => {
    const before = JSON.stringify(library);
    for (const card of library) {
      expect(displayCardDescription(card.desc, card.id, card), card.id)
        .toBe(displayCardDescription(card.desc, card.id));
    }
    expect(displayCardDescription(cardFor('tt3-bandage').desc, 'tt3-bandage', cardFor('tt3-bandage')))
      .toBe('你回复 3 点生命，并获得 3 点护甲。');
    expect(displayCardDescription(cardFor('tt3-hold-fast').desc, 'tt3-hold-fast', cardFor('tt3-hold-fast')))
      .toBe('你获得 5 点护甲，并抽 1 张牌。');
    expect(JSON.stringify(library)).toBe(before);
  });

  it.each([
    ['tt3-bandage', { heal: 7, armor: 11 }, '你回复 7 点生命，并获得 11 点护甲。'],
    ['tt3-hold-fast', { armor: 9, draw: 2 }, '你获得 9 点护甲，并抽 2 张牌。'],
  ])('规则字段变化同步进入卡面、富文本和照相馆搜索：%s', (id, fields, expected) => {
    const card = Object.assign(cardFor(id), fields);
    const before = JSON.stringify(card);
    expect(validateCardRules(card).ok).toBe(true);
    expect(displayCardDescription(card.desc, card.id, card)).toBe(expected);
    expect(plain(descRich(card.desc, card.id, card))).toBe(expected);
    expect(cardCopy(card)).toBe(expected);
    const renderer = createCardDescriptionRenderer([card]);
    expect(plain(renderer.render(card.desc, card.id, '护甲'))).toBe(expected);
    expect(JSON.stringify(card)).toBe(before);
  });

  it('同一卡对象的规则数值变化不会被卡面或照相馆文案缓存遮住', () => {
    const card = cardFor('tt3-hold-fast');
    const renderer = createCardDescriptionRenderer([card]);
    expect(cardCopy(card)).toBe('你获得 5 点护甲，并抽 1 张牌。');
    expect(plain(renderer.render(card.desc, card.id))).toBe('你获得 5 点护甲，并抽 1 张牌。');
    card.draw = 3;
    expect(cardCopy(card)).toBe('你获得 5 点护甲，并抽 3 张牌。');
    expect(plain(renderer.render(card.desc, card.id))).toBe('你获得 5 点护甲，并抽 3 张牌。');
  });

  it('字面量操作使用执行声明的数值，不接受与现有字段冲突的声明', () => {
    const card = cardFor('tt3-bandage');
    card.heal = 0;
    card.rules.triggers.onPlay[0] = { op: 'heal', amount: 8 };
    expect(validateCardRules(card).ok).toBe(true);
    expect(displayCardDescription(card.desc, card.id, card)).toBe('你回复 8 点生命，并获得 3 点护甲。');
    card.heal = 3;
    expect(validateCardRules(card).ok).toBe(false);
    expect(displayCardDescription(card.desc, card.id, card)).toBe('你回复 3 点生命，并获得 3 点护甲。');
  });

  it.each([
    ['无规则', card => { delete card.rules; }],
    ['未知规则版本', card => { card.rules.version = 2; }],
    ['不完整字段', card => { delete card.heal; }],
    ['无效数值', card => { card.armor = NaN; }],
    ['不支持的小数数值', card => { card.armor = 1.5; }],
    ['空声明', card => { card.rules.triggers.onPlay = []; }],
    ['缺失操作', card => { delete card.rules.triggers.onPlay[0]; }],
    ['未覆盖操作', card => { card.rules.triggers.onPlay.push({ op: 'draw', amount: 2 }); }],
    ['重复操作', card => { card.rules.triggers.onPlay[1] = { op: 'heal', amountField: 'heal' }; }],
    ['其他时点', card => { card.rules.triggers.onTurnStart = [{ op: 'heal', amount: 2 }]; }],
    ['触发重放', card => { card.rules.triggers.replay = { on: 'lastHand', times: 2 }; }],
    ['护甲衰减', card => { card.rules.triggers.onPlay[1].decayAtTurnEnd = 2; }],
    ['注能', card => { card.infuse = 1; }],
    ['额外伤害字段', card => { card.dmg = 5; }],
    ['额外战斗规则', card => { card.rules.battle.costModifiers = [{ kind: 'armorZeroFree' }]; }],
    ['敌方目标', card => { card.rules.battle.target.side = 'enemy'; }],
    ['未知操作参数', card => { card.rules.triggers.onPlay[0].futureEffect = true; }],
  ])('%s 整段保留已有文案', (_label, change) => {
    const card = cardFor('tt3-bandage');
    const previous = displayCardDescription(card.desc, card.id);
    change(card);
    expect(displayCardDescription(card.desc, card.id, card)).toBe(previous);
  });

  it('自定义文本、错配ID和复杂完整句都不被简单模板覆盖', () => {
    const card = cardFor('tt3-bandage');
    card.heal = 8;
    const custom = '你回复 30 点生命，并获得 3 点护甲。';
    card.desc = custom;
    expect(displayCardDescription(card.desc, card.id, card)).toBe(custom);
    const canonical = cardFor('tt3-bandage');
    canonical.heal = 8;
    expect(displayCardDescription(canonical.desc, 'custom-bandage', canonical)).toBe(canonical.desc);
    expect(structuredCardDescription(canonical, '注能（1）：你回复 3 点生命，并获得 3 点护甲。')).toBeNull();
    expect(structuredCardDescription(canonical, '你回复 3 点生命，并获得 3 点护甲。下回合失去护甲。')).toBeNull();
  });
});
