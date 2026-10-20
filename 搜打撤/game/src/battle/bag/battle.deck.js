import { Random } from '../../core/random.js';
import { createDeckOperations } from './battle.deck.factory.js';

const { createNormalStarterDeck, refillDrawPile, shuffleCards } = createDeckOperations(Random);
export { createNormalStarterDeck, refillDrawPile, shuffleCards };
