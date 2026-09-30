import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');

const Cards = window.SDT.Cards;
const Base = window.SDT.Base;
const MARKER = 'sdt-cards-tt1-base-material-v1-seeded';
const originalCards = JSON.parse(JSON.stringify(Cards.all()));
const originalMarker = localStorage.getItem(MARKER);
const ids = ['tt-keys-bunch', 'tt-key', 'tt-key-one', 'tt-wood', 'tt-wood-lots', 'tt-rations'];

function restore() {
  Cards.saveAll(originalCards);
  if (originalMarker == null) localStorage.removeItem(MARKER);
  else localStorage.setItem(MARKER, originalMarker);
}
beforeEach(restore);
afterAll(restore);

describe('第一批材料卡规则回填', () => {
  it('旧档已经标记为播种完成时仍按 ID 补规则并保留玩家字段，重复执行幂等', () => {
    const oldCards = ids.map(id => ({ id, name: `旧名-${id}`, type: '资源', desc: '任意展示文字', keep: id }));
    Cards.saveAll(oldCards);
    localStorage.setItem(MARKER, '1');

    Cards.ensureTT1BaseMaterialRules();
    const migrated = JSON.parse(JSON.stringify(Cards.all()));
    for (const card of migrated) {
      const definition = Cards.TABLETOP.find(entry => entry.id === card.id);
      expect(card.rules).toEqual(definition.rules);
      expect(card).toMatchObject({ name: `旧名-${card.id}`, desc: '任意展示文字', keep: card.id });
      expect(validateCardRules(card).ok).toBe(true);
      expect(Base.materialAmount(card)).toBe(definition.rules.base.material.amount);
    }
    Cards.ensureTT1BaseMaterialRules();
    expect(Cards.all()).toEqual(migrated);
  });
});
