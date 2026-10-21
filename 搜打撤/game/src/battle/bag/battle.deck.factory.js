/** Deck randomization belongs to the caller's random stream. */
export function createDeckOperations(Random) {
// 本场临时牌实体只进入 battle.granted，不写入随身牌或永久卡盒。
function createNormalStarterDeck(template, token, cloneCard) {
  return Array.from({ length: 99 }, (_, index) => ({
    uid: `normal-sha-${token}-${index}`,
    card: cloneCard(template),
  }));
}

function shuffleCards(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Random.random('card') * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function refillDrawPile(deck, discardPile) {
  if (deck.length || !discardPile.length) return 0;
  const recycled = shuffleCards(discardPile.splice(0));
  deck.push(...recycled);
  return recycled.length;
}
return { createNormalStarterDeck, refillDrawPile, shuffleCards };
}
