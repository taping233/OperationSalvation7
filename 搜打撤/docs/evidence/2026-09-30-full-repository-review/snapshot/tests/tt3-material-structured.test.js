import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { KEY as CARDS_KEY, TT3_KEY_V5, TT10_KEY } from '../game/src/cards/cards.consts.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');

const Cards = window.SDT.Cards;
const Base = window.SDT.Base;
const RULES_KEY = 'sdt-cards-tt10-base-material-v1-seeded';
const watchedKeys = [CARDS_KEY, TT3_KEY_V5, TT10_KEY, RULES_KEY];
const originalCards = JSON.parse(JSON.stringify(Cards.all()));
const originalKeys = new Map(watchedKeys.map(key => [key, localStorage.getItem(key)]));
const materialIds = ['tt3-wood-bundle', 'tt3-ration-double'];

function restoreTestState() {
  Cards.saveAll(originalCards);
  for (const [key, value] of originalKeys) {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }
}

beforeEach(restoreTestState);
afterAll(restoreTestState);

describe('TT10 定版材料规则', () => {
  it('只在 TABLETOP10 最新定义存规则，历史 TABLETOP3 行由后续定版覆盖', () => {
    const expected = {
      'tt3-wood-bundle': { version: 1, base: { material: { kind: 'wood', amount: 3 } } },
      'tt3-ration-double': { version: 1, base: { material: { kind: 'rations', amount: 2 } } },
    };
    for (const id of materialIds) {
      const latest = Cards.TABLETOP10.find(card => card.id === id);
      const historical = Cards.TABLETOP3.find(card => card.id === id);
      expect(latest.rules).toEqual(expected[id]);
      expect(historical.rules).toBeUndefined();
      expect(validateCardRules(latest)).toEqual({ ok: true, errors: [], pending: [] });
    }
  });

  it('对旧档按 id 补齐规则，保留原文案与其他存档字段，重复运行幂等', () => {
    const oldCards = [
      { id: 'tt3-wood-bundle', name: '玩家木材名', type: '资源', desc: '玩家改写木材描述', customField: 'keep-wood' },
      { id: 'tt3-ration-double', name: '玩家口粮名', type: '资源', desc: '玩家改写口粮描述', customField: 'keep-rations' },
      { id: 'unrelated-archive-card', name: '旁卡', desc: '旁卡描述', customField: 'keep-unrelated' },
    ];
    Cards.saveAll(oldCards);
    localStorage.setItem(TT10_KEY, '1');

    Cards.ensureTT10BaseMaterialRules();
    for (const card of Cards.all().filter(card => materialIds.includes(card.id))) {
      const definition = Cards.TABLETOP10.find(entry => entry.id === card.id);
      expect(card.rules).toEqual(definition.rules);
      expect(validateCardRules(card)).toEqual({ ok: true, errors: [], pending: [] });
    }
    expect(Cards.all().find(card => card.id === 'tt3-wood-bundle')).toMatchObject({
      name: '玩家木材名', desc: '玩家改写木材描述', customField: 'keep-wood',
    });
    expect(Cards.all().find(card => card.id === 'tt3-ration-double')).toMatchObject({
      name: '玩家口粮名', desc: '玩家改写口粮描述', customField: 'keep-rations',
    });
    expect(Cards.all().find(card => card.id === 'unrelated-archive-card')).toEqual(oldCards[2]);
    expect(localStorage.getItem(RULES_KEY)).toBe('1');

    const migrated = JSON.parse(JSON.stringify(Cards.all()));
    localStorage.removeItem(RULES_KEY);
    Cards.ensureTT10BaseMaterialRules();
    expect(Cards.all()).toEqual(migrated);

    const rewritten = Cards.all().filter(card => materialIds.includes(card.id)).map(card => ({
      ...card,
      name: `改名-${card.id}`,
      desc: '任意改写后的材料卡描述',
    }));
    expect(rewritten.map(card => Base.materialAmount(card))).toEqual([3, 2]);
  });

  it('旧档单独重播历史 TT3 后仍由 TABLETOP10 定版补齐规则', () => {
    Cards.saveAll([]);
    localStorage.removeItem(TT3_KEY_V5);
    localStorage.removeItem(TT10_KEY);
    localStorage.removeItem(RULES_KEY);

    Cards.seedBatch(Cards.TABLETOP3, TT3_KEY_V5, 'tt3');
    for (const id of materialIds) {
      expect(Cards.all().find(card => card.id === id).rules).toBeUndefined();
    }
    Cards.ensureTabletopSync();
    Cards.ensureTT10BaseMaterialRules();

    for (const id of materialIds) {
      const card = Cards.all().find(entry => entry.id === id);
      expect(card.rules).toEqual(Cards.TABLETOP10.find(entry => entry.id === id).rules);
      expect(validateCardRules(card).ok).toBe(true);
    }
  });
});
