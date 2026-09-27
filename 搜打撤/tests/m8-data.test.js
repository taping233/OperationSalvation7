import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM8RuleBackfill } from '../game/src/cards/cards.sync.m8.js';

const MARKER = 'sdt-cards-m8-rule-backfill-v1-seeded';
const TABLETOP11 = [
  { id: 'cmtn1r10xnl1', cls: '降临者', name: '黑暗形态', cost: 1, rarity: '职业', type: '法术', dmg: 0, desc: '本局对战中，每当你发现卡牌时，增加1个可选项', value: 2, sellable: false, unrandom: true },
  { id: 'tt3-petal', cls: '牧师', name: '花瓣法阵', cost: 1, rarity: '职业', type: '法术', dmg: 0, draw: 1, heal: 2, desc: '回合开始时额外抽1张牌并回复 3 点生命，持续 3 回合。', value: 3, sellable: false, unrandom: true },
];
const TABLETOP10 = [
  { id: 'cmtn0pbkmnvc', name: '流光照影', cost: 2, rarity: '衍生', type: '武术', desc: '对方身上每有一层诅咒，释放一次‘初始攻击’', value: 5, unrandom: true },
  { id: 'tt7-swordimmortal', cls: '侠客', name: '剑仙形态', cost: 2, rarity: '职业', type: '武术', desc: '本局对战中，回合开始时额外抽 1 张牌。', dmg: 0, draw: 1, value: 4, unrandom: true },
  { id: 'tt7-goldencicada', cls: '侠客', name: '金蝉脱壳', cost: 0, rarity: '职业', type: '武术', desc: '消耗所有手牌，抽 3 张。', dmg: 0, value: 3, unrandom: true },
  { id: 'cmtn2jc142dj', name: '刀剑形态', cost: 1, rarity: '稀有', type: '武术', desc: '回合开始时，获得一张随机手牌的复制', value: 3 },
  { id: 'tt3-grope', name: '摸索', cost: 1, rarity: '古朴', type: '法术', desc: '抽2-3张牌。', dmg: 0, draw: 2, value: 2 },
  { id: 'tt7-abysscurse', cls: '降临者', name: '深渊诅咒', cost: 2, rarity: '职业', type: '法术', desc: '7′，附加禁疗；此时对方身上每有 1 种诅咒，抽 1 张牌。', dmg: 7, dmgType: 'spell', draw: 1, value: 3, unrandom: true },
];
const CARDS_SYNC = [
  { id: 'tt7-elementstorm', cls: '法师', cost: 1, desc: '下一张法术施放 2 次。', dmg: 0, name: '元素风暴', rarity: '职业', type: '法术', value: 3, unrandom: true },
  { id: 'tt7-demonbreaker', cls: '战士', name: '破甲重斩', cost: 2, rarity: '职业', type: '武术', desc: '攻5，附加破甲，持续 2 回合；击杀敌人时 +4 甲。', dmg: 5, dmgType: 'attack', armor: 4, value: 3, unrandom: true },
];
const RULES = {
  cmtn0pbkmnvc: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'execute', what: 'starterAttack', perCurseStacks: true }] } },
  cmtn1r10xnl1: { version: 1, triggers: { onPlay: [{ op: 'registerRule', rule: 'discoverPlus' }] } },
  'tt7-elementstorm': { version: 1, triggers: { onPlay: [{ op: 'registerRule', rule: 'doubleNextSpell' }] } },
  'tt3-petal': { version: 1, triggers: { onTurnStart: [{ op: 'draw', amountField: 'draw' }, { op: 'heal', amountField: 'heal' }], duration: 3, onPlay: [] } },
  'tt7-swordimmortal': { version: 1, triggers: { onTurnStart: [{ op: 'draw', amountField: 'draw' }], onPlay: [] } },
  'tt7-goldencicada': { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'draw', amount: 3, handOps: [{ op: 'consumeHand' }] }] } },
  cmtn2jc142dj: { version: 1, triggers: { onTurnStart: [{ op: 'copyRandom' }], onPlay: [] } },
  'tt3-grope': { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op: 'draw', range: [2, 3] }] } },
  'tt7-abysscurse': { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'curse', curse: 'healban', duration: 1, target: 'chosenEnemy' },
    { op: 'draw', perCurseKinds: true },
  ] } },
  'tt7-demonbreaker': { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', onKill: { armor: 4 } },
    { op: 'curse', curse: 'abreak', duration: 2, target: 'chosenEnemy' },
  ] } },
};
const ALL = [...TABLETOP10, ...TABLETOP11, ...CARDS_SYNC];
const fresh = () => ALL.map(card => ({ ...card }));

