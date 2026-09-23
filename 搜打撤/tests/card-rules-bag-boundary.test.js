import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');

const Cards = window.SDT.Cards;
const originalRaw = localStorage.getItem(KEY);
function resetStore() {
  Cards.clearAll();
  if (originalRaw != null) localStorage.setItem(KEY, originalRaw);
}

beforeEach(resetStore);
afterAll(resetStore);

describe('bag rules card-library boundaries', () => {
  it('persists valid bag rules through saveAll/upsert and rejects invalid rules at both boundaries', () => {
    const accepted = [
      { id: 'bag-legacy', type: '道具' },
      { id: 'bag-heal-valid', type: '道具', heal: 5, rules: { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }] } } },
      { id: 'bag-restore-valid', type: '道具', rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount: 3 }] } } },
    ];
    expect(Cards.saveAll(accepted)).toBe(true);
    expect(Cards.all()).toEqual(accepted);

    Cards.upsert({ id: 'bag-restore-upsert', type: '道具', rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount: 6 }] } } });
    expect(Cards.all().find(card => card.id === 'bag-restore-upsert').rules.bag.use).toEqual([{ op: 'restoreConsumed', amount: 6 }]);

    const persisted = localStorage.getItem(KEY);
    expect(() => Cards.saveAll([
      ...Cards.all(),
      { id: 'bad-bag-save', type: '道具', rules: { version: 1, bag: { use: [] } } },
    ])).toThrow(/bad-bag-save rules\.bag\.use/);
    expect(localStorage.getItem(KEY)).toBe(persisted);
    expect(() => Cards.upsert({
      id: 'bad-bag-upsert', type: '法术', heal: 2,
      rules: { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }] } },
    })).toThrow(/bad-bag-upsert rules\.bag\.use/);
    expect(localStorage.getItem(KEY)).toBe(persisted);
  });
});
