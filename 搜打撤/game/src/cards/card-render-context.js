/* A lookup snapshot for one card-render dataset. */
import { rarityOf } from './card-rarity.js';

export function createCardRenderContext(catalog) {
  const firstById = new Map();
  for (const card of catalog || []) {
    if (!card) continue;
    const id = card.id;
    if (!firstById.has(id)) firstById.set(id, card);
  }

  const findById = (id) => firstById.get(id);
  return Object.freeze({ rarityOf: (card) => rarityOf(card, findById) });
}
