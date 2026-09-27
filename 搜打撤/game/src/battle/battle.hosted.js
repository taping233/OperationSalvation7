import { DATA } from '../core/data-loader.js';
import { dataSlice } from '../cards/cards.data.js';
import { HOSTED_CARD_RULES } from '../cards/card-rules.schema.js';

// Hosted entries are keyed to fixed production identities. Their execution text
// comes only from read-only source catalogs, never from a player's saved card.
export const HOSTED_EXECUTION_CARD_IDS = HOSTED_CARD_RULES;

const SOURCE_CATALOGS = [
  DATA.cardsSync?.cards,
  dataSlice.TABLETOP12, dataSlice.TABLETOP11, dataSlice.TABLETOP10,
  dataSlice.TABLETOP9, dataSlice.TABLETOP8, dataSlice.TABLETOP7, dataSlice.TABLETOP6,
  dataSlice.TABLETOP5, dataSlice.TABLETOP4, dataSlice.TABLETOP3, dataSlice.TABLETOP2,
  dataSlice.TABLETOP,
].filter(Array.isArray);

/** Return a battle-only view with canonical effect text while preserving runtime state. */
export function getHostedExecutionCard(card) {
  if (!card || typeof card !== 'object') return card;
  const expectedName = HOSTED_EXECUTION_CARD_IDS[card.id];
  const declared = card.rules?.battle?.hosted;
  if (!expectedName || !Array.isArray(declared) || !declared.includes(expectedName)) return card;
  if (card.rules?.triggers || card.rules?.equip || card.rules?.bag) return card;
  const canonical = SOURCE_CATALOGS.map(cards => cards.find(entry => entry?.id === card.id)).find(Boolean);
  if (!canonical || typeof canonical.desc !== 'string') return card;
  return { ...canonical, ...card, desc: canonical.desc };
}
