import { DATA } from '../../core/data-loader.js';
import { dataSlice } from '../../cards/cards.data.js';
import { HOSTED_CARD_RULES } from '../../cards/card-rules.schema.js';
import { buildFirstSourceCardIndex } from './hosted-catalog-index.js';

// Hosted entries are keyed to fixed production identities. Their execution text
// comes only from read-only source catalogs, never from a player's saved card.

const SOURCE_CATALOGS = [
  // Source order is part of the contract: the first matching catalog is canonical.
  DATA.cardsSync?.cards,
  dataSlice.TABLETOP12, dataSlice.TABLETOP11, dataSlice.TABLETOP10,
  dataSlice.TABLETOP9, dataSlice.TABLETOP8, dataSlice.TABLETOP7, dataSlice.TABLETOP6,
  dataSlice.TABLETOP5, dataSlice.TABLETOP4, dataSlice.TABLETOP3, dataSlice.TABLETOP2,
  dataSlice.TABLETOP,
].filter(Array.isArray);
const CANONICAL_CARD_BY_ID = buildFirstSourceCardIndex(SOURCE_CATALOGS);

/** Return a battle-only view with canonical effect text while preserving runtime state. */
export function getHostedExecutionCard(card) {
  if (!card || typeof card !== 'object') return card;
  const expectedName = HOSTED_CARD_RULES[card.id];
  const declared = card.rules?.battle?.hosted;
  if (!expectedName || !Array.isArray(declared) || !declared.includes(expectedName)) return card;
  if (card.rules?.triggers || card.rules?.equip || card.rules?.bag) return card;
  const canonical = CANONICAL_CARD_BY_ID.get(card.id);
  if (!canonical || typeof canonical.desc !== 'string') return card;
  return { ...canonical, ...card, desc: canonical.desc };
}