function harness(cards) {
  const storageMap = new Map([[KEY, JSON.stringify(cards)]]);
  const storage = {
    getItem: key => storageMap.has(key) ? storageMap.get(key) : null,
    setItem: (key, value) => storageMap.set(key, String(value)),
  };
  let current = cards.map(card => ({ ...card }));
  const library = {
    TABLETOP10, TABLETOP11, CARDS_SYNC,
    all: () => current,
    saves: 0,
    saveAll(next) { this.saves += 1; current = next.map(card => ({ ...card })); storage.setItem(KEY, JSON.stringify(current)); return true; },
  };
  return { storage, library, cards: () => current };
}

describe('M8 rule data backfill', () => {
  for (const source of ALL) {
    const { id } = source;
    it(`${id}: rules pass schema and real-consumer capability gates`, () => {
      const card = { ...source,
        ...(id === 'tt3-petal' ? { desc: '回合开始时额外抽1张牌并回复 2 点生命，持续 3 回合。' } : {}),
        rules: RULES[id] };
      const validation = validateCardRules(card);
      expect(validation.ok, JSON.stringify(validation.errors)).toBe(true);
      expect(inspectCardRuleCapability(card)).toEqual({ kind: 'supported', ok: true });
    });
    it(`${id}: canonical card is migrated and rereads with marker`, () => {
      const h = harness(fresh());
      ensureM8RuleBackfill(h);
      const card = h.cards().find(item => item.id === id);
      expect(card.rules).toEqual(RULES[id]);
      if (id === 'tt3-petal') {
        expect(card.heal).toBe(2);
        expect(card.desc).toBe('回合开始时额外抽1张牌并回复 2 点生命，持续 3 回合。');
      }
      expect(h.storage.getItem(KEY)).toBe(JSON.stringify(h.cards()));
      expect(h.storage.getItem(MARKER)).toBe('1');
      expect(h.library.saves).toBe(1);
    });
    it(`${id}: modified face or owned rules are conservatively skipped`, () => {
      for (const changed of [
        { ...source, name: '玩家改名' },
        { ...source, value: 99 },
        { ...source, rules: { version: 1 } },
      ]) {
        const h = harness([changed, ...ALL.filter(item => item.id !== id).map(item => ({ ...item }))]);
        ensureM8RuleBackfill(h);
        expect(h.cards().find(item => item.id === id)).toEqual(changed);
      }
    });
  }
  it('missing canonical cards do not write or mark a partial migration', () => {
    const h = harness([ALL[0]]);
    ensureM8RuleBackfill(h);
    expect(h.library.saves).toBe(0);
    expect(h.storage.getItem(MARKER)).toBe(null);
  });
  it('marker is one-shot and save failure remains unmarked', () => {
    const h = harness(fresh());
    ensureM8RuleBackfill(h);
    ensureM8RuleBackfill(h);
    expect(h.library.saves).toBe(1);
    const failed = harness(fresh());
    failed.library.saveAll = () => false;
    ensureM8RuleBackfill(failed);
    expect(failed.storage.getItem(MARKER)).toBe(null);
  });
});
