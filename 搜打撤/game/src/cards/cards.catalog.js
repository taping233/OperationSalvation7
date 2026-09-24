import { DATA } from '../core/data-loader.js';

export function validateCardId(id) {
  return typeof id === 'string' && id.length > 0 && id === id.trim() && !/\s/.test(id);
}

export const buildCanonicalCardMap = (cards) => {
  const byId = new Map();
  for (const card of cards) {
    if (card?.id === undefined || card.id === null || card.id === '') throw new Error('cards-sync catalog contains a card without an id');
    if (!validateCardId(card.id)) throw new Error('cards-sync catalog contains an invalid id: ' + card.id);
    if (byId.has(card.id)) throw new Error(`cards-sync catalog contains duplicate id: ${card.id}`);
    byId.set(card.id, card);
  }
  return byId;
};

const canonicalCardsById = buildCanonicalCardMap(DATA.cardsSync.cards);

export function classifyCardContent(card, index = canonicalCardsById) {
  if (!card || typeof card !== 'object' || !validateCardId(card.id)) {
    throw new Error('card content contains an invalid id');
  }
  const definition = index.get(card.id);
  return definition
    ? { kind: 'builtin', id: card.id, definition, saved: card }
    : { kind: 'custom', id: card.id, definition: card, saved: card };
}

export function resolveCardCatalog(entries, batchName = 'card catalog') {
  const seenIds = new Set();
  return entries.map((entry) => {
    if (typeof entry !== 'string' && (!entry || typeof entry !== 'object')) {
      throw new Error(`${batchName} contains an invalid entry`);
    }
    const isReference = typeof entry === 'string' || Object.hasOwn(entry, 'ref');
    const id = typeof entry === 'string' ? entry : isReference ? entry.ref : entry.id;
    if (id === undefined || id === null || id === '') throw new Error(batchName + ' contains an entry without an id');
    if (!validateCardId(id)) throw new Error(batchName + ' contains an invalid id');
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
