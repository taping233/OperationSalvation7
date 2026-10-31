import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const game = new URL('../../../搜打撤/game/', import.meta.url);
const [{ previewCollectionConversion }, { stashSalePrice }, { SeededRandomService }, { isRandomObtainableCard }] = await Promise.all([
  import(new URL('src/hub/collection-conversion.js', game)), import(new URL('src/hub/stash-sale-price.js', game)),
  import(new URL('src/core/random-service.js', game)), import(new URL('src/cards/card-obtainability.js', game)),
]);
const conversions = [];
for (const type of ['武术', '能力卡']) for (const lv of [1, 9, 10]) for (const registered of [false, true])
  for (const protect of [false, true]) for (const count of [1, 2, 0]) {
    const card = { id: 'parity-conversion', name: '对照归档', cls: '侠客', rarity: '职业', type };
    const baseSnapshot = { characters: { wu: { lv, xp: lv === 9 ? 369 : 0 } }, collection: {} };
    if (registered) baseSnapshot.collection[card.id] = { protected: protect };
    const input = { baseSnapshot, card, availableCount: 3, count };
    const result = previewCollectionConversion(input);
    conversions.push({ input, expected: { canConvert: result.canConvert, maxCount: result.maxCount, actualXp: result.actualXp,
      overflowXp: result.overflowXp, beforeLevel: result.before.lv, afterLevel: result.after.lv } });
  }
const prices = ['古朴', '稀有', '史诗', '传说'].map(rarity => ({ rarity,
  expected: stashSalePrice({ sellPrice: () => 37 }, { rarity, value: 37 }) }));
const cards = ['古朴', '稀有', '史诗', '传说'].flatMap((rarity, i) => ['武术', '法术', '装备', '资源'].map((type, j) => ({
  id: `parity-starter-${i}-${j}`, name: `招式${i}${j}`, rarity, type,
})));
const rules = readFileSync(new URL('src/cards/cards.rules.js', game), 'utf8');
const weights = vm.runInNewContext('(' + rules.match(/SHOP_WEIGHTS:\s*(\{[^}]+\})/)[1] + ')');
const base = readFileSync(new URL('src/hub/base.js', game), 'utf8');
const begin = base.indexOf('  function seedStarterStash() {');
const end = base.indexOf('\n  // 只读概览', begin);
if (begin < 0 || end < 0) throw new Error('Current starter function boundaries changed');
const starters = [1, 2, 7, 17, 99, 144, 65535, 12345678].map(seed => {
  const random = new SeededRandomService(seed), data = { stash: [] };
  vm.runInNewContext(base.slice(begin, end) + '\nseedStarterStash();', {
    window: { SDT: { Cards: { all: () => cards, isRandomObtainable: isRandomObtainableCard, SHOP_WEIGHTS: weights } } },
    data, Random: random, stashUsed: () => data.stash.reduce((sum, stack) => sum + stack.count, 0),
  });
  return { seed, ids: data.stash.map(stack => stack.card.id), nextReward: random.random('card', 'reward'), nextGameplay: random.random() };
});
writeFileSync(new URL('hub-source-vectors.json', import.meta.url), JSON.stringify({ conversions, prices, cards, starters }, null, 2) + '\n');
console.log(JSON.stringify({ conversions: conversions.length, prices: prices.length, starters: starters.length }));
