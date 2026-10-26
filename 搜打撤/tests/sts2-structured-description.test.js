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
    ['tt7-ironcharge', { armor: 17, draw: 4 }, '你获得 17 点护甲，并抽 4 张牌。'],
    ['tt7-livingwater', { draw: 7 }, '抽 7 张牌。'],
    ['tt3-holy-water', { heal: 9 }, '你回复 9 点生命，并净化自身。'],
    ['starter-emergency-bandage', { heal: 18 }, '你回复 18 点生命。'],
    ['tt-jinchuangyao', { heal: 23 }, '你回复 23 点生命。'],
    ['tt3-savior-elixir', { heal: 88 }, '你回复 88 点生命。'],
    ['tt4-woodify', { heal: 10 }, '你回复 10 点生命。'],
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

  it('纯治疗道具的字面量声明与同一对象字段修改均同步整句', () => {
    const card = cardFor('tt-jinchuangyao');
    const renderer = createCardDescriptionRenderer([card]);
    expect(plain(renderer.render(card.desc, card.id))).toBe('你回复 20 点生命。');
    card.heal = 25;
    expect(plain(renderer.render(card.desc, card.id))).toBe('你回复 25 点生命。');
    card.heal = 0;
    card.rules.bag.use[0] = { op: 'heal', amount: 14 };
    expect(validateCardRules(card).ok).toBe(true);
    expect(displayCardDescription(card.desc, card.id, card)).toBe('你回复 14 点生命。');
    card.heal = 20;
    expect(validateCardRules(card).ok).toBe(true);
    expect(displayCardDescription(card.desc, card.id, card)).toBe('你回复 14 点生命。');
  });

  it('聚能按执行声明n更新卡面、富文本与同一照相馆对象', () => {
    const card = cardFor('tt7-energize');
    const renderer = createCardDescriptionRenderer([card]);
    expect(displayCardDescription(card.desc, card.id, card)).toBe('你获得 1 点能量。');
    expect(plain(renderer.render(card.desc, card.id))).toBe('你获得 1 点能量。');
    card.rules.triggers.onPlay[0].n = 4;
    card.energy = 99;
    expect(validateCardRules(card).ok).toBe(true);
    expect(displayCardDescription(card.desc, card.id, card)).toBe('你获得 4 点能量。');
    expect(plain(descRich(card.desc, card.id, card))).toBe('你获得 4 点能量。');
    expect(cardCopy(card)).toBe('你获得 4 点能量。');
    expect(plain(renderer.render(card.desc, card.id, '能量'))).toBe('你获得 4 点能量。');
    card.rules.triggers.onPlay[0].n = 7;
    const before = JSON.stringify(card);
    expect(cardCopy(card)).toBe('你获得 7 点能量。');
    expect(plain(renderer.render(card.desc, card.id))).toBe('你获得 7 点能量。');
    expect(JSON.stringify(card)).toBe(before);
  });

  it.each([0, -1, 1.5, NaN, Infinity, undefined])('聚能的无效n值%s保留整句审核说明', n => {
    const card = cardFor('tt7-energize');
    card.rules.triggers.onPlay[0].n = n;
    expect(displayCardDescription(card.desc, card.id, card)).toBe('你获得 1 点能量。');
  });

  it.each([
    ['条件能量', card => { card.rules.triggers.onPlay[0].when = { infused: true }; }],
    ['其他数值来源', card => { card.rules.triggers.onPlay[0].amountField = 'energy'; }],
    ['混合操作', card => { card.rules.triggers.onPlay.push({ op: 'draw', amount: 1 }); }],
    ['其他时点', card => { card.rules.triggers.onTurnStart = [{ op: 'energy', n: 2 }]; }],
    ['费用条件', card => { card.rules.battle.costModifiers = [{ kind: 'armorZeroFree' }]; }],
    ['敌方目标', card => { card.rules.battle.target.side = 'enemy'; }],
    ['能量上限', card => { card.rules.triggers.onPlay[0].op = 'energyCap'; }],
    ['能量回满', card => { card.rules.triggers.onPlay[0] = { op: 'refillEnergy' }; }],
  ])('%s沿用完整说明', (_label, change) => {
    const card = cardFor('tt7-energize');
    card.rules.triggers.onPlay[0].n = 4;
    change(card);
    expect(displayCardDescription(card.desc, card.id, card)).toBe('你获得 1 点能量。');
  });

  it('聚能的自定义句子和错配身份保留来源文字', () => {
    const card = cardFor('tt7-energize');
    card.rules.triggers.onPlay[0].n = 4;
    card.desc = '你获得 30 点能量。';
    expect(displayCardDescription(card.desc, card.id, card)).toBe(card.desc);
    const canonical = cardFor('tt7-energize');
    canonical.rules.triggers.onPlay[0].n = 4;
    expect(displayCardDescription(canonical.desc, 'custom-energy', canonical)).toBe(canonical.desc);
  });

  it.each([
    ['净化顺序', 'tt3-holy-water', card => { card.rules.triggers.onPlay.reverse(); }],
    ['净化目标', 'tt3-holy-water', card => { card.rules.triggers.onPlay[1].target = 'chosenEnemy'; }],
    ['净化额外参数', 'tt3-holy-water', card => { card.rules.triggers.onPlay[1].futureEffect = true; }],
    ['治疗条件', 'tt3-holy-water', card => { card.rules.triggers.onPlay[0].when = { infused: true }; }],
    ['随机抽牌', 'tt7-livingwater', card => { card.rules.triggers.onPlay[0] = { op: 'draw', range: [2, 7] }; }],
    ['过滤抽牌', 'tt7-livingwater', card => { card.rules.triggers.onPlay[0].filter = { type: '装备' }; }],
    ['道具混合效果', 'tt-jinchuangyao', card => { card.rules.bag.use.push({ op: 'energy', n: 1 }); }],
    ['道具额外上下文', 'tt-jinchuangyao', card => { card.rules.battle = { target: { side: 'self', area: false } }; }],
  ])('%s 保留完整已审阅说明', (_label, id, change) => {
    const card = cardFor(id);
    const expected = displayCardDescription(card.desc, card.id);
    if (typeof card.heal === 'number') card.heal = 30;
    if (typeof card.draw === 'number') card.draw = 9;
    change(card);
    expect(displayCardDescription(card.desc, card.id, card)).toBe(expected);
  });

  it('恢复药水等混合效果与已改写的道具说明保留原句', () => {
    const mixed = cardFor('tt3-blue-potion');
    const expected = displayCardDescription(mixed.desc, mixed.id);
    mixed.heal = 30;
    expect(displayCardDescription(mixed.desc, mixed.id, mixed)).toBe(expected);
    const custom = cardFor('tt-jinchuangyao');
    custom.desc = '你回复 30 点生命。';
    custom.heal = 40;
    expect(displayCardDescription(custom.desc, custom.id, custom)).toBe(custom.desc);
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
