import { DATA } from '../core/data-loader.js';

export const buildCanonicalCardMap = (cards) => {
  const byId = new Map();
  for (const card of cards) {
    if (!card?.id) throw new Error('cards-sync catalog contains a card without an id');
    if (byId.has(card.id)) throw new Error(`cards-sync catalog contains duplicate id: ${card.id}`);
    byId.set(card.id, card);
  }
  return byId;
};

const canonicalCardsById = buildCanonicalCardMap(DATA.cardsSync.cards);

export function resolveCardCatalog(entries, batchName = 'card catalog') {
  const seenIds = new Set();
  return entries.map((entry) => {
    if (typeof entry !== 'string' && (!entry || typeof entry !== 'object')) {
      throw new Error(`${batchName} contains an invalid entry`);
    }
    const isReference = typeof entry === 'string' || Object.hasOwn(entry, 'ref');
    const id = typeof entry === 'string' ? entry : isReference ? entry.ref : entry.id;
    if (typeof id !== 'string' || !id) throw new Error(`${batchName} contains an entry without an id`);
    if (seenIds.has(id)) throw new Error(`${batchName} contains duplicate id: ${id}`);
    seenIds.add(id);
    if (!isReference) {
      if (canonicalCardsById.has(id)) {
        throw new Error(`${batchName} must reference canonical cards-sync id: ${id}`);
      }
      return entry;
    }
    const metadata = typeof entry === 'string' ? {} : entry.metadata ?? {};
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error(`${batchName} reference ${id} has invalid metadata`);
    }
    const canonical = canonicalCardsById.get(id);
    if (!canonical) throw new Error(`${batchName} references missing cards-sync id: ${id}`);
    return { ...metadata, ...canonical };
  });
}
