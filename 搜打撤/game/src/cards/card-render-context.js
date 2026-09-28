// @ts-check
/* A lookup snapshot for one card-render dataset. */
import { rarityOf } from './card-rarity.js';

/** @typedef {import('./card-rarity.js').CardRarityInput} CardRarityInput */

/** @param {readonly (CardRarityInput | null | undefined)[] | null | undefined} catalog
 * @returns {Readonly<{ rarityOf: (card: CardRarityInput) => import('./card-rarity.js').CardRarity | undefined }>}
 */
export function createCardRenderContext(catalog) {
  /** @type {Map<string | undefined, CardRarityInput>} */
  const firstById = new Map();
  for (const card of catalog || []) {
    if (!card) continue;
    const id = card.id;
    if (!firstById.has(id)) firstById.set(id, card);
  }

  /** @type {import('./card-rarity.js').CardLookup} */
  const findById = id => firstById.get(id);
  return Object.freeze({ rarityOf: (card) => rarityOf(card, findById) });
}
