import { Random } from './random.js';

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

export { refillDrawPile, shuffleCards };
